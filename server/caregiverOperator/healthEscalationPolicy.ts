import { createHash } from "node:crypto";
import { z } from "zod";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";
import type { CaregiverDomainAccessContext } from "../lib/caregiverDomainAccess.js";

export const HEALTH_CAREGIVER_OPERATOR_ESCALATION = Object.freeze({
  flagId: "flag.health.caregiver_operator_escalation",
  flagVersion: "1.0.0",
  policyVersion: "1.0.0",
  purpose: "health.preventive_check.caregiver_operator_escalation",
} as const);

export const HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV = Object.freeze({
  mode: "VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_MODE",
  allowUsers: "VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_ALLOW_USERS",
  denyUsers: "VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_DENY_USERS",
  rolloutBasisPoints: "VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_ROLLOUT_BPS",
  allowProduction: "VYVA_HEALTH_CAREGIVER_OPERATOR_ESCALATION_ALLOW_PRODUCTION",
  environment: "NODE_ENV",
} as const);

export type HealthEscalationFeatureMode = "disabled" | "pilot";

export type HealthEscalationFeatureReasonCode =
  | "health_escalation_allowed_user"
  | "health_escalation_cohort_missing"
  | "health_escalation_cohort_not_selected"
  | "health_escalation_default_disabled"
  | "health_escalation_denied_user"
  | "health_escalation_disabled_requested"
  | "health_escalation_environment_invalid"
  | "health_escalation_mode_invalid"
  | "health_escalation_production_not_authorized"
  | "health_escalation_rollout_invalid"
  | "health_escalation_rollout_selected";

export type HealthEscalationFeatureResolution = Readonly<{
  flagId: typeof HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagId;
  flagVersion: typeof HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagVersion;
  requestedMode: HealthEscalationFeatureMode;
  effectiveMode: HealthEscalationFeatureMode;
  defaultMode: "disabled";
  reasonCode: HealthEscalationFeatureReasonCode;
  rolloutBucket?: number;
  productionAllowed: boolean;
}>;

export const healthEscalationAudienceSchema = z.enum(["caregiver", "operator"]);
export const healthEscalationActorRoleSchema = z.enum([
  "caregiver",
  "family",
  "admin",
  "operator",
  "user",
  "elder",
  "unknown",
]);
export const healthEscalationPurposeSchema = z.literal(
  HEALTH_CAREGIVER_OPERATOR_ESCALATION.purpose,
);

export type HealthEscalationAudience = z.infer<typeof healthEscalationAudienceSchema>;
export type HealthEscalationActorRole = z.infer<typeof healthEscalationActorRoleSchema>;

