export type ContextualHomeFastHelpActionId =
  | "feel-better"
  | "stay-well"
  | "find-care"
  | "book-ride"
  | "paperwork-help"
  | "safe-home";

export type ContextualHomeFastHelpReason =
  | "healthAttention"
  | "checkinDue"
  | "preventionFocus"
  | "careReady"
  | "transportReady"
  | "accessibleTransport"
  | "coverageMissing"
  | "morningStep"
  | "daytimePlan"
  | "eveningSafety"
  | "generalHealth"
  | "simplePrevention"
  | "compareCare"
  | "prepareTransport"
  | "organizePaperwork"
  | "safetyFallback";

export type HomeFastHelpActivityStatus = "used" | "completed" | "dismissed";

export type HomeFastHelpActivity = {
  actionId: ContextualHomeFastHelpActionId;
  status: HomeFastHelpActivityStatus;
  occurredAt: string;
};

export type ContextualHomeFastHelpProfile = {
  hasSavedDoctor?: boolean;
  hasSavedTransportProvider?: boolean;
  hasMobilityInfo?: boolean;
  hasCoverageInfo?: boolean;
};

export type ContextualHomeFastHelpSignals = {
  alertSeverity?: string | null;
  checkinStatus?: string | null;
  preventionFocus?: string | null;
  recommendedAction?: string | null;
  safetyStatus?: string | null;
};

export type ContextualHomeFastHelpInput = {
  activeTaskActionId?: ContextualHomeFastHelpActionId | null;
  activity?: HomeFastHelpActivity[];
  hour: number;
  nowMs?: number;
  profile?: ContextualHomeFastHelpProfile | null;
  signals?: ContextualHomeFastHelpSignals | null;
  visibleCount?: number;
};

export type RankedContextualHomeFastHelpAction = {
  id: ContextualHomeFastHelpActionId;
  reason: ContextualHomeFastHelpReason;
  score: number;
};

export const HOME_FAST_HELP_HISTORY_STORAGE_PREFIX = "vyva:home-fast-help-history:v1";

export const HOME_FAST_HELP_REASON_FALLBACKS: Record<ContextualHomeFastHelpReason, string> = {
  healthAttention: "A recent health signal may need attention",
  checkinDue: "Your check-in is due",
  preventionFocus: "A useful prevention step for today",
  careReady: "Your saved care details can help",
  transportReady: "Your transport setup is ready",
  accessibleTransport: "Your mobility needs can be included",
  coverageMissing: "VYVA can help organize coverage details",
  morningStep: "A simple step to start the day",
  daytimePlan: "Useful for plans today",
  eveningSafety: "Here if something feels worrying tonight",
  generalHealth: "A calm place to start with a concern",
  simplePrevention: "One simple step at a time",
  compareCare: "Compare support without pressure",
  prepareTransport: "Prepare the journey before booking",
  organizePaperwork: "Get things ready before anything is sent",
  safetyFallback: "Here whenever something feels unsafe",
};

const ACTION_ORDER: ContextualHomeFastHelpActionId[] = [
  "feel-better",
  "stay-well",
  "find-care",
  "book-ride",
  "paperwork-help",
  "safe-home",
];

