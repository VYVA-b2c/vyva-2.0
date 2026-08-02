import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { routerHandler } from "../routes/router.js";
import { resolveOrchestratorShellMode } from "./orchestratorFeatureFlags.js";
import { createLegacyRouterAdapter } from "./legacyRouterAdapter.js";
import { emitOrchestratorTelemetry } from "./orchestratorTelemetry.js";
import {
  ORCHESTRATOR_SHELL_DELIVERY_AUTHORITY,
  ORCHESTRATOR_SHELL_ROUTE_ID,
  ORCHESTRATOR_SHELL_SCHEMA_VERSION,
  orchestratorShellDecisionRecordSchema,
  shadowEvaluationResultSchema,
  type LegacyRouterHandler,
  type LegacyRouterObservation,
  type OrchestratorShellDecisionRecord,
  type OrchestratorShellModeResolution,
  type OrchestratorTaskScheduler,
  type ShadowEvaluationInput,
  type ShadowEvaluator,
} from "./orchestratorTypes.js";

export const DEFAULT_ORCHESTRATOR_SHADOW_TIMEOUT_MS = 50;
export const MAX_ORCHESTRATOR_SHADOW_TIMEOUT_MS = 250;

type FlagResolver = typeof resolveOrchestratorShellMode;
type TelemetryEmitter = (
  record: OrchestratorShellDecisionRecord,
) => void | Promise<void>;

export type OrchestratorRouterDependencies = {
  legacyHandler?: LegacyRouterHandler;
  flagResolver?: FlagResolver;
  shadowEvaluator?: ShadowEvaluator;
  telemetryEmitter?: TelemetryEmitter;
  currentTime?: () => Date;
  idFactory?: () => string;
  taskScheduler?: OrchestratorTaskScheduler;
  shadowTimeoutMs?: number;
  env?: Readonly<Record<string, string | undefined>>;
  monotonicNow?: () => number;
};

const defaultShadowEvaluator: ShadowEvaluator = () => ({
  comparisonClassification: "legacy_delivery_observed",
});

const defaultTaskScheduler: OrchestratorTaskScheduler = (task) => {
  setImmediate(task);
};

function safeId(factory: () => string, fallback: string): string {
  try {
    const value = factory();
    return value && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value)
      ? value
      : fallback;
  } catch {
    return fallback;
  }
}

function safeNow(provider: () => Date): Date | null {
  try {
    const value = provider();
    return value instanceof Date && Number.isFinite(value.getTime())
      ? value
      : null;
  } catch {
    return null;
  }
}

function cohortKeyFor(req: Request): string | undefined {
  if (!req.body || typeof req.body !== "object") return undefined;
  const body = req.body as Record<string, unknown>;
  if (typeof body.session_id === "string" && body.session_id.trim()) {
    return body.session_id;
  }
  if (typeof body.user_id === "string" && body.user_id.trim()) {
    return body.user_id;
  }
  return undefined;
}

function failClosedMode(
  reasonCode: "orchestrator_shell_resolution_failed",
): OrchestratorShellModeResolution {
  return {
    requestedMode: "legacy_only",
    effectiveMode: "legacy_only",
    defaultMode: "legacy_only",
    activationEligibility: "ineligible",
    reasonCode,
    nonExecutable: true,
  };
}

function clampShadowTimeout(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined || value <= 0) {
    return DEFAULT_ORCHESTRATOR_SHADOW_TIMEOUT_MS;
  }
  return Math.min(Math.floor(value), MAX_ORCHESTRATOR_SHADOW_TIMEOUT_MS);
}

function decisionRecord(input: {
  decisionId: string;
  correlationId: string;
  modeState: OrchestratorShellModeResolution;
  observation?: LegacyRouterObservation;
  shadowAttempted: boolean;
  shadowOutcome: OrchestratorShellDecisionRecord["shadowOutcome"];
  comparisonClassification:
    OrchestratorShellDecisionRecord["comparisonClassification"];
  errorClassification:
    OrchestratorShellDecisionRecord["errorClassification"];
}): OrchestratorShellDecisionRecord {
  return orchestratorShellDecisionRecordSchema.parse({
    schemaVersion: ORCHESTRATOR_SHELL_SCHEMA_VERSION,
    shellDecisionId: input.decisionId,
    shellCorrelationId: input.correlationId,
    routeId: ORCHESTRATOR_SHELL_ROUTE_ID,
    modeState: input.modeState,
    deliveryAuthority: ORCHESTRATOR_SHELL_DELIVERY_AUTHORITY,
    exactOnceLegacyInvocation: true,
    ...(input.observation
      ? {
          legacyResponseStatus: input.observation.statusCode,
          legacyResponseDigest: input.observation.responseDigest,
          latencyBucket: input.observation.latencyBucket,
        }
      : {}),
    shadowAttempted: input.shadowAttempted,
    shadowOutcome: input.shadowOutcome,
    comparisonClassification: input.comparisonClassification,
    fallbackRecommendation: "remain_legacy_only",
    errorClassification: input.errorClassification,
    nonExecutable: true,
  });
}

function safelyEmitTelemetry(
  emitter: TelemetryEmitter,
  record: OrchestratorShellDecisionRecord,
): void {
  void Promise.resolve()
    .then(() => emitter(record))
    .catch(() => {});
}

