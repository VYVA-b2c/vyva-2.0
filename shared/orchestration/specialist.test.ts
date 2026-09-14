import { describe, expect, it } from "vitest";
import { OrchestrationContractError } from "./errors";
import { parseFlowState } from "./flowState";
import {
  parseSpecialistRequest,
  parseSpecialistResponse,
  validateSpecialistResponse,
} from "./specialist";
import {
  blockedSpecialistResponse,
  completeSpecialistResponse,
  escalatedSpecialistResponse,
  failedSpecialistResponse,
  medicationProposedActionResponse,
  medicationSpecialistRequest,
  needsInformationResponse,
  preventiveHealthSpecialistRequest,
  proposedActionResponse,
  safetySpecialistRequest,
} from "./specialistFixtures";

const clone = <T>(value: T): T => structuredClone(value);
const expectCode = (action: () => unknown, code: string) => {
  try {
    action();
    throw new Error("Expected contract validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(OrchestrationContractError);
    expect((error as OrchestrationContractError).code).toBe(code);
  }
};

describe("specialist request contract", () => {
  it("accepts a complete request", () => {
    expect(parseSpecialistRequest(preventiveHealthSpecialistRequest))
      .toEqual(preventiveHealthSpecialistRequest);
  });
  it("accepts the safety specialist before an emergency check", () => {
    expect(parseSpecialistRequest(safetySpecialistRequest).specialistId).toBe("safety");
  });
  it("accepts a non-Health request", () => {
    expect(parseSpecialistRequest(medicationSpecialistRequest).specialistId)
      .toBe("medication.adherence");
  });
  it.each([
    "user", "push", "outbound_call", "caregiver", "operator", "schedule", "system",
  ] as const)("accepts the canonical Task 1 trigger %s", (triggerSource) => {
    const request = { ...clone(preventiveHealthSpecialistRequest), triggerSource };
    expect(parseSpecialistRequest(request).triggerSource).toBe(triggerSource);
  });
  it.each(["voice", "ui", "flow", "safety", "tool", "proactive"])(
    "rejects the noncanonical trigger %s",
    (triggerSource) => {
      const request = {
        ...clone(preventiveHealthSpecialistRequest),
        triggerSource,
      };
      expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
    },
  );
  it("rejects intent confidence outside zero to one", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.intent.confidence = 1.1;
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects invalid memory items", () => {
    const request = clone(preventiveHealthSpecialistRequest) as unknown as Record<string, unknown>;
    request.relevantMemory = [{ category: "", source: "unknown" }];
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects invalid consent context", () => {
    const request = clone(preventiveHealthSpecialistRequest) as unknown as Record<string, unknown>;
    request.consentContext = { scopes: [] };
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects malformed tool descriptors", () => {
    const request = clone(preventiveHealthSpecialistRequest) as unknown as Record<string, unknown>;
    request.availableTools = [{ toolId: "unsafe" }];
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects malformed UI context", () => {
    const request = clone(preventiveHealthSpecialistRequest) as unknown as Record<string, unknown>;
    request.uiContext = { currentRoute: 42 };
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("requires the deterministic emergency check for non-safety specialists", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.safetyContext.emergencyChecked = false;
    expectCode(() => parseSpecialistRequest(request), "EMERGENCY_CHECK_REQUIRED");
  });
  it("rejects malformed requests with a typed safe error", () => {
    const request = { ...clone(preventiveHealthSpecialistRequest), locale: "" };
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects unknown request fields", () => {
    const request = { ...clone(preventiveHealthSpecialistRequest), unexpected: true };
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("requires safe text to be explicitly redacted", () => {
    const request = clone(preventiveHealthSpecialistRequest) as Record<string, unknown>;
    request.userInput = { kind: "safe_text", text: "example", redacted: false };
    expectCode(() => parseSpecialistRequest(request), "SPECIALIST_REQUEST_INVALID");
  });
  it("rejects hidden reasoning anywhere on the boundary", () => {
    const request = clone(preventiveHealthSpecialistRequest) as Record<string, unknown>;
    request.domainContext = { chainOfThought: "must never cross boundary" };
    expectCode(() => parseSpecialistRequest(request), "HIDDEN_REASONING_NOT_ALLOWED");
  });
  it("rejects direct-execution fields", () => {
    const request = clone(preventiveHealthSpecialistRequest) as Record<string, unknown>;
    request.domainContext = { executeNow: true };
    expectCode(() => parseSpecialistRequest(request), "DIRECT_EXECUTION_NOT_ALLOWED");
  });
});

describe("specialist response contract", () => {
  it.each([
    needsInformationResponse,
    completeSpecialistResponse,
    proposedActionResponse,
    medicationProposedActionResponse,
    escalatedSpecialistResponse,
    blockedSpecialistResponse,
    failedSpecialistResponse,
  ])("accepts valid status-specific fixtures", (response) => {
    expect(parseSpecialistResponse(response).status).toBe(response.status);
  });
  it.each([
    ["needs_information", "nextQuestion"],
    ["complete", "completionResult"],
    ["blocked", "blockedReason"],
    ["escalated", "escalation"],
    ["failed", "failureCode"],
  ] as const)("enforces %s status requirements", (status, field) => {
    const response = clone({
      needs_information: needsInformationResponse,
      complete: completeSpecialistResponse,
      blocked: blockedSpecialistResponse,
      escalated: escalatedSpecialistResponse,
      failed: failedSpecialistResponse,
    }[status]) as unknown as Record<string, unknown>;
    delete response[field];
    expectCode(() => parseSpecialistResponse(response), "RESPONSE_STATUS_INVARIANT_FAILED");
  });
  it("requires a tool proposal for proposed_action", () => {
    const response = clone(proposedActionResponse);
    response.proposedToolCalls = [];
    expectCode(() => parseSpecialistResponse(response), "RESPONSE_STATUS_INVARIANT_FAILED");
  });
  it("rejects unknown UI instruction types", () => {
    const response = clone(completeSpecialistResponse) as unknown as Record<string, unknown>;
    response.uiInstructions = [{
      instructionId: "ui-1", type: "render_provider_widget", payload: {},
    }];
    expectCode(() => parseSpecialistResponse(response), "SPECIALIST_RESPONSE_INVALID");
  });
  it.each([
    ["show_choice_question", { prompt: "Choose.", options: [{ id: "a", label: "A" }] }],
    ["show_scale", { prompt: "Rate.", minimum: 1, maximum: 5, step: 1 }],
    ["show_text_prompt", { prompt: "Describe.", multiline: true }],
    ["show_measurement_input", { prompt: "Enter reading.", unit: "mmHg" }],
    ["show_image_upload", { prompt: "Add an image." }],
    ["show_document_upload", { prompt: "Add a document.", acceptedTypes: ["application/pdf"] }],
    ["show_summary", { title: "Summary", items: ["Item"] }],
    ["show_confirmation", { prompt: "Confirm.", confirmLabel: "Confirm" }],
    ["show_progress", { label: "Progress", percent: 50 }],
    ["clear_scene", {}],
  ])("accepts the %s UI instruction", (type, payload) => {
    const response = clone(completeSpecialistResponse) as unknown as Record<string, unknown>;
    response.uiInstructions = [{ instructionId: "ui-1", type, payload }];
    expect(parseSpecialistResponse(response).uiInstructions).toHaveLength(1);
  });
  it("rejects raw provider error stacks", () => {
    const response = clone(failedSpecialistResponse) as unknown as Record<string, unknown>;
    response.providerErrorStack = "provider detail";
    expectCode(() => parseSpecialistResponse(response), "DIRECT_EXECUTION_NOT_ALLOWED");
  });
});

describe("orchestrator validation of specialist proposals", () => {
  it("accepts a valid response for its request", () => {
    expect(validateSpecialistResponse(
      preventiveHealthSpecialistRequest,
      proposedActionResponse,
    )).toEqual(proposedActionResponse);
  });
  it("rejects request correlation mismatches", () => {
    const response = { ...clone(completeSpecialistResponse), requestId: "other" };
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "REQUEST_ID_MISMATCH",
    );
  });
  it("rejects specialist identity mismatches", () => {
    const response = { ...clone(completeSpecialistResponse), specialistId: "other" };
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "SPECIALIST_ID_MISMATCH",
    );
  });
  it("rejects unavailable tools", () => {
    const response = clone(proposedActionResponse);
    response.proposedToolCalls[0].toolId = "unknown_tool";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "TOOL_NOT_AVAILABLE",
    );
  });
  it("prevents specialists from weakening confirmation", () => {
    const response = clone(proposedActionResponse);
    response.proposedToolCalls[0].requiresConfirmation = false;
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "TOOL_CONFIRMATION_CANNOT_BE_WEAKENED",
    );
  });
  it("enforces tool consent", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.consentContext.externalToolUseAllowed = false;
    expectCode(
      () => validateSpecialistResponse(request, proposedActionResponse),
      "TOOL_CONSENT_NOT_ALLOWED",
    );
  });
  it("enforces tool idempotency", () => {
    const response = clone(proposedActionResponse);
    delete response.proposedToolCalls[0].idempotencyKey;
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "TOOL_IDEMPOTENCY_REQUIRED",
    );
  });
  it("rejects disallowed tool risk levels", () => {
    const response = clone(proposedActionResponse);
    response.proposedToolCalls[0].riskLevel = "high";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "TOOL_NOT_AVAILABLE",
    );
  });
  it("enforces memory-write consent", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.consentContext.memoryWriteAllowed = false;
    const response = clone(completeSpecialistResponse);
    response.memoryWritesProposed = [{
      category: "preference", value: "brief", sensitivity: "internal",
      reason: "Remember response preference", requiresUserConfirmation: false,
      target: "postgres",
    }];
    expectCode(() => validateSpecialistResponse(request, response), "INVALID_MEMORY_PROPOSAL");
  });
  it("requires confirmation for sensitive memory proposals", () => {
    const response = clone(completeSpecialistResponse);
    response.memoryWritesProposed = [{
      category: "health_observation", value: "fixture", sensitivity: "sensitive",
      reason: "Retain a health observation", requiresUserConfirmation: false,
      target: "mem0",
    }];
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "INVALID_MEMORY_PROPOSAL",
    );
  });
  it.each(["postgres", "working_memory"] as const)(
    "accepts a valid %s memory proposal",
    (target) => {
      const response = clone(completeSpecialistResponse);
      response.memoryWritesProposed = [{
        category: "preference",
        value: { concise: true },
        sensitivity: "internal",
        reason: "Retain an approved preference.",
        requiresUserConfirmation: false,
        target,
      }];
      expect(validateSpecialistResponse(
        preventiveHealthSpecialistRequest,
        response,
      ).memoryWritesProposed[0].target).toBe(target);
    },
  );
  it("rejects hidden reasoning as a memory category", () => {
    const response = clone(completeSpecialistResponse);
    response.memoryWritesProposed = [{
      category: "hidden_reasoning",
      value: "not permitted",
      sensitivity: "internal",
      reason: "Not permitted",
      requiresUserConfirmation: false,
      target: "working_memory",
    }];
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "HIDDEN_REASONING_NOT_ALLOWED",
    );
  });
  it("enforces memory-read consent", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.consentContext.memoryReadAllowed = false;
    const response = clone(completeSpecialistResponse);
    response.memoryReadsRequested = [{
      category: "preference", reason: "Personalize response",
      required: false, sensitivityCeiling: "internal",
    }];
    expectCode(() => validateSpecialistResponse(request, response), "INVALID_MEMORY_PROPOSAL");
  });
  it("rejects invalid flow transitions", () => {
    const request = { ...clone(preventiveHealthSpecialistRequest), currentState: "completed" as const };
    expectCode(
      () => validateSpecialistResponse(request, needsInformationResponse),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("allows expected input only while waiting for the user", () => {
    const response = clone(needsInformationResponse);
    response.flowStateUpdate!.nextLifecycleState = "active";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("accepts waiting_for_tool with correlated Task 1 pending metadata", () => {
    expect(validateSpecialistResponse(
      preventiveHealthSpecialistRequest,
      proposedActionResponse,
    ).flowStateUpdate?.pendingTool?.requestId).toBe("proposal-001");
  });
  it("rejects waiting_for_tool without pending metadata", () => {
    const response = clone(proposedActionResponse);
    delete response.flowStateUpdate!.pendingTool;
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("rejects pending metadata without a matching Tool proposal", () => {
    const response = clone(proposedActionResponse);
    response.flowStateUpdate!.pendingTool!.requestId = "other-proposal";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("rejects pending metadata for an unavailable Tool", () => {
    const response = clone(proposedActionResponse);
    response.proposedToolCalls[0].toolId = "unavailable";
    response.flowStateUpdate!.pendingTool!.toolId = "unavailable";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "TOOL_NOT_AVAILABLE",
    );
  });
  it("rejects pending metadata while waiting for the user", () => {
    const response = clone(needsInformationResponse);
    response.flowStateUpdate!.pendingTool =
      clone(proposedActionResponse.flowStateUpdate!.pendingTool);
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("rejects pending metadata in a terminal state", () => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.pendingTool =
      clone(proposedActionResponse.flowStateUpdate!.pendingTool);
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("rejects expected input and pending metadata together", () => {
    const response = clone(proposedActionResponse);
    response.flowStateUpdate!.expectedInput =
      clone(needsInformationResponse.nextQuestion);
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "FLOW_UPDATE_INVALID",
    );
  });
  it("produces proposal data satisfying the Task 1 waiting-for-tool invariant", () => {
    const update = validateSpecialistResponse(
      preventiveHealthSpecialistRequest,
      proposedActionResponse,
    ).flowStateUpdate!;
    expect(parseFlowState({
      flowId: preventiveHealthSpecialistRequest.flowId,
      flowVersion: preventiveHealthSpecialistRequest.flowVersion,
      state: update.nextLifecycleState,
      sessionId: preventiveHealthSpecialistRequest.sessionId,
      userId: preventiveHealthSpecialistRequest.userId,
      pendingTool: update.pendingTool,
      context: update.domainStatePatch ?? {},
      updatedAt: "2026-07-31T10:00:01.000Z",
    }).state).toBe("waiting_for_tool");
  });
  it("accepts an extensible bounded domain-state patch", () => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.domainStatePatch = {
      preventiveCheck: { energyTrend: "stable", observations: ["fixture"] },
    };
    expect(validateSpecialistResponse(
      preventiveHealthSpecialistRequest,
      response,
    ).flowStateUpdate?.domainStatePatch).toBeDefined();
  });
  it.each([
    "lifecycleState",
    "expectedInput",
    "pendingTool",
    "flowId",
    "flowVersion",
    "requestId",
    "specialistId",
    "userId",
    "profileId",
    "sessionId",
    "safetyContext",
    "consentContext",
  ])("rejects reserved domain patch key %s", (reservedKey) => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.domainStatePatch = { [reservedKey]: "override" };
    expectCode(
      () => parseSpecialistResponse(response),
      "FLOW_PATCH_INVALID",
    );
  });
  it("rejects deeply nested reserved patch keys", () => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.domainStatePatch = {
      domain: { nested: { expectedInput: "override" } },
    };
    expectCode(() => parseSpecialistResponse(response), "FLOW_PATCH_INVALID");
  });
  it("rejects excessively deep patches", () => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.domainStatePatch = {
      a: { b: { c: { d: { e: { f: "too deep" } } } } },
    };
    expectCode(() => parseSpecialistResponse(response), "FLOW_PATCH_INVALID");
  });
  it("rejects oversized patches", () => {
    const response = clone(completeSpecialistResponse);
    response.flowStateUpdate!.domainStatePatch = { note: "x".repeat(17_000) };
    expectCode(() => parseSpecialistResponse(response), "FLOW_PATCH_INVALID");
  });
  it("enforces caregiver escalation consent", () => {
    const response = clone(escalatedSpecialistResponse);
    response.requestId = preventiveHealthSpecialistRequest.requestId;
    response.specialistId = preventiveHealthSpecialistRequest.specialistId;
    response.escalation!.type = "caregiver";
    expectCode(
      () => validateSpecialistResponse(preventiveHealthSpecialistRequest, response),
      "ESCALATION_PROPOSAL_INVALID",
    );
  });
  it("prevents a Specialist from weakening escalation consent", () => {
    const request = clone(preventiveHealthSpecialistRequest);
    request.consentContext.caregiverEscalationAllowed = true;
    const response = clone(escalatedSpecialistResponse);
    response.requestId = request.requestId;
    response.specialistId = request.specialistId;
    response.escalation!.type = "caregiver";
    response.escalation!.requiresConsent = false;
    expectCode(
      () => validateSpecialistResponse(request, response),
      "ESCALATION_PROPOSAL_INVALID",
    );
  });
  it("prevents a Specialist from downgrading deterministic emergency safety", () => {
    const response = clone(completeSpecialistResponse);
    response.requestId = safetySpecialistRequest.requestId;
    response.specialistId = safetySpecialistRequest.specialistId;
    expectCode(
      () => validateSpecialistResponse(safetySpecialistRequest, response),
      "SPECIALIST_RESPONSE_INVALID",
    );
  });
  it("requires exactly one follow-up schedule", () => {
    const response = {
      ...clone(completeSpecialistResponse),
      followUpRecommendation: {
        purpose: "Check in", preferredChannel: "text", fallbackChannels: [],
        requiresConsent: true, reason: "Continuity", summary: "Check in later.",
        dueAt: "2026-08-01T10:00:00.000Z", delaySeconds: 3600,
      },
    };
    expectCode(() => parseSpecialistResponse(response), "FOLLOWUP_INVALID");
  });
  it.each([
    { dueAt: "2026-08-01T10:00:00.000Z" },
    { delaySeconds: 3_600 },
  ])("accepts one follow-up scheduling form", (schedule) => {
    const response = {
      ...clone(completeSpecialistResponse),
      followUpRecommendation: {
        purpose: "Check in",
        preferredChannel: "text",
        fallbackChannels: ["telephone"],
        requiresConsent: true,
        reason: "Continuity",
        summary: "Check in later.",
        ...schedule,
      },
    };
    expect(parseSpecialistResponse(response).followUpRecommendation).toBeDefined();
  });
  it("rejects a follow-up with no schedule", () => {
    const response = {
      ...clone(completeSpecialistResponse),
      followUpRecommendation: {
        purpose: "Check in", fallbackChannels: [], requiresConsent: true,
        reason: "Continuity", summary: "Check in later.",
      },
    };
    expectCode(() => parseSpecialistResponse(response), "FOLLOWUP_INVALID");
  });
});
