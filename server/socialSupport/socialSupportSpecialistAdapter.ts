import { z } from "zod";
import type { FlowLifecycleState } from "../../shared/orchestration/flowState.js";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID,
  SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID,
  SOCIAL_SUPPORT_FLOW_ID,
  SOCIAL_SUPPORT_FLOW_VERSION,
  SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL,
  SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
  SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID,
  SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
  SOCIAL_SUPPORT_SCENE_ID,
  SOCIAL_SUPPORT_SPECIALIST_ID,
  SOCIAL_SUPPORT_SPECIALIST_VERSION,
  resolveSocialSupportRuntimeContract,
} from "./socialSupportFlow.js";
import {
  type SocialSupportLegacyOutcome,
  resolveSocialSupportLegacyOutcome,
} from "./socialSupportLegacyAdapter.js";

export type SocialSupportSpecialistInput = {
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

export type SocialSupportSpecialistProposalInput = {
  request: SpecialistRequest;
};

const supportedActionSchema = z.object({
  outcome: z.literal("social_support_action_proposed"),
  flowId: z.literal(SOCIAL_SUPPORT_FLOW_ID),
  flowVersion: z.literal(SOCIAL_SUPPORT_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  actionType: z.enum(["social.community", "social.rooms", "social.activities"]),
  route: z.enum(["/social-rooms", "/social-rooms/join-in", "/social-rooms/activities"]),
  capability: z.enum([
    "social_community_navigation",
    "social_rooms_context",
    "community_activities_context",
  ]),
  requestCategory: z.enum(["community_home", "social_rooms", "community_activities"]),
  presentationId: z.enum([
    SOCIAL_SUPPORT_COMMUNITY_PRESENTATION_ID,
    SOCIAL_SUPPORT_ROOMS_PRESENTATION_ID,
    SOCIAL_SUPPORT_ACTIVITIES_PRESENTATION_ID,
  ]),
  presentationFamilyId: z.literal("presentation.family.summary"),
  requiresConfirmation: z.literal(false),
  riskLevel: z.literal("low"),
  externalAction: z.literal(false),
  humanContact: z.literal(false),
  caregiverAuthority: z.literal(false),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(SOCIAL_SUPPORT_SPECIALIST_VERSION),
}).strict();

const fallbackSchema = z.object({
  outcome: z.literal("fallback_to_legacy"),
  flowId: z.literal(SOCIAL_SUPPORT_FLOW_ID),
  flowVersion: z.literal(SOCIAL_SUPPORT_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  reasonCode: z.enum([
    "social_support_not_recognized",
    "social_support_safety_preempted",
    "social_support_mental_wellbeing_legacy",
    "social_support_concierge_legacy",
    "social_support_caregiver_authority_legacy",
    "social_support_external_execution_legacy",
    "social_support_cross_domain_legacy",
  ]),
  presentationId: z.literal(SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(SOCIAL_SUPPORT_SPECIALIST_VERSION),
}).strict();

function safeOutcomeSummary(outcome: SocialSupportLegacyOutcome): string {
  if (outcome.kind === "supported_action") {
    return `${outcome.actionType}:${outcome.route}:${outcome.capability}:${outcome.requestCategory}`;
  }
  return `fallback:${outcome.reasonCode}`;
}

function channelFor(modality: SocialSupportSpecialistInput["inputModality"]): SpecialistRequest["channel"] {
  if (modality === "voice") return { type: "voice", supportsVoice: true, supportsVisuals: false };
  if (modality === "text") return { type: "text", supportsVoice: false, supportsVisuals: false };
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

function deterministicId(prefix: string, facts: readonly string[], maxLength = 128): string {
  const suffixLimit = Math.max(1, maxLength - prefix.length - 1);
  const suffix = facts.join(".").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, suffixLimit);
  return `${prefix}.${suffix}`;
}

export function createSocialSupportSpecialistRequest(
  input: SocialSupportSpecialistInput,
): SpecialistRequest {
  const contract = resolveSocialSupportRuntimeContract();
  if (!contract) {
    throw new Error("social support runtime contract unavailable");
  }
  const legacyOutcome = resolveSocialSupportLegacyOutcome(input.utterance);
  const eventId = deterministicId("event.social_support.intent", [
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
    specialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    specialistVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
    flowId: SOCIAL_SUPPORT_FLOW_ID,
    flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "social.community_connection.request",
      confidence: input.confidence ?? 1,
      source: "deterministic",
      rationaleCode: "task19.social_support.legacy_parity",
    },
    userInput: {
      kind: "event_reference",
      eventId,
    },
    normalizedInput: {
      type: "event_reference",
      eventId,
      summary:
        "Social/community navigation intent was classified through stable legacy-parity identifiers without raw support speech.",
    },
    inputModality: input.inputModality,
    triggerSource: input.triggerSource ?? "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: SOCIAL_SUPPORT_FLOW_ID,
      sceneId: SOCIAL_SUPPORT_SCENE_ID,
      legacyOutcomeKind: legacyOutcome.kind,
      legacyOutcomeSummary: safeOutcomeSummary(legacyOutcome),
      routeAuthority: "/api/router",
      socialRouteAuthority: "existing_social_routes",
      presentationAuthority: "shared_presentation_registry",
      toolExecutionAuthority: "central_orchestrator_tool_authorization",
      humanContactAuthority: "not_in_task19_scope",
      caregiverPermissionAuthority: "existing_caregiver_permission_routes_only",
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
            humanContact: legacyOutcome.humanContact,
            caregiverAuthority: legacyOutcome.caregiverAuthority,
            parityReference: legacyOutcome.parityReference,
          }
        : {
            fallbackReasonCode: legacyOutcome.reasonCode,
            fallbackPresentationId: legacyOutcome.presentationId,
            parityReference: legacyOutcome.parityReference,
          }),
    },
    safetyContext: {
      emergencyChecked: true,
      deterministicSafetyResult: safetyResult,
      flags: safetyFlags,
      riskLevel: safetyResult === "emergency" ? "emergency" : safetyFlags.length ? "medium" : "none",
      restrictions: safetyResult === "emergency" ? ["social_support_preempted_by_safety"] : [],
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
    availableTools: input.availableTools ?? [...contract.allowedTools],
    uiContext: {
      currentRoute: input.currentRoute,
      sceneId: SOCIAL_SUPPORT_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      task19Stage: "stage_10e_social_support_specialist",
      rawUtteranceRetained: false,
      migrationBoundary: "community_navigation_context_only",
      mentalWellbeingBoundaryUnchanged: true,
      conciergeBoundaryUnchanged: true,
      trustedHelpBoundaryUnchanged: true,
      caregiverPermissionBoundaryUnchanged: true,
      caregiverOperatorEscalationBoundaryUnchanged: true,
      memoryBoundaryUnchanged: true,
      scheduleBoundaryUnchanged: true,
      noPostgresMigrationRequired: true,
    },
    requestedAt: input.requestedAt,
  };
}

function supportedResponse(request: SpecialistRequest): SpecialistResponse {
  const actionType = String(request.domainContext.actionType);
  const route = String(request.domainContext.route);
  const title = String(request.domainContext.title);
  const capability = String(request.domainContext.capability);
  const requestCategory = String(request.domainContext.requestCategory);
  const presentationId = String(request.domainContext.presentationId);
  const presentationFamilyId = String(request.domainContext.presentationFamilyId);
  supportedActionSchema.parse({
    outcome: "social_support_action_proposed",
    flowId: SOCIAL_SUPPORT_FLOW_ID,
    flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
    flowInstanceId: request.flowInstanceId,
    actionType,
    route,
    capability,
    requestCategory,
    presentationId,
    presentationFamilyId,
    requiresConfirmation: false,
    riskLevel: "low",
    externalAction: false,
    humanContact: false,
    caregiverAuthority: false,
    finalDecisionAuthority: "central_orchestrator",
    contractVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
  });
  return {
    requestId: request.requestId,
    specialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    status: "proposed_action",
    interpretation: {
      summary:
        "A user-initiated community/social navigation request was mapped to an existing Social Rooms route.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "This is community/social navigation context only.",
        "The existing Social Rooms or community activity surface remains the user-facing implementation.",
      ],
      tone: "warm",
      acknowledgements: ["I can open the community area."],
      prohibitedClaims: [
        "Do not claim to contact another person.",
        "Do not grant or change caregiver permissions.",
        "Do not create safety, caregiver, operator, memory, schedule, or proactive side effects.",
      ],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [{
      type: "show_summary",
      instructionId: presentationId,
      sceneId: SOCIAL_SUPPORT_SCENE_ID,
      priority: 40,
      payload: {
        title,
        items: [String(request.domainContext.summary ?? "Open the existing community surface.")],
      },
    }],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [{
      proposalId: deterministicId("proposal.social_support.open_app", [
        request.requestId,
        capability,
        route,
      ]),
      toolId: SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
      arguments: {
        domain: "social",
        action_type: actionType,
        route,
        title,
        capability,
        presentation_id: presentationId,
        presentation_family_id: presentationFamilyId,
        request_category: requestCategory,
        external_action: false,
        confirmation_required: false,
        human_contact: false,
        caregiver_authority: false,
      },
      reason: "Open existing Social Rooms or community activity surface through Orchestrator-authorized navigation.",
      requiresConfirmation: false,
      idempotencyKey: deterministicId("idempotency.social_support.open_app", [
        request.userId,
        request.sessionId,
        capability,
        route,
      ]),
      expectedResultType: "voice_action_navigation",
      riskLevel: "low",
    }],
    riskLevel: "low",
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "waiting_for_tool",
      pendingTool: {
        toolId: SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID,
        requestId: deterministicId("proposal.social_support.open_app", [
          request.requestId,
          capability,
          route,
        ]),
        startedAt: request.requestedAt,
      },
      domainStatePatch: {
        socialSupport: {
          capability,
          requestCategory,
          presentationId,
          humanContact: false,
          caregiverAuthority: false,
        },
      },
      reasonCode: "social_support.action_proposed",
    },
    auditMetadata: {
      decisionCodes: [
        "social_support.legacy_parity_checked",
        "social_support.tool_proposal_bounded",
        "social_support.specialist_accepted",
      ],
      promptVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
    },
  };
}

function fallbackResponse(request: SpecialistRequest): SpecialistResponse {
  const reasonCode = String(request.domainContext.fallbackReasonCode ?? "social_support_not_recognized");
  const completionResult = fallbackSchema.parse({
    outcome: "fallback_to_legacy",
    flowId: SOCIAL_SUPPORT_FLOW_ID,
    flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
    flowInstanceId: request.flowInstanceId,
    reasonCode,
    presentationId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
    finalDecisionAuthority: "central_orchestrator",
    contractVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
  });
  return {
    requestId: request.requestId,
    specialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary: "The request is outside the narrow Social Support migration slice.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: ["Preserve the existing legacy router or neighboring Specialist behavior."],
      tone: "neutral",
      prohibitedClaims: [
        "Do not contact humans.",
        "Do not alter caregiver permissions.",
        "Do not create escalation or proactive outreach.",
      ],
      urgency: reasonCode === "social_support_safety_preempted" ? "urgent" : "routine",
      brevity: "brief",
    },
    uiInstructions: [{
      type: "show_summary",
      instructionId: SOCIAL_SUPPORT_SAFE_FALLBACK_PRESENTATION_ID,
      sceneId: SOCIAL_SUPPORT_SCENE_ID,
      priority: 10,
      payload: {
        title: "Use existing support",
        items: [reasonCode],
      },
    }],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: reasonCode === "social_support_safety_preempted" ? "medium" : "none",
    safetyFlags: reasonCode === "social_support_safety_preempted" ? ["social_support.safety_preempted"] : [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      completionReference: deterministicId("completion.social_support.fallback", [
        request.requestId,
        reasonCode,
      ]),
      reasonCode,
    },
    completionResult,
    auditMetadata: {
      decisionCodes: ["social_support.fallback_to_legacy", reasonCode],
      promptVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
    },
  };
}

