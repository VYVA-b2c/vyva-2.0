import { Router } from "express";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db.js";
import { communicationsLog, whatsappPrivateCheckins } from "../../shared/schema.js";
import * as lifecycleService from "../services/lifecycle.js";
import { verifyTwilioSignature } from "../lib/webhookVerification.js";
import { decryptPrivateCheckinResponse, encryptPrivateCheckinResponse } from "../lib/whatsappPrivateCheckin.js";
import {
  advanceHip24hConversation,
  HIP_24H_QUESTIONS_EN,
  HIP_24H_STEP_ID,
  hip24hTemplateSid,
  hip24hWhatsappFrom,
  type Hip24hConversationState,
} from "../lib/whatsapp24hConversation.js";
import { dispatchCommunicationsByIds } from "../services/communicationDispatcher.js";

const router = Router();

function twilioSignatureValid(req: { header(name: string): string | undefined; originalUrl: string; protocol: string; get(name: string): string | undefined; body: Record<string, unknown> }) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    console.warn("[twilio-webhook] TWILIO_AUTH_TOKEN not configured — accepting callback without signature verification");
    return true;
  }
  return verifyTwilioSignature({
    authToken,
    signature: req.header("X-Twilio-Signature"),
    url: `${publicBaseUrl(req)}${req.originalUrl}`,
    params: req.body,
  });
}

