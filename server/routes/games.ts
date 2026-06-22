import { Router, type Request, type Response } from "express";
import OpenAI from "openai";
import { z } from "zod";
import { buildBrainCoachCaregiverSummary } from "../lib/brainCoachCaregiverSummary.js";
import { mergeCaregiverSettingsIntoPreferences } from "../lib/brainCoachCaregiverSettings.js";
import { buildBrainCoachDailyPlan, extractBrainCoachPreferences } from "../lib/brainCoachPlan.js";
import {
  applyPlanItemEvent,
  buildBrainCoachPlanRows,
  buildPersistedBrainCoachPlan,
  completionSyncForPlan,
  type BrainCoachPlanEventType,
  type StoredBrainCoachPlan,
  type StoredBrainCoachPlanItem,
} from "../lib/brainCoachPlanLifecycle.js";

const OPENAI_MODEL = "gpt-4o-mini";
const ELEVENLABS_TTS_MODEL = "eleven_multilingual_v2";
const SCORE_RETELL_TIMEOUT_MS = 10000;
const GAME_LANGUAGES = ["es", "en", "fr", "de", "it", "pt"] as const;
type GameLanguage = (typeof GAME_LANGUAGES)[number];

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

const languageInstructions: Record<GameLanguage, string> = {
  es: "The story and retell are in Spanish.",
  en: "The story and retell are in English.",
  fr: "The story and retell are in French.",
  de: "The story and retell are in German.",
  it: "The story and retell are in Italian.",
  pt: "The story and retell are in Portuguese.",
};

const retellSchema = z.object({
  retellText: z.string().trim().max(5000),
  keyFacts: z.array(z.string().trim().min(1).max(500)).min(1).max(20),
  language: z.string().optional(),
});

const ttsSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  language: z.string().optional(),
});

const MEMORY_ACTIVITY_TYPES = [
  "memory_match",
  "sequence_memory",
  "word_recall",
  "remember_later",
  "number_memory",
  "routine_memory",
  "association_memory",
  "story_recall",
] as const;

const cognitiveSessionWriteSchema = z.object({
  activityType: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(1).max(80),
  secondaryDomain: z.string().trim().min(1).max(80).nullable().optional(),
  difficulty: z.number().int().min(1).max(100).optional().default(1),
  difficultyScale: z.string().trim().min(1).max(40).optional().default("level"),
  completed: z.boolean().optional().default(false),
  abandoned: z.boolean().optional().default(false),
  score: z.number().int().min(0).max(1000000).optional().default(0),
  accuracyPct: z.number().min(0).max(100).nullable().optional(),
  speedPct: z.number().min(0).max(100).nullable().optional(),
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60).optional().default(0),
  playedAt: z.string().optional(),
  language: z.string().trim().min(2).max(12).optional().default("es"),
  source: z.string().trim().min(1).max(80).optional().default("app"),
  sourceTable: z.string().trim().min(1).max(80).nullable().optional(),
  sourceSessionId: z.string().trim().min(1).max(120).nullable().optional(),
  clientResultId: z.string().trim().min(1).max(160).nullable().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const dailyPlanEventSchema = z.object({
  planId: z.string().uuid(),
  planItemId: z.string().uuid().optional(),
  activityType: z.string().trim().min(1).max(80).optional(),
  nudgeEventId: z.string().trim().min(1).max(120).optional(),
  eventType: z.enum(["accepted", "started", "skipped", "caregiver_nudge_read", "caregiver_nudge_dismissed"]),
  source: z.string().trim().min(1).max(80).optional().default("app"),
  metadata: z.record(z.unknown()).optional().default({}),
}).superRefine((value, ctx) => {
  if (isCaregiverNudgeVisibilityEvent(value.eventType)) {
    if (!value.nudgeEventId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "nudgeEventId is required.",
        path: ["nudgeEventId"],
      });
    }
    return;
  }

  if (!value.planItemId && !value.activityType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "planItemId or activityType is required.",
      path: ["planItemId"],
    });
  }
});

function isCaregiverNudgeVisibilityEvent(eventType: string): eventType is Extract<BrainCoachPlanEventType, "caregiver_nudge_read" | "caregiver_nudge_dismissed"> {
  return eventType === "caregiver_nudge_read" || eventType === "caregiver_nudge_dismissed";
}

function normalizeGameLanguage(language: unknown): GameLanguage {
  return GAME_LANGUAGES.includes(language as GameLanguage) ? (language as GameLanguage) : "es";
}

