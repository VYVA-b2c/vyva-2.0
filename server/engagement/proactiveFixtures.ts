import type {
  ProactiveEngagementEvaluationInput,
  ProactivePurposeId,
} from "../../shared/engagement/proactiveEngagement.js";

export function cloneFixture<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function baseProactiveEvaluationInput(
  overrides: Partial<ProactiveEngagementEvaluationInput> = {},
): ProactiveEngagementEvaluationInput {
  const purposeId: ProactivePurposeId = overrides.purposeId ?? "daily_wellbeing_check";
  const base: ProactiveEngagementEvaluationInput = {
    schemaVersion: "1.0.0",
    evaluationId: "eval.daily.20260803.1200",
    policyVersion: "1.0.0",
    scheduleOccurrenceId: "occurrence.daily.20260803.1200",
    scheduleId: "schedule.daily.checkin",
    purposeId,
    dueAt: "2026-08-03T11:55:00.000Z",
    evaluatedAt: "2026-08-03T12:00:00.000Z",
    timezone: "Europe/Madrid",
    locale: "en-US",
    userRef: "user.test.elder",
    profileRef: "profile.test.elder",
    sessionRef: "session.test",
    source: "scheduled_interaction",
    consentFacts: [
      {
        consentId: "consent.purpose.grant",
        purposeId,
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
      {
        consentId: "consent.whatsapp.grant",
        purposeId,
        channel: "whatsapp",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
      {
        consentId: "consent.email.grant",
        purposeId,
        channel: "email",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
      {
        consentId: "consent.voice.grant",
        purposeId,
        channel: "voice_call",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
    ],
    channelPreferences: {
      preferredChannel: "whatsapp",
      fallbackChain: ["email", "sms", "voice_call"],
      fallbackPermissions: [],
    },
    channelCandidates: [
      {
        channel: "whatsapp",
        preferenceRank: 0,
        availability: "available",
        purposeId,
      },
      {
        channel: "email",
        preferenceRank: 1,
        availability: "available",
        purposeId,
      },
      {
        channel: "sms",
        preferenceRank: 2,
        availability: "available",
        purposeId,
      },
      {
        channel: "voice_call",
        preferenceRank: 3,
        availability: "available",
        purposeId,
      },
    ],
    quietHours: {
      mode: "window",
      startLocalTime: "21:00",
      endLocalTime: "08:00",
    },
    recentAttempts: [],
    limitPolicy: {
      enforcement: "required",
      maxAttemptsPerLocalDay: 3,
      rollingWindowMinutes: 60,
      maxAttemptsPerRollingWindow: 3,
      minCooldownMinutes: 5,
      maxConsecutiveFailures: 3,
      maxRecentNoAnswers: 3,
      maxRecentDismissals: 3,
      channelLimits: [
        { channel: "whatsapp", maxAttemptsPerLocalDay: 3 },
        { channel: "email", maxAttemptsPerLocalDay: 3 },
        { channel: "voice_call", maxAttemptsPerLocalDay: 1 },
      ],
    },
    existingAuditStates: [],
    nonExecutable: true,
  };
  return {
    ...cloneFixture(base),
    ...overrides,
  };
}
