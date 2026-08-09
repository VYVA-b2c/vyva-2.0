import {
  BRAIN_COACH_FLOW_ID,
  BRAIN_COACH_FLOW_VERSION,
  BRAIN_COACH_SCENE_ID,
  BRAIN_COACH_SPECIALIST_ID,
  BRAIN_COACH_SPECIALIST_VERSION,
  resolveBrainCoachRuntimeContract,
} from "./brainCoachFlow.js";
import {
  createBrainCoachSpecialistRequest,
  proposeBrainCoachSpecialistResponse,
  validateBrainCoachSpecialistProposal,
} from "./brainCoachSpecialistAdapter.js";
import {
  type BrainCoachSpecialistFlagResolution,
  resolveBrainCoachSpecialistFlag,
} from "./brainCoachFeatureFlag.js";

export type BrainCoachSpecialistRouteAugmentationInput = {
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

export type BrainCoachSpecialistRouteAugmentation = {
  flag: BrainCoachSpecialistFlagResolution;
  selectedSpecialistId: typeof BRAIN_COACH_SPECIALIST_ID;
  selectedFlowId: typeof BRAIN_COACH_FLOW_ID;
  selectedFlowVersion: typeof BRAIN_COACH_FLOW_VERSION;
  validation: "accepted" | "rejected";
  outcome: "tool_proposed" | "fallback_to_legacy";
  reasonCode: string;
  toolAuthorizationDecision: "approved" | "rejected" | "not_required";
  actionType?: string;
  route?: string;
  activityType?: string;
  promptBlock: string;
  dynamicVariables: Record<string, string>;
  sessionData: Record<string, string>;
};

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function stableRequestId(input: BrainCoachSpecialistRouteAugmentationInput): string {
  return [
    "request.brain_coach.specialist",
    safeIdPart(input.sessionId),
    String(input.turnCount),
  ].join(".");
}

function buildPromptBlock(input: {
  validation: "accepted" | "rejected";
  outcome: BrainCoachSpecialistRouteAugmentation["outcome"];
  reasonCode: string;
  route?: string;
  actionType?: string;
  activityType?: string;
}): string {
  return [
    "BRAIN COACH SPECIALIST MIGRATION BLOCK:",
    `selected_specialist_id=${BRAIN_COACH_SPECIALIST_ID}`,
    `selected_specialist_version=${BRAIN_COACH_SPECIALIST_VERSION}`,
    `selected_flow_id=${BRAIN_COACH_FLOW_ID}`,
    `selected_flow_version=${BRAIN_COACH_FLOW_VERSION}`,
    `scene_id=${BRAIN_COACH_SCENE_ID}`,
    `validation=${input.validation}`,
    `outcome=${input.outcome}`,
    `reason_code=${input.reasonCode}`,
    input.actionType ? `proposed_action_type=${input.actionType}` : "",
    input.route ? `proposed_route=${input.route}` : "",
    input.activityType ? `activity_type=${input.activityType}` : "",
    "Use only the existing open_app_action bridge if a tool/action is later authorized.",
    "Do not write memory, mutate schedules, change caregiver permissions, execute games, or create another Brain Coach agent.",
    "For fallback outcomes, preserve the legacy Brain Coach response path.",
  ].filter(Boolean).join("\n");
}

export function buildBrainCoachSpecialistRouteAugmentation(
  input: BrainCoachSpecialistRouteAugmentationInput,
): BrainCoachSpecialistRouteAugmentation | null {
  if (input.domain !== "brain_coach") return null;

  const flag = resolveBrainCoachSpecialistFlag({
    env: input.env ?? process.env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "specialist_preview") return null;

  const contract = resolveBrainCoachRuntimeContract();
  const requestId = stableRequestId(input);
  if (!contract) {
    const promptBlock = buildPromptBlock({
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "brain_coach_contract_unavailable",
    });
    return {
      flag,
      selectedSpecialistId: BRAIN_COACH_SPECIALIST_ID,
      selectedFlowId: BRAIN_COACH_FLOW_ID,
      selectedFlowVersion: BRAIN_COACH_FLOW_VERSION,
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "brain_coach_contract_unavailable",
      toolAuthorizationDecision: "rejected",
      promptBlock,
      dynamicVariables: {
        brain_coach_specialist_selected: "false",
        brain_coach_specialist_validation: "rejected",
        brain_coach_specialist_reason_code: "brain_coach_contract_unavailable",
      },
      sessionData: {
        selected_specialist_id: BRAIN_COACH_SPECIALIST_ID,
        selected_flow_id: BRAIN_COACH_FLOW_ID,
        validation: "rejected",
        reason_code: "brain_coach_contract_unavailable",
      },
    };
  }

  const request = createBrainCoachSpecialistRequest({
    requestId,
    correlationId: `correlation.brain_coach.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    userId: input.userId,
    sessionId: input.sessionId,
    flowInstanceId: `flow_instance.brain_coach.${safeIdPart(input.sessionId)}.${input.turnCount}`,
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
  const proposal = proposeBrainCoachSpecialistResponse({ request });
  const validation = validateBrainCoachSpecialistProposal(request, proposal);
  const accepted = validation.ok;
  const tool = accepted ? proposal.proposedToolCalls[0] : undefined;
  const reasonCode = accepted
    ? proposal.auditMetadata.decisionCodes.at(-1) ?? "brain_coach.specialist_accepted"
    : validation.reasonCode;
  const route = typeof tool?.arguments.route === "string" ? tool.arguments.route : undefined;
  const actionType = typeof tool?.arguments.action_type === "string"
    ? tool.arguments.action_type
    : undefined;
  const activityType = typeof tool?.arguments.activity_type === "string"
    ? tool.arguments.activity_type
    : undefined;
  const outcome = accepted && proposal.status === "proposed_action"
    ? "tool_proposed"
    : "fallback_to_legacy";
  const promptBlock = buildPromptBlock({
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    route,
    actionType,
    activityType,
  });
  return {
    flag,
    selectedSpecialistId: BRAIN_COACH_SPECIALIST_ID,
    selectedFlowId: BRAIN_COACH_FLOW_ID,
    selectedFlowVersion: BRAIN_COACH_FLOW_VERSION,
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    toolAuthorizationDecision: accepted && proposal.status === "proposed_action"
      ? "approved"
      : proposal.proposedToolCalls.length
        ? "rejected"
        : "not_required",
    ...(actionType ? { actionType } : {}),
    ...(route ? { route } : {}),
    ...(activityType ? { activityType } : {}),
    promptBlock,
    dynamicVariables: {
      brain_coach_specialist_selected: accepted ? "true" : "false",
      brain_coach_specialist_id: BRAIN_COACH_SPECIALIST_ID,
      brain_coach_flow_id: BRAIN_COACH_FLOW_ID,
      brain_coach_flow_version: BRAIN_COACH_FLOW_VERSION,
      brain_coach_specialist_validation: accepted ? "accepted" : "rejected",
      brain_coach_specialist_outcome: outcome,
      brain_coach_specialist_reason_code: reasonCode,
      brain_coach_tool_authorization_decision: accepted && proposal.status === "proposed_action"
        ? "approved"
        : "not_required",
      ...(route ? { brain_coach_action_route: route } : {}),
      ...(actionType ? { brain_coach_action_type: actionType } : {}),
      ...(activityType ? { brain_coach_activity_type: activityType } : {}),
    },
    sessionData: {
      selected_specialist_id: BRAIN_COACH_SPECIALIST_ID,
      selected_flow_id: BRAIN_COACH_FLOW_ID,
      selected_flow_version: BRAIN_COACH_FLOW_VERSION,
      validation: accepted ? "accepted" : "rejected",
      outcome,
      reason_code: reasonCode,
      tool_authorization_decision: accepted && proposal.status === "proposed_action"
        ? "approved"
        : "not_required",
      ...(route ? { route } : {}),
      ...(actionType ? { action_type: actionType } : {}),
      ...(activityType ? { activity_type: activityType } : {}),
    },
  };
}
