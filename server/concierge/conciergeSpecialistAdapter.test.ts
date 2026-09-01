import { describe, expect, it } from "vitest";
import type { SpecialistResponse } from "../../shared/orchestration/specialist";
import {
  CONCIERGE_FLOW_ID,
  CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
  CONCIERGE_SPECIALIST_ID,
} from "./conciergeFlow";
import {
  createConciergeSpecialistRequest,
  proposeConciergeSpecialistResponse,
  validateConciergeSpecialistProposal,
} from "./conciergeSpecialistAdapter";
import {
  task18ConciergeParityFixtures,
  task18ExternalExecutionFixtures,
  task18SafetyPrecedenceFixtures,
  task18SpecialistInput,
  task18UnsupportedFixtures,
} from "./conciergeFixtures";

function requestFor(utterance: string, overrides = {}) {
  return createConciergeSpecialistRequest({
    ...task18SpecialistInput,
    utterance,
    ...overrides,
  });
}

describe("Concierge Specialist adapter", () => {
  it.each(task18ConciergeParityFixtures)(
    "preserves legacy parity for $label",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeConciergeSpecialistResponse({ request });
      const validation = validateConciergeSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("proposed_action");
      expect(response.specialistId).toBe(CONCIERGE_SPECIALIST_ID);
      expect(response.proposedToolCalls).toHaveLength(1);
      expect(response.proposedToolCalls[0]).toMatchObject({
        toolId: CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
        arguments: {
          domain: "concierge",
          action_type: fixture.expectedActionType,
          route: fixture.expectedRoute,
          capability: fixture.expectedCapability,
          request_category: fixture.expectedRequestCategory,
          presentation_id: fixture.expectedPresentationId,
          external_action: false,
          confirmation_required: false,
        },
        riskLevel: "low",
        requiresConfirmation: false,
      });
      expect(response.uiInstructions[0]).toMatchObject({
        type: "show_summary",
        sceneId: "concierge.administrative_support.main",
      });
      expect(response.flowStateUpdate?.nextLifecycleState).toBe("waiting_for_tool");
    },
  );

  it("does not place raw Concierge speech, addresses, payment terms, or provider details into the request boundary", () => {
    const utterance = "Open Concierge for private family details at 123 Main Street with card ending 1234";
    const request = requestFor(utterance);
    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain(utterance);
    expect(serialized).not.toContain("123 Main Street");
    expect(serialized).not.toContain("card ending");
    expect(request.userInput.kind).toBe("event_reference");
    expect(request.normalizedInput.type).toBe("event_reference");
  });

  it.each(task18ExternalExecutionFixtures)(
    "preserves real-world execution request as legacy fallback: $utterance",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeConciergeSpecialistResponse({ request });
      const validation = validateConciergeSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response).toMatchObject({
        status: "complete",
        proposedToolCalls: [],
        completionResult: {
          outcome: "fallback_to_legacy",
          reasonCode: fixture.expectedReasonCode,
          finalDecisionAuthority: "central_orchestrator",
        },
      });
    },
  );

  it.each(task18UnsupportedFixtures)(
    "preserves unsupported or stale confirmation text as legacy fallback: $utterance",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeConciergeSpecialistResponse({ request });
      const validation = validateConciergeSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response).toMatchObject({
        status: "complete",
        proposedToolCalls: [],
        completionResult: {
          outcome: "fallback_to_legacy",
          reasonCode: fixture.expectedReasonCode,
        },
      });
    },
  );

  it("rejects unavailable or arbitrary tool proposals", () => {
    const request = requestFor("Open Concierge", { availableTools: [] });
    const response = proposeConciergeSpecialistResponse({ request });
    expect(validateConciergeSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const allowedRequest = requestFor("Open Concierge");
    const allowedResponse = proposeConciergeSpecialistResponse({ request: allowedRequest });
    const arbitraryTool: SpecialistResponse = {
      ...allowedResponse,
      proposedToolCalls: [{
        ...allowedResponse.proposedToolCalls[0],
        toolId: "tool.concierge.book_taxi",
      }],
    };
    expect(validateConciergeSpecialistProposal(allowedRequest, arbitraryTool))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("rejects booking, provider-contact, payment, task, caregiver, scheduling, or memory authority in tool arguments", () => {
    const request = requestFor("Open Concierge");
    const response = proposeConciergeSpecialistResponse({ request });
    for (const forbiddenPatch of [{
      booking_id: "booking-1",
    }, {
      provider_phone: "+15555555555",
    }, {
      payment: true,
    }, {
      create_task: true,
    }, {
      caregiver: "caregiver-1",
    }, {
      address: "123 Main Street",
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
      expect(validateConciergeSpecialistProposal(request, invalid))
        .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
    }
  });

  it("rejects direct memory, escalation, and follow-up authority", () => {
    const request = requestFor("Open Concierge");
    const response = proposeConciergeSpecialistResponse({ request });
    const memoryWriteResponse: SpecialistResponse = {
      ...response,
      memoryWritesProposed: [{
        category: "concierge",
        value: { private_request: "call provider" },
        sensitivity: "sensitive",
        reason: "Not allowed in Task 18.",
        requiresUserConfirmation: true,
        target: "mem0",
      }],
    };
    expect(validateConciergeSpecialistProposal(request, memoryWriteResponse))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const followUpResponse: SpecialistResponse = {
      ...response,
      followUpRecommendation: {
        purpose: "Schedule Concierge follow-up",
        preferredChannel: "voice",
        fallbackChannels: ["voice"],
        requiresConsent: true,
        reason: "Not in Task 18 scope.",
        delaySeconds: 3600,
        summary: "Not allowed.",
      },
    };
    expect(validateConciergeSpecialistProposal(request, followUpResponse))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("preserves global safety precedence by rejecting ordinary Concierge output for emergency input", () => {
    const request = requestFor("Open Concierge", {
      safetyResult: "emergency",
      safetyFlags: ["safety.emergency"],
    });
    const response = proposeConciergeSpecialistResponse({ request });
    expect(validateConciergeSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it.each(task18SafetyPrecedenceFixtures)(
    "keeps safety-sensitive Concierge fixture outside proposed action path: %s",
    (utterance) => {
      const request = requestFor(utterance);
      const response = proposeConciergeSpecialistResponse({ request });
      const validation = validateConciergeSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("complete");
      expect(response.proposedToolCalls).toHaveLength(0);
      expect(response.completionResult).toMatchObject({
        outcome: "fallback_to_legacy",
        reasonCode: "concierge_safety_preempted",
      });
    },
  );

  it("respects active-flow transition ownership", () => {
    const request = requestFor("Open Concierge", { currentState: "waiting_for_user" });
    const response = proposeConciergeSpecialistResponse({ request });
    expect(validateConciergeSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("is idempotent for duplicate equivalent events", () => {
    const first = requestFor("Open shopping helper.");
    const second = requestFor("Open shopping helper.");
    const firstResponse = proposeConciergeSpecialistResponse({ request: first });
    const secondResponse = proposeConciergeSpecialistResponse({ request: second });
    expect(firstResponse.proposedToolCalls[0].idempotencyKey)
      .toBe(secondResponse.proposedToolCalls[0].idempotencyKey);
    expect(firstResponse.proposedToolCalls[0].arguments)
      .toEqual(secondResponse.proposedToolCalls[0].arguments);
  });

  it("keeps Concierge as proposal-only with no durable source of truth", () => {
    const request = requestFor("Open Trusted Help.");
    const response = proposeConciergeSpecialistResponse({ request });
    const serialized = JSON.stringify({ request, response });
    expect(serialized).toContain(CONCIERGE_FLOW_ID);
    expect(serialized).toContain("trustedHelpAuthorizationUnchanged");
    expect(serialized).not.toContain("provider_id");
    expect(serialized).not.toContain("booking_id");
    expect(serialized).not.toContain("payment_authorized");
    expect(serialized).not.toContain("caregiver_permission");
    expect(serialized).not.toContain("writeMemory");
  });
});
