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
import * as lifecycleService from "../services/lifecycle.js";
import {
  getLatestShownVoiceRecommendation,
  recordVoiceRecommendationFeedback,
  VOICE_RECOMMENDATION_ACTIONS,
} from "../lib/voiceRecommendationFeedback.js";
import {
  consultationContinuityCue,
  recentVoiceConsultations,
} from "../lib/voiceConsultationContinuity.js";

const retrieveMedicalProfileSchema = z.object({
  user_id: z.string().min(1),
  conversation_id: z.string().min(1),
  context_token: z.string().min(1).optional(),
  medical_profile_token: z.string().min(1).optional(),
  current_symptom_id: z.string().trim().max(120).optional().nullable(),
  locale: z.string().trim().max(24).optional().nullable(),
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

const phoneOnboardingContactSchema = z.object({
  name: z.string().trim().optional().nullable(),
  full_name: z.string().trim().optional().nullable(),
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  phone_number: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  whatsapp_number: z.string().trim().optional().nullable(),
}).passthrough();

const phoneOnboardingCompleteSchema = z.object({
  phone_onboarding_tool_token: z.string().min(1).optional(),
  tool_token: z.string().min(1).optional(),
  conversation_id: z.string().trim().optional().nullable(),
  user_type: z.enum(["elder", "family"]).default("elder"),
  name: z.string().trim().optional().nullable(),
  full_name: z.string().trim().optional().nullable(),
  first_name: z.string().trim().optional().nullable(),
  last_name: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  phone_number: z.string().trim().optional().nullable(),
  caller_phone: z.string().trim().optional().nullable(),
  email: z.string().trim().email().optional().nullable().or(z.literal("")),
  country_code: z.string().trim().optional().nullable(),
  language: z.string().trim().optional().nullable(),
  timezone: z.string().trim().optional().nullable(),
  tier: z.string().trim().min(1).default("free"),
  organization_id: z.string().uuid().optional().nullable(),
  profile: z.record(z.unknown()).optional().default({}),
  elder: phoneOnboardingContactSchema.optional(),
  family: phoneOnboardingContactSchema.optional(),
  source_payload: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
}).passthrough();

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text) return text;
  }
  return "";
}

function fullNameFromParts(record: Record<string, unknown>) {
  const firstName = stringValue(record.first_name);
  const lastName = stringValue(record.last_name);
  return `${firstName} ${lastName}`.trim();
}

function phoneWithCountry(countryCode: unknown, phone: string) {
  const country = stringValue(countryCode);
  if (!country || !phone || phone.startsWith("+")) return phone;
  return `${country}${phone.replace(/^0+/, "")}`;
}

function requestBaseUrl(req: Request) {
  return process.env.APP_URL ?? `${req.protocol}://${req.get("host")}`;
}

function verifyPhoneOnboardingToolRequest(req: Request, token?: string | null) {
  const expected = process.env.ELEVENLABS_PHONE_ONBOARDING_TOOL_TOKEN?.trim()
    ?? process.env.ELEVENLABS_INBOUND_ONBOARDING_TOOL_TOKEN?.trim();
  if (!expected) {
    return { ok: false as const, status: 503, error: "Phone onboarding tool token is not configured" };
  }

  const authorization = req.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const provided = token?.trim() || bearer;
  if (!provided) return { ok: false as const, status: 401, error: "Missing phone onboarding tool token" };
  if (provided !== expected) return { ok: false as const, status: 403, error: "Invalid phone onboarding tool token" };
  return { ok: true as const };
}

function normalizePhoneOnboardingPayload(data: z.infer<typeof phoneOnboardingCompleteSchema>, rawBody: unknown) {
  const profile = data.profile ?? {};
  const family = data.family ?? {};
  const elder = data.elder ?? {};
  const callerName = firstText(
    data.name,
    data.full_name,
    fullNameFromParts(data),
    profile.full_name,
    profile.name,
    fullNameFromParts(profile),
  );
  const callerPhone = phoneWithCountry(data.country_code, firstText(
    data.phone,
    data.phone_number,
    data.caller_phone,
    profile.phone_number,
    profile.phone,
  ));
  const callerEmail = firstText(data.email, profile.email);
  const callerProfile = {
    ...profile,
    full_name: callerName,
    phone_number: callerPhone,
    email: callerEmail || undefined,
    whatsapp_number: firstText(profile.whatsapp_number) || callerPhone,
    country_code: firstText(data.country_code, profile.country_code) || undefined,
    language: firstText(data.language, profile.language_preference, profile.language) || undefined,
    timezone: firstText(data.timezone, profile.timezone) || undefined,
  };

  if (!callerName || !callerPhone) {
    return { validationError: "Name and phone are required for phone onboarding." };
  }

  const elderName = firstText(
    elder.name,
    elder.full_name,
    fullNameFromParts(elder),
    callerProfile.elder_name,
  );
  const elderPhone = phoneWithCountry(data.country_code, firstText(
    elder.phone,
    elder.phone_number,
    callerProfile.elder_phone,
  ));
  const elderEmail = firstText(elder.email, callerProfile.elder_email);
  const familyName = firstText(
    family.name,
    family.full_name,
    fullNameFromParts(family),
    callerName,
  );
  const familyPhone = phoneWithCountry(data.country_code, firstText(
    family.phone,
    family.phone_number,
    callerPhone,
  ));
  const familyEmail = firstText(family.email, callerEmail);

  const metadata: Record<string, unknown> = {
    ...data.metadata,
    ...callerProfile,
    elevenlabs: {
      inbound_phone_onboarding: true,
      conversation_id: data.conversation_id ?? null,
      captured_at: new Date().toISOString(),
    },
  };

  if (data.user_type === "family") {
    metadata.elder_profile = {
      ...elder,
      full_name: elderName,
      phone_number: elderPhone,
      email: elderEmail || undefined,
      language: firstText(data.language, elder.language_preference, elder.language, profile.language_preference, profile.language) || undefined,
      timezone: firstText(data.timezone, elder.timezone, profile.timezone) || undefined,
    };
  }

  return {
    intake: {
      name: data.user_type === "family" ? familyName : callerName,
      phone: data.user_type === "family" ? familyPhone : callerPhone,
      email: data.user_type === "family" ? familyEmail || undefined : callerEmail || undefined,
      user_type: data.user_type,
      entry_point: "phone" as const,
      organization_id: data.organization_id ?? null,
      tier: data.tier,
      elder: data.user_type === "family" ? {
        name: elderName,
        phone: elderPhone,
        email: elderEmail || undefined,
      } : undefined,
      source_payload: {
        ...data.source_payload,
        elevenlabs: {
          conversation_id: data.conversation_id ?? null,
          source: "inbound_phone_onboarding",
        },
        raw: rawBody && typeof rawBody === "object" ? rawBody as Record<string, unknown> : {},
      },
      metadata,
    },
  };
}

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