export const healthEscalationConsentSchema = z.object({
  caregiverProjectionAllowed: z.boolean().default(false),
  operatorProjectionAllowed: z.boolean().default(false),
  consentRevision: z.number().int().min(0).max(1_000_000).optional(),
  approvalReference: z.string().min(1).max(160).optional(),
  revokedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export type HealthEscalationConsent = z.infer<typeof healthEscalationConsentSchema>;

const USER_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_LIST_LENGTH = 100;
const MAX_COHORT_KEY_LENGTH = 512;
const DISALLOWED_LIST_WHITESPACE = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;

const caregiverAccessEvidenceSchema = z.object({
  targetUserId: z.string().min(1).max(160),
  actorUserId: z.string().min(1).max(160),
  actorRole: z.enum(["elder", "caregiver", "family", "admin", "user"]),
  isOwnProfile: z.boolean(),
  isAdmin: z.boolean(),
  domain: z.literal("health"),
  permissions: z.object({
    view_vitals: z.boolean(),
  }).passthrough(),
}).strict();

const operatorAuthorizationSchema = z.object({
  actorUserId: z.string().min(1).max(160),
  actorRole: z.enum(["admin", "operator"]),
  scope: z.string().min(1).max(80),
}).strict();

export type HealthEscalationOperatorAuthorization = z.infer<typeof operatorAuthorizationSchema>;

export const healthEscalationAuthorizationInputSchema = z.object({
  subjectUserId: z.string().min(1).max(160),
  profileId: z.string().min(1).max(160).optional(),
  targetAudience: healthEscalationAudienceSchema,
  targetActorId: z.string().min(1).max(160).nullable().optional(),
  targetActorRole: healthEscalationActorRoleSchema,
  purpose: healthEscalationPurposeSchema,
  flowId: z.literal("health.preventive_check"),
  flowVersion: z.literal("1.0.0"),
  flowInstanceId: z.string().min(1).max(200),
  sourceEventId: z.string().min(1).max(200),
  completionReference: z.string().min(1).max(200),
  answerDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  requestedAt: z.string().datetime({ offset: true }),
  consent: healthEscalationConsentSchema,
  caregiverAccess: caregiverAccessEvidenceSchema.optional(),
  operatorAuthorization: operatorAuthorizationSchema.optional(),
}).strict();

export type HealthEscalationAuthorizationInput = z.infer<typeof healthEscalationAuthorizationInputSchema>;

export type HealthEscalationAuthorizationReasonCode =
  | "health_escalation_authorized_caregiver"
  | "health_escalation_authorized_operator"
  | "health_escalation_invalid_input"
  | "health_escalation_missing_caregiver_access"
  | "health_escalation_wrong_caregiver"
  | "health_escalation_caregiver_scope_mismatch"
  | "health_escalation_caregiver_permission_missing"
  | "health_escalation_caregiver_role_invalid"
  | "health_escalation_missing_operator_authorization"
  | "health_escalation_operator_role_invalid"
  | "health_escalation_operator_scope_invalid"
  | "health_escalation_unknown_role";

export type HealthEscalationConsentReasonCode =
  | "health_escalation_caregiver_consent_allowed"
  | "health_escalation_operator_consent_allowed"
  | "health_escalation_consent_missing"
  | "health_escalation_consent_revoked"
  | "health_escalation_consent_wrong_purpose";

export type HealthEscalationAuthorizationDecision = Readonly<{
  policyVersion: typeof HEALTH_CAREGIVER_OPERATOR_ESCALATION.policyVersion;
  authorizationDecision: "allow" | "deny";
  authorizationReasonCode: HealthEscalationAuthorizationReasonCode;
  consentDecision: "allow" | "deny";
  consentReasonCode: HealthEscalationConsentReasonCode;
  targetAudience: HealthEscalationAudience;
  targetActorRole: HealthEscalationActorRole;
  consentRevision: number | null;
  approvalReference: string | null;
  evaluatedAt: string;
  decisionDigest: string;
}>;

export type HealthEscalationAuthorizationEvaluation =
  | {
      ok: true;
      input: HealthEscalationAuthorizationInput;
      decision: HealthEscalationAuthorizationDecision;
    }
  | {
      ok: false;
      reasonCode: "health_escalation_invalid_input";
    };

export type HealthEscalationEnvironmentMap = Readonly<Record<string, string | undefined>>;

function disabled(
  requestedMode: HealthEscalationFeatureMode,
  reasonCode: HealthEscalationFeatureReasonCode,
  options: { rolloutBucket?: number; productionAllowed?: boolean } = {},
): HealthEscalationFeatureResolution {
  return {
    flagId: HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagId,
    flagVersion: HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    ...(options.rolloutBucket !== undefined ? { rolloutBucket: options.rolloutBucket } : {}),
    productionAllowed: options.productionAllowed ?? false,
  };
}

function selected(
  reasonCode: HealthEscalationFeatureReasonCode,
  options: {
    requestedMode: HealthEscalationFeatureMode;
    rolloutBucket?: number;
    productionAllowed: boolean;
  },
): HealthEscalationFeatureResolution {
  return {
    flagId: HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagId,
    flagVersion: HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagVersion,
    requestedMode: options.requestedMode,
    effectiveMode: "pilot",
    defaultMode: "disabled",
    reasonCode,
    ...(options.rolloutBucket !== undefined ? { rolloutBucket: options.rolloutBucket } : {}),
    productionAllowed: options.productionAllowed,
  };
}

function environmentClass(value: string | undefined): "development" | "local" | "test" | "staging" | "production" | null {
  if (value === "development" || value === "local" || value === "test" || value === "staging" || value === "production") {
    return value;
  }
  return null;
}

function parseUserList(raw: string | undefined): { ok: true; values: Set<string> } | { ok: false } {
  if (raw === undefined || raw === "") return { ok: true, values: new Set() };
  if (raw !== raw.trim() || DISALLOWED_LIST_WHITESPACE.test(raw)) return { ok: false };
  const values = raw.split(",");
  if (values.length === 0 || values.length > MAX_LIST_LENGTH) return { ok: false };
  const seen = new Set<string>();
  for (const value of values) {
    if (value.length === 0 || value.length > 160 || !USER_REF_PATTERN.test(value) || seen.has(value)) {
      return { ok: false };
    }
    seen.add(value);
  }
  return seen.size === values.length ? { ok: true, values: seen } : { ok: false };
}

function parseRollout(raw: string | undefined): number | null {
  if (raw === undefined || raw === "") return null;
  if (raw !== raw.trim() || !/^\d{1,5}$/.test(raw)) return null;
  const value = Number(raw);
  return value >= 0 && value <= 10_000 ? value : null;
}

export function computeHealthEscalationCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagId}:${HEALTH_CAREGIVER_OPERATOR_ESCALATION.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolveHealthEscalationFeatureFlag(input: {
  env: HealthEscalationEnvironmentMap;
  cohortKey?: string;
  userRef?: string;
}): HealthEscalationFeatureResolution {
  const rawMode = input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.mode];
  if (rawMode === undefined || rawMode === "") {
    return disabled("disabled", "health_escalation_default_disabled");
  }
  if (rawMode !== rawMode.trim() || (rawMode !== "disabled" && rawMode !== "pilot")) {
    return disabled("disabled", "health_escalation_mode_invalid");
  }
  const requestedMode = rawMode as HealthEscalationFeatureMode;
  if (requestedMode === "disabled") {
    return disabled(requestedMode, "health_escalation_disabled_requested");
  }

  const environment = environmentClass(input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.environment]);
  if (!environment) return disabled(requestedMode, "health_escalation_environment_invalid");
  const productionAllowed = environment !== "production" ||
    input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.allowProduction] === "true";
  if (!productionAllowed) {
    return disabled(requestedMode, "health_escalation_production_not_authorized", { productionAllowed });
  }

  const deny = parseUserList(input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.denyUsers]);
  if (!deny.ok) return disabled(requestedMode, "health_escalation_mode_invalid", { productionAllowed });
  const allow = parseUserList(input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.allowUsers]);
  if (!allow.ok) return disabled(requestedMode, "health_escalation_mode_invalid", { productionAllowed });

  const userRef = input.userRef ?? "";
  if (userRef && deny.values.has(userRef)) {
    return disabled(requestedMode, "health_escalation_denied_user", { productionAllowed });
  }
  if (userRef && allow.values.has(userRef)) {
    return selected("health_escalation_allowed_user", { requestedMode, productionAllowed });
  }

  const rollout = parseRollout(input.env[HEALTH_CAREGIVER_OPERATOR_ESCALATION_ENV.rolloutBasisPoints]);
  if (rollout === null) return disabled(requestedMode, "health_escalation_rollout_invalid", { productionAllowed });
  const cohortKey = input.cohortKey;
  if (!cohortKey || cohortKey !== cohortKey.trim() || cohortKey.length > MAX_COHORT_KEY_LENGTH) {
    return disabled(requestedMode, "health_escalation_cohort_missing", { productionAllowed });
  }
  const rolloutBucket = computeHealthEscalationCohortBucket(cohortKey);
  if (rolloutBucket >= rollout) {
    return disabled(requestedMode, "health_escalation_cohort_not_selected", {
      rolloutBucket,
      productionAllowed,
    });
  }
  return selected("health_escalation_rollout_selected", {
    requestedMode,
    rolloutBucket,
    productionAllowed,
  });
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boolFromRecord(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true);
}

