import { describe, expect, it } from "vitest";
import {
  isMedicationSafetySensitiveText,
  resolveMedicationLegacyOutcome,
} from "./medicationLegacyAdapter";
import {
  task17ClinicalDosingExclusionFixtures,
  task17InteractionExclusionFixtures,
  task17MedicationParityFixtures,
  task17UnsupportedMedicationFixtures,
  task17ValidNavigationFixtures,
} from "./medicationFixtures";

describe("Medication legacy adapter", () => {
  it.each(task17MedicationParityFixtures)(
    "preserves existing voice-action semantics for $name",
    (fixture) => {
      expect(resolveMedicationLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "supported_action",
        actionType: fixture.actionType,
        route: fixture.route,
        capability: fixture.capability,
        presentationId: fixture.presentationId,
        requiresConfirmation: fixture.requiresConfirmation,
        riskLevel: fixture.riskLevel,
        parityReference: "voice_action_registry",
      });
    },
  );

  it.each(task17ValidNavigationFixtures)(
    "keeps valid medication navigation eligible: %s",
    (utterance) => {
      expect(resolveMedicationLegacyOutcome(utterance).kind).toBe("supported_action");
    },
  );

  it.each(task17ClinicalDosingExclusionFixtures)(
    "excludes clinical/dosing migration-ineligible request: $utterance",
    (fixture) => {
      expect(resolveMedicationLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.reasonCode,
      });
    },
  );

  it.each(task17InteractionExclusionFixtures)(
    "excludes interaction migration-ineligible request: $utterance",
    (fixture) => {
      expect(resolveMedicationLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.reasonCode,
      });
    },
  );

  it.each(task17UnsupportedMedicationFixtures)(
    "keeps $name outside the migrated specialist slice",
    (fixture) => {
      expect(resolveMedicationLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "fallback_to_legacy",
        reasonCode: fixture.reasonCode,
      });
    },
  );

  it.each([
    "I overdosed on my tablets.",
    "I think I took too much medication.",
    "I took a double dose of my pill.",
    "I accidentally mixed my medication with alcohol.",
    "I have a severe allergic reaction after medicine.",
    "I fainted after taking my medication.",
    "I am suicidal and may overdose on pills.",
  ])("detects safety-sensitive medication wording: %s", (utterance) => {
    expect(isMedicationSafetySensitiveText(utterance)).toBe(true);
    expect(resolveMedicationLegacyOutcome(utterance)).toMatchObject({
      kind: "fallback_to_legacy",
      reasonCode: "medication_safety_preempted",
    });
  });

  it("does not treat ordinary medication management as safety-sensitive", () => {
    expect(isMedicationSafetySensitiveText("Can you help me with my medication schedule?")).toBe(false);
  });
});
