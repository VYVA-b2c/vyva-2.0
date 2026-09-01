import type { Request, Response } from "express";
import { buildVoiceContext, type VoiceContextDomain } from "../lib/voiceContext.js";
import {
  signMedicalProfileToolToken,
  signVoiceTriageToolToken,
  signVoiceRecommendationFeedbackToolToken,
} from "../lib/jwt.js";
import { recordShownVoiceRecommendation } from "../lib/voiceRecommendationFeedback.js";
import { resolveHealthMemoryPolicyFlag } from "../memory/healthMemoryPolicy.js";

const KNOWN_DOMAINS = new Set<VoiceContextDomain>([
  "safety",
  "meds",
  "health",
  "concierge",
  "brain_coach",
  "onboarding_profile",
  "companion",
  "doctor",
  "social",
]);

function normalizeSlug(value?: string) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "";
}

export function resolveVoiceContextDomain(body: Record<string, unknown>): VoiceContextDomain {
  const rawDomain = typeof body.domain === "string" ? normalizeSlug(body.domain) : "";
  if (KNOWN_DOMAINS.has(rawDomain as VoiceContextDomain)) {
    return rawDomain as VoiceContextDomain;
  }

  const agentSlug = typeof body.agent_slug === "string" ? normalizeSlug(body.agent_slug) : "";
  const roomSlug = typeof body.room_slug === "string" ? normalizeSlug(body.room_slug) : "";
  if (agentSlug === "vyva" || agentSlug === "main-vyva" || agentSlug === "main_vyva") return "companion";
  if (agentSlug === "doctor" || agentSlug === "medical-doctor") return "doctor";
  if (agentSlug === "health" || agentSlug === "health-assistant" || agentSlug === "dr-ai" || agentSlug === "ask-dr-ai") return "health";
  if (agentSlug === "meds" || agentSlug === "medication" || agentSlug === "medications") return "meds";
  if (
    agentSlug === "onboarding-profile" ||
    agentSlug === "profile-onboarding" ||
    agentSlug === "onboarding_profile"
  ) {
    return "onboarding_profile";
  }
  if (roomSlug || agentSlug) return "social";
  return "companion";
}

function isMedicalContextDomain(domain: VoiceContextDomain) {
  return domain === "health" || domain === "doctor" || domain === "meds" || domain === "safety";
}

function createConversationId() {
  return `voice-context-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const DR_AI_FIRST_MESSAGES: Record<string, string> = {
  en: "I'm here with you. Tell me what feels different today.",
  es: "Estoy aquí contigo. Cuéntame qué notas diferente hoy.",
  fr: "Je suis là avec vous. Dites-moi ce qui vous semble différent aujourd’hui.",
  de: "Ich bin für Sie da. Sagen Sie mir, was sich heute anders anfühlt.",
  it: "Sono qui con te. Dimmi cosa ti sembra diverso oggi.",
  pt: "Estou aqui consigo. Diga-me o que sente de diferente hoje.",
};

export function drAiFirstMessage(language: string, name = "") {
  const key = language.trim().toLowerCase().split(/[-_]/)[0] || "en";
  const greeting = DR_AI_FIRST_MESSAGES[key] ?? DR_AI_FIRST_MESSAGES.en;
  const safeName = name.trim();
  if (!safeName) return greeting;

  const personalized: Record<string, string> = {
    en: `I'm here with you, ${safeName}. Take your time, and tell me what feels different today.`,
    es: `Estoy aquí contigo, ${safeName}. Tómate tu tiempo y cuéntame qué notas diferente hoy.`,
    fr: `Je suis là avec vous, ${safeName}. Prenez votre temps et dites-moi ce qui vous semble différent aujourd’hui.`,
    de: `Ich bin für Sie da, ${safeName}. Lassen Sie sich Zeit und sagen Sie mir, was sich heute anders anfühlt.`,
    it: `Sono qui con te, ${safeName}. Prenditi il tuo tempo e dimmi cosa ti sembra diverso oggi.`,
    pt: `Estou aqui consigo, ${safeName}. Não tenha pressa e diga-me o que sente de diferente hoje.`,
  };
  return personalized[key] ?? personalized.en;
}

export async function voiceContextHandler(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const domain = resolveVoiceContextDomain(body);
    const memoryQuery = typeof body.memory_query === "string" ? body.memory_query : "";
    const appEntrypoint = typeof body.app_entrypoint === "string" ? body.app_entrypoint : "";
    const conversationId =
      (typeof body.conversation_id === "string" && body.conversation_id.trim()) ||
      (typeof body.session_id === "string" && body.session_id.trim()) ||
      createConversationId();
    const healthMemoryFlag = domain === "health"
      ? resolveHealthMemoryPolicyFlag({
          env: process.env,
          userRef: userId,
          cohortKey: userId,
        })
      : null;
    const dynamicVariables = await buildVoiceContext(userId, domain, memoryQuery, {
      appEntrypoint,
      ...(healthMemoryFlag?.effectiveMode === "pilot"
        ? {
            healthMemoryPolicy: {
              enabled: true,
              flowInstanceId: conversationId,
              env: process.env,
            },
          }
        : {}),
    });
    const feedbackToken = await signVoiceRecommendationFeedbackToolToken(userId, conversationId);
    dynamicVariables.conversation_id = conversationId;
    dynamicVariables.voice_recommendation_feedback_token = feedbackToken;
    void recordShownVoiceRecommendation({
      userId,
      sessionId: conversationId,
      voiceContext: dynamicVariables,
      source: "voice_context",
    }).catch((err) => {
      console.warn("[voice-context] voice recommendation shown feedback unavailable:", err);
    });
    if (isMedicalContextDomain(domain)) {
      const token = await signMedicalProfileToolToken(userId, conversationId);
      const voiceTriageToken = await signVoiceTriageToolToken(userId, conversationId);
      dynamicVariables.conversation_id = conversationId;
      dynamicVariables.context_token = token;
      dynamicVariables.medical_profile_token = token;
      dynamicVariables.voice_triage_tool_token = voiceTriageToken;
      dynamicVariables.secret__voice_triage_tool_token = voiceTriageToken;
      dynamicVariables.language = String(dynamicVariables.preferred_language || "en");
      dynamicVariables.dr_ai_first_message = drAiFirstMessage(
        String(dynamicVariables.language),
        String(dynamicVariables.preferred_name || dynamicVariables.first_name || ""),
      );
    }
    return res.json({ domain, dynamic_variables: dynamicVariables });
  } catch (err) {
    console.error("[voice-context]", err);
    return res.status(500).json({ error: "Failed to build voice context" });
  }
}
