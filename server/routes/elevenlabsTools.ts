import type { Request, Response } from "express";
import { z } from "zod";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import {
  verifyMedicalProfileToolToken,
  verifyVoiceRecommendationFeedbackToolToken,
} from "../lib/jwt.js";
import {
  getLatestShownVoiceRecommendation,
  recordVoiceRecommendationFeedback,
  VOICE_RECOMMENDATION_ACTIONS,
} from "../lib/voiceRecommendationFeedback.js";

const retrieveMedicalProfileSchema = z.object({
  user_id: z.string().min(1),
  conversation_id: z.string().min(1),
  context_token: z.string().min(1).optional(),
  medical_profile_token: z.string().min(1).optional(),
});

const voiceRecommendationFeedbackSchema = z.object({
  user_id: z.string().min(1),
  conversation_id: z.string().min(1),
  feedback_token: z.string().min(1).optional(),
  voice_recommendation_feedback_token: z.string().min(1).optional(),
  recommendation_id: z.string().min(1).optional(),
  action: z.enum(VOICE_RECOMMENDATION_ACTIONS),
  domain: z.string().optional(),
  title: z.string().optional(),
  reason: z.string().optional(),
  evidence: z.string().optional(),
  outcome: z.string().optional(),
});

export async function retrieveMedicalProfileToolHandler(req: Request, res: Response) {
  const parsed = retrieveMedicalProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: user_id, conversation_id, context_token",
    });
  }

  const { user_id, conversation_id } = parsed.data;
  const token = parsed.data.context_token ?? parsed.data.medical_profile_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing context token" });
  }

  const verified = await verifyMedicalProfileToolToken(token);
  if (
    !verified ||
    verified.userId !== user_id ||
    verified.conversationId !== conversation_id
  ) {
    return res.status(403).json({ ok: false, error: "Invalid or expired context token" });
  }

  try {
    const medicalProfile = await getDoctorMedicalProfileVariables(user_id);
    return res.json({
      ok: true,
      user_id,
      conversation_id,
      medical_profile: medicalProfile.health_context,
      health_conditions: medicalProfile.health_conditions,
      allergies: medicalProfile.allergies,
      medications: medicalProfile.medications,
      gp_details: medicalProfile.gp_details,
      care_team: medicalProfile.care_team,
      emergency_contact: medicalProfile.emergency_contact,
      recent_health_events: medicalProfile.recent_health_events,
      health_profile_summary: medicalProfile.health_profile_summary,
      latest_vitals_scan: medicalProfile.latest_vitals_scan,
      latest_vitals_scan_at: medicalProfile.latest_vitals_scan_at,
      vitals_trend: medicalProfile.vitals_trend,
      latest_symptom_report: medicalProfile.latest_symptom_report,
      latest_symptom_report_at: medicalProfile.latest_symptom_report_at,
      recent_symptom_reports: medicalProfile.recent_symptom_reports,
      medication_adherence_summary: medicalProfile.medication_adherence_summary,
      medication_interaction_context: medicalProfile.medication_interaction_context,
      latest_medical_visit: medicalProfile.latest_medical_visit,
      upcoming_medical_appointment: medicalProfile.upcoming_medical_appointment,
      health_session_context: medicalProfile.health_session_context,
      medical_profile_last_updated: medicalProfile.medical_profile_last_updated,
    });
  } catch (err) {
    console.error("[elevenlabs tool retrieve_medical_profile]", err);
    return res.status(500).json({ ok: false, error: "Failed to retrieve medical profile" });
  }
}

export async function recordVoiceRecommendationFeedbackToolHandler(req: Request, res: Response) {
  const parsed = voiceRecommendationFeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: user_id, conversation_id, feedback_token, action",
    });
  }

  const { user_id, conversation_id, action } = parsed.data;
  const token = parsed.data.feedback_token ?? parsed.data.voice_recommendation_feedback_token;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing feedback token" });
  }

  const verified = await verifyVoiceRecommendationFeedbackToolToken(token);
  if (
    !verified ||
    verified.userId !== user_id ||
    verified.conversationId !== conversation_id
  ) {
    return res.status(403).json({ ok: false, error: "Invalid or expired feedback token" });
  }

  try {
    const latestShown = parsed.data.recommendation_id
      ? null
      : await getLatestShownVoiceRecommendation(user_id, conversation_id);
    const recommendationId = parsed.data.recommendation_id ?? latestShown?.recommendation_id;

    if (!recommendationId) {
      return res.status(400).json({
        ok: false,
        error: "recommendation_id is required when no recent shown recommendation is available",
      });
    }

    await recordVoiceRecommendationFeedback({
      userId: user_id,
      sessionId: conversation_id,
      recommendationId,
      action,
      domain: parsed.data.domain ?? latestShown?.domain,
      title: parsed.data.title ?? latestShown?.title,
      reason: parsed.data.reason ?? latestShown?.reason,
      source: "elevenlabs_tool",
      metadata: {
        evidence: parsed.data.evidence ?? "",
        outcome: parsed.data.outcome ?? "",
      },
    });

    return res.json({
      ok: true,
      recommendation_id: recommendationId,
      action,
      message: `Recorded ${action} feedback for ${recommendationId}.`,
    });
  } catch (err) {
    console.error("[elevenlabs tool record_voice_recommendation_feedback]", err);
    return res.status(500).json({ ok: false, error: "Failed to record recommendation feedback" });
  }
}