function coerceDate(value: unknown, fallback = new Date()): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function toIsoDate(value: unknown): string | null {
  const date = coerceDate(value, new Date(Number.NaN));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function utcDayKeyFromStart(dayStart: number): string {
  return new Date(dayStart).toISOString().slice(0, 10);
}

function utcDayKey(value: unknown): string | null {
  const date = coerceDate(value, new Date(Number.NaN));
  return Number.isNaN(date.getTime()) ? null : utcDayKeyFromStart(utcDayStart(date));
}

type BrainCoachSessionLike = {
  id?: string;
  userId?: string;
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  difficulty?: number | string | null;
  difficultyScale?: string | null;
  completed?: boolean | null;
  abandoned?: boolean | null;
  score?: number | string | null;
  accuracyPct?: number | string | null;
  speedPct?: number | string | null;
  durationSeconds?: number | string | null;
  playedAt?: Date | string | null;
  language?: string | null;
  source?: string | null;
  sourceTable?: string | null;
  sourceSessionId?: string | null;
  clientResultId?: string | null;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

function normalizeProgressSession(row: BrainCoachSessionLike) {
  return {
    id: row.id ?? null,
    userId: row.userId ?? null,
    activityType: row.activityType,
    domain: row.domain,
    secondaryDomain: row.secondaryDomain ?? null,
    difficulty: Math.max(1, Math.round(toNumber(row.difficulty, 1))),
    difficultyScale: row.difficultyScale ?? "level",
    completed: Boolean(row.completed),
    abandoned: Boolean(row.abandoned),
    score: Math.max(0, Math.round(toNumber(row.score, 0))),
    accuracyPct: toNullableNumber(row.accuracyPct),
    speedPct: toNullableNumber(row.speedPct),
    durationSeconds: Math.max(0, Math.round(toNumber(row.durationSeconds, 0))),
    playedAt: toIsoDate(row.playedAt) ?? new Date().toISOString(),
    language: row.language ?? "es",
    source: row.source ?? "app",
    sourceTable: row.sourceTable ?? null,
    sourceSessionId: row.sourceSessionId ?? null,
    clientResultId: row.clientResultId ?? null,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: toIsoDate(row.createdAt),
  };
}

export function calculateBrainCoachStreak(sessions: BrainCoachSessionLike[], now = new Date()): number {
  const completedDays = new Set(
    sessions
      .filter((session) => session.completed)
      .map((session) => utcDayKey(session.playedAt))
      .filter((key): key is string => Boolean(key)),
  );
  if (completedDays.size === 0) return 0;

  const todayStart = utcDayStart(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  let cursor = completedDays.has(utcDayKeyFromStart(todayStart))
    ? todayStart
    : completedDays.has(utcDayKeyFromStart(yesterdayStart))
      ? yesterdayStart
      : null;

  if (cursor === null) return 0;

  let streak = 0;
  while (completedDays.has(utcDayKeyFromStart(cursor))) {
    streak += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }

  return streak;
}

export function calculateBestBrainCoachStreak(sessions: BrainCoachSessionLike[]): number {
  const completedDayStarts = [
    ...new Set(
      sessions
        .filter((session) => session.completed)
        .map((session) => {
          const date = coerceDate(session.playedAt, new Date(Number.NaN));
          return Number.isNaN(date.getTime()) ? null : utcDayStart(date);
        })
        .filter((day): day is number => day !== null),
    ),
  ].sort((a, b) => a - b);

  let best = 0;
  let current = 0;
  let previous: number | null = null;

  completedDayStarts.forEach((dayStart) => {
    current = previous !== null && dayStart === previous + 24 * 60 * 60 * 1000 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = dayStart;
  });

  return best;
}

function summariseGroup(sessions: ReturnType<typeof normalizeProgressSession>[], key: "domain" | "activityType") {
  const groups = new Map<string, {
    key: string;
    totalSessions: number;
    completedSessions: number;
    bestScore: number;
    totalDurationSeconds: number;
    lastPlayedAt: string | null;
  }>();

  sessions.forEach((session) => {
    const groupKey = session[key];
    const existing = groups.get(groupKey) ?? {
      key: groupKey,
      totalSessions: 0,
      completedSessions: 0,
      bestScore: 0,
      totalDurationSeconds: 0,
      lastPlayedAt: null,
    };
    existing.totalSessions += 1;
    existing.completedSessions += session.completed ? 1 : 0;
    existing.bestScore = Math.max(existing.bestScore, session.score);
    existing.totalDurationSeconds += session.durationSeconds;
    existing.lastPlayedAt = !existing.lastPlayedAt || session.playedAt > existing.lastPlayedAt
      ? session.playedAt
      : existing.lastPlayedAt;
    groups.set(groupKey, existing);
  });

  return [...groups.values()].sort((a, b) => {
    if (b.completedSessions !== a.completedSessions) return b.completedSessions - a.completedSessions;
    return (b.lastPlayedAt ?? "").localeCompare(a.lastPlayedAt ?? "");
  });
}

export function buildBrainCoachProgress(sessions: BrainCoachSessionLike[], now = new Date()) {
  const normalized = sessions
    .map(normalizeProgressSession)
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
  const completed = normalized.filter((session) => session.completed);
  const todayKey = utcDayKey(now);
  const todayCompleted = completed.filter((session) => utcDayKey(session.playedAt) === todayKey);

  return {
    summary: {
      totalSessions: normalized.length,
      completedSessions: completed.length,
      streakDays: calculateBrainCoachStreak(normalized, now),
      bestStreakDays: calculateBestBrainCoachStreak(normalized),
      lastPlayedAt: normalized[0]?.playedAt ?? null,
      totalDurationSeconds: normalized.reduce((total, session) => total + session.durationSeconds, 0),
    },
    today: {
      completedCount: todayCompleted.length,
      activityTypes: [...new Set(todayCompleted.map((session) => session.activityType))],
      domains: [...new Set(todayCompleted.map((session) => session.domain))],
    },
    domains: summariseGroup(normalized, "domain").map(({ key, ...rest }) => ({ domain: key, ...rest })),
    activities: summariseGroup(normalized, "activityType").map(({ key, ...rest }) => ({ activityType: key, ...rest })),
    history: normalized.slice(0, 25),
  };
}

function fallbackRetellScore(keyFacts: string[], error: string): RetellScore {
  return {
    covered: [],
    not_covered: Array.from({ length: keyFacts.length }, (_, index) => index + 1),
    covered_count: 0,
    total_count: keyFacts.length,
    error,
  };
}

function normalizeIndexList(value: unknown, total: number): number[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<number>();

  value.forEach((entry) => {
    const index = Number(entry);
    if (Number.isInteger(index) && index >= 1 && index <= total) {
      unique.add(index);
    }
  });

  return [...unique].sort((a, b) => a - b);
}

function normalizeRetellScore(value: unknown, total: number): RetellScore {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const covered = normalizeIndexList(raw.covered, total);
  const notCoveredFromModel = normalizeIndexList(raw.not_covered, total).filter((index) => !covered.includes(index));
  const not_covered = notCoveredFromModel.length > 0
    ? notCoveredFromModel
    : Array.from({ length: total }, (_, index) => index + 1).filter((index) => !covered.includes(index));

  return {
    covered,
    not_covered,
    covered_count: covered.length,
    total_count: total,
    error: null,
  };
}

function buildRetellPrompt(retellText: string, keyFacts: string[], language: GameLanguage) {
  return `You are scoring a memory recall exercise for a senior adult.
${languageInstructions[language]}
The user read a short story and is now retelling it from memory.

Key facts from the story (${keyFacts.length} total):
${keyFacts.map((fact, index) => `${index + 1}. ${fact}`).join("\n")}

User's retell:
"${retellText}"

For each key fact, determine if the user's retell covers that fact,
even if expressed differently, partially, or in different words.
Be generous: if the core idea is present, count it as covered.

Respond only with a valid JSON object:
{
  "covered": [1, 3, 4],
  "not_covered": [2, 5, 6],
  "covered_count": 3,
  "total_count": 6
}`;
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

function getRetellScoringErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "AbortError") {
    return "OpenAI scoring timed out.";
  }
  return error instanceof Error ? error.message : "OpenAI scoring failed.";
}

function logRetellScoringFallback(reason: string, message: string) {
  console.warn("[games] Retell scoring fallback", {
    reason,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
    model: OPENAI_MODEL,
    message,
  });
}

export async function scoreRetellHandler(req: Request, res: Response) {
  const parsed = retellSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid retell scoring request." });
  }

  const { retellText, keyFacts } = parsed.data;
  const language = normalizeGameLanguage(parsed.data.language);
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) {
    const message = "OpenAI API key is not configured.";
    logRetellScoringFallback("missing_key", message);
    return res.json(fallbackRetellScore(keyFacts, message));
  }

  try {
    const client = new OpenAI({ apiKey });
    const timeout = createTimeoutSignal(SCORE_RETELL_TIMEOUT_MS);
    const completion = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 250,
        messages: [{ role: "user", content: buildRetellPrompt(retellText, keyFacts, language) }],
      },
      { signal: timeout.signal },
    ).finally(timeout.clear);

    const content = completion.choices[0]?.message?.content ?? "{}";
    return res.json(normalizeRetellScore(JSON.parse(content), keyFacts.length));
  } catch (error) {
    const message = getRetellScoringErrorMessage(error);
    logRetellScoringFallback(message.includes("timed out") ? "timeout" : "openai_error", message);
    return res.json(fallbackRetellScore(keyFacts, message));
  }
}

