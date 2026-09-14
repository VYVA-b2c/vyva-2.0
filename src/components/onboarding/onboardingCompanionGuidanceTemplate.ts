import type {
  OnboardingAgentMode,
  OnboardingAgentState,
} from "./useOnboardingAgent";

export type OnboardingCompanionGuidancePatch = Partial<
  Omit<OnboardingAgentState, "mode">
>;

export const ONBOARDING_COMPANION_TARGETS = {
  conditions: {
    addByVoice: "health-add-by-voice",
    speakConfirm: "health-speak-confirm",
    search: "health-search",
    noKnown: "health-no-known",
    reviewSave: "health-review-save",
  },
  medications: {
    addByVoice: "medications-add-by-voice",
    noCurrent: "medications-no-current",
    firstMedication: "medications-first-medication",
    routine: "medications-routine",
    addAnother: "medications-add-another",
    reviewSave: "medications-review-save",
  },
  allergies: {
    addByVoice: "allergies-add-by-voice",
    voiceDraft: "allergies-voice-draft",
    noKnown: "allergies-no-known",
    reviewSave: "allergies-review-save",
  },
} as const;

export function companionGuidanceForMode(
  mode: OnboardingAgentMode,
  guidance: OnboardingCompanionGuidancePatch,
): OnboardingCompanionGuidancePatch | null {
  if (mode !== "voice") return null;
  return guidance;
}

export type OnboardingAgentGuidancePatch = OnboardingCompanionGuidancePatch;

export const ONBOARDING_AGENT_TARGETS = ONBOARDING_COMPANION_TARGETS;

export function onboardingAgentGuidanceForMode(
  mode: OnboardingAgentMode,
  guidance: OnboardingAgentGuidancePatch,
): OnboardingAgentGuidancePatch | null {
  return companionGuidanceForMode(mode, guidance);
}
