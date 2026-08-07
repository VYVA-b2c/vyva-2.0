import { describe, expect, it } from "vitest";
import {
  WELCOME_LANGUAGES,
  WELCOME_MODULE_TEMPLATES,
  isWelcomeProfileActionComplete,
  renderWelcomeCopy,
} from "./welcomeModule";

describe("Welcome hero rules", () => {
  it("renders the first-session evening welcome with the user's name", () => {
    const template = WELCOME_MODULE_TEMPLATES.find((item) => item.id === "elder-first-evening");

    expect(template).toBeTruthy();
    expect(renderWelcomeCopy(template!, "fr", "Karim")).toMatchObject({
      headline: "Bonsoir, Karim",
      subtitle: "Comment vous sentez-vous ?",
    });
  });

  it("ships built-in Welcome copy for every supported language", () => {
    for (const template of WELCOME_MODULE_TEMPLATES) {
      for (const language of WELCOME_LANGUAGES) {
        const rendered = renderWelcomeCopy(template, language, "Karim");

        expect(rendered, `${template.id} missing ${language}`).toBeTruthy();
        expect(rendered?.headline.trim().length, `${template.id} missing ${language} headline`).toBeGreaterThan(0);
        expect(rendered?.subtitle.trim().length, `${template.id} missing ${language} subtitle`).toBeGreaterThan(0);
      }
    }
  });

  it("does not ship the removed filler caregiver phrases", () => {
    const englishCopy = WELCOME_MODULE_TEMPLATES
      .filter((template) => template.audience === "caregiver")
      .map((template) => `${template.copy.en?.headline ?? ""} ${template.copy.en?.subtitle ?? ""}`)
      .join(" ");

    expect(englishCopy).not.toContain("Let's keep care connected");
    expect(englishCopy).not.toContain("Let's make support easier today");
    expect(englishCopy).not.toContain("better context");
  });

  it("detects incomplete profile actions for daily nudges", () => {
    expect(isWelcomeProfileActionComplete("emergency_contact", {
      profile: {},
      onboardingState: {},
      channelPreferences: null,
      medications: [],
    })).toBe(false);

    expect(isWelcomeProfileActionComplete("emergency_contact", {
      profile: { emergency_contact: { emergency_name: "Layla", emergency_phone: "+34 600 000 000" } },
      onboardingState: {},
      channelPreferences: null,
      medications: [],
    })).toBe(true);
  });
});