function stringFromRecord(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim() && value === value.trim()) return value;
  }
  return undefined;
}

function numberFromRecord(record: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  }
  return undefined;
}

export function consentFromStage9ProfileDataSharing(value: unknown): HealthEscalationConsent {
  let inert: unknown;
  try {
    inert = descriptorSafeDeepInertClone(value);
  } catch {
    return {
      caregiverProjectionAllowed: false,
      operatorProjectionAllowed: false,
    };
  }
  const root = asPlainRecord(inert);
  const stage9 = asPlainRecord(
    root.health_caregiver_operator_escalation ?? root.healthCaregiverOperatorEscalation,
  );
  const parsed = healthEscalationConsentSchema.safeParse({
    caregiverProjectionAllowed: boolFromRecord(
      stage9,
      "caregiver_projection_allowed",
      "caregiverProjectionAllowed",
    ),
    operatorProjectionAllowed: boolFromRecord(
      stage9,
      "operator_projection_allowed",
      "operatorProjectionAllowed",
    ),
    ...(() => {
      const consentRevision = numberFromRecord(stage9, "revision", "consentRevision");
      return consentRevision !== undefined ? { consentRevision } : {};
    })(),
    ...(() => {
      const approvalReference = stringFromRecord(stage9, "approval_reference", "approvalReference");
      return approvalReference !== undefined ? { approvalReference } : {};
    })(),
    ...(() => {
      const revokedAt = stringFromRecord(stage9, "revoked_at", "revokedAt");
      return revokedAt !== undefined ? { revokedAt } : {};
    })(),
  });
  return parsed.success
    ? parsed.data
    : {
        caregiverProjectionAllowed: false,
        operatorProjectionAllowed: false,
      };
}

