import { describe, expect, it, vi } from "vitest";
import type { InteractionEvent } from "../../shared/orchestration/events.js";
import type { FlowState } from "../../shared/orchestration/flowState.js";
import type { SpecialistResponse } from "../../shared/orchestration/specialist.js";
import { VYVA_FLOW_CATALOGUE } from "../../shared/orchestration/flowCatalogue.js";
import { VYVA_PRESENTATION_REGISTRY } from "../../shared/orchestration/presentationRegistry.js";
import type {
  EventStateCompatibilityStore,
  ShadowPersistenceWriteResult,
} from "../orchestrator/eventStatePersistence.js";
import {
  createPreventiveHealthSpecialistRequest,
  proposePreventiveHealthCompletion,
  validatePreventiveHealthSpecialistProposal,
} from "./healthSpecialistAdapter.js";
import {
  PREVENTIVE_HEALTH_FLOW_DEFINITION,
  PREVENTIVE_HEALTH_FLOW_ID,
  PREVENTIVE_HEALTH_FLOW_VERSION,
  PREVENTIVE_HEALTH_SCENE_ID,
  type PreventiveHealthAnswers,
  resolvePreventiveHealthRuntimeContract,
  runPreventiveHealthFlowFromAnswers,
  runPreventiveHealthFlowFromSubmissions,
} from "./preventiveHealthFlow.js";
import {
  type PreventiveHealthCompletionClaim,
  type PreventiveHealthPersistedCompletion,
  type PreventiveHealthPersistenceIdentity,
  type PreventiveHealthResult,
  attemptPreventiveHealthCheckin,
} from "./preventiveHealthOrchestrator.js";
import { evaluatePreventiveCheckinSafety } from "./preventiveHealthSafety.js";

const NOW = new Date("2026-08-04T09:30:00.000Z");
const USER_ID = "user-task9";
const SESSION_ID = "session-task9";

const baseAnswers: PreventiveHealthAnswers = {
  energy_level: 4,
  mood: "alegre",
  body_areas: ["ninguno"],
  sleep_quality: "bien",
  symptoms: ["dolor_cabeza"],
  symptom_details: ["headache_mild"],
  safety_flags: ["mild_stable"],
  social_contact: "algo",
};

const baseResult: PreventiveHealthResult = {
  feeling_label: "Stable day",
  overall_state: "good",
  vyva_reading: "A gentle preventive reading is ready.",
  why_today: "The answers are stable.",
  trend_note: null,
  personal_plan: "Keep the day simple.",
  app_suggestion: "Use the existing health plan.",
  suggested_app_action: "concierge",
  right_now: ["Drink water"],
  today_actions: ["Take a short pause"],
  highlight: "A steady preventive check.",
  flag_caregiver: false,
  watch_for: null,
};

function questionId(key: string): string {
  const question = PREVENTIVE_HEALTH_FLOW_DEFINITION.questions.find((item) =>
    item.key === key);
  expect(question).toBeDefined();
  return question!.questionId;
}

function touchSubmission(question: string, answerId: string, value?: unknown) {
  return {
    questionId: question,
    sceneId: PREVENTIVE_HEALTH_SCENE_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    modality: "touch" as const,
    answerId,
    ...(value !== undefined ? { value } : {}),
  };
}

function voiceSubmission(question: string, transcript: string) {
  return {
    questionId: question,
    sceneId: PREVENTIVE_HEALTH_SCENE_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    modality: "voice" as const,
    transcript,
  };
}

function textSubmission(question: string, text: string) {
  return {
    questionId: question,
    sceneId: PREVENTIVE_HEALTH_SCENE_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    modality: "text" as const,
    text,
  };
}

