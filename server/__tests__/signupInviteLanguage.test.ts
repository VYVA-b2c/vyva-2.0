import { describe, expect, it } from "vitest";
import { languageOptions } from "../../src/pages/admin/lifecycle/shared";
import { buildSignupInviteEmail } from "../lib/signupInviteEmail.js";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor, SIGNUP_INVITE_LANGUAGE_CODES } from "../lib/signupInviteLanguage.js";
import { mergeSignupInviteRecipients, normalizeSignupInviteRecipientName } from "../lib/signupInviteRecipients.js";

describe("signup invite language", () => {
  it("defaults unsupported languages to English", () => {
    expect(normalizeSignupInviteLanguage(undefined)).toBe("en");
    expect(normalizeSignupInviteLanguage("xx")).toBe("en");
    expect(signupInviteCopyFor("unknown").subject).toBe("Welcome to VYVA");
  });

  it("builds invite links with the selected language", () => {
    expect(buildSignupInviteUrl("https://v2.vyva.life", "fr")).toBe("https://v2.vyva.life/invite?lang=fr");
    expect(buildSignupInviteUrl("https://v2.vyva.life/", "es")).toBe("https://v2.vyva.life/invite?lang=es");
  });

  it("builds invite links with safe recipient prefill details", () => {
    const setupUrl = buildSignupInviteUrl("https://v2.vyva.life", "en", {
      name: "Maria Gomez",
      email: "maria@example.com",
      phone: "+34 612 345 678",
      whatsapp: "+34 612 345 678",
      inviteId: "invite-123456",
    });
    const parsed = new URL(setupUrl);

    expect(parsed.origin).toBe("https://v2.vyva.life");
    expect(parsed.pathname).toBe("/invite");
    expect(parsed.searchParams.get("lang")).toBe("en");
    expect(parsed.searchParams.get("first_name")).toBe("Maria");
    expect(parsed.searchParams.get("last_name")).toBe("Gomez");
    expect(parsed.searchParams.get("email")).toBe("maria@example.com");
    expect(parsed.searchParams.get("phone")).toBe("+34 612 345 678");
    expect(parsed.searchParams.get("whatsapp")).toBe("+34 612 345 678");
    expect(parsed.searchParams.get("invite_id")).toBe("invite-123456");
  });

  it("can mark invite links for caregiver or family setup", () => {
    const setupUrl = buildSignupInviteUrl("https://v2.vyva.life", "en", {
      email: "care@example.com",
      inviteId: "invite-caregiver",
      setupFor: "someone_else",
    });
    const parsed = new URL(setupUrl);

    expect(parsed.searchParams.get("email")).toBe("care@example.com");
    expect(parsed.searchParams.get("invite_id")).toBe("invite-caregiver");
    expect(parsed.searchParams.get("setup_for")).toBe("someone_else");
  });

  it("does not use email or phone contacts as invite names", () => {
    const emailOnlyUrl = buildSignupInviteUrl("https://v2.vyva.life", "en", {
      name: "gm@4cksa.com",
      firstName: "gm@4cksa.com",
      email: "gm@4cksa.com",
    });
    const phoneOnlyUrl = buildSignupInviteUrl("https://v2.vyva.life", "en", {
      name: "+34 612 345 678",
      phone: "+34 612 345 678",
    });
    const emailOnly = new URL(emailOnlyUrl);
    const phoneOnly = new URL(phoneOnlyUrl);

    expect(emailOnly.searchParams.get("first_name")).toBeNull();
    expect(emailOnly.searchParams.get("last_name")).toBeNull();
    expect(emailOnly.searchParams.get("email")).toBe("gm@4cksa.com");
    expect(phoneOnly.searchParams.get("first_name")).toBeNull();
    expect(phoneOnly.searchParams.get("last_name")).toBeNull();
    expect(phoneOnly.searchParams.get("phone")).toBe("+34 612 345 678");
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

  it("drops contact-looking recipient names while preserving the recipient", () => {
    const emailRecipients = mergeSignupInviteRecipients(
      [],
      [{ name: "gm@4cksa.com", recipient: "gm@4cksa.com" }],
      (recipient) => recipient.trim().toLowerCase() || null,
    );
    const whatsappRecipients = mergeSignupInviteRecipients(
      [],
      [{ name: "+34 612 345 678", recipient: "+34 612 345 678" }],
      (recipient) => recipient.trim().replace(/[^\d+]/g, "") || null,
    );

    expect(emailRecipients).toEqual([{ recipient: "gm@4cksa.com" }]);
    expect(whatsappRecipients).toEqual([{ recipient: "+34612345678" }]);
    expect(normalizeSignupInviteRecipientName("gm@4cksa.com")).toBeUndefined();
    expect(normalizeSignupInviteRecipientName("+34 612 345 678")).toBeUndefined();
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
    expect(signupInviteCopyFor("pt").cta).toBe("Configurar VYVA");
    expect(signupInviteCopyFor("es").title).toBe("Sientete acompanado cada dia");
    expect(signupInviteCopyFor("de").startHere).toBe("PER SPRACHE, OHNE APP-WISSEN");
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
    expect(email.html).toContain("text-align:center");
    expect(email.text).toContain("Privacy Policy: https://vyva.life/privacypolicy");
  });

  it("uses setup link prefill details as a fallback recipient greeting", () => {
    const email = buildSignupInviteEmail({
      language: "en",
      url: "https://v2.vyva.life/invite?lang=en&first_name=Maria&last_name=Gomez",
    }, null, "https://v2.vyva.life");

    expect(email.html).toContain("Dear Maria Gomez,");
    expect(email.text).toContain("Dear Maria Gomez,");
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
      expect(email.html).toContain(copy.startHere);
      if (copy.outcomeBadge) expect(email.html).toContain(copy.outcomeBadge);
      expect(email.html).toContain(`vyva-logo-${language}`);
      expect(copy.benefits).toHaveLength(6);
      expect(email.text).toContain(copy.benefits[0].title);
      expect(email.text).toContain(copy.benefits[0].body);
      expect(email.text).toContain(copy.benefits[1].title);
      expect(email.text).toContain(copy.benefits[2].title);
      expect(email.text).toContain(copy.benefits[5].title);
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
