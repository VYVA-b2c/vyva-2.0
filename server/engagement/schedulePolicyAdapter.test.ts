import { describe, expect, it } from "vitest";
import { scheduledInteractionSnapshotToEvaluationInput } from "./schedulePolicyAdapter.js";
import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";

function snapshot() {
  const input = baseProactiveEvaluationInput();
  return {
    evaluationId: input.evaluationId,
    scheduleOccurrenceId: input.scheduleOccurrenceId,
    evaluatedAt: input.evaluatedAt,
    schedule: {
      id: input.scheduleId,
      userId: input.userRef,
      profileId: input.profileRef,
      sessionId: input.sessionRef,
      interactionType: "CHECK_IN",
      nextRunAt: input.dueAt,
      timezone: input.timezone,
      preferredLanguage: input.locale,
      quietHoursStart: "21:00",
      quietHoursEnd: "08:00",
      consentRequired: true,
      consentStatus: "granted",
    },
    consentFacts: input.consentFacts,
    channelPreferences: input.channelPreferences,
    channelCandidates: input.channelCandidates,
    recentAttempts: input.recentAttempts,
    limitPolicy: input.limitPolicy,
    existingAuditStates: input.existingAuditStates,
  };
}

describe("Task 8 scheduled-interaction policy adapter", () => {
  it("normalizes a minimized scheduled-interaction snapshot into an evaluation input", () => {
    const result = scheduledInteractionSnapshotToEvaluationInput(snapshot());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.source).toBe("scheduled_interaction");
    expect(result.input.purposeId).toBe("daily_wellbeing_check");
    expect(result.input.quietHours).toEqual({
      mode: "window",
      startLocalTime: "21:00",
      endLocalTime: "08:00",
    });
    expect(result.input.nonExecutable).toBe(true);
  });

  it("maps supported schedule types without inventing delivery authority", () => {
    const expected = {
      BRAIN_COACH: "brain_coach",
      CHECK_IN: "daily_wellbeing_check",
      CONCIERGE_FOLLOWUP: "concierge_followup",
      MEDICATION: "medication_reminder",
      SYMPTOM_FOLLOWUP: "post_symptom_followup",
    };
    for (const [interactionType, purposeId] of Object.entries(expected)) {
      const result = scheduledInteractionSnapshotToEvaluationInput({
        ...snapshot(),
        schedule: { ...snapshot().schedule, interactionType },
      });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.input.purposeId).toBe(purposeId);
    }
  });

  it("represents equal quiet-hour boundaries only as explicit full-day policy", () => {
    const result = scheduledInteractionSnapshotToEvaluationInput({
      ...snapshot(),
      schedule: { ...snapshot().schedule, quietHoursStart: "09:00", quietHoursEnd: "09:00" },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.input.quietHours).toEqual({ mode: "full_day" });
  });

  it("canonicalizes schedule timezone aliases and timestamp offsets", () => {
    const result = scheduledInteractionSnapshotToEvaluationInput({
      ...snapshot(),
      evaluatedAt: "2026-08-03T13:00:00.000+01:00",
      schedule: {
        ...snapshot().schedule,
        nextRunAt: "2026-08-03T12:55:00.000+01:00",
        timezone: "US/Eastern",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.timezone).toBe("America/New_York");
    expect(result.input.evaluatedAt).toBe("2026-08-03T12:00:00.000Z");
    expect(result.input.dueAt).toBe("2026-08-03T11:55:00.000Z");
  });

  it("rejects non-IANA schedule timezones before creating evaluation input", () => {
    for (const timezone of ["Not/A_Zone", "+01:00", "PST"]) {
      expect(scheduledInteractionSnapshotToEvaluationInput({
        ...snapshot(),
        schedule: { ...snapshot().schedule, timezone },
      })).toEqual({ ok: false, error: "invalid_input" });
    }
  });

  it("rejects unknown fields, invalid schedule types and accessor input safely", () => {
    expect(scheduledInteractionSnapshotToEvaluationInput({
      ...snapshot(),
      messageBody: "do not allow",
    })).toEqual({ ok: false, error: "invalid_input" });
    expect(scheduledInteractionSnapshotToEvaluationInput({
      ...snapshot(),
      schedule: { ...snapshot().schedule, interactionType: "FUTURE_TYPE" },
    })).toEqual({ ok: false, error: "invalid_input" });

    let getterCalls = 0;
    const unsafe = snapshot() as Record<string, unknown>;
    Object.defineProperty(unsafe, "evaluationId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "eval.unsafe";
      },
    });
    expect(scheduledInteractionSnapshotToEvaluationInput(unsafe)).toEqual({ ok: false, error: "invalid_input" });
    expect(getterCalls).toBe(0);
  });
});
