import {
  type FlowLifecycleState,
} from "../../shared/orchestration/flowState.js";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
  MENTAL_WELLBEING_FLOW_ID,
  MENTAL_WELLBEING_FLOW_VERSION,
  MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
  MENTAL_WELLBEING_SCENE_ID,
  MENTAL_WELLBEING_SPECIALIST_ID,
  MENTAL_WELLBEING_SPECIALIST_VERSION,
  MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
  resolveMentalWellbeingRuntimeContract,
} from "./mentalWellbeingFlow.js";
import {
  type MentalWellbeingLegacyOutcome,
  resolveMentalWellbeingLegacyOutcome,
} from "./mentalWellbeingLegacyAdapter.js";

export type MentalWellbeingSpecialistInput = {
  requestId: string;
  correlationId: string;
  causationId?: string;
  userId: string;
  profileId?: string;
  sessionId: string;
  flowInstanceId: string;
  currentState: FlowLifecycleState;
  inputModality: "voice" | "touch" | "text";
  triggerSource?: "user" | "push" | "outbound_call" | "caregiver" | "operator" | "schedule" | "system";
  locale: string;
  timezone: string;
  requestedAt: string;
  utterance: string;
  confidence?: number;
  currentRoute?: string;
  safetyResult?: "clear" | "emergency" | "uncertain" | "not_applicable";
  safetyFlags?: string[];
};

export type MentalWellbeingSpecialistProposalInput = {
  request: SpecialistRequest;
};

export type MentalWellbeingValidationResult =
  | { ok: true; response: SpecialistResponse }
  | { ok: false; reasonCode: string };

function safeOutcomeSummary(outcome: MentalWellbeingLegacyOutcome): string {
  if (outcome.kind === "supported_support") {
    return [
      outcome.supportIntent,
      outcome.semanticAction,
      outcome.presentationId,
      outcome.summaryCode,
    ].join(":");
  }
  return `fallback:${outcome.reasonCode}:${outcome.presentationId}`;
}

function deterministicId(prefix: string, facts: readonly string[]): string {
  return `${prefix}.${facts.join(".").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120)}`;
}

function channelFor(modality: MentalWellbeingSpecialistInput["inputModality"]): SpecialistRequest["channel"] {
  if (modality === "voice") return { type: "voice", supportsVoice: true, supportsVisuals: false };
  if (modality === "text") return { type: "text", supportsVoice: false, supportsVisuals: false };
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

function isSupportedDomainContext(
  value: SpecialistRequest["domainContext"],
): value is SpecialistRequest["domainContext"] & {
  legacyOutcomeKind: "supported_support";
  supportIntent: string;
  semanticAction: "continue_companion_support";
  presentationId: typeof MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID;
  presentationFamilyId: "presentation.family.summary";
  parityReference: "legacy_companion_social_support" | "legacy_breathing_support";
  summaryCode: string;
} {
  return value.legacyOutcomeKind === "supported_support" &&
    value.semanticAction === "continue_companion_support" &&
    value.presentationId === MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID &&
    value.presentationFamilyId === "presentation.family.summary";
}

export function createMentalWellbeingSpecialistRequest(
  input: MentalWellbeingSpecialistInput,
): SpecialistRequest {
  const contract = resolveMentalWellbeingRuntimeContract();
  if (!contract) {
    throw new Error("mental wellbeing runtime contract unavailable");
  }
  const legacyOutcome = resolveMentalWellbeingLegacyOutcome(input.utterance);
  const eventId = deterministicId("event.mental_wellbeing.intent", [
    input.requestId,
    input.sessionId,
    safeOutcomeSummary(legacyOutcome),
  ]);
  const safetyFlags = input.safetyFlags ?? [];
  const safetyResult = input.safetyResult ?? (safetyFlags.length ? "uncertain" : "clear");

  return {
    requestId: input.requestId,
    correlationId: input.correlationId,
    ...(input.causationId !== undefined ? { causationId: input.causationId } : {}),
    specialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    specialistVersion: MENTAL_WELLBEING_SPECIALIST_VERSION,
    flowId: MENTAL_WELLBEING_FLOW_ID,
    flowVersion: MENTAL_WELLBEING_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "mental_wellbeing.support.request",
      confidence: input.confidence ?? 1,
      source: "deterministic",
      rationaleCode: "task16.mental_wellbeing.legacy_parity",
    },
    userInput: {
      kind: "event_reference",
      eventId,
    },
    normalizedInput: {
      type: "event_reference",
      eventId,
      summary:
        "Mental Wellbeing support intent was classified through stable legacy-parity identifiers without raw emotional text.",
    },
    inputModality: input.inputModality,
    triggerSource: input.triggerSource ?? "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: MENTAL_WELLBEING_FLOW_ID,
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      legacyDomain: legacyOutcome.legacyDomain,
      legacyOutcomeKind: legacyOutcome.kind,
      legacyOutcomeSummary: safeOutcomeSummary(legacyOutcome),
      routeAuthority: "/api/router",
      finalDecisionAuthority: "central_orchestrator",
      presentationAuthority: "shared_presentation_registry",
      toolExecutionAuthority: "central_orchestrator_tool_authorization",
      ...(legacyOutcome.kind === "supported_support"
        ? {
            supportIntent: legacyOutcome.supportIntent,
            semanticAction: legacyOutcome.semanticAction,
            presentationId: legacyOutcome.presentationId,
            presentationFamilyId: legacyOutcome.presentationFamilyId,
            summaryCode: legacyOutcome.summaryCode,
            parityReference: legacyOutcome.parityReference,
          }
        : {
            semanticAction: legacyOutcome.semanticAction,
            presentationId: legacyOutcome.presentationId,
            presentationFamilyId: legacyOutcome.presentationFamilyId,
            fallbackReasonCode: legacyOutcome.reasonCode,
            parityReference: legacyOutcome.parityReference,
          }),
    },
    safetyContext: {
      emergencyChecked: true,
      deterministicSafetyResult: safetyResult,
      flags: safetyFlags,
      riskLevel: safetyResult === "emergency" ? "emergency" : safetyFlags.length ? "medium" : "none",
      restrictions: safetyResult === "emergency" ? ["mental_wellbeing_preempted_by_safety"] : [],
      escalationAlreadyActive: false,
    },
    consentContext: {
      scopes: [],
      channelAllowed: true,
      memoryReadAllowed: false,
      memoryWriteAllowed: false,
      externalToolUseAllowed: false,
      caregiverEscalationAllowed: false,
      operatorEscalationAllowed: false,
    },
    previousAnswers: {},
    availableTools: [],
    uiContext: {
      ...(input.currentRoute ? { currentRoute: input.currentRoute } : {}),
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
      deviceClass: "unknown",
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      nonExecutable: true,
      task: "task16.mental_wellbeing_specialist",
      rawUtteranceRetained: false,
      nonClinicalBoundary: true,
      memoryBoundaryUnchanged: true,
      caregiverBoundaryUnchanged: true,
      proactiveBoundaryUnchanged: true,
    },
    requestedAt: input.requestedAt,
  };
}

