import { describe, expect, it } from "vitest";
import {
  CONCIERGE_LAUNCH_SMOKE_PROVIDER_FOCUS,
  buildConciergeLaunchSmokeAudit,
  validateConciergeLaunchSmokeAudit,
} from "../shared/conciergeLaunchSmokeAudit";
import {
  getConciergeFlowCoverage,
  type ConciergeFlowCoverageStage,
} from "../shared/conciergeFlowCoverage";
import {
  conciergeFlowNeedsSavedProvider,
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  getConciergeFlowDefinition,
  providerSetupFocusForFlow,
  type ConciergeFlowReference,
} from "../shared/conciergeFlowRegistry";

const REQUIRED_HISTORY_STAGES: ConciergeFlowCoverageStage[] = [
  "action_handoff",
  "outcome_capture",
  "completed_history",
];

function checkPassed(reference: ConciergeFlowReference, checkId: string): boolean {
  const audit = buildConciergeLaunchSmokeAudit().find((item) => item.reference === reference);
  const check = audit?.checks.find((item) => item.id === checkId);
  return Boolean(check?.passed);
}

describe("Concierge launch smoke audit", () => {
  it("covers exactly the ten launch flows", () => {
    const audit = buildConciergeLaunchSmokeAudit();
    const auditedReferences = audit.map((item) => item.reference).sort();
    const registryReferences = CONCIERGE_FLOW_REGISTRY.map((item) => item.reference).sort();

    expect(audit).toHaveLength(10);
    expect(new Set(auditedReferences).size).toBe(10);
    expect(auditedReferences).toEqual(registryReferences);
    expect(validateConciergeLaunchSmokeAudit(audit)).toEqual([]);
  });

  it("keeps Home, Concierge, and voice launch entries wired to the correct flow", () => {
    const audit = buildConciergeLaunchSmokeAudit();

    for (const flow of audit) {
      const definition = getConciergeFlowDefinition(flow.reference);
      expect(checkPassed(flow.reference, "entry_points_open_correct_flow"), `${flow.reference} entry coverage`).toBe(true);
      expect(flow.entryPoints.length, `${flow.reference} launch entries`).toBeGreaterThan(0);

      for (const entry of flow.entryPoints) {
        expect(entry.workflow, entry.id).toBe(flow.reference);
        expect(entry.route, entry.id).toBeTruthy();
      }

      if (definition.levels.includes("voice_handoff")) {
        expect(
          flow.entryPoints.some((entry) => entry.surface === "voice_action"),
          `${flow.reference} voice entry`,
        ).toBe(true);
      }

      if (definition.levels.some((level) => level !== "voice_handoff")) {
        expect(
          flow.entryPoints.some((entry) => entry.surface !== "voice_action"),
          `${flow.reference} visible entry`,
        ).toBe(true);
      }
    }
  });

  it("routes missing provider flows to the focused Trusted Providers category", () => {
    const providerRequiredReferences = Object.keys(CONCIERGE_LAUNCH_SMOKE_PROVIDER_FOCUS).sort();

    expect(providerRequiredReferences).toEqual([
      CONCIERGE_FLOW_REFERENCES.homeService,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.transportBooking,
    ].sort());

    for (const reference of CONCIERGE_FLOW_REGISTRY.map((item) => item.reference)) {
      const needsProvider = conciergeFlowNeedsSavedProvider(reference);
      const expectedFocus = CONCIERGE_LAUNCH_SMOKE_PROVIDER_FOCUS[reference];

      if (needsProvider) {
        expect(expectedFocus, reference).toBeTruthy();
        expect(providerSetupFocusForFlow(reference), reference).toBe(expectedFocus);
        expect(checkPassed(reference, "missing_provider_setup_routes"), `${reference} setup routing`).toBe(true);
      } else {
        expect(expectedFocus, reference).toBeUndefined();
      }
    }
  });

  it("proves saved-provider and detail-ready scenarios can continue", () => {
    const audit = buildConciergeLaunchSmokeAudit();

    for (const flow of audit) {
      expect(checkPassed(flow.reference, "saved_provider_path_collects_details"), `${flow.reference} detail path`).toBe(true);
      expect(flow.task.flow_reference).toBe(flow.reference);
      expect(flow.task.missing_requirements, flow.reference).toEqual([]);

      if (conciergeFlowNeedsSavedProvider(flow.reference)) {
        expect(flow.task.provider_ready, flow.reference).toBe(true);
        expect(flow.task.missing_requirements.some((item) => item.key === "provider"), flow.reference).toBe(false);
      }
    }
  });

  it("requires final confirmation before any call, message, booking, upload, or search", () => {
    const audit = buildConciergeLaunchSmokeAudit();

    for (const flow of audit) {
      expect(checkPassed(flow.reference, "final_confirmation_gate"), `${flow.reference} confirmation gate`).toBe(true);
      expect(flow.task.confirmation_required, flow.reference).toBe(true);
      expect(flow.task.user_confirmed, flow.reference).toBe(false);
      expect(flow.confirmedPlan.mode, flow.reference).not.toBe("needs_info");

      if (flow.confirmedPlan.active_tool === "phone_call") {
        expect(flow.confirmedPlan.mode, flow.reference).toBe("direct_phone_call");
        expect(flow.confirmedPlan.external_action_allowed, flow.reference).toBe(true);
      } else {
        expect(flow.confirmedPlan.mode, flow.reference).toBe("operator_queue");
        expect(flow.confirmedPlan.external_action_allowed, flow.reference).toBe(false);
      }
    }
  });

  it("keeps handoff, outcome, and completed history evidence for every flow", () => {
    const audit = buildConciergeLaunchSmokeAudit();

    for (const flow of audit) {
      const coverage = getConciergeFlowCoverage(flow.reference);
      expect(checkPassed(flow.reference, "handoff_and_completed_history"), `${flow.reference} history coverage`).toBe(true);

      for (const stage of REQUIRED_HISTORY_STAGES) {
        expect(coverage.coveredStages, `${flow.reference} ${stage}`).toContain(stage);
        expect(coverage.evidence[stage]?.trim(), `${flow.reference} ${stage} evidence`).toBeTruthy();
      }
    }
  });
});
