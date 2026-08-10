import { z } from "zod";
import type { FlowLifecycleState } from "../../shared/orchestration/flowState.js";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  CONCIERGE_FLOW_ID,
  CONCIERGE_FLOW_VERSION,
  CONCIERGE_OPEN_APP_ACTION_TOOL,
  CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
  CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID,
  CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
  CONCIERGE_SCENE_ID,
  CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID,
  CONCIERGE_SPECIALIST_ID,
  CONCIERGE_SPECIALIST_VERSION,
  CONCIERGE_TRUSTED_HELP_PRESENTATION_ID,
  resolveConciergeRuntimeContract,
} from "./conciergeFlow.js";
import {
  type ConciergeLegacyOutcome,
  resolveConciergeLegacyOutcome,
} from "./conciergeLegacyAdapter.js";

export type ConciergeSpecialistInput = {
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
  availableTools?: SpecialistRequest["availableTools"];
};

export type ConciergeSpecialistProposalInput = {
  request: SpecialistRequest;
};

const supportedActionSchema = z.object({
  outcome: z.literal("concierge_action_proposed"),
  flowId: z.literal(CONCIERGE_FLOW_ID),
  flowVersion: z.literal(CONCIERGE_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  actionType: z.enum(["concierge.task", "concierge.shopping"]),
  route: z.enum(["/concierge", "/concierge/shopping"]),
  capability: z.enum([
    "concierge_request_intake",
    "concierge_trusted_help_context",
    "concierge_shopping_context",
  ]),
  requestCategory: z.enum(["request_intake", "trusted_help_setup", "shopping_context"]),
  presentationId: z.enum([
    CONCIERGE_REQUEST_INTAKE_PRESENTATION_ID,
    CONCIERGE_TRUSTED_HELP_PRESENTATION_ID,
    CONCIERGE_SHOPPING_CONTEXT_PRESENTATION_ID,
  ]),
  presentationFamilyId: z.enum(["presentation.family.introduction", "presentation.family.summary"]),
  requiresConfirmation: z.literal(false),
  riskLevel: z.literal("low"),
  externalAction: z.literal(false),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(CONCIERGE_SPECIALIST_VERSION),
}).strict();

const fallbackSchema = z.object({
  outcome: z.literal("fallback_to_legacy"),
  flowId: z.literal(CONCIERGE_FLOW_ID),
  flowVersion: z.literal(CONCIERGE_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  reasonCode: z.enum([
    "concierge_not_recognized",
    "concierge_safety_preempted",
    "concierge_external_execution_legacy",
    "concierge_cross_domain_legacy",
  ]),
  presentationId: z.literal(CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(CONCIERGE_SPECIALIST_VERSION),
}).strict();

function safeOutcomeSummary(outcome: ConciergeLegacyOutcome): string {
  if (outcome.kind === "supported_action") {
    return `${outcome.actionType}:${outcome.route}:${outcome.capability}:${outcome.requestCategory}`;
  }
  return `fallback:${outcome.reasonCode}`;
}

function channelFor(modality: ConciergeSpecialistInput["inputModality"]): SpecialistRequest["channel"] {
  if (modality === "voice") return { type: "voice", supportsVoice: true, supportsVisuals: false };
  if (modality === "text") return { type: "text", supportsVoice: false, supportsVisuals: false };
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

function deterministicId(prefix: string, facts: readonly string[], maxLength = 128): string {
  const suffixLimit = Math.max(1, maxLength - prefix.length - 1);
  const suffix = facts.join(".").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, suffixLimit);
  return `${prefix}.${suffix}`;
}

export function createConciergeSpecialistRequest(
  input: ConciergeSpecialistInput,
): SpecialistRequest {
  const contract = resolveConciergeRuntimeContract();
  if (!contract) {
    throw new Error("concierge runtime contract unavailable");
  }
  const legacyOutcome = resolveConciergeLegacyOutcome(input.utterance);
  const eventId = deterministicId("event.concierge.intent", [
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
    specialistId: CONCIERGE_SPECIALIST_ID,
    specialistVersion: CONCIERGE_SPECIALIST_VERSION,
    flowId: CONCIERGE_FLOW_ID,
    flowVersion: CONCIERGE_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "concierge.administrative_support.request",
      confidence: input.confidence ?? 1,
      source: "deterministic",
      rationaleCode: "task18.concierge.legacy_parity",
    },
    userInput: {
      kind: "event_reference",
      eventId,
    },
    normalizedInput: {
      type: "event_reference",
      eventId,
      summary: "Concierge intent was classified through stable legacy-parity identifiers without raw Concierge speech.",
    },
    inputModality: input.inputModality,
    triggerSource: input.triggerSource ?? "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: CONCIERGE_FLOW_ID,
      sceneId: CONCIERGE_SCENE_ID,
      legacyOutcomeKind: legacyOutcome.kind,
      legacyOutcomeSummary: safeOutcomeSummary(legacyOutcome),
      routeAuthority: "/api/router",
      conciergeApiAuthority: "existing_concierge_routes",
      presentationAuthority: "shared_presentation_registry",
      toolExecutionAuthority: "central_orchestrator_tool_authorization",
      externalExecutionAuthority: "legacy_concierge_actions_only",
      ...(legacyOutcome.kind === "supported_action"
        ? {
            actionType: legacyOutcome.actionType,
            route: legacyOutcome.route,
            title: legacyOutcome.title,
            capability: legacyOutcome.capability,
            requestCategory: legacyOutcome.requestCategory,
            presentationId: legacyOutcome.presentationId,
            presentationFamilyId: legacyOutcome.presentationFamilyId,
            requiresConfirmation: legacyOutcome.requiresConfirmation,
            riskLevel: legacyOutcome.riskLevel,
            externalAction: legacyOutcome.externalAction,
            parityReference: legacyOutcome.parityReference,
          }
        : {
            fallbackReasonCode: legacyOutcome.reasonCode,
            presentationId: legacyOutcome.presentationId,
            parityReference: legacyOutcome.parityReference,
          }),
    },
    safetyContext: {
      emergencyChecked: true,
      deterministicSafetyResult: safetyResult,
      flags: safetyFlags,
      riskLevel: safetyResult === "emergency" ? "emergency" : safetyFlags.length ? "medium" : "none",
      restrictions: safetyResult === "emergency" ? ["concierge_preempted_by_safety"] : [],
      escalationAlreadyActive: false,
    },
    consentContext: {
      scopes: [],
      channelAllowed: true,
      memoryReadAllowed: false,
      memoryWriteAllowed: false,
      externalToolUseAllowed: true,
      caregiverEscalationAllowed: false,
      operatorEscalationAllowed: false,
    },
    previousAnswers: {},
    availableTools: input.availableTools ?? [...contract.allowedTools],
    uiContext: {
      ...(input.currentRoute ? { currentRoute: input.currentRoute } : {}),
      sceneId: CONCIERGE_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
      deviceClass: "unknown",
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      nonExecutable: true,
      task: "task18.concierge_specialist",
      rawUtteranceRetained: false,
      rawAddressRetained: false,
      providerBoundaryUnchanged: true,
      paymentBoundaryUnchanged: true,
      trustedHelpAuthorizationUnchanged: true,
      caregiverBoundaryUnchanged: true,
      scheduleBoundaryUnchanged: true,
      noPostgresMigrationRequired: true,
      noExternalExecution: true,
    },
    requestedAt: input.requestedAt,
  };
}

function supportedResult(request: SpecialistRequest): SpecialistResponse {
  const actionType = String(request.domainContext.actionType);
  const route = String(request.domainContext.route);
  const title = String(request.domainContext.title);
  const capability = String(request.domainContext.capability);
  const requestCategory = String(request.domainContext.requestCategory);
  const presentationId = String(request.domainContext.presentationId);
  const presentationFamilyId = String(request.domainContext.presentationFamilyId);
  const proposalId = deterministicId("proposal.concierge.open_app_action", [
    request.requestId,
    actionType,
    route,
  ]);
  const idempotencyKey = deterministicId("concierge.open_app_action", [
    request.flowInstanceId,
    actionType,
    route,
    capability,
    requestCategory,
  ]);
  return {
    requestId: request.requestId,
    specialistId: CONCIERGE_SPECIALIST_ID,
    status: "proposed_action",
    interpretation: {
      summary: "A supported Concierge navigation/context surface was selected using existing legacy voice-action semantics.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "Use the existing Concierge surface only for request-intake or context.",
        "The Specialist only proposes navigation/context and does not execute bookings, messages, payments, calls, task creation, or provider contact.",
      ],
      prohibitedClaims: [
        "Do not claim a booking, order, provider contact, payment, cancellation, task, caregiver escalation, or operator handoff happened.",
        "Do not treat Trusted Help presentation/setup metadata as authorization to contact anyone.",
        "Do not ask for or expose addresses, card details, phone numbers, provider contact details, or caregiver-private content from this block.",
      ],
      requiredDisclaimers: [
        "Concierge execution requires the existing explicit confirmation and authorization path.",
      ],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [{
      instructionId: deterministicId("instruction.concierge.summary", [request.requestId, requestCategory]),
      sceneId: CONCIERGE_SCENE_ID,
      type: "show_summary",
      payload: {
        title,
        items: [
          "Open existing Concierge context only.",
          "No booking, provider contact, message, payment, task creation, caregiver escalation, or scheduling is authorized.",
        ],
      },
    }],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [{
      proposalId,
      toolId: CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
      arguments: {
        domain: "concierge",
        action_type: actionType,
        route,
        title,
        capability,
        presentation_id: presentationId,
        presentation_family_id: presentationFamilyId,
        request_category: requestCategory,
        external_action: false,
        confirmation_required: false,
      },
      reason: "Open the existing Concierge surface through the authorized voice action bridge.",
      requiresConfirmation: false,
      idempotencyKey,
      expectedResultType: "voice_action_navigation",
      riskLevel: "low",
    }],
    riskLevel: "low",
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "waiting_for_tool",
      pendingTool: {
        requestId: proposalId,
        toolId: CONCIERGE_OPEN_APP_ACTION_TOOL_ID,
        startedAt: request.requestedAt,
      },
      reasonCode: "concierge.administrative_support.action_proposed",
      domainStatePatch: {
        outcome: "concierge_action_proposed",
        actionType,
        route,
        capability,
        requestCategory,
        presentationId,
        externalAction: false,
        confirmationRequired: false,
      },
    },
    completionResult: undefined,
    auditMetadata: {
      decisionCodes: [
        "concierge.specialist_selected",
        "concierge.legacy_parity_supported",
        "concierge.tool_proposal_only",
        "concierge.no_external_execution",
      ],
    },
  };
}

function fallbackResult(request: SpecialistRequest): SpecialistResponse {
  const reasonCode = typeof request.domainContext.fallbackReasonCode === "string"
    ? request.domainContext.fallbackReasonCode
    : "concierge_not_recognized";
  return {
    requestId: request.requestId,
    specialistId: CONCIERGE_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary: reasonCode === "concierge_safety_preempted"
        ? "Concierge input is safety-sensitive and must remain outside the Concierge Specialist."
        : "The Concierge request should remain on the legacy Concierge route or existing domain route.",
      confidence: 1,
      missingInformation: [],
    },
    responseGuidance: {
      facts: ["Use legacy Concierge behavior, another domain route, or existing Safety routing for this request."],
      prohibitedClaims: [
        "Do not claim Concierge execution happened.",
        "Do not execute a tool from fallback.",
        "Do not contact providers, caregivers, operators, or trusted helpers from fallback.",
      ],
      urgency: reasonCode === "concierge_safety_preempted" ? "urgent" : "routine",
      brevity: "brief",
    },
    uiInstructions: [],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: reasonCode === "concierge_safety_preempted" ? "medium" : "none",
    safetyFlags: reasonCode === "concierge_safety_preempted" ? ["concierge.safety_sensitive"] : [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      clearExpectedInput: true,
      completionReference: `completion.concierge.fallback.${request.requestId}`,
      reasonCode: `concierge.administrative_support.${reasonCode}`,
    },
    completionResult: {
      outcome: "fallback_to_legacy",
      flowId: request.flowId,
      flowVersion: request.flowVersion,
      flowInstanceId: request.flowInstanceId,
      reasonCode,
      presentationId: CONCIERGE_SAFE_FALLBACK_PRESENTATION_ID,
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: CONCIERGE_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "concierge.specialist_selected",
        "concierge.legacy_fallback",
        reasonCode,
      ],
    },
  };
}

