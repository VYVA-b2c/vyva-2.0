import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";
import { PREVENTIVE_OUTBOUND_CALL_FLAG_ENV } from "./preventiveOutboundCallFeatureFlags.js";
import { PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV } from "./preventiveOutboundCallProvider.js";
import type { ProactiveEngagementEvaluationInput } from "../../shared/engagement/proactiveEngagement.js";

export const validPreventiveOutboundCallPhone = "+15551234567";
export const validPreventiveOutboundCallNow = new Date("2026-08-03T12:00:00.000Z");

export function validPreventiveOutboundCallEnv(
  overrides: Record<string, string | undefined> = {},
) {
  return {
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.mode]: "pilot",
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.allowUsers]: "profile.test.elder",
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.environment]: "test",
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.expiresAt]: "2026-12-31T00:00:00.000Z",
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.owner]: "owner.task11",
    [PREVENTIVE_OUTBOUND_CALL_FLAG_ENV.auditRef]: "audit.task11.freeze",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsApiKey]: "sk_test_task11_abcdefghijklmnopqrstuvwxyz",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsAgentId]: "agent.preventive.task11",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.elevenLabsPhoneNumberId]: "phone.preventive.task11",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.publicWebhookBaseUrl]: "https://vyva.example.com",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAccountSid]: "AC0123456789abcdef0123456789abcdef",
    [PREVENTIVE_OUTBOUND_CALL_PROVIDER_ENV.twilioAuthToken]: "twilioAuthTokenTask11",
    ...overrides,
  };
}

export function basePreventiveOutboundCallEvaluationInput(
  overrides: Partial<ProactiveEngagementEvaluationInput> = {},
): ProactiveEngagementEvaluationInput {
  return baseProactiveEvaluationInput({
    channelPreferences: {
      preferredChannel: "voice_call",
      fallbackChain: [],
      fallbackPermissions: [],
    },
    channelCandidates: [
      {
        channel: "voice_call",
        preferenceRank: 0,
        availability: "available",
        purposeId: "daily_wellbeing_check",
      },
    ],
    consentFacts: [
      {
        consentId: "consent.purpose.voice-call",
        purposeId: "daily_wellbeing_check",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
      {
        consentId: "consent.channel.voice-call",
        purposeId: "daily_wellbeing_check",
        channel: "voice_call",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
    ],
    limitPolicy: {
      enforcement: "required",
      maxAttemptsPerLocalDay: 1,
      rollingWindowMinutes: 60,
      maxAttemptsPerRollingWindow: 1,
      minCooldownMinutes: 60,
      maxConsecutiveFailures: 1,
      maxRecentNoAnswers: 1,
      maxRecentDismissals: 1,
      channelLimits: [
        { channel: "voice_call", maxAttemptsPerLocalDay: 1 },
      ],
    },
    ...overrides,
  });
}
