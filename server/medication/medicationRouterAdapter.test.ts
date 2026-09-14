import { describe, expect, it } from "vitest";
import {
  MEDICATION_FLOW_ID,
  MEDICATION_SPECIALIST_ID,
} from "./medicationFlow";
import { buildMedicationSpecialistRouteAugmentation } from "./medicationRouterAdapter";
import {
  TASK17_NOW,
  TASK17_SESSION_ID,
  TASK17_USER_ID,
  task17ClinicalDosingExclusionFixtures,
  task17InteractionExclusionFixtures,
  task17MedicationDisabledEnv,
  task17MedicationEnabledEnv,
  task17ValidNavigationFixtures,
} from "./medicationFixtures";

function baseInput(utterance: string) {
  return {
    domain: "meds",
    userId: TASK17_USER_ID,
    sessionId: TASK17_SESSION_ID,
    utterance,
    turnCount: 2,
    confidence: 1,
    now: new Date(TASK17_NOW),
    env: task17MedicationEnabledEnv,
    currentRoute: "/",
  };
}

describe("Medication router adapter", () => {
  it("returns null for flag-off Medication routing so legacy behavior remains exact", () => {
    expect(buildMedicationSpecialistRouteAugmentation({
      ...baseInput("Can you help with my medication schedule?"),
      env: task17MedicationDisabledEnv,
    })).toBeNull();
  });

  it("returns null for unrelated domains", () => {
    expect(buildMedicationSpecialistRouteAugmentation({
      ...baseInput("Can you help with my medication schedule?"),
      domain: "health",
    })).toBeNull();
  });

  it("builds structured Medication specialist metadata for supported medication management", () => {
    const result = buildMedicationSpecialistRouteAugmentation(
      baseInput("Can you help with my medication schedule?"),
    );
    expect(result).toMatchObject({
      selectedSpecialistId: MEDICATION_SPECIALIST_ID,
      selectedFlowId: MEDICATION_FLOW_ID,
      validation: "accepted",
      outcome: "tool_proposed",
      toolProposalDecision: "proposal_allowed",
      actionType: "meds.management",
      route: "/meds",
      capability: "medication_management",
      presentationId: "presentation.medication.reminder",
      requiresConfirmation: "false",
    });
    expect(result?.dynamicVariables.medication_specialist_selected).toBe("true");
    expect(result?.sessionData.selected_specialist_id).toBe(MEDICATION_SPECIALIST_ID);
    expect(result?.promptBlock).toContain("MEDICATION SPECIALIST MIGRATION BLOCK");
  });

  it("preserves refill requests as confirmation-required action proposals without execution", () => {
    const result = buildMedicationSpecialistRouteAugmentation(
      baseInput("I need a refill for my medicine"),
    );
    expect(result).toMatchObject({
      validation: "accepted",
      outcome: "tool_proposed",
      actionType: "meds.refill_request",
      route: "/meds/adherence-report",
      capability: "medication_refill_request",
      requiresConfirmation: "true",
      toolProposalDecision: "proposal_allowed",
    });
    expect(result?.promptBlock).toContain("Do not confirm, defer, skip, prescribe");
  });

  it.each(task17ValidNavigationFixtures)(
    "allows valid navigation/context request through the migrated path: %s",
    (utterance) => {
      const result = buildMedicationSpecialistRouteAugmentation(baseInput(utterance));
      expect(result).toMatchObject({
        validation: "accepted",
        outcome: "tool_proposed",
        toolProposalDecision: "proposal_allowed",
      });
    },
  );

  it("does not leak raw medication utterance or known medication names in prompt, dynamic variables, or session data", () => {
    const raw = "Please help with my private metformin refill";
    const result = buildMedicationSpecialistRouteAugmentation(baseInput(raw));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(raw);
    expect(serialized).not.toContain("metformin");
  });

  it("returns null for safety-sensitive medication language so Safety can preempt", () => {
    const result = buildMedicationSpecialistRouteAugmentation(
      baseInput("I think I took too much medication"),
    );
    expect(result).toBeNull();
  });

  it("returns null for dose-confirmation mutation requests so legacy behavior remains authoritative", () => {
    const result = buildMedicationSpecialistRouteAugmentation(
      baseInput("I took my medication"),
    );
    expect(result).toBeNull();
  });

  it.each(task17ClinicalDosingExclusionFixtures)(
    "returns null for clinical/dosing migration-ineligible request: $utterance",
    (fixture) => {
      expect(buildMedicationSpecialistRouteAugmentation(baseInput(fixture.utterance))).toBeNull();
    },
  );

  it.each(task17InteractionExclusionFixtures)(
    "returns null for interaction migration-ineligible request: $utterance",
    (fixture) => {
      expect(buildMedicationSpecialistRouteAugmentation(baseInput(fixture.utterance))).toBeNull();
    },
  );
});
