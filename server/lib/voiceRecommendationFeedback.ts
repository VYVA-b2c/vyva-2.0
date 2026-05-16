import { desc, eq } from "drizzle-orm";
import { db, pool } from "../db.js";
import { voiceRecommendationFeedback } from "../../shared/schema.js";

export const VOICE_RECOMMENDATION_ACTIONS = [
  "shown",
  "accepted",
  "dismissed",
  "completed",
] as const;

export type VoiceRecommendationAction = typeof VOICE_RECOMMENDATION_ACTIONS[number];
export type VoiceRecommendationFeedbackRow = typeof voiceRecommendationFeedback.$inferSelect;

export type VoiceRecommendationFeedbackStats = {
  shown: number;
  accepted: number;
  dismissed: number;
  completed: number;
  latestAction: string;
  latestAt: Date | null;
};

export type VoiceRecommendationFeedbackSummary = {
  byRecommendationId: Map<string, VoiceRecommendationFeedbackStats>;
  domainAffinity: Map<string, number>;
  promptBlock: string;
};

type RecordVoiceRecommendationFeedbackInput = {
  userId: string;
  sessionId?: string | null;
  recommendationId: string;
  action: VoiceRecommendationAction;
  domain?: string | null;
  title?: string | null;
  reason?: string | null;
  source?: string;
  metadata?: Record<string, unknown>;
};

type VoiceContextLike = Record<string, unknown>;

let ensureFeedbackTablePromise: Promise<void> | null = null;

function trimTo(value: string | null | undefined, maxLength: number) {
  return value?.trim().slice(0, maxLength) || null;
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isVoiceRecommendationAction(value: unknown): value is VoiceRecommendationAction {
  return typeof value === "string" && VOICE_RECOMMENDATION_ACTIONS.includes(value as VoiceRecommendationAction);
}

export async function ensureVoiceRecommendationFeedbackTable(): Promise<void> {
  ensureFeedbackTablePromise ??= (async () => {
    await pool.query(`
      create table if not exists voice_recommendation_feedback (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        session_id text,
        recommendation_id text not null,
        action text not null,
        domain text,
        title text,
        reason text,
        source text not null default 'voice',
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `);
    await pool.query(`
      create index if not exists voice_recommendation_feedback_user_created_idx
      on voice_recommendation_feedback (user_id, created_at desc)
    `);
    await pool.query(`
      create index if not exists voice_recommendation_feedback_user_recommendation_idx
      on voice_recommendation_feedback (user_id, recommendation_id, created_at desc)
    `);
  })().catch((err) => {
    ensureFeedbackTablePromise = null;
    throw err;
  });

  return ensureFeedbackTablePromise;
}

export async function getVoiceRecommendationFeedbackRows(userId: string, limit = 120) {
  try {
    return await db
      .select()
      .from(voiceRecommendationFeedback)
      .where(eq(voiceRecommendationFeedback.user_id, userId))
      .orderBy(desc(voiceRecommendationFeedback.created_at))
      .limit(limit);
  } catch {
    return [];
  }
}

export function buildVoiceRecommendationFeedbackSummary(
  rows: VoiceRecommendationFeedbackRow[],
): VoiceRecommendationFeedbackSummary {
  const byRecommendationId = new Map<string, VoiceRecommendationFeedbackStats>();
  const domainAffinity = new Map<string, number>();

  for (const row of rows) {
    const stats = byRecommendationId.get(row.recommendation_id) ?? {
      shown: 0,
      accepted: 0,
      dismissed: 0,
      completed: 0,
      latestAction: "",
      latestAt: null,
    };

    if (!stats.latestAt || row.created_at > stats.latestAt) {
      stats.latestAction = row.action;
      stats.latestAt = row.created_at;
    }
    if (row.action === "shown") stats.shown += 1;
    if (row.action === "accepted") stats.accepted += 1;
    if (row.action === "dismissed") stats.dismissed += 1;
    if (row.action === "completed") stats.completed += 1;
    byRecommendationId.set(row.recommendation_id, stats);

    if (row.domain) {
      const current = domainAffinity.get(row.domain) ?? 0;
      const delta =
        row.action === "completed" ? 4 :
        row.action === "accepted" ? 3 :
        row.action === "dismissed" ? -3 :
        row.action === "shown" ? -0.5 :
        0;
      domainAffinity.set(row.domain, current + delta);
    }
  }

  const strongestDomains = Array.from(domainAffinity.entries())
    .filter(([, score]) => Math.abs(score) >= 1)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 4)
    .map(([domain, score]) => `${domain} ${score > 0 ? "favoured" : "cooled"} (${score.toFixed(1)})`);

  const recentlyDismissed = rows
    .filter((row) => row.action === "dismissed")
    .slice(0, 3)
    .map((row) => row.title || row.recommendation_id);

  const promptBlock = [
    strongestDomains.length ? `User response pattern: ${strongestDomains.join(", ")}.` : "",
    recentlyDismissed.length ? `Avoid repeating recently dismissed openings: ${recentlyDismissed.join(", ")}.` : "",
  ].filter(Boolean).join("\n");

  return { byRecommendationId, domainAffinity, promptBlock };
}

