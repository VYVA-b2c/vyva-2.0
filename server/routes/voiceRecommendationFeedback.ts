import type { Request, Response } from "express";
import {
  recordVoiceRecommendationFeedback,
  VOICE_RECOMMENDATION_ACTIONS,
  type VoiceRecommendationAction,
} from "../lib/voiceRecommendationFeedback.js";

type VoiceRecommendationFeedbackRequestBody = {
  recommendation_id?: string;
  action?: string;
  domain?: string;
  title?: string;
  reason?: string;
  session_id?: string;
  source?: string;
  metadata?: Record<string, unknown>;
};

function isVoiceRecommendationAction(value: unknown): value is VoiceRecommendationAction {
  return typeof value === "string" && VOICE_RECOMMENDATION_ACTIONS.includes(value as VoiceRecommendationAction);
}

export async function voiceRecommendationFeedbackHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const body = (req.body ?? {}) as VoiceRecommendationFeedbackRequestBody;
  if (!body.recommendation_id || typeof body.recommendation_id !== "string") {
    return res.status(400).json({ error: "recommendation_id is required" });
  }
  if (!isVoiceRecommendationAction(body.action)) {
    return res.status(400).json({ error: "valid action is required" });
  }

  try {
    await recordVoiceRecommendationFeedback({
      userId,
      recommendationId: body.recommendation_id,
      action: body.action,
      domain: body.domain,
      title: body.title,
      reason: body.reason,
      sessionId: body.session_id,
      source: body.source ?? "voice_api",
      metadata: body.metadata,
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[voice/recommendations/feedback]", err);
    return res.status(500).json({ error: "Failed to save feedback" });
  }
}