export async function ttsHandler(req: Request, res: Response) {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid TTS request." });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY ?? "";
  const voiceId = process.env.ELEVENLABS_BRAIN_TTS_VOICE_ID ?? process.env.ELEVENLABS_VOICE_ID ?? "";
  if (!apiKey || !voiceId) {
    return res.status(503).json({ error: "ElevenLabs TTS is not configured." });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: parsed.data.text,
          model_id: ELEVENLABS_TTS_MODEL,
          voice_settings: {
            stability: 0.6,
            similarity_boost: 0.8,
            style: 0.2,
            use_speaker_boost: true,
          },
          language_code: normalizeGameLanguage(parsed.data.language),
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn("[games] ElevenLabs TTS failed:", detail);
      return res.status(502).json({ error: "ElevenLabs TTS request failed." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", response.headers.get("content-type") ?? "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(audio);
  } catch (error) {
    console.error("[games] ElevenLabs TTS error:", error);
    return res.status(502).json({ error: "ElevenLabs TTS request failed." });
  }
}

function queryNumber(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function queryLimit(value: unknown, fallback: number, max: number): number {
  const numeric = queryNumber(value);
  if (numeric === null) return fallback;
  return Math.min(max, Math.max(1, Math.round(numeric)));
}

async function loadCognitiveSessionDb() {
  const [
    { db },
    {
      cognitiveSessionIndex,
      profiles,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      cognitiveCaregiverSettings,
    },
    { and, asc, desc, eq, gte, inArray },
  ] = await Promise.all([
    import("../db.js"),
    import("../../shared/schema.js"),
    import("drizzle-orm"),
  ]);
  return {
    db,
    cognitiveSessionIndex,
    profiles,
    cognitiveDailyPlans,
    cognitiveDailyPlanItems,
    cognitiveDailyPlanEvents,
    cognitiveCaregiverSettings,
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
  };
}

type CognitiveSessionDb = Awaited<ReturnType<typeof loadCognitiveSessionDb>>;

function storedPlan(row: unknown): StoredBrainCoachPlan {
  return row as StoredBrainCoachPlan;
}

function storedItems(rows: unknown[]): StoredBrainCoachPlanItem[] {
  return rows as StoredBrainCoachPlanItem[];
}

function recordValue(row: unknown, key: string): unknown {
  return row && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function latestCaregiverNudge(events: unknown[], planId: string) {
  const event = events
    .filter((row) => (
      recordValue(row, "planId") === planId &&
      recordValue(row, "eventType") === "caregiver_nudge"
    ))
    .sort((left, right) => {
      const leftTime = coerceDate(recordValue(left, "createdAt"), new Date(0)).getTime();
      const rightTime = coerceDate(recordValue(right, "createdAt"), new Date(0)).getTime();
      return rightTime - leftTime;
    })[0];
  if (!event) return null;

  const metadata = recordValue(event, "metadata");
  const metadataRecord = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown>
    : {};
  const title = stringValue(metadataRecord.title);
  const body = stringValue(metadataRecord.body);
  if (!title || !body) return null;

  const nudgeId = stringValue(recordValue(event, "id"));
  const visibilityEvents = events
    .filter((row) => {
      const rowMetadata = recordValue(row, "metadata");
      const rowMetadataRecord = rowMetadata && typeof rowMetadata === "object"
        ? rowMetadata as Record<string, unknown>
        : {};
      return (
        recordValue(row, "planId") === planId &&
        nudgeId !== null &&
        stringValue(rowMetadataRecord.nudge_event_id) === nudgeId &&
        (
          recordValue(row, "eventType") === "caregiver_nudge_read" ||
          recordValue(row, "eventType") === "caregiver_nudge_dismissed"
        )
      );
    })
    .sort((left, right) => {
      const leftTime = coerceDate(recordValue(left, "createdAt"), new Date(0)).getTime();
      const rightTime = coerceDate(recordValue(right, "createdAt"), new Date(0)).getTime();
      return rightTime - leftTime;
    });

  const readEvent = visibilityEvents.find((row) => recordValue(row, "eventType") === "caregiver_nudge_read");
  const dismissedEvent = visibilityEvents.find((row) => recordValue(row, "eventType") === "caregiver_nudge_dismissed");
  const status = dismissedEvent ? "dismissed" : readEvent ? "read" : "unread";

  return {
    id: nudgeId,
    planId,
    messageType: stringValue(metadataRecord.message_type) ?? "today_plan",
    title,
    body,
    sentAt: toIsoDate(recordValue(event, "createdAt")) ?? stringValue(metadataRecord.sent_at),
    sentBy: stringValue(metadataRecord.sent_by),
    status,
    isUnread: status === "unread",
    readAt: toIsoDate(recordValue(readEvent, "createdAt")),
    dismissedAt: toIsoDate(recordValue(dismissedEvent, "createdAt")),
  };
}

async function selectPlanItems(ctx: CognitiveSessionDb, planId: string) {
  const { db, cognitiveDailyPlanItems, asc, eq } = ctx;
  return db
    .select()
    .from(cognitiveDailyPlanItems)
    .where(eq(cognitiveDailyPlanItems.planId, planId))
    .orderBy(asc(cognitiveDailyPlanItems.sortOrder));
}

async function updatePlanCompletionStatus(ctx: CognitiveSessionDb, plan: StoredBrainCoachPlan, items: StoredBrainCoachPlanItem[]) {
  const { db, cognitiveDailyPlans, eq } = ctx;
  const allComplete = items.length > 0 && items.every((item) => item.status === "completed" || Boolean(item.completedAt));
  if (allComplete && plan.status !== "completed") {
    const completedAt = new Date();
    const [updated] = await db
      .update(cognitiveDailyPlans)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(eq(cognitiveDailyPlans.id, plan.id))
      .returning();
    return storedPlan(updated);
  }
  return plan;
}

async function syncPersistedPlanCompletion(
  ctx: CognitiveSessionDb,
  planRow: unknown,
  itemRows: unknown[],
  sessions: BrainCoachSessionLike[],
) {
  const { db, cognitiveDailyPlanItems, cognitiveDailyPlanEvents, and, eq } = ctx;
  let plan = storedPlan(planRow);
  let items = storedItems(itemRows);
  const sync = completionSyncForPlan({
    planDate: plan.planDate,
    items,
    sessions,
  });

  for (const item of items) {
    if (!sync.completedActivityTypes.includes(item.activityType)) continue;
    if (item.status === "completed" || item.completedAt) continue;
    const completedAt = new Date();
    await db
      .update(cognitiveDailyPlanItems)
      .set({ status: "completed", completedAt, updatedAt: completedAt })
      .where(and(
        eq(cognitiveDailyPlanItems.id, item.id),
        eq(cognitiveDailyPlanItems.userId, plan.userId),
      ));
    await db.insert(cognitiveDailyPlanEvents).values({
      planId: plan.id,
      planItemId: item.id,
      userId: plan.userId,
      activityType: item.activityType,
      eventType: "completed" satisfies BrainCoachPlanEventType,
      source: "cognitive_session_index",
      metadata: { plan_date: plan.planDate },
    });
  }

  items = storedItems(await selectPlanItems(ctx, plan.id));
  plan = await updatePlanCompletionStatus(ctx, plan, items);
  return buildPersistedBrainCoachPlan(plan, items);
}

async function syncSessionToDailyPlan(ctx: CognitiveSessionDb, userId: string, session: BrainCoachSessionLike) {
  if (!session.completed) return;
  const planDate = utcDayKey(session.playedAt);
  if (!planDate) return;

  const { db, cognitiveDailyPlans, and, eq } = ctx;
  const [plan] = await db
    .select()
    .from(cognitiveDailyPlans)
    .where(and(
      eq(cognitiveDailyPlans.userId, userId),
      eq(cognitiveDailyPlans.planDate, planDate),
    ))
    .limit(1);
  if (!plan) return;

  const items = await selectPlanItems(ctx, plan.id);
  await syncPersistedPlanCompletion(ctx, plan, items, [session]);
}

export async function createCognitiveSessionHandler(req: Request, res: Response) {
  const parsed = cognitiveSessionWriteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid cognitive session request." });
  }

  const data = parsed.data;

  try {
    const ctx = await loadCognitiveSessionDb();
    const { db, cognitiveSessionIndex, and, eq } = ctx;

    if (data.clientResultId) {
      const [existing] = await db
        .select()
        .from(cognitiveSessionIndex)
        .where(and(
          eq(cognitiveSessionIndex.userId, req.user!.id),
          eq(cognitiveSessionIndex.clientResultId, data.clientResultId),
        ))
        .limit(1);

      if (existing) {
        return res.json({ session: normalizeProgressSession(existing) });
      }
    }

    const [session] = await db
      .insert(cognitiveSessionIndex)
      .values({
        userId: req.user!.id,
        activityType: data.activityType,
        domain: data.domain,
        secondaryDomain: data.secondaryDomain ?? null,
        difficulty: data.difficulty,
        difficultyScale: data.difficultyScale,
        completed: data.completed,
        abandoned: data.abandoned,
        score: data.score,
        accuracyPct: data.accuracyPct ?? null,
        speedPct: data.speedPct ?? null,
        durationSeconds: data.durationSeconds,
        playedAt: coerceDate(data.playedAt),
        language: data.language,
        source: data.source,
        sourceTable: data.sourceTable ?? null,
        sourceSessionId: data.sourceSessionId ?? null,
        clientResultId: data.clientResultId ?? null,
        metadata: data.metadata,
      })
      .returning();

    await syncSessionToDailyPlan(ctx, req.user!.id, session).catch((error) => {
      console.warn("[games] Daily Brain Coach plan completion sync failed:", error);
    });

    return res.status(201).json({ session: normalizeProgressSession(session) });
  } catch (error) {
    console.error("[games] Cognitive session create failed:", error);
    return res.status(500).json({ error: "Cognitive session could not be saved." });
  }
}

export async function cognitiveSessionHistoryHandler(req: Request, res: Response) {
  const limit = queryLimit(req.query.limit, 100, 500);
  const days = queryNumber(req.query.days);
  const family = typeof req.query.family === "string" ? req.query.family : null;

  try {
    const { db, cognitiveSessionIndex, and, desc, eq, gte, inArray } = await loadCognitiveSessionDb();
    const conditions = [eq(cognitiveSessionIndex.userId, req.user!.id)];
    if (days !== null && days > 0) {
      conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));
    }
    if (family === "memory") {
      conditions.push(inArray(cognitiveSessionIndex.activityType, [...MEMORY_ACTIVITY_TYPES]));
    }

    const rows = await db
      .select()
      .from(cognitiveSessionIndex)
      .where(and(...conditions))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(limit);

    return res.json({ sessions: rows.map(normalizeProgressSession) });
  } catch (error) {
    console.error("[games] Cognitive session history failed:", error);
    return res.status(500).json({ error: "Cognitive session history could not be loaded." });
  }
}

export async function brainCoachProgressHandler(req: Request, res: Response) {
  const limit = queryLimit(req.query.limit, 500, 1000);
  const days = queryNumber(req.query.days);

  try {
    const { db, cognitiveSessionIndex, and, desc, eq, gte } = await loadCognitiveSessionDb();
    const conditions = [eq(cognitiveSessionIndex.userId, req.user!.id)];
    if (days !== null && days > 0) {
      conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - days * 24 * 60 * 60 * 1000)));
    }

    const rows = await db
      .select()
      .from(cognitiveSessionIndex)
      .where(and(...conditions))
      .orderBy(desc(cognitiveSessionIndex.playedAt))
      .limit(limit);

    return res.json(buildBrainCoachProgress(rows));
  } catch (error) {
    console.error("[games] Brain Coach progress failed:", error);
    return res.status(500).json({ error: "Brain Coach progress could not be loaded." });
  }
}

