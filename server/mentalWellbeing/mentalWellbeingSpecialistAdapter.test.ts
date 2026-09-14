import { describe, expect, it } from "vitest";
import type { SpecialistResponse } from "../../shared/orchestration/specialist";
import {
  MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
  MENTAL_WELLBEING_FLOW_ID,
  MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
  MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
} from "./mentalWellbeingFlow";
import {
  createMentalWellbeingSpecialistRequest,
  proposeMentalWellbeingSpecialistResponse,
  validateMentalWellbeingSpecialistProposal,
} from "./mentalWellbeingSpecialistAdapter";
import {
  MENTAL_WELLBEING_PARITY_FIXTURES,
  MENTAL_WELLBEING_SAFETY_FIXTURE,
  MENTAL_WELLBEING_UNSUPPORTED_FIXTURE,
  TASK16_NOW,
  TASK16_SESSION_ID,
  TASK16_USER_ID,
} from "./mentalWellbeingFixtures";

function requestFor(utterance: string, overrides = {}) {
  return createMentalWellbeingSpecialistRequest({
    requestId: "request.mental_wellbeing.test",
    correlationId: "correlation.mental_wellbeing.test",
    userId: TASK16_USER_ID,
    sessionId: TASK16_SESSION_ID,
    flowInstanceId: "flow_instance.mental_wellbeing.test",
    currentState: "active",
    inputModality: "voice",
    locale: "en",
    timezone: "UTC",
    requestedAt: TASK16_NOW.toISOString(),
    utterance,
    confidence: 0.9,
    ...overrides,
  });
}

describe("Mental Wellbeing Specialist contract", () => {
  it.each(MENTAL_WELLBEING_PARITY_FIXTURES)(
    "preserves legacy semantic parity for $label",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeMentalWellbeingSpecialistResponse({ request });
      const validation = validateMentalWellbeingSpecialistProposal(request, response);

      expect(validation.ok).toBe(true);
      expect(response.status).toBe("complete");
      expect(response.completionResult).toMatchObject({
        outcome: "wellbeing_support_ready",
        flowId: MENTAL_WELLBEING_FLOW_ID,
        supportIntent: fixture.supportIntent,
        presentationId: fixture.presentationId,
        finalDecisionAuthority: "central_orchestrator",
      });
      expect(response.uiInstructions.map((item) => item.instructionId)).toEqual([
        MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
        MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
      ]);
      expect(response.proposedToolCalls).toEqual([]);
      expect(response.memoryReadsRequested).toEqual([]);
      expect(response.memoryWritesProposed).toEqual([]);
    },
  );

  it("keeps raw emotional text out of request and response payloads", () => {
    const raw = "I feel anxious about a private family situation";
    const request = requestFor(raw);
    const response = proposeMentalWellbeingSpecialistResponse({ request });

    expect(JSON.stringify(request)).not.toContain(raw);
    expect(JSON.stringify(response)).not.toContain(raw);
    expect(request.userInput.kind).toBe("event_reference");
    expect(request.normalizedInput.type).toBe("event_reference");
  });

  it("falls back for unsupported clinical or diagnostic requests", () => {
    const request = requestFor(MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.utterance);
    const response = proposeMentalWellbeingSpecialistResponse({ request });

    expect(validateMentalWellbeingSpecialistProposal(request, response).ok).toBe(true);
    expect(response.completionResult).toMatchObject({
      outcome: "fallback_to_legacy",
      reasonCode: MENTAL_WELLBEING_UNSUPPORTED_FIXTURE.reasonCode,
      presentationId: MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
    });
    expect(response.responseGuidance.prohibitedClaims.join(" ")).toContain("diagnose");
  });

  it("does not treat safety-sensitive text as ordinary wellbeing support", () => {
    const request = requestFor(MENTAL_WELLBEING_SAFETY_FIXTURE.utterance);
    const response = proposeMentalWellbeingSpecialistResponse({ request });

    expect(validateMentalWellbeingSpecialistProposal(request, response).ok).toBe(true);
    expect(response.completionResult).toMatchObject({
      outcome: "fallback_to_legacy",
      reasonCode: MENTAL_WELLBEING_SAFETY_FIXTURE.reasonCode,
    });
    expect(response.safetyFlags).toContain("mental_wellbeing.safety_preempted");
  });

  it("rejects arbitrary tool authority", () => {
    const request = requestFor("I feel stressed");
    const response: SpecialistResponse = {
      ...proposeMentalWellbeingSpecialistResponse({ request }),
      status: "proposed_action",
      proposedToolCalls: [{
        proposalId: "proposal.mental_wellbeing.tool",
        toolId: "tool.voice.open_app_action",
        arguments: { route: "/companions" },
        reason: "not allowed in Task 16",
        requiresConfirmation: false,
        idempotencyKey: "idempotency.mental_wellbeing.tool",
        expectedResultType: "voice_action_navigation",
        riskLevel: "low",
      }],
    };

    expect(validateMentalWellbeingSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "mental_wellbeing_specialist_contract_invalid" });
  });

  it("rejects memory, caregiver, proactive, diagnostic, and treatment authority", () => {
    const request = requestFor("I feel lonely");
    const base = proposeMentalWellbeingSpecialistResponse({ request });
    const response: SpecialistResponse = {
      ...base,
      memoryWritesProposed: [{
        category: "mental_health",
        value: { text: "raw disclosure" },
        sensitivity: "restricted",
        reason: "semantic_memory_write",
        requiresUserConfirmation: false,
        target: "mem0",
      }],
    };

    expect(validateMentalWellbeingSpecialistProposal(request, response).ok).toBe(false);
  });

  it("preserves active-flow ownership by rejecting invalid lifecycle transitions", () => {
    const request = requestFor("I feel stressed", { currentState: "waiting_for_tool" });
    const response = proposeMentalWellbeingSpecialistResponse({ request });

    expect(validateMentalWellbeingSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "mental_wellbeing_specialist_contract_invalid" });
  });

  it("preserves duplicate/idempotent semantics through stable event references", () => {
    const first = requestFor("I feel lonely");
    const second = requestFor("I feel lonely");

    expect(first.userInput).toEqual(second.userInput);
    expect(first.normalizedInput).toEqual(second.normalizedInput);
    expect(proposeMentalWellbeingSpecialistResponse({ request: first }).completionResult)
      .toEqual(proposeMentalWellbeingSpecialistResponse({ request: second }).completionResult);
  });
});
