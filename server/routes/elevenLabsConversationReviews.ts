import type { Request, Response } from "express";
import {
  ElevenLabsProviderError,
  auditElevenLabsConversationAccess,
  elevenLabsConversationToApi,
  findElevenLabsConversation,
  ingestElevenLabsPostCall,
  isElevenLabsReviewStatus,
  listElevenLabsConversations,
  retrieveElevenLabsConversationAudio,
  retrieveElevenLabsConversationDetails,
  updateElevenLabsConversationReview,
  verifyElevenLabsWebhookSignature,
} from "../lib/elevenLabsConversationReviews.js";

function requestedLimit(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 100, 250));
}

function providerConversationId(req: Request) {
  const value = String(req.params.conversationId ?? "").trim();
  return /^[A-Za-z0-9._:-]{1,220}$/.test(value) ? value : null;
}

function accessReason(value: unknown) {
  const reason = typeof value === "string" ? value.trim().slice(0, 500) : "";
  return reason.length >= 3 ? reason : null;
}

async function safeAudit(input: Parameters<typeof auditElevenLabsConversationAccess>[0]) {
  try {
    await auditElevenLabsConversationAccess(input);
  } catch (error) {
    console.error("[admin/voice/conversations audit]", error);
  }
}

export async function elevenLabsPostCallWebhookHandler(req: Request, res: Response) {
  const secret = process.env.ELEVENLABS_POST_CALL_WEBHOOK_SECRET?.trim();
  if (!secret) return res.status(503).json({ error: "ElevenLabs post-call webhook is not configured" });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Raw webhook body is required" });
  if (!verifyElevenLabsWebhookSignature({
    rawBody: req.body,
    signatureHeader: req.header("ElevenLabs-Signature"),
    secret,
  })) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(req.body.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid webhook JSON" });
  }

  try {
    const result = await ingestElevenLabsPostCall(payload);
    return res.status(200).json({ received: true, accepted: result.accepted });
  } catch (error) {
    console.error("[webhooks/elevenlabs/post-call]", error);
    return res.status(500).json({ error: "Failed to record conversation metadata" });
  }
}

export async function listElevenLabsConversationsHandler(req: Request, res: Response) {
  try {
    const rows = await listElevenLabsConversations(requestedLimit(req.query.limit));
    return res.json({ conversations: rows.map(elevenLabsConversationToApi) });
  } catch (error) {
    console.error("[admin/voice/conversations list]", error);
    return res.status(500).json({ error: "Failed to load ElevenLabs conversations" });
  }
}

export async function getElevenLabsConversationDetailsHandler(req: Request, res: Response) {
  const id = providerConversationId(req);
  const reason = accessReason(req.query.reason);
  if (!id) return res.status(400).json({ error: "A valid conversation id is required" });
  if (!reason) return res.status(400).json({ error: "A review reason of at least 3 characters is required" });
  let conversation;
  try {
    conversation = await findElevenLabsConversation(id);
  } catch (error) {
    console.error("[admin/voice/conversations details lookup]", error);
    return res.status(500).json({ error: "Failed to load conversation metadata" });
  }
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  try {
    const details = await retrieveElevenLabsConversationDetails(conversation);
    await safeAudit({ conversation, actorUserId: req.user!.id, action: "view_details", reason, succeeded: true });
    return res.json({ details });
  } catch (error) {
    await safeAudit({ conversation, actorUserId: req.user!.id, action: "view_details", reason, succeeded: false });
    const status = error instanceof ElevenLabsProviderError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Failed to retrieve conversation" });
  }
}

export async function getElevenLabsConversationAudioHandler(req: Request, res: Response) {
  const id = providerConversationId(req);
  const reason = accessReason(req.query.reason);
  if (!id) return res.status(400).json({ error: "A valid conversation id is required" });
  if (!reason) return res.status(400).json({ error: "A review reason of at least 3 characters is required" });
  let conversation;
  try {
    conversation = await findElevenLabsConversation(id);
  } catch (error) {
    console.error("[admin/voice/conversations audio lookup]", error);
    return res.status(500).json({ error: "Failed to load conversation metadata" });
  }
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  try {
    const audio = await retrieveElevenLabsConversationAudio(conversation);
    await safeAudit({ conversation, actorUserId: req.user!.id, action: "play_audio", reason, succeeded: true });
    res.setHeader("Content-Type", audio.contentType);
    res.setHeader("Content-Length", String(audio.bytes.length));
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    return res.send(audio.bytes);
  } catch (error) {
    await safeAudit({ conversation, actorUserId: req.user!.id, action: "play_audio", reason, succeeded: false });
    const status = error instanceof ElevenLabsProviderError ? error.status : 500;
    return res.status(status).json({ error: error instanceof Error ? error.message : "Failed to retrieve recording" });
  }
}

export async function updateElevenLabsConversationReviewHandler(req: Request, res: Response) {
  const id = providerConversationId(req);
  const body = (req.body ?? {}) as { status?: unknown; note?: unknown; reason?: unknown };
  const reason = accessReason(body.reason);
  if (!id) return res.status(400).json({ error: "A valid conversation id is required" });
  if (!isElevenLabsReviewStatus(body.status)) return res.status(400).json({ error: "A valid review status is required" });
  if (!reason) return res.status(400).json({ error: "A review reason of at least 3 characters is required" });
  let conversation;
  try {
    conversation = await findElevenLabsConversation(id);
  } catch (error) {
    console.error("[admin/voice/conversations review lookup]", error);
    return res.status(500).json({ error: "Failed to load conversation metadata" });
  }
  if (!conversation) return res.status(404).json({ error: "Conversation not found" });

  try {
    const updated = await updateElevenLabsConversationReview({
      conversation,
      status: body.status,
      note: typeof body.note === "string" ? body.note : null,
      reviewedBy: req.user!.id,
    });
    await safeAudit({
      conversation,
      actorUserId: req.user!.id,
      action: "review_update",
      reason,
      succeeded: true,
      metadata: { status: body.status },
    });
    return res.json({ conversation: elevenLabsConversationToApi(updated) });
  } catch (error) {
    await safeAudit({ conversation, actorUserId: req.user!.id, action: "review_update", reason, succeeded: false });
    console.error("[admin/voice/conversations review]", error);
    return res.status(500).json({ error: "Failed to update conversation review" });
  }
}
