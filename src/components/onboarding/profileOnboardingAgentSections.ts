import type { OnboardingAgentSectionConfig } from "./useOnboardingAgent";

export type ProfileOnboardingAgentSectionId =
  | "basics"
  | "address"
  | "health"
  | "medications"
  | "allergies"
  | "providers"
  | "emergency"
  | "devices"
  | "diet"
  | "hobbies"
  | "cognitive";

export const PROFILE_ONBOARDING_AGENT_SECTION_IDS: readonly ProfileOnboardingAgentSectionId[] = [
  "basics",
  "address",
  "health",
  "medications",
  "allergies",
  "providers",
  "emergency",
  "devices",
  "diet",
  "hobbies",
  "cognitive",
];

export interface ProfileOnboardingAgentSectionConfigInput {
  sectionId: ProfileOnboardingAgentSectionId;
  sectionLabel: string;
  voicePrompt: string;
  expectedFields: readonly string[];
  examples?: readonly string[];
  draftRowLabels?: Record<string, string>;
  targetIds?: OnboardingAgentSectionConfig["targetIds"];
}

export function createProfileOnboardingAgentSectionConfig({
  sectionId,
  sectionLabel,
  voicePrompt,
  expectedFields,
  examples,
  draftRowLabels,
  targetIds,
}: ProfileOnboardingAgentSectionConfigInput): OnboardingAgentSectionConfig<ProfileOnboardingAgentSectionId> {
  return {
    sectionId,
    sectionLabel,
    voicePrompt,
    expectedFields,
    examples,
    draftRowLabels,
    correctionCommands: ["remove", "try-again", "skip"],
    reviewRequired: true,
    explicitSaveRequired: true,
    targetIds,
  };
}

export function isProfileOnboardingAgentSectionId(
  value: string,
): value is ProfileOnboardingAgentSectionId {
  return PROFILE_ONBOARDING_AGENT_SECTION_IDS.includes(
    value as ProfileOnboardingAgentSectionId,
  );
}
