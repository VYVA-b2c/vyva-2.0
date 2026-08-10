import {
  CONCIERGE_FLOW_ID,
  CONCIERGE_FLOW_VERSION,
  CONCIERGE_SCENE_ID,
  CONCIERGE_SPECIALIST_ID,
  CONCIERGE_SPECIALIST_VERSION,
  resolveConciergeRuntimeContract,
} from "./conciergeFlow.js";
import {
  type ConciergeSpecialistFlagResolution,
  resolveConciergeSpecialistFlag,
} from "./conciergeFeatureFlag.js";
import {
  createConciergeSpecialistRequest,
  proposeConciergeSpecialistResponse,
  validateConciergeSpecialistProposal,
} from "./conciergeSpecialistAdapter.js";
import { resolveConciergeLegacyOutcome } from "./conciergeLegacyAdapter.js";

export type ConciergeSpecialistRouteAugmentationInput = {
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

export type ConciergeSpecialistRouteAugmentation = {
  flag: ConciergeSpecialistFlagResolution;
  selectedSpecialistId: typeof CONCIERGE_SPECIALIST_ID;
  selectedFlowId: typeof CONCIERGE_FLOW_ID;
  selectedFlowVersion: typeof CONCIERGE_FLOW_VERSION;
  validation: "accepted" | "rejected";
  outcome: "tool_proposed" | "fallback_to_legacy";
  reasonCode: string;
  toolProposalDecision: "proposal_allowed" | "proposal_rejected" | "not_requested";
  actionType?: string;
  route?: string;
  capability?: string;
  requestCategory?: string;
  presentationId?: string;
  requiresConfirmation?: string;
  externalAction?: string;
  promptBlock: string;
  dynamicVariables: Record<string, string>;
  sessionData: Record<string, string>;
};

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function stableRequestId(input: ConciergeSpecialistRouteAugmentationInput): string {
  return [
    "request.concierge.specialist",
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
  outcome: ConciergeSpecialistRouteAugmentation["outcome"];
  reasonCode: string;
  route?: string;
  actionType?: string;
  capability?: string;
  requestCategory?: string;
  presentationId?: string;
  requiresConfirmation?: string;
  externalAction?: string;
}): string {
  return [
    "CONCIERGE SPECIALIST MIGRATION BLOCK:",
    `selected_specialist_id=${CONCIERGE_SPECIALIST_ID}`,
    `selected_specialist_version=${CONCIERGE_SPECIALIST_VERSION}`,
    `selected_flow_id=${CONCIERGE_FLOW_ID}`,
    `selected_flow_version=${CONCIERGE_FLOW_VERSION}`,
    `scene_id=${CONCIERGE_SCENE_ID}`,
    `validation=${input.validation}`,
    `outcome=${input.outcome}`,
    `reason_code=${input.reasonCode}`,
    input.actionType ? `proposed_action_type=${input.actionType}` : "",
    input.route ? `proposed_route=${input.route}` : "",
    input.capability ? `capability=${input.capability}` : "",
    input.requestCategory ? `request_category=${input.requestCategory}` : "",
    input.presentationId ? `presentation_id=${input.presentationId}` : "",
    input.requiresConfirmation ? `requires_confirmation=${input.requiresConfirmation}` : "",
    input.externalAction ? `external_action=${input.externalAction}` : "",
    "Use only the existing open_app_action bridge if Concierge navigation/context is later authorized.",
    "Do not book, reserve, cancel, order, purchase, pay, contact providers/vendors/caregivers/operators, send messages, create Concierge tasks, write memory, or execute tools from this block.",
    "Trusted Help setup/presentation metadata is not authorization to contact a trusted person, provider, caregiver, or operator.",
    "Safety-sensitive Concierge language must stay on the existing Safety route; do not replace emergency guidance with Concierge content.",
    "For fallback outcomes, preserve the legacy Concierge response path.",
  ].filter(Boolean).join("\n");
}

export function buildConciergeSpecialistRouteAugmentation(
  input: ConciergeSpecialistRouteAugmentationInput,
): ConciergeSpecialistRouteAugmentation | null {
  if (input.domain !== "concierge") return null;

  const legacyOutcome = resolveConciergeLegacyOutcome(input.utterance);
  if (legacyOutcome.kind === "fallback_to_legacy") {
    return null;
  }

  const flag = resolveConciergeSpecialistFlag({
    env: input.env ?? process.env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "specialist_preview") return null;

  const contract = resolveConciergeRuntimeContract();
  const requestId = stableRequestId(input);
  if (!contract) {
    const promptBlock = buildPromptBlock({
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "concierge_contract_unavailable",
    });
    return {
      flag,
      selectedSpecialistId: CONCIERGE_SPECIALIST_ID,
      selectedFlowId: CONCIERGE_FLOW_ID,
      selectedFlowVersion: CONCIERGE_FLOW_VERSION,
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "concierge_contract_unavailable",
      toolProposalDecision: "proposal_rejected",
      promptBlock,
      dynamicVariables: {
        concierge_specialist_selected: "false",
        concierge_specialist_validation: "rejected",
        concierge_specialist_reason_code: "concierge_contract_unavailable",
      },
      sessionData: {
        selected_specialist_id: CONCIERGE_SPECIALIST_ID,
        selected_flow_id: CONCIERGE_FLOW_ID,
        validation: "rejected",
        reason_code: "concierge_contract_unavailable",
        tool_proposal_decision: "proposal_rejected",
      },
    };
  }

  const request = createConciergeSpecialistRequest({
    requestId,
    correlationId: `correlation.concierge.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    userId: input.userId,
    sessionId: input.sessionId,
    flowInstanceId: `flow_instance.concierge.${safeIdPart(input.sessionId)}.${input.turnCount}`,
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
  const proposal = proposeConciergeSpecialistResponse({ request });
  const validation = validateConciergeSpecialistProposal(request, proposal);
  const accepted = validation.ok;
  const tool = accepted ? proposal.proposedToolCalls[0] : undefined;
  const completion = accepted ? proposal.completionResult ?? {} : {};
  const outcome = accepted && proposal.status === "proposed_action"
    ? "tool_proposed"
    : "fallback_to_legacy";
  const reasonCode = accepted
    ? proposal.auditMetadata.decisionCodes.at(-1) ?? "concierge.specialist_accepted"
    : validation.reasonCode;
  const route = typeof tool?.arguments.route === "string" ? tool.arguments.route : undefined;
  const actionType = typeof tool?.arguments.action_type === "string"
    ? tool.arguments.action_type
    : undefined;
  const capability = typeof tool?.arguments.capability === "string"
    ? tool.arguments.capability
    : undefined;
  const requestCategory = typeof tool?.arguments.request_category === "string"
    ? tool.arguments.request_category
    : undefined;
  const presentationId = typeof tool?.arguments.presentation_id === "string"
    ? tool.arguments.presentation_id
    : stringField(completion.presentationId);
  const requiresConfirmation = tool
    ? boolString(tool.requiresConfirmation)
    : undefined;
  const externalAction = tool
    ? boolString(tool.arguments.external_action)
    : undefined;
  const toolDecision = accepted && proposal.status === "proposed_action"
    ? "proposal_allowed"
    : proposal.proposedToolCalls.length
      ? "proposal_rejected"
      : "not_requested";
  const promptBlock = buildPromptBlock({
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    route,
    actionType,
    capability,
    requestCategory,
    presentationId,
    requiresConfirmation,
    externalAction,
  });

  return {
    flag,
    selectedSpecialistId: CONCIERGE_SPECIALIST_ID,
    selectedFlowId: CONCIERGE_FLOW_ID,
    selectedFlowVersion: CONCIERGE_FLOW_VERSION,
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    toolProposalDecision: toolDecision,
    ...(actionType ? { actionType } : {}),
    ...(route ? { route } : {}),
    ...(capability ? { capability } : {}),
    ...(requestCategory ? { requestCategory } : {}),
    ...(presentationId ? { presentationId } : {}),
    ...(requiresConfirmation ? { requiresConfirmation } : {}),
    ...(externalAction ? { externalAction } : {}),
    promptBlock,
    dynamicVariables: {
      concierge_specialist_selected: accepted ? "true" : "false",
      concierge_specialist_id: CONCIERGE_SPECIALIST_ID,
      concierge_flow_id: CONCIERGE_FLOW_ID,
      concierge_flow_version: CONCIERGE_FLOW_VERSION,
      concierge_specialist_validation: accepted ? "accepted" : "rejected",
      concierge_specialist_outcome: outcome,
      concierge_specialist_reason_code: reasonCode,
      concierge_tool_proposal_decision: toolDecision,
      ...(route ? { concierge_action_route: route } : {}),
      ...(actionType ? { concierge_action_type: actionType } : {}),
      ...(capability ? { concierge_capability: capability } : {}),
      ...(requestCategory ? { concierge_request_category: requestCategory } : {}),
      ...(presentationId ? { concierge_presentation_id: presentationId } : {}),
      ...(requiresConfirmation ? { concierge_requires_confirmation: requiresConfirmation } : {}),
      ...(externalAction ? { concierge_external_action: externalAction } : {}),
    },
    sessionData: {
      selected_specialist_id: CONCIERGE_SPECIALIST_ID,
      selected_flow_id: CONCIERGE_FLOW_ID,
      selected_flow_version: CONCIERGE_FLOW_VERSION,
      validation: accepted ? "accepted" : "rejected",
      outcome,
      reason_code: reasonCode,
      tool_proposal_decision: toolDecision,
      ...(route ? { route } : {}),
      ...(actionType ? { action_type: actionType } : {}),
      ...(capability ? { capability } : {}),
      ...(requestCategory ? { request_category: requestCategory } : {}),
      ...(presentationId ? { presentation_id: presentationId } : {}),
      ...(requiresConfirmation ? { requires_confirmation: requiresConfirmation } : {}),
      ...(externalAction ? { external_action: externalAction } : {}),
    },
  };
}
