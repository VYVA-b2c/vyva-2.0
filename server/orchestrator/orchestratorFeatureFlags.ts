import { createHash } from "node:crypto";
import {
  parseCompatibilityFeatureFlagState,
  type CompatibilityFeatureFlagState,
  type CompatibilityMode,
} from "../../shared/orchestration/compatibilityBoundary.js";
import {
  orchestratorShellModeResolutionSchema,
  type OrchestratorShellModeResolution,
} from "./orchestratorTypes.js";

export const ORCHESTRATOR_SHELL_FLAG = Object.freeze({
  flagId: "flag.orchestrator.shell",
  flagVersion: "1.0.0",
  defaultMode: "legacy_only",
  deliveryAuthority: "legacy_handler",
} as const);

export const ORCHESTRATOR_SHELL_ENV = Object.freeze({
  mode: "VYVA_ORCHESTRATOR_MODE",
  rolloutBasisPoints: "VYVA_ORCHESTRATOR_SHADOW_ROLLOUT_BPS",
  evidenceIds: "VYVA_ORCHESTRATOR_SHADOW_EVIDENCE_IDS",
  rollbackPlanId: "VYVA_ORCHESTRATOR_SHADOW_ROLLBACK_PLAN_ID",
  expiry: "VYVA_ORCHESTRATOR_SHADOW_EXPIRY",
  ownerReference: "VYVA_ORCHESTRATOR_SHADOW_OWNER_REFERENCE",
  auditReference: "VYVA_ORCHESTRATOR_SHADOW_AUDIT_REFERENCE",
  allowProduction: "VYVA_ORCHESTRATOR_SHADOW_ALLOW_PRODUCTION",
  denyBuckets: "VYVA_ORCHESTRATOR_SHADOW_DENY_BUCKETS",
  denyReference: "VYVA_ORCHESTRATOR_SHADOW_DENY_REFERENCE",
  environment: "NODE_ENV",
} as const);

export type OrchestratorEnvironmentMap =
  Readonly<Record<string, string | undefined>>;