export function proposeConciergeSpecialistResponse(
  input: ConciergeSpecialistProposalInput,
): SpecialistResponse {
  return input.request.domainContext.legacyOutcomeKind === "supported_action"
    ? supportedResult(input.request)
    : fallbackResult(input.request);
}

export type ConciergeSpecialistValidation =
  | { ok: true; response: SpecialistResponse }
  | { ok: false; reasonCode: "specialist_response_invalid" };

const FORBIDDEN_ARGUMENT_KEYS = new Set([
  "execute",
  "directExecution",
  "contactProvider",
  "contact_provider",
  "provider",
  "provider_id",
  "provider_phone",
  "provider_email",
  "phone",
  "email",
  "sms",
  "whatsapp",
  "booking_id",
  "appointment_id",
  "payment",
  "card",
  "address",
  "pickup",
  "destination",
  "create_task",
  "task_id",
  "caregiver",
  "operator",
  "writeMemory",
]);

function toolArgumentsSafe(argumentsValue: Record<string, unknown>): boolean {
  const allowedKeys = new Set([
    "domain",
    "action_type",
    "route",
    "title",
    "capability",
    "presentation_id",
    "presentation_family_id",
    "request_category",
    "external_action",
    "confirmation_required",
  ]);
  return Object.keys(argumentsValue).every((key) => allowedKeys.has(key)) &&
    [...FORBIDDEN_ARGUMENT_KEYS].every((key) => !(key in argumentsValue));
}

