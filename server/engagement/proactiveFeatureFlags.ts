import { createHash } from "node:crypto";
import { z } from "zod";

export const PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG = Object.freeze({
  flagId: "flag.engagement.audit_shadow",
  flagVersion: "1.0.0",
  defaultMode: "disabled",
} as const);

export const PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV = Object.freeze({
  mode: "VYVA_ENGAGEMENT_AUDIT_SHADOW_MODE",
  rolloutBasisPoints: "VYVA_ENGAGEMENT_AUDIT_SHADOW_ROLLOUT_BPS",
  allowProduction: "VYVA_ENGAGEMENT_AUDIT_SHADOW_ALLOW_PRODUCTION",
  expiry: "VYVA_ENGAGEMENT_AUDIT_SHADOW_EXPIRY",
  ownerReference: "VYVA_ENGAGEMENT_AUDIT_SHADOW_OWNER_REFERENCE",
  auditReference: "VYVA_ENGAGEMENT_AUDIT_SHADOW_AUDIT_REFERENCE",
  environment: "NODE_ENV",
} as const);

export const proactiveEngagementAuditShadowModeSchema = z.enum([
  "audit_shadow",
  "disabled",
]);
export type ProactiveEngagementAuditShadowMode =
  z.infer<typeof proactiveEngagementAuditShadowModeSchema>;

export const proactiveEngagementAuditShadowReasonCodeSchema = z.enum([
  "engagement_audit_shadow_selected",
  "engagement_shadow_audit_missing",
  "engagement_shadow_cohort_missing",
  "engagement_shadow_cohort_not_selected",
  "engagement_shadow_default_disabled",
  "engagement_shadow_disabled_requested",
  "engagement_shadow_environment_invalid",
  "engagement_shadow_expired",
  "engagement_shadow_expiry_missing",
  "engagement_shadow_mode_invalid",
  "engagement_shadow_owner_missing",
  "engagement_shadow_production_not_authorized",
  "engagement_shadow_resolution_failed",
  "engagement_shadow_rollout_invalid",
]);
export type ProactiveEngagementAuditShadowReasonCode =
  z.infer<typeof proactiveEngagementAuditShadowReasonCodeSchema>;

export const proactiveEngagementAuditShadowFlagResolutionSchema = z.object({
  flagId: z.literal(PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagId),
  flagVersion: z.literal(PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagVersion),
  requestedMode: proactiveEngagementAuditShadowModeSchema,
  effectiveMode: proactiveEngagementAuditShadowModeSchema,
  defaultMode: z.literal("disabled"),
  reasonCode: proactiveEngagementAuditShadowReasonCodeSchema,
  rolloutBucket: z.number().int().min(0).max(9_999).optional(),
  ownerReference: z.string().min(1).max(200).optional(),
  auditReference: z.string().min(1).max(200).optional(),
  shadowOnly: z.literal(true),
  nonExecutable: z.literal(true),
}).strict();

export type ProactiveEngagementAuditShadowFlagResolution =
  z.infer<typeof proactiveEngagementAuditShadowFlagResolutionSchema>;

export type ProactiveEngagementEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

const STRICT_UTC_ISO_EXPIRY_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REFERENCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/;
const MAX_REFERENCE_LENGTH = 200;
const MAX_COHORT_KEY_LENGTH = 512;

function disabled(
  requestedMode: ProactiveEngagementAuditShadowMode,
  reasonCode: ProactiveEngagementAuditShadowReasonCode,
  rolloutBucket?: number,
): ProactiveEngagementAuditShadowFlagResolution {
  return proactiveEngagementAuditShadowFlagResolutionSchema.parse({
    flagId: PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagId,
    flagVersion: PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    ...(rolloutBucket !== undefined ? { rolloutBucket } : {}),
    shadowOnly: true,
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

export function computeProactiveEngagementCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagId}:${PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolveProactiveEngagementAuditShadowMode(input: {
  env: ProactiveEngagementEnvironmentMap;
  now: Date;
  cohortKey?: string;
}): ProactiveEngagementAuditShadowFlagResolution {
  try {
    const configuredMode = input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.mode];
    if (configuredMode === undefined || configuredMode === "") {
      return disabled("disabled", "engagement_shadow_default_disabled");
    }
    if (configuredMode !== configuredMode.trim() ||
      !proactiveEngagementAuditShadowModeSchema.safeParse(configuredMode).success) {
      return disabled("disabled", "engagement_shadow_mode_invalid");
    }
    const requestedMode = configuredMode as ProactiveEngagementAuditShadowMode;
    if (requestedMode === "disabled") {
      return disabled(requestedMode, "engagement_shadow_disabled_requested");
    }

    const rolloutRaw = input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.rolloutBasisPoints];
    if (!rolloutRaw || rolloutRaw !== rolloutRaw.trim() || !/^\d{1,5}$/.test(rolloutRaw)) {
      return disabled(requestedMode, "engagement_shadow_rollout_invalid");
    }
    const rolloutBasisPoints = Number(rolloutRaw);
    if (rolloutBasisPoints < 1 || rolloutBasisPoints > 10_000) {
      return disabled(requestedMode, "engagement_shadow_rollout_invalid");
    }

    const cohortKey = input.cohortKey;
    if (!cohortKey || cohortKey !== cohortKey.trim() || cohortKey.length > MAX_COHORT_KEY_LENGTH) {
      return disabled(requestedMode, "engagement_shadow_cohort_missing");
    }
    if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
      return disabled(requestedMode, "engagement_shadow_expiry_missing");
    }

    const envClass = environmentClass(input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.environment]);
    if (!envClass) return disabled(requestedMode, "engagement_shadow_environment_invalid");

    const expiryRaw = input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.expiry];
    if (!expiryRaw || !STRICT_UTC_ISO_EXPIRY_PATTERN.test(expiryRaw)) {
      return disabled(requestedMode, "engagement_shadow_expiry_missing");
    }
    const expiry = new Date(expiryRaw);
    if (!Number.isFinite(expiry.getTime()) || expiry.toISOString() !== expiryRaw) {
      return disabled(requestedMode, "engagement_shadow_expiry_missing");
    }
    if (expiry.getTime() <= input.now.getTime()) {
      return disabled(requestedMode, "engagement_shadow_expired");
    }

    const ownerReference = input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.ownerReference];
    if (!isReference(ownerReference)) return disabled(requestedMode, "engagement_shadow_owner_missing");
    const auditReference = input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.auditReference];
    if (!isReference(auditReference)) return disabled(requestedMode, "engagement_shadow_audit_missing");
    if (envClass === "production" &&
      input.env[PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_ENV.allowProduction] !== "true") {
      return disabled(requestedMode, "engagement_shadow_production_not_authorized");
    }

    const rolloutBucket = computeProactiveEngagementCohortBucket(cohortKey);
    if (rolloutBucket >= rolloutBasisPoints) {
      return disabled(requestedMode, "engagement_shadow_cohort_not_selected", rolloutBucket);
    }

    return proactiveEngagementAuditShadowFlagResolutionSchema.parse({
      flagId: PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagId,
      flagVersion: PROACTIVE_ENGAGEMENT_AUDIT_SHADOW_FLAG.flagVersion,
      requestedMode,
      effectiveMode: "audit_shadow",
      defaultMode: "disabled",
      reasonCode: "engagement_audit_shadow_selected",
      rolloutBucket,
      ownerReference,
      auditReference,
      shadowOnly: true,
      nonExecutable: true,
    });
  } catch {
    return disabled("disabled", "engagement_shadow_resolution_failed");
  }
}
