import {
  type AnswerSubmissionModality,
  type FlowLifecycleState,
  type NormalizedAnswer,
} from "../../shared/orchestration/flowState.js";
import { z } from "zod";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  PREVENTIVE_HEALTH_FLOW_ID,
  PREVENTIVE_HEALTH_FLOW_VERSION,
  PREVENTIVE_HEALTH_SCENE_ID,
  PREVENTIVE_HEALTH_SPECIALIST_ID,
  PREVENTIVE_HEALTH_SPECIALIST_VERSION,
} from "./preventiveHealthFlow.js";

const preventiveHealthCompletionResultSchema = z.object({
  completionReference: z.string(),
  answerDigest: z.string(),
  flowId: z.literal(PREVENTIVE_HEALTH_FLOW_ID),
  flowVersion: z.literal(PREVENTIVE_HEALTH_FLOW_VERSION),
  flowInstanceId: z.string(),
  expectedQuestionIds: z.array(z.string()).min(1),
  persistenceOwner: z.literal("checkin_sessions"),
  persistedBy: z.literal("existing_checkin_session"),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(PREVENTIVE_HEALTH_SPECIALIST_VERSION),
}).strict();

type PreventiveHealthCompletionResult = z.infer<
  typeof preventiveHealthCompletionResultSchema
>;

export type PreventiveHealthSpecialistInput = {
  requestId: string;
  correlationId: string;
  causationId?: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  flowInstanceId: string;
  currentState: FlowLifecycleState;
  inputModality: AnswerSubmissionModality;
  locale: string;
  timezone: string;
  requestedAt: string;
  completionReference: string;
  answerDigest: string;
  normalizedAnswersByQuestion: Record<string, NormalizedAnswer>;
  safetyFlags: string[];
};

function channelFor(modality: AnswerSubmissionModality): SpecialistRequest["channel"] {
  if (modality === "voice") {
    return { type: "voice", supportsVoice: true, supportsVisuals: false };
  }
  if (modality === "text") {
    return { type: "text", supportsVoice: false, supportsVisuals: false };
  }
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

export function createPreventiveHealthSpecialistRequest(
  input: PreventiveHealthSpecialistInput,
): SpecialistRequest {
  const questionIds = Object.keys(input.normalizedAnswersByQuestion).sort();
  return {
    requestId: input.requestId,
    correlationId: input.correlationId,
    ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
    specialistId: PREVENTIVE_HEALTH_SPECIALIST_ID,
    specialistVersion: PREVENTIVE_HEALTH_SPECIALIST_VERSION,
    flowId: PREVENTIVE_HEALTH_FLOW_ID,
    flowVersion: PREVENTIVE_HEALTH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "health.preventive_check.complete",
      confidence: 1,
      source: "deterministic",
      rationaleCode: "task9.preventive_check.normalized",
    },
    userInput: {
      kind: "event_reference",
      eventId: input.completionReference,
    },
    normalizedInput: {
      type: "event_reference",
      eventId: input.completionReference,
      summary: "Preventive Health check answers were normalized without raw answer content.",
    },
    inputModality: input.inputModality,
    triggerSource: "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: PREVENTIVE_HEALTH_FLOW_ID,
      answerDigest: input.answerDigest,
      questionIds,
      persistenceAuthority: "checkin_sessions",
      routeAuthority: "/api/checkins/analyze",
    },
    safetyContext: {
      emergencyChecked: true,
      deterministicSafetyResult: input.safetyFlags.length ? "uncertain" : "clear",
      flags: input.safetyFlags,
      riskLevel: input.safetyFlags.length ? "medium" : "none",
      restrictions: input.safetyFlags.length
        ? ["ordinary_preventive_completion_blocked"]
        : [],
      escalationAlreadyActive: false,
    },
    consentContext: {
      scopes: ["health_data"],
      channelAllowed: true,
      memoryReadAllowed: false,
      memoryWriteAllowed: false,
      externalToolUseAllowed: false,
      caregiverEscalationAllowed: false,
      operatorEscalationAllowed: false,
    },
    previousAnswers: input.normalizedAnswersByQuestion,
    availableTools: [],
    uiContext: {
      currentRoute: "/health/check-in",
      sceneId: PREVENTIVE_HEALTH_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
      deviceClass: "unknown",
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      nonExecutable: true,
      task: "task9.first_health_flow",
      rawHealthAnswerContentRetained: false,
    },
    requestedAt: input.requestedAt,
  };
}