export async function loadBrainCoachProgressForUser(userId: string, options: { limit?: number; days?: number } = {}) {
  const { db, cognitiveSessionIndex, and, desc, eq, gte } = await loadCognitiveSessionDb();
  const conditions = [eq(cognitiveSessionIndex.userId, userId)];
  if (typeof options.days === "number" && options.days > 0) {
    conditions.push(gte(cognitiveSessionIndex.playedAt, new Date(Date.now() - options.days * 24 * 60 * 60 * 1000)));
  }

  const rows = await db
    .select()
    .from(cognitiveSessionIndex)
    .where(and(...conditions))
    .orderBy(desc(cognitiveSessionIndex.playedAt))
    .limit(options.limit ?? 500);

  return buildBrainCoachProgress(rows);
}

export async function brainCoachDailyPlanHandler(req: Request, res: Response) {
  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveSessionIndex,
      profiles,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      cognitiveCaregiverSettings,
      desc,
      eq,
      and,
      gte,
    } = ctx;
    const trendWindowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rows, planEvents] = await Promise.all([
      db
        .select()
        .from(cognitiveSessionIndex)
        .where(eq(cognitiveSessionIndex.userId, req.user!.id))
        .orderBy(desc(cognitiveSessionIndex.playedAt))
        .limit(300),
      db
        .select()
        .from(cognitiveDailyPlanEvents)
        .where(and(
          eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          gte(cognitiveDailyPlanEvents.createdAt, trendWindowStart),
        ))
        .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
        .limit(200),
    ]);

    const [[profile], [caregiverSettings]] = await Promise.all([
      db
        .select({
          dataSharingConsent: profiles.data_sharing_consent,
        })
        .from(profiles)
        .where(eq(profiles.id, req.user!.id))
        .limit(1),
      db
        .select()
        .from(cognitiveCaregiverSettings)
        .where(eq(cognitiveCaregiverSettings.userId, req.user!.id))
        .limit(1),
    ]);

    const preferences = mergeCaregiverSettingsIntoPreferences(
      extractBrainCoachPreferences(profile?.dataSharingConsent),
      caregiverSettings,
    );
    const progress = buildBrainCoachProgress(rows);
    const generatedPlan = buildBrainCoachDailyPlan({
      sessions: rows,
      events: planEvents,
      preferences,
      streakDays: progress.summary.streakDays,
    });
    const planDate = generatedPlan.planDate;

    let [plan] = await db
      .select()
      .from(cognitiveDailyPlans)
      .where(and(
        eq(cognitiveDailyPlans.userId, req.user!.id),
        eq(cognitiveDailyPlans.planDate, planDate),
      ))
      .limit(1);

    if (!plan) {
      const built = buildBrainCoachPlanRows({
        userId: req.user!.id,
        generatedPlan,
        sourceContext: {
          total_sessions: progress.summary.totalSessions,
          completed_sessions: progress.summary.completedSessions,
          streak_days: progress.summary.streakDays,
          training_time: preferences.trainingTime ?? null,
          session_length_mins: preferences.sessionLengthMins ?? null,
        },
      });
      [plan] = await db
        .insert(cognitiveDailyPlans)
        .values(built.plan)
        .returning();

      if (built.items.length > 0) {
        await db.insert(cognitiveDailyPlanItems).values(
          built.items.map((item) => ({
            ...item,
            planId: plan.id,
          })),
        );
      }
    }

    const items = await selectPlanItems(ctx, plan.id);
    const persistedPlan = await syncPersistedPlanCompletion(ctx, plan, items, rows);

    return res.json({
      ...persistedPlan,
      caregiverNudge: latestCaregiverNudge(planEvents, plan.id),
    });
  } catch (error) {
    console.error("[games] Brain Coach daily plan failed:", error);
    return res.status(500).json({ error: "Brain Coach daily plan could not be loaded." });
  }
}

