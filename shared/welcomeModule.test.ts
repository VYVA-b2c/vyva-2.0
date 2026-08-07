import { describe, expect, it } from "vitest";
import {
  WELCOME_LANGUAGES,
  WELCOME_MODULE_TEMPLATES,
  isWelcomeProfileActionComplete,
  renderWelcomeCopy,
  type WelcomeProfileActionId,
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

  it("detects completed profile actions across saved profile sources", () => {
    const completeCases: Array<[
      WelcomeProfileActionId,
      Parameters<typeof isWelcomeProfileActionComplete>[1],
    ]> = [
      ["medications", {
        profile: {},
        onboardingState: {},
        channelPreferences: null,
        medications: [{ medication_name: "Metformin" }],
      }],
      ["gp_details", {
        profile: { gp_name: "Dr Garcia" },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["address", {
        profile: { address_line_1: "Calle Mayor 1", postcode: "28013" },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["care_team", {
        profile: { caregiver_name: "Layla", caregiver_contact: "+34 600 000 000" },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["preferences", {
        profile: { preferred_name: "Karim", language_preference: "en" },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["notifications", {
        profile: {},
        onboardingState: {},
        channelPreferences: { preferred_alert_channel: "whatsapp_outbound" },
        medications: [],
      }],
      ["cognitive", {
        profile: { data_sharing_consent: { cognitive: { session_length_mins: 10 } } },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["health_conditions", {
        profile: {},
        onboardingState: {},
        channelPreferences: null,
        medications: [],
        healthConditions: [{ condition: "diabetes" }],
      }],
      ["allergies", {
        profile: { known_allergies: ["penicillin"] },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["providers", {
        profile: {},
        onboardingState: {},
        channelPreferences: null,
        medications: [],
        providers: [{ category: "pharmacy", name: "Farmacia Central" }],
      }],
      ["devices", {
        profile: { data_sharing_consent: { health_devices: { devices: [{ id: "bp_cuff", status: "ready" }] } } },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["diet", {
        profile: { data_sharing_consent: { diet: { dietary_preferences: ["low salt"] } } },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
      ["hobbies", {
        profile: { data_sharing_consent: { hobbies: { hobbies: ["music"] } } },
        onboardingState: {},
        channelPreferences: null,
        medications: [],
      }],
    ];

    for (const [action, snapshot] of completeCases) {
      expect(isWelcomeProfileActionComplete(action, snapshot), action).toBe(true);
    }
  });

  it("does not treat default-only profile values as completed nudges", () => {
    expect(isWelcomeProfileActionComplete("address", {
      profile: { country_code: "ES", timezone: "Europe/Madrid" },
      onboardingState: {},
      channelPreferences: null,
      medications: [],
    })).toBe(false);

    expect(isWelcomeProfileActionComplete("notifications", {
      profile: { channel_notifications: "whatsapp", channel_chats: "in-app", channel_reports: "email" },
      onboardingState: {},
      channelPreferences: null,
      medications: [],
    })).toBe(false);
  });
});