function baseDecision(
  input: HealthEscalationAuthorizationInput,
  output: Omit<
    HealthEscalationAuthorizationDecision,
    | "policyVersion"
    | "targetAudience"
    | "targetActorRole"
    | "consentRevision"
    | "approvalReference"
    | "evaluatedAt"
    | "decisionDigest"
  >,
): HealthEscalationAuthorizationDecision {
  const projection = canonicalContractProjection({
    policyVersion: HEALTH_CAREGIVER_OPERATOR_ESCALATION.policyVersion,
    targetAudience: input.targetAudience,
    targetActorRole: input.targetActorRole,
    authorizationDecision: output.authorizationDecision,
    authorizationReasonCode: output.authorizationReasonCode,
    consentDecision: output.consentDecision,
    consentReasonCode: output.consentReasonCode,
    consentRevision: input.consent.consentRevision ?? null,
    approvalReference: input.consent.approvalReference ?? null,
    evaluatedAt: input.requestedAt,
  });
  return {
    policyVersion: HEALTH_CAREGIVER_OPERATOR_ESCALATION.policyVersion,
    targetAudience: input.targetAudience,
    targetActorRole: input.targetActorRole,
    consentRevision: input.consent.consentRevision ?? null,
    approvalReference: input.consent.approvalReference ?? null,
    evaluatedAt: input.requestedAt,
    decisionDigest: canonicalSha256("vyva.task14.health-escalation.authorization-decision.v1", projection),
    ...output,
  };
}

function consentDecision(input: HealthEscalationAuthorizationInput): Pick<
  HealthEscalationAuthorizationDecision,
  "consentDecision" | "consentReasonCode"
