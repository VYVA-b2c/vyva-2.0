import { describe, expect, it } from "vitest";
import {
  getTrustedHelpSetupTabs,
  getTrustedHelpStepDataAttributes,
  getTrustedHelpStepViewModel,
  TRUSTED_HELP_SETUP_TAB_IDS,
} from "./trustedHelpFlowPresentation";

describe("trustedHelpFlowPresentation", () => {
  it("derives setup tabs from the Trusted Help presentation steps", () => {
    const tabs = getTrustedHelpSetupTabs();

    expect(tabs.map((tab) => tab.stepId)).toEqual(TRUSTED_HELP_SETUP_TAB_IDS);
    expect(tabs.map((tab) => tab.label)).toEqual(["Overview", "Service", "Provider", "Controls", "Review"]);
  });

  it("keeps Trusted Help setup inside the concierge screen contract", () => {
    for (const tab of getTrustedHelpSetupTabs()) {
      expect(tab.minTapTargetPx).toBeGreaterThanOrEqual(44);
      expect(tab.bottomNavClearancePx).toBeGreaterThanOrEqual(112);
      expect(tab.chips).toBe("hidden");
      expect(tab.showHeadingDetail).toBe(false);
    }
  });

  it("exposes stable data attributes for renderers and QA", () => {
    expect(getTrustedHelpStepDataAttributes("service")).toMatchObject({
      "data-screen-contract": "concierge",
      "data-presentation-step": "service",
      "data-template": "guidedFlow",
      "data-presentation-family": "presentation.family.choice.single",
      "data-ui-instruction": "show_choice_question",
      "data-primary-surface": "singleStep",
      "data-cards": "visible",
      "data-chips": "hidden",
      "data-voice-policy": "conversation-prompt",
      "data-confirmation-boundary": "none",
      "data-heading-detail": "hidden",
    });
  });

  it("marks provider, controls, and review as external-action confirmation boundaries", () => {
    expect(getTrustedHelpStepViewModel("provider").confirmationBoundary).toBe("finalConfirmationBeforeExternalAction");
    expect(getTrustedHelpStepViewModel("controls").confirmationBoundary).toBe("finalConfirmationBeforeExternalAction");
    expect(getTrustedHelpStepViewModel("review").confirmationBoundary).toBe("finalConfirmationBeforeExternalAction");
  });
});
