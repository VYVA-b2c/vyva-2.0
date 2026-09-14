import { describe, expect, it } from "vitest";
import {
  isMentalWellbeingSafetyOrCrisisText,
  resolveMentalWellbeingLegacyOutcome,
} from "./mentalWellbeingLegacyAdapter";
import {
  MENTAL_WELLBEING_PARITY_FIXTURES,
  MENTAL_WELLBEING_SAFETY_FIXTURE,
  MENTAL_WELLBEING_UNSUPPORTED_FIXTURE,
} from "./mentalWellbeingFixtures";

describe("Mental Wellbeing legacy boundary adapter", () => {
  it.each(MENTAL_WELLBEING_PARITY_FIXTURES)(
    "maps $label to existing companion/social support semantics",
    (fixture) => {
      expect(resolveMentalWellbeingLegacyOutcome(fixture.utterance)).toMatchObject({
        kind: "supported_support",
        legacyDomain: "companion",
        semanticAction: "continue_companion_support",
        supportIntent: fixture.supportIntent,
        presentationId: fixture.presentationId,
      });
    },
  );

  it("rejects clinical/diagnostic requests into legacy fallback", () => {
    expect(resolveMentalWellbeingLegacyOutcome(MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.utterance))
      .toMatchObject({
        kind: "fallback",
        reasonCode: MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.reasonCode,
      });
  });

  it("identifies safety/crisis language before ordinary wellbeing support", () => {
    expect(isMentalWellbeingSafetyOrCrisisText(MENTAL_WELLBEING_SAFETY_FIXTURE.utterance))
      .toBe(true);
    expect(resolveMentalWellbeingLegacyOutcome(MENTAL_WELLBEING_SAFETY_FIXTURE.utterance))
      .toMatchObject({
        kind: "fallback",
        reasonCode: MENTAL_WELLBEING_SAFETY_FIXTURE.reasonCode,
      });
  });

  it.each([
    "I cannot breathe.",
    "I can barely breathe.",
    "I can't breathe.",
    "I cant breathe.",
    "I am unable to breathe.",
    "I'm unable to breathe.",
    "I can hardly breathe.",
    "I am struggling to breathe.",
    "I'm struggling to breathe.",
  ])("fails emergency-style breathing language out of Mental Wellbeing: %s", (utterance) => {
    expect(isMentalWellbeingSafetyOrCrisisText(utterance)).toBe(true);
    expect(resolveMentalWellbeingLegacyOutcome(utterance)).toMatchObject({
      kind: "fallback",
      reasonCode: "mental_wellbeing_safety_preempted",
      parityReference: "existing_safety_precedence",
    });
  });

  it.each([
    "Can you help me with a breathing exercise?",
    "I want to calm down and breathe.",
    "Can we do a grounding exercise?",
    "I feel stressed and want to practice breathing.",
  ])("keeps voluntary calming and breathing requests eligible for ordinary support: %s", (utterance) => {
    expect(isMentalWellbeingSafetyOrCrisisText(utterance)).toBe(false);
    expect(resolveMentalWellbeingLegacyOutcome(utterance)).toMatchObject({
      kind: "supported_support",
      supportIntent: "grounding_or_breathing",
    });
  });
});
