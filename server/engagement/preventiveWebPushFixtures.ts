import { createECDH } from "node:crypto";
import { baseProactiveEvaluationInput } from "./proactiveFixtures.js";
import { PREVENTIVE_WEB_PUSH_FLAG_ENV } from "./preventiveWebPushFeatureFlags.js";
import { PREVENTIVE_WEB_PUSH_PROVIDER_ENV } from "./preventiveWebPushProvider.js";
import type { ProactiveEngagementEvaluationInput } from "../../shared/engagement/proactiveEngagement.js";

export const validPushEndpoint = "https://fcm.googleapis.com/fcm/send/test-endpoint-token";

function p256KeyPair(privateSeed: number) {
  const privateKey = Buffer.alloc(32);
  privateKey[31] = privateSeed;
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKey);
  return {
    publicKey: ecdh.getPublicKey().toString("base64url"),
    privateKey: privateKey.toString("base64url"),
  };
}

const subscriptionPair = p256KeyPair(2);
const vapidPair = p256KeyPair(3);

export const validP256dh = subscriptionPair.publicKey;
export const validAuth = Buffer.from([
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, 16,
]).toString("base64url");
export const validVapidPublicKey = vapidPair.publicKey;
export const validVapidPrivateKey = vapidPair.privateKey;

export function validPreventiveWebPushSubscription(overrides: Record<string, unknown> = {}) {
  return {
    endpoint: validPushEndpoint,
    expirationTime: null,
    keys: {
      p256dh: validP256dh,
      auth: validAuth,
    },
    contentEncoding: "aes128gcm",
    userAgent: "vitest",
    ...overrides,
  };
}

export function validPreventiveWebPushEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    [PREVENTIVE_WEB_PUSH_FLAG_ENV.mode]: "pilot",
    [PREVENTIVE_WEB_PUSH_FLAG_ENV.rolloutBasisPoints]: "10000",
    [PREVENTIVE_WEB_PUSH_FLAG_ENV.environment]: "test",
    [PREVENTIVE_WEB_PUSH_PROVIDER_ENV.publicKey]: validVapidPublicKey,
    [PREVENTIVE_WEB_PUSH_PROVIDER_ENV.privateKey]: validVapidPrivateKey,
    [PREVENTIVE_WEB_PUSH_PROVIDER_ENV.subject]: "mailto:ops@example.com",
    ...overrides,
  };
}

export function basePreventiveWebPushEvaluationInput(
  overrides: Partial<ProactiveEngagementEvaluationInput> = {},
): ProactiveEngagementEvaluationInput {
  return baseProactiveEvaluationInput({
    channelPreferences: {
      preferredChannel: "web_push",
      fallbackChain: [],
      fallbackPermissions: [],
    },
    channelCandidates: [
      {
        channel: "web_push",
        preferenceRank: 0,
        availability: "available",
        purposeId: "daily_wellbeing_check",
      },
    ],
    consentFacts: [
      {
        consentId: "consent.purpose.webpush",
        purposeId: "daily_wellbeing_check",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
      {
        consentId: "consent.channel.webpush",
        purposeId: "daily_wellbeing_check",
        channel: "web_push",
        subject: "user",
        state: "granted",
        effectiveAt: "2026-01-01T00:00:00.000Z",
        recordedAt: "2026-01-01T00:00:00.000Z",
        revision: 1,
      },
    ],
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
        { channel: "web_push", maxAttemptsPerLocalDay: 3 },
      ],
    },
    ...overrides,
  });
}
