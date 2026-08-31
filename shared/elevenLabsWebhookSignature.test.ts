import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyElevenLabsWebhookSignature } from "./elevenLabsWebhookSignature.js";

const secret = "test_webhook_secret";
const timestamp = 1_780_000_000;
const nowMs = timestamp * 1000;
const rawBody = Buffer.from(JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "conv_1" } }));

function signature(body = rawBody, at = timestamp) {
  const digest = createHmac("sha256", secret).update(`${at}.${body.toString("utf8")}`).digest("hex");
  return `t=${at},v0=${digest}`;
}

describe("ElevenLabs webhook signature", () => {
  it("accepts an authentic exact raw body", () => {
    expect(verifyElevenLabsWebhookSignature({ rawBody, signatureHeader: signature(), secret, nowMs })).toBe(true);
  });

  it("rejects modified bodies and malformed signatures", () => {
    expect(verifyElevenLabsWebhookSignature({ rawBody: Buffer.from("{}"), signatureHeader: signature(), secret, nowMs })).toBe(false);
    expect(verifyElevenLabsWebhookSignature({ rawBody, signatureHeader: "bad", secret, nowMs })).toBe(false);
  });

  it("rejects replayed and implausibly future timestamps", () => {
    const stale = timestamp - 1_801;
    expect(verifyElevenLabsWebhookSignature({ rawBody, signatureHeader: signature(rawBody, stale), secret, nowMs })).toBe(false);
    const future = timestamp + 301;
    expect(verifyElevenLabsWebhookSignature({ rawBody, signatureHeader: signature(rawBody, future), secret, nowMs })).toBe(false);
  });
});
