import { type InteractionEvent, parseInteractionEvent } from "../../shared/orchestration/events.js";
import { type AnswerSubmissionModality } from "../../shared/orchestration/flowState.js";
import {
  type EventStateCompatibilityStore,
  defaultEventStateCompatibilityStore,
} from "../orchestrator/eventStatePersistence.js";
import {
  type OrchestratorEnvironmentMap,
  type PreventiveHealthFlowModeResolution,
  resolvePreventiveHealthFlowMode,
} from "../orchestrator/orchestratorFeatureFlags.js";
import {
  createPreventiveHealthSpecialistRequest,
  proposePreventiveHealthCompletion,
  validatePreventiveHealthSpecialistProposal,
} from "./healthSpecialistAdapter.js";
import {
  PREVENTIVE_HEALTH_FLOW_ID,
  PREVENTIVE_HEALTH_FLOW_VERSION,
  type PreventiveHealthAnswers,
  type PreventiveHealthFlowEntryResult,
  type PreventiveHealthFlowRunResult,
  PREVENTIVE_HEALTH_SPECIALIST_ID,
  runPreventiveHealthFlowFromAnswers,
  startPreventiveHealthFlowEntry,
} from "./preventiveHealthFlow.js";
import { evaluatePreventiveCheckinSafety } from "./preventiveHealthSafety.js";

export type PreventiveHealthResult = {
  feeling_label: string;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low";
  vyva_reading: string;
  why_today?: string | null;
  trend_note?: string | null;
  personal_plan?: string | null;
  app_suggestion?: string | null;
  suggested_app_action?:
    | "concierge"
    | "symptom"
    | "vitals"
    | "care"
    | "meditation"
    | "social"
    | "music"
    | "exercise"
    | "chess"
    | "cooking"
    | "art"
    | "literature"
    | null;
  right_now: string[];
  today_actions: string[];
  highlight: string;
  flag_caregiver: boolean;
  watch_for: string | null;
};

export type PreventiveHealthAttemptReasonCode =
  | "preventive_health_flow_disabled"
  | "preventive_health_flow_safety_preempted"
  | "preventive_health_flow_contract_invalid"
  | "preventive_health_flow_validation_failed"
  | "preventive_health_flow_specialist_rejected"
  | "preventive_health_flow_generation_failed"
  | "preventive_health_flow_completion_pending"
  | "preventive_health_flow_persistence_failed"
  | "preventive_health_flow_runtime_failed";

export type PreventiveHealthCompletionMeta = {
  flow_id: typeof PREVENTIVE_HEALTH_FLOW_ID;
  flow_version: typeof PREVENTIVE_HEALTH_FLOW_VERSION;
  completion_reference: string;
  answer_digest: string;
  specialist_id: typeof PREVENTIVE_HEALTH_SPECIALIST_ID;
  mode: "authoritative";
  reason_code: "preventive_health_flow_completed";
  persistence_status: "created" | "existing";
};

export type PreventiveHealthNonCompletionMeta = {
  flow_id: typeof PREVENTIVE_HEALTH_FLOW_ID;
  flow_version: typeof PREVENTIVE_HEALTH_FLOW_VERSION;
  specialist_id: typeof PREVENTIVE_HEALTH_SPECIALIST_ID;
  mode: "authoritative";
  reason_code:
    | "preventive_health_flow_safety_preempted"
    | "preventive_health_flow_specialist_rejected"
    | "preventive_health_flow_generation_failed"
    | "preventive_health_flow_persistence_failed"
    | "preventive_health_flow_completion_pending";
  persistence_status: "not_started" | "pending" | "retryable";
  retry_after_seconds?: number;
};

