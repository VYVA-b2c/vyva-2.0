import type { Request, Response } from "express";
import {
  isVoiceQaReviewStatus,
  listVoiceQaSessionReviews,
  upsertVoiceQaSessionReview,
  voiceQaSessionReviewToApi,
} from "../lib/voiceQaSessionReviews.js";

type SaveVoiceQaReviewBody = {
  session_id?: string;
  status?: string;
  note?: string;
};

function requestedLimit(value: unknown) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) return 500;
  return Math.max(1, Math.min(parsed, 1000));
}

export async function listVoiceQaSessionReviewsHandler(req: Request, res: Response) {
  try {
    const reviews = await listVoiceQaSessionReviews(requestedLimit(req.query.limit));
    return res.json({ reviews: reviews.map(voiceQaSessionReviewToApi) });
  } catch (err) {
    console.error("[admin/voice/qa-reviews list]", err);
    return res.status(500).json({ error: "Failed to load QA reviews" });
  }
}

export async function saveVoiceQaSessionReviewHandler(req: Request, res: Response) {
  const body = (req.body ?? {}) as SaveVoiceQaReviewBody;
  if (!body.session_id || typeof body.session_id !== "string") {
    return res.status(400).json({ error: "session_id is required" });
  }
  if (!isVoiceQaReviewStatus(body.status)) {
    return res.status(400).json({ error: "valid status is required" });
  }

  try {
    const review = await upsertVoiceQaSessionReview({
      sessionId: body.session_id,
      status: body.status,
      note: body.note,
      reviewedBy: req.user?.id,
    });
    return res.json({ review: review ? voiceQaSessionReviewToApi(review) : null });
  } catch (err) {
    console.error("[admin/voice/qa-reviews save]", err);
    return res.status(500).json({ error: "Failed to save QA review" });
  }
}