const BASE_ACTIONS: Record<ContextualHomeFastHelpActionId, { score: number; reason: ContextualHomeFastHelpReason }> = {
  "feel-better": { score: 70, reason: "generalHealth" },
  "stay-well": { score: 66, reason: "simplePrevention" },
  "find-care": { score: 58, reason: "compareCare" },
  "book-ride": { score: 54, reason: "prepareTransport" },
  "paperwork-help": { score: 50, reason: "organizePaperwork" },
  "safe-home": { score: 64, reason: "safetyFallback" },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_ACTIVITY = 24;

type ScoredAction = RankedContextualHomeFastHelpAction & {
  reasonPriority: number;
  suppressed: boolean;
};

function normalizedSignal(...values: Array<string | null | undefined>) {
  return values.filter(Boolean).join(" ").trim().toLowerCase();
}

function looksLikeHealthAttention(signals?: ContextualHomeFastHelpSignals | null) {
  const signal = normalizedSignal(
    signals?.alertSeverity,
    signals?.recommendedAction,
    signals?.safetyStatus,
  );
  return [
    "attention",
    "critical",
    "danger",
    "emergency",
    "high",
    "severe",
    "urgent",
    "unsafe",
    "contact doctor",
    "seek care",
  ].some((word) => signal.includes(word));
}

function activityAgeMs(activity: HomeFastHelpActivity, nowMs: number) {
  const occurredAt = new Date(activity.occurredAt).getTime();
  return Number.isFinite(occurredAt) ? Math.max(0, nowMs - occurredAt) : Number.POSITIVE_INFINITY;
}

function shouldSuppressActivity(activity: HomeFastHelpActivity, nowMs: number) {
  const age = activityAgeMs(activity, nowMs);
  if (activity.status === "used") return age < DAY_MS;
  if (activity.status === "dismissed") return age < 3 * DAY_MS;
  return age < 7 * DAY_MS;
}

function historyPenalty(activity: HomeFastHelpActivity, nowMs: number) {
  const age = activityAgeMs(activity, nowMs);
  if (activity.status === "used") return age < 3 * DAY_MS ? 35 : 0;
  if (activity.status === "dismissed") return age < 7 * DAY_MS ? 55 : 0;
  return age < 14 * DAY_MS ? 45 : 0;
}

function applyBoost(
  action: ScoredAction,
  score: number,
  reason: ContextualHomeFastHelpReason,
  reasonPriority: number,
) {
  action.score += score;
  if (reasonPriority > action.reasonPriority) {
    action.reason = reason;
    action.reasonPriority = reasonPriority;
  }
}

function sortedActions(actions: ScoredAction[]) {
  return [...actions].sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return ACTION_ORDER.indexOf(left.id) - ACTION_ORDER.indexOf(right.id);
  });
}

function replaceLowestNonSafety(
  selected: ScoredAction[],
  replacement: ScoredAction,
  protectedIds: ContextualHomeFastHelpActionId[],
) {
  const candidates = selected
    .map((action, index) => ({ action, index }))
    .filter(({ action }) => !protectedIds.includes(action.id))
    .sort((left, right) => left.action.score - right.action.score);
  const lowest = candidates[0];
  if (!lowest) return selected;
  const next = [...selected];
  next[lowest.index] = replacement;
  return sortedActions(next);
}

