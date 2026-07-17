import type {
  ContextualHomeFastHelpActionId,
  HomeFastHelpActivity,
} from "./contextualHomeFastHelp";
import {
  mergeHomeFastHelpSyncedJourneys,
  type HomeFastHelpSyncedEvent,
  type HomeFastHelpSyncedJourney,
} from "../../shared/homeFastHelpSync";

export type HomeFastHelpOutcomeStatus =
  | "opened"
  | "completed"
  | "dismissed"
  | "abandoned"
  | "blocked";

export type HomeFastHelpOutcomeEvent = {
  id: string;
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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

function stableLegacyUuid(value: string) {
  const bytes = new Uint8Array(16);
  for (let block = 0; block < 4; block += 1) {
    let hash = (2166136261 ^ block) >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    bytes[block * 4] = hash >>> 24;
    bytes[block * 4 + 1] = hash >>> 16;
    bytes[block * 4 + 2] = hash >>> 8;
    bytes[block * 4 + 3] = hash;
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizedUuid(value: unknown, seed: string) {
  return typeof value === "string" && UUID_PATTERN.test(value) ? value : stableLegacyUuid(seed);
}

function coerceJourneyEvent(value: unknown, journeySeed: string, index: number): HomeFastHelpOutcomeEvent | null {
  if (!isRecord(value) || !isOutcomeStatus(value.status) || !isIsoDate(value.occurredAt)) return null;
  return {
    id: normalizedUuid(value.id, `${journeySeed}:event:${index}:${value.status}:${value.occurredAt}`),
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

  const journeyId = normalizedUuid(value.id, `journey:${value.id}:${value.actionId}:${value.startedAt}`);
  const events = Array.isArray(value.events)
    ? value.events.map((event, index) => coerceJourneyEvent(event, journeyId, index)).filter((event): event is HomeFastHelpOutcomeEvent => Boolean(event))
    : [];

  return {
    id: journeyId,
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
  return stableLegacyUuid(`fast-help:${Date.now()}:${Math.random()}`);
}

function safeReferenceId(value?: string | null) {
  return value && SAFE_REFERENCE_PATTERN.test(value) ? value : null;
}

export function homeFastHelpDestinationPath(actionId: ContextualHomeFastHelpActionId) {
  if (actionId === "feel-better") return "/health/symptom-check";
  if (actionId === "stay-well") return "/health/prevention";
  if (actionId === "safe-home") return "/safe-home";
  return "/concierge";
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
    const serialized = JSON.stringify(journeys.slice(0, MAX_STORED_JOURNEYS));
    if (window.localStorage.getItem(storageKey) === serialized) return;
    window.localStorage.setItem(storageKey, serialized);
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
    events: [{ id: createJourneyId(), status: "opened", occurredAt }],
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
        id: createJourneyId(),
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
      events: [...journey.events, { id: createJourneyId(), status: "abandoned" as const, occurredAt, reason: "returned_home" }],
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

function toSyncedEvent(event: HomeFastHelpOutcomeEvent): HomeFastHelpSyncedEvent {
  return {
    id: event.id,
    status: event.status,
    occurredAt: event.occurredAt,
    referenceId: safeReferenceId(event.referenceId),
  };
}

function toSyncedJourney(journey: HomeFastHelpJourney): HomeFastHelpSyncedJourney {
  return {
    id: journey.id,
    actionId: journey.actionId,
    status: journey.status,
    startedAt: journey.startedAt,
    updatedAt: journey.updatedAt,
    referenceId: safeReferenceId(journey.events.at(-1)?.referenceId),
    events: journey.events.map(toSyncedEvent),
  };
}

export function syncedHomeFastHelpJourneys(storageKey: string) {
  return readHomeFastHelpJourneys(storageKey)
    .filter((journey) => journey.events.length > 0)
    .map(toSyncedJourney);
}

export function mergeSyncedHomeFastHelpJourneys(
  storageKey: string,
  remoteJourneys: HomeFastHelpSyncedJourney[],
) {
  const localJourneys = readHomeFastHelpJourneys(storageKey);
  const localById = new Map(localJourneys.map((journey) => [journey.id, journey]));
  const mergedById = new Map(localById);

  for (const remote of remoteJourneys) {
    const local = localById.get(remote.id);
    const merged = local ? mergeHomeFastHelpSyncedJourneys(toSyncedJourney(local), remote) : remote;
    const localEventById = new Map(local?.events.map((event) => [event.id, event]) ?? []);
    mergedById.set(remote.id, {
      id: merged.id,
      actionId: merged.actionId,
      destinationPath: local?.destinationPath ?? homeFastHelpDestinationPath(merged.actionId),
      destinationState: local?.destinationState ?? null,
      startedAt: merged.startedAt,
      updatedAt: merged.updatedAt,
      status: merged.status,
      events: merged.events.map((event) => ({
        ...event,
        reason: localEventById.get(event.id)?.reason ?? null,
      })),
    });
  }

  const merged = [...mergedById.values()]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_STORED_JOURNEYS);
  writeHomeFastHelpJourneys(storageKey, merged);
  return merged;
}
