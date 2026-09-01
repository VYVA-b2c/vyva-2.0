import { describe, expect, it } from "vitest";
import type { SpecialistResponse } from "../../shared/orchestration/specialist";
import {
  MEDICATION_FLOW_ID,
  MEDICATION_OPEN_APP_ACTION_TOOL_ID,
  MEDICATION_SPECIALIST_ID,
} from "./medicationFlow";
import {
  createMedicationSpecialistRequest,
  proposeMedicationSpecialistResponse,
  validateMedicationSpecialistProposal,
} from "./medicationSpecialistAdapter";
import {
  task17ClinicalDosingExclusionFixtures,
  task17InteractionExclusionFixtures,
  task17MedicationParityFixtures,
  task17SpecialistInput,
  task17UnsupportedMedicationFixtures,
} from "./medicationFixtures";

function requestFor(utterance: string, overrides = {}) {
  return createMedicationSpecialistRequest({
    ...task17SpecialistInput,
    utterance,
    ...overrides,
  });
}

describe("Medication Specialist adapter", () => {
  it.each(task17MedicationParityFixtures)(
    "preserves legacy parity for $name",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeMedicationSpecialistResponse({ request });
      const validation = validateMedicationSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response.status).toBe("proposed_action");
      expect(response.specialistId).toBe(MEDICATION_SPECIALIST_ID);
      expect(response.proposedToolCalls).toHaveLength(1);
      expect(response.proposedToolCalls[0]).toMatchObject({
        toolId: MEDICATION_OPEN_APP_ACTION_TOOL_ID,
        arguments: {
          domain: "meds",
          action_type: fixture.actionType,
          route: fixture.route,
          capability: fixture.capability,
          presentation_id: fixture.presentationId,
        },
        riskLevel: fixture.riskLevel,
        requiresConfirmation: fixture.requiresConfirmation,
      });
      expect(response.flowStateUpdate?.nextLifecycleState).toBe("waiting_for_tool");
    },
  );

  it("does not place raw medication speech or medication names into the Specialist request boundary", () => {
    const utterance = "My private exact metformin phrase should not be copied";
    const request = requestFor(utterance);
    expect(JSON.stringify(request)).not.toContain(utterance);
    expect(JSON.stringify(request)).not.toContain("metformin");
    expect(request.userInput.kind).toBe("event_reference");
    expect(request.normalizedInput.type).toBe("event_reference");
  });

  it.each(task17UnsupportedMedicationFixtures)(
    "preserves $name as legacy fallback",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeMedicationSpecialistResponse({ request });
      const validation = validateMedicationSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response).toMatchObject({
        status: "complete",
        proposedToolCalls: [],
        completionResult: {
          outcome: "fallback_to_legacy",
          reasonCode: fixture.reasonCode,
          finalDecisionAuthority: "central_orchestrator",
        },
      });
    },
  );

  it.each([...task17ClinicalDosingExclusionFixtures, ...task17InteractionExclusionFixtures])(
    "preserves migration-ineligible clinical/interaction request as legacy fallback: $utterance",
    (fixture) => {
      const request = requestFor(fixture.utterance);
      const response = proposeMedicationSpecialistResponse({ request });
      const validation = validateMedicationSpecialistProposal(request, response);
      expect(validation.ok).toBe(true);
      expect(response).toMatchObject({
        status: "complete",
        proposedToolCalls: [],
        completionResult: {
          outcome: "fallback_to_legacy",
          reasonCode: fixture.reasonCode,
          finalDecisionAuthority: "central_orchestrator",
        },
      });
    },
  );

  it("rejects unauthorized tool proposals", () => {
    const request = requestFor("help with my medication schedule", { availableTools: [] });
    const response = proposeMedicationSpecialistResponse({ request });
    expect(validateMedicationSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("rejects direct execution, dose mutation, memory, or caregiver authority in output", () => {
    const request = requestFor("help with my medication schedule");
    const response = proposeMedicationSpecialistResponse({ request });
    const invalidExecution: SpecialistResponse = {
      ...response,
      proposedToolCalls: [{
        ...response.proposedToolCalls[0],
        arguments: {
          ...response.proposedToolCalls[0].arguments,
          execute: true,
        },
      }],
    };
    expect(validateMedicationSpecialistProposal(request, invalidExecution))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const doseMutation: SpecialistResponse = {
      ...response,
      proposedToolCalls: [{
        ...response.proposedToolCalls[0],
        arguments: {
          ...response.proposedToolCalls[0].arguments,
          medication_name: "metformin",
          confirmed_taken_at: "2026-08-03T12:00:00.000Z",
        },
      }],
    };
    expect(validateMedicationSpecialistProposal(request, doseMutation))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const memoryWriteResponse: SpecialistResponse = {
      ...response,
      memoryWritesProposed: [{
        category: "medication",
        value: { routine: "private" },
        sensitivity: "sensitive",
        reason: "Not allowed in Task 17.",
        requiresUserConfirmation: true,
        target: "mem0",
      }],
    };
    expect(validateMedicationSpecialistProposal(request, memoryWriteResponse))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("rejects mismatched or non-canonical open-app action arguments", () => {
    const request = requestFor("help with my medication schedule");
    const response = proposeMedicationSpecialistResponse({ request });
    const wrongCapability: SpecialistResponse = {
      ...response,
      proposedToolCalls: [{
        ...response.proposedToolCalls[0],
        arguments: {
          ...response.proposedToolCalls[0].arguments,
          capability: "medication_refill_request",
        },
      }],
    };
    expect(validateMedicationSpecialistProposal(request, wrongCapability))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });

    const extraArgument: SpecialistResponse = {
      ...response,
      proposedToolCalls: [{
        ...response.proposedToolCalls[0],
        arguments: {
          ...response.proposedToolCalls[0].arguments,
          arbitrary_instruction: "contact pharmacy now",
        },
      }],
    };
    expect(validateMedicationSpecialistProposal(request, extraArgument))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("preserves global safety precedence by rejecting ordinary Medication output for emergency input", () => {
    const request = requestFor("help with my medication schedule", {
      safetyResult: "emergency",
      safetyFlags: ["safety.emergency"],
    });
    const response = proposeMedicationSpecialistResponse({ request });
    expect(validateMedicationSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("respects active-flow transition ownership", () => {
    const request = requestFor("help with my medication schedule", { currentState: "waiting_for_user" });
    const response = proposeMedicationSpecialistResponse({ request });
    expect(validateMedicationSpecialistProposal(request, response))
      .toEqual({ ok: false, reasonCode: "specialist_response_invalid" });
  });

  it("is idempotent for duplicate equivalent events", () => {
    const first = requestFor("open my medication adherence report");
    const second = requestFor("open my medication adherence report");
    const firstResponse = proposeMedicationSpecialistResponse({ request: first });
    const secondResponse = proposeMedicationSpecialistResponse({ request: second });
    expect(firstResponse.proposedToolCalls[0].idempotencyKey)
      .toBe(secondResponse.proposedToolCalls[0].idempotencyKey);
    expect(firstResponse.proposedToolCalls[0].arguments)
      .toEqual(secondResponse.proposedToolCalls[0].arguments);
  });

  it("keeps caregiver, scheduling, provider, dose-confirmation and medication-record authority out of Specialist control", () => {
    const request = requestFor("help with my medication schedule");
    const response = proposeMedicationSpecialistResponse({ request });
    const serialized = JSON.stringify({ request, response });
    expect(serialized).toContain(MEDICATION_FLOW_ID);
    expect(serialized).not.toContain("caregiver_permission");
    expect(serialized).not.toContain("provider_call");
    expect(serialized).not.toContain("confirmed_taken_at");
    expect(serialized).not.toContain("writeMemory");
  });
});
