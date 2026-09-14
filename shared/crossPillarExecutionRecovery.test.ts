import { describe, expect, it } from "vitest";
import {
  buildCrossPillarRecoveryPlan,
} from "./crossPillarExecutionRecovery";
import type { CrossPillarActionToolReadiness } from "./crossPillarToolReadiness";

function readiness(
  overrides: Partial<CrossPillarActionToolReadiness> = {},
): CrossPillarActionToolReadiness {
  return {
    actionId: "health-symptoms",
    status: "ready",
    required: ["routing"],
    blockers: [],
    fallbackPath: "/",
    externalConfirmationRequired: false,
    ...overrides,
  };
}

describe("cross-pillar execution recovery policy", () => {
  it("automatically retries one brief internal Health failure", () => {
    const plan = buildCrossPillarRecoveryPlan({
      actionId: "health-symptoms",
      failureReason: "network_error",
      toolReadiness: readiness(),
      automaticRetryCount: 0,
    });

    expect(plan.autoRetryAllowed).toBe(true);
    expect(plan.actions).toEqual(["retry", "continue_manual", "save_later"]);
  });

  it("never automatically repeats a provider contact", () => {
    const plan = buildCrossPillarRecoveryPlan({
      actionId: "health-doctor",
      failureReason: "network_error",
      toolReadiness: readiness({
        required: ["provider_contact"],
        externalConfirmationRequired: true,
      }),
      automaticRetryCount: 0,
    });

    expect(plan.autoRetryAllowed).toBe(false);
    expect(plan.requiresFreshConfirmation).toBe(true);
  });

  it("offers another provider instead of a pointless retry", () => {
    const plan = buildCrossPillarRecoveryPlan({
      actionId: "concierge-home",
      failureReason: "provider_unavailable",
      toolReadiness: readiness({
        required: ["provider_contact"],
        externalConfirmationRequired: true,
      }),
    });

    expect(plan.actions).toEqual(["choose_provider", "continue_manual", "save_later"]);
  });

  it("stops after the single automatic retry", () => {
    const plan = buildCrossPillarRecoveryPlan({
      actionId: "mind-memory",
      failureReason: "timeout",
      toolReadiness: readiness(),
      automaticRetryCount: 1,
    });

    expect(plan.autoRetryAllowed).toBe(false);
    expect(plan.actions).toContain("retry");
  });
});
