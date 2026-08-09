import {
  MEDICATION_FLOW_ID,
  MEDICATION_FLOW_VERSION,
  MEDICATION_SCENE_ID,
  MEDICATION_SPECIALIST_ID,
  MEDICATION_SPECIALIST_VERSION,
  resolveMedicationRuntimeContract,
} from "./medicationFlow.js";
import {
  type MedicationSpecialistFlagResolution,
  resolveMedicationSpecialistFlag,
} from "./medicationFeatureFlag.js";
import {
  createMedicationSpecialistRequest,
  proposeMedicationSpecialistResponse,
  validateMedicationSpecialistProposal,
} from "./medicationSpecialistAdapter.js";
import { resolveMedicationLegacyOutcome } from "./medicationLegacyAdapter.js";

export type MedicationSpecialistRouteAugmentationInput = {
  domain: string;
  userId: string;
  sessionId: string;
  utterance: string;
  turnCount: number;
  confidence: number;
  now: Date;
  env?: Readonly<Record<string, string | undefined>>;
  currentRoute?: string;
};

export type MedicationSpecialistRouteAugmentation = {
  flag: MedicationSpecialistFlagResolution;
  selectedSpecialistId: typeof MEDICATION_SPECIALIST_ID;
  selectedFlowId: typeof MEDICATION_FLOW_ID;
  selectedFlowVersion: typeof MEDICATION_FLOW_VERSION;
  validation: "accepted" | "rejected";
  outcome: "tool_proposed" | "fallback_to_legacy";
  reasonCode: string;
  toolProposalDecision: "proposal_allowed" | "proposal_rejected" | "not_requested";
  actionType?: string;
  route?: string;
  capability?: string;
  presentationId?: string;
  requiresConfirmation?: string;
  promptBlock: string;
  dynamicVariables: Record<string, string>;
  sessionData: Record<string, string>;
};

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function stableRequestId(input: MedicationSpecialistRouteAugmentationInput): string {
  return [
    "request.medication.specialist",
    safeIdPart(input.sessionId),
    String(input.turnCount),
  ].join(".");
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function boolString(value: unknown): "true" | "false" {
  return value === true ? "true" : "false";
}

function buildPromptBlock(input: {
  validation: "accepted" | "rejected";
  outcome: MedicationSpecialistRouteAugmentation["outcome"];
  reasonCode: string;
  route?: string;
  actionType?: string;
  capability?: string;
  presentationId?: string;
  requiresConfirmation?: string;
}): string {
  return [
    "MEDICATION SPECIALIST MIGRATION BLOCK:",
    `selected_specialist_id=${MEDICATION_SPECIALIST_ID}`,
    `selected_specialist_version=${MEDICATION_SPECIALIST_VERSION}`,
    `selected_flow_id=${MEDICATION_FLOW_ID}`,
    `selected_flow_version=${MEDICATION_FLOW_VERSION}`,
    `scene_id=${MEDICATION_SCENE_ID}`,
    `validation=${input.validation}`,
    `outcome=${input.outcome}`,
    `reason_code=${input.reasonCode}`,
    input.actionType ? `proposed_action_type=${input.actionType}` : "",
    input.route ? `proposed_route=${input.route}` : "",
    input.capability ? `capability=${input.capability}` : "",
    input.presentationId ? `presentation_id=${input.presentationId}` : "",
    input.requiresConfirmation ? `requires_confirmation=${input.requiresConfirmation}` : "",
    "Use only the existing open_app_action bridge if a medication navigation/action is later authorized.",
    "Do not confirm, defer, skip, prescribe, dose-adjust, refill, contact pharmacies, update medication records, or execute tools from this block.",
    "Safety-sensitive medication language must stay on the existing Safety route; do not replace emergency guidance with Medication Specialist content.",
    "For fallback outcomes, preserve the legacy medication response path.",
  ].filter(Boolean).join("\n");
}

export function buildMedicationSpecialistRouteAugmentation(
  input: MedicationSpecialistRouteAugmentationInput,
): MedicationSpecialistRouteAugmentation | null {
  if (input.domain !== "meds") return null;

  const legacyOutcome = resolveMedicationLegacyOutcome(input.utterance);
  if (legacyOutcome.kind === "fallback_to_legacy") {
    return null;
  }

  const flag = resolveMedicationSpecialistFlag({
    env: input.env ?? process.env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "specialist_preview") return null;

  const contract = resolveMedicationRuntimeContract();
  const requestId = stableRequestId(input);
  if (!contract) {
    const promptBlock = buildPromptBlock({
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "medication_contract_unavailable",
    });
    return {
      flag,
      selectedSpecialistId: MEDICATION_SPECIALIST_ID,
      selectedFlowId: MEDICATION_FLOW_ID,
      selectedFlowVersion: MEDICATION_FLOW_VERSION,
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "medication_contract_unavailable",
      toolProposalDecision: "proposal_rejected",
      promptBlock,
      dynamicVariables: {
        medication_specialist_selected: "false",
        medication_specialist_validation: "rejected",
        medication_specialist_reason_code: "medication_contract_unavailable",
      },
      sessionData: {
        selected_specialist_id: MEDICATION_SPECIALIST_ID,
        selected_flow_id: MEDICATION_FLOW_ID,
        validation: "rejected",
        reason_code: "medication_contract_unavailable",
        tool_proposal_decision: "proposal_rejected",
      },
    };
  }

  const request = createMedicationSpecialistRequest({
    requestId,
    correlationId: `correlation.medication.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    userId: input.userId,
    sessionId: input.sessionId,
    flowInstanceId: `flow_instance.medication.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    currentState: "active",
    inputModality: "voice",
    locale: "en",
    timezone: "UTC",
    requestedAt: input.now.toISOString(),
    utterance: input.utterance,
    confidence: input.confidence,
    currentRoute: input.currentRoute,
    availableTools: [...contract.allowedTools],
  });
  const proposal = proposeMedicationSpecialistResponse({ request });
  const validation = validateMedicationSpecialistProposal(request, proposal);
  const accepted = validation.ok;
  const tool = accepted ? proposal.proposedToolCalls[0] : undefined;
  const completion = accepted ? proposal.completionResult ?? {} : {};
  const outcome = accepted && proposal.status === "proposed_action"
    ? "tool_proposed"
    : "fallback_to_legacy";
  const reasonCode = accepted
    ? proposal.auditMetadata.decisionCodes.at(-1) ?? "medication.specialist_accepted"
    : validation.reasonCode;
  const route = typeof tool?.arguments.route === "string" ? tool.arguments.route : undefined;
  const actionType = typeof tool?.arguments.action_type === "string"
    ? tool.arguments.action_type
    : undefined;
  const capability = typeof tool?.arguments.capability === "string"
    ? tool.arguments.capability
    : undefined;
  const presentationId = typeof tool?.arguments.presentation_id === "string"
    ? tool.arguments.presentation_id
    : stringField(completion.presentationId);
  const requiresConfirmation = tool
    ? boolString(tool.requiresConfirmation)
    : undefined;
  const promptBlock = buildPromptBlock({
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    route,
    actionType,
    capability,
    presentationId,
    requiresConfirmation,
  });

  const toolDecision = accepted && proposal.status === "proposed_action"
    ? "proposal_allowed"
    : proposal.proposedToolCalls.length
      ? "proposal_rejected"
      : "not_requested";

  return {
    flag,
    selectedSpecialistId: MEDICATION_SPECIALIST_ID,
    selectedFlowId: MEDICATION_FLOW_ID,
    selectedFlowVersion: MEDICATION_FLOW_VERSION,
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    toolProposalDecision: toolDecision,
    ...(actionType ? { actionType } : {}),
    ...(route ? { route } : {}),
    ...(capability ? { capability } : {}),
    ...(presentationId ? { presentationId } : {}),
    ...(requiresConfirmation ? { requiresConfirmation } : {}),
    promptBlock,
    dynamicVariables: {
      medication_specialist_selected: accepted ? "true" : "false",
      medication_specialist_id: MEDICATION_SPECIALIST_ID,
      medication_flow_id: MEDICATION_FLOW_ID,
      medication_flow_version: MEDICATION_FLOW_VERSION,
      medication_specialist_validation: accepted ? "accepted" : "rejected",
      medication_specialist_outcome: outcome,
      medication_specialist_reason_code: reasonCode,
      medication_tool_proposal_decision: toolDecision,
      ...(route ? { medication_action_route: route } : {}),
      ...(actionType ? { medication_action_type: actionType } : {}),
      ...(capability ? { medication_capability: capability } : {}),
      ...(presentationId ? { medication_presentation_id: presentationId } : {}),
      ...(requiresConfirmation ? { medication_requires_confirmation: requiresConfirmation } : {}),
    },
    sessionData: {
      selected_specialist_id: MEDICATION_SPECIALIST_ID,
      selected_flow_id: MEDICATION_FLOW_ID,
      selected_flow_version: MEDICATION_FLOW_VERSION,
      validation: accepted ? "accepted" : "rejected",
      outcome,
      reason_code: reasonCode,
      tool_proposal_decision: toolDecision,
      ...(route ? { route } : {}),
      ...(actionType ? { action_type: actionType } : {}),
      ...(capability ? { capability } : {}),
      ...(presentationId ? { presentation_id: presentationId } : {}),
      ...(requiresConfirmation ? { requires_confirmation: requiresConfirmation } : {}),
    },
  };
}