export function proposePreventiveHealthCompletion(
  input: {
    request: SpecialistRequest;
    completionReference: string;
    answerDigest: string;
  },
): SpecialistResponse {
  const expectedQuestionIds = parseExpectedQuestionIds(input.request.domainContext);
  return {
    requestId: input.request.requestId,
    specialistId: PREVENTIVE_HEALTH_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary: "Preventive Health check is ready for the existing structured check-in save path.",
      confidence: 1,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "Use the existing check-in result and persistence route.",
        "Do not diagnose or execute external actions from the Specialist.",
      ],
      prohibitedClaims: [
        "Do not claim emergency clearance.",
        "Do not claim provider, caregiver, or tool execution.",
      ],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: "none",
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      clearExpectedInput: true,
      completionReference: input.completionReference,
      reasonCode: "health.preventive_check.completed",
    },
    completionResult: {
      completionReference: input.completionReference,
      answerDigest: input.answerDigest,
      flowId: input.request.flowId,
      flowVersion: input.request.flowVersion,
      flowInstanceId: input.request.flowInstanceId,
      expectedQuestionIds,
      persistenceOwner: "checkin_sessions",
      persistedBy: "existing_checkin_session",
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: PREVENTIVE_HEALTH_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "health.preventive_check.specialist_complete",
        "health.preventive_check.no_tools",
        "health.preventive_check.no_memory_write",
      ],
    },
  };
}

export type PreventiveHealthSpecialistValidation =
  | { ok: true; response: SpecialistResponse }
  | { ok: false; reasonCode: "specialist_response_invalid" };

export function validatePreventiveHealthSpecialistProposal(
  request: SpecialistRequest,
  response: SpecialistResponse,
): PreventiveHealthSpecialistValidation {
  try {
    const validated = validateSpecialistResponse(request, response);
    const completionResult = parseCompletionResult(response.completionResult);
    const questionIds = parseExpectedQuestionIds(request.domainContext);
    const expectedAnswerDigest = typeof request.domainContext.answerDigest === "string"
      ? request.domainContext.answerDigest
      : null;
    const completionEventId = request.userInput.kind === "event_reference"
      ? request.userInput.eventId
      : null;
    const isSupported =
      Boolean(completionResult) &&
      validated.status === "complete" &&
      validated.riskLevel === "none" &&
      validated.memoryReadsRequested.length === 0 &&
      validated.memoryWritesProposed.length === 0 &&
      validated.proposedToolCalls.length === 0 &&
      !validated.escalation &&
      validated.flowStateUpdate?.nextLifecycleState === "completed" &&
      validated.flowStateUpdate.completionReference ===
        completionResult!.completionReference &&
      completionResult!.completionReference === completionEventId &&
      completionResult!.answerDigest === expectedAnswerDigest &&
      completionResult!.flowId === request.flowId &&
      completionResult!.flowVersion === request.flowVersion &&
      completionResult!.flowInstanceId === request.flowInstanceId &&
      completionResult!.persistenceOwner === request.domainContext.persistenceAuthority &&
      completionResult!.finalDecisionAuthority === "central_orchestrator" &&
      completionResult!.contractVersion === PREVENTIVE_HEALTH_SPECIALIST_VERSION &&
      sameStrings(completionResult!.expectedQuestionIds, questionIds);
    return isSupported
      ? { ok: true, response: validated }
      : { ok: false, reasonCode: "specialist_response_invalid" };
  } catch {
    return { ok: false, reasonCode: "specialist_response_invalid" };
  }
}

function parseExpectedQuestionIds(domainContext: Record<string, unknown>): string[] {
  const questionIds = domainContext.questionIds;
  if (!Array.isArray(questionIds) || questionIds.some((item) => typeof item !== "string")) {
    return [];
  }
  return [...questionIds].sort();
}

function parseCompletionResult(value: unknown): PreventiveHealthCompletionResult | null {
  const parsed = preventiveHealthCompletionResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
