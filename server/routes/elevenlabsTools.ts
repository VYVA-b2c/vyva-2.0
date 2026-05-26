import type { Request, Response } from "express";
import { z } from "zod";
import { getDoctorMedicalProfileVariables } from "../lib/doctorMedicalProfile.js";
import {
  verifyCallbackOnboardingToolToken,
  verifyMedicalProfileToolToken,
  verifyVoiceRecommendationFeedbackToolToken,
} from "../lib/jwt.js";
import {
  completeCallbackOnboarding,
  failCallbackOnboarding,
  saveCallbackOnboardingSection,
} from "../services/callbackOnboarding.js";
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

const callbackToolBaseSchema = z.object({
  intake_id: z.string().uuid(),
  conversation_id: z.string().min(1).optional().nullable(),
  onboarding_tool_token: z.string().min(1).optional(),
  tool_token: z.string().min(1).optional(),
});

const callbackSaveSectionSchema = callbackToolBaseSchema.extend({
  section_id: z.string().trim().min(1),
  consent_confirmed: z.boolean().optional().default(false),
  data: z.record(z.unknown()).default({}),
});

const callbackCompleteSchema = callbackToolBaseSchema.extend({
  consent_confirmed: z.boolean().optional().default(false),
  confirmation_channel: z.enum(["email", "whatsapp"]),
  email: z.string().trim().email().optional().nullable(),
  whatsapp_number: z.string().trim().min(3).optional().nullable(),
  profile: z.record(z.unknown()).optional().default({}),
  caregiver: z.record(z.unknown()).optional().default({}),
  sections: z.record(z.record(z.unknown())).optional().default({}),
});

const callbackFailSchema = callbackToolBaseSchema.extend({
  reason: z.string().trim().optional().nullable(),
});

async function verifyCallbackToolRequest(
  intakeId: string,
  token?: string | null,
) {
  if (!token) return { ok: false as const, status: 401, error: "Missing onboarding tool token" };
  const verified = await verifyCallbackOnboardingToolToken(token);
  if (!verified || verified.intakeId !== intakeId) {
    return { ok: false as const, status: 403, error: "Invalid or expired onboarding tool token" };
  }
  return { ok: true as const };
}

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

export async function saveCallbackOnboardingSectionToolHandler(req: Request, res: Response) {
  const parsed = callbackSaveSectionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid callback onboarding section payload" });
  }

  const token = parsed.data.onboarding_tool_token ?? parsed.data.tool_token;
  const verified = await verifyCallbackToolRequest(parsed.data.intake_id, token);
  if (!verified.ok) return res.status(verified.status).json({ ok: false, error: verified.error });
  if (!parsed.data.consent_confirmed) {
    return res.status(400).json({ ok: false, error: "Consent required before saving callback onboarding data" });
  }

  try {
    const intake = await saveCallbackOnboardingSection({
      intakeId: parsed.data.intake_id,
      conversationId: parsed.data.conversation_id,
      sectionId: parsed.data.section_id,
      data: parsed.data.data,
    });
    if (!intake) return res.status(404).json({ ok: false, error: "Callback onboarding intake not found" });
    return res.json({ ok: true, intake_id: intake.id, section_id: parsed.data.section_id });
  } catch (error) {
    console.error("[elevenlabs tool callback save-section]", error);
    return res.status(500).json({ ok: false, error: "Failed to save onboarding section" });
  }
}

export async function completeCallbackOnboardingToolHandler(req: Request, res: Response) {
  const parsed = callbackCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid callback onboarding completion payload" });
  }

  const token = parsed.data.onboarding_tool_token ?? parsed.data.tool_token;
  const verified = await verifyCallbackToolRequest(parsed.data.intake_id, token);
  if (!verified.ok) return res.status(verified.status).json({ ok: false, error: verified.error });
  if (!parsed.data.consent_confirmed) {
    return res.status(400).json({ ok: false, error: "Consent required before completing callback onboarding" });
  }

  try {
    const result = await completeCallbackOnboarding({
      intakeId: parsed.data.intake_id,
      conversationId: parsed.data.conversation_id,
      confirmationChannel: parsed.data.confirmation_channel,
      email: parsed.data.email,
      whatsappNumber: parsed.data.whatsapp_number,
      profile: parsed.data.profile,
      caregiver: parsed.data.caregiver,
      sections: parsed.data.sections,
    });
    if ("error" in result) return res.status(400).json({ ok: false, error: result.error });
    return res.json({
      ok: true,
      intake_id: result.intake.id,
      profile_id: result.profileId,
      confirmation_user_id: result.confirmationUserId,
      communication_id: result.communication.id,
    });
  } catch (error) {
    console.error("[elevenlabs tool callback complete]", error);
    return res.status(500).json({ ok: false, error: "Failed to complete callback onboarding" });
  }
}

export async function failCallbackOnboardingToolHandler(req: Request, res: Response) {
  const parsed = callbackFailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: "Invalid callback onboarding failure payload" });
  }

  const token = parsed.data.onboarding_tool_token ?? parsed.data.tool_token;
  const verified = await verifyCallbackToolRequest(parsed.data.intake_id, token);
  if (!verified.ok) return res.status(verified.status).json({ ok: false, error: verified.error });

  try {
    const intake = await failCallbackOnboarding({
      intakeId: parsed.data.intake_id,
      conversationId: parsed.data.conversation_id,
      reason: parsed.data.reason,
    });
    if (!intake) return res.status(404).json({ ok: false, error: "Callback onboarding intake not found" });
    return res.json({ ok: true, intake_id: intake.id, status: intake.status });
  } catch (error) {
    console.error("[elevenlabs tool callback fail]", error);
    return res.status(500).json({ ok: false, error: "Failed to mark callback onboarding as failed" });
  }
}
