import { describe, expect, it } from "vitest";
import { createProfileOnboardingAgentSectionConfig } from "@/components/onboarding/profileOnboardingAgentSections";
import { buildHealthOnboardingVoiceUiState } from "./conditionsVoiceUiState";

const healthSection = createProfileOnboardingAgentSectionConfig({
  sectionId: "health",
  sectionLabel: "Health profile",
  voicePrompt: "Tell VYVA one or more health conditions.",
  expectedFields: ["conditions", "mobility", "living_situation"],
  targetIds: {
    addByVoice: "health-add-by-voice",
    draftReview: "health-speak-confirm",
    reviewSave: "health-review-save",
  },
});

describe("health onboarding voice UI state", () => {
  it("guides the agent to collect a local review draft when Health has no visible review card", () => {
    const uiState = buildHealthOnboardingVoiceUiState({
      sectionConfig: healthSection,
      selectedCount: 0,
      noKnownConditions: false,
      reviewCardVisible: false,
    });

    expect(uiState).toMatchObject({
      pagePath: "/onboarding/profile/health",
      sectionId: "health",
      phase: "collecting",
      visibleTask: "Collect health conditions for a local review draft.",
      missingFields: ["conditions"],
      reviewCardVisible: false,
      allowedActions: ["ask_question", "collect_draft", "show_local_review", "switch_mode"],
      activeTargetId: "health-add-by-voice",
    });
    expect(uiState.forbiddenActions).toEqual(expect.arrayContaining([
      "ask_account_id",
      "navigate_away",
      "save_without_button_press",
      "external_action",
    ]));
  });

  it("guides the agent to help review once a Health draft card is visible", () => {
    const uiState = buildHealthOnboardingVoiceUiState({
      sectionConfig: healthSection,
      selectedCount: 1,
      noKnownConditions: false,
      reviewCardVisible: true,
    });

    expect(uiState).toMatchObject({
      phase: "reviewing",
      visibleTask: "Review the visible health draft card before adding it locally.",
      missingFields: [],
      reviewCardVisible: true,
      allowedActions: ["confirm_locally", "edit_draft", "try_again", "dismiss_draft"],
      suggestedPrompt: "Tell the user to review the visible card and choose Add these, Try again, or Dismiss.",
      activeTargetId: "health-speak-confirm",
      selectedCount: 1,
    });
    expect(uiState.forbiddenActions).toContain("save_without_button_press");
  });
});
