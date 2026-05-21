import { describe, expect, it } from "vitest";
import { languageOptions } from "../../src/pages/admin/lifecycle/shared";
import { buildSignupInviteEmail } from "../lib/signupInviteEmail.js";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor, SIGNUP_INVITE_LANGUAGE_CODES } from "../lib/signupInviteLanguage.js";
import { mergeSignupInviteRecipients, normalizeSignupInviteRecipientName } from "../lib/signupInviteRecipients.js";

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

  it("normalizes named and legacy signup invite recipients", () => {
    const emailRecipients = mergeSignupInviteRecipients(
      ["legacy@example.com", "named@example.com"],
      [{ name: " Maria   Gomez ", recipient: "NAMED@example.com" }],
      (recipient) => recipient.trim().toLowerCase() || null,
    );
    const whatsappRecipients = mergeSignupInviteRecipients(
      ["+34 612 345 678"],
      [{ name: "Karim", recipient: "+34 612 345 678" }],
      (recipient) => recipient.trim().startsWith("+")
        ? recipient.trim().replace(/[^\d+]/g, "")
        : recipient.trim().replace(/\D/g, "") || null,
    );

    expect(emailRecipients).toEqual([
      { recipient: "named@example.com", name: "Maria Gomez" },
      { recipient: "legacy@example.com" },
    ]);
    expect(whatsappRecipients).toEqual([{ recipient: "+34612345678", name: "Karim" }]);
    expect(normalizeSignupInviteRecipientName("   ")).toBeUndefined();
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
    expect(email.html).toContain("VOICE ACTIVATED, NO DIGITAL SKILLS REQUIRED");
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

  it("renders a safe recipient greeting without changing the setup link", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      recipient_name: "Maria <Care>",
      url: "https://v2.vyva.life/invite?lang=en",
    }, null, "https://v2.vyva.life");

    expect(email.html).toContain("Dear Maria &lt;Care&gt;,");
    expect(email.text).toContain("Dear Maria <Care>,");
    expect(email.html).toContain('href="https://v2.vyva.life/invite?lang=en"');
    expect(email.text).toContain("VOICE ACTIVATED, NO DIGITAL SKILLS REQUIRED: https://v2.vyva.life/invite?lang=en");
    expect(email.html).toContain('href="https://vyva.life"');
    expect(email.html).toContain('href="https://vyva.life/privacypolicy"');
    expect(email.html).toContain('href="https://vyva.life/securityencryption"');
    expect(email.html).toContain("Terms of Service");
    expect(email.html).toContain("2026 MOKA DIGITECK SL");
    expect(email.text).toContain("Privacy Policy: https://vyva.life/privacypolicy");
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
        recipient_name: "Maria",
        intro: `Custom intro for ${language}.`,
        url: `https://v2.vyva.life/invite?lang=${language}`,
      }, null, "https://v2.vyva.life");

      expect(email.subject).toBe(copy.subject);
      expect(email.html).toContain(copy.title);
      expect(email.html).toContain(`${copy.greeting} Maria,`);
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
    expect(copy.greeting).toBe("Dear");
    expect(copy.outcomeBadge).toBe("More confidence at home");
    expect(copy.startHere).toBe("VOICE ACTIVATED, NO DIGITAL SKILLS REQUIRED");
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
