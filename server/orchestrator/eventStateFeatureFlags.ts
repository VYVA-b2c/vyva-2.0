import { createHash } from "node:crypto";
import { z } from "zod";

export const EVENT_STATE_SHADOW_FLAG = Object.freeze({
  flagId: "flag.orchestrator.event_state_shadow",
  flagVersion: "1.0.0",
  defaultMode: "disabled",
} as const);

export const EVENT_STATE_SHADOW_ENV = Object.freeze({
  mode: "VYVA_EVENT_STATE_SHADOW_MODE",
  rolloutBasisPoints: "VYVA_EVENT_STATE_SHADOW_ROLLOUT_BPS",
  allowProduction: "VYVA_EVENT_STATE_SHADOW_ALLOW_PRODUCTION",
  expiry: "VYVA_EVENT_STATE_SHADOW_EXPIRY",
  ownerReference: "VYVA_EVENT_STATE_SHADOW_OWNER_REFERENCE",
  auditReference: "VYVA_EVENT_STATE_SHADOW_AUDIT_REFERENCE",
  environment: "NODE_ENV",
} as const);

const STRICT_UTC_ISO_EXPIRY_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REFERENCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/;
const MAX_REFERENCE_LENGTH = 200;
const MAX_COHORT_KEY_LENGTH = 512;

export const eventStateShadowModeSchema = z.enum(["disabled", "shadow_emit"]);
export type EventStateShadowMode = z.infer<typeof eventStateShadowModeSchema>;

export const eventStateShadowReasonCodeSchema = z.enum([
  "event_state_default_disabled",
  "event_state_disabled_requested",
  "event_state_mode_invalid",
  "event_state_rollout_invalid",
  "event_state_cohort_missing",
  "event_state_environment_invalid",
  "event_state_expiry_missing",
  "event_state_expired",
  "event_state_owner_missing",
  "event_state_audit_missing",
  "event_state_production_not_authorized",
  "event_state_cohort_not_selected",
  "event_state_shadow_selected",
  "event_state_resolution_failed",
]);
export type EventStateShadowReasonCode =
  z.infer<typeof eventStateShadowReasonCodeSchema>;

export const eventStateShadowFlagResolutionSchema = z.object({
  flagId: z.literal(EVENT_STATE_SHADOW_FLAG.flagId),
  flagVersion: z.literal(EVENT_STATE_SHADOW_FLAG.flagVersion),
  requestedMode: eventStateShadowModeSchema,
  effectiveMode: eventStateShadowModeSchema,
  defaultMode: z.literal("disabled"),
  reasonCode: eventStateShadowReasonCodeSchema,
  rolloutBucket: z.number().int().min(0).max(9_999).optional(),
  ownerReference: z.string().min(1).max(MAX_REFERENCE_LENGTH).optional(),
  auditReference: z.string().min(1).max(MAX_REFERENCE_LENGTH).optional(),
  nonExecutable: z.literal(true),
}).strict();

export type EventStateShadowFlagResolution =
  z.infer<typeof eventStateShadowFlagResolutionSchema>;

export type EventStateEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

function disabled(
  requestedMode: EventStateShadowMode,
  reasonCode: EventStateShadowReasonCode,
  rolloutBucket?: number,
): EventStateShadowFlagResolution {
  return eventStateShadowFlagResolutionSchema.parse({
    flagId: EVENT_STATE_SHADOW_FLAG.flagId,
    flagVersion: EVENT_STATE_SHADOW_FLAG.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    rolloutBucket,
    nonExecutable: true,
  });
}

function isReference(value: string | undefined): value is string {
  return Boolean(
    value &&
    value.length <= MAX_REFERENCE_LENGTH &&
    REFERENCE_PATTERN.test(value),
  );
}

function environmentClass(value: string | undefined) {
  if (value === "development" || value === "local") return "local";
  if (value === "test" || value === "staging" || value === "production") return value;
  return null;
}

