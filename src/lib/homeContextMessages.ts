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
  category?: "medication" | "appointment" | "health" | "concierge" | "community" | "mind" | "general";
  intentTags?: string[];
  dueAt?: number;
  nonUrgent?: boolean;
  source?: "managed" | "built_in" | "fallback";
};

export type HomeContextMessageHistory = Record<string, number>;

export type HomeContextMessageAction = "opened" | "deferred" | "dismissed" | "completed";

export type HomeContextMessageActionRecord = {
  action: HomeContextMessageAction;
  recordedAt: number;
  suppressUntil?: number;
  source?: "touch" | "voice" | "voice_tool";
};

export type HomeContextMessageActionHistory = Record<string, HomeContextMessageActionRecord>;

export type HomeContextMessageOutcome =
  | "shown"
  | "opened"
  | "deferred"
  | "dismissed"
  | "completed"
  | "voice_engaged";

export type HomeContextMessageOutcomeRecord = {
  messageId: string;
  outcome: HomeContextMessageOutcome;
  recordedAt: number;
  source: "touch" | "voice" | "voice_tool" | "system";
  kind?: HomeContextMessageKind;
};

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
  explanation: string;
  factors: HomeContextDecisionFactor[];
  frozen: boolean;
};

export type HomeContextDecisionFactor = {
  key: "tier" | "priority" | "category" | "timing" | "intent" | "history" | "continuity";
  label: string;
  points: number;
  detail: string;
};

