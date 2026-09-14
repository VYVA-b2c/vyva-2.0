import { describe, expect, it } from "vitest";
import {
  CONCIERGE_FLOW_ID,
  CONCIERGE_SPECIALIST_ID,
} from "./conciergeFlow";
import { buildConciergeSpecialistRouteAugmentation } from "./conciergeRouterAdapter";
import {
  TASK18_NOW,
  TASK18_SESSION_ID,
  TASK18_USER_ID,
  task18ConciergeParityFixtures,
  task18ExternalExecutionFixtures,
  task18FlagDisabledEnv,
  task18FlagEnabledEnv,
  task18SafetyPrecedenceFixtures,
  task18UnsupportedFixtures,
  task18ValidNavigationFixtures,
} from "./conciergeFixtures";

function baseInput(utterance: string) {
  return {
    domain: "concierge",
    userId: TASK18_USER_ID,
    sessionId: TASK18_SESSION_ID,
    utterance,
    turnCount: 2,
    confidence: 1,
    now: new Date(TASK18_NOW),
    env: task18FlagEnabledEnv,
    currentRoute: "/",
  };
}

describe("Concierge router adapter", () => {
  it("returns null for flag-off Concierge routing so legacy behavior remains exact", () => {
    expect(buildConciergeSpecialistRouteAugmentation({
      ...baseInput("Open Concierge."),
      env: task18FlagDisabledEnv,
    })).toBeNull();
  });

  it("returns null for unrelated domains", () => {
    expect(buildConciergeSpecialistRouteAugmentation({
      ...baseInput("Open Concierge."),
      domain: "health",
    })).toBeNull();
  });

  it.each(task18ConciergeParityFixtures)(
    "builds structured Concierge specialist metadata for $label",
    (fixture) => {
      const result = buildConciergeSpecialistRouteAugmentation(baseInput(fixture.utterance));
      expect(result).toMatchObject({
        selectedSpecialistId: CONCIERGE_SPECIALIST_ID,
        selectedFlowId: CONCIERGE_FLOW_ID,
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
      });
      expect(result?.dynamicVariables.concierge_specialist_selected).toBe("true");
      expect(result?.sessionData.selected_specialist_id).toBe(CONCIERGE_SPECIALIST_ID);
      expect(result?.promptBlock).toContain("CONCIERGE SPECIALIST MIGRATION BLOCK");
      expect(result?.promptBlock).toContain("Do not book, reserve, cancel, order");
    },
  );

  it.each(task18ValidNavigationFixtures)(
    "allows valid navigation/context request through the migrated path: %s",
    (utterance) => {
      const result = buildConciergeSpecialistRouteAugmentation(baseInput(utterance));
      expect(result).toMatchObject({
        validation: "accepted",
        outcome: "tool_proposed",
        toolProposalDecision: "proposal_allowed",
        externalAction: "false",
      });
    },
  );

  it.each(task18ExternalExecutionFixtures)(
    "returns null for real-world execution request: $utterance",
    (fixture) => {
      expect(buildConciergeSpecialistRouteAugmentation(baseInput(fixture.utterance))).toBeNull();
    },
  );

  it.each(task18SafetyPrecedenceFixtures)(
    "returns null for safety-sensitive Concierge request: %s",
    (utterance) => {
      expect(buildConciergeSpecialistRouteAugmentation(baseInput(utterance))).toBeNull();
    },
  );

  it.each(task18UnsupportedFixtures)(
    "returns null for unsupported or stale confirmation text: $utterance",
    (fixture) => {
      expect(buildConciergeSpecialistRouteAugmentation(baseInput(fixture.utterance))).toBeNull();
    },
  );

  it("does not leak raw Concierge private details in prompt, dynamic variables, or session data", () => {
    const raw = "Open Concierge for my private family details";
    const result = buildConciergeSpecialistRouteAugmentation(baseInput(raw));
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(raw);
    expect(serialized).not.toContain("private family details");
  });
});
