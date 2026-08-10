import { describe, expect, it } from "vitest";
import {
  SOCIAL_SUPPORT_FLOW_ID,
  SOCIAL_SUPPORT_SPECIALIST_ID,
} from "./socialSupportFlow";
import { buildSocialSupportSpecialistRouteAugmentation } from "./socialSupportRouterAdapter";
import {
  TASK19_NOW,
  TASK19_SESSION_ID,
  TASK19_USER_ID,
  task19CaregiverBoundaryFixtures,
  task19ConciergeOverlapFixtures,
  task19FlagDisabledEnv,
  task19FlagEnabledEnv,
  task19MentalWellbeingOverlapFixtures,
  task19SafetyPrecedenceFixtures,
  task19SocialParityFixtures,
  task19UnsupportedFixtures,
  task19ValidNavigationFixtures,
} from "./socialSupportFixtures";

function baseInput(utterance: string) {
  return {
    domain: "companion",
    userId: TASK19_USER_ID,
    sessionId: TASK19_SESSION_ID,
    utterance,
    turnCount: 3,
    confidence: 1,
    now: TASK19_NOW,
    env: task19FlagEnabledEnv,
    currentRoute: "/",
  };
}

describe("Social Support router adapter", () => {
  it("returns null for flag-off companion routing so legacy behavior remains exact", () => {
    expect(buildSocialSupportSpecialistRouteAugmentation({
      ...baseInput("Open social rooms."),
      env: task19FlagDisabledEnv,
    })).toBeNull();
  });

  it("returns null for unrelated domains", () => {
    expect(buildSocialSupportSpecialistRouteAugmentation({
      ...baseInput("Open social rooms."),
      domain: "concierge",
    })).toBeNull();
  });

  it.each(task19SocialParityFixtures)(
    "builds structured Social Support specialist metadata for $label",
    (fixture) => {
      const result = buildSocialSupportSpecialistRouteAugmentation(baseInput(fixture.utterance));
      expect(result).toMatchObject({
        selectedSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
        selectedFlowId: SOCIAL_SUPPORT_FLOW_ID,
        validation: "accepted",
        outcome: "tool_proposed",
        toolProposalDecision: "proposal_allowed",
        actionType: fixture.expectedActionType,
        route: fixture.expectedRoute,
        capability: fixture.expectedCapability,
        requestCategory: fixture.expectedRequestCategory,
        presentationId: fixture.expectedPresentationId,
        requiresConfirmation: "false",
        externalAction: "false",
        humanContact: "false",
        caregiverAuthority: "false",
      });
      expect(result?.dynamicVariables.social_support_specialist_selected).toBe("true");
      expect(result?.sessionData.selected_specialist_id).toBe(SOCIAL_SUPPORT_SPECIALIST_ID);
      expect(result?.promptBlock).toContain("SOCIAL SUPPORT SPECIALIST MIGRATION BLOCK");
      expect(result?.promptBlock).toContain("Do not contact, call, text");
    },
  );

  it.each(task19ValidNavigationFixtures)(
    "allows valid community/social navigation through the migrated path: %s",
    (utterance) => {
      const result = buildSocialSupportSpecialistRouteAugmentation(baseInput(utterance));
      expect(result).toMatchObject({
        validation: "accepted",
        outcome: "tool_proposed",
        toolProposalDecision: "proposal_allowed",
        externalAction: "false",
        humanContact: "false",
        caregiverAuthority: "false",
      });
    },
  );

  it.each([
    ...task19MentalWellbeingOverlapFixtures,
    ...task19ConciergeOverlapFixtures,
    ...task19CaregiverBoundaryFixtures,
    ...task19SafetyPrecedenceFixtures,
  ])("returns null for neighboring-authority or safety-sensitive request: %s", (utterance) => {
    expect(buildSocialSupportSpecialistRouteAugmentation(baseInput(utterance))).toBeNull();
  });

  it.each(task19UnsupportedFixtures)(
    "returns null for unsupported text: $utterance",
    (fixture) => {
      expect(buildSocialSupportSpecialistRouteAugmentation(baseInput(fixture.utterance))).toBeNull();
    },
  );

  it("does not leak raw Social Support private details in prompt, dynamic variables, or session data", () => {
    const raw = "Open community for my private caregiver details";
    const result = buildSocialSupportSpecialistRouteAugmentation(baseInput(raw));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(raw);
    expect(serialized).not.toContain("private caregiver details");
  });
});