function equivalentSubmissions(kind: "voice" | "touch" | "text") {
  const values = [
    ["energy_level", "energy_4", "Bastante bien", "Bastante bien"],
    ["mood", "alegre", "Alegre", "Alegre"],
    ["body_areas", "ninguno", "Nada especial", "Nada especial"],
    ["sleep_quality", "bien", "Bien", "Bien"],
    ["symptoms", "dolor_cabeza", "Dolor de cabeza", "Dolor de cabeza"],
    ["symptom_details", "headache_mild", "Es parecido a otros dolores", "Es parecido a otros dolores"],
    ["safety_flags", "mild_stable", "Es leve y estable", "Es leve y estable"],
    ["social_contact", "algo", "Un poco", "Un poco"],
  ] as const;
  return values.map(([key, id, spoken, typed]) => {
    const qid = questionId(key);
    if (kind === "voice") return voiceSubmission(qid, spoken);
    if (kind === "text") return textSubmission(qid, typed);
    const question = PREVENTIVE_HEALTH_FLOW_DEFINITION.questions.find((item) =>
      item.key === key)!;
    return question.answerMode === "multi_option"
      ? touchSubmission(qid, id, [id])
      : touchSubmission(qid, id);
  });
}

class CapturingStore implements EventStateCompatibilityStore {
  events: InteractionEvent[] = [];
  flows: FlowState[] = [];

  async writeInteractionEvent(event: InteractionEvent): Promise<ShadowPersistenceWriteResult> {
    this.events.push(event);
    return { outcome: "stored" };
  }

  async writeFlowProjection(flowState: FlowState): Promise<ShadowPersistenceWriteResult> {
    this.flows.push(flowState);
    return { outcome: "stored" };
  }

  async eventsByCorrelation(correlationId: string): Promise<InteractionEvent[]> {
    return this.events.filter((event) => event.correlationId === correlationId);
  }

  async activeFlowsBySession(sessionId: string): Promise<FlowState[]> {
    return this.flows.filter((flow) =>
      flow.sessionId === sessionId &&
      !["completed", "cancelled", "expired", "escalated", "failed"].includes(flow.state));
  }
}

function successfulDependencies(store = new CapturingStore()) {
  const claims = new Map<string, {
    state: "pending" | "completed" | "failed";
    claimToken?: string;
    completion?: PreventiveHealthPersistedCompletion<PreventiveHealthResult>;
    expiresAt: number;
  }>();
  let claimCount = 0;
  let insertCount = 0;
  const generateResult = vi.fn(async () => baseResult);
  const keyFor = (userId: string, identity: PreventiveHealthPersistenceIdentity) =>
    [
      userId,
      identity.flowId,
      identity.flowVersion,
      identity.flowInstanceId,
      identity.completionReference,
    ].join("|");
  const acquireCompletionClaim = vi.fn(async (
    userId: string,
    _language: string,
    _answers: PreventiveHealthAnswers,
    _durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    now: Date,
  ): Promise<PreventiveHealthCompletionClaim<PreventiveHealthResult>> => {
    const key = keyFor(userId, identity);
    const existing = claims.get(key);
    if (existing?.state === "completed" && existing.completion) {
      return { state: "completed", completion: { ...existing.completion, inserted: false } };
    }
    if (existing?.state === "pending" && existing.expiresAt > now.getTime()) {
      return {
        state: "pending",
        retryAfterSeconds: 2,
        claimExpiresAt: new Date(existing.expiresAt).toISOString(),
      };
    }
    claimCount += 1;
    const claimToken = `claim-token-${claimCount}`;
    const expiresAt = now.getTime() + 900_000;
    claims.set(key, { state: "pending", claimToken, expiresAt });
    return {
      state: "claimed",
      sessionId: `checkin-session-${claimCount}`,
      claimToken,
      claimExpiresAt: new Date(expiresAt).toISOString(),
    };
  });
  const completeClaim = vi.fn(async (
    userId: string,
    _language: string,
    _answers: PreventiveHealthAnswers,
    result: PreventiveHealthResult,
    _durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    claimToken: string,
  ) => {
    const key = keyFor(userId, identity);
    const existing = claims.get(key);
    if (existing?.state === "completed" && existing.completion) {
      return { ...existing.completion, inserted: false };
    }
    if (existing?.state !== "pending" || existing.claimToken !== claimToken) {
      return undefined;
    }
    insertCount += 1;
    const sessionId = `checkin-session-${insertCount}`;
    const persisted = { sessionId, result, inserted: true };
    claims.set(key, {
      state: "completed",
      completion: persisted,
      expiresAt: existing.expiresAt,
    });
    return persisted;
  });
  const markClaimFailed = vi.fn(async (
    userId: string,
    identity: PreventiveHealthPersistenceIdentity,
    claimToken: string,
  ) => {
    const key = keyFor(userId, identity);
    const existing = claims.get(key);
    if (existing?.state === "pending" && existing.claimToken === claimToken) {
      claims.set(key, { state: "failed", claimToken, expiresAt: 0 });
    }
  });
  const loadCompletedSession = vi.fn(async (
    userId: string,
    identity: PreventiveHealthPersistenceIdentity,
  ) => {
    const existing = claims.get(keyFor(userId, identity));
    return existing?.state === "completed" && existing.completion
      ? { ...existing.completion, inserted: false }
      : undefined;
  });
  return {
    dependencies: {
      generateResult,
      acquireCompletionClaim,
      completeClaim,
      markClaimFailed,
      loadCompletedSession,
      updateTrend: vi.fn(async () => {}),
      markDailyCheckinCompleted: vi.fn(async () => {}),
      eventStore: store,
    },
    store,
    insertCount: () => insertCount,
    claimCount: () => claimCount,
  };
}

