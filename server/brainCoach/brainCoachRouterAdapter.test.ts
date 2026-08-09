import { describe, expect, it } from "vitest";
import {
  BRAIN_COACH_FLOW_ID,
  BRAIN_COACH_SPECIALIST_ID,
} from "./brainCoachFlow";
import { buildBrainCoachSpecialistRouteAugmentation } from "./brainCoachRouterAdapter";
import {
  TASK15_NOW,
  TASK15_SESSION_ID,
  TASK15_USER_ID,
  task15BrainCoachDisabledEnv,
  task15BrainCoachEnabledEnv,
  task15UnsupportedFixture,
} from "./brainCoachFixtures";

const baseInput = {
  domain: "brain_coach",
  userId: TASK15_USER_ID,
  sessionId: TASK15_SESSION_ID,
  utterance: "Can we do a memory game?",
  turnCount: 3,
  confidence: 1,
  now: new Date(TASK15_NOW),
};

describe("Brain Coach router adapter", () => {
  it("returns null for flag-off Brain Coach routing so legacy behavior remains exact", () => {
    expect(buildBrainCoachSpecialistRouteAugmentation({
      ...baseInput,
      env: task15BrainCoachDisabledEnv,
    })).toBeNull();
  });

  it("returns null for unrelated domains", () => {
    expect(buildBrainCoachSpecialistRouteAugmentation({
      ...baseInput,
      domain: "health",
      env: task15BrainCoachEnabledEnv,
    })).toBeNull();
  });

  it("builds a structured Brain Coach specialist augmentation when enabled", () => {
    const result = buildBrainCoachSpecialistRouteAugmentation({
      ...baseInput,
      env: task15BrainCoachEnabledEnv,
    });
    expect(result).toMatchObject({
      selectedSpecialistId: BRAIN_COACH_SPECIALIST_ID,
      selectedFlowId: BRAIN_COACH_FLOW_ID,
      validation: "accepted",
      outcome: "tool_proposed",
      toolAuthorizationDecision: "approved",
      actionType: "brain.memory_game",
      route: "/memory-games",
    });
    expect(result?.dynamicVariables.brain_coach_specialist_selected).toBe("true");
    expect(result?.sessionData.selected_specialist_id).toBe(BRAIN_COACH_SPECIALIST_ID);
    expect(result?.promptBlock).toContain("BRAIN COACH SPECIALIST MIGRATION BLOCK");
  });

  it("does not leak raw utterance in prompt, dynamic variables, or session data", () => {
    const utterance = "private phrase about my brain game";
    const result = buildBrainCoachSpecialistRouteAugmentation({
      ...baseInput,
      utterance,
      env: task15BrainCoachEnabledEnv,
    });
    expect(JSON.stringify(result)).not.toContain(utterance);
  });

  it("preserves unsupported requests as a safe legacy fallback", () => {
    const result = buildBrainCoachSpecialistRouteAugmentation({
      ...baseInput,
      utterance: task15UnsupportedFixture.utterance,
      env: task15BrainCoachEnabledEnv,
    });
    expect(result).toMatchObject({
      validation: "accepted",
      outcome: "fallback_to_legacy",
      toolAuthorizationDecision: "not_required",
      reasonCode: task15UnsupportedFixture.reasonCode,
    });
    expect(result?.route).toBeUndefined();
  });
});
