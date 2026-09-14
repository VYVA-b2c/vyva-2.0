import { describe, expect, it } from "vitest";
import {
  buildMentalWellbeingSpecialistRouteAugmentation,
} from "./mentalWellbeingRouterAdapter";
import {
  MENTAL_WELLBEING_PARITY_FIXTURES,
  MENTAL_WELLBEING_SPECIALIST_ENABLED_ENV,
  MENTAL_WELLBEING_UNSUPPORTED_FIXTURE,
  TASK16_NOW,
  TASK16_SESSION_ID,
  TASK16_USER_ID,
} from "./mentalWellbeingFixtures";

function baseInput(utterance: string) {
  return {
    domain: "companion",
    userId: TASK16_USER_ID,
    sessionId: TASK16_SESSION_ID,
    utterance,
    turnCount: 1,
    confidence: 1,
    now: TASK16_NOW,
    env: MENTAL_WELLBEING_SPECIALIST_ENABLED_ENV,
    currentRoute: "/",
  };
}

describe("Mental Wellbeing router adapter", () => {
  it("is unreachable when the specialist flag is disabled", () => {
    expect(buildMentalWellbeingSpecialistRouteAugmentation({
      ...baseInput("I feel stressed"),
      env: {},
    })).toBeNull();
  });

  it("does not capture unrelated or non-companion domains", () => {
    expect(buildMentalWellbeingSpecialistRouteAugmentation({
      ...baseInput("I feel stressed"),
      domain: "health",
    })).toBeNull();

    expect(buildMentalWellbeingSpecialistRouteAugmentation({
      ...baseInput("open the weather please"),
    })).toBeNull();
  });

  it.each(MENTAL_WELLBEING_PARITY_FIXTURES)(
    "adds structured Specialist metadata for $label",
    (fixture) => {
      const result = buildMentalWellbeingSpecialistRouteAugmentation(baseInput(fixture.utterance));

      expect(result).toMatchObject({
        validation: "accepted",
        outcome: "support_ready",
        selectedSpecialistId: "mental_wellbeing",
        selectedFlowId: "wellbeing.support",
        selectedFlowVersion: "1.0.0",
        presentationId: fixture.presentationId,
        presentationFamilyId: "presentation.family.summary",
        supportIntent: fixture.supportIntent,
        toolProposalValidation: "not_required",
      });
      expect(result?.promptBlock).toContain("MENTAL WELLBEING SPECIALIST MIGRATION BLOCK");
      expect(result?.promptBlock).toContain("do not diagnose");
      expect(result?.dynamicVariables.mental_wellbeing_support_intent).toBe(fixture.supportIntent);
      expect(result?.sessionData.tool_proposal_validation).toBe("not_required");
    },
  );

  it("preserves legacy fallback for unsupported clinical requests", () => {
    const result = buildMentalWellbeingSpecialistRouteAugmentation(
      baseInput(MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.utterance),
    );

    expect(result).toMatchObject({
      validation: "accepted",
      outcome: "fallback_to_legacy",
      presentationId: "presentation.wellbeing.support.safe_fallback",
      reasonCode: `mental_wellbeing.reason.${MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.reasonCode}`,
    });
  });

  it.each([
    "I cannot breathe.",
    "I can barely breathe.",
    "I am unable to breathe.",
    "I'm struggling to breathe.",
    "I need help.",
    "I overdosed.",
    "I think I took an overdose.",
    "I'm in danger.",
    "I'm depressed and thinking about dying.",
  ])("fails explicit emergency-style input out of Mental Wellbeing routing: %s", (utterance) => {
    const result = buildMentalWellbeingSpecialistRouteAugmentation(baseInput(utterance));

    expect(result).toBeNull();
  });

  it("keeps ordinary voluntary breathing requests supported at the adapter boundary", () => {
    const result = buildMentalWellbeingSpecialistRouteAugmentation(
      baseInput("I feel stressed and want to practice breathing."),
    );

    expect(result).toMatchObject({
      validation: "accepted",
      outcome: "support_ready",
      supportIntent: "grounding_or_breathing",
      presentationId: "presentation.wellbeing.support.summary",
    });
  });

  it("does not include raw wellbeing disclosure in prompt, dynamic variables, or session data", () => {
    const raw = "I feel anxious about my private family argument";
    const result = buildMentalWellbeingSpecialistRouteAugmentation(baseInput(raw));

    expect(JSON.stringify(result)).not.toContain(raw);
  });
});