describe("preventive Health Flow runtime definition", () => {
  it("declares the first Health Flow as the existing canonical preventive check", () => {
    expect(PREVENTIVE_HEALTH_FLOW_DEFINITION).toMatchObject({
      flowId: PREVENTIVE_HEALTH_FLOW_ID,
      flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
      ownerSpecialistId: "preventive_health",
      sceneId: "health.preventive_check.main",
      completionId: "health.preventive_check.completed",
    });
    const contract = resolvePreventiveHealthRuntimeContract();
    expect(contract).toBeTruthy();
    expect(contract?.canonicalFlow).toBe(
      VYVA_FLOW_CATALOGUE.flows.find((flow) => flow.flowId === PREVENTIVE_HEALTH_FLOW_ID),
    );
    expect(contract?.presentations.every((presentation) =>
      presentation.sceneId === PREVENTIVE_HEALTH_SCENE_ID &&
      presentation.supportedFlowIds.includes(PREVENTIVE_HEALTH_FLOW_ID))).toBe(true);
    expect(VYVA_PRESENTATION_REGISTRY.presentations.some((presentation) =>
      presentation.sceneId === PREVENTIVE_HEALTH_SCENE_ID &&
      presentation.supportedFlowIds.includes(PREVENTIVE_HEALTH_FLOW_ID))).toBe(true);
    expect(PREVENTIVE_HEALTH_FLOW_DEFINITION.questions.map((item) => item.key)).toEqual([
      "energy_level",
      "mood",
      "body_areas",
      "sleep_quality",
      "symptoms",
      "symptom_details",
      "safety_flags",
      "social_contact",
    ]);
  });

  it("starts, collects answers, and completes deterministically", () => {
    const run = runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: baseAnswers,
      modality: "touch",
    });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.result.transitions.map((item) => [item.from, item.to])).toEqual([
      ["idle", "initializing"],
      ["initializing", "active"],
      ["active", "waiting_for_user"],
      ["waiting_for_user", "active"],
      ["active", "completed"],
    ]);
    expect(run.result.finalState.state).toBe("completed");
    expect(run.result.finalState.context).toMatchObject({
      completionOutcome: {
        completionReference: run.result.completionReference,
        answerDigest: run.result.answerDigest,
        result: "structured_checkin_saved",
      },
    });
  });

  it("fails closed when the frozen catalogue or presentation registry contract is incompatible", () => {
    const catalogueWithoutScene = {
      ...VYVA_FLOW_CATALOGUE,
      flows: VYVA_FLOW_CATALOGUE.flows.map((flow) =>
        flow.flowId === PREVENTIVE_HEALTH_FLOW_ID
          ? { ...flow, uiScenes: [] }
          : flow),
    };
    const registryWithoutPresentation = {
      ...VYVA_PRESENTATION_REGISTRY,
      presentations: VYVA_PRESENTATION_REGISTRY.presentations.filter((presentation) =>
        !presentation.supportedFlowIds.includes(PREVENTIVE_HEALTH_FLOW_ID)),
    };

    expect(runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: baseAnswers,
      catalogue: catalogueWithoutScene,
    })).toEqual({ ok: false, reasonCode: "contract_invalid" });
    expect(runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: baseAnswers,
      presentationRegistry: registryWithoutPresentation,
    })).toEqual({ ok: false, reasonCode: "contract_invalid" });
  });

  it("normalizes voice, touch, and text answers to the same completion", () => {
    const voice = runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: equivalentSubmissions("voice"),
      modality: "voice",
    });
    const touch = runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: equivalentSubmissions("touch"),
      modality: "touch",
    });
    const text = runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: equivalentSubmissions("text"),
      modality: "text",
    });
    expect(voice.ok && touch.ok && text.ok).toBe(true);
    if (!voice.ok || !touch.ok || !text.ok) return;
    expect(voice.result.normalizedAnswers).toEqual(touch.result.normalizedAnswers);
    expect(text.result.normalizedAnswers).toEqual(touch.result.normalizedAnswers);
    expect(voice.result.answerDigest).toBe(touch.result.answerDigest);
    expect(text.result.answerDigest).toBe(touch.result.answerDigest);
    expect(voice.result.completionReference).toBe(touch.result.completionReference);
    expect(text.result.finalState).toEqual(touch.result.finalState);
  });

  it("rejects stale, duplicate, invalid, and out-of-order answers", () => {
    const submissions = equivalentSubmissions("touch");
    expect(runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: [{ ...submissions[0], flowVersion: "0.9.0" }, ...submissions.slice(1)],
    })).toMatchObject({ ok: false, reasonCode: "stale_answer" });
    expect(runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: [submissions[0], submissions[0], ...submissions.slice(2)],
    })).toMatchObject({ ok: false, reasonCode: "duplicate_answer" });
    expect(runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: [submissions[1], submissions[0], ...submissions.slice(2)],
    })).toMatchObject({ ok: false, reasonCode: "out_of_order_answer" });
    expect(runPreventiveHealthFlowFromSubmissions({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      submissions: [{ ...submissions[0], answerId: "energy_99" }, ...submissions.slice(1)],
    })).toMatchObject({ ok: false, reasonCode: "answer_invalid" });
  });

  it("canonicalizes multi-select answer order for digests and saved answers", () => {
    const left = runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: { ...baseAnswers, symptoms: ["nauseas", "dolor_cabeza"] },
    });
    const right = runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: { ...baseAnswers, symptoms: ["dolor_cabeza", "nauseas"] },
    });
    expect(left.ok && right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect(left.result.normalizedAnswers.symptoms).toEqual(["dolor_cabeza", "nauseas"]);
    expect(right.result.answerDigest).toBe(left.result.answerDigest);
  });
});

