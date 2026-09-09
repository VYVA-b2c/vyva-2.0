import { describe, expect, it } from "vitest";
import {
  createPrivateCheckinToken,
  decryptPrivateCheckinResponse,
  encryptPrivateCheckinResponse,
  hashPrivateCheckinToken,
  privateCheckinTemplateSid,
  privateCheckinUrl,
  safeSecretMatches,
  validatePrivateCheckinAnswers,
} from "./whatsappPrivateCheckin.js";

describe("WhatsApp private check-in security", () => {
  it("creates opaque tokens and stores only a deterministic hash", () => {
    const token = createPrivateCheckinToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(hashPrivateCheckinToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPrivateCheckinToken(token)).not.toContain(token);
  });

  it("compares integration secrets without accepting absent or partial values", () => {
    expect(safeSecretMatches("correct", "correct")).toBe(true);
    expect(safeSecretMatches("correct", "wrong")).toBe(false);
    expect(safeSecretMatches(undefined, "correct")).toBe(false);
  });

  it("maps every platform language to its submitted template", () => {
    expect(privateCheckinTemplateSid("en")).toBe("HX04321e0de59f9be80a1e21e6d8628f3f");
    expect(privateCheckinTemplateSid("es")).toBe("HX5d27e70c62b15eadc84535dce4e7f452");
    expect(privateCheckinTemplateSid("de")).toBe("HX23ba2d57b32105827f6d083c4a95b453");
    expect(privateCheckinTemplateSid("fr")).toBe("HX1cf7c7cb986309fe348bc2755fd724b2");
  });

  it("maps every pathway step and language to its submitted template", () => {
    expect(privateCheckinTemplateSid("en", "24h_transition_check")).toBe("HXae0df9d93746e65b67d0c6e73e63c56b");
    expect(privateCheckinTemplateSid("es", "24h_transition_check")).toBe("HX5c308a612de560d49835134a3151a3e4");
    expect(privateCheckinTemplateSid("de", "24h_transition_check")).toBe("HX66151cd15683b5007d29815d6db92e36");
    expect(privateCheckinTemplateSid("fr", "24h_transition_check")).toBe("HX1e38bb8bf0bafd196ff83fd29180de19");

    expect(privateCheckinTemplateSid("en", "day_3_wound_mobility")).toBe("HX6d1bdfb77da36e12a66d26b2a996ab8d");
    expect(privateCheckinTemplateSid("es", "day_3_wound_mobility")).toBe("HX08800c4df06b19d2b282d37b28831217");
    expect(privateCheckinTemplateSid("de", "day_3_wound_mobility")).toBe("HX0e1acb3f772ba36644aa207f26fa2233");
    expect(privateCheckinTemplateSid("fr", "day_3_wound_mobility")).toBe("HX744b350bb719e619df01e35dfbb51b3e");

    expect(privateCheckinTemplateSid("en", "day_7_function_review")).toBe("HXc0ab159baf411c2caed1ba2ac50a3757");
    expect(privateCheckinTemplateSid("es", "day_7_function_review")).toBe("HX55d2fc75d43244e49d3b083aafffd5e1");
    expect(privateCheckinTemplateSid("de", "day_7_function_review")).toBe("HX7375fff39e12f3ddfd84cb7c121c6283");
    expect(privateCheckinTemplateSid("fr", "day_7_function_review")).toBe("HXc33da363200f8620bd01a8f8796c75a4");

    expect(privateCheckinTemplateSid("en", "day_30_transition_close")).toBe("HX0338e843d1720b7a3d0bf5aa809e1257");
    expect(privateCheckinTemplateSid("es", "day_30_transition_close")).toBe("HXf6bdff966cc9f9e1fa6bd09b89d5025f");
    expect(privateCheckinTemplateSid("de", "day_30_transition_close")).toBe("HX3f432303cd1c6174ced8025e245dd331");
    expect(privateCheckinTemplateSid("fr", "day_30_transition_close")).toBe("HXab53b9e120e76d9d645593d652c7e0c2");
  });

  it("puts only the opaque ticket in the secure URL", () => {
    const url = new URL(privateCheckinUrl("opaque-ticket"));
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("ticket")).toBe("opaque-ticket");
  });

  it("encrypts health answers before database storage", () => {
    const previous = process.env.HEALTH_DATA_ENCRYPTION_KEY;
    process.env.HEALTH_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const source = { answers: { pain: 4, wound: "no" } };
      const encrypted = encryptPrivateCheckinResponse(source);
      expect(JSON.stringify(encrypted)).not.toContain("pain");
      expect(decryptPrivateCheckinResponse(encrypted)).toEqual(source);
    } finally {
      if (previous === undefined) delete process.env.HEALTH_DATA_ENCRYPTION_KEY;
      else process.env.HEALTH_DATA_ENCRYPTION_KEY = previous;
    }
  });
});

describe("validatePrivateCheckinAnswers", () => {
  const questions = [{
    id: "q1",
    type: "single_choice" as const,
    choices: ["yes", "no", "unsure", "skip"],
    required: true,
  }];

  it("accepts only the configured choice", () => {
    expect(validatePrivateCheckinAnswers(questions, { q1: "yes" })).toBe(true);
  });

  it("rejects missing, unknown, and unconfigured answers", () => {
    expect(validatePrivateCheckinAnswers(questions, {})).toBe(false);
    expect(validatePrivateCheckinAnswers(questions, { q1: "maybe" })).toBe(false);
    expect(validatePrivateCheckinAnswers(questions, { q1: "yes", q2: "no" })).toBe(false);
  });
});