export type PreventiveHealthAttemptOutcome<TResult extends PreventiveHealthResult> =
  | {
      outcome: "legacy";
      reasonCode: PreventiveHealthAttemptReasonCode;
      flagResolution?: PreventiveHealthFlowModeResolution;
    }
  | {
      outcome: "completed";
      result: TResult;
      sessionId: string;
      meta: PreventiveHealthCompletionMeta;
      flagResolution: PreventiveHealthFlowModeResolution;
    }
  | {
      outcome: "blocked";
      reasonCode:
        | "preventive_health_flow_safety_preempted"
        | "preventive_health_flow_specialist_rejected";
      statusCode: 200 | 409;
      meta: PreventiveHealthNonCompletionMeta;
      flagResolution?: PreventiveHealthFlowModeResolution;
    }
  | {
      outcome: "pending";
      reasonCode: "preventive_health_flow_completion_pending";
      retryAfterSeconds: number;
      meta: PreventiveHealthNonCompletionMeta;
      flagResolution: PreventiveHealthFlowModeResolution;
    }
  | {
      outcome: "retryable";
      reasonCode:
        | "preventive_health_flow_generation_failed"
        | "preventive_health_flow_persistence_failed";
      retryAfterSeconds: number;
      meta: PreventiveHealthNonCompletionMeta;
      flagResolution: PreventiveHealthFlowModeResolution;
    };

export type PreventiveHealthFlowEntryStartOutcome =
  | {
      outcome: "started" | "restored";
      flowId: typeof PREVENTIVE_HEALTH_FLOW_ID;
      flowVersion: typeof PREVENTIVE_HEALTH_FLOW_VERSION;
      sessionId: string;
      evidenceReference: string;
      result: PreventiveHealthFlowEntryResult;
      flagResolution: PreventiveHealthFlowModeResolution;
    }
  | {
      outcome: "rejected";
      reasonCode:
        | "preventive_health_flow_disabled"
        | "preventive_health_flow_contract_invalid"
        | "preventive_health_flow_persistence_failed"
        | "preventive_health_flow_runtime_failed";
      flagResolution?: PreventiveHealthFlowModeResolution;
    };

export type PreventiveHealthPersistenceIdentity = {
  completionReference: string;
  answerDigest: string;
  flowId: typeof PREVENTIVE_HEALTH_FLOW_ID;
  flowVersion: typeof PREVENTIVE_HEALTH_FLOW_VERSION;
  flowInstanceId: string;
};

export type PreventiveHealthPersistedCompletion<TResult extends PreventiveHealthResult> = {
  sessionId: string;
  result: TResult;
  inserted: boolean;
};

export type PreventiveHealthMemoryProposalInput<
  TProfile,
  TResult extends PreventiveHealthResult,
> = {
  accountUserId: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  profile: TProfile;
  result: TResult;
  completionReference: string;
  answerDigest: string;
  flowInstanceId: string;
  completedAt: Date;
  env: OrchestratorEnvironmentMap;
};

export type PreventiveHealthCaregiverOperatorEscalationInput<
  TProfile,
  TResult extends PreventiveHealthResult,
> = PreventiveHealthMemoryProposalInput<TProfile, TResult> & {
  sourceEventId: string;
  sourceAlertId?: string | null;
};

export type PreventiveHealthCompletionClaim<TResult extends PreventiveHealthResult> =
  | {
      state: "claimed";
      sessionId: string;
      claimToken: string;
      claimExpiresAt: string;
    }
  | {
      state: "completed";
      completion: PreventiveHealthPersistedCompletion<TResult>;
    }
  | {
      state: "pending";
      retryAfterSeconds: number;
      claimExpiresAt?: string;
    };

