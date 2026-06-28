import { apiFetch } from "@/lib/queryClient";

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
    activityType: record.activityType,
    domain: record.domain,
    secondaryDomain: record.secondaryDomain ?? null,
    difficulty: Math.max(1, clampInteger(record.difficulty, 1, 100)),
    difficultyScale: record.difficultyScale ?? "level",
    completed: record.completed,
    abandoned: record.abandoned ?? false,
    score: clampInteger(record.score, 0),
    accuracyPct: clampPercent(record.accuracyPct),
    speedPct: clampPercent(record.speedPct),
    durationSeconds: clampInteger(record.durationSeconds, 0, 24 * 60 * 60),
    playedAt: record.playedAt ?? new Date().toISOString(),
    language: record.language ?? "es",
    source: record.source ?? "app",
    sourceTable: record.sourceTable ?? null,
    sourceSessionId: record.sourceSessionId ?? null,
    clientResultId: record.clientResultId ?? null,
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
  const response = await apiFetch("/api/games/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    const message = detail?.error ?? "Session index could not be saved.";
    console.warn("[brain-coach] Session index fallback:", message);
    saveFallback(record, message);
    return { persisted: false };
  }

  return { persisted: true };
}
