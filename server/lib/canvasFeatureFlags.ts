export const CANVAS_FEATURE_FLAGS = {
  ride: {
    enableEnv: "VYVA_ENABLE_RIDE_VOICE_CANVAS",
    rolloutEnv: "VYVA_RIDE_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  appointment: {
    enableEnv: "VYVA_ENABLE_APPOINTMENT_VOICE_CANVAS",
    rolloutEnv: "VYVA_APPOINTMENT_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  medicationRefill: {
    enableEnv: "VYVA_ENABLE_MEDICATION_REFILL_VOICE_CANVAS",
    rolloutEnv: "VYVA_MEDICATION_REFILL_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  prescriptionFollowUp: {
    enableEnv: "VYVA_ENABLE_PRESCRIPTION_FOLLOW_UP_VOICE_CANVAS",
    rolloutEnv: "VYVA_PRESCRIPTION_FOLLOW_UP_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  shoppingDelivery: {
    enableEnv: "VYVA_ENABLE_SHOPPING_DELIVERY_VOICE_CANVAS",
    rolloutEnv: "VYVA_SHOPPING_DELIVERY_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  homeService: {
    enableEnv: "VYVA_ENABLE_HOME_SERVICE_VOICE_CANVAS",
    rolloutEnv: "VYVA_HOME_SERVICE_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
  providerReply: {
    enableEnv: "VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS",
    rolloutEnv: "VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT",
  },
} as const;

export type CanvasFeatureFlagKey = keyof typeof CANVAS_FEATURE_FLAGS;

export interface CanvasFeatureFlagPayload {
  enabled: boolean;
  rolloutPercent: number;
}

export function resolveCanvasFeatureFlag(
  feature: CanvasFeatureFlagKey,
  env: Record<string, string | undefined> = process.env,
): CanvasFeatureFlagPayload {
  const config = CANVAS_FEATURE_FLAGS[feature];
  const configuredRollout = Number(env[config.rolloutEnv] ?? "0");
  return {
    enabled: env[config.enableEnv] === "true",
    rolloutPercent: Number.isFinite(configuredRollout)
      ? Math.min(100, Math.max(0, Math.round(configuredRollout)))
      : 0,
  };
}
