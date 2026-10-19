import {
  NON_GAME_ACTIVITY_TYPES,
  areaForDomain,
  reportAccuracy,
  type BrainCoachArea,
} from "../../shared/brainCoachAreas.js";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

export const BRAIN_COACH_PERFORMANCE_THRESHOLDS = {
  baselineDays: 28,
  minimumPriorSessions: 3,
  minimumRelativeSessions: 3,
  abovePoints: 10,
  belowPoints: -10,
  latestWindowDays: 7,
  chartWeeks: 8,
} as const;

export type BrainCoachPerformanceStatus = "usual" | "above" | "below" | "building";

export type BrainCoachPerformanceRow = {
  activityType: string;
  domain: string;
  difficulty?: number | string | null;
  difficultyScale?: string | null;
  completed?: boolean | null;
  accuracyPct?: number | string | null;
  durationSeconds?: number | string | null;
  playedAt?: Date | string | null;
};

function dateValue(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? null : date;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function difficultyBand(row: BrainCoachPerformanceRow) {
  const difficulty = Math.max(1, Math.round(Number(row.difficulty ?? 1)));
  if (row.difficultyScale === "level") return Math.ceil(difficulty / 5);
  if (row.difficultyScale === "tier") return difficulty;
  return 1;
}

function weekStart(date: Date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  value.setUTCDate(value.getUTCDate() - value.getUTCDay());
  return value;
}

export function buildBrainCoachPerformance(rows: BrainCoachPerformanceRow[], now = new Date()) {
  const counting = rows.flatMap((row) => {
    const playedAt = dateValue(row.playedAt);
    const area = areaForDomain(row.domain);
    const rawAccuracy = row.accuracyPct === null || row.accuracyPct === undefined
      ? null
      : Number(row.accuracyPct);
    const accuracyPct = reportAccuracy(row.activityType, rawAccuracy);
    return row.completed && playedAt && area && accuracyPct !== null
      ? [{ ...row, playedAt, area, accuracyPct, band: difficultyBand(row), relative: null as number | null }]
      : [];
  }).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());

  counting.forEach((session) => {
    const baselineStart = session.playedAt.getTime() - BRAIN_COACH_PERFORMANCE_THRESHOLDS.baselineDays * DAY_MS;
    const prior = counting.filter((candidate) =>
      candidate.activityType === session.activityType
      && candidate.band === session.band
      && candidate.playedAt < session.playedAt
      && candidate.playedAt.getTime() >= baselineStart,
    );
    if (prior.length >= BRAIN_COACH_PERFORMANCE_THRESHOLDS.minimumPriorSessions) {
      session.relative = session.accuracyPct - median(prior.map((candidate) => candidate.accuracyPct));
    }
  });

  const latestStart = now.getTime() - BRAIN_COACH_PERFORMANCE_THRESHOLDS.latestWindowDays * DAY_MS;
  const currentWeek = weekStart(now);
  const representedAreas = [...new Set(counting.map((session) => session.area))];
  const areas = representedAreas.map((area) => {
    const recent = counting.filter((session) => session.area === area && session.playedAt.getTime() >= latestStart && session.playedAt <= now);
    const relative = recent.flatMap((session) => session.relative === null ? [] : [session.relative]);
    const value = relative.length ? relative.reduce((sum, item) => sum + item, 0) / relative.length : null;
    const status: BrainCoachPerformanceStatus = relative.length < BRAIN_COACH_PERFORMANCE_THRESHOLDS.minimumRelativeSessions
      ? "building"
      : value! >= BRAIN_COACH_PERFORMANCE_THRESHOLDS.abovePoints
        ? "above"
        : value! <= BRAIN_COACH_PERFORMANCE_THRESHOLDS.belowPoints
          ? "below"
          : "usual";
    const weekly = Array.from({ length: BRAIN_COACH_PERFORMANCE_THRESHOLDS.chartWeeks }, (_, index) => {
      const start = new Date(currentWeek.getTime() - (BRAIN_COACH_PERFORMANCE_THRESHOLDS.chartWeeks - 1 - index) * WEEK_MS);
      const end = start.getTime() + WEEK_MS;
      const points = counting.filter((session) => session.area === area && session.relative !== null && session.playedAt.getTime() >= start.getTime() && session.playedAt.getTime() < end);
      return {
        weekStart: start.toISOString().slice(0, 10),
        value: points.length >= BRAIN_COACH_PERFORMANCE_THRESHOLDS.minimumRelativeSessions
          ? Math.round((points.reduce((sum, item) => sum + item.relative!, 0) / points.length) * 10) / 10
          : null,
      };
    });
    return { area: area as BrainCoachArea, status, sessionsInWindow: relative.length, weekly };
  });

  const relaxationSeconds = rows.reduce((sum, row) => {
    const playedAt = dateValue(row.playedAt);
    return row.completed && playedAt && playedAt.getTime() >= latestStart && NON_GAME_ACTIVITY_TYPES.has(row.activityType)
      ? sum + Math.max(0, Number(row.durationSeconds ?? 0))
      : sum;
  }, 0);

  return {
    areas,
    relaxationMinutes: Math.round(relaxationSeconds / 60),
    generatedAt: now.toISOString(),
  };
}
