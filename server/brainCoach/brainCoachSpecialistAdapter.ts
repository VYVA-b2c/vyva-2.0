import { z } from "zod";
import {
  type FlowLifecycleState,
} from "../../shared/orchestration/flowState.js";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  BRAIN_COACH_FLOW_ID,
  BRAIN_COACH_FLOW_VERSION,
  BRAIN_COACH_OPEN_APP_ACTION_TOOL,
  BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
  BRAIN_COACH_SCENE_ID,
  BRAIN_COACH_SPECIALIST_ID,
  BRAIN_COACH_SPECIALIST_VERSION,
  resolveBrainCoachRuntimeContract,
} from "./brainCoachFlow.js";
import {
  type BrainCoachLegacyOutcome,
  resolveBrainCoachLegacyOutcome,
} from "./brainCoachLegacyAdapter.js";

export type BrainCoachSpecialistInput = {
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

export type BrainCoachSpecialistProposalInput = {
  request: SpecialistRequest;
};

const supportedActionSchema = z.object({
  outcome: z.literal("activity_action_proposed"),
  flowId: z.literal(BRAIN_COACH_FLOW_ID),
  flowVersion: z.literal(BRAIN_COACH_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  actionType: z.enum([
    "brain.activity",
    "brain.memory_game",
    "brain.relax_breathe",
    "brain.focus",
    "brain.learn",
    "brain.senses",
  ]),
  route: z.string().min(1).max(500),
  activityFamily: z.string().min(1).max(120),
  activityType: z.string().min(1).max(160).optional(),
  parityReference: z.enum(["voice_action_registry", "brain_coach_activity_catalog"]),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(BRAIN_COACH_SPECIALIST_VERSION),
}).strict();

const fallbackSchema = z.object({
  outcome: z.enum(["fallback_to_legacy", "unsupported_coming_soon"]),
  flowId: z.literal(BRAIN_COACH_FLOW_ID),
  flowVersion: z.literal(BRAIN_COACH_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  reasonCode: z.enum([
    "brain_coach_unsupported_activity",
    "brain_coach_not_recognized",
    "brain_coach_client_only",
  ]),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(BRAIN_COACH_SPECIALIST_VERSION),
}).strict();

function safeOutcomeSummary(outcome: BrainCoachLegacyOutcome): string {
  if (outcome.kind === "supported_action") {
    return `${outcome.actionType}:${outcome.route}:${outcome.activityType ?? "none"}`;
  }
  return `fallback:${outcome.reasonCode}`;
}

function channelFor(modality: BrainCoachSpecialistInput["inputModality"]): SpecialistRequest["channel"] {
  if (modality === "voice") return { type: "voice", supportsVoice: true, supportsVisuals: false };
  if (modality === "text") return { type: "text", supportsVoice: false, supportsVisuals: false };
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

function deterministicId(prefix: string, facts: readonly string[]): string {
  return `${prefix}.${facts.join(".").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120)}`;
}

export function createBrainCoachSpecialistRequest(
  input: BrainCoachSpecialistInput,
): SpecialistRequest {
  const contract = resolveBrainCoachRuntimeContract();
  if (!contract) {
    throw new Error("brain coach runtime contract unavailable");
  }
  const legacyOutcome = resolveBrainCoachLegacyOutcome(input.utterance);
  const actionId = deterministicId("event.brain_coach.intent", [
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
    specialistId: BRAIN_COACH_SPECIALIST_ID,
    specialistVersion: BRAIN_COACH_SPECIALIST_VERSION,
    flowId: BRAIN_COACH_FLOW_ID,
    flowVersion: BRAIN_COACH_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "brain_coach.activity_session.request",
      confidence: input.confidence ?? 1,
      source: "deterministic",
      rationaleCode: "task15.brain_coach.legacy_parity",
    },
    userInput: {
      kind: "event_reference",
      eventId: actionId,
    },
    normalizedInput: {
      type: "event_reference",
      eventId: actionId,
      summary: "Brain Coach intent was classified through stable legacy-parity identifiers without raw speech content.",
    },
    inputModality: input.inputModality,
    triggerSource: input.triggerSource ?? "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: BRAIN_COACH_FLOW_ID,
      sceneId: BRAIN_COACH_SCENE_ID,
      legacyOutcomeKind: legacyOutcome.kind,
      legacyOutcomeSummary: safeOutcomeSummary(legacyOutcome),
      routeAuthority: "/api/router",
      presentationAuthority: "existing_voice_action_registry",
      toolExecutionAuthority: "central_orchestrator_tool_authorization",
      ...(legacyOutcome.kind === "supported_action"
        ? {
            actionType: legacyOutcome.actionType,
            route: legacyOutcome.route,
            title: legacyOutcome.title,
            activityFamily: legacyOutcome.activityFamily,
            ...(legacyOutcome.activityType ? { activityType: legacyOutcome.activityType } : {}),
            parityReference: legacyOutcome.parityReference,
          }
        : {
            fallbackReasonCode: legacyOutcome.reasonCode,
            parityReference: legacyOutcome.parityReference,
          }),
    },
    safetyContext: {
      emergencyChecked: true,
      deterministicSafetyResult: safetyResult,
      flags: safetyFlags,
      riskLevel: safetyResult === "emergency" ? "emergency" : safetyFlags.length ? "medium" : "none",
      restrictions: safetyResult === "emergency" ? ["brain_coach_preempted_by_safety"] : [],
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
      sceneId: BRAIN_COACH_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
      deviceClass: "unknown",
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      nonExecutable: true,
      task: "task15.brain_coach_specialist",
      rawUtteranceRetained: false,
      caregiverBoundaryUnchanged: true,
      scheduleBoundaryUnchanged: true,
      gamePersistenceUnchanged: true,
    },
    requestedAt: input.requestedAt,
  };
}

function supportedResult(request: SpecialistRequest): SpecialistResponse {
  const actionType = String(request.domainContext.actionType);
  const route = String(request.domainContext.route);
  const title = String(request.domainContext.title);
  const activityFamily = String(request.domainContext.activityFamily);
  const activityType = typeof request.domainContext.activityType === "string"
    ? request.domainContext.activityType
    : undefined;
  const parityReference = request.domainContext.parityReference === "brain_coach_activity_catalog"
    ? "brain_coach_activity_catalog"
    : "voice_action_registry";
  const proposalId = `proposal.brain_coach.open_app_action.${request.requestId}`;
  return {
    requestId: request.requestId,
    specialistId: BRAIN_COACH_SPECIALIST_ID,
    status: "proposed_action",
    interpretation: {
      summary: "A supported Brain Coach activity surface was selected using existing legacy routing semantics.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "Use the existing Brain Coach voice action/navigation behavior.",
        "Do not start recurring tasks, write caregiver permissions, write memory, or execute games from the Specialist.",
      ],
      prohibitedClaims: [
        "Do not claim the activity was completed.",
        "Do not claim provider, caregiver, memory, or recurring-task execution.",
      ],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [{
      proposalId,
      toolId: BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
      arguments: {
        domain: "brain_coach",
        action_type: actionType,
        route,
        title,
        activity_family: activityFamily,
        ...(activityType ? { activity_type: activityType } : {}),
      },
      reason: "Open the existing Brain Coach activity surface through the authorized voice action bridge.",
      requiresConfirmation: false,
      idempotencyKey: `brain_coach:${request.flowInstanceId}:${actionType}:${route}:${activityType ?? "none"}`,
      expectedResultType: "voice_action_navigation",
      riskLevel: "low",
    }],
    riskLevel: "low",
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "waiting_for_tool",
      pendingTool: {
        requestId: proposalId,
        toolId: BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID,
        startedAt: request.requestedAt,
      },
      reasonCode: "brain_coach.activity_session.action_proposed",
      domainStatePatch: {
        outcome: "activity_action_proposed",
        actionType,
        route,
        activityFamily,
        ...(activityType ? { activityType } : {}),
      },
    },
    completionResult: undefined,
    auditMetadata: {
      decisionCodes: [
        "brain_coach.specialist_selected",
        "brain_coach.legacy_parity_supported",
        `brain_coach.parity.${parityReference}`,
        "brain_coach.tool_proposal_only",
      ],
    },
  };
}

function fallbackResult(request: SpecialistRequest): SpecialistResponse {
  const reasonCode = typeof request.domainContext.fallbackReasonCode === "string"
    ? request.domainContext.fallbackReasonCode
    : "brain_coach_not_recognized";
  const unsupported = reasonCode === "brain_coach_unsupported_activity";
  return {
    requestId: request.requestId,
    specialistId: BRAIN_COACH_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary: unsupported
        ? "The Brain Coach request maps to unsupported or coming-soon legacy behavior."
        : "The Brain Coach request should remain on the legacy Brain Coach route.",
      confidence: 1,
      missingInformation: [],
    },
    responseGuidance: {
      facts: ["Use legacy Brain Coach fallback behavior for this request."],
      prohibitedClaims: [
        "Do not claim an unsupported game is available.",
        "Do not execute a tool from fallback.",
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
      completionReference: `completion.brain_coach.fallback.${request.requestId}`,
      reasonCode: `brain_coach.activity_session.${reasonCode}`,
    },
    completionResult: {
      outcome: unsupported ? "unsupported_coming_soon" : "fallback_to_legacy",
      flowId: request.flowId,
      flowVersion: request.flowVersion,
      flowInstanceId: request.flowInstanceId,
      reasonCode,
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: BRAIN_COACH_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "brain_coach.specialist_selected",
        "brain_coach.legacy_fallback",
        reasonCode,
      ],
    },
  };
}

export function proposeBrainCoachSpecialistResponse(
  input: BrainCoachSpecialistProposalInput,
): SpecialistResponse {
  return input.request.domainContext.legacyOutcomeKind === "supported_action"
    ? supportedResult(input.request)
    : fallbackResult(input.request);
}

export type BrainCoachSpecialistValidation =
  | { ok: true; response: SpecialistResponse }
  | { ok: false; reasonCode: "specialist_response_invalid" };

export function validateBrainCoachSpecialistProposal(
  request: SpecialistRequest,
  response: SpecialistResponse,
): BrainCoachSpecialistValidation {
  try {
    const validated = validateSpecialistResponse(request, response);
    const noAuthorityBoundaryBreach =
      validated.memoryReadsRequested.length === 0 &&
      validated.memoryWritesProposed.length === 0 &&
      !validated.escalation &&
      JSON.stringify(validated).includes("caregiver_permission") === false &&
      JSON.stringify(validated).includes("schedule") === false &&
      JSON.stringify(validated).includes("supabase") === false &&
      JSON.stringify(validated).includes("localStorage") === false;
    if (!noAuthorityBoundaryBreach) return { ok: false, reasonCode: "specialist_response_invalid" };

    if (request.domainContext.legacyOutcomeKind === "supported_action") {
      const toolCall = validated.proposedToolCalls[0];
      const result = supportedActionSchema.safeParse({
        outcome: "activity_action_proposed",
        flowId: request.flowId,
        flowVersion: request.flowVersion,
        flowInstanceId: request.flowInstanceId,
        actionType: request.domainContext.actionType,
        route: request.domainContext.route,
        activityFamily: request.domainContext.activityFamily,
        ...(request.domainContext.activityType ? { activityType: request.domainContext.activityType } : {}),
        parityReference: request.domainContext.parityReference,
        finalDecisionAuthority: "central_orchestrator",
        contractVersion: BRAIN_COACH_SPECIALIST_VERSION,
      });
      const supported =
        result.success &&
        validated.status === "proposed_action" &&
        validated.riskLevel === "low" &&
        validated.proposedToolCalls.length === 1 &&
        toolCall?.toolId === BRAIN_COACH_OPEN_APP_ACTION_TOOL_ID &&
        toolCall.arguments.domain === "brain_coach" &&
        toolCall.arguments.action_type === request.domainContext.actionType &&
        toolCall.arguments.route === request.domainContext.route &&
        toolCall.riskLevel === "low" &&
        !("execute" in toolCall.arguments) &&
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

export { BRAIN_COACH_OPEN_APP_ACTION_TOOL };