export async function brainCoachDailyPlanEventHandler(req: Request, res: Response) {
  const parsed = dailyPlanEventSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Brain Coach plan event request." });
  }

  const data = parsed.data;

  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      cognitiveDailyPlanEvents,
      and,
      desc,
      eq,
    } = ctx;
    const [plan] = await db
      .select()
      .from(cognitiveDailyPlans)
      .where(and(
        eq(cognitiveDailyPlans.id, data.planId),
        eq(cognitiveDailyPlans.userId, req.user!.id),
      ))
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: "Brain Coach plan not found." });
    }

    if (isCaregiverNudgeVisibilityEvent(data.eventType)) {
      const [nudgeEvent] = await db
        .select()
        .from(cognitiveDailyPlanEvents)
        .where(and(
          eq(cognitiveDailyPlanEvents.id, data.nudgeEventId!),
          eq(cognitiveDailyPlanEvents.planId, plan.id),
          eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          eq(cognitiveDailyPlanEvents.eventType, "caregiver_nudge"),
        ))
        .limit(1);

      if (!nudgeEvent) {
        return res.status(404).json({ error: "Brain Coach caregiver nudge not found." });
      }

      await db.insert(cognitiveDailyPlanEvents).values({
        planId: plan.id,
        planItemId: null,
        userId: req.user!.id,
        activityType: null,
        eventType: data.eventType satisfies BrainCoachPlanEventType,
        source: data.source,
        metadata: {
          ...data.metadata,
          nudge_event_id: data.nudgeEventId,
        },
      });

      const [items, planEvents] = await Promise.all([
        selectPlanItems(ctx, plan.id),
        db
          .select()
          .from(cognitiveDailyPlanEvents)
          .where(and(
            eq(cognitiveDailyPlanEvents.planId, plan.id),
            eq(cognitiveDailyPlanEvents.userId, req.user!.id),
          ))
          .orderBy(desc(cognitiveDailyPlanEvents.createdAt))
          .limit(50),
      ]);
      const persistedPlan = buildPersistedBrainCoachPlan(storedPlan(plan), storedItems(items));
      return res.json({
        ...persistedPlan,
        caregiverNudge: latestCaregiverNudge(planEvents, plan.id),
      });
    }

    const itemConditions = [
      eq(cognitiveDailyPlanItems.planId, data.planId),
      eq(cognitiveDailyPlanItems.userId, req.user!.id),
    ];
    if (data.planItemId) {
      itemConditions.push(eq(cognitiveDailyPlanItems.id, data.planItemId));
    } else if (data.activityType) {
      itemConditions.push(eq(cognitiveDailyPlanItems.activityType, data.activityType));
    }

    const [item] = await db
      .select()
      .from(cognitiveDailyPlanItems)
      .where(and(...itemConditions))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: "Brain Coach plan item not found." });
    }

    const patch = applyPlanItemEvent(storedItems([item])[0], data.eventType);
    if (Object.keys(patch).length > 0) {
      await db
        .update(cognitiveDailyPlanItems)
        .set(patch)
        .where(and(
          eq(cognitiveDailyPlanItems.id, item.id),
          eq(cognitiveDailyPlanItems.userId, req.user!.id),
        ));
    }

    await db.insert(cognitiveDailyPlanEvents).values({
      planId: plan.id,
      planItemId: item.id,
      userId: req.user!.id,
      activityType: item.activityType,
      eventType: data.eventType,
      source: data.source,
      metadata: data.metadata,
    });

    const items = await selectPlanItems(ctx, plan.id);
    const persistedPlan = buildPersistedBrainCoachPlan(storedPlan(plan), storedItems(items));
    return res.json(persistedPlan);
  } catch (error) {
    console.error("[games] Brain Coach daily plan event failed:", error);
    return res.status(500).json({ error: "Brain Coach plan event could not be saved." });
  }
}

