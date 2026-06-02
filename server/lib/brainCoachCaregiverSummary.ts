export type BrainCoachCaregiverSession = {
  id?: string | null;
  activityType: string;
  domain: string;
  completed?: boolean | null;
  score?: number | string | null;
  durationSeconds?: number | string | null;
  playedAt?: Date | string | null;
};

export type BrainCoachCaregiverPlan = {
  id: string;
  planDate: Date | string;
  status: string;
  estimatedDurationMinutes?: number | null;
  completedAt?: Date | string | null;
};

export type BrainCoachCaregiverPlanItem = {
  id: string;
  planId: string;
  activityType: string;
  title?: string | null;
  domain: string;
  status: string;
  completedAt?: Date | string | null;
  planDate?: Date | string | null;
};

export type BrainCoachCaregiverPlanEvent = {
  id?: string | null;
  planId: string;
  eventType: string;
  metadata?: unknown;
  createdAt?: Date | string | null;
};

type NormalizedSession = {
  id: string | null;
  activityType: string;
  domain: string;
  completed: boolean;
  score: number;
  durationSeconds: number;
  playedAt: string;
  dayKey: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function coerceDate(value: unknown, fallback = new Date(Number.NaN)): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function utcDayStart(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function utcDayKey(value: unknown): string | null {
  const date = coerceDate(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(utcDayStart(date)).toISOString().slice(0, 10);
}

function dayKeyFromStart(dayStart: number) {
  return new Date(dayStart).toISOString().slice(0, 10);
}

function numeric(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function iso(value: unknown): string | null {
  const date = coerceDate(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function normalizeSessions(sessions: BrainCoachCaregiverSession[]) {
  return sessions
    .map((session): NormalizedSession | null => {
      const playedAt = coerceDate(session.playedAt);
      const dayKey = utcDayKey(playedAt);
      if (!dayKey) return null;
      return {
        id: session.id ?? null,
        activityType: session.activityType,
        domain: session.domain,
        completed: Boolean(session.completed),
        score: Math.max(0, Math.round(numeric(session.score))),
        durationSeconds: Math.max(0, Math.round(numeric(session.durationSeconds))),
        playedAt: playedAt.toISOString(),
        dayKey,
      };
    })
    .filter((session): session is NormalizedSession => Boolean(session))
    .sort((left, right) => right.playedAt.localeCompare(left.playedAt));
}

function calculateStreak(sessions: NormalizedSession[], now: Date) {
  const completedDays = new Set(sessions.filter((session) => session.completed).map((session) => session.dayKey));
  if (completedDays.size === 0) return 0;

  const todayStart = utcDayStart(now);
  const yesterdayStart = todayStart - DAY_MS;
  let cursor = completedDays.has(dayKeyFromStart(todayStart))
    ? todayStart
    : completedDays.has(dayKeyFromStart(yesterdayStart))
      ? yesterdayStart
      : null;
  if (cursor === null) return 0;

  let streak = 0;
  while (completedDays.has(dayKeyFromStart(cursor))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}

function planItemCompleted(item: BrainCoachCaregiverPlanItem) {
  return item.status === "completed" || Boolean(item.completedAt);
}

function planCompletedAt(plan: BrainCoachCaregiverPlan | undefined, items: BrainCoachCaregiverPlanItem[]) {
  const explicitCompletedAt = iso(plan?.completedAt);
  if (explicitCompletedAt) return explicitCompletedAt;
  if (!items.length || !items.every(planItemCompleted)) return null;

  const itemCompletedTimes = items
    .map((item) => iso(item.completedAt))
    .filter((value): value is string => Boolean(value));
  if (itemCompletedTimes.length !== items.length) return null;
  return itemCompletedTimes.sort().at(-1) ?? null;
}

function summarizeDomains(sessions: NormalizedSession[]) {
  const domains = new Map<string, {
    domain: string;
    completedSessions: number;
    totalSessions: number;
    lastPlayedAt: string | null;
  }>();

  sessions.forEach((session) => {
    const existing = domains.get(session.domain) ?? {
      domain: session.domain,
      completedSessions: 0,
      totalSessions: 0,
      lastPlayedAt: null,
    };
    existing.totalSessions += 1;
    existing.completedSessions += session.completed ? 1 : 0;
    existing.lastPlayedAt = !existing.lastPlayedAt || session.playedAt > existing.lastPlayedAt
      ? session.playedAt
      : existing.lastPlayedAt;
    domains.set(session.domain, existing);
  });

  return [...domains.values()]
    .sort((left, right) => {
      if (right.completedSessions !== left.completedSessions) return right.completedSessions - left.completedSessions;
      return (right.lastPlayedAt ?? "").localeCompare(left.lastPlayedAt ?? "");
    })
    .slice(0, 5);
}

function latestNudgeOutcome(input: {
  plans: BrainCoachCaregiverPlan[];
  planItems: BrainCoachCaregiverPlanItem[];
  planEvents: BrainCoachCaregiverPlanEvent[];
}) {
  const latestNudge = input.planEvents
    .filter((event) => event.eventType === "caregiver_nudge")
    .sort((left, right) => (iso(right.createdAt) ?? "").localeCompare(iso(left.createdAt) ?? ""))[0];
  if (!latestNudge) return null;

  const nudgeId = latestNudge.id ?? null;
  const metadata = metadataRecord(latestNudge.metadata);
  const relatedEvents = nudgeId
    ? input.planEvents.filter((event) => {
        const eventMetadata = metadataRecord(event.metadata);
        return (
          event.planId === latestNudge.planId &&
          stringValue(eventMetadata.nudge_event_id) === nudgeId &&
          (event.eventType === "caregiver_nudge_read" || event.eventType === "caregiver_nudge_dismissed")
        );
      })
    : [];
  const readEvent = relatedEvents
    .filter((event) => event.eventType === "caregiver_nudge_read")
    .sort((left, right) => (iso(right.createdAt) ?? "").localeCompare(iso(left.createdAt) ?? ""))[0];
  const dismissedEvent = relatedEvents
    .filter((event) => event.eventType === "caregiver_nudge_dismissed")
    .sort((left, right) => (iso(right.createdAt) ?? "").localeCompare(iso(left.createdAt) ?? ""))[0];
  const status = dismissedEvent ? "dismissed" : readEvent ? "seen" : "sent";
  const plan = input.plans.find((entry) => entry.id === latestNudge.planId);
  const matchingItems = input.planItems.filter((item) => item.planId === latestNudge.planId);
  const completedAt = planCompletedAt(plan, matchingItems);
  const sentAt = iso(latestNudge.createdAt) ?? stringValue(metadata.sent_at);

  return {
    id: nudgeId,
    planId: latestNudge.planId,
    messageType: stringValue(metadata.message_type) ?? "today_plan",
    title: stringValue(metadata.title) ?? "Brain Coach nudge",
    body: stringValue(metadata.body) ?? "",
    status,
    sentAt,
    sentBy: stringValue(metadata.sent_by),
    seenAt: iso(readEvent?.createdAt),
    dismissedAt: iso(dismissedEvent?.createdAt),
    planCompletedAfterNudge: Boolean(sentAt && completedAt && completedAt > sentAt),
    planCompletedAt: completedAt,
  };
}

export function buildBrainCoachCaregiverSummary(input: {
  sessions?: BrainCoachCaregiverSession[];
  plans?: BrainCoachCaregiverPlan[];
  planItems?: BrainCoachCaregiverPlanItem[];
  planEvents?: BrainCoachCaregiverPlanEvent[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const todayKey = dayKeyFromStart(utcDayStart(now));
  const normalized = normalizeSessions(input.sessions ?? []);
  const completed = normalized.filter((session) => session.completed);
  const plans = input.plans ?? [];
  const planItems = input.planItems ?? [];
  const planEvents = input.planEvents ?? [];
  const planIds = new Set(plans.map((plan) => plan.id));
  const visibleItems = planItems.filter((item) => planIds.has(item.planId));
  const todayPlan = plans.find((plan) => utcDayKey(plan.planDate) === todayKey) ?? null;
  const todayItems = todayPlan ? visibleItems.filter((item) => item.planId === todayPlan.id) : [];
  const todayCompletedItems = todayItems.filter(planItemCompleted).length;
  const latestCompleted = completed[0] ?? null;
  const lapsedDays = latestCompleted
    ? Math.max(0, Math.floor((utcDayStart(now) - utcDayStart(new Date(latestCompleted.playedAt))) / DAY_MS))
    : null;

  const adherenceDays = Array.from({ length: 7 }, (_, index) => {
    const dayStart = utcDayStart(now) - (6 - index) * DAY_MS;
    const date = dayKeyFromStart(dayStart);
    const dayPlans = plans.filter((plan) => utcDayKey(plan.planDate) === date);
    const dayPlanIds = new Set(dayPlans.map((plan) => plan.id));
    const dayItems = visibleItems.filter((item) => dayPlanIds.has(item.planId));
    const completedItems = dayItems.filter(planItemCompleted).length;
    const totalItems = dayItems.length;
    const sessionCount = completed.filter((session) => session.dayKey === date).length;
    const planned = dayPlans.length > 0;
    const completedPlan = planned && (
      (totalItems > 0 && completedItems === totalItems) ||
      dayPlans.some((plan) => plan.status === "completed" || Boolean(plan.completedAt))
    );

    return {
      date,
      planned,
      completed: completedPlan,
      completedItems,
      totalItems,
      sessionCount,
    };
  });

  const plannedDays = adherenceDays.filter((day) => day.planned).length;
  const completedPlanDays = adherenceDays.filter((day) => day.completed).length;
  const activeSessionDays = adherenceDays.filter((day) => day.sessionCount > 0).length;
  const status = normalized.length === 0 && plans.length === 0
    ? "no_history"
    : lapsedDays !== null && lapsedDays >= 7
      ? "lapsed"
      : "active";

  return {
    status,
    currentStreakDays: calculateStreak(normalized, now),
    lastActivityAt: latestCompleted?.playedAt ?? null,
    lapsedDays,
    todayPlan: {
      planId: todayPlan?.id ?? null,
      planDate: todayKey,
      status: todayPlan?.status ?? "not_planned",
      completedItems: todayCompletedItems,
      totalItems: todayItems.length,
      completionPct: percent(todayCompletedItems, todayItems.length),
      estimatedDurationMinutes: todayPlan?.estimatedDurationMinutes ?? 0,
      domains: [...new Set(todayItems.map((item) => item.domain))],
    },
    adherence7d: {
      completedPlanDays,
      plannedDays,
      activeSessionDays,
      completionPct: percent(completedPlanDays, plannedDays),
      days: adherenceDays,
    },
    latestNudge: latestNudgeOutcome({ plans, planItems: visibleItems, planEvents }),
    recentDomains: summarizeDomains(normalized),
    recentActivities: normalized.slice(0, 6).map((session) => ({
      id: session.id,
      activityType: session.activityType,
      domain: session.domain,
      completed: session.completed,
      score: session.score,
      durationSeconds: session.durationSeconds,
      playedAt: session.playedAt,
    })),
  };
}