export type PreventiveHealthDependencies<TProfile, TResult extends PreventiveHealthResult> = {
  generateResult: (
    profile: TProfile,
    answers: PreventiveHealthAnswers,
    language: string,
  ) => Promise<TResult>;
  acquireCompletionClaim: (
    userId: string,
    language: string,
    answers: PreventiveHealthAnswers,
    durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    now: Date,
  ) => Promise<PreventiveHealthCompletionClaim<TResult>>;
  completeClaim: (
    userId: string,
    language: string,
    answers: PreventiveHealthAnswers,
    result: TResult,
    durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    claimToken: string,
    now: Date,
  ) => Promise<PreventiveHealthPersistedCompletion<TResult> | undefined>;
  markClaimFailed: (
    userId: string,
    identity: PreventiveHealthPersistenceIdentity,
    claimToken: string,
    reasonCode: "preventive_health_flow_generation_failed" | "preventive_health_flow_persistence_failed",
    now: Date,
  ) => Promise<void>;
  loadCompletedSession: (
    userId: string,
    identity: PreventiveHealthPersistenceIdentity,
  ) => Promise<PreventiveHealthPersistedCompletion<TResult> | undefined>;
  updateTrend: (
    userId: string,
    answers: PreventiveHealthAnswers,
    result: TResult,
  ) => Promise<void>;
  markDailyCheckinCompleted: (
    userId: string,
    now: Date,
    options: { resolveAlerts: boolean },
  ) => Promise<void>;
  eventStore?: EventStateCompatibilityStore;
  proposeSpecialistCompletion?: typeof proposePreventiveHealthCompletion;
  proposeMemoryWrite?: (
    input: PreventiveHealthMemoryProposalInput<TProfile, TResult>,
  ) => Promise<void>;
  proposeCaregiverOperatorEscalation?: (
    input: PreventiveHealthCaregiverOperatorEscalationInput<TProfile, TResult>,
  ) => Promise<void>;
};

function legacy<TResult extends PreventiveHealthResult>(
  reasonCode: PreventiveHealthAttemptReasonCode,
  flagResolution?: PreventiveHealthFlowModeResolution,
): PreventiveHealthAttemptOutcome<TResult> {
  return { outcome: "legacy", reasonCode, ...(flagResolution ? { flagResolution } : {}) };
}

function nonCompletionMeta(
  reasonCode: PreventiveHealthNonCompletionMeta["reason_code"],
  persistenceStatus: PreventiveHealthNonCompletionMeta["persistence_status"],
  retryAfterSeconds?: number,
): PreventiveHealthNonCompletionMeta {
  return {
    flow_id: PREVENTIVE_HEALTH_FLOW_ID,
    flow_version: PREVENTIVE_HEALTH_FLOW_VERSION,
    specialist_id: PREVENTIVE_HEALTH_SPECIALIST_ID,
    mode: "authoritative",
    reason_code: reasonCode,
    persistence_status: persistenceStatus,
    ...(retryAfterSeconds !== undefined ? { retry_after_seconds: retryAfterSeconds } : {}),
  };
}

function completed<TResult extends PreventiveHealthResult>(
  completion: PreventiveHealthPersistedCompletion<TResult>,
  flow: PreventiveHealthFlowRunResult,
  flagResolution: PreventiveHealthFlowModeResolution,
  persistenceStatus: PreventiveHealthCompletionMeta["persistence_status"],
): PreventiveHealthAttemptOutcome<TResult> {
  return {
    outcome: "completed",
    result: completion.result,
    sessionId: completion.sessionId,
    meta: {
      flow_id: PREVENTIVE_HEALTH_FLOW_ID,
      flow_version: PREVENTIVE_HEALTH_FLOW_VERSION,
      completion_reference: flow.completionReference,
      answer_digest: flow.answerDigest,
      specialist_id: PREVENTIVE_HEALTH_SPECIALIST_ID,
      mode: "authoritative",
      reason_code: "preventive_health_flow_completed",
      persistence_status: persistenceStatus,
    },
    flagResolution,
  };
}

function eventId(prefix: string, flow: PreventiveHealthFlowRunResult): string {
  return `${prefix}.${flow.answerDigest.slice("sha256:".length, "sha256:".length + 32)}`;
}

