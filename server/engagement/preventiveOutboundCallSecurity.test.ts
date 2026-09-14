import { describe, expect, it } from "vitest";
import {
  normalizeE164Phone,
  normalizePublicWebhookBaseUrl,
  parsePreventiveOutboundCallConfirmationToken,
  preventiveOutboundCallConfirmationBodySchema,
} from "./preventiveOutboundCallSecurity.js";

describe("Task 11 preventive outbound call security helpers", () => {
  it("normalizes verified E.164 phones to a digest and last4", () => {
    const normalized = normalizeE164Phone("+15551234567");
    expect(normalized).toMatchObject({
      ok: true,
      phoneE164: "+15551234567",
      phoneLast4: "4567",
    });
    if (normalized.ok) expect(normalized.phoneDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("rejects unverified-looking or whitespace-padded phone values", () => {
    expect(normalizeE164Phone(" +15551234567")).toMatchObject({ ok: false });
    expect(normalizeE164Phone("5551234567")).toMatchObject({ ok: false });
    expect(normalizeE164Phone("+1555 1234567")).toMatchObject({ ok: false });
  });

  it("rejects accessor payloads before token parsing reads properties", () => {
    let getterCalls = 0;
    const unsafe = {};
    Object.defineProperty(unsafe, "value", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "a".repeat(43);
      },
    });
    expect(parsePreventiveOutboundCallConfirmationToken(unsafe)).toMatchObject({
      ok: false,
      reason: "token_not_inert",
    });
    expect(getterCalls).toBe(0);
  });

  it("requires HTTPS public webhook base URLs", () => {
    expect(normalizePublicWebhookBaseUrl("https://vyva.example.com/")).toEqual({
      ok: true,
      baseUrl: "https://vyva.example.com",
    });
    expect(normalizePublicWebhookBaseUrl("http://vyva.example.com")).toMatchObject({ ok: false });
    expect(normalizePublicWebhookBaseUrl("https://localhost")).toMatchObject({ ok: false });
  });

  it("requires exact provider conversation and Twilio CallSid correlation on confirmation", () => {
    expect(preventiveOutboundCallConfirmationBodySchema.safeParse({
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
      confirmed: true,
    }).success).toBe(true);
    expect(preventiveOutboundCallConfirmationBodySchema.safeParse({
      token: "a".repeat(43),
      providerConversationId: "conv.task11",
      confirmed: true,
    }).success).toBe(false);
    expect(preventiveOutboundCallConfirmationBodySchema.safeParse({
      providerConversationId: "conv.task11",
      twilioCallSid: "SM11111111111111111111111111111111",
      confirmed: true,
    }).success).toBe(false);
    expect(preventiveOutboundCallConfirmationBodySchema.safeParse({
      token: "a".repeat(43),
      providerConversationId: "conv.task11",
      twilioCallSid: "CA11111111111111111111111111111111",
      confirmed: true,
    }).success).toBe(false);
  });
});