describe("preventive Health Specialist adapter", () => {
  it("validates a complete no-tool no-memory Specialist proposal", () => {
    const flow = runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: baseAnswers,
    });
    expect(flow.ok).toBe(true);
    if (!flow.ok) return;
    const request = createPreventiveHealthSpecialistRequest({
      requestId: "request-task9",
      correlationId: "correlation-task9",
      userId: USER_ID,
      sessionId: SESSION_ID,
      flowInstanceId: SESSION_ID,
      currentState: "active",
      inputModality: "touch",
      locale: "es",
      timezone: "Europe/Madrid",
      requestedAt: NOW.toISOString(),
      completionReference: flow.result.completionReference,
      answerDigest: flow.result.answerDigest,
      normalizedAnswersByQuestion: flow.result.normalizedAnswersByQuestion,
      safetyFlags: [],
    });
    const response = proposePreventiveHealthCompletion({
      request,
      completionReference: flow.result.completionReference,
      answerDigest: flow.result.answerDigest,
    });
    expect(validatePreventiveHealthSpecialistProposal(request, response)).toMatchObject({
      ok: true,
      response: {
        status: "complete",
        proposedToolCalls: [],
        memoryWritesProposed: [],
        completionResult: {
          completionReference: flow.result.completionReference,
          answerDigest: flow.result.answerDigest,
          flowId: PREVENTIVE_HEALTH_FLOW_ID,
          flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
          flowInstanceId: SESSION_ID,
          persistenceOwner: "checkin_sessions",
          persistedBy: "existing_checkin_session",
          finalDecisionAuthority: "central_orchestrator",
          contractVersion: "1.0.0",
        },
      },
    });
  });

  it("rejects malformed or side-effecting Specialist proposals", () => {
    const flow = runPreventiveHealthFlowFromAnswers({
      userId: USER_ID,
      sessionId: SESSION_ID,
      occurredAt: NOW.toISOString(),
      answers: baseAnswers,
    });
    expect(flow.ok).toBe(true);
    if (!flow.ok) return;
    const request = createPreventiveHealthSpecialistRequest({
      requestId: "request-task9",
      correlationId: "correlation-task9",
      userId: USER_ID,
      sessionId: SESSION_ID,
      flowInstanceId: SESSION_ID,
      currentState: "active",
      inputModality: "touch",
      locale: "es",
      timezone: "Europe/Madrid",
      requestedAt: NOW.toISOString(),
      completionReference: flow.result.completionReference,
      answerDigest: flow.result.answerDigest,
      normalizedAnswersByQuestion: flow.result.normalizedAnswersByQuestion,
      safetyFlags: [],
    });
    const response = proposePreventiveHealthCompletion({
      request,
      completionReference: flow.result.completionReference,
      answerDigest: flow.result.answerDigest,
    });
    const { completionResult, flowStateUpdate, ...withoutCompletion } = response;
    const malformed = {
      ...withoutCompletion,
      status: "answered",
    } as SpecialistResponse;
    expect(validatePreventiveHealthSpecialistProposal(request, malformed)).toEqual({
      ok: false,
      reasonCode: "specialist_response_invalid",
    });
    expect(validatePreventiveHealthSpecialistProposal(request, {
      ...response,
      proposedToolCalls: [{
        proposalId: "proposal-task9",
        toolId: "tool.send_message",
        arguments: {},
        reason: "Should not execute.",
        requiresConfirmation: false,
        riskLevel: "low",
      }],
    })).toEqual({
      ok: false,
      reasonCode: "specialist_response_invalid",
    });
    expect(validatePreventiveHealthSpecialistProposal(request, {
      ...response,
      completionResult: {
        ...response.completionResult,
        answerDigest: "sha256:wrongdigest",
      },
    })).toEqual({
      ok: false,
      reasonCode: "specialist_response_invalid",
    });
    expect(validatePreventiveHealthSpecialistProposal(request, {
      ...response,
      completionResult: {
        ...response.completionResult,
        flowVersion: "9.9.9",
      },
    })).toEqual({
      ok: false,
      reasonCode: "specialist_response_invalid",
    });
    expect(validatePreventiveHealthSpecialistProposal(request, {
      ...response,
      completionResult: {
        ...response.completionResult,
        executeNow: true,
      },
    })).toEqual({
      ok: false,
      reasonCode: "specialist_response_invalid",
    });
    expect(completionResult).toBeDefined();
    expect(flowStateUpdate).toBeDefined();
  });
});

