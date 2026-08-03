import { randomUUID } from "node:crypto";
import { descriptorSafeDeepInertClone } from "../orchestrator/eventStateCanonicalJson.js";
import {
  proactiveEngagementEvaluationInputSchema,
  type ProactiveEngagementEvaluationInput,
} from "../../shared/engagement/proactiveEngagement.js";
import {
  resolveProactiveEngagementAuditShadowMode,
  type ProactiveEngagementAuditShadowFlagResolution,
} from "./proactiveFeatureFlags.js";
import {
  createProactiveEngagementAudit,
  defaultProactiveEngagementAuditStore,
  type ProactiveEngagementAuditStore,
  type ProactiveEngagementAuditWriteResult,
} from "./proactiveAuditPersistence.js";
import {
  emitProactiveEngagementTelemetry,
  PROACTIVE_ENGAGEMENT_TELEMETRY_SCHEMA_VERSION,
  type ProactiveEngagementTelemetryRecord,
} from "./proactiveTelemetry.js";
import {
  evaluateParsedProactiveEngagementPolicy,
  type ProactivePolicyEvaluationResult,
} from "./proactivePolicy.js";

export const DEFAULT_PROACTIVE_ENGAGEMENT_AUDIT_TIMEOUT_MS = 50;
export const MAX_PROACTIVE_ENGAGEMENT_AUDIT_TIMEOUT_MS = 250;

export type ProactiveEngagementRuntimeOutcome =
  | "disabled"
  | "duplicate"
  | "evaluated_and_stored"
  | "invalid_input"
  | "persistence_failure"
  | "timeout";

export type ProactiveEngagementRuntimeResult = Readonly<{
  outcome: ProactiveEngagementRuntimeOutcome;
  shadowOnly: true;
  nonExecutable: true;
}>;

type FlagResolver = typeof resolveProactiveEngagementAuditShadowMode;
type TelemetryEmitter = (record: ProactiveEngagementTelemetryRecord) => void | Promise<void>;

export type ProactiveEngagementRuntimeDependencies = {
  flagResolver?: FlagResolver;
  store?: ProactiveEngagementAuditStore;
  telemetryEmitter?: TelemetryEmitter;
  currentTime?: () => Date;
  idFactory?: () => string;
  env?: Readonly<Record<string, string | undefined>>;
  timeoutMs?: number;
  monotonicNow?: () => number;
};

function fixedResult(outcome: ProactiveEngagementRuntimeOutcome): ProactiveEngagementRuntimeResult {
  return { outcome, shadowOnly: true, nonExecutable: true };
}

function clampTimeout(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return DEFAULT_PROACTIVE_ENGAGEMENT_AUDIT_TIMEOUT_MS;
  }
  return Math.min(Math.floor(value), MAX_PROACTIVE_ENGAGEMENT_AUDIT_TIMEOUT_MS);
}

function safeNow(provider: () => Date): Date | null {
  try {
    const value = provider();
    return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
  } catch {
    return null;
  }
}

function safeId(provider: () => string): string {
  try {
    const value = provider();
    return value && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value)
      ? value
      : randomUUID();
  } catch {
    return randomUUID();
  }
}

function latencyBucket(startedAt: number, monotonicNow: () => number):
  ProactiveEngagementTelemetryRecord["latencyBucket"] {
  const elapsed = Math.max(0, monotonicNow() - startedAt);
  if (elapsed < 10) return "lt_10ms";
  if (elapsed < 50) return "lt_50ms";
  if (elapsed < 100) return "lt_100ms";
  if (elapsed < 250) return "lt_250ms";
  return "gte_250ms";
}

function safeTelemetry(
  emitter: TelemetryEmitter,
  record: ProactiveEngagementTelemetryRecord,
): void {
  try {
    void Promise.resolve(emitter(record)).catch(() => {});
  } catch {
    // Task 8 telemetry is non-authoritative.
  }
}

function resolveFlag(input: {
  resolver: FlagResolver;
  env: Readonly<Record<string, string | undefined>>;
  now: Date;
  cohortKey: string;
}): ProactiveEngagementAuditShadowFlagResolution {
  try {
    return input.resolver({
      env: input.env,
      now: input.now,
      cohortKey: input.cohortKey,
    });
  } catch {
    return resolveProactiveEngagementAuditShadowMode({
      env: {},
      now: input.now,
      cohortKey: input.cohortKey,
    });
  }
}

