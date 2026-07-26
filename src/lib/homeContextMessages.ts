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

export function selectHomeContextMessage(
  messages: HomeContextMessage[],
  history: HomeContextMessageHistory = {},
  now = Date.now(),
): HomeContextMessage | null {
  return messages
    .filter((message) => {
      if (message.startsAt && message.startsAt > now) return false;
      if (message.expiresAt && message.expiresAt <= now) return false;
      const lastSeen = history[message.id];
      return !lastSeen || !message.repeatAfterMs || now - lastSeen >= message.repeatAfterMs;
    })
    .sort((left, right) => right.priority - left.priority || (right.startsAt ?? 0) - (left.startsAt ?? 0))[0] ?? null;
}

export function stripAgentStageDirections(value: string) {
  return value
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
