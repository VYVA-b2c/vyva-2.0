import { describe, expect, it } from "vitest";
import { languageOptions } from "../../src/pages/admin/lifecycle/shared";
import { buildSignupInviteEmail } from "../lib/signupInviteEmail.js";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor, SIGNUP_INVITE_LANGUAGE_CODES } from "../lib/signupInviteLanguage.js";

describe("signup invite language", () => {
  it("defaults unsupported languages to English", () => {
    expect(normalizeSignupInviteLanguage(undefined)).toBe("en");
    expect(normalizeSignupInviteLanguage("cy")).toBe("en");
    expect(signupInviteCopyFor("unknown").subject).toBe("Welcome to VYVA");
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
    expect(signupInviteCopyFor("fr").subject).toBe("Bienvenue sur VYVA");
    expect(signupInviteCopyFor("pt").cta).toBe("Comecar com VYVA");
  });

  it("renders a polished signup invite email", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      intro: "Karim invited you to join VYVA.",
      url: "https://v2.vyva.life/invite?lang=en",
    }, null, "https://v2.vyva.life");

    expect(email.subject).toBe("Welcome to VYVA");
    expect(email.html).toContain("A helping hand, always close");
    expect(email.html).toContain("How VYVA helps");
    expect(email.html).toContain("Start VYVA");
    expect(email.html).toContain("Karim invited you to join VYVA.");
    expect(email.text).toContain("Trusted family support, only when you choose");
  });

  it("keeps the default email short when there is no admin message", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      url: "https://v2.vyva.life/invite?lang=en",
    }, null, "https://v2.vyva.life");

    expect(email.html).not.toContain("VYVA is ready for you.");
    expect(email.text).not.toContain("VYVA is ready for you.");
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
