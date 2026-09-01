import { describe, expect, it } from "vitest";
import {
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
} from "../../shared/conciergeFlowRegistry";
import { VYVA_PRESENTATION_REGISTRY } from "../../shared/orchestration/presentationRegistry";
import { getScreenContract } from "./screenContracts";
import {
  TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS,
  TRUSTED_HELP_PRESENTATION_STEPS,
  TRUSTED_HELP_PROVIDER_SCOPE_EXCLUSIONS,
  TRUSTED_HELP_SERVICE_PRESENTATION_MAP,
  getTrustedHelpMissionPresentation,
  getTrustedHelpMissionStatusLabel,
  getTrustedHelpEntryStep,
  getTrustedHelpServicePresentation,
  normalizeTrustedHelpMissionStatus,
  validateTrustedHelpPresentationMap,
} from "./conciergeTrustedHelpPresentationMap";

describe("Concierge Trusted Help presentation map", () => {
  it("keeps the map internally valid", () => {
    expect(validateTrustedHelpPresentationMap()).toEqual([]);
  });

  it("uses the existing Concierge screen contract and presentation families", () => {
    const conciergeContract = getScreenContract("concierge");
    const familyIds = new Set(
      VYVA_PRESENTATION_REGISTRY.families.map((family) => family.familyId),
    );

    expect(conciergeContract.template).toBe("guidedFlow");
    for (const step of TRUSTED_HELP_PRESENTATION_STEPS) {
      expect(step.screenContractId).toBe("concierge");
      expect(familyIds.has(step.presentationFamilyId)).toBe(true);
      expect(step.chips).toBe("hidden");
    }
  });

  it("keeps Trusted Help to the five concierge provider services", () => {
    expect(TRUSTED_HELP_SERVICE_PRESENTATION_MAP.map((service) => service.serviceId)).toEqual([
      "groceries",
      "home-care",
      "transport",
      "wellness",
      "other",
    ]);
  });

  it("keeps Water as Groceries coverage instead of a top-level service", () => {
    const groceries = getTrustedHelpServicePresentation("groceries");
    const serviceIds = TRUSTED_HELP_SERVICE_PRESENTATION_MAP.map(
      (service) => service.serviceId as string,
    );

    expect(groceries?.description).toBe("Food, water, household");
    expect(groceries?.requiresSubservice).toBe(false);
    expect(getTrustedHelpEntryStep("groceries")).toBe("provider");
    expect(groceries?.coverageDriven).toBe(true);
    expect(groceries?.coverageValues).toEqual(["Water", "Food", "Household", "Meals"]);
    expect(serviceIds).not.toContain("water");
  });

  it("routes only services that need clarification through the type step", () => {
    expect(getTrustedHelpEntryStep("home-care")).toBe("subservice");
    expect(getTrustedHelpEntryStep("transport")).toBe("subservice");
    expect(getTrustedHelpEntryStep("wellness")).toBe("subservice");
    expect(getTrustedHelpEntryStep("other")).toBe("provider");
  });

  it("links every service to an existing Concierge workflow without medical or pharmacy provider scopes", () => {
    const knownFlows = new Set(CONCIERGE_FLOW_REGISTRY.map((flow) => flow.reference));
    const forbiddenFlows = [
      CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    ];

    for (const service of TRUSTED_HELP_SERVICE_PRESENTATION_MAP) {
      expect(knownFlows.has(service.flowReference)).toBe(true);
      expect(forbiddenFlows).not.toContain(service.flowReference);
      expect(service.safetyModel).toBe("prepareThenConfirm");
    }

    expect(TRUSTED_HELP_PROVIDER_SCOPE_EXCLUSIONS).toEqual([
      "health.medical_provider",
      "medication.pharmacy_provider",
      "clinical_care_provider",
    ]);
  });

  it("keeps external action behind the provider, controls, review, and mission boundary", () => {
    const boundedSteps = TRUSTED_HELP_PRESENTATION_STEPS.filter((step) =>
      ["provider", "controls", "review", "active-mission"].includes(step.stepId),
    );

    expect(boundedSteps.length).toBe(4);
    for (const step of boundedSteps) {
      expect(step.confirmationBoundary).toBe("finalConfirmationBeforeExternalAction");
    }
  });

  it("defines active mission states for confirmation, contact, waiting, and proof", () => {
    const byStatus = new Map(
      TRUSTED_HELP_ACTIVE_MISSION_PRESENTATIONS.map((item) => [item.status, item]),
    );

    expect(byStatus.get("awaiting_confirmation")?.presentationFamilyId).toBe("presentation.family.confirmation");
    expect(byStatus.get("contacting_provider")?.externalActionBoundary).toBe("externalContactInProgress");
    expect(byStatus.get("contacting_provider")?.allowedControls).toEqual(
      expect.arrayContaining(["listen", "mute", "unmute", "stop"]),
    );
    expect(byStatus.get("awaiting_provider_reply")?.externalActionBoundary).toBe("waitingForExternalReply");
    expect(byStatus.get("booked")?.externalActionBoundary).toBe("completedWithProof");
    expect(byStatus.get("completed")?.externalActionBoundary).toBe("completedWithProof");
  });

  it("normalizes active mission aliases used by Concierge pending actions", () => {
    expect(normalizeTrustedHelpMissionStatus("calling")).toBe("contacting_provider");
    expect(normalizeTrustedHelpMissionStatus("awaiting_user_confirmation")).toBe("awaiting_confirmation");
    expect(normalizeTrustedHelpMissionStatus("ready-to-save")).toBe("awaiting_user_save");
    expect(normalizeTrustedHelpMissionStatus("unknown")).toBe("ready");
  });

  it("exposes localized mission labels for UI panels", () => {
    expect(getTrustedHelpMissionStatusLabel("form_in_progress", false)).toBe("Form in progress");
    expect(getTrustedHelpMissionStatusLabel("form_in_progress", true)).toBe("Formulario en curso");

    const presentation = getTrustedHelpMissionPresentation("awaiting_provider_reply");
    expect(presentation?.stepId).toBe("active-mission");
    expect(presentation?.cards).toBe("contextual");
    expect(presentation?.chips).toBe("hidden");
  });
});
