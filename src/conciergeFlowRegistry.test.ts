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
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.transportBooking)).toBe(true);
    expect(conciergeFlowNeedsSavedProvider(CONCIERGE_FLOW_REFERENCES.scamCheck)).toBe(false);
  });
});
