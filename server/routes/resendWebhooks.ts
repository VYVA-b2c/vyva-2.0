import { Router } from "express";
import type { Request } from "express";
import { ingestConciergeInboundReply } from "../services/conciergeInboundReplies.js";
import {
  parseResendInboundReceivedEvent,
  resendInboundWebhookConfigured,
  retrieveResendReceivedEmail,
  verifyResendInboundWebhook,
} from "../services/resendInboundEmailAdapter.js";

const router = Router();

router.post("/events", async (req: Request, res) => {
  if (!resendInboundWebhookConfigured()) {
    return res.status(503).json({ error: "Inbound email is not configured." });
  }
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!rawBody) return res.status(400).json({ error: "Webhook body is required." });

  let verifiedEvent: unknown;
  try {
    verifiedEvent = verifyResendInboundWebhook({
      rawBody,
      webhookId: req.header("svix-id"),
      webhookTimestamp: req.header("svix-timestamp"),
      webhookSignature: req.header("svix-signature"),
    });
  } catch (error) {
    console.warn("[resend-inbound] rejected unverified webhook", error instanceof Error ? error.message : error);
    return res.status(401).json({ error: "Webhook signature is invalid." });
  }

  const event = parseResendInboundReceivedEvent(verifiedEvent);
  if (!event) return res.status(200).json({ ok: true, status: "ignored" });

  try {
    const message = await retrieveResendReceivedEmail(event, req.header("svix-id") ?? null);
    const result = await ingestConciergeInboundReply(message);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[resend-inbound] failed to process provider reply", error);
    return res.status(500).json({ error: "Provider reply could not be processed." });
  }
});

export default router;