async function runBoundedShadow(
  evaluator: ShadowEvaluator,
  input: ShadowEvaluationInput,
  timeoutMs: number,
): Promise<{
  outcome: "completed" | "timed_out" | "failed";
  comparison: "legacy_delivery_observed" | "shell_observation_failed";
}> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timed_out">((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve("timed_out");
    }, timeoutMs);
    timer.unref?.();
  });
  const evaluation = Promise.resolve()
    .then(() => evaluator(input, controller.signal))
    .then((result) => {
      shadowEvaluationResultSchema.parse(result);
      return "completed" as const;
    })
    .catch(() => "failed" as const);

  const outcome = await Promise.race([evaluation, timeout]);
  if (timer) clearTimeout(timer);
  if (outcome === "completed") {
    return {
      outcome,
      comparison: "legacy_delivery_observed",
    };
  }
  return {
    outcome,
    comparison: "shell_observation_failed",
  };
}

export function createOrchestratorRouterHandler(
  dependencies: OrchestratorRouterDependencies = {},
) {
  const legacyHandler = dependencies.legacyHandler ?? routerHandler;
  const invokeLegacyAdapter = createLegacyRouterAdapter(
    legacyHandler,
    dependencies.monotonicNow,
  );
  const flagResolver = dependencies.flagResolver ?? resolveOrchestratorShellMode;
  const shadowEvaluator =
    dependencies.shadowEvaluator ?? defaultShadowEvaluator;
  const telemetryEmitter =
    dependencies.telemetryEmitter ?? emitOrchestratorTelemetry;
  const currentTime = dependencies.currentTime ?? (() => new Date());
  const idFactory = dependencies.idFactory ?? randomUUID;
  const taskScheduler = dependencies.taskScheduler ?? defaultTaskScheduler;
  const env = dependencies.env ?? process.env;
  const shadowTimeoutMs = clampShadowTimeout(dependencies.shadowTimeoutMs);

  return async function orchestratorRouterHandler(
    req: Request,
    res: Response,
  ): Promise<void> {
    const correlationId = safeId(
      idFactory,
      "orchestrator-shell-correlation-unavailable",
    );
    const decisionId = safeId(
      idFactory,
      "orchestrator-shell-decision-unavailable",
    );

    let modeState: OrchestratorShellModeResolution;
    const now = safeNow(currentTime);
    let resolutionFailed = false;
    try {
      modeState = now
        ? flagResolver({
            env,
            now,
            cohortKey: cohortKeyFor(req),
          })
        : failClosedMode("orchestrator_shell_resolution_failed");
      resolutionFailed = !now;
    } catch {
      modeState = failClosedMode("orchestrator_shell_resolution_failed");
      resolutionFailed = true;
    }

    let legacyInvoked = false;
    const invokeLegacyOnce = async () => {
      if (legacyInvoked) {
        throw new Error("Legacy router exact-once invariant violated");
      }
      legacyInvoked = true;
      return invokeLegacyAdapter(req, res);
    };

    let observation: LegacyRouterObservation;
    try {
      observation = await invokeLegacyOnce();
    } catch (error) {
      try {
        safelyEmitTelemetry(telemetryEmitter, decisionRecord({
          decisionId,
          correlationId,
          modeState,
          shadowAttempted: false,
          shadowOutcome: "not_requested",
          comparisonClassification: "not_performed",
          errorClassification: "legacy_handler_threw",
        }));
      } catch {
        // The original legacy error remains the only propagated error.
      }
      throw error;
    }

    if (modeState.effectiveMode !== "shadow_compare") {
      try {
        safelyEmitTelemetry(telemetryEmitter, decisionRecord({
          decisionId,
          correlationId,
          modeState,
          observation,
          shadowAttempted: false,
          shadowOutcome: "not_requested",
          comparisonClassification: "not_performed",
          errorClassification: resolutionFailed
            ? "flag_resolution_failed"
            : "none",
        }));
      } catch {
        // Telemetry cannot affect the already delivered legacy response.
      }
      return;
    }

    if (!observation.completed) {
      try {
        safelyEmitTelemetry(telemetryEmitter, decisionRecord({
          decisionId,
          correlationId,
          modeState,
          observation,
          shadowAttempted: false,
          shadowOutcome: "not_requested",
          comparisonClassification: "not_performed",
          errorClassification: "none",
        }));
      } catch {
        // A missing legacy response remains unchanged and non-delivering.
      }
      return;
    }

    const shadowInput = Object.freeze({
      shellCorrelationId: correlationId,
      routeId: ORCHESTRATOR_SHELL_ROUTE_ID,
      legacyResponseStatus: observation.statusCode,
      legacyResponseDigest: observation.responseDigest,
      legacyCompleted: observation.completed,
      latencyBucket: observation.latencyBucket,
      nonExecutable: true as const,
    });

    try {
      taskScheduler(() => {
        void runBoundedShadow(
          shadowEvaluator,
          shadowInput,
          shadowTimeoutMs,
        ).then((result) => {
          try {
            safelyEmitTelemetry(telemetryEmitter, decisionRecord({
              decisionId,
              correlationId,
              modeState,
              observation,
              shadowAttempted: true,
              shadowOutcome: result.outcome,
              comparisonClassification: result.comparison,
              errorClassification: result.outcome === "failed"
                ? "shadow_failed"
                : result.outcome === "timed_out"
                ? "shadow_timed_out"
                : "none",
            }));
          } catch {
            // Shadow telemetry remains non-authoritative.
          }
        }).catch(() => {});
      });
    } catch {
      try {
        safelyEmitTelemetry(telemetryEmitter, decisionRecord({
          decisionId,
          correlationId,
          modeState,
          observation,
          shadowAttempted: false,
          shadowOutcome: "schedule_failed",
          comparisonClassification: "shell_observation_failed",
          errorClassification: "shadow_schedule_failed",
        }));
      } catch {
        // The legacy response was already delivered.
      }
    }
  };
}

export const orchestratorRouterHandler =
  createOrchestratorRouterHandler();
