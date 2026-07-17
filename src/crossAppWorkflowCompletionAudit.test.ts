import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REGISTRY, CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES } from "../shared/workflowRegistry";
import {
  CROSS_APP_REUSABLE_WORKFLOWS,
  CROSS_APP_WORKFLOW_COMPLETION_AUDIT,
  CROSS_APP_WORKFLOW_COMPLETION_STATUSES,
  CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER,
  crossAppWorkflowAuditEntriesForStatus,
  validateCrossAppWorkflowCompletionAudit,
} from "../shared/crossAppWorkflowCompletionAudit";

describe("cross-app workflow completion audit", () => {
  it("is internally consistent", () => {
    expect(validateCrossAppWorkflowCompletionAudit()).toEqual({
      duplicateEntryIds: [],
      entriesWithoutReferences: [],
      entriesWithoutEvidence: [],
      entriesWithoutNextStep: [],
      reusableFlowsWithoutEntries: [],
      prioritiesWithoutIncompleteEntries: [],
    });
  });

  it("uses only known statuses and keeps now-priority work actionable", () => {
    const knownStatuses = new Set(CROSS_APP_WORKFLOW_COMPLETION_STATUSES);

    for (const entry of CROSS_APP_WORKFLOW_COMPLETION_AUDIT) {
      expect(knownStatuses.has(entry.status)).toBe(true);
      if (entry.priority === "now") {
        expect(entry.status).not.toBe("complete");
        expect(entry.nextImplementation.length).toBeGreaterThan(12);
      }
      if (entry.status !== "complete") {
        expect(entry.blockers.length).toBeGreaterThan(0);
      }
    }

    expect(crossAppWorkflowAuditEntriesForStatus("partial").map((entry) => entry.id)).toEqual(
      expect.arrayContaining([
        "health.medication-research",
        "admin.content-management",
      ]),
    );
    expect(crossAppWorkflowAuditEntriesForStatus("blocked_provider_setup")).toEqual([]);
    expect(crossAppWorkflowAuditEntriesForStatus("blocked_tool_setup")).toEqual([]);
  });

  it("covers the required cross-app areas and surfaces", () => {
    expect(new Set(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.map((entry) => entry.area))).toEqual(
      new Set([
        "home",
        "health",
        "mind_memory",
        "learning",
        "community",
        "concierge",
        "scam_guard",
        "safe_home",
        "providers",
        "tools",
        "admin",
      ]),
    );

    const surfaces = new Set(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.map((entry) => entry.surface));
    ["main_category", "sub_action", "fast_help", "voice_action", "review_action", "setup", "admin"]
      .forEach((surface) => expect(surfaces.has(surface)).toBe(true));
  });

  it("covers every Concierge flow reference at least once", () => {
    const auditReferences = new Set(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.flatMap((entry) => entry.references));

    for (const flow of CONCIERGE_FLOW_REGISTRY) {
      expect(auditReferences.has(flow.reference)).toBe(true);
    }
  });

  it("keeps visible app pillars and provider setup represented", () => {
    const auditReferences = new Set(CROSS_APP_WORKFLOW_COMPLETION_AUDIT.flatMap((entry) => entry.references));

    [
      APP_WORKFLOW_REFERENCES.homeHub,
      APP_WORKFLOW_REFERENCES.healthHub,
      APP_WORKFLOW_REFERENCES.mindMemoryHub,
      APP_WORKFLOW_REFERENCES.communityHub,
      APP_WORKFLOW_REFERENCES.learningPlan,
      APP_WORKFLOW_REFERENCES.trustedProviders,
      APP_WORKFLOW_REFERENCES.togetherSharePlan,
      APP_WORKFLOW_REFERENCES.visualScan,
    ].forEach((reference) => expect(auditReferences.has(reference)).toBe(true));
  });

  it("deduplicates repeated actions into reusable flow references", () => {
    const reusableIds = new Set(CROSS_APP_REUSABLE_WORKFLOWS.map((flow) => flow.id));

    [
      "RFL_BOOKING_CONFIRMATION",
      "RFL_TRUSTED_PROVIDER_SETUP",
      "RFL_PROVIDER_SEARCH_COMPARE",
      "RFL_SHOW_VYVA_REVIEW",
      "RFL_TOOL_GATED_ACTION",
      "RFL_SOCIAL_PLAN_COORDINATION",
    ].forEach((id) => expect(reusableIds.has(id)).toBe(true));

    const booking = CROSS_APP_REUSABLE_WORKFLOWS.find((flow) => flow.id === "RFL_BOOKING_CONFIRMATION");
    expect(booking?.references).toEqual(
      expect.arrayContaining([
        CONCIERGE_FLOW_REFERENCES.transportBooking,
        CONCIERGE_FLOW_REFERENCES.medicalAppointment,
        CONCIERGE_FLOW_REFERENCES.homeService,
      ]),
    );
    expect(booking?.rule).toContain("final confirmation");
  });

  it("names the next implementation priorities in order", () => {
    expect(CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER.map((item) => item.id)).toEqual([
      "next.medication-research-sources",
      "next.admin-content-index",
    ]);
    expect(CROSS_APP_WORKFLOW_NEXT_IMPLEMENTATION_ORDER[0].auditEntryIds).toEqual(
      ["health.medication-research"],
    );
  });
});
