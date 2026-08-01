export const CROSS_PILLAR_PRIMARY_ACTION_IDS = [
  "health-symptoms", "health-vitals", "health-meds", "health-doctor",
  "health-prevention", "health-visual-scan", "mind-memory", "mind-reflexes",
  "mind-focus", "mind-senses", "community-friends", "community-experts",
  "community-share", "community-activities", "concierge-home", "concierge-care",
  "concierge-order", "concierge-book",
] as const;

export type CrossPillarPrimaryActionId = (typeof CROSS_PILLAR_PRIMARY_ACTION_IDS)[number];

export const CROSS_PILLAR_TOOL_FAMILIES = [
  "routing", "email", "phone", "booking", "provider_contact", "search",
  "task_creation", "upload", "notification",
] as const;

export type CrossPillarToolFamily = (typeof CROSS_PILLAR_TOOL_FAMILIES)[number];
export type CrossPillarToolReadinessStatus =
  | "ready"
  | "setup_needed"
  | "temporarily_unavailable"
  | "manual_help_required";

export type CrossPillarToolEvidence = {
  family: CrossPillarToolFamily;
  status: CrossPillarToolReadinessStatus;
  reason?: string;
  checkedAt?: string;
  adapter?: string;
};

export type CrossPillarActionToolReadiness = {
  actionId: CrossPillarPrimaryActionId;
  required: CrossPillarToolFamily[];
  status: CrossPillarToolReadinessStatus;
  blockers: CrossPillarToolEvidence[];
  externalConfirmationRequired: boolean;
  fallbackPath: string;
};

type Requirement = {
  tools: CrossPillarToolFamily[];
  externalConfirmationRequired?: boolean;
  fallbackPath: string;
};

export const CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS: Record<CrossPillarPrimaryActionId, Requirement> = {
  "health-symptoms": { tools: ["routing", "task_creation"], fallbackPath: "/health" },
  "health-vitals": { tools: ["routing", "task_creation"], fallbackPath: "/health" },
  "health-meds": { tools: ["routing", "notification", "task_creation"], fallbackPath: "/meds" },
  "health-doctor": { tools: ["routing", "provider_contact", "booking", "phone", "email", "task_creation"], externalConfirmationRequired: true, fallbackPath: "/onboarding/profile/providers?focus=doctor_clinic" },
  "health-prevention": { tools: ["routing", "notification"], fallbackPath: "/health/prevention" },
  "health-visual-scan": { tools: ["routing", "upload", "task_creation"], fallbackPath: "/health" },
  "mind-memory": { tools: ["routing", "task_creation"], fallbackPath: "/memory-games" },
  "mind-reflexes": { tools: ["routing", "task_creation"], fallbackPath: "/attention-boosters" },
  "mind-focus": { tools: ["routing", "task_creation"], fallbackPath: "/executive-function" },
  "mind-senses": { tools: ["routing", "task_creation"], fallbackPath: "/senses" },
  "community-friends": { tools: ["routing", "search", "task_creation"], fallbackPath: "/social-rooms" },
  "community-experts": { tools: ["routing", "search", "provider_contact", "task_creation"], fallbackPath: "/social-rooms" },
  "community-share": { tools: ["routing", "upload", "task_creation"], fallbackPath: "/social-rooms/share" },
  "community-activities": { tools: ["routing", "search", "task_creation"], fallbackPath: "/social-rooms/activities" },
  "concierge-home": { tools: ["routing", "search", "provider_contact", "phone", "email", "task_creation"], externalConfirmationRequired: true, fallbackPath: "/concierge" },
  "concierge-care": { tools: ["routing", "search", "provider_contact", "phone", "email", "task_creation"], externalConfirmationRequired: true, fallbackPath: "/concierge" },
  "concierge-order": { tools: ["routing", "search", "provider_contact", "booking", "task_creation"], externalConfirmationRequired: true, fallbackPath: "/concierge/shopping" },
  "concierge-book": { tools: ["routing", "search", "provider_contact", "booking", "phone", "email", "task_creation"], externalConfirmationRequired: true, fallbackPath: "/concierge" },
};

const STATUS_PRIORITY: Record<CrossPillarToolReadinessStatus, number> = {
  ready: 0,
  setup_needed: 1,
  temporarily_unavailable: 2,
  manual_help_required: 3,
};

export function evaluateCrossPillarActionToolReadiness(input: {
  actionId: CrossPillarPrimaryActionId;
  evidence?: Partial<Record<CrossPillarToolFamily, CrossPillarToolEvidence>>;
}): CrossPillarActionToolReadiness {
  const requirement = CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS[input.actionId];
  const blockers = requirement.tools
    .map((family) => input.evidence?.[family] ?? {
      family,
      status: "setup_needed" as const,
      reason: "Readiness has not been verified.",
    })
    .filter((item) => item.status !== "ready");
  const status = blockers.reduce<CrossPillarToolReadinessStatus>(
    (current, item) => STATUS_PRIORITY[item.status] > STATUS_PRIORITY[current] ? item.status : current,
    "ready",
  );
  return {
    actionId: input.actionId,
    required: [...requirement.tools],
    status,
    blockers,
    externalConfirmationRequired: requirement.externalConfirmationRequired === true,
    fallbackPath: requirement.fallbackPath,
  };
}

export function canClaimCrossPillarExternalSuccess(input: {
  readiness: CrossPillarActionToolReadiness;
  externalConfirmationId?: string | null;
}): boolean {
  if (!input.readiness.externalConfirmationRequired) return input.readiness.status === "ready";
  return input.readiness.status === "ready" && Boolean(input.externalConfirmationId?.trim());
}
