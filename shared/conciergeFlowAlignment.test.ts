import { describe, expect, it } from "vitest";
import {
  CONCIERGE_FLOW_MAPS,
  getConciergeFlowMap,
  type ConciergeFlowMapStepKey,
} from "./conciergeFlowAlignment";
import {
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
} from "./conciergeFlowRegistry";

const REQUIRED_STEPS: ConciergeFlowMapStepKey[] = [
  "start",
  "details",
  "provider",
  "confirm",
  "action",
  "history",
];

describe("Concierge flow alignment maps", () => {
  it("creates one simple map for every registered Concierge flow", () => {
    expect(CONCIERGE_FLOW_MAPS).toHaveLength(CONCIERGE_FLOW_REGISTRY.length);
    expect(CONCIERGE_FLOW_MAPS.map((flow) => flow.reference).sort())
      .toEqual(CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference).sort());

    for (const flow of CONCIERGE_FLOW_MAPS) {
      expect(flow.title).toBeTruthy();
      expect(flow.steps.map((step) => step.key)).toEqual(REQUIRED_STEPS);
      expect(flow.steps.every((step) => step.label && step.helper)).toBe(true);
      expect(flow.confirmationPrompt).toContain("final review");
      expect(flow.completionPrompt).toContain("completion history");
    }
  });

  it("keeps saved-provider and missing-provider copy explicit for provider-gated flows", () => {
    const providerFlows = CONCIERGE_FLOW_MAPS.filter((flow) => flow.needsProvider);
    expect(providerFlows.map((flow) => flow.reference).sort()).toEqual([
      CONCIERGE_FLOW_REFERENCES.homeService,
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      CONCIERGE_FLOW_REFERENCES.transportBooking,
    ].sort());

    for (const flow of providerFlows) {
      expect(flow.savedProviderPrompt).toMatch(/Use the saved/i);
      expect(flow.missingProviderPrompt).toMatch(/choose or add/i);
      const providerStep = flow.steps.find((step) => step.key === "provider");
      expect(providerStep?.helper).toContain(flow.savedProviderPrompt);
      expect(providerStep?.helper).toMatch(/If none is saved/i);
      expect(providerStep?.helper).toMatch(/choose or add/i);
    }
  });

  it("keeps document, review, comparison, and tool-gated flows confirmation-first", () => {
    const references = [
      CONCIERGE_FLOW_REFERENCES.shoppingSupport,
      CONCIERGE_FLOW_REFERENCES.careNavigation,
      CONCIERGE_FLOW_REFERENCES.scamCheck,
      CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    ];

    for (const reference of references) {
      const flow = getConciergeFlowMap(reference);
      expect(flow.confirmationPrompt).toMatch(/before any/i);
      expect(flow.steps.find((step) => step.key === "action")?.helper).toMatch(/live channel is ready/i);
      expect(flow.steps.find((step) => step.key === "history")?.helper).toMatch(/provider reply|action needed/i);
    }
  });
});
