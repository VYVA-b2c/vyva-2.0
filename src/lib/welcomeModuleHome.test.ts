import { describe, expect, it } from "vitest";
import { adaptWelcomeModuleForHome } from "./welcomeModuleHome";
import {
  WELCOME_LANGUAGES,
  WELCOME_MODULE_TEMPLATES,
  isWelcomeProfileActionComplete,
  renderWelcomeCopy,
} from "../../shared/welcomeModule";

describe("Welcome module helpers", () => {
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

  it("adapts Welcome selections into Home context messages", () => {
    const adapted = adaptWelcomeModuleForHome({
      templateId: "elder-nudge-medications",
      audience: "elder",
      momentType: "daily_profile_nudge",
      profileAction: "medications",
      headline: "Add your medicines",
      subtitle: "VYVA can help remember routines.",
      ctaLabel: "Add medicines",
      actionRoute: "/onboarding/profile/medications",
      priority: 94,
      source: "built_in",
    });

    expect(adapted).toMatchObject({
      id: "welcome:elder-nudge-medications",
      kind: "feature",
      title: "Add your medicines",
      actionLabel: "Add medicines",
      actionRoute: "/onboarding/profile/medications",
      category: "medication",
    });
  });
});
