import { describe, expect, it } from "vitest";
import { languageOptions } from "../../src/pages/admin/lifecycle/shared";
import { buildSignupInviteEmail } from "../lib/signupInviteEmail.js";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor, SIGNUP_INVITE_LANGUAGE_CODES } from "../lib/signupInviteLanguage.js";

describe("signup invite language", () => {
  it("defaults unsupported languages to English", () => {
    expect(normalizeSignupInviteLanguage(undefined)).toBe("en");
    expect(normalizeSignupInviteLanguage("cy")).toBe("en");
    expect(signupInviteCopyFor("unknown").subject).toBe("You're invited to set up VYVA");
  });

  it("builds invite links with the selected language", () => {
    expect(buildSignupInviteUrl("https://v2.vyva.life", "fr")).toBe("https://v2.vyva.life/invite?lang=fr");
    expect(buildSignupInviteUrl("https://v2.vyva.life/", "es")).toBe("https://v2.vyva.life/invite?lang=es");
  });

  it("understands admin language dropdown values, labels, and locale variants", () => {
    for (const option of languageOptions) {
      expect(normalizeSignupInviteLanguage(option.value)).toBe(option.value);
      expect(normalizeSignupInviteLanguage(option.label)).toBe(option.value);
    }

    expect(normalizeSignupInviteLanguage("es-ES")).toBe("es");
    expect(normalizeSignupInviteLanguage("PT_pt")).toBe("pt");
    expect(normalizeSignupInviteLanguage("Italian")).toBe("it");
  });

  it("returns localized email copy for supported invite languages", () => {
    expect(signupInviteCopyFor("fr").subject).toBe("Vous etes invite a configurer VYVA");
    expect(signupInviteCopyFor("pt").cta).toBe("Configurar a minha VYVA");
  });

  it("renders a polished signup invite email", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      intro: "Karim invited you to join VYVA.",
      url: "https://v2.vyva.life/invite?lang=en",
    }, null, "https://v2.vyva.life");

    expect(email.subject).toBe("You're invited to set up VYVA");
    expect(email.html).toContain("Your VYVA space is ready");
    expect(email.html).toContain("What you can set up");
    expect(email.html).toContain("Set up my VYVA");
    expect(email.html).toContain("Karim invited you to join VYVA.");
    expect(email.text).toContain("Trusted family or care partners connected around the same profile");
  });

  it("renders the polished invite email for every supported language", () => {
    for (const language of SIGNUP_INVITE_LANGUAGE_CODES) {
      const copy = signupInviteCopyFor(language);
      const email = buildSignupInviteEmail({
        language,
        intro: `Custom intro for ${language}.`,
        url: `https://v2.vyva.life/invite?lang=${language}`,
      }, null, "https://v2.vyva.life");

      expect(email.subject).toBe(copy.subject);
      expect(email.html).toContain(copy.title);
      expect(email.html).toContain(copy.featureTitle);
      expect(email.html).toContain(copy.cta);
      expect(email.html).toContain(`vyva-logo-${language}`);
      expect(email.text).toContain(copy.features[0]);
    }
  });
});
