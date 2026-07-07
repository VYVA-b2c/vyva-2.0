import { useSyncExternalStore } from "react";
import { getToken } from "./auth";

export type VoiceTimelineEventKind =
  | "session_started"
  | "context_resolved"
  | "session_connected"
  | "mic_muted"
  | "mic_unmuted"
  | "transfer_requested"
  | "action_opened"
  | "action_accepted"
  | "action_completed"
  | "action_dismissed"
  | "session_ended"
  | "session_error"
  | "voice_triage_started"
  | "voice_triage_step"
  | "voice_triage_emergency"
  | "voice_triage_completed"
  | "voice_triage_tool_failed"
  | "simulator";

export type VoiceTimelineEvent = {
  id: string;
  at: number;
  kind: VoiceTimelineEventKind;
  title: string;
  detail?: string;
  severity: "info" | "success" | "warning" | "error";
  sessionId?: string;
  domain?: string;
  agentId?: string;
  agentSlug?: string;
  conversationPlanId?: string;
  route?: string;
  actionId?: string;
  actionType?: string;
  payload?: Record<string, string | number | boolean>;
};

export type PersistedVoiceTimelineEvent = VoiceTimelineEvent & {
  clientEventId: string;
  userId: string;
  source: string;
  createdAt: number;
};

type VoiceTimelineEventInput = Omit<VoiceTimelineEvent, "id" | "at" | "severity"> & {
  at?: number;
  severity?: VoiceTimelineEvent["severity"];
};

const TIMELINE_STORAGE_KEY = "vyva.voice.timeline.v1";
const TIMELINE_SYNCED_STORAGE_KEY = "vyva.voice.timeline.synced.v1";
const TIMELINE_UPDATED_EVENT = "vyva:voice-timeline-updated";
const MAX_TIMELINE_EVENTS = 240;
const MAX_SYNCED_EVENT_IDS = 600;
const SYNC_BATCH_SIZE = 60;
const EMPTY_EVENTS: VoiceTimelineEvent[] = [];

const KIND_SEVERITY: Record<VoiceTimelineEventKind, VoiceTimelineEvent["severity"]> = {
  session_started: "info",
  context_resolved: "success",
  session_connected: "success",
  mic_muted: "info",
  mic_unmuted: "info",
  transfer_requested: "warning",
  action_opened: "info",
  action_accepted: "success",
  action_completed: "success",
  action_dismissed: "warning",
  session_ended: "info",
  session_error: "error",
  voice_triage_started: "info",
  voice_triage_step: "info",
  voice_triage_emergency: "error",
  voice_triage_completed: "success",
  voice_triage_tool_failed: "error",
  simulator: "info",
};

let memoryTimeline: VoiceTimelineEvent[] = EMPTY_EVENTS;
let lastStoredTimelineRaw: string | null = null;
let timelineSyncTimer: number | null = null;
let timelineSyncPromise: Promise<void> | null = null;

