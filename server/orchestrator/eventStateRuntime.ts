import { randomUUID } from "node:crypto";
import {
  ORCHESTRATOR_SHELL_ROUTE_ID,
  type EventStateShellObservationInput,
  type OrchestratorTaskScheduler,
} from "./orchestratorTypes.js";
import {
  resolveEventStateShadowMode,
  type EventStateShadowFlagResolution,
} from "./eventStateFeatureFlags.js";
import {
  disabledTelemetryRecord,
  emitEventStateTelemetry,
  EVENT_STATE_TELEMETRY_SCHEMA_VERSION,
  type EventStateTelemetryRecord,
} from "./eventStateTelemetry.js";
import { normalizeShellDeliveryEvent } from "./interactionEventRuntime.js";
import {
  defaultEventStateCompatibilityStore,
  type EventStateCompatibilityStore,
} from "./eventStatePersistence.js";
import { descriptorSafeDeepInertClone } from "./eventStateCanonicalJson.js";

export const DEFAULT_EVENT_STATE_SHADOW_TIMEOUT_MS = 50;
export const MAX_EVENT_STATE_SHADOW_TIMEOUT_MS = 250;

type EventStateTelemetryEmitter = (record: EventStateTelemetryRecord) => void | Promise<void>;

export type EventStateRuntimeDependencies = {
  flagResolver?: typeof resolveEventStateShadowMode;
  telemetryEmitter?: EventStateTelemetryEmitter;
  taskScheduler?: OrchestratorTaskScheduler;
  store?: EventStateCompatibilityStore;
  currentTime?: () => Date;
  idFactory?: () => string;
  env?: Readonly<Record<string, string | undefined>>;
  timeoutMs?: number;
};

function clampTimeout(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) return DEFAULT_EVENT_STATE_SHADOW_TIMEOUT_MS;
  return Math.min(Math.floor(value), MAX_EVENT_STATE_SHADOW_TIMEOUT_MS);
}

function latencyBucket(startedAt: number): EventStateTelemetryRecord["latencyBucket"] {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 10) return "lt_10ms";
  if (elapsed < 50) return "lt_50ms";
  if (elapsed < 100) return "lt_100ms";
  if (elapsed < 250) return "lt_250ms";
  return "gte_250ms";
}

function safeId(factory: () => string): string {
  try {
    const value = factory();
    return value && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value) ? value : randomUUID();
  } catch {
    return randomUUID();
  }
}

function safeNow(provider: () => Date): Date | null {
  try {
    const value = provider();
    return value instanceof Date && Number.isFinite(value.getTime()) ? value : null;
  } catch {
    return null;
  }
}

function safeTelemetry(emitter: EventStateTelemetryEmitter, record: EventStateTelemetryRecord): void {
  try {
    void Promise.resolve(emitter(record)).catch(() => {});
  } catch {
    // Task 7 telemetry is non-authoritative.
  }
}

async function runBoundedTask7Emission(input: {
  store: EventStateCompatibilityStore;
  rawEvent: unknown;
  timeoutMs: number;
}): Promise<{
  outcome: EventStateTelemetryRecord["persistenceOutcome"];
  errorClassification: EventStateTelemetryRecord["errorClassification"];
  eventType?: string;
  channel?: string;
}> {
  const normalized = normalizeShellDeliveryEvent(input.rawEvent);
  if (!normalized.ok) {
    return { outcome: "rejected", errorClassification: normalized.error };
  }

  const work = Promise.resolve()
    .then(() => input.store.writeInteractionEvent(normalized.event))
    .then((result) => {
      if (result.outcome === "stored" || result.outcome === "duplicate") {
        return {
          outcome: result.outcome,
          errorClassification: "none" as const,
          eventType: normalized.event.eventType,
          channel: normalized.event.channel,
        };
      }
      return {
        outcome: "rejected" as const,
        errorClassification: result.reason,
        eventType: normalized.event.eventType,
        channel: normalized.event.channel,
      };
    })
    .catch(() => ({
      outcome: "failed" as const,
      errorClassification: "persistence_unavailable" as const,
      eventType: normalized.ok ? normalized.event.eventType : undefined,
      channel: normalized.ok ? normalized.event.channel : undefined,
    }));

  const timeout = new Promise<{ outcome: "timed_out"; errorClassification: "shadow_timeout" }>((resolve) => {
    const timer = setTimeout(() => {
      resolve({ outcome: "timed_out", errorClassification: "shadow_timeout" });
    }, input.timeoutMs);
    timer.unref?.();
  });

  return Promise.race([work, timeout]);
}

function resolveFlag(input: {
  resolver: typeof resolveEventStateShadowMode;
  env: Readonly<Record<string, string | undefined>>;
  now: Date;
  cohortKey?: string;
}): EventStateShadowFlagResolution {
  try {
    return input.resolver({ env: input.env, now: input.now, cohortKey: input.cohortKey });
  } catch {
    return resolveEventStateShadowMode({ env: {}, now: input.now, cohortKey: undefined });
  }
}

