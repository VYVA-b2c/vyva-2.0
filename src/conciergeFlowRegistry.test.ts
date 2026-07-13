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
  conciergeFlowReferenceForPendingAction,
  evaluateConciergeFlowRequirements,
} from "../shared/conciergeFlowRequirements";
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
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.transportBooking)).toMatchObject({
      status: "ready",
      actionName: "Book ride / transport",
      providerCategory: "transport",
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.otcPharmacy)).toMatchObject({
      status: "ready",
      actionName: "OTC pharmacy help",
      providerCategory: "pharmacy",
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.medicalAppointment)).toMatchObject({
      status: "ready",
      actionName: "Medical appointment",
      providerCategory: "doctor_clinic",
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.homeService)).toMatchObject({
      status: "ready",
      actionName: "Home service",
      providerCategory: "home_service",
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.scamCheck)).toMatchObject({
      status: "ready",
      tools: expect.arrayContaining(["camera_or_upload", "web_search"]),
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.insuranceAdmin)).toMatchObject({
      status: "ready",
      tools: expect.arrayContaining(["email", "phone_call", "camera_or_upload"]),
    });
    expect(getConciergeFlowDefinition(CONCIERGE_FLOW_REFERENCES.toolGatedTask)).toMatchObject({
      status: "ready",
      tools: expect.arrayContaining(["phone_call", "email", "camera_or_upload"]),
    });
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.transportBooking)).toBe(true);
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.scamCheck)).toBe(false);
  });

  it("evaluates exact active-task requirements for tracked flows", () => {
    const ride = evaluateConciergeFlowRequirements({
      useCase: "book_ride",
      payload: { pickup_address: "Home", requested_time: "now" },
      providerName: "Radio Taxi",
    });
    expect(ride.flowReference).toBe(CONCIERGE_FLOW_REFERENCES.transportBooking);
    expect(ride.needsProvider).toBe(true);
    expect(ride.providerReady).toBe(true);
    expect(ride.firstMissingRequirement?.labelEn).toBe("Destination");

    const otc = evaluateConciergeFlowRequirements({
      useCase: "order_medicine",
      payload: { fulfillment_preference: "pickup", requested_time: "today" },
    });
    expect(otc.firstMissingRequirement?.labelEn).toBe("Item");

    const home = evaluateConciergeFlowRequirements({
      useCase: "book_appointment",
      payload: {
        appointment_type: "home-service",
        service_type: "plumber",
        home_address: "Home",
      },
    });
    expect(home.flowReference).toBe(CONCIERGE_FLOW_REFERENCES.homeService);
    expect(home.firstMissingRequirement?.labelEn).toBe("Urgency");

    const admin = evaluateConciergeFlowRequirements({
      useCase: "admin_task",
      payload: { recipient_email: "insurer@example.com" },
      summary: "Help me send an insurance claim",
    });
    expect(admin.flowReference).toBe(CONCIERGE_FLOW_REFERENCES.insuranceAdmin);
    expect(admin.firstMissingRequirement?.labelEn).toBe("Deadline");
  });

  it("maps pending actions to their reusable flow references", () => {
    expect(conciergeFlowReferenceForPendingAction({
      useCase: "book_appointment",
      payload: { appointment_type: "home-service" },
    })).toBe(CONCIERGE_FLOW_REFERENCES.homeService);
    expect(conciergeFlowReferenceForPendingAction({
      useCase: "anything_else",
      payload: { flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck },
    })).toBe(CONCIERGE_FLOW_REFERENCES.scamCheck);
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
