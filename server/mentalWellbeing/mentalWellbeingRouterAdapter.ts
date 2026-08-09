import {
  MENTAL_WELLBEING_FLOW_ID,
  MENTAL_WELLBEING_FLOW_VERSION,
  MENTAL_WELLBEING_SCENE_ID,
  MENTAL_WELLBEING_SPECIALIST_ID,
  MENTAL_WELLBEING_SPECIALIST_VERSION,
  resolveMentalWellbeingRuntimeContract,
} from "./mentalWellbeingFlow.js";
import {
  type MentalWellbeingSpecialistFlagResolution,
  resolveMentalWellbeingSpecialistFlag,
} from "./mentalWellbeingFeatureFlag.js";
import {
  createMentalWellbeingSpecialistRequest,
  proposeMentalWellbeingSpecialistResponse,
  validateMentalWellbeingSpecialistProposal,
} from "./mentalWellbeingSpecialistAdapter.js";
import { resolveMentalWellbeingLegacyOutcome } from "./mentalWellbeingLegacyAdapter.js";

export type MentalWellbeingSpecialistRouteAugmentationInput = {
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

export type MentalWellbeingSpecialistRouteAugmentation = {
  flag: MentalWellbeingSpecialistFlagResolution;
  selectedSpecialistId: typeof MENTAL_WELLBEING_SPECIALIST_ID;
  selectedFlowId: typeof MENTAL_WELLBEING_FLOW_ID;
  selectedFlowVersion: typeof MENTAL_WELLBEING_FLOW_VERSION;
  validation: "accepted" | "rejected";
  outcome: "support_ready" | "fallback_to_legacy";
  reasonCode: string;
  toolProposalValidation: "not_required" | "rejected";
  presentationId?: string;
  presentationFamilyId?: string;
  supportIntent?: string;
  promptBlock: string;
  dynamicVariables: Record<string, string>;
  sessionData: Record<string, string>;
};

function safeIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80);
}

