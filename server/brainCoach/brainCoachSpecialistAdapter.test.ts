import { describe, expect, it } from "vitest";
import {
  type SpecialistResponse,
} from "../../shared/orchestration/specialist";
import {
  BRAIN_COACH_FLOW_ID,
  BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
  BRAIN_COACH_SPECIALIST_ID,
} from "./brainCoachFlow";
import {
  createBrainCoachSpecialistRequest,
  proposeBrainCoachSpecialistResponse,
  validateBrainCoachSpecialistProposal,
} from "./brainCoachSpecialistAdapter";
import {
  task15BrainCoachParityFixtures,
  task15SpecialistInput,
  task15UnsupportedFixture,
} from "./brainCoachFixtures";

function requestFor(utterance: string, overrides = {}) {
  return createBrainCoachSpecialistRequest({
    ...task15SpecialistInput,
    utterance,
    ...overrides,
  });
}

describe("Brain Coach Specialist adapter", () => {
  it.each(task15BrainCoachParityFixtures)(
    "preserves legacy parity for $name",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeBrainCoachSpecialistResponse({ request });
      const validation = validateBrainCoachSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("proposed_action");
      expect(response.specialistId).toBe(BRAIN_COACH_SPECIALIST_ID);
      expect(response.proposedToolCalls).toHaveLength(1);
      expect(response.proposedToolCalls[0]).toMatchObject({
        toolId: BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
        arguments: {
          domain: "brain_coach",
          action_type: fixture.actionType,
          route: fixture.route,
          activity_family: fixture.activityFamily,
        },
        riskLevel: "low",
        requiresConfirmation: false,
      });
      if (fixture.activityType) {
        expect(response.proposedToolCalls[0].arguments.activity_type)
          .toBe(fixture.activityType);
      }
      expect(response.flowStateUpdate?.nextLifecycleState).toBe("waiting_for_tool");
    },
  );

  it("does not place raw utterance into the Specialist request boundary", () => {
    const utterance = "My private exact speech should not be copied";
    const request = requestFor(utterance);
    expect(JSON.stringify(request)).not.toContain(utterance);
    expect(request.userInput.kind).toBe("event_reference");
    expect(request.normalizedInput.type).toBe("event_reference");
  });

  it("preserves unsupported or coming-soon Brain Coach behavior as legacy fallback", () => {
    const request = requestFor(task15UnsupportedFixture.utterance);
    const response = proposeBrainCoachSpecialistResponse({ request });
    const validation = validateBrainCoachSpecialistProposal(request, response);
    expect(validation.ok).toBe(true);
    expect(response).toMatchObject({
      status: "complete",
      proposedToolCalls: [],
      completionResult: {
        outcome: "unsupported_coming_soon",
        reasonCode: task15UnsupportedFixture.reasonCode,
        finalDecisionAuthority: "central_orchestrator",
      },
    });
  });

  it("fails safely for unrecognized Brain Coach requests", () => {
    const request = requestFor("");
    const response = proposeBrainCoachSpecialistResponse({ request });
    const validation = validateBrainCoachSpecialistProposal(request, response);
    expect(validation.ok).toBe(true);
    expect(response.proposedToolCalls).toHaveLength(0);
    expect(response.completionResult).toMatchObject({
      outcome: "fallback_to_legacy",
      reasonCode: "brain_coach_not_recognized",
    });
  });

  it("rejects unauthorized tool proposals", () => {
    const request = requestFor("memory game", { availableTools: [] });
    const response = proposeBrainCoachSpecialistResponse({ request });
    expect(validateBrainCoachSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("rejects invalid direct-execution or memory-authority output", () => {
    const request = requestFor("memory game");
    const response = proposeBrainCoachSpecialistResponse({ request });
    const invalidResponse: SpecialistResponse = {
      ...response,
      proposedToolCalls: [{
        ...response.proposedToolCalls[0],
        arguments: {
          ...response.proposedToolCalls[0].arguments,
          execute: true,
        },
      }],
    };
    expect(validateBrainCoachSpecialistProposal(request, invalidResponse))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const memoryWriteResponse: SpecialistResponse = {
      ...response,
      memoryWritesProposed: [{
        category: "brain_coach",
        value: { activity: "memory" },
        sensitivity: "internal",
        reason: "Not allowed in Task 15.",
        requiresUserConfirmation: false,
        target: "working_memory",
      }],
    };
    expect(validateBrainCoachSpecialistProposal(request, memoryWriteResponse))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("preserves global safety precedence by rejecting ordinary Brain Coach output for emergency input", () => {
    const request = requestFor("memory game", {
      safetyResult: "emergency",
      safetyFlags: ["safety.emergency"],
    });
    const response = proposeBrainCoachSpecialistResponse({ request });
    expect(validateBrainCoachSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("respects active-flow transition ownership", () => {
    const request = requestFor("memory game", { currentState: "waiting_for_user" });
    const response = proposeBrainCoachSpecialistResponse({ request });
    expect(validateBrainCoachSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("is idempotent for duplicate equivalent events", () => {
    const first = requestFor("memory game");
    const second = requestFor("memory game");
    const firstResponse = proposeBrainCoachSpecialistResponse({ request: first });
    const secondResponse = proposeBrainCoachSpecialistResponse({ request: second });
    expect(firstResponse.proposedToolCalls[0].idempotencyKey)
      .toBe(secondResponse.proposedToolCalls[0].idempotencyKey);
    expect(firstResponse.proposedToolCalls[0].arguments)
      .toEqual(secondResponse.proposedToolCalls[0].arguments);
  });

  it("keeps caregiver, scheduling, provider, and game-persistence boundaries out of Specialist authority", () => {
    const request = requestFor("memory game");
    const response = proposeBrainCoachSpecialistResponse({ request });
    const serialized = JSON.stringify({
      request,
      response,
    });
    expect(serialized).toContain(BRAIN_COACH_FLOW_ID);
    expect(serialized).not.toContain("caregiver_permission");
    expect(serialized).not.toContain("supabase");
    expect(serialized).not.toContain("localStorage");
    expect(serialized).not.toContain("provider_call");
  });
});
