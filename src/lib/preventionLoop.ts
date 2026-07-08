export type PreventionLoopFocus = "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";

export type PreventionLoopActionStep =
  | "Eat"
  | "Move"
  | "Calm"
  | "Check"
  | "Protect"
  | "Home"
  | "Medicine"
  | "Review"
  | "Plan"
  | "Sleep";

export type PreventionLoopActionTone = "food" | "movement" | "check" | "support" | "medicine";

export type PreventionLoopBarrier =
  | "physical"
  | "cooking"
  | "no_ingredients"
  | "confusing"
  | "not_interested"
  | "needs_help";

export type PreventionLoopFeedbackValue = "shown" | "done" | "too_hard" | "remind";

export type PreventionLoopHistoryEvent = {
  actionId: string;
  title?: string;
  step?: PreventionLoopActionStep;
  tone?: PreventionLoopActionTone;
  focus?: PreventionLoopFocus;
  feedback: PreventionLoopFeedbackValue;
  barrier?: PreventionLoopBarrier;
  date?: string;
  savedAt?: string;
};

export type PreventionLoopLastFeedback = {
  focus: PreventionLoopFocus;
  date: string;
  actionId: string;
  step: PreventionLoopActionStep;
  tone: PreventionLoopActionTone;
  feedback: Exclude<PreventionLoopFeedbackValue, "shown">;
  barrier?: PreventionLoopBarrier;
  title: string;
  savedAt: string;
};

export type PreventionLoopLastView = {
  focus: PreventionLoopFocus;
  date: string;
  actionIds?: string[];
  viewedAt: string;
};

export type PreventionLoopRequestContext = {
  clientHour: number;
  recentFeedback: PreventionLoopHistoryEvent[];
  dismissedFollowUpIds: string[];
};

export const PREVENTION_LOOP_LAST_FEEDBACK_KEY = "vyva-prevention-loop:last-feedback";
export const PREVENTION_LOOP_LAST_VIEW_KEY = "vyva-prevention-loop:last-view";
export const PREVENTION_LOOP_HISTORY_KEY = "vyva-prevention-loop:history";
export const PREVENTION_DISMISSED_FOLLOWUPS_KEY = "vyva-prevention-loop:dismissed-followups";
export const PREVENTION_LOOP_MAX_HISTORY = 30;
export const PREVENTION_LOOP_MAX_DISMISSED_FOLLOWUPS = 20;

export function preventionDateKey(value: string | undefined): string {
  const raw = String(value ?? "").slice(0, 10);
  if (raw === "1970-01-01") return "today";
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "today";
}

export function preventionFeedbackStorageKey(focus: PreventionLoopFocus, date: string): string {
  return `vyva-prevention-feedback:${focus}:${date}`;
}

export function preventionBarrierStorageKey(focus: PreventionLoopFocus, date: string): string {
  return `vyva-prevention-barriers:${focus}:${date}`;
}

export function readStoredJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeStoredJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local loop memory should never block the health plan experience.
  }
}

export function readPreventionLoopHistory(): PreventionLoopHistoryEvent[] {
  const history = readStoredJson<PreventionLoopHistoryEvent[]>(PREVENTION_LOOP_HISTORY_KEY);
  return Array.isArray(history)
    ? history
      .filter((item) => item && typeof item.actionId === "string" && typeof item.feedback === "string")
      .slice(0, PREVENTION_LOOP_MAX_HISTORY)
    : [];
}

export function appendPreventionLoopHistory(events: PreventionLoopHistoryEvent[]) {
  if (!events.length) return;
  const next = [...events, ...readPreventionLoopHistory()]
    .filter((item, index, all) => {
      const key = `${item.date}:${item.actionId}:${item.feedback}:${item.barrier ?? ""}`;
      return all.findIndex((candidate) => `${candidate.date}:${candidate.actionId}:${candidate.feedback}:${candidate.barrier ?? ""}` === key) === index;
    })
    .slice(0, PREVENTION_LOOP_MAX_HISTORY);
  writeStoredJson(PREVENTION_LOOP_HISTORY_KEY, next);
}

export function readDismissedFollowUpIds(): string[] {
  const dismissed = readStoredJson<unknown>(PREVENTION_DISMISSED_FOLLOWUPS_KEY);
  if (!Array.isArray(dismissed)) return [];
  return dismissed
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, PREVENTION_LOOP_MAX_DISMISSED_FOLLOWUPS);
}

export function dismissPreventionFollowUp(id: string) {
  const cleanId = id.trim();
  if (!cleanId) return;
  const next = [
    cleanId,
    ...readDismissedFollowUpIds().filter((item) => item !== cleanId),
  ].slice(0, PREVENTION_LOOP_MAX_DISMISSED_FOLLOWUPS);
  writeStoredJson(PREVENTION_DISMISSED_FOLLOWUPS_KEY, next);
}

export function learningContextForPreventionRequest(): PreventionLoopRequestContext {
  const now = new Date();
  return {
    clientHour: now.getHours(),
    recentFeedback: readPreventionLoopHistory(),
    dismissedFollowUpIds: readDismissedFollowUpIds(),
  };
}

export function encodePreventionLearningQuery(value: ReturnType<typeof learningContextForPreventionRequest>): string {
  return encodeURIComponent(JSON.stringify({
    clientHour: value.clientHour,
    recentFeedback: value.recentFeedback.slice(0, PREVENTION_LOOP_MAX_HISTORY),
    dismissedFollowUpIds: value.dismissedFollowUpIds.slice(0, PREVENTION_LOOP_MAX_DISMISSED_FOLLOWUPS),
  }));
}
