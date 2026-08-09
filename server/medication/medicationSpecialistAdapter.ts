import { z } from "zod";
import type { FlowLifecycleState } from "../../shared/orchestration/flowState.js";
import {
  type SpecialistRequest,
  type SpecialistResponse,
  validateSpecialistResponse,
} from "../../shared/orchestration/specialist.js";
import {
  MEDICATION_FLOW_ID,
  MEDICATION_FLOW_VERSION,
  MEDICATION_OPEN_APP_ACTION_TOOL,
  MEDICATION_OPEN_APP_ACTION_TOOL_ID,
  MEDICATION_SCENE_ID,
  MEDICATION_SPECIALIST_ID,
  MEDICATION_SPECIALIST_VERSION,
  resolveMedicationRuntimeContract,
} from "./medicationFlow.js";
import {
  type MedicationLegacyOutcome,
  resolveMedicationLegacyOutcome,
} from "./medicationLegacyAdapter.js";

export type MedicationSpecialistInput = {
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

export type MedicationSpecialistProposalInput = {
  request: SpecialistRequest;
};

const supportedActionSchema = z.object({
  outcome: z.literal("medication_action_proposed"),
  flowId: z.literal(MEDICATION_FLOW_ID),
  flowVersion: z.literal(MEDICATION_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  actionType: z.enum(["meds.management", "meds.inventory_report", "meds.refill_request"]),
  route: z.enum(["/meds", "/meds/adherence-report"]),
  capability: z.enum([
    "medication_management",
    "medication_inventory_report",
    "medication_refill_request",
  ]),
  presentationId: z.enum([
    "presentation.medication.reminder",
    "presentation.medication.human_help_confirmation",
    "presentation.medication.followup",
  ]),
  presentationFamilyId: z.enum([
    "presentation.family.introduction",
    "presentation.family.tool_confirmation",
    "presentation.family.followup_choice",
  ]),
  requiresConfirmation: z.boolean(),
  riskLevel: z.enum(["low", "medium"]),
  subjectDetected: z.boolean(),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(MEDICATION_SPECIALIST_VERSION),
}).strict();

const fallbackSchema = z.object({
  outcome: z.literal("fallback_to_legacy"),
  flowId: z.literal(MEDICATION_FLOW_ID),
  flowVersion: z.literal(MEDICATION_FLOW_VERSION),
  flowInstanceId: z.string().min(1),
  reasonCode: z.enum([
    "medication_not_recognized",
    "medication_safety_preempted",
    "medication_dose_mutation_legacy",
    "medication_interaction_or_side_effect_legacy",
  ]),
  finalDecisionAuthority: z.literal("central_orchestrator"),
  contractVersion: z.literal(MEDICATION_SPECIALIST_VERSION),
}).strict();

function safeOutcomeSummary(outcome: MedicationLegacyOutcome): string {
  if (outcome.kind === "supported_action") {
    return `${outcome.actionType}:${outcome.route}:${outcome.capability}:${outcome.subjectDetected ? "subject" : "no_subject"}`;
  }
  return `fallback:${outcome.reasonCode}`;
}

function channelFor(modality: MedicationSpecialistInput["inputModality"]): SpecialistRequest["channel"] {
  if (modality === "voice") return { type: "voice", supportsVoice: true, supportsVisuals: false };
  if (modality === "text") return { type: "text", supportsVoice: false, supportsVisuals: false };
  return { type: "touch", supportsVoice: false, supportsVisuals: true };
}

function deterministicId(prefix: string, facts: readonly string[], maxLength = 128): string {
  const suffixLimit = Math.max(1, maxLength - prefix.length - 1);
  const suffix = facts.join(".").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, suffixLimit);
  return `${prefix}.${suffix}`;
}

export function createMedicationSpecialistRequest(
  input: MedicationSpecialistInput,
): SpecialistRequest {
  const contract = resolveMedicationRuntimeContract();
  if (!contract) {
    throw new Error("medication runtime contract unavailable");
  }
  const legacyOutcome = resolveMedicationLegacyOutcome(input.utterance);
  const eventId = deterministicId("event.medication.intent", [
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
    specialistId: MEDICATION_SPECIALIST_ID,
    specialistVersion: MEDICATION_SPECIALIST_VERSION,
    flowId: MEDICATION_FLOW_ID,
    flowVersion: MEDICATION_FLOW_VERSION,
    flowInstanceId: input.flowInstanceId,
    currentState: input.currentState,
    userId: input.userId,
    ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
    sessionId: input.sessionId,
    intent: {
      name: "medication.reminder.request",
      confidence: input.confidence ?? 1,
      source: "deterministic",
      rationaleCode: "task17.medication.legacy_parity",
    },
    userInput: {
      kind: "event_reference",
      eventId,
    },
    normalizedInput: {
      type: "event_reference",
      eventId,
      summary: "Medication intent was classified through stable legacy-parity identifiers without raw medication speech.",
    },
    inputModality: input.inputModality,
    triggerSource: input.triggerSource ?? "user",
    relevantMemory: [],
    domainContext: {
      flowDefinitionId: MEDICATION_FLOW_ID,
      sceneId: MEDICATION_SCENE_ID,
      legacyOutcomeKind: legacyOutcome.kind,
      legacyOutcomeSummary: safeOutcomeSummary(legacyOutcome),
      routeAuthority: "/api/router",
      medicationApiAuthority: "existing_medication_routes",
      presentationAuthority: "shared_presentation_registry",
      toolExecutionAuthority: "central_orchestrator_tool_authorization",
      doseMutationAuthority: "legacy_medication_api_only",
      ...(legacyOutcome.kind === "supported_action"
        ? {
            actionType: legacyOutcome.actionType,
            route: legacyOutcome.route,
            title: legacyOutcome.title,
            capability: legacyOutcome.capability,
            presentationId: legacyOutcome.presentationId,
            presentationFamilyId: legacyOutcome.presentationFamilyId,
            requiresConfirmation: legacyOutcome.requiresConfirmation,
            riskLevel: legacyOutcome.riskLevel,
            subjectDetected: legacyOutcome.subjectDetected,
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
      restrictions: safetyResult === "emergency" ? ["medication_preempted_by_safety"] : [],
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
      sceneId: MEDICATION_SCENE_ID,
      visibleInstructionIds: [],
      visibleOptionIds: [],
      deviceClass: "unknown",
    },
    locale: input.locale,
    timezone: input.timezone,
    channel: channelFor(input.inputModality),
    metadata: {
      nonExecutable: true,
      task: "task17.medication_specialist",
      rawUtteranceRetained: false,
      rawMedicationNameRetained: false,
      doseMutationBoundaryUnchanged: true,
      medicationRecordBoundaryUnchanged: true,
      caregiverBoundaryUnchanged: true,
      scheduleBoundaryUnchanged: true,
      noPostgresMigrationRequired: true,
    },
    requestedAt: input.requestedAt,
  };
}

function supportedResult(request: SpecialistRequest): SpecialistResponse {
  const actionType = String(request.domainContext.actionType);
  const route = String(request.domainContext.route);
  const title = String(request.domainContext.title);
  const capability = String(request.domainContext.capability);
  const presentationId = String(request.domainContext.presentationId);
  const presentationFamilyId = String(request.domainContext.presentationFamilyId);
  const requiresConfirmation = request.domainContext.requiresConfirmation === true;
  const riskLevel = request.domainContext.riskLevel === "medium" ? "medium" : "low";
  const subjectDetected = request.domainContext.subjectDetected === true;
  const proposalId = deterministicId("proposal.medication.open_app_action", [
    request.requestId,
    actionType,
    route,
  ]);
  const idempotencyKey = deterministicId("medication.open_app_action", [
    request.flowInstanceId,
    actionType,
    route,
    capability,
    subjectDetected ? "subject" : "no_subject",
  ]);
  return {
    requestId: request.requestId,
    specialistId: MEDICATION_SPECIALIST_ID,
    status: "proposed_action",
    interpretation: {
      summary: "A supported medication surface was selected using existing legacy voice-action semantics.",
      confidence: request.intent.confidence,
      missingInformation: [],
    },
    responseGuidance: {
      facts: [
        "Use the existing medication page or adherence-report surface.",
        "The Specialist only proposes a navigation/context action and does not record doses or contact anyone.",
      ],
      prohibitedClaims: [
        "Do not claim a medication dose was confirmed, deferred, skipped, or changed.",
        "Do not claim a refill, pharmacy contact, provider call, caregiver alert, or medication record update happened.",
        "Do not prescribe, change dosage, or give individualized medication instructions.",
      ],
      requiredDisclaimers: [
        "Medication guidance is informational and should be confirmed with a clinician or pharmacist.",
      ],
      urgency: "routine",
      brevity: "brief",
    },
    uiInstructions: [],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [{
      proposalId,
      toolId: MEDICATION_OPEN_APP_ACTION_TOOL_ID,
      arguments: {
        domain: "meds",
        action_type: actionType,
        route,
        title,
        capability,
        presentation_id: presentationId,
        presentation_family_id: presentationFamilyId,
        subject_detected: subjectDetected,
      },
      reason: "Open the existing medication surface through the authorized voice action bridge.",
      requiresConfirmation,
      idempotencyKey,
      expectedResultType: "voice_action_navigation",
      riskLevel,
    }],
    riskLevel,
    safetyFlags: [],
    flowStateUpdate: {
      nextLifecycleState: "waiting_for_tool",
      pendingTool: {
        requestId: proposalId,
        toolId: MEDICATION_OPEN_APP_ACTION_TOOL_ID,
        startedAt: request.requestedAt,
      },
      reasonCode: "medication.reminder.action_proposed",
      domainStatePatch: {
        outcome: "medication_action_proposed",
        actionType,
        route,
        capability,
        presentationId,
        requiresConfirmation,
        subjectDetected,
      },
    },
    completionResult: undefined,
    auditMetadata: {
      decisionCodes: [
        "medication.specialist_selected",
        "medication.legacy_parity_supported",
        "medication.tool_proposal_only",
        "medication.parity.voice_action_registry",
      ],
    },
  };
}

function fallbackResult(request: SpecialistRequest): SpecialistResponse {
  const reasonCode = typeof request.domainContext.fallbackReasonCode === "string"
    ? request.domainContext.fallbackReasonCode
    : "medication_not_recognized";
  return {
    requestId: request.requestId,
    specialistId: MEDICATION_SPECIALIST_ID,
    status: "complete",
    interpretation: {
      summary: reasonCode === "medication_safety_preempted"
        ? "Medication input is safety-sensitive and must remain outside the Medication Specialist."
        : "The medication request should remain on the legacy medication route.",
      confidence: 1,
      missingInformation: [],
    },
    responseGuidance: {
      facts: ["Use legacy medication behavior or existing safety routing for this request."],
      prohibitedClaims: [
        "Do not claim a medication dose was recorded.",
        "Do not claim a medication interaction or side effect was clinically assessed.",
        "Do not execute a tool from fallback.",
      ],
      requiredDisclaimers: [
        "Medication guidance is informational and should be confirmed with a clinician or pharmacist.",
      ],
      urgency: reasonCode === "medication_safety_preempted" ? "urgent" : "routine",
      brevity: "brief",
    },
    uiInstructions: [],
    memoryReadsRequested: [],
    memoryWritesProposed: [],
    proposedToolCalls: [],
    riskLevel: reasonCode === "medication_safety_preempted" ? "medium" : "none",
    safetyFlags: reasonCode === "medication_safety_preempted" ? ["medication.safety_sensitive"] : [],
    flowStateUpdate: {
      nextLifecycleState: "completed",
      clearExpectedInput: true,
      completionReference: `completion.medication.fallback.${request.requestId}`,
      reasonCode: `medication.reminder.${reasonCode}`,
    },
    completionResult: {
      outcome: "fallback_to_legacy",
      flowId: request.flowId,
      flowVersion: request.flowVersion,
      flowInstanceId: request.flowInstanceId,
      reasonCode,
      finalDecisionAuthority: "central_orchestrator",
      contractVersion: MEDICATION_SPECIALIST_VERSION,
    },
    auditMetadata: {
      decisionCodes: [
        "medication.specialist_selected",
        "medication.legacy_fallback",
        reasonCode,
      ],
    },
  };
}

export function proposeMedicationSpecialistResponse(
  input: MedicationSpecialistProposalInput,
): SpecialistResponse {
  return input.request.domainContext.legacyOutcomeKind === "supported_action"
    ? supportedResult(input.request)
    : fallbackResult(input.request);
}

export type MedicationSpecialistValidation =
  | { ok: true; response: SpecialistResponse }
  | { ok: false; reasonCode: "specialist_response_invalid" };

function toolArgumentsSafe(argumentsValue: Record<string, unknown>): boolean {
  const allowedKeys = new Set([
    "domain",
    "action_type",
    "route",
    "title",
    "capability",
    "presentation_id",
    "presentation_family_id",
    "subject_detected",
  ]);
  const forbiddenKeys = [
    "execute",
    "contact_pharmacy",
    "call_pharmacy",
    "notifyCaregiver",
    "writeMemory",
    "medication_name",
    "dose",
    "dosage",
    "confirmed_taken_at",
  ];
  return Object.keys(argumentsValue).every((key) => allowedKeys.has(key)) &&
    forbiddenKeys.every((key) => !(key in argumentsValue));
}

export function validateMedicationSpecialistProposal(
  request: SpecialistRequest,
  response: SpecialistResponse,
): MedicationSpecialistValidation {
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
        outcome: "medication_action_proposed",
        flowId: request.flowId,
        flowVersion: request.flowVersion,
        flowInstanceId: request.flowInstanceId,
        actionType: request.domainContext.actionType,
        route: request.domainContext.route,
        capability: request.domainContext.capability,
        presentationId: request.domainContext.presentationId,
        presentationFamilyId: request.domainContext.presentationFamilyId,
        requiresConfirmation: request.domainContext.requiresConfirmation,
        riskLevel: request.domainContext.riskLevel,
        subjectDetected: request.domainContext.subjectDetected,
        finalDecisionAuthority: "central_orchestrator",
        contractVersion: MEDICATION_SPECIALIST_VERSION,
      });
      const supported =
        result.success &&
        validated.status === "proposed_action" &&
        validated.proposedToolCalls.length === 1 &&
        toolCall?.toolId === MEDICATION_OPEN_APP_ACTION_TOOL_ID &&
        toolCall.arguments.domain === "meds" &&
        toolCall.arguments.action_type === request.domainContext.actionType &&
        toolCall.arguments.route === request.domainContext.route &&
        toolCall.arguments.title === request.domainContext.title &&
        toolCall.arguments.capability === request.domainContext.capability &&
        toolCall.arguments.presentation_id === request.domainContext.presentationId &&
        toolCall.arguments.presentation_family_id === request.domainContext.presentationFamilyId &&
        toolCall.arguments.subject_detected === request.domainContext.subjectDetected &&
        toolCall.requiresConfirmation === request.domainContext.requiresConfirmation &&
        toolCall.riskLevel === request.domainContext.riskLevel &&
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

export { MEDICATION_OPEN_APP_ACTION_TOOL };