export function createEventStateShellObserver(dependencies: EventStateRuntimeDependencies = {}) {
  const flagResolver = dependencies.flagResolver ?? resolveEventStateShadowMode;
  const telemetryEmitter = dependencies.telemetryEmitter ?? emitEventStateTelemetry;
  const taskScheduler = dependencies.taskScheduler ?? ((task) => setImmediate(task));
  const store = dependencies.store ?? defaultEventStateCompatibilityStore;
  const currentTime = dependencies.currentTime ?? (() => new Date());
  const idFactory = dependencies.idFactory ?? randomUUID;
  const env = dependencies.env ?? process.env;
  const timeoutMs = clampTimeout(dependencies.timeoutMs);

  return function observeShellDelivery(input: EventStateShellObservationInput): void {
    let observationInput: EventStateShellObservationInput;
    try {
      observationInput = descriptorSafeDeepInertClone(input) as EventStateShellObservationInput;
    } catch {
      return;
    }

    const startedAt = Date.now();
    const observationId = observationInput.observationId ?? safeId(idFactory);
    if (!observationInput.observation.completed) return;

    const now = safeNow(currentTime);
    if (!now) {
      safeTelemetry(telemetryEmitter, disabledTelemetryRecord({
        observationId,
        reasonCode: "event_state_resolution_failed",
        latencyBucket: latencyBucket(startedAt),
      }));
      return;
    }

    const flag = resolveFlag({ resolver: flagResolver, env, now, cohortKey: observationInput.sessionId ?? observationInput.userId });
    if (flag.effectiveMode !== "shadow_emit") {
      safeTelemetry(telemetryEmitter, disabledTelemetryRecord({
        observationId,
        reasonCode: flag.reasonCode,
        latencyBucket: latencyBucket(startedAt),
      }));
      return;
    }

    if (!observationInput.userId || !observationInput.sessionId || !observationInput.idempotencyReference) {
      safeTelemetry(telemetryEmitter, {
        schemaVersion: EVENT_STATE_TELEMETRY_SCHEMA_VERSION,
        observationId,
        normalizationOutcome: "rejected",
        parserOutcome: "not_attempted",
        persistenceOutcome: "not_attempted",
        duplicateOutcome: "not_checked",
        correlationCompleteness: "incomplete",
        causationCompleteness: "not_checked",
        flowStateTransitionResult: "not_checked",
        activeFlowInvariantResult: "not_checked",
        errorClassification: "normalization_invalid",
        latencyBucket: latencyBucket(startedAt),
        nonExecutable: true,
      });
      return;
    }

    try {
      taskScheduler(() => {
        void runBoundedTask7Emission({
          store,
          timeoutMs,
          rawEvent: {
            idempotencyKey: observationInput.idempotencyReference,
            occurredAt: observationInput.occurredAt,
            receivedAt: observationInput.receivedAt,
            correlationId: observationInput.shellCorrelationId,
            userId: observationInput.userId,
            sessionId: observationInput.sessionId,
            locale: observationInput.locale ?? "en-US",
            inputChannel: observationInput.inputChannel,
            inputKind: observationInput.inputKind,
            statusCode: observationInput.observation.statusCode,
            routeId: ORCHESTRATOR_SHELL_ROUTE_ID,
            ...(observationInput.contentDigest !== undefined ? { contentDigest: observationInput.contentDigest } : {}),
            ...(observationInput.contentLengthBucket !== undefined ? { contentLengthBucket: observationInput.contentLengthBucket } : {}),
            ...(observationInput.responseDigest !== undefined ? { responseDigest: observationInput.responseDigest } : {}),
          },
        }).then((result) => {
          const eventIdentity = {
            ...(result.eventType !== undefined ? { eventType: result.eventType } : {}),
            ...(result.channel !== undefined ? { channel: result.channel } : {}),
          };
          safeTelemetry(telemetryEmitter, {
            schemaVersion: EVENT_STATE_TELEMETRY_SCHEMA_VERSION,
            observationId,
            ...eventIdentity,
            normalizationOutcome: result.errorClassification === "normalization_invalid" ? "rejected" : "accepted",
            parserOutcome: result.errorClassification === "frozen_contract_rejected" ? "rejected" : "accepted",
            persistenceOutcome: result.outcome,
            duplicateOutcome: result.outcome === "duplicate" ? "same_record" : "none",
            correlationCompleteness: "complete",
            causationCompleteness: "complete",
            flowStateTransitionResult: "not_checked",
            activeFlowInvariantResult: "not_checked",
            errorClassification: result.errorClassification,
            latencyBucket: latencyBucket(startedAt),
            nonExecutable: true,
          });
        }).catch(() => {});
      });
    } catch {
      safeTelemetry(telemetryEmitter, {
        schemaVersion: EVENT_STATE_TELEMETRY_SCHEMA_VERSION,
        observationId,
        normalizationOutcome: "not_attempted",
        parserOutcome: "not_attempted",
        persistenceOutcome: "failed",
        duplicateOutcome: "not_checked",
        correlationCompleteness: "not_checked",
        causationCompleteness: "not_checked",
        flowStateTransitionResult: "not_checked",
        activeFlowInvariantResult: "not_checked",
        errorClassification: "persistence_unavailable",
        latencyBucket: latencyBucket(startedAt),
        nonExecutable: true,
      });
    }
  };
}

export const eventStateShellObserver = createEventStateShellObserver();