function flowEvent(input: {
  eventType: "FLOW_STARTED" | "FLOW_WAITING_FOR_USER" | "FLOW_COMPLETED" | "FLOW_FAILED";
  eventId: string;
  occurredAt: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  correlationId: string;
  channel: string;
  triggerSource: "user";
  flow: PreventiveHealthFlowRunResult;
  observabilityKind: "flow_transition" | "specialist_validation";
  reasonCode: string;
  modality: AnswerSubmissionModality;
  extraMetadata?: Record<string, unknown>;
}): InteractionEvent {
  return parseInteractionEvent({
    eventId: input.eventId,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    source: "system",
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    channel: input.channel,
    modality: "system",
    triggerSource: input.triggerSource,
    correlationId: input.correlationId,
    payload: input.eventType === "FLOW_FAILED"
      ? {
          reasonCode: input.reasonCode,
          recoverable: false,
        }
      : {},
    safetyContext: { checked: true, flags: [] },
    metadata: {
      schemaVersion: "1.0.0",
      task: "task9.first_health_flow",
      receivedAt: input.occurredAt,
      observabilityKind: input.observabilityKind,
      reasonCode: input.reasonCode,
      answerDigest: input.flow.answerDigest,
      completionReference: input.flow.completionReference,
      inputModality: input.modality,
      rawHealthAnswerContentRetained: false,
      ...(input.extraMetadata ?? {}),
    },
  });
}

async function emitPreventiveHealthObservability(input: {
  store: EventStateCompatibilityStore;
  userId: string;
  profileId?: string;
  sessionId: string;
  occurredAt: string;
  channel: string;
  modality: AnswerSubmissionModality;
  flow: PreventiveHealthFlowRunResult;
  specialistRequestId: string;
  specialistValidationOutcome: "accepted" | "rejected";
}): Promise<void> {
  const correlationId = `corr.health.preventive_check.${input.flow.answerDigest.slice("sha256:".length, "sha256:".length + 32)}`;
  const acceptedEvents = [
    flowEvent({
      eventType: "FLOW_STARTED",
      eventId: eventId("event.health.preventive_check.started", input.flow),
      occurredAt: input.occurredAt,
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      sessionId: input.sessionId,
      correlationId,
      channel: input.channel,
      triggerSource: "user",
      flow: input.flow,
      observabilityKind: "flow_transition",
      reasonCode: "health.preventive_check.started",
      modality: input.modality,
    }),
    flowEvent({
      eventType: "FLOW_WAITING_FOR_USER",
      eventId: eventId("event.health.preventive_check.waiting", input.flow),
      occurredAt: input.occurredAt,
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      sessionId: input.sessionId,
      correlationId,
      channel: input.channel,
      triggerSource: "user",
      flow: input.flow,
      observabilityKind: "flow_transition",
      reasonCode: "health.preventive_check.answers_requested",
      modality: input.modality,
    }),
    flowEvent({
      eventType: "FLOW_COMPLETED",
      eventId: eventId("event.health.preventive_check.completed", input.flow),
      occurredAt: input.occurredAt,
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      sessionId: input.sessionId,
      correlationId,
      channel: input.channel,
      triggerSource: "user",
      flow: input.flow,
      observabilityKind: "specialist_validation",
      reasonCode: "health.preventive_check.specialist_validation.accepted",
      modality: input.modality,
      extraMetadata: {
        specialistId: PREVENTIVE_HEALTH_SPECIALIST_ID,
        specialistRequestId: input.specialistRequestId,
        specialistValidationOutcome: input.specialistValidationOutcome,
      },
    }),
  ];
  const rejectedEvents = [
    flowEvent({
      eventType: "FLOW_FAILED",
      eventId: eventId("event.health.preventive_check.specialist_rejected", input.flow),
      occurredAt: input.occurredAt,
      userId: input.userId,
      ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      sessionId: input.sessionId,
      correlationId,
      channel: input.channel,
      triggerSource: "user",
      flow: input.flow,
      observabilityKind: "specialist_validation",
      reasonCode: "health.preventive_check.specialist_validation.rejected",
      modality: input.modality,
      extraMetadata: {
        specialistId: PREVENTIVE_HEALTH_SPECIALIST_ID,
        specialistRequestId: input.specialistRequestId,
        specialistValidationOutcome: input.specialistValidationOutcome,
      },
    }),
  ];

  const events = input.specialistValidationOutcome === "accepted"
    ? acceptedEvents
    : rejectedEvents;

  for (const event of events) {
    await input.store.writeInteractionEvent(event).catch(() => ({
      outcome: "rejected" as const,
      reason: "persistence_unavailable" as const,
    }));
  }
  if (input.specialistValidationOutcome === "accepted") {
    await input.store.writeFlowProjection(input.flow.finalState, {
      eventId: events[2].eventId,
      reason: "health.preventive_check.completed",
    }).catch(() => ({
      outcome: "rejected" as const,
      reason: "persistence_unavailable" as const,
    }));
  }
}

