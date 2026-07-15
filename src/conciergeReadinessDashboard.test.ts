import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES, CONCIERGE_FLOW_REGISTRY } from "../shared/conciergeFlowRegistry";
import {
  buildConciergeReadinessRows,
  summarizeConciergeReadiness,
} from "../shared/conciergeReadinessDashboard";

describe("concierge readiness dashboard model", () => {
  it("builds one readiness row for every Concierge flow", () => {
    const rows = buildConciergeReadinessRows();
    const summary = summarizeConciergeReadiness(rows);

    expect(rows).toHaveLength(CONCIERGE_FLOW_REGISTRY.length);
    expect(summary.total).toBe(CONCIERGE_FLOW_REGISTRY.length);
    expect(summary.needsAttention).toBe(0);
    expect(summary.ready).toBe(CONCIERGE_FLOW_REGISTRY.length);
    expect(summary.entryPoints).toBeGreaterThan(CONCIERGE_FLOW_REGISTRY.length);
  });

  it("marks every current launch flow as covered and reachable", () => {
    const rows = buildConciergeReadinessRows();

    for (const row of rows) {
      expect(row.readyForUsers, row.reference).toBe(true);
      expect(row.entryPoints.length, row.reference).toBeGreaterThan(0);
      expect(row.coveredStageCount, row.reference).toBe(row.requiredStageCount);
      expect(row.missingStages, row.reference).toHaveLength(0);
      expect(row.entryGaps, row.reference).toHaveLength(0);
      expect(row.readinessNotes).toContain("Launch gates covered.");
    }
  });

  it("shows transport as a provider-gated flow with mobility and address setup", () => {
    const transport = buildConciergeReadinessRows().find((row) => (
      row.reference === CONCIERGE_FLOW_REFERENCES.transportBooking
    ));

    expect(transport).toBeDefined();
    expect(transport?.providerDependency.needsSavedProvider).toBe(true);
    expect(transport?.providerDependency.categoryLabel).toBe("Transport / Taxi");
    expect(transport?.missingSetup.map((item) => item.label)).toEqual([
      "Trusted transport / taxi",
      "Mobility preferences",
      "Home address",
    ]);
    expect(transport?.toolDependencies.map((item) => item.label)).toEqual([
      "Phone call",
      "WhatsApp",
      "Booking link",
      "Operator review",
    ]);
    expect(transport?.entryPoints.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      "home.fast.book-ride",
      "concierge.fast.book-ride",
      "concierge.action.transport",
    ]));
  });

  it("shows scam check as a review flow without a provider gate", () => {
    const scam = buildConciergeReadinessRows().find((row) => (
      row.reference === CONCIERGE_FLOW_REFERENCES.scamCheck
    ));

    expect(scam).toBeDefined();
    expect(scam?.providerDependency.needsSavedProvider).toBe(false);
    expect(scam?.providerDependency.categoryLabel).toBeNull();
    expect(scam?.missingSetup.map((item) => item.label)).toEqual(["Document or photo"]);
    expect(scam?.toolDependencies.map((item) => item.label)).toEqual([
      "Camera / upload",
      "Web search",
      "Operator review",
    ]);
  });
});
