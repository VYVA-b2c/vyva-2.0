import {
  CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS,
  CROSS_PILLAR_TOOL_FAMILIES,
  type CrossPillarPrimaryActionId,
  type CrossPillarToolEvidence,
  type CrossPillarToolFamily,
} from "./crossPillarToolReadiness";
import type { CrossPillarExecutionAttemptSnapshot } from "./crossPillarExecutionObservability";

export const CROSS_PILLAR_TOOL_CERTIFICATION_STATUSES = [
  "certified",
  "degraded",
  "not_tested",
] as const;

export type CrossPillarToolCertificationStatus =
  (typeof CROSS_PILLAR_TOOL_CERTIFICATION_STATUSES)[number];

export type CrossPillarToolCertification = {
  family: CrossPillarToolFamily;
  status: CrossPillarToolCertificationStatus;
  certifiedAt?: string;
  lastAttemptAt?: string;
  externalReferenceVerified: boolean;
  reason: string;
};

export const CROSS_PILLAR_PILLAR_SMOKE_CONTRACTS = [
  { pillar: "health", actionId: "health-doctor" },
  { pillar: "mind", actionId: "mind-memory" },
  { pillar: "community", actionId: "community-experts" },
  { pillar: "concierge", actionId: "concierge-book" },
] as const satisfies ReadonlyArray<{
  pillar: "health" | "mind" | "community" | "concierge";
  actionId: CrossPillarPrimaryActionId;
}>;

export type CrossPillarPillarCertification = {
  pillar: (typeof CROSS_PILLAR_PILLAR_SMOKE_CONTRACTS)[number]["pillar"];
  actionId: CrossPillarPrimaryActionId;
  status: CrossPillarToolCertificationStatus;
  requiredFamilies: CrossPillarToolFamily[];
  blockingFamilies: CrossPillarToolFamily[];
  reason: string;
};

const REFERENCE_REQUIRED_FAMILIES = new Set<CrossPillarToolFamily>([
  "email",
  "phone",
  "booking",
  "provider_contact",
  "upload",
]);

const FAILURE_OUTCOMES = new Set(["failed", "timed_out", "blocked"]);

export function buildCrossPillarToolCertifications(input: {
  evidence: Partial<Record<CrossPillarToolFamily, CrossPillarToolEvidence>>;
  attempts: CrossPillarExecutionAttemptSnapshot[];
  now?: Date;
  maxAgeDays?: number;
}): CrossPillarToolCertification[] {
  const now = input.now ?? new Date();
  const maxAgeMs = (input.maxAgeDays ?? 30) * 24 * 60 * 60 * 1000;
  const cutoff = now.getTime() - maxAgeMs;

  return CROSS_PILLAR_TOOL_FAMILIES.map((family) => {
    const readiness = input.evidence[family];
    const attempts = input.attempts
      .filter((attempt) => (
        // A workflow-level attempt may list several possible dependencies.
        // Only single-family evidence proves which adapter actually executed.
        attempt.toolFamilies.length === 1
        &&
        attempt.toolFamilies.includes(family)
        && new Date(attempt.startedAt).getTime() >= cutoff
      ))
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
    const lastAttemptAt = attempts[0]?.startedAt;

    if (readiness?.status === "temporarily_unavailable" || readiness?.status === "manual_help_required") {
      return {
        family,
        status: "degraded",
        lastAttemptAt,
        externalReferenceVerified: false,
        reason: readiness.reason || "The configured adapter is not currently operational.",
      };
    }

    if (readiness?.status !== "ready") {
      return {
        family,
        status: "not_tested",
        lastAttemptAt,
        externalReferenceVerified: false,
        reason: readiness?.reason || "The adapter must be configured before it can be certified.",
      };
    }

    const recentFailures = attempts.filter((attempt) => FAILURE_OUTCOMES.has(attempt.outcome));
    if (recentFailures.length >= 3 && recentFailures.length >= attempts.length / 2) {
      return {
        family,
        status: "degraded",
        lastAttemptAt,
        externalReferenceVerified: false,
        reason: `${recentFailures.length} recent executions failed, timed out, or were blocked.`,
      };
    }

    const successful = attempts.find((attempt) => (
      attempt.outcome === "succeeded"
      && (!REFERENCE_REQUIRED_FAMILIES.has(family) || Boolean(attempt.confirmationId?.trim()))
    ));
    if (successful) {
      return {
        family,
        status: "certified",
        certifiedAt: successful.finishedAt ?? successful.startedAt,
        lastAttemptAt,
        externalReferenceVerified: REFERENCE_REQUIRED_FAMILIES.has(family)
          ? Boolean(successful.confirmationId?.trim())
          : true,
        reason: REFERENCE_REQUIRED_FAMILIES.has(family)
          ? "A recent successful execution returned an external reference."
          : "A recent successful execution completed through this adapter.",
      };
    }

    const missingReference = attempts.some((attempt) => attempt.outcome === "succeeded")
      && REFERENCE_REQUIRED_FAMILIES.has(family);
    return {
      family,
      status: "not_tested",
      lastAttemptAt,
      externalReferenceVerified: false,
      reason: missingReference
        ? "A successful execution was recorded without the external reference required for certification."
        : "Configured, but no recent successful execution has certified this adapter.",
    };
  });
}

export function buildCrossPillarPillarCertifications(
  certifications: CrossPillarToolCertification[],
): CrossPillarPillarCertification[] {
  const byFamily = new Map(certifications.map((item) => [item.family, item]));

  return CROSS_PILLAR_PILLAR_SMOKE_CONTRACTS.map(({ pillar, actionId }) => {
    const requiredFamilies = [...CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS[actionId].tools];
    const blocking = requiredFamilies
      .map((family) => byFamily.get(family))
      .filter((item): item is CrossPillarToolCertification => item?.status !== "certified");
    const degraded = blocking.filter((item) => item.status === "degraded");
    const status: CrossPillarToolCertificationStatus = degraded.length > 0
      ? "degraded"
      : blocking.length > 0
        ? "not_tested"
        : "certified";

    return {
      pillar,
      actionId,
      status,
      requiredFamilies,
      blockingFamilies: blocking.map((item) => item.family),
      reason: status === "certified"
        ? "The representative deployed flow has certified every required adapter."
        : status === "degraded"
          ? `Adapter problems currently block ${degraded.map((item) => item.family).join(", ")}.`
          : `Live certification is still needed for ${blocking.map((item) => item.family).join(", ")}.`,
    };
  });
}
