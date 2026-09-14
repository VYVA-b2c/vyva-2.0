import { describe, expect, it } from "vitest";
import {
  evaluateProactiveEngagementPolicy,
  evaluateParsedProactiveEngagementPolicy,
} from "./proactivePolicy.js";
import {
  baseProactiveEvaluationInput,
  cloneFixture,
} from "./proactiveFixtures.js";
import { proactiveEngagementIdempotencyKey } from "../../shared/engagement/proactiveEngagement.js";

function expectReason(input: ReturnType<typeof baseProactiveEvaluationInput>, reason: string): void {
  const result = evaluateProactiveEngagementPolicy(input);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.decision.reasonCodes).toContain(reason);
}

function expectAllowed(input: ReturnType<typeof baseProactiveEvaluationInput>) {
  const result = evaluateProactiveEngagementPolicy(input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected fixture to evaluate");
  expect(result.decision.decision).toBe("allow");
  return result;
}

describe("Task 8 proactive policy evaluator", () => {
  it("allows a due occurrence on the preferred consented channel", () => {
    const result = evaluateProactiveEngagementPolicy(baseProactiveEvaluationInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.decision).toBe("allow");
    expect(result.decision.proposedChannel).toBe("whatsapp");
    expect(result.decision.reasonCodes).toContain("eligible_preferred_channel");
    expect(result.decision.reasonCodes).toContain("occurrence_not_previously_evaluated");
  });

  it("rejects caller-owned accessors and sparse arrays without invoking getters", () => {
    let getterCalls = 0;
    const withAccessor = baseProactiveEvaluationInput() as Record<string, unknown>;
    Object.defineProperty(withAccessor, "evaluationId", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "eval.unsafe";
      },
    });
    expect(evaluateProactiveEngagementPolicy(withAccessor)).toEqual({ ok: false, error: "invalid_input" });
    expect(getterCalls).toBe(0);

    const sparse = baseProactiveEvaluationInput();
    sparse.channelCandidates = Array(1) as never;
    expect(evaluateProactiveEngagementPolicy(sparse)).toEqual({ ok: false, error: "invalid_input" });
  });

  it("blocks schedules that are not due and duplicate occurrences", () => {
    const notDue = baseProactiveEvaluationInput({
      dueAt: "2026-08-03T12:30:00.000Z",
    });
    expectReason(notDue, "schedule_not_due");

    const duplicate = baseProactiveEvaluationInput();
    duplicate.existingAuditStates = [{
      policyVersion: "1.0.0",
      scheduleOccurrenceId: duplicate.scheduleOccurrenceId,
      purposeId: duplicate.purposeId,
      idempotencyKey: proactiveEngagementIdempotencyKey({
        policyVersion: "1.0.0",
        scheduleOccurrenceId: duplicate.scheduleOccurrenceId,
        purposeId: duplicate.purposeId,
      }),
      semanticDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      decision: "allow",
    }];
    const duplicateResult = evaluateProactiveEngagementPolicy(duplicate);
    expect(duplicateResult.ok).toBe(true);
    if (!duplicateResult.ok) return;
    expect(duplicateResult.decision.reasonCodes).toContain("duplicate_occurrence");
    expect(duplicateResult.decision.duplicateStatus).toBe("duplicate_same_digest");
  });

  it("enforces consent precedence, revocation, expiry and subject scope", () => {
    const revoked = baseProactiveEvaluationInput();
    revoked.consentFacts.push({
      consentId: "consent.revoked.latest",
      purposeId: revoked.purposeId,
      subject: "user",
      state: "revoked",
      effectiveAt: "2026-08-03T11:59:00.000Z",
      recordedAt: "2026-08-03T11:59:00.000Z",
      revision: 2,
    });
    expectReason(revoked, "consent_revoked");

    const grantAfterOlderRevocation = baseProactiveEvaluationInput();
    grantAfterOlderRevocation.consentFacts.unshift({
      consentId: "consent.revoked.older",
      purposeId: grantAfterOlderRevocation.purposeId,
      subject: "user",
      state: "revoked",
      effectiveAt: "2025-12-31T00:00:00.000Z",
      recordedAt: "2025-12-31T00:00:00.000Z",
      revision: 0,
    });
    const grantResult = evaluateProactiveEngagementPolicy(grantAfterOlderRevocation);
    expect(grantResult.ok).toBe(true);
    if (grantResult.ok) expect(grantResult.decision.decision).toBe("allow");

    const expired = baseProactiveEvaluationInput();
    expired.consentFacts[0] = {
      ...expired.consentFacts[0],
      consentId: "consent.expired",
      expiresAt: "2026-08-03T11:00:00.000Z",
    };
    expectReason(expired, "consent_expired");

    const caregiverOnly = baseProactiveEvaluationInput({ consentFacts: [] });
    caregiverOnly.consentFacts = [{
      consentId: "consent.caregiver.only",
      purposeId: caregiverOnly.purposeId,
      channel: "whatsapp",
      subject: "caregiver",
      state: "granted",
      effectiveAt: "2026-01-01T00:00:00.000Z",
      recordedAt: "2026-01-01T00:00:00.000Z",
      revision: 1,
    }];
    expectReason(caregiverOnly, "consent_missing");
  });

  it("compares consent timestamps as normalized instants instead of lexical strings", () => {
    const offsetEquivalent = baseProactiveEvaluationInput({
      quietHours: { mode: "none" },
    });
    offsetEquivalent.consentFacts = offsetEquivalent.consentFacts.map((fact) => ({
      ...fact,
      effectiveAt: "2026-08-03T13:00:00.000+01:00",
      recordedAt: "2026-08-03T13:00:00.000+01:00",
      revision: fact.revision + 1,
    }));
    const result = evaluateProactiveEngagementPolicy(offsetEquivalent);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.decision).toBe("allow");
    expect(result.decision.proposedChannel).toBe("whatsapp");
  });

  it("canonicalizes timezone aliases before decisions and semantic digests", () => {
    const utc = expectAllowed(baseProactiveEvaluationInput({
      timezone: "UTC",
      quietHours: { mode: "none" },
    }));
    const etcUtc = expectAllowed(baseProactiveEvaluationInput({
      timezone: "Etc/UTC",
      quietHours: { mode: "none" },
    }));
    expect(utc.input.timezone).toBe("UTC");
    expect(etcUtc.input.timezone).toBe("UTC");
    expect(utc.decision.timezone).toBe("UTC");
    expect(etcUtc.decision.timezone).toBe("UTC");
    expect(etcUtc.decision).toEqual(utc.decision);
    expect(etcUtc.decisionDigest).toBe(utc.decisionDigest);

    const canonicalNewYork = expectAllowed(baseProactiveEvaluationInput({
      timezone: "America/New_York",
      quietHours: { mode: "none" },
    }));
    const easternAlias = expectAllowed(baseProactiveEvaluationInput({
      timezone: "US/Eastern",
      quietHours: { mode: "none" },
    }));
    expect(canonicalNewYork.input.timezone).toBe("America/New_York");
    expect(easternAlias.input.timezone).toBe("America/New_York");
    expect(easternAlias.decision).toEqual(canonicalNewYork.decision);
    expect(easternAlias.decisionDigest).toBe(canonicalNewYork.decisionDigest);
  });

  it("canonicalizes equivalent timestamp offsets before decisions and semantic digests", () => {
    const utc = expectAllowed(baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T12:00:00.000Z",
      dueAt: "2026-08-03T11:55:00.000Z",
      quietHours: { mode: "none" },
    }));
    const plusOne = expectAllowed(baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T13:00:00.000+01:00",
      dueAt: "2026-08-03T12:55:00.000+01:00",
      quietHours: { mode: "none" },
    }));
    const minusFive = expectAllowed(baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T07:00:00.000-05:00",
      dueAt: "2026-08-03T06:55:00.000-05:00",
      quietHours: { mode: "none" },
    }));
    expect(plusOne.input.evaluatedAt).toBe("2026-08-03T12:00:00.000Z");
    expect(minusFive.input.evaluatedAt).toBe("2026-08-03T12:00:00.000Z");
    expect(plusOne.decision).toEqual(utc.decision);
    expect(minusFive.decision).toEqual(utc.decision);
    expect(plusOne.decisionDigest).toBe(utc.decisionDigest);
    expect(minusFive.decisionDigest).toBe(utc.decisionDigest);

    const differentInstant = expectAllowed(baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T12:01:00.000Z",
      dueAt: "2026-08-03T11:55:00.000Z",
      quietHours: { mode: "none" },
    }));
    expect(differentInstant.decisionDigest).not.toBe(utc.decisionDigest);
  });

  it("fails closed for same-instant conflicting consent regardless of timestamp spelling", () => {
    const exactStrings = baseProactiveEvaluationInput({
      quietHours: { mode: "none" },
      consentFacts: [
        {
          consentId: "consent.conflict.a",
          purposeId: "daily_wellbeing_check",
          subject: "user",
          state: "granted",
          effectiveAt: "2026-08-03T12:00:00.000Z",
          recordedAt: "2026-08-03T12:00:00.000Z",
          revision: 1,
        },
        {
          consentId: "consent.conflict.b",
          purposeId: "daily_wellbeing_check",
          subject: "user",
          state: "revoked",
          effectiveAt: "2026-08-03T12:00:00.000Z",
          recordedAt: "2026-08-03T12:00:00.000Z",
          revision: 1,
        },
      ],
    });
    const equivalentOffsets = baseProactiveEvaluationInput({
      quietHours: { mode: "none" },
      consentFacts: [
        {
          consentId: "consent.conflict.a",
          purposeId: "daily_wellbeing_check",
          subject: "user",
          state: "granted",
          effectiveAt: "2026-08-03T12:00:00.000Z",
          recordedAt: "2026-08-03T12:00:00.000Z",
          revision: 1,
        },
        {
          consentId: "consent.conflict.b",
          purposeId: "daily_wellbeing_check",
          subject: "user",
          state: "revoked",
          effectiveAt: "2026-08-03T13:00:00.000+01:00",
          recordedAt: "2026-08-03T07:00:00.000-05:00",
          revision: 1,
        },
      ],
    });
    const exactResult = evaluateProactiveEngagementPolicy(exactStrings);
    const offsetResult = evaluateProactiveEngagementPolicy(equivalentOffsets);
    expect(exactResult.ok).toBe(true);
    expect(offsetResult.ok).toBe(true);
    if (!exactResult.ok || !offsetResult.ok) return;
    expect(exactResult.decision.reasonCodes).toEqual(["policy_configuration_invalid"]);
    expect(offsetResult.decision.reasonCodes).toEqual(["policy_configuration_invalid"]);
    expect(offsetResult.decision).toEqual(exactResult.decision);
    expect(offsetResult.decisionDigest).toBe(exactResult.decisionDigest);
  });

  it("requires channel-specific consent and does not let one channel grant authorize a call", () => {
    const input = baseProactiveEvaluationInput();
    input.channelCandidates = input.channelCandidates.filter((candidate) => candidate.channel === "voice_call");
    input.channelPreferences = {
      preferredChannel: "whatsapp",
      fallbackChain: ["voice_call"],
      fallbackPermissions: [{
        permissionId: "permission.whatsapp.to.voice",
        purposeId: input.purposeId,
        fromChannel: "whatsapp",
        toChannel: "voice_call",
        allowed: true,
      }],
    };
    input.consentFacts = input.consentFacts.filter((fact) => fact.channel !== "voice_call");
    const result = evaluateProactiveEngagementPolicy(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decision.decision).toBe("block");
    expect(result.decision.reasonCodes).toContain("no_eligible_channel");
  });

  it("evaluates same-day, cross-midnight, exact boundaries, DST and non-hour timezone quiet hours", () => {
    const insideStart = baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T19:00:00.000Z",
      dueAt: "2026-08-03T18:59:00.000Z",
    });
    expectReason(insideStart, "quiet_hours");

    const exactEnd = baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-04T06:00:00.000Z",
      dueAt: "2026-08-04T05:59:00.000Z",
    });
    const exactEndResult = evaluateProactiveEngagementPolicy(exactEnd);
    expect(exactEndResult.ok).toBe(true);
    if (exactEndResult.ok) expect(exactEndResult.decision.decision).toBe("allow");

    const sameDay = baseProactiveEvaluationInput({
      evaluatedAt: "2026-08-03T12:30:00.000Z",
      dueAt: "2026-08-03T12:29:00.000Z",
      quietHours: { mode: "window", startLocalTime: "14:00", endLocalTime: "15:00" },
    });
    expectReason(sameDay, "quiet_hours");

    const springForwardGap = baseProactiveEvaluationInput({
      evaluatedAt: "2026-03-29T01:30:00.000Z",
      dueAt: "2026-03-29T01:00:00.000Z",
      quietHours: { mode: "window", startLocalTime: "02:00", endLocalTime: "03:00" },
    });
    const springForwardResult = evaluateProactiveEngagementPolicy(springForwardGap);
    expect(springForwardResult.ok).toBe(true);
    if (springForwardResult.ok) expect(springForwardResult.decision.decision).toBe("allow");

    const fallBackFold = baseProactiveEvaluationInput({
      evaluatedAt: "2026-10-25T01:30:00.000Z",
      dueAt: "2026-10-25T01:00:00.000Z",
      quietHours: { mode: "window", startLocalTime: "02:00", endLocalTime: "03:00" },
    });
    expectReason(fallBackFold, "quiet_hours");

    const halfHour = baseProactiveEvaluationInput({
      timezone: "Asia/Kolkata",
      evaluatedAt: "2026-08-03T18:31:00.000Z",
      dueAt: "2026-08-03T18:30:00.000Z",
      quietHours: { mode: "window", startLocalTime: "23:00", endLocalTime: "06:00" },
    });
    expectReason(halfHour, "quiet_hours");

    const quarterHour = baseProactiveEvaluationInput({
      timezone: "Asia/Kathmandu",
      evaluatedAt: "2026-08-03T18:30:00.000Z",
      dueAt: "2026-08-03T18:29:00.000Z",
      quietHours: { mode: "window", startLocalTime: "00:00", endLocalTime: "01:00" },
    });
    expectReason(quarterHour, "quiet_hours");

    const invalidTimezone = baseProactiveEvaluationInput({ timezone: "Madrid/local/server" });
    expect(evaluateProactiveEngagementPolicy(invalidTimezone)).toEqual({ ok: false, error: "invalid_input" });
  });

  it("enforces daily, rolling, cooldown and fatigue limits without mutating counters", () => {
    const attempts = [
      "2026-08-03T11:00:00.000Z",
      "2026-08-03T11:30:00.000Z",
      "2026-08-03T11:55:00.000Z",
    ].map((attemptedAt, index) => ({
      attemptId: `attempt.daily.${index}`,
      purposeId: "daily_wellbeing_check" as const,
      channel: "whatsapp" as const,
      outcome: "delivered" as const,
      attemptedAt,
    }));
    const atDailyLimit = baseProactiveEvaluationInput({ recentAttempts: attempts });
    expectReason(atDailyLimit, "frequency_limit_reached");

    const cooldown = baseProactiveEvaluationInput({
      recentAttempts: [{
        attemptId: "attempt.cooldown",
        purposeId: "daily_wellbeing_check",
        channel: "whatsapp",
        outcome: "delivered",
        attemptedAt: "2026-08-03T11:56:00.000Z",
      }],
    });
    expectReason(cooldown, "cooldown_active");

    const cooldownExpired = baseProactiveEvaluationInput({
      recentAttempts: [{
        attemptId: "attempt.cooldown.expired",
        purposeId: "daily_wellbeing_check",
        channel: "whatsapp",
        outcome: "delivered",
        attemptedAt: "2026-08-03T11:55:00.000Z",
      }],
    });
    const cooldownExpiredResult = evaluateProactiveEngagementPolicy(cooldownExpired);
    expect(cooldownExpiredResult.ok).toBe(true);
    if (cooldownExpiredResult.ok) expect(cooldownExpiredResult.decision.decision).toBe("allow");

    const fatigue = baseProactiveEvaluationInput({
      limitPolicy: {
        enforcement: "required",
        maxAttemptsPerLocalDay: 10,
        rollingWindowMinutes: 60,
        maxAttemptsPerRollingWindow: 10,
        minCooldownMinutes: 0,
        maxConsecutiveFailures: 3,
        maxRecentNoAnswers: 3,
        maxRecentDismissals: 3,
        channelLimits: [],
      },
      recentAttempts: [0, 1, 2].map((index) => ({
        attemptId: `attempt.failed.${index}`,
        purposeId: "daily_wellbeing_check",
        channel: "whatsapp",
        outcome: "failed",
        attemptedAt: `2026-08-03T11:5${index}:00.000Z`,
      })),
    });
    expectReason(fatigue, "fatigue_limit_reached");
  });

  it("uses fallback deterministically without bypassing consent, availability or voice-call opt-in", () => {
    const fallback = baseProactiveEvaluationInput();
    fallback.channelCandidates[0] = { ...fallback.channelCandidates[0], availability: "unavailable" };
    const fallbackResult = evaluateProactiveEngagementPolicy(fallback);
    expect(fallbackResult.ok).toBe(true);
    if (!fallbackResult.ok) return;
    expect(fallbackResult.decision.proposedChannel).toBe("email");
    expect(fallbackResult.decision.reasonCodes).toContain("eligible_fallback_channel");

    const voiceBlocked = baseProactiveEvaluationInput();
    voiceBlocked.channelCandidates = voiceBlocked.channelCandidates
      .filter((candidate) => candidate.channel === "voice_call");
    voiceBlocked.channelPreferences = {
      preferredChannel: "whatsapp",
      fallbackChain: ["voice_call"],
      fallbackPermissions: [],
    };
    expectReason(voiceBlocked, "no_eligible_channel");

    const voiceAllowed = cloneFixture(voiceBlocked);
    voiceAllowed.channelPreferences.fallbackPermissions = [{
      permissionId: "permission.voice.allowed",
      purposeId: voiceAllowed.purposeId,
      fromChannel: "whatsapp",
      toChannel: "voice_call",
      allowed: true,
    }];
    const voiceAllowedResult = evaluateProactiveEngagementPolicy(voiceAllowed);
    expect(voiceAllowedResult.ok).toBe(true);
    if (voiceAllowedResult.ok) expect(voiceAllowedResult.decision.proposedChannel).toBe("voice_call");
  });

  it("produces deterministic decisions and stable digests for object key reordering", () => {
    const input = baseProactiveEvaluationInput();
    const result = evaluateParsedProactiveEngagementPolicy(input);
    const reordered = JSON.parse(JSON.stringify(input, Object.keys(input).reverse()));
    const reorderedResult = evaluateProactiveEngagementPolicy({ ...reordered, ...input });
    expect(result.ok).toBe(true);
    expect(reorderedResult.ok).toBe(true);
    if (!result.ok || !reorderedResult.ok) return;
    expect(result.decision).toEqual(reorderedResult.decision);
    expect(result.decisionDigest).toBe(reorderedResult.decisionDigest);
  });
});