function supportedResult(request: SpecialistRequest): SpecialistResponse {
  const supportIntent = String(request.domainContext.supportIntent);
  const parityReference = String(request.domainContext.parityReference);
  return {
    requestId: request.requestId,
    specialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary:
        "A non-clinical Mental Wellbeing support request was mapped to existing companion/social support semantics.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "Offer warm, ordinary wellbeing support and one simple next step.",
        "Use existing companion/social support semantics; do not diagnose or provide treatment.",
      ],
      tone: "warm_grounded",
      acknowledgements: ["Acknowledge the feeling without making clinical claims."],
      prohibitedClaims: [
        "Do not diagnose mental-health conditions.",
        "Do not prescribe treatment or medication changes.",
        "Do not replace safety or emergency routing with calming content.",
        "Do not claim memory, caregiver, provider, or schedule actions were completed.",
      ],
      requiredDisclaimers: ["This is wellbeing support, not diagnosis or treatment."],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [{
      instructionId: MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      priority: 40,
      type: "show_summary",
      payload: {
        title: "Wellbeing support",
        items: [
          `support_intent:${supportIntent}`,
          `presentation:${MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID}`,
          `parity:${parityReference}`,
        ],
      },
    }, {
      instructionId: MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
      questionId: `${MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID}.question`,
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      priority: 30,
      type: "show_text_prompt",
      payload: {
        prompt: "Would you like to say a little more, or choose one small calming step?",
        multiline: false,
      },
    }],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: "none",
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      domainStatePatch: {
        supportIntent,
        presentationId: MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
        presentationFamilyId: "presentation.family.summary",
        parityReference,
        nonClinicalBoundary: true,
      },
      clearExpectedInput: true,
      completionReference: `completion.mental_wellbeing.${request.requestId}`,
      reasonCode: "mental_wellbeing_support_completed",
    },
    completionResult: {
      outcome: "wellbeing_support_ready",
      flowId: MENTAL_WELLBEING_FLOW_ID,
      flowVersion: MENTAL_WELLBEING_FLOW_VERSION,
      flowInstanceId: request.flowInstanceId,
      supportIntent,
      presentationId: MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.summary",
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: MENTAL_WELLBEING_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "mental_wellbeing.legacy_parity_supported",
        `mental_wellbeing.intent.${supportIntent}`,
        `mental_wellbeing.presentation.${MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID}`,
      ],
      promptVersion: "mental_wellbeing.specialist.1.0.0",
    },
  };
}

