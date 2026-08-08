import { describe, expect, it, vi } from "vitest";
import type {
  PreventiveHealthCompletionClaim,
  PreventiveHealthPersistedCompletion,
  PreventiveHealthPersistenceIdentity,
  PreventiveHealthResult,
} from "./preventiveHealthOrchestrator.js";
import { attemptPreventiveHealthCheckin } from "./preventiveHealthOrchestrator.js";
import type { PreventiveHealthAnswers } from "./preventiveHealthFlow.js";

const NOW = new Date("2026-08-08T09:30:00.000Z");
const USER_ID = "user-task13";
const SESSION_ID = "session-task13";

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

function task13FlowEnv() {
  return {
    VYVA_HEALTH_PREVENTIVE_FLOW_MODE: "authoritative",
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS: USER_ID,
    VYVA_HEALTH_PREVENTIVE_FLOW_DENY_USERS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ROLLOUT_BPS: undefined,
    VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_PRODUCTION: "false",
    NODE_ENV: "staging",
  };
}

function dependencies() {
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
    result: PreventiveHealthResult,
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
      result,
      inserted: true,
    };
    completions.set(key, persisted);
    return persisted;
  });
  return {
    generateResult: vi.fn(async () => baseResult),
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
  };
}

describe("Task 13 preventive Health memory integration", () => {
  it("runs the memory proposal hook only after a newly persisted authoritative completion", async () => {
    const deps = dependencies();
    const first = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: task13FlowEnv(),
      now: NOW,
      dependencies: deps,
    });
    const second = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: task13FlowEnv(),
      now: new Date(NOW.getTime() + 1_000),
      dependencies: deps,
    });

    expect(first).toMatchObject({ outcome: "completed", meta: { persistence_status: "created" } });
    expect(second).toMatchObject({ outcome: "completed", meta: { persistence_status: "existing" } });
    expect(deps.proposeMemoryWrite).toHaveBeenCalledTimes(1);
    expect(deps.proposeMemoryWrite).toHaveBeenCalledWith(expect.objectContaining({
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      result: baseResult,
      flowInstanceId: SESSION_ID,
      completedAt: NOW,
      env: task13FlowEnv(),
    }));
  });

  it("keeps completed persistence authoritative when the memory hook fails", async () => {
    const deps = dependencies();
    deps.proposeMemoryWrite.mockRejectedValueOnce(new Error("outbox unavailable"));
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: baseAnswers,
      language: "es",
      durationSeconds: 20,
      env: task13FlowEnv(),
      now: NOW,
      dependencies: deps,
    });

    expect(result).toMatchObject({ outcome: "completed", meta: { persistence_status: "created" } });
    expect(deps.updateTrend).toHaveBeenCalledTimes(1);
    expect(deps.markDailyCheckinCompleted).toHaveBeenCalledTimes(1);
    expect(deps.proposeMemoryWrite).toHaveBeenCalledTimes(1);
  });

  it("does not run memory proposal work when safety preempts ordinary completion", async () => {
    const deps = dependencies();
    const result = await attemptPreventiveHealthCheckin({
      accountUserId: USER_ID,
      userId: USER_ID,
      profileId: USER_ID,
      sessionId: SESSION_ID,
      profile: { name: "Test" },
      answers: {
        ...baseAnswers,
        symptoms: ["falta_aire"],
        safety_flags: [],
      },
      language: "es",
      durationSeconds: 20,
      env: task13FlowEnv(),
      now: NOW,
      dependencies: deps,
    });

    expect(result).toMatchObject({
      outcome: "blocked",
      reasonCode: "preventive_health_flow_safety_preempted",
    });
    expect(deps.generateResult).not.toHaveBeenCalled();
    expect(deps.acquireCompletionClaim).not.toHaveBeenCalled();
    expect(deps.proposeMemoryWrite).not.toHaveBeenCalled();
  });
});
