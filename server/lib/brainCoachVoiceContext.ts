import {
  buildBrainCoachDailyPlan,
  calculatePlanStreakDays,
  getBrainCoachActivityCatalog,
  type BrainCoachDailyPlan,
  type BrainCoachPlanPreferences,
  type BrainCoachPlanSession,
} from "./brainCoachPlan.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export type BrainCoachVoiceState =
  | "new_user"
  | "completed_today"
  | "completed_yesterday"
  | "missed_recent_day"
  | "lapsed";

export type BrainCoachVoiceContext = {
  state: BrainCoachVoiceState;
  plan: BrainCoachDailyPlan;
  summary: string;
  recentHistory: string;
  recommendedActivityPrompt: string;
  missedSessionAwareness: string;
  streakAwareness: string;
  planPrompt: string;
  completedYesterday: string;
  firstRecommendedActivityTitle: string;
  firstRecommendedActivityRoute: string;
};

type CompletedSession = BrainCoachPlanSession & {
  playedAtDate: Date;
};

const ACTIVITY_TITLES = new Map(
  getBrainCoachActivityCatalog().map((activity) => [activity.activityType, activity.title]),
);

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function utcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.floor((utcDayStart(to) - utcDayStart(from)) / DAY_MS));
}

function activityTitle(activityType: string) {
  return ACTIVITY_TITLES.get(activityType) ?? activityType.replaceAll("_", " ");
}

function domainLabel(domain: string) {
  return domain.replaceAll("_", " ");
}

function completedSessions(sessions: BrainCoachPlanSession[]): CompletedSession[] {
  return sessions
    .filter((session) => session.completed)
    .map((session) => ({ ...session, playedAtDate: asDate(session.playedAt) }))
    .filter((session): session is CompletedSession => Boolean(session.playedAtDate))
    .sort((a, b) => b.playedAtDate.getTime() - a.playedAtDate.getTime());
}

function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item);
    if (!key) return;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function latestCompletedState(completed: CompletedSession[], now: Date): BrainCoachVoiceState {
  if (completed.length === 0) return "new_user";
  const daysAgo = daysBetween(completed[0].playedAtDate, now);
  if (daysAgo === 0) return "completed_today";
  if (daysAgo === 1) return "completed_yesterday";
  if (daysAgo >= 7) return "lapsed";
  return "missed_recent_day";
}