function stableRequestId(input: MentalWellbeingSpecialistRouteAugmentationInput): string {
  return [
    "request.mental_wellbeing.specialist",
    safeIdPart(input.sessionId),
    String(input.turnCount),
  ].join(".");
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function buildPromptBlock(input: {
  validation: "accepted" | "rejected";
  outcome: MentalWellbeingSpecialistRouteAugmentation["outcome"];
  reasonCode: string;
  presentationId?: string;
  presentationFamilyId?: string;
  supportIntent?: string;
}): string {
  return [
    "MENTAL WELLBEING SPECIALIST MIGRATION BLOCK:",
    `selected_specialist_id=${MENTAL_WELLBEING_SPECIALIST_ID}`,
    `selected_specialist_version=${MENTAL_WELLBEING_SPECIALIST_VERSION}`,
    `selected_flow_id=${MENTAL_WELLBEING_FLOW_ID}`,
    `selected_flow_version=${MENTAL_WELLBEING_FLOW_VERSION}`,
    `scene_id=${MENTAL_WELLBEING_SCENE_ID}`,
    `validation=${input.validation}`,
    `outcome=${input.outcome}`,
    `reason_code=${input.reasonCode}`,
    input.presentationId ? `presentation_id=${input.presentationId}` : "",
    input.presentationFamilyId ? `presentation_family_id=${input.presentationFamilyId}` : "",
    input.supportIntent ? `support_intent=${input.supportIntent}` : "",
    "This is ordinary wellbeing support only: do not diagnose, prescribe treatment, or infer a clinical condition.",
    "Safety and crisis concerns must stay on the existing Safety route; do not substitute calming content for safety escalation.",
    "Do not write memory, mutate schedules, change caregiver permissions, start proactive engagement, or execute tools.",
    "For fallback outcomes, preserve the legacy companion/social route behavior.",
  ].filter(Boolean).join("\n");
}

export function buildMentalWellbeingSpecialistRouteAugmentation(
  input: MentalWellbeingSpecialistRouteAugmentationInput,
): MentalWellbeingSpecialistRouteAugmentation | null {
  if (input.domain !== "companion") return null;

  const legacyOutcome = resolveMentalWellbeingLegacyOutcome(input.utterance);
  if (
    legacyOutcome.kind === "fallback" &&
    (
      legacyOutcome.reasonCode === "mental_wellbeing_not_recognized" ||
      legacyOutcome.reasonCode === "mental_wellbeing_safety_preempted"
    )
  ) {
    return null;
  }

  const flag = resolveMentalWellbeingSpecialistFlag({
    env: input.env ?? process.env,
    userRef: input.userId,
    cohortKey: input.userId,
  });
  if (flag.effectiveMode !== "specialist_preview") return null;

  const contract = resolveMentalWellbeingRuntimeContract();
  if (!contract) {
    const promptBlock = buildPromptBlock({
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "mental_wellbeing_contract_unavailable",
    });
    return {
      flag,
      selectedSpecialistId: MENTAL_WELLBEING_SPECIALIST_ID,
      selectedFlowId: MENTAL_WELLBEING_FLOW_ID,
      selectedFlowVersion: MENTAL_WELLBEING_FLOW_VERSION,
      validation: "rejected",
      outcome: "fallback_to_legacy",
      reasonCode: "mental_wellbeing_contract_unavailable",
      toolProposalValidation: "rejected",
      promptBlock,
      dynamicVariables: {
        mental_wellbeing_specialist_selected: "false",
        mental_wellbeing_specialist_validation: "rejected",
        mental_wellbeing_specialist_reason_code: "mental_wellbeing_contract_unavailable",
      },
      sessionData: {
        selected_specialist_id: MENTAL_WELLBEING_SPECIALIST_ID,
        selected_flow_id: MENTAL_WELLBEING_FLOW_ID,
        validation: "rejected",
        reason_code: "mental_wellbeing_contract_unavailable",
      },
    };
  }

  const requestId = stableRequestId(input);
  const request = createMentalWellbeingSpecialistRequest({
    requestId,
    correlationId: `correlation.mental_wellbeing.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    userId: input.userId,
    sessionId: input.sessionId,
    flowInstanceId: `flow_instance.mental_wellbeing.${safeIdPart(input.sessionId)}.${input.turnCount}`,
    currentState: "active",
    inputModality: "voice",
    locale: "en",
    timezone: "UTC",
    requestedAt: input.now.toISOString(),
    utterance: input.utterance,
    confidence: input.confidence,
    currentRoute: input.currentRoute,
  });
  const proposal = proposeMentalWellbeingSpecialistResponse({ request });
  const validation = validateMentalWellbeingSpecialistProposal(request, proposal);
  const accepted = validation.ok;
  const completion = accepted ? proposal.completionResult ?? {} : {};
  const outcome = accepted && completion.outcome === "wellbeing_support_ready"
    ? "support_ready"
    : "fallback_to_legacy";
  const reasonCode = accepted
    ? proposal.auditMetadata.decisionCodes.at(-1) ?? "mental_wellbeing.specialist_accepted"
    : validation.reasonCode;
  const presentationId = stringField(completion.presentationId);
  const presentationFamilyId = stringField(completion.presentationFamilyId);
  const supportIntent = stringField(completion.supportIntent);
  const promptBlock = buildPromptBlock({
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    presentationId,
    presentationFamilyId,
    supportIntent,
  });

  return {
    flag,
    selectedSpecialistId: MENTAL_WELLBEING_SPECIALIST_ID,
    selectedFlowId: MENTAL_WELLBEING_FLOW_ID,
    selectedFlowVersion: MENTAL_WELLBEING_FLOW_VERSION,
    validation: accepted ? "accepted" : "rejected",
    outcome,
    reasonCode,
    toolProposalValidation: accepted ? "not_required" : "rejected",
    ...(presentationId ? { presentationId } : {}),
    ...(presentationFamilyId ? { presentationFamilyId } : {}),
    ...(supportIntent ? { supportIntent } : {}),
    promptBlock,
    dynamicVariables: {
      mental_wellbeing_specialist_selected: accepted ? "true" : "false",
      mental_wellbeing_specialist_id: MENTAL_WELLBEING_SPECIALIST_ID,
      mental_wellbeing_flow_id: MENTAL_WELLBEING_FLOW_ID,
      mental_wellbeing_flow_version: MENTAL_WELLBEING_FLOW_VERSION,
      mental_wellbeing_specialist_validation: accepted ? "accepted" : "rejected",
      mental_wellbeing_specialist_outcome: outcome,
      mental_wellbeing_specialist_reason_code: reasonCode,
      mental_wellbeing_tool_proposal_validation: accepted ? "not_required" : "rejected",
      ...(presentationId ? { mental_wellbeing_presentation_id: presentationId } : {}),
      ...(presentationFamilyId ? { mental_wellbeing_presentation_family_id: presentationFamilyId } : {}),
      ...(supportIntent ? { mental_wellbeing_support_intent: supportIntent } : {}),
    },
    sessionData: {
      selected_specialist_id: MENTAL_WELLBEING_SPECIALIST_ID,
      selected_flow_id: MENTAL_WELLBEING_FLOW_ID,
      selected_flow_version: MENTAL_WELLBEING_FLOW_VERSION,
      validation: accepted ? "accepted" : "rejected",
      outcome,
      reason_code: reasonCode,
      tool_proposal_validation: accepted ? "not_required" : "rejected",
      ...(presentationId ? { presentation_id: presentationId } : {}),
      ...(presentationFamilyId ? { presentation_family_id: presentationFamilyId } : {}),
      ...(supportIntent ? { support_intent: supportIntent } : {}),
    },
  };
}
