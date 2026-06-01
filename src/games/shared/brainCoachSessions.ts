import { supabase } from "@/lib/supabaseClient";

export const BRAIN_COACH_SESSION_FALLBACK_KEY = "vyva-brain-coach-session-fallback";

export type CognitiveSessionRecord = {
  userId: string | null | undefined;
  activityType: string;
  domain: string;
  secondaryDomain?: string | null;
  difficulty?: number | null;
  difficultyScale?: string;
  completed: boolean;
  abandoned?: boolean;
  score?: number | null;
  accuracyPct?: number | null;
  speedPct?: number | null;
  durationSeconds?: number | null;
  playedAt?: string;
  language?: string;
  source?: string;
  sourceTable?: string;
  sourceSessionId?: string | null;
  clientResultId?: string;
  metadata?: Record<string, unknown>;
};

type CognitiveSessionFallbackEntry = CognitiveSessionRecord & {
  fallbackReason: string;
  fallbackAt: string;
};

function hasLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readFallbackEntries(): CognitiveSessionFallbackEntry[] {
  if (!hasLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(BRAIN_COACH_SESSION_FALLBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as CognitiveSessionFallbackEntry[] : [];
  } catch {
    return [];
  }
}

function writeFallbackEntries(entries: CognitiveSessionFallbackEntry[]) {
  if (!hasLocalStorage()) return;
  window.localStorage.setItem(BRAIN_COACH_SESSION_FALLBACK_KEY, JSON.stringify(entries.slice(-200)));
}

function clampInteger(value: number | null | undefined, fallback: number, max = 1000000) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.round(Number(value))));
}

function clampPercent(value: number | null | undefined) {
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Number(value)));
}

function normalizeRecord(record: CognitiveSessionRecord) {
  return {
    user_id: record.userId,
    activity_type: record.activityType,
    domain: record.domain,
    secondary_domain: record.secondaryDomain ?? null,
    difficulty: Math.max(1, clampInteger(record.difficulty, 1, 100)),
    difficulty_scale: record.difficultyScale ?? "level",
    completed: record.completed,
    abandoned: record.abandoned ?? false,
    score: clampInteger(record.score, 0),
    accuracy_pct: clampPercent(record.accuracyPct),
    speed_pct: clampPercent(record.speedPct),
    duration_seconds: clampInteger(record.durationSeconds, 0, 24 * 60 * 60),
    played_at: record.playedAt ?? new Date().toISOString(),
    language: record.language ?? "es",
    source: record.source ?? "app",
    source_table: record.sourceTable ?? null,
    source_session_id: record.sourceSessionId ?? null,
    client_result_id: record.clientResultId ?? null,
    metadata: record.metadata ?? {},
  };
}

function saveFallback(record: CognitiveSessionRecord, reason: string) {
  const entries = readFallbackEntries();
  entries.push({
    ...record,
    fallbackReason: reason,
    fallbackAt: new Date().toISOString(),
  });
  writeFallbackEntries(entries);
}

export function readBrainCoachSessionFallback(): CognitiveSessionFallbackEntry[] {
  return readFallbackEntries();
}

export async function recordCognitiveSession(record: CognitiveSessionRecord): Promise<{ persisted: boolean }> {
  if (!record.userId) {
    saveFallback(record, "missing_user");
    return { persisted: false };
  }

  const payload = normalizeRecord(record);
  const { error } = await supabase.from("cognitive_session_index").insert(payload);

  if (error) {
    console.warn("[brain-coach] Session index fallback:", error.message);
    saveFallback(record, error.message);
    return { persisted: false };
  }

  return { persisted: true };
}
