import { describe, expect, it } from "vitest";
import {
  PROFILE_ONBOARDING_AGENT_SECTION_IDS,
  createProfileOnboardingAgentSectionConfig,
} from "@/components/onboarding/profileOnboardingAgentSections";
import {
  buildOnboardingSectionVoiceUiState,
  onboardingVoiceUiStateContextUpdate,
} from "./onboardingVoiceUiState";

describe("onboarding voice UI state", () => {
  it.each(PROFILE_ONBOARDING_AGENT_SECTION_IDS)(
    "builds collecting and reviewing UI state for %s",
    (sectionId) => {
      const sectionConfig = createProfileOnboardingAgentSectionConfig({
        sectionId,
        sectionLabel: `${sectionId} label`,
        voicePrompt: `Tell VYVA about ${sectionId}.`,
        expectedFields: [`${sectionId}_field`],
        targetIds: {
          addByVoice: `${sectionId}-voice`,
          draftReview: `${sectionId}-draft`,
          reviewSave: `${sectionId}-save`,
        },
      });

      const collecting = buildOnboardingSectionVoiceUiState({ sectionConfig });
      expect(collecting).toMatchObject({
        pagePath: `/onboarding/profile/${sectionId}`,
        sectionId,
        phase: "collecting",
        reviewCardVisible: false,
        missingFields: [`${sectionId}_field`],
        activeTargetId: `${sectionId}-voice`,
      });
      expect(collecting.allowedActions).toEqual(
        ["ask_question", "collect_draft", "show_local_review", "switch_mode"],
      );
      expect(collecting.forbiddenActions).toEqual(expect.arrayContaining([
        "ask_account_id",
        "navigate_away",
        "save_without_button_press",
      ]));

      const reviewing = buildOnboardingSectionVoiceUiState({
        sectionConfig,
        phase: "reviewing",
        reviewCardVisible: true,
        selectedCount: 2,
      });
      expect(reviewing).toMatchObject({
        sectionId,
        phase: "reviewing",
        reviewCardVisible: true,
        missingFields: [],
        selectedCount: 2,
        activeTargetId: `${sectionId}-draft`,
      });
      expect(reviewing.allowedActions).toEqual(
        ["confirm_locally", "edit_draft", "try_again", "dismiss_draft"],
      );
    },
  );

  it("formats compact context updates for live voice sessions", () => {
    const sectionConfig = createProfileOnboardingAgentSectionConfig({
      sectionId: "address",
      sectionLabel: "Home address",
      voicePrompt: "Tell VYVA your home address.",
      expectedFields: ["address_line_1", "city"],
    });

    const update = onboardingVoiceUiStateContextUpdate(
      buildOnboardingSectionVoiceUiState({
        sectionConfig,
        phase: "reviewing",
        reviewCardVisible: true,
      }),
    );

    expect(update).toContain("VYVA onboarding visible UI state changed.");
    expect(update).toContain("Section: Home address (address).");
    expect(update).toContain("Phase: reviewing.");
    expect(update).toContain("Review card visible: yes.");
    expect(update).toContain("Forbidden actions: ask_account_id");
  });
});
