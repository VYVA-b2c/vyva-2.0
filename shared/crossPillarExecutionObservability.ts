import { z } from "zod";
import {
  CROSS_PILLAR_PRIMARY_ACTION_IDS,
  CROSS_PILLAR_TOOL_FAMILIES,
  type CrossPillarToolFamily,
} from "./crossPillarToolReadiness";

export const CROSS_PILLAR_EXECUTION_OUTCOMES = [
  "started",
  "succeeded",
  "failed",
  "timed_out",
  "duplicate",
  "blocked",
  "fallback",
  "resumed",
  "cancelled",
] as const;

export type CrossPillarExecutionOutcome = (typeof CROSS_PILLAR_EXECUTION_OUTCOMES)[number];

export const crossPillarExecutionAttemptSchema = z.object({
  handoffId: z.string().min(1).max(160),
  attemptNumber: z.number().int().min(1).max(100),
  actionId: z.enum(CROSS_PILLAR_PRIMARY_ACTION_IDS),
  pillar: z.enum(["health", "mind", "community", "concierge"]),
  workflowReference: z.string().min(1).max(160),
  toolFamilies: z.array(z.enum(CROSS_PILLAR_TOOL_FAMILIES)).max(CROSS_PILLAR_TOOL_FAMILIES.length),
  confirmationId: z.string().trim().min(1).max(200).optional(),
  outcome: z.enum(CROSS_PILLAR_EXECUTION_OUTCOMES),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).max(86_400_000).optional(),
  fallbackPath: z.string().max(500).optional(),
  fallbackReason: z.string().max(500).optional(),
  idempotencyKey: z.string().min(1).max(200),
  retryOfAttemptId: z.string().uuid().optional(),
  whatHappened: z.string().max(500).optional(),
  whatRemains: z.string().max(500).optional(),
  errorCode: z.string().max(120).optional(),
}).strict();

export type CrossPillarExecutionAttemptInput = z.infer<typeof crossPillarExecutionAttemptSchema>;

export type CrossPillarExecutionAttemptSnapshot = CrossPillarExecutionAttemptInput & {
  id: string;
  createdAt: string;
};

export type CrossPillarToolHealth = {
  family: CrossPillarToolFamily;
  attempts: number;
  failures: number;
  status: "healthy" | "temporarily_degraded";
  reason?: string;
};

const FAILURE_OUTCOMES = new Set<CrossPillarExecutionOutcome>(["failed", "timed_out"]);

export function summarizeCrossPillarToolHealth(
  attempts: CrossPillarExecutionAttemptSnapshot[],
): CrossPillarToolHealth[] {
  return CROSS_PILLAR_TOOL_FAMILIES.map((family) => {
    const recent = attempts
      .filter((attempt) => attempt.toolFamilies.includes(family))
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 5);
    const failures = recent.filter((attempt) => FAILURE_OUTCOMES.has(attempt.outcome)).length;
    const degraded = recent.length >= 3 && failures >= 3;
    return {
      family,
      attempts: recent.length,
      failures,
      status: degraded ? "temporarily_degraded" : "healthy",
      reason: degraded
        ? `${failures} of the last ${recent.length} executions failed or timed out.`
        : undefined,
    };
  });
}

export function buildCrossPillarExecutionReceipt(input: {
  outcome: CrossPillarExecutionOutcome;
  actionLabel: string;
  confirmationId?: string;
  fallbackReason?: string;
}): { whatHappened: string; whatRemains: string } {
  if (input.outcome === "succeeded") {
    return {
      whatHappened: `${input.actionLabel} completed${input.confirmationId ? ` (${input.confirmationId})` : ""}.`,
      whatRemains: "Nothing else is needed.",
    };
  }
  if (input.outcome === "duplicate") {
    return {
      whatHappened: `${input.actionLabel} was already completed. Nothing was sent twice.`,
      whatRemains: "You can review the existing confirmation.",
    };
  }
  if (input.outcome === "timed_out") {
    return {
      whatHappened: `${input.actionLabel} took too long and was stopped safely.`,
      whatRemains: "Try again or continue with the safe alternative.",
    };
  }
  if (input.outcome === "fallback" || input.outcome === "blocked") {
    return {
      whatHappened: `${input.actionLabel} could not use the preferred tool.`,
      whatRemains: input.fallbackReason || "Continue with the safe alternative.",
    };
  }
  if (input.outcome === "failed") {
    return {
      whatHappened: `${input.actionLabel} did not complete.`,
      whatRemains: input.fallbackReason || "Try again when you are ready.",
    };
  }
  return {
    whatHappened: `${input.actionLabel} is in progress.`,
    whatRemains: "VYVA will show the next step here.",
  };
}