async function writeWithTimeout(input: {
  store: ProactiveEngagementAuditStore;
  evaluation: Extract<ProactivePolicyEvaluationResult, { ok: true }>;
  timeoutMs: number;
}): Promise<ProactiveEngagementAuditWriteResult | { outcome: "timed_out" }> {
  const controller = new AbortController();
  const audit = createProactiveEngagementAudit({
    evaluationInput: input.evaluation.input,
    decision: input.evaluation.decision,
    decisionDigest: input.evaluation.decisionDigest,
    idempotencyKey: input.evaluation.idempotencyKey,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ outcome: "timed_out" }>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ outcome: "timed_out" });
    }, input.timeoutMs);
    timer.unref?.();
  });
  const write = Promise.resolve()
    .then(() => input.store.writeAudit(audit, { signal: controller.signal }))
    .catch(() => ({ outcome: "rejected" as const, reason: "persistence_unavailable" as const }));
  const result = await Promise.race([write, timeout]);
  if (timer) clearTimeout(timer);
  write.catch(() => {});
  return result;
}

function telemetryFor(input: {
  observationId: string;
  evaluation: Extract<ProactivePolicyEvaluationResult, { ok: true }>;
  persistence: ProactiveEngagementAuditWriteResult | { outcome: "timed_out" };
  latencyBucket: ProactiveEngagementTelemetryRecord["latencyBucket"];
}): ProactiveEngagementTelemetryRecord {
  const decision = input.evaluation.decision;
  const persistence = input.persistence.outcome === "stored"
    ? "stored"
    : input.persistence.outcome === "duplicate"
    ? "duplicate"
    : input.persistence.outcome === "timed_out"
    ? "timed_out"
    : input.persistence.reason === "semantic_conflict"
    ? "semantic_conflict"
    : "persistence_unavailable";
  const runtimeOutcome = input.persistence.outcome === "stored"
    ? "evaluated_and_stored"
    : input.persistence.outcome === "duplicate"
    ? "duplicate"
    : input.persistence.outcome === "timed_out"
    ? "timeout"
    : "persistence_failure";
  return {
    schemaVersion: PROACTIVE_ENGAGEMENT_TELEMETRY_SCHEMA_VERSION,
    observationId: input.observationId,
    policyVersion: decision.policyVersion,
    runtimeOutcome,
    decision: decision.decision,
    ...(decision.proposedChannel ? { proposedChannel: decision.proposedChannel } : {}),
    reasonCodes: decision.reasonCodes,
    timezoneValid: decision.quietHoursStatus !== "timezone_invalid",
    consentStatus: decision.consentStatus,
    quietHoursStatus: decision.quietHoursStatus,
    limitStatus: decision.limitStatus,
    duplicateStatus: decision.duplicateStatus,
    persistence,
    latencyBucket: input.latencyBucket,
    shadowOnly: true,
    nonExecutable: true,
  };
}

export function createProactiveEngagementShadowObserver(
  dependencies: ProactiveEngagementRuntimeDependencies = {},
) {
  const flagResolver = dependencies.flagResolver ?? resolveProactiveEngagementAuditShadowMode;
  const store = dependencies.store ?? defaultProactiveEngagementAuditStore;
  const telemetryEmitter = dependencies.telemetryEmitter ?? emitProactiveEngagementTelemetry;
  const currentTime = dependencies.currentTime ?? (() => new Date());
  const idFactory = dependencies.idFactory ?? randomUUID;
  const env = dependencies.env ?? process.env;
  const timeoutMs = clampTimeout(dependencies.timeoutMs);
  const monotonicNow = dependencies.monotonicNow ?? Date.now;

  return async function observeProactiveEngagementDue(
    rawInput: unknown,
  ): Promise<ProactiveEngagementRuntimeResult> {
    let inertInput: unknown;
    try {
      inertInput = descriptorSafeDeepInertClone(rawInput);
    } catch {
      return fixedResult("invalid_input");
    }

    const parsed = proactiveEngagementEvaluationInputSchema.safeParse(inertInput);
    if (!parsed.success) return fixedResult("invalid_input");
    const input: ProactiveEngagementEvaluationInput = parsed.data;

    const now = safeNow(currentTime);
    if (!now) return fixedResult("disabled");
    const flag = resolveFlag({
      resolver: flagResolver,
      env,
      now,
      cohortKey: input.scheduleOccurrenceId,
    });
    if (flag.effectiveMode !== "audit_shadow") {
      return fixedResult("disabled");
    }

    const startedAt = monotonicNow();
    const observationId = safeId(idFactory);
    const evaluation = evaluateParsedProactiveEngagementPolicy(input);
    if (!evaluation.ok) return fixedResult("invalid_input");

    const persistence = await writeWithTimeout({ store, evaluation, timeoutMs });
    const record = telemetryFor({
      observationId,
      evaluation,
      persistence,
      latencyBucket: latencyBucket(startedAt, monotonicNow),
    });
    safeTelemetry(telemetryEmitter, record);
    if (persistence.outcome === "stored") return fixedResult("evaluated_and_stored");
    if (persistence.outcome === "duplicate") return fixedResult("duplicate");
    if (persistence.outcome === "timed_out") return fixedResult("timeout");
    return fixedResult("persistence_failure");
  };
}

export const proactiveEngagementShadowObserver =
  createProactiveEngagementShadowObserver();
