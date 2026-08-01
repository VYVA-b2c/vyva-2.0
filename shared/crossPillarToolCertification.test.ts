import { describe, expect, it } from "vitest";
import {
  CROSS_PILLAR_TOOL_FAMILIES,
  type CrossPillarToolEvidence,
  type CrossPillarToolFamily,
} from "./crossPillarToolReadiness";
import {
  buildCrossPillarPillarCertifications,
  buildCrossPillarToolCertifications,
} from "./crossPillarToolCertification";
import type { CrossPillarExecutionAttemptSnapshot } from "./crossPillarExecutionObservability";

const NOW = new Date("2026-07-28T12:00:00.000Z");

function readyEvidence() {
  return Object.fromEntries(CROSS_PILLAR_TOOL_FAMILIES.map((family) => [
    family,
    { family, status: "ready" as const, adapter: `adapter:${family}` },
  ])) as Record<CrossPillarToolFamily, CrossPillarToolEvidence>;
}

function attempt(overrides: Partial<CrossPillarExecutionAttemptSnapshot> = {}): CrossPillarExecutionAttemptSnapshot {
  return {
    id: crypto.randomUUID(),
    handoffId: "handoff-1",
    attemptNumber: 1,
    actionId: "concierge-book",
    pillar: "concierge",
    workflowReference: "concierge.booking",
    toolFamilies: ["booking"],
    outcome: "succeeded",
    startedAt: "2026-07-27T12:00:00.000Z",
    finishedAt: "2026-07-27T12:00:05.000Z",
    idempotencyKey: "handoff-1:1",
    createdAt: "2026-07-27T12:00:05.000Z",
    ...overrides,
  };
}

describe("cross-pillar tool certification", () => {
  it("does not certify a configured external adapter without a real reference", () => {
    const result = buildCrossPillarToolCertifications({
      evidence: readyEvidence(),
      attempts: [attempt()],
      now: NOW,
    });
    expect(result.find((item) => item.family === "booking")).toMatchObject({
      status: "not_tested",
      externalReferenceVerified: false,
    });
  });

  it("certifies a recent external success with a reference", () => {
    const result = buildCrossPillarToolCertifications({
      evidence: readyEvidence(),
      attempts: [attempt({ confirmationId: "BOOK-4821" })],
      now: NOW,
    });
    expect(result.find((item) => item.family === "booking")).toMatchObject({
      status: "certified",
      externalReferenceVerified: true,
    });
  });

  it("does not treat a broad workflow dependency list as adapter proof", () => {
    const result = buildCrossPillarToolCertifications({
      evidence: readyEvidence(),
      attempts: [attempt({
        toolFamilies: ["booking", "phone", "email"],
        confirmationId: "BOOK-4821",
      })],
      now: NOW,
    });

    expect(result.find((item) => item.family === "booking")?.status).toBe("not_tested");
    expect(result.find((item) => item.family === "phone")?.status).toBe("not_tested");
    expect(result.find((item) => item.family === "email")?.status).toBe("not_tested");
  });

  it("marks a ready adapter degraded after repeated recent failures", () => {
    const failures = [1, 2, 3].map((attemptNumber) => attempt({
      id: crypto.randomUUID(),
      attemptNumber,
      outcome: "failed",
      confirmationId: undefined,
    }));
    const result = buildCrossPillarToolCertifications({
      evidence: readyEvidence(),
      attempts: failures,
      now: NOW,
    });
    expect(result.find((item) => item.family === "booking")?.status).toBe("degraded");
  });

  it("keeps stale successful evidence uncertified", () => {
    const result = buildCrossPillarToolCertifications({
      evidence: readyEvidence(),
      attempts: [attempt({
        confirmationId: "OLD-1",
        startedAt: "2026-05-01T12:00:00.000Z",
        finishedAt: "2026-05-01T12:00:05.000Z",
      })],
      now: NOW,
    });
    expect(result.find((item) => item.family === "booking")?.status).toBe("not_tested");
  });

  it("defines one representative certification contract per pillar", () => {
    const certifications = CROSS_PILLAR_TOOL_FAMILIES.map((family) => ({
      family,
      status: "certified" as const,
      externalReferenceVerified: true,
      reason: "Certified.",
    }));

    const pillars = buildCrossPillarPillarCertifications(certifications);

    expect(pillars.map((item) => item.pillar)).toEqual([
      "health",
      "mind",
      "community",
      "concierge",
    ]);
    expect(pillars.every((item) => item.status === "certified")).toBe(true);
  });

  it("shows the pillar blocked by a degraded dependency", () => {
    const certifications = CROSS_PILLAR_TOOL_FAMILIES.map((family) => ({
      family,
      status: family === "booking" ? "degraded" as const : "certified" as const,
      externalReferenceVerified: family !== "booking",
      reason: family === "booking" ? "Booking failed." : "Certified.",
    }));

    const pillars = buildCrossPillarPillarCertifications(certifications);

    expect(pillars.find((item) => item.pillar === "concierge")?.status).toBe("degraded");
    expect(pillars.find((item) => item.pillar === "mind")?.status).toBe("certified");
  });
});
