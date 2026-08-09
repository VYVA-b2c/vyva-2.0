import { describe, expect, it } from "vitest";
import {
  VYVA_FLOW_CATALOGUE,
  type FlowCatalogue,
} from "../../shared/orchestration/flowCatalogue";
import {
  VYVA_PRESENTATION_REGISTRY,
  type PresentationRegistry,
} from "../../shared/orchestration/presentationRegistry";
import {
  MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
  MENTAL_WELLBEING_FLOW_ID,
  MENTAL_WELLBEING_FLOW_VERSION,
  MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
  MENTAL_WELLBEING_SCENE_ID,
  MENTAL_WELLBEING_SPECIALIST_ID,
  MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
  resolveMentalWellbeingRuntimeContract,
} from "./mentalWellbeingFlow";

function cloneCatalogue(): FlowCatalogue {
  return structuredClone(VYVA_FLOW_CATALOGUE);
}

function cloneRegistry(): PresentationRegistry {
  return structuredClone(VYVA_PRESENTATION_REGISTRY);
}

describe("Mental Wellbeing flow and presentation contracts", () => {
  it("resolves one pilot Mental Wellbeing support flow through the existing Flow Catalogue", () => {
    const contract = resolveMentalWellbeingRuntimeContract();

    expect(contract).toMatchObject({
      flowId: MENTAL_WELLBEING_FLOW_ID,
      flowVersion: MENTAL_WELLBEING_FLOW_VERSION,
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      ownerSpecialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    });
    expect(contract?.canonicalFlow.status).toBe("pilot");
    expect(contract?.canonicalFlow.requiredTools).toEqual([]);
    expect(contract?.canonicalFlow.optionalTools).toEqual([]);
    expect(contract?.canonicalFlow.memoryPolicy.proposedWriteCategories).toEqual([]);
    expect(contract?.canonicalFlow.deterministicSafetyChecks).toContain("safety_check.emergency_general");
  });

  it("uses canonical shared Presentation Registry families", () => {
    const contract = resolveMentalWellbeingRuntimeContract();

    expect(contract?.presentations.summary.presentationId).toBe(MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID);
    expect(contract?.presentations.summary.familyId).toBe("presentation.family.summary");
    expect(contract?.presentations.checkin.presentationId).toBe(MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID);
    expect(contract?.presentations.checkin.familyId).toBe("presentation.family.input.free_text");
    expect(contract?.presentations.safeFallback.presentationId).toBe(MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID);
    expect(contract?.presentations.safeFallback.familyId).toBe("presentation.family.error.safe_fallback");
  });

  it("fails closed if the Flow owner is not the Mental Wellbeing Specialist", () => {
    const catalogue = cloneCatalogue();
    const flow = catalogue.flows.find((item) => item.flowId === MENTAL_WELLBEING_FLOW_ID);
    expect(flow).toBeDefined();
    flow!.ownerSpecialistId = "social";

    expect(resolveMentalWellbeingRuntimeContract({ catalogue })).toBeNull();
  });

  it("fails closed when required presentation references are missing", () => {
    const presentationRegistry = cloneRegistry();
    presentationRegistry.presentations = presentationRegistry.presentations.filter(
      (item) => item.presentationId !== MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
    );

    expect(resolveMentalWellbeingRuntimeContract({ presentationRegistry })).toBeNull();
  });
});
