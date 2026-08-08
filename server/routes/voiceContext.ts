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
  if (agentSlug === "health" || agentSlug === "health-assistant") return "health";
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
      dynamicVariables.language = String(dynamicVariables.preferred_language || "en");
    }
    return res.json({ domain, dynamic_variables: dynamicVariables });
  } catch (err) {
    console.error("[voice-context]", err);
    return res.status(500).json({ error: "Failed to build voice context" });
  }
}