export function recommendationFeedbackScoreAdjustment(
  feedback: VoiceRecommendationFeedbackSummary,
  recommendationId: string,
  domain: string,
) {
  const stats = feedback.byRecommendationId.get(recommendationId);
  const domainAdjustment = Math.max(-8, Math.min(8, feedback.domainAffinity.get(domain) ?? 0));
  if (!stats) return domainAdjustment;

  const positiveAdjustment = (stats.accepted * 8) + (stats.completed * 12);
  const passiveRepeatPenalty = Math.min(8, Math.max(0, stats.shown - stats.accepted - stats.completed) * 2);
  const dismissPenalty = stats.dismissed * 12 + (stats.latestAction === "dismissed" ? 10 : 0);
  return Math.max(-30, Math.min(24, positiveAdjustment - passiveRepeatPenalty - dismissPenalty + domainAdjustment));
}

export async function recordVoiceRecommendationFeedback(input: RecordVoiceRecommendationFeedbackInput) {
  if (!input.userId || !input.recommendationId || !isVoiceRecommendationAction(input.action)) return;
  await ensureVoiceRecommendationFeedbackTable();
  await db.insert(voiceRecommendationFeedback).values({
    user_id: input.userId,
    session_id: trimTo(input.sessionId ?? null, 160),
    recommendation_id: trimTo(input.recommendationId, 180) ?? input.recommendationId.slice(0, 180),
    action: input.action,
    domain: trimTo(input.domain ?? null, 80),
    title: trimTo(input.title ?? null, 240),
    reason: trimTo(input.reason ?? null, 700),
    source: trimTo(input.source ?? "voice", 80) ?? "voice",
    metadata: input.metadata ?? {},
  });
}

export function recordShownVoiceRecommendation(input: {
  userId: string;
  sessionId?: string | null;
  voiceContext: VoiceContextLike;
  source?: string;
}) {
  const recommendationId = stringValue(input.voiceContext.next_best_conversation_id);
  if (!recommendationId) return Promise.resolve();

  return recordVoiceRecommendationFeedback({
    userId: input.userId,
    sessionId: input.sessionId,
    recommendationId,
    action: "shown",
    domain: stringValue(input.voiceContext.next_best_conversation_domain),
    title: stringValue(input.voiceContext.next_best_conversation_title),
    reason: stringValue(input.voiceContext.next_best_conversation_reason),
    source: input.source ?? "voice",
    metadata: {
      priority: stringValue(input.voiceContext.next_best_conversation_priority),
      score: stringValue(input.voiceContext.next_best_conversation_score),
      app_entrypoint: stringValue(input.voiceContext.app_entrypoint),
    },
  });
}

export async function getLatestShownVoiceRecommendation(userId: string, sessionId?: string | null) {
  const rows = await getVoiceRecommendationFeedbackRows(userId, 30);
  const now = Date.now();
  return rows.find((row) => {
    if (row.action !== "shown") return false;
    if (sessionId && row.session_id && row.session_id !== sessionId) return false;
    return now - row.created_at.getTime() <= 30 * 60 * 1000;
  }) ?? null;
}

export function inferVoiceRecommendationResponseAction(input: {
  utterance: string;
  routedDomain: string;
  latestShown: VoiceRecommendationFeedbackRow | null;
}): VoiceRecommendationAction | null {
  if (!input.latestShown) return null;
  const normalized = input.utterance.trim().toLowerCase();
  if (!normalized || normalized === "app_open" || normalized === "home_open") return null;

  if (/^(no|no thanks|not now|later|skip|cancel)\b/.test(normalized) || /\b(not now|leave it|skip it)\b/.test(normalized)) {
    return "dismissed";
  }
  if (/^(yes|yeah|yep|sure|ok|okay|please|go ahead|sounds good|let's|lets)\b/.test(normalized)) {
    return "accepted";
  }
  if (input.latestShown.domain && input.latestShown.domain !== "companion" && input.latestShown.domain === input.routedDomain) {
    return "accepted";
  }

  return null;
}
