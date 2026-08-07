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
  healthPreventiveVoiceScreenSync: {
    enableEnv: "VYVA_ENABLE_HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC",
    rolloutEnv: "VYVA_HEALTH_PREVENTIVE_VOICE_SCREEN_SYNC_ROLLOUT_PERCENT",
  },
} as const;

export type CanvasFeatureFlagKey = keyof typeof CANVAS_FEATURE_FLAGS;

export const CANVAS_FEATURE_FLAG_ENDPOINTS = [
  { endpoint: "/api/config/features/ride-voice-canvas", feature: "ride" },
  {
    endpoint: "/api/config/features/appointment-voice-canvas",
    feature: "appointment",
  },
  {
    endpoint: "/api/config/features/medication-refill-voice-canvas",
    feature: "medicationRefill",
  },
  {
    endpoint: "/api/config/features/prescription-follow-up-voice-canvas",
    feature: "prescriptionFollowUp",
  },
  {
    endpoint: "/api/config/features/shopping-delivery-voice-canvas",
    feature: "shoppingDelivery",
  },
  {
    endpoint: "/api/config/features/home-service-voice-canvas",
    feature: "homeService",
  },
  {
    endpoint: "/api/config/features/provider-reply-voice-canvas",
    feature: "providerReply",
  },
  {
    endpoint: "/api/config/features/health-preventive-voice-screen-sync",
    feature: "healthPreventiveVoiceScreenSync",
  },
] as const satisfies readonly {
  endpoint: string;
  feature: CanvasFeatureFlagKey;
}[];

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