export async function brainCoachCaregiverSummaryHandler(req: Request, res: Response) {
  try {
    const ctx = await loadCognitiveSessionDb();
    const {
      db,
      cognitiveSessionIndex,
      cognitiveDailyPlans,
      cognitiveDailyPlanItems,
      and,
      desc,
      eq,
      gte,
      asc,
    } = ctx;
    const now = new Date();
    const todayStart = utcDayStart(now);
    const planWindowStart = new Date(todayStart - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sessionWindowStart = new Date(todayStart - 29 * 24 * 60 * 60 * 1000);

    const [sessions, plans, planItems] = await Promise.all([
      db
        .select()
        .from(cognitiveSessionIndex)
        .where(and(
          eq(cognitiveSessionIndex.userId, req.user!.id),
          gte(cognitiveSessionIndex.playedAt, sessionWindowStart),
        ))
        .orderBy(desc(cognitiveSessionIndex.playedAt))
        .limit(100),
      db
        .select()
        .from(cognitiveDailyPlans)
        .where(and(
          eq(cognitiveDailyPlans.userId, req.user!.id),
          gte(cognitiveDailyPlans.planDate, planWindowStart),
        ))
        .orderBy(desc(cognitiveDailyPlans.planDate))
        .limit(7),
      db
        .select()
        .from(cognitiveDailyPlanItems)
        .where(and(
          eq(cognitiveDailyPlanItems.userId, req.user!.id),
          gte(cognitiveDailyPlanItems.planDate, planWindowStart),
        ))
        .orderBy(asc(cognitiveDailyPlanItems.planDate), asc(cognitiveDailyPlanItems.sortOrder)),
    ]);

    return res.json(buildBrainCoachCaregiverSummary({ sessions, plans, planItems, now }));
  } catch (error) {
    console.error("[games] Brain Coach caregiver summary failed:", error);
    return res.status(500).json({ error: "Brain Coach caregiver summary could not be loaded." });
  }
}

const router = Router();
router.post("/sessions", createCognitiveSessionHandler);
router.get("/history", cognitiveSessionHistoryHandler);
router.get("/progress", brainCoachProgressHandler);
router.get("/daily-plan", brainCoachDailyPlanHandler);
router.post("/daily-plan/events", brainCoachDailyPlanEventHandler);
router.get("/caregiver-summary", brainCoachCaregiverSummaryHandler);
router.post("/score-retell", scoreRetellHandler);
router.post("/tts", ttsHandler);

export default router;