function strictTwilioSignatureValid(req: Parameters<typeof twilioSignatureValid>[0]) {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  if (!authToken) {
    console.error("[whatsapp-24h] TWILIO_AUTH_TOKEN is required for inbound health responses");
    return false;
  }
  const baseUrl = (process.env.TWILIO_WEBHOOK_BASE_URL ?? publicBaseUrl(req)).replace(/\/$/, "");
  return verifyTwilioSignature({
    authToken,
    signature: req.header("X-Twilio-Signature"),
    url: `${baseUrl}${req.originalUrl}`,
    params: req.body,
  });
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function publicBaseUrl(req: { protocol: string; get(name: string): string | undefined }) {
  return process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twiml(res: { type(contentType: string): unknown; send(body: string): unknown }, body: string) {
  res.type("text/xml");
  return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

async function updateByProviderId(providerMessageId: string | undefined, patch: Partial<typeof communicationsLog.$inferInsert>) {
  if (!providerMessageId) return null;
  const [existing] = await db
    .select()
    .from(communicationsLog)
    .where(eq(communicationsLog.provider_message_id, providerMessageId))
    .limit(1);
  if (!existing) return null;

  const [updated] = await db
    .update(communicationsLog)
    .set({
      ...patch,
      metadata: {
        ...metadataRecord(existing.metadata),
        ...metadataRecord(patch.metadata),
      },
    })
    .where(eq(communicationsLog.id, existing.id))
    .returning();
  return updated;
}

function finalMessageStatus(status: string | undefined) {
  if (status === "delivered") return "delivered";
  if (status === "sent") return "sent";
  if (status === "queued" || status === "sending" || status === "accepted") return "queued";
  if (status === "failed" || status === "undelivered") return "failed";
  return undefined;
}

function finalVoiceStatus(status: string | undefined) {
  if (status === "completed" || status === "in-progress" || status === "ringing") return "sent";
  if (status === "failed" || status === "busy" || status === "no-answer" || status === "canceled") return "failed";
  return undefined;
}

function consentStatusFromCallStatus(status: string | undefined) {
  if (status === "no-answer" || status === "busy") return "no_answer";
  if (status === "failed" || status === "canceled") return "failed";
  return null;
}

router.post("/message-status", async (req, res) => {
  if (!twilioSignatureValid(req)) {
    console.warn("[twilio-webhook] rejected message-status with invalid signature");
    return res.sendStatus(403);
  }

  const providerId = req.body.MessageSid ?? req.body.SmsSid;
  const providerStatus = req.body.MessageStatus ?? req.body.SmsStatus;
  const status = finalMessageStatus(providerStatus);

  const metadata: Record<string, unknown> = {
    provider_status: providerStatus ?? null,
    provider_error_code: req.body.ErrorCode ?? null,
    provider_error_message: req.body.ErrorMessage ?? null,
    status_callback_at: new Date().toISOString(),
  };

  const patch: Partial<typeof communicationsLog.$inferInsert> = {};
  if (status) patch.status = status;

  if (status === "delivered") {
    patch.sent_at = new Date();
    metadata.delivered_at = new Date().toISOString();
  } else if (status === "failed") {
    const errorText = req.body.ErrorMessage
      ? `${req.body.ErrorMessage}${req.body.ErrorCode ? ` (${req.body.ErrorCode})` : ""}`
      : `Twilio ${providerStatus ?? "delivery failure"}`;
    metadata.dispatch_error = errorText;
    metadata.provider_error = errorText;
  }

  patch.metadata = metadata;

  await updateByProviderId(providerId, patch);

  return res.sendStatus(204);
});

router.post("/whatsapp-24h", async (req, res) => {
  if (!strictTwilioSignatureValid(req)) {
    console.warn("[whatsapp-24h] rejected inbound message with invalid signature");
    return res.sendStatus(403);
  }

  const recipient = String(req.body.From ?? "").replace(/^whatsapp:/i, "").trim();
  const messageSid = String(req.body.MessageSid ?? req.body.SmsMessageSid ?? "").trim();
  const body = String(req.body.Body ?? "").trim().slice(0, 2_000);
  const buttonPayload = String(req.body.ButtonPayload ?? "").trim().slice(0, 200);
  if (!/^\+[1-9]\d{7,14}$/.test(recipient) || !/^SM[a-zA-Z0-9]{20,40}$/.test(messageSid)) {
    return res.sendStatus(400);
  }

  const now = new Date();
  try {
    const queuedReply = await db.transaction(async (tx) => {
      const [checkin] = await tx.select().from(whatsappPrivateCheckins).where(and(
        eq(whatsappPrivateCheckins.recipient, recipient),
        eq(whatsappPrivateCheckins.language, "en"),
        eq(whatsappPrivateCheckins.step_id, HIP_24H_STEP_ID),
        inArray(whatsappPrivateCheckins.status, ["sent", "in_progress"]),
        gt(whatsappPrivateCheckins.expires_at, now),
      )).orderBy(desc(whatsappPrivateCheckins.created_at)).limit(1).for("update");

      if (!checkin?.response_payload) return null;
      const state = decryptPrivateCheckinResponse(checkin.response_payload) as Hip24hConversationState;
      if (state.mode !== "whatsapp_conversation") return null;
      if (state.processed_message_sids.includes(messageSid)) return null;

      const transition = advanceHip24hConversation(state, { body, buttonPayload }, now);
      transition.state.processed_message_sids = [...transition.state.processed_message_sids, messageSid].slice(-20);
      const status = transition.cancelled ? "cancelled" : transition.completed ? "completed" : "in_progress";

      const replyBody = transition.reply.kind === "template"
        ? HIP_24H_QUESTIONS_EN[transition.reply.question - 1].prompt
        : transition.reply.body;
      const [communication] = await tx.insert(communicationsLog).values({
        channel: "whatsapp",
        recipient,
        purpose: "hip_24h_whatsapp_checkin",
        status: "queued",
        body: replyBody,
        metadata: {
          ...(transition.reply.kind === "template" ? { content_sid: hip24hTemplateSid(transition.reply.question) } : {}),
          whatsapp_from: hip24hWhatsappFrom(),
          private_checkin_id: checkin.id,
          workflow_id: checkin.workflow_id,
          step_id: checkin.step_id,
          language: "en",
          conversation_mode: "whatsapp_24h_direct",
          inbound_message_sid: messageSid,
          health_data_in_message: false,
        },
      }).returning({ id: communicationsLog.id });

      await tx.update(whatsappPrivateCheckins).set({
        response_payload: encryptPrivateCheckinResponse(transition.state),
        status,
        consumed_at: transition.completed || transition.cancelled ? now : null,
        updated_at: now,
      }).where(eq(whatsappPrivateCheckins.id, checkin.id));

      return {
        communicationId: communication.id,
        checkinId: checkin.id,
        previousResponsePayload: checkin.response_payload,
        previousStatus: checkin.status,
        previousConsumedAt: checkin.consumed_at,
      };
    });

    if (queuedReply) {
      const dispatch = await dispatchCommunicationsByIds([queuedReply.communicationId]);
      if (dispatch.results[0]?.status !== "sent") {
        await db.update(whatsappPrivateCheckins).set({
          response_payload: queuedReply.previousResponsePayload,
          status: queuedReply.previousStatus,
          consumed_at: queuedReply.previousConsumedAt,
          updated_at: new Date(),
        }).where(and(
          eq(whatsappPrivateCheckins.id, queuedReply.checkinId),
          eq(whatsappPrivateCheckins.updated_at, now),
        ));
        console.error("[whatsapp-24h] reply dispatch failed", { communicationId: queuedReply.communicationId });
        return res.sendStatus(500);
      }
    }
    return twiml(res, "");
  } catch (error) {
    console.error("[whatsapp-24h] inbound processing failed", error);
    return res.sendStatus(500);
  }
});

router.post("/voice-status", async (req, res) => {
  const providerId = req.body.CallSid;
  const providerStatus = req.body.CallStatus;
  const status = finalVoiceStatus(providerStatus);

  const communication = await updateByProviderId(providerId, {
    ...(status ? { status } : {}),
    metadata: {
      provider_status: providerStatus ?? null,
      call_duration: req.body.CallDuration ?? null,
      provider_error_code: req.body.ErrorCode ?? null,
      provider_error_message: req.body.ErrorMessage ?? null,
      status_callback_at: new Date().toISOString(),
    },
  });

  const consentAttemptId = metadataRecord(communication?.metadata).consent_attempt_id;
  const consentStatus = consentStatusFromCallStatus(providerStatus);
  if (typeof consentAttemptId === "string" && consentStatus) {
    await lifecycleService.recordConsentResult({
      attemptId: consentAttemptId,
      status: consentStatus,
      source_session_id: providerId,
      baseUrl: publicBaseUrl(req),
      result_payload: {
        provider_status: providerStatus,
        provider_error_code: req.body.ErrorCode ?? null,
        provider_error_message: req.body.ErrorMessage ?? null,
        call_duration: req.body.CallDuration ?? null,
      },
    });
  }

  return res.sendStatus(204);
});

router.post("/consent/:attemptId/voice", async (req, res) => {
  const action = `${publicBaseUrl(req)}/api/webhooks/twilio/consent/${req.params.attemptId}/gather`;
  return twiml(res, [
    `<Gather numDigits="1" action="${xmlEscape(action)}" method="POST" actionOnEmptyResult="true" timeout="8">`,
    "<Say voice=\"alice\" language=\"en-US\">Hello. This is VYVA calling to confirm consent for a family caregiver to help set up and access the caregiver dashboard. Press 1 to approve. Press 2 to reject. Press 9 to repeat.</Say>",
    "</Gather>",
  ].join(""));
});

router.post("/consent/:attemptId/gather", async (req, res) => {
  const digit = String(req.body.Digits ?? "").trim();
  const callSid = typeof req.body.CallSid === "string" ? req.body.CallSid : undefined;

  if (digit === "9") {
    const redirect = `${publicBaseUrl(req)}/api/webhooks/twilio/consent/${req.params.attemptId}/voice`;
    return twiml(res, `<Redirect method="POST">${xmlEscape(redirect)}</Redirect>`);
  }

  if (digit === "1") {
    await lifecycleService.recordConsentResult({
      attemptId: req.params.attemptId,
      status: "approved",
      source_session_id: callSid,
      baseUrl: publicBaseUrl(req),
      result_payload: { digits: digit, call_sid: callSid ?? null },
    });
    return twiml(res, "<Say voice=\"alice\" language=\"en-US\">Thank you. Consent is approved. VYVA will now send the secure links.</Say>");
  }

  if (digit === "2") {
    await lifecycleService.recordConsentResult({
      attemptId: req.params.attemptId,
      status: "rejected",
      source_session_id: callSid,
      baseUrl: publicBaseUrl(req),
      result_payload: { digits: digit, call_sid: callSid ?? null },
    });
    return twiml(res, "<Say voice=\"alice\" language=\"en-US\">Thank you. Consent was not approved, so VYVA will stop this family setup.</Say>");
  }

  await lifecycleService.recordConsentResult({
    attemptId: req.params.attemptId,
    status: "no_answer",
    source_session_id: callSid,
    baseUrl: publicBaseUrl(req),
    result_payload: { digits: digit || null, call_sid: callSid ?? null, reason: "empty_or_invalid_keypad_response" },
  });
  return twiml(res, "<Say voice=\"alice\" language=\"en-US\">We did not receive a valid response. VYVA will try again later. Goodbye.</Say>");
});

export default router;