export type HomeContextSelectionOptions = {
  actionHistory?: HomeContextMessageActionHistory;
  outcomeHistory?: HomeContextMessageOutcomeRecord[];
  activeIntent?: string | null;
  frozenMessageId?: string | null;
  freezeRotation?: boolean;
  dailyNonUrgentLimit?: number;
  recentNonUrgentWindowMs?: number;
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
export const HOME_CONTEXT_ACTION_HISTORY_KEY = "vyva:home-context-message-actions:v1";
export const HOME_CONTEXT_OUTCOME_HISTORY_KEY = "vyva:home-context-message-outcomes:v1";

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

export function readHomeContextMessageActionHistory(
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): HomeContextMessageActionHistory {
  if (!storage) return {};
  try {
    const value = JSON.parse(storage.getItem(HOME_CONTEXT_ACTION_HISTORY_KEY) ?? "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

export function writeHomeContextMessageAction(
  id: string,
  action: HomeContextMessageAction,
  options: {
    recordedAt?: number;
    deferForMs?: number;
    source?: HomeContextMessageActionRecord["source"];
  } = {},
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return;
  const recordedAt = options.recordedAt ?? Date.now();
  const history = readHomeContextMessageActionHistory(storage);
  const suppressUntil = action === "deferred"
    ? recordedAt + (options.deferForMs ?? 4 * 60 * 60 * 1_000)
    : undefined;
  storage.setItem(HOME_CONTEXT_ACTION_HISTORY_KEY, JSON.stringify({
    ...history,
    [id]: {
      action,
      recordedAt,
      ...(suppressUntil ? { suppressUntil } : {}),
      ...(options.source ? { source: options.source } : {}),
    },
  }));
}

export function isHomeContextMessageSuppressed(
  id: string,
  history: HomeContextMessageActionHistory,
  now = Date.now(),
) {
  const record = history[id];
  if (!record) return false;
  if (record.action === "dismissed" || record.action === "completed") return true;
  return record.action === "deferred" && Boolean(record.suppressUntil && record.suppressUntil > now);
}

export function readHomeContextMessageOutcomeHistory(
  storage: Pick<Storage, "getItem"> | null = typeof window === "undefined" ? null : window.localStorage,
): HomeContextMessageOutcomeRecord[] {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(HOME_CONTEXT_OUTCOME_HISTORY_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((record): record is HomeContextMessageOutcomeRecord =>
          Boolean(record)
          && typeof record.messageId === "string"
          && typeof record.recordedAt === "number"
          && typeof record.outcome === "string"
        )
      : [];
  } catch {
    return [];
  }
}

export function writeHomeContextMessageOutcome(
  record: Omit<HomeContextMessageOutcomeRecord, "recordedAt"> & { recordedAt?: number },
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof window === "undefined" ? null : window.localStorage,
) {
  if (!storage) return;
  const history = readHomeContextMessageOutcomeHistory(storage);
  const next = [...history, { ...record, recordedAt: record.recordedAt ?? Date.now() }].slice(-250);
  storage.setItem(HOME_CONTEXT_OUTCOME_HISTORY_KEY, JSON.stringify(next));
}

export type HomeContextVoiceReplyAction = "open" | "defer" | "dismiss" | "complete";

export function homeContextActionForVoiceReply(value: string): HomeContextVoiceReplyAction | null {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.split(" ").length > 5) return null;

  const exact = (values: string[]) => values.includes(normalized);
  if (exact([
    "yes", "yes please", "show me", "open it", "go ahead",
    "si", "si por favor", "muestrame", "abrelo", "adelante",
    "oui", "oui merci", "montrez moi", "ouvrez le",
    "ja", "ja bitte", "zeig es mir", "offne es",
    "si grazie", "mostrami", "aprilo",
    "sim", "sim por favor", "mostre me", "abra",
  ])) return "open";

  if (exact([
    "later", "not now", "maybe later",
    "mas tarde", "ahora no", "luego",
    "plus tard", "pas maintenant",
    "spater", "jetzt nicht",
    "piu tardi", "non ora",
    "mais tarde", "agora nao",
  ])) return "defer";

  if (exact([
    "dismiss", "remove it", "dont show this",
    "descartar", "quitalo", "no mostrar",
    "masquer", "supprimez le",
    "ausblenden", "entfernen",
    "nascondi", "rimuovilo",
    "dispensar", "remova",
  ])) return "dismiss";

  if (exact([
    "done", "completed", "i did it",
    "hecho", "completado", "ya lo hice",
    "fait", "termine", "je lai fait",
    "erledigt", "fertig", "ich habe es gemacht",
    "fatto", "completato", "lho fatto",
    "feito", "concluido", "ja fiz",
  ])) return "complete";

  return null;
}

export function classifyHomeContextMessage(message: HomeContextMessage): HomeContextDecisionReason {
  if (message.kind === "urgent") return "urgent_safety";
  if (message.kind === "flow") return "active_flow";
  if (message.id.startsWith("admin:")) return "admin_campaign";
  if (message.kind === "reminder") return "due_personal";
  if (message.kind === "default") return "default_greeting";
  return "personal_update";
}

export function isNonUrgentHomeContextMessage(message: HomeContextMessage) {
  if (typeof message.nonUrgent === "boolean") return message.nonUrgent;
  return message.kind === "tip"
    || message.kind === "feature"
    || message.kind === "event"
    || message.id.startsWith("admin:");
}

function startOfLocalDay(now: number) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function timingFactor(message: HomeContextMessage, now: number): HomeContextDecisionFactor | null {
  if (!message.dueAt) return null;
  const minutes = Math.round((message.dueAt - now) / 60_000);
  if (minutes <= 0) {
    return { key: "timing", label: "Due now", points: 500, detail: "This item is due or overdue." };
  }
  if (minutes <= 30) {
    return { key: "timing", label: "Due soon", points: 400, detail: `Due in about ${minutes} minutes.` };
  }
  if (minutes <= 120) {
    return { key: "timing", label: "Coming up", points: 220, detail: `Due in about ${minutes} minutes.` };
  }
  return { key: "timing", label: "Scheduled later", points: 40, detail: "This item is scheduled for later." };
}

function scoreHomeContextMessage(
  message: HomeContextMessage,
  history: HomeContextMessageHistory,
  options: HomeContextSelectionOptions,
  now: number,
) {
  const reason = classifyHomeContextMessage(message);
  const priority = Math.max(0, Math.min(999, message.priority));
  const factors: HomeContextDecisionFactor[] = [
    {
      key: "tier",
      label: HOME_CONTEXT_DECISION_LABELS[reason],
      points: HOME_CONTEXT_TIER_SCORE[reason],
      detail: `Ranked as ${HOME_CONTEXT_DECISION_LABELS[reason].toLowerCase()}.`,
    },
    { key: "priority", label: "Message priority", points: priority, detail: `Configured priority is ${priority}.` },
  ];

  if (message.category === "medication") {
    factors.push({ key: "category", label: "Medication", points: 650, detail: "Medication reminders outrank general nudges." });
  } else if (message.category === "appointment") {
    factors.push({ key: "category", label: "Appointment", points: 550, detail: "Appointment reminders outrank general nudges." });
  }

  const timing = timingFactor(message, now);
  if (timing) factors.push(timing);

  const normalizedIntent = options.activeIntent?.trim().toLowerCase();
  if (normalizedIntent && message.intentTags?.some((tag) => tag.toLowerCase() === normalizedIntent)) {
    factors.push({
      key: "intent",
      label: "Matches current intent",
      points: 450,
      detail: `Matches the user's current ${normalizedIntent} intent.`,
    });
  }

  const lastSeen = history[message.id];
  if (lastSeen) {
    factors.push({
      key: "history",
      label: "Seen recently",
      points: -100,
      detail: "Recent exposure lowers this message's rank.",
    });
  }

  return {
    message,
    reason,
    factors,
    score: factors.reduce((total, factor) => total + factor.points, 0),
  };
}

export function decideHomeContextMessage(
  messages: HomeContextMessage[],
  history: HomeContextMessageHistory = {},
  now = Date.now(),
  options: HomeContextSelectionOptions = {},
): HomeContextMessageDecision | null {
  const actionHistory = options.actionHistory ?? {};
  const outcomes = options.outcomeHistory ?? [];
  const recentNonUrgentWindowMs = options.recentNonUrgentWindowMs ?? 6 * 60 * 60 * 1_000;
  const dayStart = startOfLocalDay(now);
  const nonUrgentShownToday = new Set(
    outcomes
      .filter((record) => record.outcome === "shown" && record.recordedAt >= dayStart && record.recordedAt <= now)
      .map((record) => record.messageId),
  );
  const dailyNonUrgentLimit = options.dailyNonUrgentLimit ?? 3;

  const scored = messages
    .filter((message) => {
      if (isHomeContextMessageSuppressed(message.id, actionHistory, now)) return false;
      if (message.startsAt && message.startsAt > now) return false;
      if (message.expiresAt && message.expiresAt <= now) return false;
      const isFrozenCandidate = Boolean(
        options.freezeRotation
        && options.frozenMessageId === message.id,
      );
      const lastSeen = history[message.id];
      if (
        !isFrozenCandidate
        && lastSeen
        && message.repeatAfterMs
        && now - lastSeen < message.repeatAfterMs
      ) return false;
      if (
        !isFrozenCandidate
        &&
        lastSeen
        && isNonUrgentHomeContextMessage(message)
        && now - lastSeen < recentNonUrgentWindowMs
      ) return false;
      if (
        !isFrozenCandidate
        &&
        isNonUrgentHomeContextMessage(message)
        && !nonUrgentShownToday.has(message.id)
        && nonUrgentShownToday.size >= dailyNonUrgentLimit
      ) return false;
      return true;
    })
    .map((message) => scoreHomeContextMessage(message, history, options, now))
    .sort((left, right) =>
      right.score - left.score
      || (right.message.startsAt ?? 0) - (left.message.startsAt ?? 0)
      || left.message.id.localeCompare(right.message.id)
    );

  let selected = scored[0];
  let frozen = false;
  if (options.freezeRotation && options.frozenMessageId) {
    const frozenCandidate = scored.find(({ message }) => message.id === options.frozenMessageId);
    const urgentChallenger = scored.find(({ message }) => message.kind === "urgent");
    const flowChallenger = scored.find(({ reason }) => reason === "active_flow");
    const shouldYieldToFlow = Boolean(
      flowChallenger
      && frozenCandidate
      && frozenCandidate.reason !== "active_flow"
      && flowChallenger.score > frozenCandidate.score,
    );
    if (
      frozenCandidate
      && !shouldYieldToFlow
      && (!urgentChallenger || urgentChallenger.score <= frozenCandidate.score)
    ) {
      selected = {
        ...frozenCandidate,
        factors: [
          ...frozenCandidate.factors,
          {
            key: "continuity",
            label: "Conversation continuity",
            points: 0,
            detail: "Message rotation is paused while the conversation is active.",
          },
        ],
      };
      frozen = true;
    }
  }

  if (!selected) return null;

  return {
    ...selected,
    evaluatedAt: now,
    frozen,
    explanation: selected.factors
      .filter((factor) => factor.points > 0 || factor.key === "continuity")
      .map((factor) => factor.detail)
      .join(" "),
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
  options: HomeContextSelectionOptions = {},
): HomeContextMessage | null {
  return decideHomeContextMessage(messages, history, now, options)?.message ?? null;
}

export function stripAgentStageDirections(value: string) {
  return value
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