describe("preventive Health orchestrator seam", () => {
  it("keeps unflagged users on the legacy path without side effects", async () => {
    const { dependencies, store } = successfulDependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {},
      now: NOW,
      dependencies,
    });
    expect(result).toMatchObject({
      outcome: "legacy",
      reasonCode: "preventive_health_flow_disabled",
    });
    expect(dependencies.generateResult).not.toHaveBeenCalled();
    expect(dependencies.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(dependencies.completeClaim).not.toHaveBeenCalled();
    expect(store.events).toHaveLength(0);
  });

  it("completes an eligible preventive check through one structured save", async () => {
    const { dependencies, store, insertCount } = successfulDependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });
    expect(result).toMatchObject({
      outcome: "completed",
      sessionId: "checkin-session-1",
      meta: {
        flow_id: PREVENTIVE_HEALTH_FLOW_ID,
        flow_version: PREVENTIVE_HEALTH_FLOW_VERSION,
        mode: "authoritative",
        persistence_status: "created",
      },
    });
    expect(insertCount()).toBe(1);
    expect(dependencies.acquireCompletionClaim).toHaveBeenCalledTimes(1);
    expect(dependencies.completeClaim).toHaveBeenCalledTimes(1);
    expect(dependencies.updateTrend).toHaveBeenCalledTimes(1);
    expect(dependencies.markDailyCheckinCompleted).toHaveBeenCalledTimes(1);
    expect(store.flows).toHaveLength(1);
    expect(store.flows[0].state).toBe("completed");
  });

  it("keeps completion persistence idempotent for duplicate completion attempts", async () => {
    const { dependencies, insertCount } = successfulDependencies();
    const env = {
      VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
      VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
      NODE_ENV: "staging",
    };
    const first = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    const second = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    expect(first.outcome).toBe("completed");
    expect(second.outcome).toBe("completed");
    if (first.outcome !== "completed" || second.outcome !== "completed") return;
    expect(first.result).toBe(baseResult);
    expect(second.result).toBe(baseResult);
    expect(second.sessionId).toBe(first.sessionId);
    expect(second.meta.persistence_status).toBe("existing");
    expect(insertCount()).toBe(1);
    expect(dependencies.generateResult).toHaveBeenCalledTimes(1);
    expect(dependencies.acquireCompletionClaim).toHaveBeenCalledTimes(2);
    expect(dependencies.completeClaim).toHaveBeenCalledTimes(1);
    expect(dependencies.updateTrend).toHaveBeenCalledTimes(1);
    expect(dependencies.markDailyCheckinCompleted).toHaveBeenCalledTimes(1);
  });

  it("returns a bounded pending outcome for concurrent duplicate requests without duplicate generation", async () => {
    const { dependencies, insertCount } = successfulDependencies();
    let releaseGeneration!: (result: PreventiveHealthResult) => void;
    dependencies.generateResult.mockImplementationOnce(() =>
      new Promise<PreventiveHealthResult>((resolve) => {
        releaseGeneration = resolve;
      }));
    const env = {
      VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
      VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
      NODE_ENV: "staging",
    };
    const first = attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    await Promise.resolve();
    const second = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    expect(second).toMatchObject({
      outcome: "pending",
      reasonCode: "preventive_health_flow_completion_pending",
      retryAfterSeconds: 2,
    });
    expect(dependencies.generateResult).toHaveBeenCalledTimes(1);
    expect(dependencies.completeClaim).not.toHaveBeenCalled();

    releaseGeneration(baseResult);
    const completedFirst = await first;
    expect(completedFirst).toMatchObject({
      outcome: "completed",
      meta: { persistence_status: "created" },
    });
    expect(insertCount()).toBe(1);
  });

  it("keeps ten concurrent duplicate requests to one generator and one completion write", async () => {
    const { dependencies, insertCount } = successfulDependencies();
    const env = {
      VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
      VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
      NODE_ENV: "staging",
    };
    const results = await Promise.all(Array.from({ length: 10 }, () =>
      attemptPreventiveHealthCheckin({
        accountUserId: USER_ID,
        userId: USER_ID,
        sessionId: SESSION_ID,
        profile: { name: "Test" },
        answers: baseAnswers,
        language: "es",
        durationSeconds: 20,
        env,
        now: NOW,
        dependencies,
      })));
    expect(results.filter((result) => result.outcome === "completed")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "pending")).toHaveLength(9);
    expect(dependencies.generateResult).toHaveBeenCalledTimes(1);
    expect(dependencies.completeClaim).toHaveBeenCalledTimes(1);
    expect(insertCount()).toBe(1);
  });

  it("keeps a completed claim authoritative when post-commit observability fails", async () => {
    const failingStore: EventStateCompatibilityStore = {
      writeInteractionEvent: vi.fn(async () => {
        throw new Error("event write unavailable after completion");
      }),
      writeFlowProjection: vi.fn(async () => {
        throw new Error("flow write unavailable after completion");
      }),
      eventsByCorrelation: vi.fn(async () => []),
      activeFlowsBySession: vi.fn(async () => []),
    };
    const { dependencies, insertCount } = successfulDependencies(failingStore);
    const env = {
      VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
      VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
      NODE_ENV: "staging",
    };

    const first = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    const retry = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: new Date(NOW.getTime() + 1_000),
      dependencies,
    });

    expect(first).toMatchObject({
      outcome: "completed",
      meta: { persistence_status: "created" },
    });
    expect(retry).toMatchObject({
      outcome: "completed",
      meta: { persistence_status: "existing" },
    });
    expect(dependencies.generateResult).toHaveBeenCalledTimes(1);
    expect(dependencies.completeClaim).toHaveBeenCalledTimes(1);
    expect(dependencies.updateTrend).toHaveBeenCalledTimes(1);
    expect(dependencies.markDailyCheckinCompleted).toHaveBeenCalledTimes(1);
    expect(insertCount()).toBe(1);
    expect(failingStore.writeInteractionEvent).toHaveBeenCalledTimes(3);
    expect(failingStore.writeFlowProjection).toHaveBeenCalledTimes(1);
  });

  it("marks pre-generation failure retryable and lets a later attempt complete", async () => {
    const { dependencies } = successfulDependencies();
    dependencies.generateResult
      .mockRejectedValueOnce(new Error("temporary generator failure"))
      .mockResolvedValueOnce(baseResult);
    const env = {
      VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
      VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
      NODE_ENV: "staging",
    };
    const first = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: NOW,
      dependencies,
    });
    expect(first).toMatchObject({
      outcome: "retryable",
      reasonCode: "preventive_health_flow_generation_failed",
      meta: { persistence_status: "retryable" },
    });
    expect(dependencies.markClaimFailed).toHaveBeenCalledTimes(1);

    const second = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env,
      now: new Date(NOW.getTime() + 1_000),
      dependencies,
    });
    expect(second).toMatchObject({
      outcome: "completed",
      meta: { persistence_status: "created" },
    });
    expect(dependencies.generateResult).toHaveBeenCalledTimes(2);
    expect(dependencies.completeClaim).toHaveBeenCalledTimes(1);
  });

  it("returns the persisted completion when a concurrent save loses the uniqueness race", async () => {
    const store = new CapturingStore();
    const persistedResult = {
      ...baseResult,
      feeling_label: "Already saved result",
      vyva_reading: "This is the previously persisted response.",
    };
    const dependencies = {
      generateResult: vi.fn(async () => ({
        ...baseResult,
        feeling_label: "Divergent regenerated result",
      })),
      acquireCompletionClaim: vi.fn(async (): Promise<PreventiveHealthCompletionClaim<PreventiveHealthResult>> => ({
        state: "completed",
        completion: {
          sessionId: "checkin-session-existing",
          result: persistedResult,
          inserted: false,
        },
      })),
      completeClaim: vi.fn(async () => undefined),
      markClaimFailed: vi.fn(async () => {}),
      loadCompletedSession: vi.fn(async () => undefined),
      updateTrend: vi.fn(async () => {}),
      markDailyCheckinCompleted: vi.fn(async () => {}),
      eventStore: store,
    };

    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });

    expect(result).toMatchObject({
      outcome: "completed",
      sessionId: "checkin-session-existing",
      result: persistedResult,
      meta: { persistence_status: "existing" },
    });
    expect(dependencies.updateTrend).not.toHaveBeenCalled();
    expect(dependencies.markDailyCheckinCompleted).not.toHaveBeenCalled();
    expect(dependencies.generateResult).not.toHaveBeenCalled();
    expect(dependencies.completeClaim).not.toHaveBeenCalled();
    expect(store.events).toHaveLength(0);
    expect(store.flows).toHaveLength(0);
  });

  it("uses explicit safety behavior without generation or an ordinary completion claim", async () => {
    const { dependencies } = successfulDependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: { ...baseAnswers, symptoms: ["falta_aire"], safety_flags: [] },
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });
    expect(result).toMatchObject({
      outcome: "blocked",
      reasonCode: "preventive_health_flow_safety_preempted",
      meta: {
        persistence_status: "not_started",
      },
    });
    expect(dependencies.generateResult).not.toHaveBeenCalled();
    expect(dependencies.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(dependencies.completeClaim).not.toHaveBeenCalled();
    expect(evaluatePreventiveCheckinSafety({
      body_areas: [],
      symptoms: ["falta_aire"],
      symptom_details: [],
      safety_flags: [],
    }).safetySignal).toBe(true);
  });

  it("does not falsely complete when persistence fails", async () => {
    const { dependencies } = successfulDependencies();
    dependencies.completeClaim.mockResolvedValueOnce(undefined);
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });
    expect(result).toMatchObject({
      outcome: "retryable",
      reasonCode: "preventive_health_flow_persistence_failed",
      meta: {
        persistence_status: "retryable",
      },
    });
    expect(dependencies.markClaimFailed).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        flowId: PREVENTIVE_HEALTH_FLOW_ID,
        flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
      }),
      "claim-token-1",
      "preventive_health_flow_persistence_failed",
      NOW,
    );
  });

  it("falls back to legacy on runtime validation failure", async () => {
    const { dependencies } = successfulDependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: { ...baseAnswers, energy_level: 9 },
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });
    expect(result).toMatchObject({
      outcome: "legacy",
      reasonCode: "preventive_health_flow_validation_failed",
    });
    expect(dependencies.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(dependencies.completeClaim).not.toHaveBeenCalled();
  });

  it("observes rejected Specialist validation without generation or persistence", async () => {
    const { dependencies, store } = successfulDependencies();
    const dependenciesWithRejectedSpecialist = {
      ...dependencies,
      proposeSpecialistCompletion: vi.fn((input) => {
        const proposed = proposePreventiveHealthCompletion(input);
        return {
          ...proposed,
          completionResult: {
            ...proposed.completionResult,
            answerDigest: "sha256:wrongdigest",
          },
        };
      }),
    };

    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies: dependenciesWithRejectedSpecialist,
    });

    expect(result).toMatchObject({
      outcome: "blocked",
      reasonCode: "preventive_health_flow_specialist_rejected",
      meta: {
        persistence_status: "not_started",
      },
    });
    expect(dependencies.generateResult).not.toHaveBeenCalled();
    expect(dependencies.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(dependencies.completeClaim).not.toHaveBeenCalled();
    expect(store.events).toHaveLength(1);
    expect(store.events[0]).toMatchObject({
      eventType: "FLOW_FAILED",
      metadata: {
        observabilityKind: "specialist_validation",
        specialistValidationOutcome: "rejected",
      },
    });
    expect(store.flows).toHaveLength(0);
  });

  it("emits minimized Flow-transition and Specialist-validation observability without raw health answers", async () => {
    const { dependencies, store } = successfulDependencies();
    await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: {
        VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
        VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
        NODE_ENV: "staging",
      },
      now: NOW,
      dependencies,
    });
    expect(store.events.map((event) => event.eventType)).toEqual([
      "FLOW_STARTED",
      "FLOW_WAITING_FOR_USER",
      "FLOW_COMPLETED",
    ]);
    expect(store.events.some((event) =>
      event.metadata.observabilityKind === "specialist_validation")).toBe(true);
    const serialized = JSON.stringify(store.events);
    expect(serialized).not.toContain("Dolor de cabeza");
    expect(serialized).not.toContain("Alegre");
    expect(serialized).not.toContain("Bastante bien");
    expect(serialized).not.toContain("headache_mild");
  });
});