export function rankContextualHomeFastHelp({
  activeTaskActionId = null,
  activity = [],
  hour,
  nowMs = Date.now(),
  profile,
  signals,
  visibleCount = 3,
}: ContextualHomeFastHelpInput): RankedContextualHomeFastHelpAction[] {
  const count = Math.max(0, Math.min(ACTION_ORDER.length, visibleCount));
  if (count === 0) return [];

  const actions = ACTION_ORDER.map<ScoredAction>((id) => ({
    id,
    reason: BASE_ACTIONS[id].reason,
    reasonPriority: 0,
    score: BASE_ACTIONS[id].score,
    suppressed: id === activeTaskActionId,
  }));
  const byId = new Map(actions.map((action) => [action.id, action]));

  if (looksLikeHealthAttention(signals)) {
    applyBoost(byId.get("feel-better")!, 160, "healthAttention", 100);
  }

  if (signals?.checkinStatus === "overdue" || signals?.checkinStatus === "due_now") {
    applyBoost(
      byId.get("feel-better")!,
      signals.checkinStatus === "overdue" ? 60 : 40,
      "checkinDue",
      80,
    );
  }

  if (signals?.preventionFocus) {
    applyBoost(byId.get("stay-well")!, 58, "preventionFocus", 70);
  }

  if (profile?.hasSavedDoctor) {
    applyBoost(byId.get("find-care")!, 38, "careReady", 60);
  }
  if (profile?.hasSavedTransportProvider) {
    applyBoost(byId.get("book-ride")!, 42, "transportReady", 60);
  } else if (profile?.hasMobilityInfo) {
    applyBoost(byId.get("book-ride")!, 28, "accessibleTransport", 55);
  }
  if (profile?.hasCoverageInfo === false) {
    applyBoost(byId.get("paperwork-help")!, 42, "coverageMissing", 55);
  }

  if (hour >= 5 && hour <= 11) {
    applyBoost(byId.get("stay-well")!, 15, "morningStep", 20);
  } else if (hour >= 12 && hour <= 17) {
    applyBoost(byId.get("find-care")!, 12, "daytimePlan", 20);
    applyBoost(byId.get("book-ride")!, 10, "daytimePlan", 20);
  } else {
    applyBoost(byId.get("safe-home")!, hour >= 22 || hour < 5 ? 26 : 18, "eveningSafety", 20);
    if (hour >= 22 || hour < 5) applyBoost(byId.get("feel-better")!, 14, "generalHealth", 10);
  }

  for (const entry of activity) {
    const action = byId.get(entry.actionId);
    if (!action) continue;
    action.score -= historyPenalty(entry, nowMs);
    if (shouldSuppressActivity(entry, nowMs)) action.suppressed = true;
  }

  const available = sortedActions(actions.filter((action) => !action.suppressed));
  const suppressed = sortedActions(actions.filter((action) => action.suppressed));
  let selected = available.slice(0, count);

  for (const candidate of [...available, ...suppressed]) {
    if (selected.length >= count) break;
    if (!selected.some((action) => action.id === candidate.id)) selected.push(candidate);
  }

  const hasSafetyOption = selected.some((action) => action.id === "feel-better" || action.id === "safe-home");
  if (!hasSafetyOption) {
    const safetyReplacement = sortedActions([
      byId.get("feel-better")!,
      byId.get("safe-home")!,
    ])[0];
    if (safetyReplacement && !selected.some((action) => action.id === safetyReplacement.id)) {
      selected = replaceLowestNonSafety(selected, safetyReplacement, []);
    }
  }

  const needsAccessibleTransport = Boolean(profile?.hasMobilityInfo || profile?.hasSavedTransportProvider);
  const transport = byId.get("book-ride")!;
  if (
    needsAccessibleTransport
    && count > 1
    && !transport.suppressed
    && !selected.some((action) => action.id === "book-ride")
  ) {
    selected = replaceLowestNonSafety(selected, transport, ["feel-better", "safe-home"]);
  }

  return sortedActions(selected).slice(0, count).map(({ id, reason, score }) => ({ id, reason, score }));
}

export function homeFastHelpHistoryStorageKey(profileId?: string | null) {
  const owner = profileId?.trim() || "browser";
  return `${HOME_FAST_HELP_HISTORY_STORAGE_PREFIX}:${owner}`;
}

export function readHomeFastHelpHistory(storageKey: string): HomeFastHelpActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is HomeFastHelpActivity => (
      Boolean(entry)
      && ACTION_ORDER.includes(entry.actionId)
      && ["used", "completed", "dismissed"].includes(entry.status)
      && typeof entry.occurredAt === "string"
      && Number.isFinite(new Date(entry.occurredAt).getTime())
    )).slice(0, MAX_STORED_ACTIVITY);
  } catch {
    return [];
  }
}

export function writeHomeFastHelpHistory(storageKey: string, activity: HomeFastHelpActivity[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(activity.slice(0, MAX_STORED_ACTIVITY)));
  } catch {
    return;
  }
}

export function recordHomeFastHelpUse(
  activity: HomeFastHelpActivity[],
  actionId: ContextualHomeFastHelpActionId,
  occurredAtMs = Date.now(),
) {
  const next: HomeFastHelpActivity[] = [
    { actionId, status: "used", occurredAt: new Date(occurredAtMs).toISOString() },
    ...activity.filter((entry) => !(entry.actionId === actionId && entry.status === "used")),
  ];
  return next.slice(0, MAX_STORED_ACTIVITY);
}
