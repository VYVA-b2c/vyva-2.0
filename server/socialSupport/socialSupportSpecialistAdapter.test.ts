import { describe, expect, it } from "vitest";
import type { SpecialistResponse } from "../../shared/orchestration/specialist";
import {
  SOCIAL_SUPPORT_FLOW_ID,
  SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
  SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
  SOCIAL_SUPPORT_SCENE_ID,
  SOCIAL_SUPPORT_SPECIALIST_ID,
} from "./socialSupportFlow";
import {
  createSocialSupportSpecialistRequest,
  proposeSocialSupportSpecialistResponse,
  validateSocialSupportSpecialistProposal,
} from "./socialSupportSpecialistAdapter";
import {
  task19CaregiverBoundaryFixtures,
  task19ConciergeOverlapFixtures,
  task19MentalWellbeingOverlapFixtures,
  task19SafetyPrecedenceFixtures,
  task19SocialParityFixtures,
  task19SpecialistInput,
} from "./socialSupportFixtures";

function requestFor(utterance: string, overrides = {}) {
  return createSocialSupportSpecialistRequest({
    ...task19SpecialistInput,
    utterance,
    ...overrides,
  });
}

describe("Social Support Specialist adapter", () => {
  it.each(task19SocialParityFixtures)(
    "preserves legacy parity for $label",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeSocialSupportSpecialistResponse({ request });
      const validation = validateSocialSupportSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("proposed_action");
      expect(response.specialistId).toBe(SOCIAL_SUPPORT_SPECIALIST_ID);
      expect(response.proposedToolCalls).toHaveLength(1);
      expect(response.proposedToolCalls[0]).toMatchObject({
        toolId: SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
        arguments: {
          domain: "social",
          action_type: fixture.expectedActionType,
          route: fixture.expectedRoute,
          capability: fixture.expectedCapability,
          request_category: fixture.expectedRequestCategory,
          presentation_id: fixture.expectedPresentationId,
          external_action: false,
          confirmation_required: false,
          human_contact: false,
          caregiver_authority: false,
        },
        riskLevel: "low",
        requiresConfirmation: false,
      });
      expect(response.uiInstructions[0]).toMatchObject({
        type: "show_summary",
        sceneId: SOCIAL_SUPPORT_SCENE_ID,
      });
      expect(response.flowStateUpdate?.nextLifecycleState).toBe("waiting_for_tool");
    },
  );

  it("does not place raw social/caregiver-sensitive speech into request or response payloads", () => {
    const raw = "Open community for my private family and caregiver details";
    const request = requestFor(raw);
    const response = proposeSocialSupportSpecialistResponse({ request });

    expect(JSON.stringify(request)).not.toContain(raw);
    expect(JSON.stringify(response)).not.toContain(raw);
    expect(JSON.stringify({ request, response })).not.toContain("private family");
    expect(request.userInput.kind).toBe("event_reference");
    expect(request.normalizedInput.type).toBe("event_reference");
  });

  it.each([
    ...task19MentalWellbeingOverlapFixtures,
    ...task19ConciergeOverlapFixtures,
    ...task19CaregiverBoundaryFixtures,
  ])("preserves neighboring authority as legacy fallback: %s", (utterance) => {
    const request = requestFor(utterance);
    const response = proposeSocialSupportSpecialistResponse({ request });
    const validation = validateSocialSupportSpecialistProposal(request, response);
    expect(validation.ok).toBe(true);
    expect(response).toMatchObject({
      status: "complete",
      proposedToolCalls: [],
      completionResult: {
        outcome: "fallback_to_legacy",
        presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
        finalDecisionAuthority: "central_orchestrator",
      },
    });
  });

  it("rejects unavailable or arbitrary tool proposals", () => {
    const request = requestFor("Open community", { availableTools: [] });
    const response = proposeSocialSupportSpecialistResponse({ request });
    expect(validateSocialSupportSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });

    const allowedRequest = requestFor("Open community");
    const allowedResponse = proposeSocialSupportSpecialistResponse({ request: allowedRequest });
    const arbitraryTool: SpecialistResponse = {
      ...allowedResponse,
      proposedToolCalls: [{
        ...allowedResponse.proposedToolCalls[0],
        toolId: "tool.social.contact_caregiver",
      }],
    };
    expect(validateSocialSupportSpecialistProposal(allowedRequest, arbitraryTool))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });
  });

  it("rejects human-contact, caregiver, escalation, permission, schedule, task, and memory authority", () => {
    const request = requestFor("Open social rooms");
    const response = proposeSocialSupportSpecialistResponse({ request });
    for (const forbiddenPatch of [{
      caregiver_id: "caregiver-1",
    }, {
      phone: "+15555555555",
    }, {
      message_body: "Tell my daughter.",
    }, {
      grant_access: true,
    }, {
      operator: "operator-1",
    }, {
      escalation: true,
    }, {
      create_task: true,
    }, {
      writeMemory: true,
    }]) {
      const invalid: SpecialistResponse = {
        ...response,
        proposedToolCalls: [{
          ...response.proposedToolCalls[0],
          arguments: {
            ...response.proposedToolCalls[0].arguments,
            ...forbiddenPatch,
          },
        }],
      };
      expect(validateSocialSupportSpecialistProposal(request, invalid))
        .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });
    }
  });

  it("rejects direct memory, escalation, and follow-up authority", () => {
    const request = requestFor("Open social rooms");
    const response = proposeSocialSupportSpecialistResponse({ request });
    const memoryWriteResponse: SpecialistResponse = {
      ...response,
      memoryWritesProposed: [{
        category: "social_support",
        value: { text: "raw disclosure" },
        sensitivity: "sensitive",
        reason: "Not allowed in Task 19.",
        requiresUserConfirmation: true,
        target: "mem0",
      }],
    };
    expect(validateSocialSupportSpecialistProposal(request, memoryWriteResponse))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });

    const escalationResponse: SpecialistResponse = {
      ...response,
      status: "escalated",
      proposedToolCalls: [],
      escalation: {
        type: "caregiver",
        reasonCode: "not_allowed",
        urgency: "routine",
        summary: "Not in Task 19 scope.",
        requiresConsent: true,
      },
    };
    expect(validateSocialSupportSpecialistProposal(request, escalationResponse))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });
  });

  it("preserves global safety precedence by rejecting ordinary output for emergency input", () => {
    const request = requestFor("Open social rooms", {
      safetyResult: "emergency",
      safetyFlags: ["safety.emergency"],
    });
    const response = proposeSocialSupportSpecialistResponse({ request });
    expect(validateSocialSupportSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });
  });

  it.each(task19SafetyPrecedenceFixtures)(
    "keeps safety-sensitive fixture outside proposed action path: %s",
    (utterance) => {
      const request = requestFor(utterance);
      const response = proposeSocialSupportSpecialistResponse({ request });
      const validation = validateSocialSupportSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("complete");
      expect(response.proposedToolCalls).toHaveLength(0);
      expect(response.completionResult).toMatchObject({
        outcome: "fallback_to_legacy",
        reasonCode: "social_support_safety_preempted",
      });
    },
  );

  it("respects active-flow transition ownership", () => {
    const request = requestFor("Open community", { currentState: "waiting_for_user" });
    const response = proposeSocialSupportSpecialistResponse({ request });
    expect(validateSocialSupportSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "social_support_specialist_contract_invalid" });
  });

  it("is idempotent for duplicate equivalent events", () => {
    const first = requestFor("Open social rooms.");
    const second = requestFor("Open social rooms.");
    const firstResponse = proposeSocialSupportSpecialistResponse({ request: first });
    const secondResponse = proposeSocialSupportSpecialistResponse({ request: second });
    expect(firstResponse.proposedToolCalls[0].idempotencyKey)
      .toBe(secondResponse.proposedToolCalls[0].idempotencyKey);
    expect(firstResponse.proposedToolCalls[0].arguments)
      .toEqual(secondResponse.proposedToolCalls[0].arguments);
  });

  it("keeps Social Support as proposal-only with no durable source of truth", () => {
    const request = requestFor("Open community activities.");
    const response = proposeSocialSupportSpecialistResponse({ request });
    const serialized = JSON.stringify({ request, response });
    expect(serialized).toContain(SOCIAL_SUPPORT_FLOW_ID);
    expect(serialized).toContain("caregiverPermissionBoundaryUnchanged");
    expect(serialized).not.toContain("caregiver_id");
    expect(serialized).not.toContain("message_body");
    expect(serialized).not.toContain("permission_granted");
    expect(serialized).not.toContain("writeMemory");
  });
});
