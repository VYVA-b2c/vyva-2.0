import type {
  ContextualHomeFastHelpActionId,
  HomeFastHelpActivity,
} from "./contextualHomeFastHelp";

export type HomeFastHelpOutcomeStatus =
  | "opened"
  | "completed"
  | "dismissed"
  | "abandoned"
  | "blocked";

export type HomeFastHelpOutcomeEvent = {
  status: HomeFastHelpOutcomeStatus;
  occurredAt: string;
  reason?: string | null;
  referenceId?: string | null;
};

export type HomeFastHelpJourney = {
  id: string;
  actionId: ContextualHomeFastHelpActionId;
  destinationPath: string;
  destinationState: Record<string, unknown> | null;
  startedAt: string;
  updatedAt: string;
  status: HomeFastHelpOutcomeStatus;
  events: HomeFastHelpOutcomeEvent[];
};

export type HomeFastHelpJourneyContext = {
  version: 1;
  journeyId: string;
  actionId: ContextualHomeFastHelpActionId;
  destinationPath: string;
  startedAt: string;
  storageKey: string;
};

export type HomeFastHelpOutcomeUpdate = {
  occurredAtMs?: number;
  reason?: string | null;
  referenceId?: string | null;
};

export const HOME_FAST_HELP_CONTEXT_STATE_KEY = "homeFastHelpContext";
export const HOME_FAST_HELP_JOURNEY_STORAGE_PREFIX = "vyva:home-fast-help-journeys:v1";
export const HOME_FAST_HELP_JOURNEY_EVENT = "vyva:home-fast-help-journey-changed";

const MAX_STORED_JOURNEYS = 20;
const ACTION_IDS: ContextualHomeFastHelpActionId[] = [
  "feel-better",
  "stay-well",
  "find-care",
  "book-ride",
  "paperwork-help",
  "safe-home",
];