export function validateConciergeSpecialistProposal(
  request: SpecialistRequest,
  response: SpecialistResponse,
): ConciergeSpecialistValidation {
  try {
    const validated = validateSpecialistResponse(request, response);
    const noAuthorityBoundaryBreach =
      validated.memoryReadsRequested.length === 0 &&
      validated.memoryWritesProposed.length === 0 &&
      !validated.escalation &&
      !validated.followUpRecommendation;
    if (!noAuthorityBoundaryBreach) return { ok: false, reasonCode: "specialist_response_invalid" };

    if (request.domainContext.legacyOutcomeKind === "supported_action") {
      const toolCall = validated.proposedToolCalls[0];
      const result = supportedActionSchema.safeParse({
        outcome: "concierge_action_proposed",
        flowId: request.flowId,
        flowVersion: request.flowVersion,
        flowInstanceId: request.flowInstanceId,
        actionType: request.domainContext.actionType,
        route: request.domainContext.route,
        capability: request.domainContext.capability,
        requestCategory: request.domainContext.requestCategory,
        presentationId: request.domainContext.presentationId,
        presentationFamilyId: request.domainContext.presentationFamilyId,
        requiresConfirmation: request.domainContext.requiresConfirmation,
        riskLevel: request.domainContext.riskLevel,
        externalAction: request.domainContext.externalAction,
        finalDecisionAuthority: "central_orchestrator",
        contractVersion: CONCIERGE_SPECIALIST_VERSION,
      });
      const supported =
        result.success &&
        validated.status === "proposed_action" &&
        validated.proposedToolCalls.length === 1 &&
        toolCall?.toolId === CONCIERGE_OPEN_APP_ACTION_TOOL_ID &&
        toolCall.arguments.domain === "concierge" &&
        toolCall.arguments.action_type === request.domainContext.actionType &&
        toolCall.arguments.route === request.domainContext.route &&
        toolCall.arguments.title === request.domainContext.title &&
        toolCall.arguments.capability === request.domainContext.capability &&
        toolCall.arguments.presentation_id === request.domainContext.presentationId &&
        toolCall.arguments.presentation_family_id === request.domainContext.presentationFamilyId &&
        toolCall.arguments.request_category === request.domainContext.requestCategory &&
        toolCall.arguments.external_action === false &&
        toolCall.arguments.confirmation_required === false &&
        toolCall.requiresConfirmation === false &&
        toolCall.riskLevel === "low" &&
        toolArgumentsSafe(toolCall.arguments) &&
        validated.flowStateUpdate?.nextLifecycleState === "waiting_for_tool";
      return supported
        ? { ok: true, response: validated }
        : { ok: false, reasonCode: "specialist_response_invalid" };
    }

    const parsedFallback = fallbackSchema.safeParse(validated.completionResult);
    const supported =
      parsedFallback.success &&
      validated.status === "complete" &&
      validated.proposedToolCalls.length === 0 &&
      parsedFallback.data.reasonCode === request.domainContext.fallbackReasonCode &&
      validated.flowStateUpdate?.nextLifecycleState === "completed";
    return supported
      ? { ok: true, response: validated }
      : { ok: false, reasonCode: "specialist_response_invalid" };
  } catch {
    return { ok: false, reasonCode: "specialist_response_invalid" };
  }
}

export { CONCIERGE_OPEN_APP_ACTION_TOOL };