> {
  if (input.consent.revokedAt) {
    return {
      consentDecision: "deny",
      consentReasonCode: "health_escalation_consent_revoked",
    };
  }
  if (input.targetAudience === "caregiver") {
    return input.consent.caregiverProjectionAllowed
      ? {
          consentDecision: "allow",
          consentReasonCode: "health_escalation_caregiver_consent_allowed",
        }
      : {
          consentDecision: "deny",
          consentReasonCode: "health_escalation_consent_missing",
        };
  }
  return input.consent.operatorProjectionAllowed
    ? {
        consentDecision: "allow",
        consentReasonCode: "health_escalation_operator_consent_allowed",
      }
    : {
        consentDecision: "deny",
        consentReasonCode: "health_escalation_consent_missing",
      };
}

function deniedAuthorization(
  input: HealthEscalationAuthorizationInput,
  reasonCode: HealthEscalationAuthorizationReasonCode,
): HealthEscalationAuthorizationDecision {
  return baseDecision(input, {
    authorizationDecision: "deny",
    authorizationReasonCode: reasonCode,
    ...consentDecision(input),
  });
}

function allowedAuthorization(
  input: HealthEscalationAuthorizationInput,
  reasonCode: Extract<
    HealthEscalationAuthorizationReasonCode,
    "health_escalation_authorized_caregiver" | "health_escalation_authorized_operator"
  >,
): HealthEscalationAuthorizationDecision {
  const consent = consentDecision(input);
  return baseDecision(input, {
    authorizationDecision: "allow",
    authorizationReasonCode: reasonCode,
    ...consent,
  });
}

export function evaluateHealthEscalationAuthorization(rawInput: unknown): HealthEscalationAuthorizationEvaluation {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reasonCode: "health_escalation_invalid_input" };
  }
  const parsed = healthEscalationAuthorizationInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, reasonCode: "health_escalation_invalid_input" };
  const input = parsed.data;

  if (input.targetAudience === "caregiver") {
    const access = input.caregiverAccess;
    if (!access) {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_missing_caregiver_access") };
    }
    if (input.targetActorRole !== "caregiver" && input.targetActorRole !== "family") {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_caregiver_role_invalid") };
    }
    if (!input.targetActorId || access.actorUserId !== input.targetActorId) {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_wrong_caregiver") };
    }
    if (
      access.targetUserId !== input.subjectUserId ||
      access.domain !== "health" ||
      access.isOwnProfile ||
      access.isAdmin
    ) {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_caregiver_scope_mismatch") };
    }
    if (access.actorRole !== "caregiver" && access.actorRole !== "family") {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_caregiver_role_invalid") };
    }
    if (access.permissions.view_vitals !== true) {
      return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_caregiver_permission_missing") };
    }
    return { ok: true, input, decision: allowedAuthorization(input, "health_escalation_authorized_caregiver") };
  }

  const operator = input.operatorAuthorization;
  if (!operator) {
    return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_missing_operator_authorization") };
  }
  if (input.targetActorRole !== "admin" && input.targetActorRole !== "operator") {
    return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_operator_role_invalid") };
  }
  if (operator.actorRole !== "admin" && operator.actorRole !== "operator") {
    return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_operator_role_invalid") };
  }
  if (operator.scope !== "admin_concierge_queue" && operator.scope !== "admin_health_escalation_queue") {
    return { ok: true, input, decision: deniedAuthorization(input, "health_escalation_operator_scope_invalid") };
  }
  return { ok: true, input, decision: allowedAuthorization(input, "health_escalation_authorized_operator") };
}

export function stage9Id(prefix: string, facts: unknown): string {
  const digest = canonicalSha256(`vyva.task14.${prefix}.id.v1`, canonicalContractProjection(facts));
  return `${prefix}.${digest.slice("sha256:".length, "sha256:".length + 32)}`;
}