function fallbackResult(request: SpecialistRequest): SpecialistResponse {
  const reasonCode = typeof request.domainContext.fallbackReasonCode === "string"
    ? request.domainContext.fallbackReasonCode
    : "mental_wellbeing_not_recognized";
  return {
    requestId: request.requestId,
    specialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary:
        "The Mental Wellbeing request is outside the migrated support slice and should preserve legacy fallback.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: ["Preserve the current legacy companion/social fallback behavior."],
      tone: "warm_grounded",
      prohibitedClaims: [
        "Do not diagnose mental-health conditions.",
        "Do not prescribe treatment or medication changes.",
        "Do not claim a specialist handled unsupported or crisis content.",
      ],
      urgency: reasonCode === "mental_wellbeing_safety_preempted" ? "urgent" : "routine",
      brevity: "brief",
    },
    uiInstructions: [{
      instructionId: MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
      sceneId: MENTAL_WELLBEING_SCENE_ID,
      priority: 20,
      type: "show_summary",
      payload: {
        title: "Safe fallback",
        items: [
          `reason:${reasonCode}`,
          `presentation:${MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID}`,
        ],
      },
    }],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: reasonCode === "mental_wellbeing_safety_preempted" ? "medium" : "none",
    safetyFlags: reasonCode === "mental_wellbeing_safety_preempted"
      ? ["mental_wellbeing.safety_preempted"]
      : [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      domainStatePatch: {
        fallbackReasonCode: reasonCode,
        presentationId: MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
        presentationFamilyId: "presentation.family.error.safe_fallback",
        legacyFallback: true,
      },
      clearExpectedInput: true,
      completionReference: `completion.mental_wellbeing.${request.requestId}`,
      reasonCode: "mental_wellbeing_fallback_to_legacy",
    },
    completionResult: {
      outcome: "fallback_to_legacy",
      flowId: MENTAL_WELLBEING_FLOW_ID,
      flowVersion: MENTAL_WELLBEING_FLOW_VERSION,
      flowInstanceId: request.flowInstanceId,
      reasonCode,
      presentationId: MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
      presentationFamilyId: "presentation.family.error.safe_fallback",
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: MENTAL_WELLBEING_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "mental_wellbeing.legacy_fallback",
        `mental_wellbeing.reason.${reasonCode}`,
      ],
      promptVersion: "mental_wellbeing.specialist.1.0.0",
    },
  };
}

export function proposeMentalWellbeingSpecialistResponse(
  input: MentalWellbeingSpecialistProposalInput,
): SpecialistResponse {
  return isSupportedDomainContext(input.request.domainContext)
    ? supportedResult(input.request)
    : fallbackResult(input.request);
}

export function validateMentalWellbeingSpecialistProposal(
  request: SpecialistRequest,
  responseInput: SpecialistResponse,
): MentalWellbeingValidationResult {
  try {
    const response = validateSpecialistResponse(request, responseInput);
    if (
      response.specialistId !== MENTAL_WELLBEING_SPECIALIST_ID ||
      response.memoryReadsRequested.length > 0 ||
      response.memoryWritesProposed.length > 0 ||
      response.proposedToolCalls.length > 0 ||
      response.escalation ||
      response.followUpRecommendation
    ) {
      return { ok: false, reasonCode: "mental_wellbeing_authority_violation" };
    }
    const serialized = JSON.stringify(response);
    if (
      serialized.includes("caregiver_permission") ||
      serialized.includes("semantic_memory_write") ||
      serialized.includes("proactive_campaign") ||
      serialized.includes("diagnosis_result") ||
      serialized.includes("treatment_prescription")
    ) {
      return { ok: false, reasonCode: "mental_wellbeing_boundary_violation" };
    }
    const instructionIds = new Set(response.uiInstructions.map((instruction) => instruction.instructionId));
    const allowedInstructionIds = new Set([
      MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID,
      MENTAL_WELLBEING_CHECKIN_PRESENTATION_ID,
      MENTAL_WELLBEING_SAFE_FALLBACK_PRESENTATION_ID,
    ]);
    if ([...instructionIds].some((id) => !allowedInstructionIds.has(id as typeof MENTAL_WELLBEING_SUMMARY_PRESENTATION_ID))) {
      return { ok: false, reasonCode: "mental_wellbeing_presentation_invalid" };
    }
    return { ok: true, response };
  } catch {
    return { ok: false, reasonCode: "mental_wellbeing_specialist_contract_invalid" };
  }
}
