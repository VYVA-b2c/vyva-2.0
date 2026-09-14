import type { ProfileOnboardingAgentSectionId } from "@/components/onboarding/profileOnboardingAgentSections";
import type { OnboardingAgentSectionConfig } from "@/components/onboarding/useOnboardingAgent";

export type OnboardingVoiceUiPhase =
  | "idle"
  | "collecting"
  | "reviewing"
  | "confirmed-locally"
  | "saving"
  | "blocked";

export type OnboardingVoiceUiAction =
  | "ask_question"
  | "collect_draft"
  | "show_local_review"
  | "confirm_locally"
  | "edit_draft"
  | "try_again"
  | "dismiss_draft"
  | "press_save_button"
  | "switch_mode"
  | "safe_escalation";

export type OnboardingVoiceUiForbiddenAction =
  | "ask_account_id"
  | "ask_profile_id"
  | "ask_user_id"
  | "ask_api_key"
  | "navigate_away"
  | "save_without_button_press"
  | "external_action"
  | "call"
  | "message"
  | "booking";

export interface OnboardingVoiceUiState {
  pagePath: string;
  sectionId: ProfileOnboardingAgentSectionId;
  sectionLabel: string;
  phase: OnboardingVoiceUiPhase;
  visibleTask: string;
  missingFields: string[];
  reviewCardVisible: boolean;
  allowedActions: OnboardingVoiceUiAction[];
  forbiddenActions: OnboardingVoiceUiForbiddenAction[];
  suggestedPrompt: string;
  activeTargetId?: string;
  selectedCount?: number;
  visibleDataSummary?: string;
}

export interface BuildOnboardingSectionVoiceUiStateInput {
  sectionConfig: OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId>;
  phase?: OnboardingVoiceUiPhase;
  pagePath?: string;
  reviewCardVisible?: boolean;
  missingFields?: string[];
  selectedCount?: number;
  visibleTask?: string;
  suggestedPrompt?: string;
  visibleDataSummary?: string;
}

export function onboardingProfileSectionPath(sectionId: ProfileOnboardingAgentSectionId) {
  return `/onboarding/profile/${sectionId}`;
}

export function buildOnboardingSectionVoiceUiState({
  sectionConfig,
  phase,
  pagePath,
  reviewCardVisible,
  missingFields,
  selectedCount,
  visibleTask,
  suggestedPrompt,
  visibleDataSummary,
}: BuildOnboardingSectionVoiceUiStateInput): OnboardingVoiceUiState {
  const isReviewing = reviewCardVisible || phase === "reviewing";
  const resolvedPhase: OnboardingVoiceUiPhase = phase ?? (isReviewing ? "reviewing" : "collecting");
  const resolvedReviewCardVisible = reviewCardVisible ?? resolvedPhase === "reviewing";

  return {
    pagePath: pagePath ?? onboardingProfileSectionPath(sectionConfig.sectionId),
    sectionId: sectionConfig.sectionId,
    sectionLabel: sectionConfig.sectionLabel,
    phase: resolvedPhase,
    visibleTask: visibleTask ?? (
      resolvedReviewCardVisible
        ? `Review the visible ${sectionConfig.sectionLabel} draft card before adding it locally.`
        : `Collect ${sectionConfig.sectionLabel} details for a local review draft.`
    ),
    missingFields: missingFields ?? (resolvedReviewCardVisible ? [] : [...sectionConfig.expectedFields]),
    reviewCardVisible: resolvedReviewCardVisible,
    allowedActions: resolvedReviewCardVisible
      ? ["confirm_locally", "edit_draft", "try_again", "dismiss_draft"]
      : ["ask_question", "collect_draft", "show_local_review", "switch_mode"],
    forbiddenActions: [
      "ask_account_id",
      "ask_profile_id",
      "ask_user_id",
      "ask_api_key",
      "navigate_away",
      "save_without_button_press",
      "external_action",
      "call",
      "message",
      "booking",
    ],
    suggestedPrompt: suggestedPrompt ?? (
      resolvedReviewCardVisible
        ? "Tell the user the review card is visible and they can add, edit, try again, or dismiss it."
        : sectionConfig.voicePrompt
    ),
    activeTargetId: resolvedReviewCardVisible
      ? sectionConfig.targetIds?.draftReview
      : sectionConfig.targetIds?.addByVoice,
    ...(typeof selectedCount === "number" ? { selectedCount } : {}),
    ...(visibleDataSummary ? { visibleDataSummary } : {}),
  };
}

export function normalizeOnboardingVoiceUiState(
  state: OnboardingVoiceUiState,
): OnboardingVoiceUiState {
  return {
    ...state,
    pagePath: state.pagePath.trim() || "/onboarding/profile",
    sectionLabel: state.sectionLabel.trim(),
    visibleTask: state.visibleTask.trim(),
    missingFields: [...new Set(state.missingFields.map((field) => field.trim()).filter(Boolean))],
    allowedActions: [...new Set(state.allowedActions)],
    forbiddenActions: [...new Set(state.forbiddenActions)],
    suggestedPrompt: state.suggestedPrompt.trim(),
    ...(state.activeTargetId?.trim() ? { activeTargetId: state.activeTargetId.trim() } : {}),
    ...(typeof state.selectedCount === "number" ? { selectedCount: Math.max(0, state.selectedCount) } : {}),
    ...(state.visibleDataSummary?.trim() ? { visibleDataSummary: state.visibleDataSummary.trim().slice(0, 700) } : {}),
  };
}

export function serializeOnboardingVoiceUiState(state: OnboardingVoiceUiState) {
  return JSON.stringify(normalizeOnboardingVoiceUiState(state));
}

export function onboardingVoiceUiStateContextUpdate(state: OnboardingVoiceUiState) {
  const normalized = normalizeOnboardingVoiceUiState(state);
  return [
    "VYVA onboarding visible UI state changed.",
    `Section: ${normalized.sectionLabel} (${normalized.sectionId}).`,
    `Phase: ${normalized.phase}.`,
    `Visible task: ${normalized.visibleTask}.`,
    `Review card visible: ${normalized.reviewCardVisible ? "yes" : "no"}.`,
    normalized.missingFields.length ? `Missing fields: ${normalized.missingFields.join(", ")}.` : "Missing fields: none.",
    `Allowed actions: ${normalized.allowedActions.join(", ")}.`,
    `Forbidden actions: ${normalized.forbiddenActions.join(", ")}.`,
    `Suggested prompt: ${normalized.suggestedPrompt}`,
  ].join("\n");
}