export async function completePhoneOnboardingToolHandler(req: Request, res: Response) {
  const parsed = phoneOnboardingCompleteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Invalid phone onboarding payload",
      details: parsed.error.flatten(),
    });
  }

  const token = parsed.data.phone_onboarding_tool_token ?? parsed.data.tool_token;
  const verified = verifyPhoneOnboardingToolRequest(req, token);
  if (!verified.ok) return res.status(verified.status).json({ ok: false, error: verified.error });

  const normalized = normalizePhoneOnboardingPayload(parsed.data, req.body);
  if ("validationError" in normalized) {
    return res.status(400).json({ ok: false, error: normalized.validationError });
  }

  try {
    const result = await lifecycleService.createLifecycleIntake(normalized.intake);
    if ("error" in result) return res.status(400).json({ ok: false, error: result.error });

    await lifecycleService.recordLifecycleEvent({
      intakeId: result.intake.id,
      userId: result.intake.user_id,
      eventType: "phone_onboarding_captured",
      toStatus: result.intake.status,
      channel: "elevenlabs_tool",
      metadata: {
        conversation_id: parsed.data.conversation_id ?? null,
        user_type: result.intake.user_type,
      },
    });

    if (result.intake.user_type === "family") {
      const attempt = await lifecycleService.triggerConsentAttempt(result.intake.id);
      return res.status(201).json({
        ok: true,
        intake_id: result.intake.id,
        user_id: result.intake.user_id,
        elder_user_id: result.intake.elder_user_id,
        family_user_id: result.intake.family_user_id,
        next_action: "consent_queued",
        consent_attempt: attempt,
      });
    }

    const linkResult = await lifecycleService.sendIntakeLink(result.intake.id, requestBaseUrl(req));
    return res.status(201).json({
      ok: true,
      intake_id: result.intake.id,
      user_id: result.intake.user_id,
      elder_user_id: result.intake.elder_user_id,
      family_user_id: result.intake.family_user_id,
      next_action: "link_queued",
      access_link: linkResult?.link ?? null,
      communication: linkResult?.communication ?? null,
    });
  } catch (error) {
    console.error("[elevenlabs tool phone onboarding complete]", error);
    return res.status(500).json({ ok: false, error: "Failed to complete phone onboarding" });
  }
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
    const medicalProfile = await getDoctorMedicalProfileVariables(user_id, {
      flowInstanceId: conversation_id,
    });
    const consultationHistory = await recentVoiceConsultations({
      userId: user_id,
      currentConversationId: conversation_id,
      currentSymptomId: parsed.data.current_symptom_id,
    }).catch((err) => {
      console.warn("[elevenlabs tool consultation continuity]", err);
      return { recentConsultations: [], relevantPriorConsultation: null };
    });
    const consultationLocale = String(parsed.data.locale || medicalProfile.preferred_language || "en");
    const relevantPriorConsultation = consultationHistory.relevantPriorConsultation
      ? {
          ...consultationHistory.relevantPriorConsultation,
          spoken_cue: consultationContinuityCue(
            consultationHistory.relevantPriorConsultation,
            consultationLocale,
            new Date(),
            String(medicalProfile.timezone || "UTC"),
          ),
        }
      : null;
    return res.json({
      ok: true,
      user_id,
      conversation_id,
      user_profile: {
        preferred_name: medicalProfile.preferred_name,
        first_name: medicalProfile.first_name,
        full_name: medicalProfile.full_name,
        age_years: medicalProfile.age_years,
        preferred_language: medicalProfile.preferred_language,
        timezone: medicalProfile.timezone,
        city: medicalProfile.city,
      },
      medical_profile: medicalProfile.health_context,
      memory_context: medicalProfile.memory_block,
      health_conditions: medicalProfile.health_conditions,
      allergies: medicalProfile.allergies,
      medications: medicalProfile.medications,
      devices: medicalProfile.devices,
      care_context: medicalProfile.care_context,
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
      checkin_context: medicalProfile.checkin_context,
      latest_medical_visit: medicalProfile.latest_medical_visit,
      upcoming_medical_appointment: medicalProfile.upcoming_medical_appointment,
      health_session_context: medicalProfile.health_session_context,
      medical_profile_last_updated: medicalProfile.medical_profile_last_updated,
      recent_consultations: consultationHistory.recentConsultations,
      relevant_prior_consultation: relevantPriorConsultation,
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