const OUTCOME_STATUSES: HomeFastHelpOutcomeStatus[] = [
  "opened",
  "completed",
  "dismissed",
  "abandoned",
  "blocked",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isActionId(value: unknown): value is ContextualHomeFastHelpActionId {
  return typeof value === "string" && ACTION_IDS.includes(value as ContextualHomeFastHelpActionId);
}

function isOutcomeStatus(value: unknown): value is HomeFastHelpOutcomeStatus {
  return typeof value === "string" && OUTCOME_STATUSES.includes(value as HomeFastHelpOutcomeStatus);
}

function coerceJourneyEvent(value: unknown): HomeFastHelpOutcomeEvent | null {
  if (!isRecord(value) || !isOutcomeStatus(value.status) || !isIsoDate(value.occurredAt)) return null;
  return {
    status: value.status,
    occurredAt: value.occurredAt,
    reason: typeof value.reason === "string" ? value.reason : null,
    referenceId: typeof value.referenceId === "string" ? value.referenceId : null,
  };
}

function coerceJourney(value: unknown): HomeFastHelpJourney | null {
  if (
    !isRecord(value)
    || typeof value.id !== "string"
    || !value.id.trim()
    || !isActionId(value.actionId)
    || typeof value.destinationPath !== "string"
    || !value.destinationPath.startsWith("/")
    || !isIsoDate(value.startedAt)
    || !isIsoDate(value.updatedAt)
    || !isOutcomeStatus(value.status)
  ) return null;

  const events = Array.isArray(value.events)
    ? value.events.map(coerceJourneyEvent).filter((event): event is HomeFastHelpOutcomeEvent => Boolean(event))
    : [];

  return {
    id: value.id.trim(),
    actionId: value.actionId,
    destinationPath: value.destinationPath,
    destinationState: isRecord(value.destinationState) ? value.destinationState : null,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    status: value.status,
    events,
  };
}

function createJourneyId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `fast-help-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitJourneyChange(storageKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOME_FAST_HELP_JOURNEY_EVENT, { detail: { storageKey } }));
}

export function homeFastHelpJourneyStorageKey(profileId?: string | null) {
  return `${HOME_FAST_HELP_JOURNEY_STORAGE_PREFIX}:${profileId?.trim() || "browser"}`;
}

export function readHomeFastHelpJourneys(storageKey: string): HomeFastHelpJourney[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(coerceJourney)
      .filter((journey): journey is HomeFastHelpJourney => Boolean(journey))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
      .slice(0, MAX_STORED_JOURNEYS);
  } catch {
    return [];
  }
}

export function writeHomeFastHelpJourneys(storageKey: string, journeys: HomeFastHelpJourney[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(journeys.slice(0, MAX_STORED_JOURNEYS)));
    emitJourneyChange(storageKey);
  } catch {
    return;
  }
}

export function homeFastHelpContextFromState(state: unknown): HomeFastHelpJourneyContext | null {
  if (!isRecord(state)) return null;
  const value = state[HOME_FAST_HELP_CONTEXT_STATE_KEY];
  if (
    !isRecord(value)
    || value.version !== 1
    || typeof value.journeyId !== "string"
    || !value.journeyId.trim()
    || !isActionId(value.actionId)
    || typeof value.destinationPath !== "string"
    || !value.destinationPath.startsWith("/")
    || !isIsoDate(value.startedAt)
    || typeof value.storageKey !== "string"
    || !value.storageKey.startsWith(`${HOME_FAST_HELP_JOURNEY_STORAGE_PREFIX}:`)
  ) return null;

  return {
    version: 1,
    journeyId: value.journeyId.trim(),
    actionId: value.actionId,
    destinationPath: value.destinationPath,
    startedAt: value.startedAt,
    storageKey: value.storageKey,
  };
}

export function homeFastHelpContextForJourney(
  journey: HomeFastHelpJourney,
  storageKey: string,
): HomeFastHelpJourneyContext {
  return {
    version: 1,
    journeyId: journey.id,
    actionId: journey.actionId,
    destinationPath: journey.destinationPath,
    startedAt: journey.startedAt,
    storageKey,
  };
}

export function withHomeFastHelpContextState(
  context: HomeFastHelpJourneyContext,
  state?: unknown,
) {
  return {
    ...(isRecord(state) ? state : {}),
    [HOME_FAST_HELP_CONTEXT_STATE_KEY]: context,
  };
}

export function startHomeFastHelpJourney({
  actionId,
  destinationPath,
  destinationState,
  profileId,
  occurredAtMs = Date.now(),
}: {
  actionId: ContextualHomeFastHelpActionId;
  destinationPath: string;
  destinationState?: unknown;
  profileId?: string | null;
  occurredAtMs?: number;
}) {
  const occurredAt = new Date(occurredAtMs).toISOString();
  const storageKey = homeFastHelpJourneyStorageKey(profileId);
  const journey: HomeFastHelpJourney = {
    id: createJourneyId(),
    actionId,
    destinationPath,
    destinationState: isRecord(destinationState) ? destinationState : null,
    startedAt: occurredAt,
    updatedAt: occurredAt,
    status: "opened",
    events: [{ status: "opened", occurredAt }],
  };
  writeHomeFastHelpJourneys(storageKey, [journey, ...readHomeFastHelpJourneys(storageKey)]);
  return { journey, context: homeFastHelpContextForJourney(journey, storageKey), storageKey };
}

export function markHomeFastHelpJourney(
  context: HomeFastHelpJourneyContext | null | undefined,
  status: HomeFastHelpOutcomeStatus,
  update: HomeFastHelpOutcomeUpdate = {},
) {
  if (!context) return null;
  const journeys = readHomeFastHelpJourneys(context.storageKey);
  const index = journeys.findIndex((journey) => journey.id === context.journeyId);
  if (index < 0) return null;
  const current = journeys[index]!;
  if ((current.status === "completed" || current.status === "dismissed") && current.status !== status) {
    return current;
  }
  if (
    current.status === status
    && !update.reason
    && !update.referenceId
  ) return current;

  const occurredAt = new Date(update.occurredAtMs ?? Date.now()).toISOString();
  const next: HomeFastHelpJourney = {
    ...current,
    status,
    updatedAt: occurredAt,
    events: [
      ...current.events,
      {
        status,
        occurredAt,
        reason: update.reason ?? null,
        referenceId: update.referenceId ?? null,
      },
    ],
  };
  const nextJourneys = [...journeys];
  nextJourneys[index] = next;
  writeHomeFastHelpJourneys(context.storageKey, nextJourneys);
  return next;
}

export function resumeHomeFastHelpJourney(journey: HomeFastHelpJourney, storageKey: string) {
  const context = homeFastHelpContextForJourney(journey, storageKey);
  return markHomeFastHelpJourney(context, "opened", { reason: "resumed" }) ?? journey;
}

export function abandonOpenedHomeFastHelpJourneys(storageKey: string, occurredAtMs = Date.now()) {
  const journeys = readHomeFastHelpJourneys(storageKey);
  let changed = false;
  const occurredAt = new Date(occurredAtMs).toISOString();
  const next = journeys.map((journey) => {
    if (journey.status !== "opened") return journey;
    changed = true;
    return {
      ...journey,
      status: "abandoned" as const,
      updatedAt: occurredAt,
      events: [...journey.events, { status: "abandoned" as const, occurredAt, reason: "returned_home" }],
    };
  });
  if (changed) writeHomeFastHelpJourneys(storageKey, next);
  return next;
}

export function latestResumableHomeFastHelpJourney(journeys: HomeFastHelpJourney[]) {
  return journeys.find((journey) => journey.status === "opened" || journey.status === "abandoned") ?? null;
}

export function latestBlockedHomeFastHelpJourney(
  journeys: HomeFastHelpJourney[],
  nowMs = Date.now(),
) {
  const oneDayAgo = nowMs - 24 * 60 * 60 * 1000;
  return journeys.find((journey) => (
    journey.status === "blocked"
    && new Date(journey.updatedAt).getTime() >= oneDayAgo
  )) ?? null;
}

export function homeFastHelpActivityFromJourneys(journeys: HomeFastHelpJourney[]): HomeFastHelpActivity[] {
  return journeys.flatMap((journey) => {
    if (journey.status !== "completed" && journey.status !== "dismissed" && journey.status !== "blocked") return [];
    return [{
      actionId: journey.actionId,
      status: journey.status,
      occurredAt: journey.updatedAt,
    }];
  });
}

export function reconcileHomeFastHelpJourneys(
  storageKey: string,
  activity: HomeFastHelpActivity[],
) {
  let journeys = readHomeFastHelpJourneys(storageKey);
  for (const journey of journeys) {
    if (journey.status !== "opened" && journey.status !== "abandoned") continue;
    const startedAtMs = new Date(journey.startedAt).getTime();
    const matching = activity
      .filter((entry) => (
        entry.actionId === journey.actionId
        && new Date(entry.occurredAt).getTime() >= startedAtMs
        && (entry.status === "completed" || entry.status === "dismissed" || entry.status === "blocked")
      ))
      .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0];
    if (!matching) continue;
    markHomeFastHelpJourney(homeFastHelpContextForJourney(journey, storageKey), matching.status, {
      occurredAtMs: new Date(matching.occurredAt).getTime(),
      reason: "existing_outcome_record",
    });
    journeys = readHomeFastHelpJourneys(storageKey);
  }
  return journeys;
}
