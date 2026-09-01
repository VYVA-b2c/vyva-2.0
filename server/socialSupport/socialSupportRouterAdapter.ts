import {
  SOCIAL_SUPPORT_FLOW_ID,
  SOCIAL_SUPPORT_FLOW_VERSION,
  SOCIAL_SUPPORT_SCENE_ID,
  SOCIAL_SUPPORT_SPECIALIST_ID,
  SOCIAL_SUPPORT_SPECIALIST_VERSION,
  resolveSocialSupportRuntimeContract,
} from "./socialSupportFlow.js";
import {
  type SocialSupportSpecialistFlagResolution,
  resolveSocialSupportSpecialistFlag,
} from "./socialSupportFeatureFlag.js";
import {
  createSocialSupportSpecialistRequest,
  proposeSocialSupportSpecialistResponse,
  validateSocialSupportSpecialistProposal,
} from "./socialSupportSpecialistAdapter.js";
import { resolveSocialSupportLegacyOutcome } from "./socialSupportLegacyAdapter.js";

export type SocialSupportSpecialistRouteAugmentationInput = {
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

export type SocialSupportSpecialistRouteAugmentation = {
  flag: SocialSupportSpecialistFlagResolution;
  selectedSpecialistId: typeof SOCIAL_SUPPORT_SPECIALIST_ID;
  selectedFlowId: typeof SOCIAL_SUPPORT_FLOW_ID;
  selectedFlowVersion: typeof SOCIAL_SUPPORT_FLOW_VERSION;
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
  humanContact?: string;
  caregiverAuthority?: string;
  promptBlock: string;
  dynamicVariables: Record<string, string>;
  sessionData: Record<string, string>;
};

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function stableRequestId(input: SocialSupportSpecialistRouteAugmentationInput): string {
  return [
    "request.social_support.specialist",
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
  outcome: SocialSupportSpecialistRouteAugmentation["outcome"];
  reasonCode: string;
  route?: string;
  actionType?: string;
  capability?: string;
  requestCategory?: string;
  presentationId?: string;
  requiresConfirmation?: string;
  externalAction?: string;
  humanContact?: string;
  caregiverAuthority?: string;
}): string {
  return [
    "SOCIAL SUPPORT SPECIALIST MIGRATION BLOCK:",
    `selected_specialist_id=${SOCIAL_SUPPORT_SPECIALIST_ID}`,
    `selected_specialist_version=${SOCIAL_SUPPORT_SPECIALIST_VERSION}`,
    `selected_flow_id=${SOCIAL_SUPPORT_FLOW_ID}`,
    `selected_flow_version=${SOCIAL_SUPPORT_FLOW_VERSION}`,
    `scene_id=${SOCIAL_SUPPORT_SCENE_ID}`,
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
    input.humanContact ? `human_contact=${input.humanContact}` : "",
    input.caregiverAuthority ? `caregiver_authority=${input.caregiverAuthority}` : "",
    "Use only the existing open_app_action bridge if community/social navigation is later authorized.",
    "Do not contact, call, text, email, notify, invite, or share with another person from this block.",
    "Do not grant, remove, or change caregiver permissions. Do not use Trusted Help metadata as authorization.",
    "Do not create caregiver/operator escalation, operator tasks, memory writes, schedules, proactive outreach, bookings, payments, or external actions.",
    "Ordinary loneliness, low mood, anxiety, stress, and someone-to-talk-to requests remain Mental Wellbeing/legacy companion support.",
    "Trusted Help, transport, shopping, provider/vendor, booking, and practical human-help requests remain Concierge/legacy.",
    "Safety-sensitive language must stay on the existing Safety route; never replace emergency guidance with social support content.",
    "For fallback outcomes, preserve the legacy companion/social route behavior.",
  ].filter(Boolean).join("\n");
}

export function buildSocialSupportSpecialistRouteAugmentation(
  input: SocialSupportSpecialistRouteAugmentationInput,
): SocialSupportSpecialistRouteAugmentation | null {
  if (input.domain !== "companion") return null;

  const legacyOutcome = resolveSocialSupportLegacyOutcome(input.utterance);
  if (legacyOutcome.kind === "fallback_to_legacy") {
    return null;
  }

  const flag = resolveSocialSupportSpecialistFlag({
    env: input.env ?? process.env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "specialist_preview") return null;

  const contract = resolveSocialSupportRuntimeContract();
  const requestId = stableRequestId(input);
  if (!contract) {
    const promptBlock = buildPromptBlock({
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "social_support_contract_unavailable",
    });
    return {
      flag,
      selectedSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
      selectedFlowId: SOCIAL_SUPPORT_FLOW_ID,
      selectedFlowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "social_support_contract_unavailable",
      toolProposalDecision: "proposal_rejected",
      promptBlock,
      dynamicVariables: {
        social_support_specialist_selected: "false",
        social_support_specialist_validation: "rejected",
        social_support_specialist_reason_code: "social_support_contract_unavailable",
      },
      sessionData: {
        selected_specialist_id: SOCIAL_SUPPORT_SPECIALIST_ID,
        selected_flow_id: SOCIAL_SUPPORT_FLOW_ID,
        validation: "rejected",
        reason_code: "social_support_contract_unavailable",
        tool_proposal_decision: "proposal_rejected",
      },
    };
  }

  const request = createSocialSupportSpecialistRequest({
    requestId,
    correlationId: `correlation.social_support.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    userId: input.userId,
    sessionId: input.sessionId,
    flowInstanceId: `flow_instance.social_support.${safeIdPart(input.sessionId)}.${input.turnCount}`,
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
  const proposal = proposeSocialSupportSpecialistResponse({ request });
  const validation = validateSocialSupportSpecialistProposal(request, proposal);
  const accepted = validation.ok;
  const tool = accepted ? proposal.proposedToolCalls[0] : undefined;
  const completion = accepted ? proposal.completionResult ?? {} : {};
  const outcome = accepted && proposal.status === "proposed_action"
    ? "tool_proposed"
    : "fallback_to_legacy";
  const reasonCode = accepted
    ? proposal.auditMetadata.decisionCodes.at(-1) ?? "social_support.specialist_accepted"
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
  const humanContact = tool
    ? boolString(tool.arguments.human_contact)
    : undefined;
  const caregiverAuthority = tool
    ? boolString(tool.arguments.caregiver_authority)
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
    humanContact,
    caregiverAuthority,
  });

  return {
    flag,
    selectedSpecialistId: SOCIAL_SUPPORT_SPECIALIST_ID,
    selectedFlowId: SOCIAL_SUPPORT_FLOW_ID,
    selectedFlowVersion: SOCIAL_SUPPORT_FLOW_VERSION,
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
    ...(humanContact ? { humanContact } : {}),
    ...(caregiverAuthority ? { caregiverAuthority } : {}),
    promptBlock,
    dynamicVariables: {
      social_support_specialist_selected: accepted ? "true" : "false",
      social_support_specialist_id: SOCIAL_SUPPORT_SPECIALIST_ID,
      social_support_flow_id: SOCIAL_SUPPORT_FLOW_ID,
      social_support_flow_version: SOCIAL_SUPPORT_FLOW_VERSION,
      social_support_specialist_validation: accepted ? "accepted" : "rejected",
      social_support_specialist_outcome: outcome,
      social_support_specialist_reason_code: reasonCode,
      social_support_tool_proposal_decision: toolDecision,
      ...(route ? { social_support_action_route: route } : {}),
      ...(actionType ? { social_support_action_type: actionType } : {}),
      ...(capability ? { social_support_capability: capability } : {}),
      ...(requestCategory ? { social_support_request_category: requestCategory } : {}),
      ...(presentationId ? { social_support_presentation_id: presentationId } : {}),
      ...(requiresConfirmation ? { social_support_requires_confirmation: requiresConfirmation } : {}),
      ...(externalAction ? { social_support_external_action: externalAction } : {}),
      ...(humanContact ? { social_support_human_contact: humanContact } : {}),
      ...(caregiverAuthority ? { social_support_caregiver_authority: caregiverAuthority } : {}),
    },
    sessionData: {
      selected_specialist_id: SOCIAL_SUPPORT_SPECIALIST_ID,
      selected_flow_id: SOCIAL_SUPPORT_FLOW_ID,
      selected_flow_version: SOCIAL_SUPPORT_FLOW_VERSION,
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
      ...(humanContact ? { human_contact: humanContact } : {}),
      ...(caregiverAuthority ? { caregiver_authority: caregiverAuthority } : {}),
    },
  };
}
