import type { OnboardingAgentSectionConfig } from "@/components/onboarding/useOnboardingAgent";
import type { ProfileOnboardingAgentSectionId } from "@/components/onboarding/profileOnboardingAgentSections";
import type { OnboardingVoiceUiState } from "@/lib/onboardingVoiceUiState";

export interface HealthVoiceUiStateInput {
  sectionConfig: OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId>;
  selectedCount: number;
  noKnownConditions: boolean;
  reviewCardVisible: boolean;
}

export function buildHealthOnboardingVoiceUiState({
  sectionConfig,
  selectedCount,
  noKnownConditions,
  reviewCardVisible,
}: HealthVoiceUiStateInput): OnboardingVoiceUiState {
  return {
    pagePath: "/onboarding/profile/health",
    sectionId: "health",
    sectionLabel: sectionConfig.sectionLabel,
    phase: reviewCardVisible ? "reviewing" : "collecting",
    visibleTask: reviewCardVisible
      ? "Review the visible health draft card before adding it locally."
      : "Collect health conditions for a local review draft.",
    missingFields: selectedCount || noKnownConditions ? [] : ["conditions"],
    reviewCardVisible,
    allowedActions: reviewCardVisible
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
    suggestedPrompt: reviewCardVisible
      ? "Tell the user to review the visible card and choose Add these, Try again, or Dismiss."
      : "Ask which health conditions the user lives with, then create a local review card.",
    activeTargetId: reviewCardVisible
      ? sectionConfig.targetIds?.draftReview
      : sectionConfig.targetIds?.addByVoice,
    selectedCount,
    visibleDataSummary: selectedCount
      ? `${selectedCount} health condition${selectedCount === 1 ? "" : "s"} already selected in the app.`
      : "No health conditions are selected yet.",
  };
}
