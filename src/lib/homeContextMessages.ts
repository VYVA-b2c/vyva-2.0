export type HomeContextMessageKind =
  | "urgent"
  | "flow"
  | "reminder"
  | "receipt"
  | "event"
  | "tip"
  | "feature"
  | "default";

export type HomeContextMessage = {
  id: string;
  kind: HomeContextMessageKind;
  title: string;
  supportingText?: string;
  spokenText?: string;
  actionLabel?: string;
  actionRoute?: string;
  actionState?: Record<string, unknown>;
  dismissible?: boolean;
  priority: number;
  startsAt?: number;
  expiresAt?: number;
  repeatAfterMs?: number;
};

export type HomeContextMessageHistory = Record<string, number>;

export type HomeContextDecisionReason =
  | "urgent_safety"
  | "active_flow"
  | "due_personal"
  | "personal_update"
  | "admin_campaign"
  | "default_greeting";

export type HomeContextMessageDecision = {
  message: HomeContextMessage;
  reason: HomeContextDecisionReason;
  score: number;
  evaluatedAt: number;
  expiresAt?: number;
  action?: {
    label?: string;
    route: string;
    state?: Record<string, unknown>;
  };
};

export const HOME_CONTEXT_DECISION_LABELS: Record<HomeContextDecisionReason, string> = {
  urgent_safety: "Urgent or safety message",
  active_flow: "Active user flow",
  due_personal: "Due personal reminder",
  personal_update: "Personal update",
  admin_campaign: "Admin message",
  default_greeting: "Default greeting",
};

const HOME_CONTEXT_TIER_SCORE: Record<HomeContextDecisionReason, number> = {
  urgent_safety: 5_000,
  active_flow: 4_000,
  due_personal: 3_000,
  personal_update: 2_000,
  admin_campaign: 1_000,
  default_greeting: 0,
};

export const HOME_CONTEXT_HISTORY_KEY = "vyva:home-context-messages:v1";

export function readHomeContextMessageHistory(
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): HomeContextMessageHistory {
  if (!storage) return {};
  try {
    const value = JSON.parse(storage.getItem(HOME_CONTEXT_HISTORY_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeHomeContextMessageSeen(
  id: string,
  seenAt = Date.now(),
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return;
  const history = readHomeContextMessageHistory(storage);
  storage.setItem(HOME_CONTEXT_HISTORY_KEY, JSON.stringify({ ...history, [id]: seenAt }));
}

export function classifyHomeContextMessage(message: HomeContextMessage): HomeContextDecisionReason {
  if (message.kind === "urgent") return "urgent_safety";
  if (message.kind === "flow") return "active_flow";
  if (message.id.startsWith("admin:")) return "admin_campaign";
  if (message.kind === "reminder") return "due_personal";
  if (message.kind === "default") return "default_greeting";
  return "personal_update";
}

export function decideHomeContextMessage(
  messages: HomeContextMessage[],
  history: HomeContextMessageHistory = {},
  now = Date.now(),
): HomeContextMessageDecision | null {
  const selected = messages
    .filter((message) => {
      if (message.startsAt && message.startsAt > now) return false;
      if (message.expiresAt && message.expiresAt <= now) return false;
      const lastSeen = history[message.id];
      return !lastSeen || !message.repeatAfterMs || now - lastSeen >= message.repeatAfterMs;
    })
    .map((message) => {
      const reason = classifyHomeContextMessage(message);
      return {
        message,
        reason,
        score: HOME_CONTEXT_TIER_SCORE[reason] + Math.max(0, Math.min(999, message.priority)),
      };
    })
    .sort((left, right) =>
      right.score - left.score
      || (right.message.startsAt ?? 0) - (left.message.startsAt ?? 0)
      || left.message.id.localeCompare(right.message.id)
    )[0];

  if (!selected) return null;

  return {
    ...selected,
    evaluatedAt: now,
    expiresAt: selected.message.expiresAt,
    action: selected.message.actionRoute
      ? {
          label: selected.message.actionLabel,
          route: selected.message.actionRoute,
          state: selected.message.actionState,
        }
      : undefined,
  };
}

export function selectHomeContextMessage(
  messages: HomeContextMessage[],
  history: HomeContextMessageHistory = {},
  now = Date.now(),
): HomeContextMessage | null {
  return decideHomeContextMessage(messages, history, now)?.message ?? null;
}

export function stripAgentStageDirections(value: string) {
  return value
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