const REFERENCE_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@/-]*$/;
const MAX_REFERENCE_LENGTH = 200;
const MAX_COHORT_KEY_LENGTH = 512;
const MAX_CONFIGURATION_LIST_LENGTH = 4_096;
const MAX_EVIDENCE_REFERENCES = 32;
const MAX_DENY_BUCKETS = 256;
const STRICT_UTC_ISO_EXPIRY_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function legacyResolution(
  requestedMode: CompatibilityMode,
  reasonCode: OrchestratorShellModeResolution["reasonCode"],
  activationEligibility: OrchestratorShellModeResolution["activationEligibility"] = "ineligible",
  rolloutBucket?: number,
): OrchestratorShellModeResolution {
  return orchestratorShellModeResolutionSchema.parse({
    requestedMode,
    effectiveMode: "legacy_only",
    defaultMode: "legacy_only",
    activationEligibility,
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

function parseReferenceList(value: string | undefined): string[] | null {
  if (!value || value.length > MAX_CONFIGURATION_LIST_LENGTH) return null;
  const references = value.split(",").map((item) => item.trim());
  if (references.length === 0 ||
    references.length > MAX_EVIDENCE_REFERENCES ||
    references.some((item) => !isReference(item)) ||
    new Set(references).size !== references.length) {
    return null;
  }
  return references;
}

function parseDenyBuckets(
  value: string | undefined,
): { configured: boolean; buckets: Set<number> } | null {
  if (value === undefined || value.trim() === "") {
    return { configured: false, buckets: new Set() };
  }
  if (value.length > MAX_CONFIGURATION_LIST_LENGTH) return null;
  const items = value.split(",").map((item) => item.trim());
  if (items.length > MAX_DENY_BUCKETS ||
    items.some((item) => !/^\d{1,5}$/.test(item)) ||
    new Set(items).size !== items.length) return null;
  const buckets = items.map(Number);
  if (buckets.some((bucket) => bucket < 0 || bucket > 9_999)) return null;
  return { configured: true, buckets: new Set(buckets) };
}

function resolveEnvironmentClass(
  value: string | undefined,
): CompatibilityFeatureFlagState["environmentClass"] | null {
  if (value === "development" || value === "local") return "local";
  if (value === "test" || value === "staging" || value === "production") {
    return value;
  }
  return null;
}

export function computeOrchestratorCohortBucket(cohortKey: string): number {
  const digest = createHash("sha256")
    .update(`${ORCHESTRATOR_SHELL_FLAG.flagId}:${ORCHESTRATOR_SHELL_FLAG.flagVersion}:${cohortKey}`)
    .digest();
  return digest.readUInt32BE(0) % 10_000;
}

export function resolveOrchestratorShellMode(input: {
  env: OrchestratorEnvironmentMap;
  now: Date;
  cohortKey?: string;
  parseFeatureFlagState?: typeof parseCompatibilityFeatureFlagState;
}): OrchestratorShellModeResolution {
  const configuredMode = input.env[ORCHESTRATOR_SHELL_ENV.mode];
  if (configuredMode === undefined || configuredMode.trim() === "") {
    return legacyResolution("legacy_only", "orchestrator_shell_legacy_default");
  }

  const mode = configuredMode.trim();
  if (![
    "legacy_only",
    "shadow_compare",
    "candidate_delivery",
    "authoritative",
  ].includes(mode)) {
    return legacyResolution("legacy_only", "orchestrator_shell_mode_invalid");
  }

  const requestedMode = mode as CompatibilityMode;
  if (requestedMode === "legacy_only") {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_legacy_requested",
      "eligible",
    );
  }
  if (requestedMode === "candidate_delivery" ||
    requestedMode === "authoritative") {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_future_mode_blocked",
      "future_contract_required",
    );
  }

  const rolloutRaw = input.env[ORCHESTRATOR_SHELL_ENV.rolloutBasisPoints];
  if (!rolloutRaw || !/^\d{1,5}$/.test(rolloutRaw.trim())) {
    return legacyResolution(requestedMode, "orchestrator_shell_rollout_invalid");
  }
  const rolloutBasisPoints = Number(rolloutRaw);
  if (rolloutBasisPoints < 1 || rolloutBasisPoints > 10_000) {
    return legacyResolution(requestedMode, "orchestrator_shell_rollout_invalid");
  }

  const cohortKey = input.cohortKey?.trim();
  if (!cohortKey || cohortKey.length > MAX_COHORT_KEY_LENGTH) {
    return legacyResolution(requestedMode, "orchestrator_shell_cohort_missing");
  }

  if (!(input.now instanceof Date) || !Number.isFinite(input.now.getTime())) {
    return legacyResolution(requestedMode, "orchestrator_shell_expiry_missing");
  }

  const environmentClass = resolveEnvironmentClass(
    input.env[ORCHESTRATOR_SHELL_ENV.environment],
  );
  if (!environmentClass) {
    return legacyResolution(requestedMode, "orchestrator_shell_environment_invalid");
  }

  const evidenceIds = parseReferenceList(
    input.env[ORCHESTRATOR_SHELL_ENV.evidenceIds],
  );
  if (!evidenceIds) {
    return legacyResolution(requestedMode, "orchestrator_shell_evidence_missing");
  }

  const rollbackPlanId =
    input.env[ORCHESTRATOR_SHELL_ENV.rollbackPlanId]?.trim();
  if (!isReference(rollbackPlanId)) {
    return legacyResolution(requestedMode, "orchestrator_shell_rollback_missing");
  }

  const expiryRaw = input.env[ORCHESTRATOR_SHELL_ENV.expiry];
  if (!expiryRaw) {
    return legacyResolution(requestedMode, "orchestrator_shell_expiry_missing");
  }
  if (!STRICT_UTC_ISO_EXPIRY_PATTERN.test(expiryRaw)) {
    return legacyResolution(requestedMode, "orchestrator_shell_expiry_missing");
  }
  const expiry = new Date(expiryRaw);
  if (!Number.isFinite(expiry.getTime()) ||
    expiry.toISOString() !== expiryRaw) {
    return legacyResolution(requestedMode, "orchestrator_shell_expiry_missing");
  }
  if (expiry.getTime() <= input.now.getTime()) {
    return legacyResolution(requestedMode, "orchestrator_shell_expired");
  }

  const ownerReference =
    input.env[ORCHESTRATOR_SHELL_ENV.ownerReference]?.trim();
  if (!isReference(ownerReference)) {
    return legacyResolution(requestedMode, "orchestrator_shell_owner_missing");
  }

  const auditReference =
    input.env[ORCHESTRATOR_SHELL_ENV.auditReference]?.trim();
  if (!isReference(auditReference)) {
    return legacyResolution(requestedMode, "orchestrator_shell_audit_missing");
  }

  const denyConfiguration = parseDenyBuckets(
    input.env[ORCHESTRATOR_SHELL_ENV.denyBuckets],
  );
  const denyReference =
    input.env[ORCHESTRATOR_SHELL_ENV.denyReference]?.trim();
  if (!denyConfiguration ||
    (denyConfiguration.configured && !isReference(denyReference)) ||
    (!denyConfiguration.configured && denyReference !== undefined &&
      denyReference !== "")) {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_deny_configuration_invalid",
    );
  }

  if (environmentClass === "production" &&
    input.env[ORCHESTRATOR_SHELL_ENV.allowProduction] !== "true") {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_production_not_authorized",
    );
  }

  let rolloutBucket: number;
  try {
    rolloutBucket = computeOrchestratorCohortBucket(cohortKey);
  } catch {
    return legacyResolution(requestedMode, "orchestrator_shell_resolution_failed");
  }

  if (denyConfiguration.buckets.has(rolloutBucket)) {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_deny_list_matched",
      "ineligible",
      rolloutBucket,
    );
  }
  if (rolloutBucket >= rolloutBasisPoints) {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_cohort_not_selected",
      "ineligible",
      rolloutBucket,
    );
  }

  try {
    const task5FeatureFlagState = (
      input.parseFeatureFlagState ?? parseCompatibilityFeatureFlagState
    )({
      flagId: ORCHESTRATOR_SHELL_FLAG.flagId,
      flagVersion: ORCHESTRATOR_SHELL_FLAG.flagVersion,
      defaultMode: ORCHESTRATOR_SHELL_FLAG.defaultMode,
      requestedMode,
      effectiveMode: "shadow_compare",
      environmentClass,
      audienceClass: "orchestrator_shell_cohort",
      percentageBasisPoints: rolloutBasisPoints,
      ...(denyConfiguration.configured
        ? { denyListReference: denyReference }
        : {}),
      denyListMatched: false,
      prerequisiteEvidenceIds: evidenceIds,
      rollbackPlanId,
      expiry: expiry.toISOString(),
      ownerReference,
      auditReference,
      nonExecutable: true,
    });

    return orchestratorShellModeResolutionSchema.parse({
      requestedMode,
      effectiveMode: "shadow_compare",
      defaultMode: "legacy_only",
      activationEligibility: "eligible",
      reasonCode: "orchestrator_shell_shadow_selected",
      rolloutBucket,
      task5FeatureFlagState,
      nonExecutable: true,
    });
  } catch {
    return legacyResolution(
      requestedMode,
      "orchestrator_shell_task5_flag_invalid",
      "ineligible",
      rolloutBucket,
    );
  }
}
