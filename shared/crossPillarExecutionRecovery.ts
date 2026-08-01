import type {
  CrossPillarActionToolReadiness,
  CrossPillarPrimaryActionId,
  CrossPillarToolFamily,
} from "./crossPillarToolReadiness";

export const CROSS_PILLAR_RECOVERY_ACTIONS = [
  "retry",
  "choose_provider",
  "continue_manual",
  "save_later",
] as const;

export type CrossPillarRecoveryAction = (typeof CROSS_PILLAR_RECOVERY_ACTIONS)[number];
export type CrossPillarRecoveryFailureKind =
  | "transient_technical"
  | "provider_unavailable"
  | "confirmation_required"
  | "manual_required";

export type CrossPillarRecoveryPlan = {
  kind: CrossPillarRecoveryFailureKind;
  actions: CrossPillarRecoveryAction[];
  autoRetryAllowed: boolean;
  requiresFreshConfirmation: boolean;
};

const EXTERNAL_EFFECT_TOOLS = new Set<CrossPillarToolFamily>([
  "booking",
  "email",
  "phone",
  "provider_contact",
]);

const PROVIDER_ACTIONS = new Set<CrossPillarPrimaryActionId>([
  "health-doctor",
  "community-experts",
  "concierge-home",
  "concierge-care",
  "concierge-order",
  "concierge-book",
]);

function normalizedReason(reason?: string): string {
  return (reason ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

export function classifyCrossPillarRecoveryFailure(input: {
  actionId: CrossPillarPrimaryActionId;
  failureReason?: string;
}): CrossPillarRecoveryFailureKind {
  const reason = normalizedReason(input.failureReason);
  if (
    reason.includes("confirmation")
    || reason.includes("not_confirmed")
    || reason.includes("permission")
  ) {
    return "confirmation_required";
  }
  if (
    reason.includes("provider")
    || reason.includes("vendor")
    || reason.includes("no_option")
    || reason.includes("unavailable_option")
  ) {
    return "provider_unavailable";
  }
  if (
    reason.includes("timeout")
    || reason.includes("network")
    || reason.includes("temporary")
    || reason.includes("connection")
    || reason.includes("service_unavailable")
    || reason.includes("destination_unavailable")
  ) {
    return "transient_technical";
  }
  return PROVIDER_ACTIONS.has(input.actionId) && reason.includes("unavailable")
    ? "provider_unavailable"
    : "manual_required";
}

export function buildCrossPillarRecoveryPlan(input: {
  actionId: CrossPillarPrimaryActionId;
  failureReason?: string;
  toolReadiness: CrossPillarActionToolReadiness;
  automaticRetryCount?: number;
}): CrossPillarRecoveryPlan {
  const kind = classifyCrossPillarRecoveryFailure(input);
  const hasProviderChoice = PROVIDER_ACTIONS.has(input.actionId);
  const hasExternalEffect = input.toolReadiness.required.some((family) =>
    EXTERNAL_EFFECT_TOOLS.has(family),
  );
  const requiresFreshConfirmation =
    input.toolReadiness.externalConfirmationRequired || hasExternalEffect;
  const autoRetryAllowed =
    kind === "transient_technical"
    && !requiresFreshConfirmation
    && (input.automaticRetryCount ?? 0) < 1;

  const actions: CrossPillarRecoveryAction[] = [];
  if (kind === "transient_technical" || kind === "confirmation_required") {
    actions.push("retry");
  }
  if (hasProviderChoice && (kind === "provider_unavailable" || kind === "manual_required")) {
    actions.push("choose_provider");
  }
  actions.push("continue_manual", "save_later");

  return {
    kind,
    actions: [...new Set(actions)],
    autoRetryAllowed,
    requiresFreshConfirmation,
  };
}
