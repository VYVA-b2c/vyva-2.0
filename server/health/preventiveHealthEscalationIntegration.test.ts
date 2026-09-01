import { describe, expect, it, vi } from "vitest";
import type {
  PreventiveHealthCompletionClaim,
  PreventiveHealthPersistedCompletion,
  PreventiveHealthPersistenceIdentity,
  PreventiveHealthResult,
} from "./preventiveHealthOrchestrator.js";
import { attemptPreventiveHealthCheckin } from "./preventiveHealthOrchestrator.js";
import type { PreventiveHealthAnswers } from "./preventiveHealthFlow.js";

const NOW = new Date("2026-08-08T11:00:00.000Z");
const USER_ID = "user-task14";
const SESSION_ID = "session-task14";

const answers: PreventiveHealthAnswers = {
  energy_level: 3,
  mood: "tranquila",
  body_areas: ["ninguno"],
  sleep_quality: "regular",
  symptoms: ["cansancio"],
  symptom_details: ["mild"],
  safety_flags: ["mild_stable"],
  social_contact: "algo",
};

const flaggedResult: PreventiveHealthResult = {
  feeling_label: "Needs a gentle follow-up",
  overall_state: "moderate",
  vyva_reading: "A preventive reading is ready.",
  why_today: "Stable but worth a check-in.",
  trend_note: null,
  personal_plan: "Keep today simple.",
  app_suggestion: null,
  suggested_app_action: null,
  right_now: ["Hydrate"],
  today_actions: ["Rest"],
  highlight: "A care-team check may help.",
  flag_caregiver: true,
  watch_for: null,
};

function task14FlowEnv() {
  return {
    VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
    VYVA_HEALTH_PREVENTIVE_FLOW_DENY_USERS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ROLLOUT_BPS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_PRODUCTION: "false",
    NODE_ENV: "staging",
  };
}

function dependencies(result: PreventiveHealthResult = flaggedResult) {
  const completions = new Map<string, PreventiveHealthPersistedCompletion<PreventiveHealthResult>>();
  const pending = new Map<string, string>();
  const keyFor = (userId: string, identity: PreventiveHealthPersistenceIdentity) =>
    [
      userId,
      identity.flowId,
      identity.flowVersion,
      identity.flowInstanceId,
      identity.completionReference,
    ].join("|");
  let count = 0;
  const acquireCompletionClaim = vi.fn(async (
    userId: string,
    _language: string,
    _answers: PreventiveHealthAnswers,
    _durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    now: Date,
  ): Promise<PreventiveHealthCompletionClaim<PreventiveHealthResult>> => {
    const key = keyFor(userId, identity);
    const completed = completions.get(key);
    if (completed) return { state: "completed", completion: { ...completed, inserted: false } };
    const token = `claim-${++count}`;
    pending.set(key, token);
    return {
      state: "claimed",
      sessionId: `checkin-session-${count}`,
      claimToken: token,
      claimExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
    };
  });
  const completeClaim = vi.fn(async (
    userId: string,
    _language: string,
    _answers: PreventiveHealthAnswers,
    savedResult: PreventiveHealthResult,
    _durationSeconds: number | null,
    identity: PreventiveHealthPersistenceIdentity,
    claimToken: string,
  ) => {
    const key = keyFor(userId, identity);
    const completed = completions.get(key);
    if (completed) return { ...completed, inserted: false };
    if (pending.get(key) !== claimToken) return undefined;
    const persisted = {
      sessionId: `checkin-session-${count}`,
      result: savedResult,
      inserted: true,
    };
    completions.set(key, persisted);
    return persisted;
  });
  return {
    generateResult: vi.fn(async () => result),
    acquireCompletionClaim,
    completeClaim,
    markClaimFailed: vi.fn(async () => {}),
    loadCompletedSession: vi.fn(async (
      userId: string,
      identity: PreventiveHealthPersistenceIdentity,
    ) => {
      const completed = completions.get(keyFor(userId, identity));
      return completed ? { ...completed, inserted: false } : undefined;
    }),
    updateTrend: vi.fn(async () => {}),
    markDailyCheckinCompleted: vi.fn(async () => {}),
    proposeMemoryWrite: vi.fn(async () => {}),
    proposeCaregiverOperatorEscalation: vi.fn(async () => {}),
  };
}

describe("Task 14 preventive Health caregiver/operator escalation integration", () => {
  it("runs the escalation hook only after a new flagged authoritative completion", async () => {
    const deps = dependencies();
    const first = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers,
      language: "es",
      durationSeconds: 20,
      env: task14FlowEnv(),
      now: NOW,
      dependencies: deps,
    });
    const second = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers,
      language: "es",
      durationSeconds: 20,
      env: task14FlowEnv(),
      now: new Date(NOW.getTime() + 1_000),
      dependencies: deps,
    });

    expect(first).toMatchObject({ outcome: "completed", meta: { persistence_status: "created" } });
    expect(second).toMatchObject({ outcome: "completed", meta: { persistence_status: "existing" } });
    expect(deps.proposeCaregiverOperatorEscalation).toHaveBeenCalledTimes(1);
    expect(deps.proposeCaregiverOperatorEscalation).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      result: flaggedResult,
      flowInstanceId: SESSION_ID,
      sourceEventId: expect.stringMatching(/^event\.health\.preventive_check\.completed\./),
      completedAt: NOW,
      env: task14FlowEnv(),
    }));
  });

  it("does not run the escalation hook when the result is not caregiver flagged", async () => {
    const deps = dependencies({ ...flaggedResult, flag_caregiver: false });
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers,
      language: "es",
      durationSeconds: 20,
      env: task14FlowEnv(),
      now: NOW,
      dependencies: deps,
    });

    expect(result).toMatchObject({ outcome: "completed", meta: { persistence_status: "created" } });
    expect(deps.proposeCaregiverOperatorEscalation).not.toHaveBeenCalled();
  });

  it("keeps completed Health persistence authoritative when the escalation hook fails", async () => {
    const deps = dependencies();
    deps.proposeCaregiverOperatorEscalation.mockRejectedValueOnce(new Error("projection unavailable"));
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers,
      language: "es",
      durationSeconds: 20,
      env: task14FlowEnv(),
      now: NOW,
      dependencies: deps,
    });

    expect(result).toMatchObject({ outcome: "completed", meta: { persistence_status: "created" } });
    expect(deps.updateTrend).toHaveBeenCalledTimes(1);
    expect(deps.markDailyCheckinCompleted).toHaveBeenCalledTimes(1);
    expect(deps.proposeCaregiverOperatorEscalation).toHaveBeenCalledTimes(1);
  });

  it("does not run escalation work when safety preempts ordinary completion", async () => {
    const deps = dependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: {
        ...answers,
        symptoms: ["falta_aire"],
        safety_flags: [],
      },
      language: "es",
      durationSeconds: 20,
      env: task14FlowEnv(),
      now: NOW,
      dependencies: deps,
    });

    expect(result).toMatchObject({
      outcome: "blocked",
      reasonCode: "preventive_health_flow_safety_preempted",
    });
    expect(deps.generateResult).not.toHaveBeenCalled();
    expect(deps.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(deps.proposeCaregiverOperatorEscalation).not.toHaveBeenCalled();
  });
});
