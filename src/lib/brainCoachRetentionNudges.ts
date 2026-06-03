export type BrainCoachRetentionNudge = {
  id: "completed_today" | "new_user" | "lapsed" | "missed_yesterday" | "preferred_time";
  title: string;
  body: string;
  tone: "success" | "restart" | "gentle" | "time";
};

export type BrainCoachRetentionNudgeInput = {
  completedTodayCount?: number;
  planAllComplete?: boolean;
  planCompletedCount?: number;
  planTotalCount?: number;
  lastPlayedAt?: string | null;
  preferredTrainingTime?: string | null;
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function coerceDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayStart(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function daysSince(value: string | null | undefined, now: Date) {
  const date = coerceDate(value);
  if (!date) return null;
  return Math.max(0, Math.floor((dayStart(now) - dayStart(date)) / DAY_MS));
}

function cleanTrainingTime(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function buildBrainCoachRetentionNudges(input: BrainCoachRetentionNudgeInput): BrainCoachRetentionNudge[] {
  const now = input.now ?? new Date();
  const completedTodayCount = input.completedTodayCount ?? 0;
  const planCompletedCount = input.planCompletedCount ?? 0;
  const planTotalCount = input.planTotalCount ?? 0;
  const planAllComplete = Boolean(input.planAllComplete || (planTotalCount > 0 && planCompletedCount >= planTotalCount));
  const lastActivityDays = daysSince(input.lastPlayedAt, now);
  const preferredTrainingTime = cleanTrainingTime(input.preferredTrainingTime);
  const nudges: BrainCoachRetentionNudge[] = [];

  if (planAllComplete || completedTodayCount > 0) {
    nudges.push({
      id: "completed_today",
      title: "Today's Brain Coach is done",
      body: "You can stop here for today, or choose another activity if you feel fresh.",
      tone: "success",
    });
  } else if (lastActivityDays === null) {
    nudges.push({
      id: "new_user",
      title: "Start with one short activity",
      body: "A few minutes is enough to begin building a Brain Coach rhythm.",
      tone: "gentle",
    });
  } else if (lastActivityDays >= 7) {
    nudges.push({
      id: "lapsed",
      title: "Welcome back gently",
      body: "It has been a week or more. One short restart activity is the right goal today.",
      tone: "restart",
    });
  } else if (lastActivityDays >= 2) {
    nudges.push({
      id: "missed_yesterday",
      title: "Yesterday got away",
      body: "Pick one activity from today's plan to restart the streak without making it a big production.",
      tone: "restart",
    });
  }

  if (preferredTrainingTime && !planAllComplete) {
    nudges.push({
      id: "preferred_time",
      title: `Your usual Brain Coach time: ${preferredTrainingTime}`,
      body: "Use that window if it still feels convenient today.",
      tone: "time",
    });
  }

  return nudges.slice(0, 2);
}
