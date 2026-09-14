import { createHash } from "node:crypto";
import { z } from "zod";
import {
  canonicalContractProjection,
  canonicalSha256,
  descriptorSafeDeepInertClone,
} from "../orchestrator/eventStateCanonicalJson.js";

export const HEALTH_MEMORY_POLICY = Object.freeze({
  flagId: "flag.health.preventive_semantic_memory_policy",
  flagVersion: "1.0.0",
  policyVersion: "1.0.0",
  defaultMode: "disabled",
} as const);

export const HEALTH_MEMORY_POLICY_ENV = Object.freeze({
  mode: "VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_MODE",
  allowUsers: "VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_USERS",
  denyUsers: "VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_DENY_USERS",
  rolloutBasisPoints: "VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ROLLOUT_BPS",
  allowProduction: "VYVA_HEALTH_PREVENTIVE_MEMORY_POLICY_ALLOW_PRODUCTION",
  environment: "NODE_ENV",
} as const);

export const HEALTH_MEMORY_POLICY_DECISION_DIGEST_DOMAIN =
  "vyva.task13.health-memory-policy.decision.semantic.v1" as const;

export const healthMemoryCategorySchema = z.enum([
  "general_preference",
  "routine_health_context",
  "restricted_health",
  "mental_health",
  "safety_emergency",
  "care_instruction",
]);

export const healthMemoryOperationSchema = z.enum([
  "read",
  "propose_write",
  "approve_write",
  "deliver_write",
  "correct",
  "delete",
]);

export const healthMemoryTargetSchema = z.enum([
  "postgres",
  "mem0",
  "working_memory",
]);

