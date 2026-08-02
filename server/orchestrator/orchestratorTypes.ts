import type { Request, Response } from "express";
import { z } from "zod";
import {
  compatibilityFeatureFlagStateSchema,
  compatibilityModeSchema,
} from "../../shared/orchestration/compatibilityBoundary.js";

export const ORCHESTRATOR_SHELL_SCHEMA_VERSION = "1.0.0" as const;
export const ORCHESTRATOR_SHELL_ROUTE_ID = "route.api.router.post" as const;
export const ORCHESTRATOR_SHELL_DELIVERY_AUTHORITY = "legacy_handler" as const;

export const orchestratorShellActivationSchema = z.enum([
  "eligible",
  "ineligible",
  "future_contract_required",
]);

export const orchestratorShellReasonCodeSchema = z.enum([
  "orchestrator_shell_legacy_default",
  "orchestrator_shell_legacy_requested",
  "orchestrator_shell_mode_invalid",
  "orchestrator_shell_future_mode_blocked",
  "orchestrator_shell_rollout_invalid",
  "orchestrator_shell_cohort_missing",
  "orchestrator_shell_environment_invalid",
  "orchestrator_shell_evidence_missing",
  "orchestrator_shell_rollback_missing",
  "orchestrator_shell_expiry_missing",
  "orchestrator_shell_expired",
  "orchestrator_shell_owner_missing",
  "orchestrator_shell_audit_missing",
  "orchestrator_shell_deny_configuration_invalid",
  "orchestrator_shell_deny_list_matched",
  "orchestrator_shell_production_not_authorized",
  "orchestrator_shell_cohort_not_selected",
  "orchestrator_shell_task5_flag_invalid",
  "orchestrator_shell_shadow_selected",
  "orchestrator_shell_resolution_failed",
]);

export const orchestratorShellModeResolutionSchema = z.object({
  requestedMode: compatibilityModeSchema,
  effectiveMode: compatibilityModeSchema,
  defaultMode: z.literal("legacy_only"),
  activationEligibility: orchestratorShellActivationSchema,
  reasonCode: orchestratorShellReasonCodeSchema,
  rolloutBucket: z.number().int().min(0).max(9_999).optional(),
  task5FeatureFlagState: compatibilityFeatureFlagStateSchema.optional(),
  nonExecutable: z.literal(true),
}).strict().superRefine((value, context) => {
  if (value.effectiveMode === "candidate_delivery" ||
    value.effectiveMode === "authoritative") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Task 6 cannot enable candidate or authoritative delivery",
    });
  }
  if (value.effectiveMode === "shadow_compare" &&
    !value.task5FeatureFlagState) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Shadow mode requires a validated Task 5 feature-flag state",
    });
  }
});

export type OrchestratorShellModeResolution =
  z.infer<typeof orchestratorShellModeResolutionSchema>;

export const legacyResponseKindSchema = z.enum([
  "array",
  "boolean",
  "null",
  "number",
  "object",
  "string",
  "unknown",
]);
export type LegacyResponseKind = z.infer<typeof legacyResponseKindSchema>;

export const orchestratorLatencyBucketSchema = z.enum([
  "lt_10ms",
  "lt_50ms",
  "lt_100ms",
  "lt_250ms",
  "lt_500ms",
  "lt_1000ms",
  "gte_1000ms",
]);

export const legacyRouterObservationSchema = z.object({
  invocationCount: z.literal(1),
  completed: z.boolean(),
  statusCode: z.number().int().min(100).max(599),
  responseKind: legacyResponseKindSchema,
  responseDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  latencyBucket: orchestratorLatencyBucketSchema,
}).strict();

export type LegacyRouterObservation =
  z.infer<typeof legacyRouterObservationSchema>;

export const shadowComparisonClassificationSchema = z.enum([
  "not_performed",
  "legacy_delivery_observed",
  "shell_observation_failed",
]);

export const shadowOutcomeSchema = z.enum([
  "not_requested",
  "completed",
  "timed_out",
  "failed",
  "schedule_failed",
]);

export const shellErrorClassificationSchema = z.enum([
  "none",
  "flag_resolution_failed",
  "legacy_handler_threw",
  "shadow_failed",
  "shadow_timed_out",
  "shadow_schedule_failed",
]);

export const orchestratorShellDecisionRecordSchema = z.object({
  schemaVersion: z.literal(ORCHESTRATOR_SHELL_SCHEMA_VERSION),
  shellDecisionId: z.string().min(1).max(160)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
  shellCorrelationId: z.string().min(1).max(160)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/),
  routeId: z.literal(ORCHESTRATOR_SHELL_ROUTE_ID),
  modeState: orchestratorShellModeResolutionSchema,
  deliveryAuthority: z.literal(ORCHESTRATOR_SHELL_DELIVERY_AUTHORITY),
  exactOnceLegacyInvocation: z.literal(true),
  legacyResponseStatus: z.number().int().min(100).max(599).optional(),
  legacyResponseDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/).optional(),
  shadowAttempted: z.boolean(),
  shadowOutcome: shadowOutcomeSchema,
  comparisonClassification: shadowComparisonClassificationSchema,
  fallbackRecommendation: z.literal("remain_legacy_only"),
  latencyBucket: orchestratorLatencyBucketSchema.optional(),
  errorClassification: shellErrorClassificationSchema,
  nonExecutable: z.literal(true),
}).strict();

export type OrchestratorShellDecisionRecord =
  z.infer<typeof orchestratorShellDecisionRecordSchema>;

export const shadowEvaluationResultSchema = z.object({
  comparisonClassification: z.literal("legacy_delivery_observed"),
}).strict();

export type ShadowEvaluationResult =
  z.infer<typeof shadowEvaluationResultSchema>;

export type LegacyRouterHandler = (
  req: Request,
  res: Response,
) => unknown | Promise<unknown>;

export type ShadowEvaluationInput = Readonly<{
  shellCorrelationId: string;
  routeId: typeof ORCHESTRATOR_SHELL_ROUTE_ID;
  legacyResponseStatus: number;
  legacyResponseDigest?: string;
  legacyCompleted: boolean;
  latencyBucket: z.infer<typeof orchestratorLatencyBucketSchema>;
  nonExecutable: true;
}>;

export type ShadowEvaluator = (
  input: ShadowEvaluationInput,
  signal: AbortSignal,
) => ShadowEvaluationResult | Promise<ShadowEvaluationResult>;

export type OrchestratorTaskScheduler = (task: () => void) => void;
