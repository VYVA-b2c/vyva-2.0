import { Webhook } from "standardwebhooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyResendInboundWebhook } from "./resendInboundEmailAdapter";

const originalEnv = { ...process.env };

describe("Resend inbound email verification", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.CONCIERGE_EMAIL_INBOUND_WEBHOOK_SECRET = `whsec_${Buffer.from("test-webhook-secret").toString("base64")}`;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("accepts the exact signed webhook body", () => {
    const payload = JSON.stringify({
      type: "email.received",
      created_at: "2026-07-18T10:00:00.000Z",
      data: { email_id: "email-1" },
    });
    const webhookId = "msg_test_1";
    const timestamp = new Date();
    const webhook = new Webhook(process.env.CONCIERGE_EMAIL_INBOUND_WEBHOOK_SECRET!);
    const signature = webhook.sign(webhookId, timestamp, payload);

    expect(verifyResendInboundWebhook({
      rawBody: payload,
      webhookId,
      webhookTimestamp: String(Math.floor(timestamp.getTime() / 1000)),
      webhookSignature: signature,
    })).toEqual(JSON.parse(payload));
  });

  it("rejects a changed body", () => {
    const webhookId = "msg_test_2";
    const timestamp = new Date();
    const original = JSON.stringify({ type: "email.received", data: { email_id: "email-1" } });
    const webhook = new Webhook(process.env.CONCIERGE_EMAIL_INBOUND_WEBHOOK_SECRET!);

    expect(() => verifyResendInboundWebhook({
      rawBody: JSON.stringify({ type: "email.received", data: { email_id: "email-2" } }),
      webhookId,
      webhookTimestamp: String(Math.floor(timestamp.getTime() / 1000)),
      webhookSignature: webhook.sign(webhookId, timestamp, original),
    })).toThrow();
  });
});
