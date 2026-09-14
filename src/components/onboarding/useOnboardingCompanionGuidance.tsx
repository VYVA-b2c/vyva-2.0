export {
  OnboardingAgentProvider as OnboardingCompanionGuidanceProvider,
  createOnboardingAgentDraftLifecycle,
  useOnboardingAgent as useOnboardingCompanionGuidance,
} from "./useOnboardingAgent";

export type {
  OnboardingAgent as OnboardingCompanionGuidance,
  OnboardingAgentActions as OnboardingCompanionGuidanceActions,
  OnboardingAgentDraftLifecycle as OnboardingCompanionDraftLifecycle,
  OnboardingAgentDraftStatus as OnboardingCompanionDraftStatus,
  OnboardingAgentMode as OnboardingCompanionMode,
  OnboardingAgentSectionConfig as OnboardingCompanionSectionConfig,
  OnboardingAgentState as OnboardingCompanionGuidanceState,
  OnboardingAgentVoiceActionRegistration as OnboardingCompanionVoiceActionRegistration,
  OnboardingAgentVoiceStatus as OnboardingCompanionVoiceStatus,
} from "./useOnboardingAgent";