function timelineId(kind: VoiceTimelineEventKind, at: number) {
  const suffix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${kind}-${at}-${suffix}`;
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredTimeline(): VoiceTimelineEvent[] {
  if (!canUseStorage()) return memoryTimeline;
  try {
    const raw = window.localStorage.getItem(TIMELINE_STORAGE_KEY);
    if (!raw) {
      lastStoredTimelineRaw = null;
      return memoryTimeline;
    }
    if (raw === lastStoredTimelineRaw) return memoryTimeline;
    const parsed = JSON.parse(raw) as VoiceTimelineEvent[];
    if (!Array.isArray(parsed)) return EMPTY_EVENTS;
    memoryTimeline = parsed
      .filter((event) => event && typeof event.id === "string" && typeof event.at === "number")
      .slice(-MAX_TIMELINE_EVENTS);
    lastStoredTimelineRaw = raw;
    return memoryTimeline;
  } catch {
    return memoryTimeline;
  }
}

function writeStoredTimeline(events: VoiceTimelineEvent[]) {
  memoryTimeline = events.slice(-MAX_TIMELINE_EVENTS);
  if (canUseStorage()) {
    try {
      const raw = JSON.stringify(memoryTimeline);
      window.localStorage.setItem(TIMELINE_STORAGE_KEY, raw);
      lastStoredTimelineRaw = raw;
    } catch {
      // Local storage is best-effort; keep the in-memory timeline.
    }
  }
}

function readSyncedEventIds() {
  if (!canUseStorage()) return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(TIMELINE_SYNCED_STORAGE_KEY) ?? "[]") as string[];
    return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function writeSyncedEventIds(ids: Set<string>) {
  if (!canUseStorage()) return;
  try {
    const list = Array.from(ids).slice(-MAX_SYNCED_EVENT_IDS);
    window.localStorage.setItem(TIMELINE_SYNCED_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Server sync markers are best-effort.
  }
}

function notifyTimelineSubscribers() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TIMELINE_UPDATED_EVENT));
}

export function getVoiceTimelineEvents() {
  return readStoredTimeline();
}

export function recordVoiceTimelineEvent(input: VoiceTimelineEventInput) {
  const at = input.at ?? Date.now();
  const event: VoiceTimelineEvent = {
    ...input,
    id: timelineId(input.kind, at),
    at,
    severity: input.severity ?? KIND_SEVERITY[input.kind],
  };
  const next = [...readStoredTimeline(), event].slice(-MAX_TIMELINE_EVENTS);
  writeStoredTimeline(next);
  notifyTimelineSubscribers();
  scheduleVoiceTimelineSync();
  return event;
}

export function clearVoiceTimeline() {
  writeStoredTimeline(EMPTY_EVENTS);
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
      window.localStorage.removeItem(TIMELINE_SYNCED_STORAGE_KEY);
      lastStoredTimelineRaw = null;
    } catch {
      // Ignore local storage cleanup failures.
    }
  }
  notifyTimelineSubscribers();
}

export function subscribeVoiceTimeline(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(TIMELINE_UPDATED_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(TIMELINE_UPDATED_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function eventForServer(event: VoiceTimelineEvent) {
  return {
    id: event.id,
    at: event.at,
    kind: event.kind,
    title: event.title,
    detail: event.detail,
    severity: event.severity,
    sessionId: event.sessionId,
    domain: event.domain,
    agentId: event.agentId,
    agentSlug: event.agentSlug,
    conversationPlanId: event.conversationPlanId,
    route: event.route,
    actionId: event.actionId,
    actionType: event.actionType,
    payload: event.payload,
  };
}

export function scheduleVoiceTimelineSync(delayMs = 700) {
  if (typeof window === "undefined" || !getToken()) return;
  if (timelineSyncTimer !== null) {
    window.clearTimeout(timelineSyncTimer);
  }
  timelineSyncTimer = window.setTimeout(() => {
    timelineSyncTimer = null;
    void flushVoiceTimelineEvents();
  }, delayMs);
}

export async function flushVoiceTimelineEvents() {
  if (typeof window === "undefined") return;
  const token = getToken();
  if (!token) return;
  if (timelineSyncPromise) return timelineSyncPromise;

  timelineSyncPromise = (async () => {
    const syncedIds = readSyncedEventIds();
    const unsyncedEvents = readStoredTimeline()
      .filter((event) => !syncedIds.has(event.id))
      .slice(-SYNC_BATCH_SIZE);

    if (unsyncedEvents.length === 0) return;

    const response = await fetch("/api/voice/timeline-events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "app",
        events: unsyncedEvents.map(eventForServer),
      }),
    });

    if (!response.ok) return;
    const data = await response.json().catch(() => null) as { received_client_event_ids?: string[] } | null;
    const acceptedIds = data?.received_client_event_ids?.length
      ? data.received_client_event_ids
      : unsyncedEvents.map((event) => event.id);
    for (const id of acceptedIds) syncedIds.add(id);
    writeSyncedEventIds(syncedIds);
  })().finally(() => {
    timelineSyncPromise = null;
  });

  return timelineSyncPromise;
}

function persistedEventFromApi(raw: Record<string, unknown>): PersistedVoiceTimelineEvent | null {
  if (typeof raw.id !== "string" || typeof raw.kind !== "string" || typeof raw.title !== "string") return null;
  const at = typeof raw.at === "number" ? raw.at : Date.now();
  const severity = ["info", "success", "warning", "error"].includes(String(raw.severity))
    ? raw.severity as VoiceTimelineEvent["severity"]
    : "info";

  return {
    id: raw.id,
    clientEventId: typeof raw.clientEventId === "string" ? raw.clientEventId : raw.id,
    userId: typeof raw.userId === "string" ? raw.userId : "",
    source: typeof raw.source === "string" ? raw.source : "app",
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : at,
    at,
    kind: raw.kind as VoiceTimelineEventKind,
    title: raw.title,
    detail: typeof raw.detail === "string" ? raw.detail : undefined,
    severity,
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    domain: typeof raw.domain === "string" ? raw.domain : undefined,
    agentId: typeof raw.agentId === "string" ? raw.agentId : undefined,
    agentSlug: typeof raw.agentSlug === "string" ? raw.agentSlug : undefined,
    conversationPlanId: typeof raw.conversationPlanId === "string" ? raw.conversationPlanId : undefined,
    route: typeof raw.route === "string" ? raw.route : undefined,
    actionId: typeof raw.actionId === "string" ? raw.actionId : undefined,
    actionType: typeof raw.actionType === "string" ? raw.actionType : undefined,
    payload: raw.payload && typeof raw.payload === "object" && !Array.isArray(raw.payload)
      ? raw.payload as Record<string, string | number | boolean>
      : {},
  };
}

export async function fetchPersistedVoiceTimelineEvents(limit = 120) {
  const token = getToken();
  if (!token) return [];
  const response = await fetch(`/api/admin/voice/timeline-events?limit=${Math.max(1, Math.min(limit, 240))}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return [];
  const data = await response.json().catch(() => null) as { events?: Array<Record<string, unknown>> } | null;
  return (data?.events ?? [])
    .map(persistedEventFromApi)
    .filter((event): event is PersistedVoiceTimelineEvent => Boolean(event));
}

export function useVoiceTimeline() {
  return useSyncExternalStore(
    subscribeVoiceTimeline,
    getVoiceTimelineEvents,
    () => EMPTY_EVENTS,
  );
}
