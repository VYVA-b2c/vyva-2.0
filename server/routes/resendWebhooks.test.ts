import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adapterMock = vi.hoisted(() => ({
  parseResendInboundReceivedEvent: vi.fn(),
  resendInboundWebhookConfigured: vi.fn(),
  retrieveResendReceivedEmail: vi.fn(),
  verifyResendInboundWebhook: vi.fn(),
}));
const ingestionMock = vi.hoisted(() => ({
  ingestConciergeInboundReply: vi.fn(),
}));

vi.mock("../services/resendInboundEmailAdapter.js", () => adapterMock);
vi.mock("../services/conciergeInboundReplies.js", () => ingestionMock);

import router from "./resendWebhooks";

function testApp() {
  const app = express();
  app.use("/api/webhooks/resend", express.raw({ type: "application/json" }), router);
  return app;
}

const event = {
  type: "email.received",
  created_at: "2026-07-18T11:00:00.000Z",
  data: { email_id: "email-1", to: [], cc: [], bcc: [], attachments: [], subject: "Reply" },
};

describe("Resend inbound Concierge webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMock.resendInboundWebhookConfigured.mockReturnValue(true);
    adapterMock.verifyResendInboundWebhook.mockReturnValue(event);
    adapterMock.parseResendInboundReceivedEvent.mockReturnValue(event);
    adapterMock.retrieveResendReceivedEmail.mockResolvedValue({
      channel: "email",
      providerEventId: "email-1",
      webhookEventId: "webhook-1",
      senderEmail: "provider@example.com",
      recipientEmails: ["concierge@example.com"],
      subject: "Reply",
      text: "Confirmed",
      html: null,
      receivedAt: "2026-07-18T11:00:00.000Z",
    });
    ingestionMock.ingestConciergeInboundReply.mockResolvedValue({
      status: "matched",
      messageId: "inbound-1",
      pendingId: "pending-1",
      providerTaskStatus: "reply_received",
      reason: null,
    });
  });

  it("processes only a verified inbound provider email", async () => {
    const response = await request(testApp())
      .post("/api/webhooks/resend/events")
      .set("Content-Type", "application/json")
      .set("svix-id", "webhook-1")
      .set("svix-timestamp", "123")
      .set("svix-signature", "v1,test")
      .send(JSON.stringify(event));

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "matched", pendingId: "pending-1" });
    expect(adapterMock.verifyResendInboundWebhook).toHaveBeenCalledWith(expect.objectContaining({
      webhookId: "webhook-1",
      rawBody: JSON.stringify(event),
    }));
    expect(ingestionMock.ingestConciergeInboundReply).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid signature before retrieving the email", async () => {
    adapterMock.verifyResendInboundWebhook.mockImplementation(() => { throw new Error("invalid"); });
    const response = await request(testApp())
      .post("/api/webhooks/resend/events")
      .set("Content-Type", "application/json")
      .set("svix-id", "webhook-1")
      .set("svix-timestamp", "123")
      .set("svix-signature", "bad")
      .send(JSON.stringify(event));
    expect(response.status).toBe(401);
    expect(adapterMock.retrieveResendReceivedEmail).not.toHaveBeenCalled();
    expect(ingestionMock.ingestConciergeInboundReply).not.toHaveBeenCalled();
  });

  it("returns a duplicate result without applying another task update", async () => {
    ingestionMock.ingestConciergeInboundReply.mockResolvedValue({
      status: "duplicate",
      messageId: "inbound-1",
      pendingId: null,
      providerTaskStatus: null,
      reason: "already_received",
    });
    const response = await request(testApp())
      .post("/api/webhooks/resend/events")
      .set("Content-Type", "application/json")
      .set("svix-id", "webhook-1")
      .set("svix-timestamp", "123")
      .set("svix-signature", "v1,test")
      .send(JSON.stringify(event));
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("duplicate");
  });

  it("fails closed when inbound verification is not configured", async () => {
    adapterMock.resendInboundWebhookConfigured.mockReturnValue(false);
    const response = await request(testApp())
      .post("/api/webhooks/resend/events")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(event));
    expect(response.status).toBe(503);
    expect(adapterMock.verifyResendInboundWebhook).not.toHaveBeenCalled();
  });
});