function channelFor(modality: AnswerSubmissionModality): string {
  if (modality === "voice") return "voice";
  if (modality === "text") return "text";
  return "pwa";
}

export async function startPreventiveHealthFlowForEntry(input: {
  userId: string;
  profileId?: string;
  sessionId: string;
  triggerReference: string;
  env: OrchestratorEnvironmentMap;
  now: Date;
  eventStore?: EventStateCompatibilityStore;
}): Promise<PreventiveHealthFlowEntryStartOutcome> {
  let flagResolution: PreventiveHealthFlowModeResolution;
  try {
    flagResolution = resolvePreventiveHealthFlowMode({
      env: input.env,
      now: input.now,
      userId: input.userId,
      cohortKey: input.userId,
    });
  } catch {
    return { outcome: "rejected", reasonCode: "preventive_health_flow_disabled" };
  }
  if (flagResolution.effectiveMode !== "authoritative") {
    return {
      outcome: "rejected",
      reasonCode: "preventive_health_flow_disabled",
      flagResolution,
    };
  }

  const flow = startPreventiveHealthFlowEntry({
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    occurredAt: input.now.toISOString(),
    triggerReference: input.triggerReference,
  });
  if (!flow.ok) {
    return {
      outcome: "rejected",
      reasonCode: flow.reasonCode === "contract_invalid"
        ? "preventive_health_flow_contract_invalid"
        : "preventive_health_flow_runtime_failed",
      flagResolution,
    };
  }

  const store = input.eventStore ?? defaultEventStateCompatibilityStore;
  const projection = await store.writeFlowProjection(flow.result.finalState, {
    eventId: flow.result.transitions[flow.result.transitions.length - 1]?.eventId
      ?? flow.result.entryReference,
    reason: "health.preventive_check.entry.awaiting_first_answer",
  }).catch(() => ({
    outcome: "rejected" as const,
    reason: "persistence_unavailable" as const,
  }));
  if (projection.outcome !== "stored" && projection.outcome !== "duplicate") {
    return {
      outcome: "rejected",
      reasonCode: "preventive_health_flow_persistence_failed",
      flagResolution,
    };
  }
  return {
    outcome: projection.outcome === "stored" ? "started" : "restored",
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    sessionId: input.sessionId,
    evidenceReference: flow.result.entryReference,
    result: flow.result,
    flagResolution,
  };
}

export async function attemptPreventiveHealthCheckin<
  TProfile,
  TResult extends PreventiveHealthResult,