export const healthMemoryConsentSchema = z.object({
  semanticMemoryReadAllowed: z.boolean().default(false),
  semanticMemoryWriteAllowed: z.boolean().default(false),
  consentRevision: z.number().int().min(0).max(1_000_000).optional(),
  approvalReference: z.string().min(1).max(160).optional(),
  revokedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).strict();

export const healthMemoryPolicyInputSchema = z.object({
  userId: z.string().min(1).max(160),
  profileId: z.string().min(1).max(160).optional(),
  flowId: z.literal("health.preventive_check"),
  flowVersion: z.literal("1.0.0"),
  purpose: z.literal("health.preventive_check"),
  category: healthMemoryCategorySchema,
  operation: healthMemoryOperationSchema,
  target: healthMemoryTargetSchema,
  consent: healthMemoryConsentSchema,
  requestedAt: z.string().datetime({ offset: true }),
}).strict();

export type HealthMemoryCategory = z.infer<typeof healthMemoryCategorySchema>;
export type HealthMemoryOperation = z.infer<typeof healthMemoryOperationSchema>;
export type HealthMemoryTarget = z.infer<typeof healthMemoryTargetSchema>;
export type HealthMemoryConsent = z.infer<typeof healthMemoryConsentSchema>;
export type HealthMemoryPolicyInput = z.infer<typeof healthMemoryPolicyInputSchema>;

export type HealthMemoryPolicyMode = "disabled" | "pilot";

export type HealthMemoryPolicyFlagReasonCode =
  | "health_memory_policy_allowed_user"
  | "health_memory_policy_cohort_missing"
  | "health_memory_policy_cohort_not_selected"
  | "health_memory_policy_default_disabled"
  | "health_memory_policy_denied_user"
  | "health_memory_policy_disabled_requested"
  | "health_memory_policy_environment_invalid"
  | "health_memory_policy_mode_invalid"
  | "health_memory_policy_production_not_authorized"
  | "health_memory_policy_rollout_invalid"
  | "health_memory_policy_rollout_selected";

export type HealthMemoryPolicyFlagResolution = Readonly<{
  flagId: typeof HEALTH_MEMORY_POLICY.flagId;
  flagVersion: typeof HEALTH_MEMORY_POLICY.flagVersion;
  requestedMode: HealthMemoryPolicyMode;
  effectiveMode: HealthMemoryPolicyMode;
  defaultMode: "disabled";
  reasonCode: HealthMemoryPolicyFlagReasonCode;
  rolloutBucket?: number;
  productionAllowed: boolean;
}>;

export type HealthMemoryPolicyReasonCode =
  | "health_memory_policy_read_allowed"
  | "health_memory_policy_write_allowed"
  | "health_memory_policy_proposal_allowed"
  | "health_memory_policy_approval_required"
  | "health_memory_policy_missing_read_consent"
  | "health_memory_policy_missing_write_consent"
  | "health_memory_policy_consent_revoked"
  | "health_memory_policy_restricted_requires_explicit_approval"
  | "health_memory_policy_mental_health_requires_case_approval"
  | "health_memory_policy_safety_not_semantic_memory"
  | "health_memory_policy_care_instruction_not_semantic_authority"
  | "health_memory_policy_operation_not_supported"
  | "health_memory_policy_target_not_allowed";

export type HealthMemoryPolicyDecision = Readonly<{
  policyVersion: typeof HEALTH_MEMORY_POLICY.policyVersion;
  decision: "allow" | "deny" | "proposal_only" | "approval_required";
  reasonCode: HealthMemoryPolicyReasonCode;
  category: HealthMemoryCategory;
  operation: HealthMemoryOperation;
  target: HealthMemoryTarget;
  providerDeliveryAllowed: boolean;
  retainedForAuditOnly: boolean;
  consentRevision: number | null;
  approvalReference: string | null;
  evaluatedAt: string;
  decisionDigest: string;
}>;

export type HealthMemoryPolicyEvaluation =
  | { ok: true; input: HealthMemoryPolicyInput; decision: HealthMemoryPolicyDecision }
  | { ok: false; reasonCode: "health_memory_policy_invalid_input" };

export type HealthMemoryEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

const USER_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MAX_LIST_LENGTH = 100;
const MAX_COHORT_KEY_LENGTH = 512;
const DISALLOWED_LIST_WHITESPACE = /[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;
const LOW_RISK_CATEGORIES = new Set<HealthMemoryCategory>([
  "general_preference",
  "routine_health_context",
]);

function disabled(
  requestedMode: HealthMemoryPolicyMode,
  reasonCode: HealthMemoryPolicyFlagReasonCode,
  options: { rolloutBucket?: number; productionAllowed?: boolean } = {},
): HealthMemoryPolicyFlagResolution {
  return {
    flagId: HEALTH_MEMORY_POLICY.flagId,
    flagVersion: HEALTH_MEMORY_POLICY.flagVersion,
    requestedMode,
    effectiveMode: "disabled",
    defaultMode: "disabled",
    reasonCode,
    ...(options.rolloutBucket !== undefined ? { rolloutBucket: options.rolloutBucket } : {}),
    productionAllowed: options.productionAllowed ?? false,
  };
}

function selected(
  reasonCode: HealthMemoryPolicyFlagReasonCode,
  options: { requestedMode: HealthMemoryPolicyMode; rolloutBucket?: number; productionAllowed: boolean },
): HealthMemoryPolicyFlagResolution {
  return {
    flagId: HEALTH_MEMORY_POLICY.flagId,
    flagVersion: HEALTH_MEMORY_POLICY.flagVersion,
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

export function computeHealthMemoryPolicyCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${HEALTH_MEMORY_POLICY.flagId}:${HEALTH_MEMORY_POLICY.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolveHealthMemoryPolicyFlag(input: {
  env: HealthMemoryEnvironmentMap;
  cohortKey?: string;
  userRef?: string;
}): HealthMemoryPolicyFlagResolution {
  const rawMode = input.env[HEALTH_MEMORY_POLICY_ENV.mode];
  if (rawMode === undefined || rawMode === "") {
    return disabled("disabled", "health_memory_policy_default_disabled");
  }
  if (rawMode !== rawMode.trim() || (rawMode !== "disabled" && rawMode !== "pilot")) {
    return disabled("disabled", "health_memory_policy_mode_invalid");
  }
  const requestedMode = rawMode as HealthMemoryPolicyMode;
  if (requestedMode === "disabled") {
    return disabled(requestedMode, "health_memory_policy_disabled_requested");
  }

  const environment = environmentClass(input.env[HEALTH_MEMORY_POLICY_ENV.environment]);
  if (!environment) return disabled(requestedMode, "health_memory_policy_environment_invalid");
  const productionAllowed = environment !== "production" ||
    input.env[HEALTH_MEMORY_POLICY_ENV.allowProduction] === "true";
  if (!productionAllowed) {
    return disabled(requestedMode, "health_memory_policy_production_not_authorized", { productionAllowed });
  }

  const deny = parseUserList(input.env[HEALTH_MEMORY_POLICY_ENV.denyUsers]);
  if (!deny.ok) {
    return disabled(requestedMode, "health_memory_policy_mode_invalid", { productionAllowed });
  }
  const allow = parseUserList(input.env[HEALTH_MEMORY_POLICY_ENV.allowUsers]);
  if (!allow.ok) {
    return disabled(requestedMode, "health_memory_policy_mode_invalid", { productionAllowed });
  }

  const userRef = input.userRef ?? "";
  if (userRef && deny.values.has(userRef)) {
    return disabled(requestedMode, "health_memory_policy_denied_user", { productionAllowed });
  }
  if (userRef && allow.values.has(userRef)) {
    return selected("health_memory_policy_allowed_user", { requestedMode, productionAllowed });
  }

  const rollout = parseRollout(input.env[HEALTH_MEMORY_POLICY_ENV.rolloutBasisPoints]);
  if (rollout === null) {
    return disabled(requestedMode, "health_memory_policy_rollout_invalid", { productionAllowed });
  }
  const cohortKey = input.cohortKey;
  if (!cohortKey || cohortKey !== cohortKey.trim() || cohortKey.length > MAX_COHORT_KEY_LENGTH) {
    return disabled(requestedMode, "health_memory_policy_cohort_missing", { productionAllowed });
  }
  const rolloutBucket = computeHealthMemoryPolicyCohortBucket(cohortKey);
  if (rolloutBucket >= rollout) {
    return disabled(requestedMode, "health_memory_policy_cohort_not_selected", {
      rolloutBucket,
      productionAllowed,
    });
  }
  return selected("health_memory_policy_rollout_selected", {
    requestedMode,
    rolloutBucket,
    productionAllowed,
  });
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

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function consentFromProfileDataSharing(value: unknown): HealthMemoryConsent {
  let inert: unknown;
  try {
    inert = descriptorSafeDeepInertClone(value);
  } catch {
    return {
      semanticMemoryReadAllowed: false,
      semanticMemoryWriteAllowed: false,
    };
  }
  const root = asPlainRecord(inert);
  const semantic = asPlainRecord(root.semantic_memory ?? root.semanticMemory);
  const readAllowed = boolFromRecord(
    semantic,
    "read_allowed",
    "readAllowed",
    "semanticMemoryReadAllowed",
  ) || boolFromRecord(root, "semantic_memory_read_allowed", "semanticMemoryReadAllowed");
  const writeAllowed = boolFromRecord(
    semantic,
    "write_allowed",
    "writeAllowed",
    "semanticMemoryWriteAllowed",
  ) || boolFromRecord(root, "semantic_memory_write_allowed", "semanticMemoryWriteAllowed");
  const revokedAt = stringFromRecord(semantic, "revoked_at", "revokedAt") ??
    stringFromRecord(root, "semantic_memory_revoked_at", "semanticMemoryRevokedAt");
  const approvalReference = stringFromRecord(semantic, "approval_reference", "approvalReference") ??
    stringFromRecord(root, "semantic_memory_approval_reference", "semanticMemoryApprovalReference");
  const consentRevision = numberFromRecord(semantic, "revision", "consentRevision") ??
    numberFromRecord(root, "semantic_memory_consent_revision", "semanticMemoryConsentRevision");
  const parsed = healthMemoryConsentSchema.safeParse({
    semanticMemoryReadAllowed: readAllowed,
    semanticMemoryWriteAllowed: writeAllowed,
    ...(consentRevision !== undefined ? { consentRevision } : {}),
    ...(approvalReference !== undefined ? { approvalReference } : {}),
    ...(revokedAt !== undefined ? { revokedAt } : {}),
  });
  return parsed.success
    ? parsed.data
    : {
        semanticMemoryReadAllowed: false,
        semanticMemoryWriteAllowed: false,
      };
}

function reasonForSensitiveCategory(category: HealthMemoryCategory): HealthMemoryPolicyReasonCode | null {
  switch (category) {
    case "restricted_health":
      return "health_memory_policy_restricted_requires_explicit_approval";
    case "mental_health":
      return "health_memory_policy_mental_health_requires_case_approval";
    case "safety_emergency":
      return "health_memory_policy_safety_not_semantic_memory";
    case "care_instruction":
      return "health_memory_policy_care_instruction_not_semantic_authority";
    default:
      return null;
  }
}

function baseDecision(input: HealthMemoryPolicyInput, output: Omit<HealthMemoryPolicyDecision, "policyVersion" | "evaluatedAt" | "decisionDigest" | "category" | "operation" | "target" | "consentRevision" | "approvalReference">): HealthMemoryPolicyDecision {
  const evaluatedAt = input.requestedAt;
  const projection = canonicalContractProjection({
    policyVersion: HEALTH_MEMORY_POLICY.policyVersion,
    category: input.category,
    operation: input.operation,
    target: input.target,
    decision: output.decision,
    reasonCode: output.reasonCode,
    providerDeliveryAllowed: output.providerDeliveryAllowed,
    retainedForAuditOnly: output.retainedForAuditOnly,
    consentRevision: input.consent.consentRevision ?? null,
    approvalReference: input.consent.approvalReference ?? null,
    evaluatedAt,
  });
  return {
    policyVersion: HEALTH_MEMORY_POLICY.policyVersion,
    category: input.category,
    operation: input.operation,
    target: input.target,
    consentRevision: input.consent.consentRevision ?? null,
    approvalReference: input.consent.approvalReference ?? null,
    evaluatedAt,
    decisionDigest: canonicalSha256(HEALTH_MEMORY_POLICY_DECISION_DIGEST_DOMAIN, projection),
    ...output,
  };
}

export function evaluateHealthMemoryPolicy(rawInput: unknown): HealthMemoryPolicyEvaluation {
  let inertInput: unknown;
  try {
    inertInput = descriptorSafeDeepInertClone(rawInput);
  } catch {
    return { ok: false, reasonCode: "health_memory_policy_invalid_input" };
  }
  const parsed = healthMemoryPolicyInputSchema.safeParse(inertInput);
  if (!parsed.success) return { ok: false, reasonCode: "health_memory_policy_invalid_input" };
  const input = parsed.data;

  if (input.consent.revokedAt) {
    return {
      ok: true,
      input,
      decision: baseDecision(input, {
        decision: "deny",
        reasonCode: "health_memory_policy_consent_revoked",
        providerDeliveryAllowed: false,
        retainedForAuditOnly: true,
      }),
    };
  }

  const sensitiveReason = reasonForSensitiveCategory(input.category);
  if (sensitiveReason) {
    return {
      ok: true,
      input,
      decision: baseDecision(input, {
        decision: input.operation === "propose_write" ? "proposal_only" : "deny",
        reasonCode: sensitiveReason,
        providerDeliveryAllowed: false,
        retainedForAuditOnly: true,
      }),
    };
  }

  if (!LOW_RISK_CATEGORIES.has(input.category)) {
    return {
      ok: true,
      input,
      decision: baseDecision(input, {
        decision: "deny",
        reasonCode: "health_memory_policy_operation_not_supported",
        providerDeliveryAllowed: false,
        retainedForAuditOnly: true,
      }),
    };
  }

  if (input.target !== "mem0" && input.target !== "postgres") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, {
        decision: "deny",
        reasonCode: "health_memory_policy_target_not_allowed",
        providerDeliveryAllowed: false,
        retainedForAuditOnly: true,
      }),
    };
  }

  if (input.operation === "read") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, input.consent.semanticMemoryReadAllowed
        ? {
            decision: "allow",
            reasonCode: "health_memory_policy_read_allowed",
            providerDeliveryAllowed: false,
            retainedForAuditOnly: false,
          }
        : {
            decision: "deny",
            reasonCode: "health_memory_policy_missing_read_consent",
            providerDeliveryAllowed: false,
            retainedForAuditOnly: true,
          }),
    };
  }

  if (input.operation === "propose_write") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, input.consent.semanticMemoryWriteAllowed
        ? {
            decision: "allow",
            reasonCode: "health_memory_policy_proposal_allowed",
            providerDeliveryAllowed: input.target === "mem0",
            retainedForAuditOnly: false,
          }
        : {
            decision: "approval_required",
            reasonCode: "health_memory_policy_approval_required",
            providerDeliveryAllowed: false,
            retainedForAuditOnly: false,
          }),
    };
  }

  if (input.operation === "deliver_write" || input.operation === "approve_write") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, input.consent.semanticMemoryWriteAllowed
        ? {
            decision: "allow",
            reasonCode: "health_memory_policy_write_allowed",
            providerDeliveryAllowed: input.target === "mem0",
            retainedForAuditOnly: false,
          }
        : {
            decision: "deny",
            reasonCode: "health_memory_policy_missing_write_consent",
            providerDeliveryAllowed: false,
            retainedForAuditOnly: true,
          }),
    };
  }

  if (input.operation === "correct") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, input.consent.semanticMemoryWriteAllowed
        ? {
            decision: "allow",
            reasonCode: "health_memory_policy_write_allowed",
            providerDeliveryAllowed: input.target === "mem0",
            retainedForAuditOnly: false,
          }
        : {
            decision: "deny",
            reasonCode: "health_memory_policy_missing_write_consent",
            providerDeliveryAllowed: false,
            retainedForAuditOnly: true,
          }),
    };
  }

  if (input.operation === "delete") {
    return {
      ok: true,
      input,
      decision: baseDecision(input, {
        decision: "allow",
        reasonCode: "health_memory_policy_write_allowed",
        providerDeliveryAllowed: input.target === "mem0",
        retainedForAuditOnly: false,
      }),
    };
  }

  return {
    ok: true,
    input,
    decision: baseDecision(input, {
      decision: "deny",
      reasonCode: "health_memory_policy_operation_not_supported",
      providerDeliveryAllowed: false,
      retainedForAuditOnly: true,
    }),
  };
}