export function proposeSocialSupportSpecialistResponse(
  input: SocialSupportSpecialistProposalInput,
): SpecialistResponse {
  const request = input.request;
  return request.domainContext.legacyOutcomeKind === "supported_action"
    ? supportedResponse(request)
    : fallbackResponse(request);
}

const forbiddenToolArgumentKeys = new Set([
  "caregiver",
  "caregiver_id",
  "caregiverId",
  "caregiver_phone",
  "caregiver_email",
  "trusted_person",
  "trusted_contact",
  "phone",
  "email",
  "sms",
  "whatsapp",
  "message",
  "message_body",
  "notify",
  "invite",
  "share",
  "permission",
  "permissions",
  "grant_access",
  "remove_access",
  "health_data",
  "medication",
  "operator",
  "escalation",
  "create_task",
  "schedule",
  "queue",
  "memory",
  "writeMemory",
]);

function toolArgumentsSafe(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => !forbiddenToolArgumentKeys.has(key));
}

export function validateSocialSupportSpecialistProposal(
  request: SpecialistRequest,
  response: SpecialistResponse,
): { ok: true; response: SpecialistResponse } | { ok: false; reasonCode: string } {
  try {
    const validated = validateSpecialistResponse(request, response);
    if (request.currentState !== "active") {
      return { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
    }
    if (request.safetyContext.deterministicSafetyResult === "emergency") {
      return { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
    }
    if (
      validated.memoryReadsRequested.length ||
      validated.memoryWritesProposed.length ||
      validated.escalation ||
      validated.followUpRecommendation
    ) {
      return { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
    }

    if (request.domainContext.legacyOutcomeKind === "supported_action") {
      const toolCall = validated.proposedToolCalls[0];
      const result = supportedActionSchema.safeParse({
        outcome: "social_support_action_proposed",
        flowId: SOCIAL_SUPPORT_FLOW_ID,
        flowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
        flowInstanceId: request.flowInstanceId,
        actionType: toolCall?.arguments.action_type,
        route: toolCall?.arguments.route,
        capability: toolCall?.arguments.capability,
        requestCategory: toolCall?.arguments.request_category,
        presentationId: toolCall?.arguments.presentation_id,
        presentationFamilyId: toolCall?.arguments.presentation_family_id,
        requiresConfirmation: toolCall?.arguments.confirmation_required,
        riskLevel: toolCall?.riskLevel,
        externalAction: toolCall?.arguments.external_action,
        humanContact: toolCall?.arguments.human_contact,
        caregiverAuthority: toolCall?.arguments.caregiver_authority,
        finalDecisionAuthority: "central_orchestrator",
        contractVersion: SOCIAL_SUPPORT_SPECIALIST_VERSION,
      });
      const supported =
        result.success &&
        validated.status === "proposed_action" &&
        validated.proposedToolCalls.length === 1 &&
        toolCall?.toolId === SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL_ID &&
        toolCall.arguments.domain === "social" &&
        toolCall.arguments.action_type === request.domainContext.actionType &&
        toolCall.arguments.route === request.domainContext.route &&
        toolCall.arguments.title === request.domainContext.title &&
        toolCall.arguments.capability === request.domainContext.capability &&
        toolCall.arguments.presentation_id === request.domainContext.presentationId &&
        toolCall.arguments.presentation_family_id === request.domainContext.presentationFamilyId &&
        toolCall.arguments.request_category === request.domainContext.requestCategory &&
        toolCall.arguments.external_action === false &&
        toolCall.arguments.confirmation_required === false &&
        toolCall.arguments.human_contact === false &&
        toolCall.arguments.caregiver_authority === false &&
        toolCall.requiresConfirmation === false &&
        toolCall.riskLevel === "low" &&
        toolArgumentsSafe(toolCall.arguments) &&
        validated.flowStateUpdate?.nextLifecycleState === "waiting_for_tool";
      return supported
        ? { ok: true, response: validated }
        : { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
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
      : { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
  } catch {
    return { ok: false, reasonCode: "social_support_specialist_contract_invalid" };
  }
}

export { SOCIAL_SUPPORT_OPEN_APP_ACTION_TOOL };
