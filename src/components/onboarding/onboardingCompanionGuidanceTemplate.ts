import type {
  OnboardingCompanionGuidanceState,
  OnboardingCompanionMode,
} from "./useOnboardingCompanionGuidance";

export type OnboardingCompanionGuidancePatch = Partial<
  Omit<OnboardingCompanionGuidanceState, "mode">
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
  mode: OnboardingCompanionMode,
  guidance: OnboardingCompanionGuidancePatch,
): OnboardingCompanionGuidancePatch | null {
  if (mode !== "voice") return null;
  return guidance;
}
