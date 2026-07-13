import { describe, expect, it } from "vitest";
import {
  conciergeFlowNeedsSavedProvider,
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  CONCIERGE_PROVIDER_CATEGORIES,
  getConciergeFlowDefinition,
  normalizeConciergeProviderCategory,
  providerSetupFocusForFlow,
} from "../shared/conciergeFlowRegistry";
import {
  CONCIERGE_FLOW_COVERAGE,
  CONCIERGE_FLOW_COVERAGE_STAGE_LABELS,
  missingConciergeFlowCoverage,
} from "../shared/conciergeFlowCoverage";

describe("concierge flow registry", () => {
  it("keeps provider setup categories aligned with concierge flows", () => {
    const categoryIds = CONCIERGE_PROVIDER_CATEGORIES.map((category) => category.id);

    expect(categoryIds).toEqual([
      "pharmacy",
      "doctor_clinic",
      "transport",
      "home_service",
      "personal_care",
      "food",
      "other",
    ]);
    expect(providerSetupFocusForFlow(CONCIERGE_FLOW_REFERENCES.otcPharmacy)).toBe("pharmacy");
    expect(providerSetupFocusForFlow(CONCIERGE_FLOW_REFERENCES.transportBooking)).toBe("transport");
    expect(providerSetupFocusForFlow(CONCIERGE_FLOW_REFERENCES.medicalAppointment)).toBe("doctor_clinic");
    expect(providerSetupFocusForFlow(CONCIERGE_FLOW_REFERENCES.homeService)).toBe("home_service");
  });

  it("normalizes provider aliases used by handoffs and saved providers", () => {
    expect(normalizeConciergeProviderCategory("taxi")).toBe("transport");
    expect(normalizeConciergeProviderCategory("home-service")).toBe("home_service");
    expect(normalizeConciergeProviderCategory("GP")).toBe("doctor_clinic");
    expect(normalizeConciergeProviderCategory("meal delivery")).toBe("food");
    expect(normalizeConciergeProviderCategory("something else")).toBe("other");
  });

  it("documents current implementation state for each tracked flow", () => {
    expect(CONCIERGE_FLOW_REGISTRY).toHaveLength(7);
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.otcPharmacy)).toMatchObject({
      status: "partial",
      actionName: "OTC pharmacy help",
      providerCategory: "pharmacy",
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.scamCheck)).toMatchObject({
      status: "partial",
      tools: expect.arrayContaining(["camera_or_upload", "web_search"]),
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.insuranceAdmin)).toMatchObject({
      status: "partial",
      tools: expect.arrayContaining(["email", "phone_call", "camera_or_upload"]),
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.toolGatedTask)).toMatchObject({
      status: "partial",
      tools: expect.arrayContaining(["phone_call", "email", "camera_or_upload"]),
    });
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.transportBooking)).toBe(true);
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.scamCheck)).toBe(false);
  });

  it("keeps a complete lifecycle coverage map for tracked flows", () => {
    const registryReferences = CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference).sort();
    const coverageReferences = CONCIERGE_FLOW_COVERAGE.map((flow) => flow.reference).sort();

    expect(coverageReferences).toEqual(registryReferences);
    expect(Object.keys(CONCIERGE_FLOW_COVERAGE_STAGE_LABELS).sort()).toEqual([
      "completed_history",
      "detail_collection",
      "final_user_confirmation",
      "missing_provider_setup",
      "provider_unavailable_recovery",
      "saved_provider_path",
      "start_action",
    ]);

    for (const coverage of CONCIERGE_FLOW_COVERAGE) {
      expect(missingConciergeFlowCoverage(coverage.reference)).toEqual([]);
      for (const stage of coverage.requiredStages) {
        expect(coverage.evidence[stage]).toBeTruthy();
      }
    }

    for (const reference of [
      CONCIERGE_FLOW_REFERENCES.transportBooking,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.homeService,
    ]) {
      const coverage = CONCIERGE_FLOW_COVERAGE.find((flow) => flow.reference === reference);
      expect(coverage?.requiredStages).toEqual([
        "start_action",
        "detail_collection",
        "missing_provider_setup",
        "saved_provider_path",
        "provider_unavailable_recovery",
        "final_user_confirmation",
        "completed_history",
      ]);
    }
  });
});
