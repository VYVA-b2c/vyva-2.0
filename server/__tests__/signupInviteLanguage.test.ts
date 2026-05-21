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
    expect(signupInviteCopyFor("es").title).toBe("Conoce VYVA, tu companera de salud en casa");
  });

  it("renders a polished signup invite email", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      intro: "Karim invited you to join VYVA.",
      url: "https://v2.vyva.life/invite?lang=en",
    }, null, "https://v2.vyva.life");

    expect(email.subject).toBe("Welcome to VYVA");
    expect(email.html).toContain("Feel supported every day");
    expect(email.html).toContain("More confidence at home");
    expect(email.html).toContain("What you can do with VYVA");
    expect(email.html).toContain("Set up VYVA");
    expect(email.html).toContain("Your VYVA is ready");
    expect(email.html).toContain("Karim invited you to join VYVA.");
    expect(email.html).toContain("Health checks");
    expect(email.html).toContain("Doctor access");
    expect(email.html).toContain("Medication reminders");
    expect(email.html).toContain("Brain Coach");
    expect(email.html).toContain("Concierge");
    expect(email.html).toContain("Companionship");
    expect(email.html).toContain("Engaging chats and friendly check-ins.");
    expect(email.html).toContain("&#10010;");
    expect(email.html).toContain("&#8594;");
    expect(email.html).toContain("&#9829;");
    expect(email.html).not.toContain(">CARE<");
    expect(email.html).not.toContain(">BRAIN<");
    expect(email.text).toContain("Doctor access: A doctor, one click away.");
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
      expect(email.text).toContain(copy.benefits[0].title);
      expect(email.text).toContain(copy.benefits[0].body);
      expect(email.text).toContain(copy.benefits[1].title);
      expect(email.text).toContain(copy.benefits[2].title);
    }
  });

  it("keeps the approved English framing broader than health only", () => {
    const copy = signupInviteCopyFor("en");

    expect(copy.title).toBe("Feel supported every day");
    expect(copy.outcomeBadge).toBe("More confidence at home");
    expect(copy.startHere).toBe("Your VYVA is ready");
    expect(copy.benefits.map((benefit) => benefit.title)).toEqual([
      "Health checks",
      "Doctor access",
      "Medication reminders",
      "Brain Coach",
      "Concierge",
      "Companionship",
    ]);
    expect(copy.benefits[5].body).toBe("Engaging chats and friendly check-ins.");
  });
});
