import { describe, expect, it } from "vitest";
import {
  CONCIERGE_FLOW_REGISTRY,
  CONCIERGE_FLOW_REFERENCES,
  conciergeFlowNeedsSavedProvider,
} from "../shared/conciergeFlowRegistry";
import { buildConciergeManualQaScripts } from "../shared/conciergeManualQaScripts";

describe("concierge manual QA scripts", () => {
  it("builds one manual QA script for every Concierge flow", () => {
    const scripts = buildConciergeManualQaScripts();

    expect(scripts).toHaveLength(CONCIERGE_FLOW_REGISTRY.length);
    expect(new Set(scripts.map((script) => script.reference)).size).toBe(CONCIERGE_FLOW_REGISTRY.length);

    for (const script of scripts) {
      expect(script.actionName).toBeTruthy();
      expect(script.entryPoints.length, script.reference).toBeGreaterThan(0);
      expect(script.detailsToAsk.length, script.reference).toBeGreaterThan(0);
      expect(script.smokeAudit.passed, script.reference).toBe(true);
      expect(script.smokeAudit.checkCount, script.reference).toBe(5);
    }
  });

  it("includes missing and saved provider paths only for provider-required flows", () => {
    const scripts = buildConciergeManualQaScripts();

    for (const script of scripts) {
      const requiresProvider = conciergeFlowNeedsSavedProvider(script.reference);

      expect(script.providerPath.required, script.reference).toBe(requiresProvider);

      if (requiresProvider) {
        expect(script.providerPath.setupFocusId, script.reference).toBeTruthy();
        expect(script.providerPath.setupFocusLabel, script.reference).toBeTruthy();
        expect(script.providerPath.missingProviderStep, script.reference).toMatchObject({
          kind: "missing_provider_path",
          title: "Missing provider path",
        });
        expect(script.providerPath.savedProviderStep, script.reference).toMatchObject({
          kind: "saved_provider_path",
          title: "Saved provider path",
        });
        expect(script.steps.some((step) => step.kind === "missing_provider_path"), script.reference).toBe(true);
        expect(script.steps.some((step) => step.kind === "saved_provider_path"), script.reference).toBe(true);
      } else {
        expect(script.providerPath.setupFocusId, script.reference).toBeNull();
        expect(script.providerPath.missingProviderStep, script.reference).toBeNull();
        expect(script.providerPath.savedProviderStep, script.reference).toBeNull();
        expect(script.steps.some((step) => step.kind === "missing_provider_path"), script.reference).toBe(false);
        expect(script.steps.some((step) => step.kind === "saved_provider_path"), script.reference).toBe(false);
      }
    }
  });

  it("includes final confirmation and expected completion/history outcomes in every script", () => {
    const scripts = buildConciergeManualQaScripts();

    for (const script of scripts) {
      expect(script.finalConfirmationStep.kind, script.reference).toBe("final_confirmation");
      expect(script.finalConfirmationStep.instruction.length, script.reference).toBeGreaterThan(20);
      expect(script.steps.some((step) => step.id === script.finalConfirmationStep.id), script.reference).toBe(true);
      expect(script.handoffHistorySteps, script.reference).toHaveLength(3);
      expect(script.handoffHistorySteps.map((step) => step.title), script.reference).toEqual([
        "Action handoff",
        "Outcome capture",
        "Completed history",
      ]);
      expect(script.handoffHistorySteps.every((step) => step.expectedResult.length > 0), script.reference).toBe(true);
    }
  });

  it("keeps entry point, detail, confirmation, and history steps in the executable script", () => {
    const scripts = buildConciergeManualQaScripts();

    for (const script of scripts) {
      expect(script.steps.filter((step) => step.kind === "start_entry_point"), script.reference)
        .toHaveLength(script.entryPoints.length);
      expect(script.steps.some((step) => step.kind === "detail_collection"), script.reference).toBe(true);
      expect(script.steps.some((step) => step.kind === "final_confirmation"), script.reference).toBe(true);
      expect(script.steps.filter((step) => step.kind === "handoff_history"), script.reference).toHaveLength(3);
    }
  });

  it("adds channel-specific live handoff, reload, retry, reply, and history checks to the four focused journeys", () => {
    const scripts = buildConciergeManualQaScripts();
    const focused = [
      [CONCIERGE_FLOW_REFERENCES.transportBooking, "Phone call"],
      [CONCIERGE_FLOW_REFERENCES.otcPharmacy, "WhatsApp"],
      [CONCIERGE_FLOW_REFERENCES.medicalAppointment, "Email"],
      [CONCIERGE_FLOW_REFERENCES.homeService, "Booking form"],
    ] as const;

    for (const [reference, channelLabel] of focused) {
      const script = scripts.find((candidate) => candidate.reference === reference)!;
      expect(script.liveHandoffJourney?.channelLabel).toBe(channelLabel);
      expect(script.liveFollowUpSteps.map((step) => step.title)).toEqual([
        "Waiting survives reload",
        "No answer and retry confirmation",
      ]);
      expect(script.steps.some((step) => step.source === "live_handoff_contract")).toBe(true);
      expect(script.handoffHistorySteps[0].instruction).toContain("QA-controlled");
      expect(script.handoffHistorySteps[1].instruction).toContain("Record");
      expect(script.handoffHistorySteps[2].instruction).toContain("completed Concierge history");
    }

    const shopping = scripts.find((script) => script.reference === CONCIERGE_FLOW_REFERENCES.shoppingSupport)!;
    expect(shopping.liveHandoffJourney).toBeNull();
    expect(shopping.liveFollowUpSteps).toEqual([]);
  });
});