>(input: {
  accountUserId: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  profile: TProfile;
  answers: unknown;
  language: string;
  durationSeconds: number | null;
  env: OrchestratorEnvironmentMap;
  now: Date;
  modality?: AnswerSubmissionModality;
  locale?: string;
  timezone?: string;
  dependencies: PreventiveHealthDependencies<TProfile, TResult>;
}): Promise<PreventiveHealthAttemptOutcome<TResult>> {
  const modality = input.modality ?? "touch";
  const occurredAt = input.now.toISOString();
  let flagResolution: PreventiveHealthFlowModeResolution;
  try {
    flagResolution = resolvePreventiveHealthFlowMode({
      env: input.env,
      now: input.now,
      userId: input.userId,
      cohortKey: input.userId,
    });
  } catch {
    return legacy("preventive_health_flow_disabled");
  }
  if (flagResolution.effectiveMode !== "authoritative") {
    return legacy("preventive_health_flow_disabled", flagResolution);
  }

  const safetyInput = input.answers && typeof input.answers === "object"
    ? input.answers as Partial<PreventiveHealthAnswers>
    : {};
  const safety = evaluatePreventiveCheckinSafety({
    body_areas: Array.isArray(safetyInput.body_areas) ? safetyInput.body_areas : [],
    symptoms: Array.isArray(safetyInput.symptoms) ? safetyInput.symptoms : [],
    symptom_details: Array.isArray(safetyInput.symptom_details) ? safetyInput.symptom_details : [],
    safety_flags: Array.isArray(safetyInput.safety_flags) ? safetyInput.safety_flags : [],
  });
  if (safety.safetySignal) {
    return {
      outcome: "blocked",
      reasonCode: "preventive_health_flow_safety_preempted",
      statusCode: 200,
      meta: nonCompletionMeta(
        "preventive_health_flow_safety_preempted",
        "not_started",
      ),
      flagResolution,
    };
  }

  const flow = runPreventiveHealthFlowFromAnswers({
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    occurredAt,
    answers: input.answers,
    modality,
  });
  if (!flow.ok) {
    return legacy(
      flow.reasonCode === "contract_invalid"
        ? "preventive_health_flow_contract_invalid"
        : "preventive_health_flow_validation_failed",
      flagResolution,
    );
  }

  const specialistRequestId = eventId("request.health.preventive_check", flow.result);
  const flowIdentity: PreventiveHealthPersistenceIdentity = {
    completionReference: flow.result.completionReference,
    answerDigest: flow.result.answerDigest,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.sessionId,
  };
  const specialistRequest = createPreventiveHealthSpecialistRequest({
    requestId: specialistRequestId,
    correlationId: `corr.health.preventive_check.${flow.result.answerDigest.slice("sha256:".length, "sha256:".length + 32)}`,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    flowInstanceId: input.sessionId,
    currentState: "active",
    inputModality: modality,
    locale: input.locale ?? input.language,
    timezone: input.timezone ?? "Europe/Madrid",
    requestedAt: occurredAt,
    completionReference: flow.result.completionReference,
    answerDigest: flow.result.answerDigest,
    normalizedAnswersByQuestion: flow.result.normalizedAnswersByQuestion,
    safetyFlags: [],
  });
  const specialistResponse = (
    input.dependencies.proposeSpecialistCompletion ?? proposePreventiveHealthCompletion
  )({
    request: specialistRequest,
    completionReference: flow.result.completionReference,
    answerDigest: flow.result.answerDigest,
  });
  const specialistValidation = validatePreventiveHealthSpecialistProposal(
    specialistRequest,
    specialistResponse,
  );
  if (!specialistValidation.ok) {
    const store = input.dependencies.eventStore ?? defaultEventStateCompatibilityStore;
    await emitPreventiveHealthObservability({
      store,
      userId: input.userId,
      profileId: input.profileId,
      sessionId: input.sessionId,
      occurredAt,
      channel: channelFor(modality),
      modality,
      flow: flow.result,
      specialistRequestId,
      specialistValidationOutcome: "rejected",
    }).catch(() => {});
    return {
      outcome: "blocked",
      reasonCode: "preventive_health_flow_specialist_rejected",
      statusCode: 409,
      meta: nonCompletionMeta(
        "preventive_health_flow_specialist_rejected",
        "not_started",
      ),
      flagResolution,
    };
  }

  let claim: PreventiveHealthCompletionClaim<TResult>;
  try {
    claim = await input.dependencies.acquireCompletionClaim(
      input.userId,
      input.language,
      flow.result.normalizedAnswers,
      input.durationSeconds,
      flowIdentity,
      input.now,
    );
  } catch {
    return legacy("preventive_health_flow_persistence_failed", flagResolution);
  }
  if (claim.state === "completed") {
    return completed(claim.completion, flow.result, flagResolution, "existing");
  }
  if (claim.state === "pending") {
    const completedAfterPending = await input.dependencies.loadCompletedSession(
      input.userId,
      flowIdentity,
    ).catch(() => undefined);
    if (completedAfterPending) {
      return completed(completedAfterPending, flow.result, flagResolution, "existing");
    }
    return {
      outcome: "pending",
      reasonCode: "preventive_health_flow_completion_pending",
      retryAfterSeconds: claim.retryAfterSeconds,
      meta: nonCompletionMeta(
        "preventive_health_flow_completion_pending",
        "pending",
        claim.retryAfterSeconds,
      ),
      flagResolution,
    };
  }

  let result: TResult;
  try {
    result = await input.dependencies.generateResult(
      input.profile,
      flow.result.normalizedAnswers,
      input.language,
    );
  } catch {
    await input.dependencies.markClaimFailed(
      input.userId,
      flowIdentity,
      claim.claimToken,
      "preventive_health_flow_generation_failed",
      input.now,
    ).catch(() => {});
    return {
      outcome: "retryable",
      reasonCode: "preventive_health_flow_generation_failed",
      retryAfterSeconds: 2,
      meta: nonCompletionMeta(
        "preventive_health_flow_generation_failed",
        "retryable",
        2,
      ),
      flagResolution,
    };
  }

  let savedCompletion: PreventiveHealthPersistedCompletion<TResult> | undefined;
  try {
    savedCompletion = await input.dependencies.completeClaim(
      input.userId,
      input.language,
      flow.result.normalizedAnswers,
      result,
      input.durationSeconds,
      flowIdentity,
      claim.claimToken,
      input.now,
    );
  } catch {
    await input.dependencies.markClaimFailed(
      input.userId,
      flowIdentity,
      claim.claimToken,
      "preventive_health_flow_persistence_failed",
      input.now,
    ).catch(() => {});
    return {
      outcome: "retryable",
      reasonCode: "preventive_health_flow_persistence_failed",
      retryAfterSeconds: 2,
      meta: nonCompletionMeta(
        "preventive_health_flow_persistence_failed",
        "retryable",
        2,
      ),
      flagResolution,
    };
  }
  if (!savedCompletion) {
    await input.dependencies.markClaimFailed(
      input.userId,
      flowIdentity,
      claim.claimToken,
      "preventive_health_flow_persistence_failed",
      input.now,
    ).catch(() => {});
    return {
      outcome: "retryable",
      reasonCode: "preventive_health_flow_persistence_failed",
      retryAfterSeconds: 2,
      meta: nonCompletionMeta(
        "preventive_health_flow_persistence_failed",
        "retryable",
        2,
      ),
      flagResolution,
    };
  }
  if (!savedCompletion.inserted) {
    return completed(savedCompletion, flow.result, flagResolution, "existing");
  }

  await input.dependencies.updateTrend(
    input.userId,
    flow.result.normalizedAnswers,
    savedCompletion.result,
  ).catch(() => {});
  await input.dependencies.markDailyCheckinCompleted(
    input.userId,
    input.now,
    { resolveAlerts: true },
  ).catch(() => {});

  const store = input.dependencies.eventStore ?? defaultEventStateCompatibilityStore;
  await emitPreventiveHealthObservability({
    store,
    userId: input.userId,
    profileId: input.profileId,
    sessionId: input.sessionId,
    occurredAt,
    channel: channelFor(modality),
    modality,
    flow: flow.result,
    specialistRequestId,
    specialistValidationOutcome: "accepted",
  }).catch(() => {});

  await input.dependencies.proposeMemoryWrite?.({
    accountUserId: input.accountUserId,
    userId: input.userId,
    profileId: input.profileId,
    sessionId: input.sessionId,
    profile: input.profile,
    result: savedCompletion.result,
    completionReference: flow.result.completionReference,
    answerDigest: flow.result.answerDigest,
    flowInstanceId: input.sessionId,
    completedAt: input.now,
    env: input.env,
  }).catch(() => {});

  if (savedCompletion.result.flag_caregiver === true) {
    await input.dependencies.proposeCaregiverOperatorEscalation?.({
      accountUserId: input.accountUserId,
      userId: input.userId,
      profileId: input.profileId,
      sessionId: input.sessionId,
      profile: input.profile,
      result: savedCompletion.result,
      completionReference: flow.result.completionReference,
      answerDigest: flow.result.answerDigest,
      flowInstanceId: input.sessionId,
      sourceEventId: eventId("event.health.preventive_check.completed", flow.result),
      completedAt: input.now,
      env: input.env,
    }).catch(() => {});
  }

  return {
    ...completed(savedCompletion, flow.result, flagResolution, "created"),
  };
}