function formatRecentHistory(completed: CompletedSession[], now: Date) {
  if (completed.length === 0) return "No completed Brain Coach activities are recorded yet.";

  const recent30 = completed.filter((session) => daysBetween(session.playedAtDate, now) <= 30);
  const recent14 = completed.filter((session) => daysBetween(session.playedAtDate, now) <= 14);
  const latest = completed[0];
  const domains = countBy(recent30, (session) => session.domain)
    .slice(0, 4)
    .map(([domain, count]) => `${domainLabel(domain)} x${count}`);
  const activities = countBy(recent14, (session) => session.activityType)
    .slice(0, 4)
    .map(([activityType, count]) => `${activityTitle(activityType)} x${count}`);

  return [
    `Latest completed activity: ${activityTitle(latest.activityType)} (${domainLabel(latest.domain)}) on ${dayKey(latest.playedAtDate)}.`,
    `Completed activities in the last 30 days: ${recent30.length}.`,
    domains.length ? `Recent domains: ${domains.join(", ")}.` : "",
    activities.length ? `Recent activities: ${activities.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

function completedYesterdayLine(completed: CompletedSession[], now: Date) {
  const yesterdayStart = utcDayStart(now) - DAY_MS;
  const yesterday = completed.filter((session) => utcDayStart(session.playedAtDate) === yesterdayStart);
  if (yesterday.length === 0) return "";
  return `Completed yesterday: ${yesterday.map((session) => activityTitle(session.activityType)).join(", ")}.`;
}

function missedSessionAwareness(state: BrainCoachVoiceState, completed: CompletedSession[], now: Date) {
  if (state === "new_user") {
    return "New Brain Coach user: do not mention missed sessions. Invite one short first activity.";
  }
  if (state === "completed_today") {
    return "Brain Coach already has a completed activity today. Offer to continue only if the user wants more.";
  }
  if (state === "completed_yesterday") {
    return "Brain Coach was completed yesterday. Acknowledge continuity briefly and offer today's short plan.";
  }

  const latest = completed[0];
  const daysAgo = latest ? daysBetween(latest.playedAtDate, now) : 0;
  if (state === "lapsed") {
    return `Lapsed Brain Coach user: last completed activity was ${daysAgo} days ago. Keep the restart low-pressure and positive.`;
  }
  return `Missed-session awareness: last completed activity was ${daysAgo} days ago. Offer a gentle restart without guilt.`;
}

function streakAwareness(streakDays: number) {
  if (streakDays > 1) {
    return `Current Brain Coach streak: ${streakDays} days. Mention momentum if it feels encouraging.`;
  }
  if (streakDays === 1) {
    return "Current Brain Coach streak: 1 day. Reinforce that one completed activity keeps momentum going.";
  }
  return "No active Brain Coach streak. Focus on one clear completion today.";
}

function recommendedActivityPrompt(plan: BrainCoachDailyPlan) {
  const first = plan.activities[0];
  if (!first) {
    return "Offer one short Brain Coach activity when the user is ready.";
  }

  return [
    `Recommended voice opening: "Would you like to try ${first.title} for about ${first.estimatedDurationMinutes} minutes?"`,
    `Reason to say aloud if useful: ${first.rationale}.`,
    `If the user accepts, open ${first.route} with the app action tool using domain brain_coach.`,
  ].join(" ");
}

function planPrompt(plan: BrainCoachDailyPlan) {
  if (plan.activities.length === 0) return "No Brain Coach plan activities are available today.";
  const activities = plan.activities
    .map((activity) => `${activity.title} (${domainLabel(activity.domain)}, ${activity.estimatedDurationMinutes} min)`)
    .join("; ");
  return [
    `Today's Brain Coach plan: ${activities}.`,
    `Estimated total time: ${plan.estimatedDurationMinutes} minutes.`,
    `Recommended domains: ${plan.recommendedDomains.map(domainLabel).join(", ")}.`,
    `Plan rationale: ${plan.rationale.join(" ")}`,
    `Completion: ${plan.completion.completedCount}/${plan.completion.totalCount} recommended activities completed today.`,
  ].join(" ");
}

export function buildBrainCoachVoiceContext(input: {
  sessions?: BrainCoachPlanSession[];
  preferences?: BrainCoachPlanPreferences | null;
  now?: Date;
  streakDays?: number;
}): BrainCoachVoiceContext {
  const sessions = input.sessions ?? [];
  const now = input.now ?? new Date();
  const plan = buildBrainCoachDailyPlan({
    sessions,
    preferences: input.preferences,
    now,
    streakDays: input.streakDays,
  });
  const completed = completedSessions(sessions);
  const streakDays = input.streakDays ?? calculatePlanStreakDays(sessions, now);
  const state = latestCompletedState(completed, now);
  const recentHistory = formatRecentHistory(completed, now);
  const first = plan.activities[0];
  const completedYesterday = completedYesterdayLine(completed, now);
  const missed = missedSessionAwareness(state, completed, now);
  const streak = streakAwareness(streakDays);
  const planLine = planPrompt(plan);

  return {
    state,
    plan,
    summary: [
      recentHistory,
      completedYesterday,
      missed,
      streak,
      planLine,
    ].filter(Boolean).join(" "),
    recentHistory,
    recommendedActivityPrompt: recommendedActivityPrompt(plan),
    missedSessionAwareness: missed,
    streakAwareness: streak,
    planPrompt: planLine,
    completedYesterday,
    firstRecommendedActivityTitle: first?.title ?? "",
    firstRecommendedActivityRoute: first?.route ?? "",
  };
}