export function computeEventStateCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${EVENT_STATE_SHADOW_FLAG.flagId}:${EVENT_STATE_SHADOW_FLAG.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolveEventStateShadowMode(input: {
  env: EventStateEnvironmentMap;
  now: Date;
  cohortKey?: string;
}): EventStateShadowFlagResolution {
  try {
    const configuredMode = input.env[EVENT_STATE_SHADOW_ENV.mode];
    if (configuredMode === undefined || configuredMode === "") return disabled("disabled", "event_state_default_disabled");
    if (configuredMode !== configuredMode.trim()) return disabled("disabled", "event_state_mode_invalid");
    if (!eventStateShadowModeSchema.safeParse(configuredMode).success) return disabled("disabled", "event_state_mode_invalid");
    const requestedMode = configuredMode as EventStateShadowMode;
    if (requestedMode === "disabled") return disabled(requestedMode, "event_state_disabled_requested");

    const rolloutRaw = input.env[EVENT_STATE_SHADOW_ENV.rolloutBasisPoints];
    if (!rolloutRaw || rolloutRaw !== rolloutRaw.trim() || !/^\d{1,5}$/.test(rolloutRaw)) return disabled(requestedMode, "event_state_rollout_invalid");
    const rolloutBasisPoints = Number(rolloutRaw);
    if (rolloutBasisPoints < 1 || rolloutBasisPoints > 10_000) return disabled(requestedMode, "event_state_rollout_invalid");

    const cohortKey = input.cohortKey;
    if (!cohortKey || cohortKey !== cohortKey.trim() || cohortKey.length > MAX_COHORT_KEY_LENGTH) return disabled(requestedMode, "event_state_cohort_missing");
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) return disabled(requestedMode, "event_state_expiry_missing");

    const envClass = environmentClass(input.env[EVENT_STATE_SHADOW_ENV.environment]);
    if (!envClass) return disabled(requestedMode, "event_state_environment_invalid");

    const expiryRaw = input.env[EVENT_STATE_SHADOW_ENV.expiry];
    if (!expiryRaw || !STRICT_UTC_ISO_EXPIRY_PATTERN.test(expiryRaw)) return disabled(requestedMode, "event_state_expiry_missing");
    const expiry = new Date(expiryRaw);
    if (!Number.isFinite(expiry.getTime()) || expiry.toISOString() !== expiryRaw) return disabled(requestedMode, "event_state_expiry_missing");
    if (expiry.getTime() <= input.now.getTime()) return disabled(requestedMode, "event_state_expired");

    const ownerReference = input.env[EVENT_STATE_SHADOW_ENV.ownerReference];
    if (!isReference(ownerReference)) return disabled(requestedMode, "event_state_owner_missing");
    const auditReference = input.env[EVENT_STATE_SHADOW_ENV.auditReference];
    if (!isReference(auditReference)) return disabled(requestedMode, "event_state_audit_missing");
    if (envClass === "production" && input.env[EVENT_STATE_SHADOW_ENV.allowProduction] !== "true") return disabled(requestedMode, "event_state_production_not_authorized");

    const rolloutBucket = computeEventStateCohortBucket(cohortKey);
    if (rolloutBucket >= rolloutBasisPoints) return disabled(requestedMode, "event_state_cohort_not_selected", rolloutBucket);

    return eventStateShadowFlagResolutionSchema.parse({
      flagId: EVENT_STATE_SHADOW_FLAG.flagId,
      flagVersion: EVENT_STATE_SHADOW_FLAG.flagVersion,
      requestedMode,
      effectiveMode: "shadow_emit",
      defaultMode: "disabled",
      reasonCode: "event_state_shadow_selected",
      rolloutBucket,
      ownerReference,
      auditReference,
      nonExecutable: true,
    });
  } catch {
    return disabled("disabled", "event_state_resolution_failed");
  }
}
