import { describe, expect, it } from "vitest";
import {
  CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS,
  CROSS_PILLAR_PRIMARY_ACTION_IDS,
  CROSS_PILLAR_TOOL_FAMILIES,
  canClaimCrossPillarExternalSuccess,
  evaluateCrossPillarActionToolReadiness,
  type CrossPillarToolFamily,
} from "./crossPillarToolReadiness";

function readyEvidence() {
  return Object.fromEntries(CROSS_PILLAR_TOOL_FAMILIES.map((family) => [
    family,
    { family, status: "ready" as const, adapter: `sandbox:${family}` },
  ])) as Record<CrossPillarToolFamily, { family: CrossPillarToolFamily; status: "ready"; adapter: string }>;
}

describe("cross-pillar tool readiness", () => {
  it("maps exactly 18 primary actions and covers every tool family", () => {
    expect(CROSS_PILLAR_PRIMARY_ACTION_IDS).toHaveLength(18);
    expect(Object.keys(CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS).sort())
      .toEqual([...CROSS_PILLAR_PRIMARY_ACTION_IDS].sort());
    const covered = new Set(Object.values(CROSS_PILLAR_ACTION_TOOL_REQUIREMENTS).flatMap((item) => item.tools));
    expect([...covered].sort()).toEqual([...CROSS_PILLAR_TOOL_FAMILIES].sort());
  });

  it("uses the strongest blocker and preserves a safe fallback", () => {
    const readiness = evaluateCrossPillarActionToolReadiness({
      actionId: "concierge-book",
      evidence: {
        ...readyEvidence(),
        booking: { family: "booking", status: "temporarily_unavailable", reason: "Adapter timeout" },
        phone: { family: "phone", status: "setup_needed", reason: "No phone provider configured" },
      },
    });
    expect(readiness.status).toBe("temporarily_unavailable");
    expect(readiness.fallbackPath).toBe("/concierge");
    expect(readiness.blockers).toHaveLength(2);
  });

  it("requires external confirmation before success", () => {
    const readiness = evaluateCrossPillarActionToolReadiness({
      actionId: "health-doctor",
      evidence: readyEvidence(),
    });
    expect(canClaimCrossPillarExternalSuccess({ readiness })).toBe(false);
    expect(canClaimCrossPillarExternalSuccess({ readiness, externalConfirmationId: "provider-123" })).toBe(true);
  });
});
