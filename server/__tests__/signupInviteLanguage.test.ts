import { describe, expect, it } from "vitest";
import { buildSignupInviteUrl, normalizeSignupInviteLanguage, signupInviteCopyFor } from "../lib/signupInviteLanguage.js";

describe("signup invite language", () => {
  it("defaults unsupported languages to English", () => {
    expect(normalizeSignupInviteLanguage(undefined)).toBe("en");
    expect(normalizeSignupInviteLanguage("cy")).toBe("en");
    expect(signupInviteCopyFor("unknown").subject).toBe("Create your VYVA account");
  });

  it("builds invite links with the selected language", () => {
    expect(buildSignupInviteUrl("https://v2.vyva.life", "fr")).toBe("https://v2.vyva.life/invite?lang=fr");
    expect(buildSignupInviteUrl("https://v2.vyva.life/", "es")).toBe("https://v2.vyva.life/invite?lang=es");
  });

  it("returns localized email copy for supported invite languages", () => {
    expect(signupInviteCopyFor("fr").subject).toBe("Creez votre compte VYVA");
    expect(signupInviteCopyFor("pt").cta).toBe("Criar conta");
  });
});
