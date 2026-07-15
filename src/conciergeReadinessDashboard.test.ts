import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES, CONCIERGE_FLOW_REGISTRY } from "../shared/conciergeFlowRegistry";
import { buildConciergeLaunchSmokeAudit } from "../shared/conciergeLaunchSmokeAudit";
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
    expect(summary.launchAuditPassed).toBe(CONCIERGE_FLOW_REGISTRY.length);
    expect(summary.launchAuditNeedsAttention).toBe(0);
    expect(summary.launchAuditChecks).toBe(CONCIERGE_FLOW_REGISTRY.length * 5);
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
      expect(row.launchAudit.passed, row.reference).toBe(true);
      expect(row.launchAudit.checkCount, row.reference).toBe(5);
      expect(row.finalConfirmation.covered, row.reference).toBe(true);
      expect(row.handoffHistory.every((stage) => stage.covered), row.reference).toBe(true);
      expect(row.manualQaScript.reference, row.reference).toBe(row.reference);
      expect(row.manualQaScript.steps.length, row.reference).toBeGreaterThan(row.entryPoints.length);
    }
  });

  it("attaches generated manual QA scripts to every readiness row", () => {
    const rows = buildConciergeReadinessRows();

    expect(rows.map((row) => row.manualQaScript.reference)).toEqual(
      CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference),
    );

    for (const row of rows) {
      expect(row.manualQaScript.finalConfirmationStep.instruction, row.reference).toBe(row.confirmationRule);
      expect(row.manualQaScript.handoffHistorySteps.map((step) => step.title), row.reference).toEqual([
        "Action handoff",
        "Outcome capture",
        "Completed history",
      ]);
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

  it("surfaces smoke audit failures as needs-attention rows", () => {
    const launchAudit = buildConciergeLaunchSmokeAudit().map((audit) => {
      if (audit.reference !== CONCIERGE_FLOW_REFERENCES.transportBooking) return audit;
      return {
        ...audit,
        checks: audit.checks.map((check, index) => (
          index === 0
            ? { ...check, passed: false, details: ["Book ride entry point lost its route."] }
            : check
        )),
        failures: ["Book ride entry point lost its route."],
      };
    });
    const rows = buildConciergeReadinessRows({ launchAudit });
    const summary = summarizeConciergeReadiness(rows);
    const transport = rows.find((row) => row.reference === CONCIERGE_FLOW_REFERENCES.transportBooking);

    expect(summary.ready).toBe(CONCIERGE_FLOW_REGISTRY.length - 1);
    expect(summary.needsAttention).toBe(1);
    expect(summary.launchAuditNeedsAttention).toBe(1);
    expect(transport?.readyForUsers).toBe(false);
    expect(transport?.readinessStatus).toBe("needs_attention");
    expect(transport?.launchAudit.passed).toBe(false);
    expect(transport?.launchAudit.failures).toEqual(["Book ride entry point lost its route."]);
    expect(transport?.readinessNotes.join(" ")).toContain("Smoke audit needs attention");
  });
});
