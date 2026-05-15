import { useSyncExternalStore } from "react";

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

type VoiceTimelineEventInput = Omit<VoiceTimelineEvent, "id" | "at" | "severity"> & {
  at?: number;
  severity?: VoiceTimelineEvent["severity"];
};

const TIMELINE_STORAGE_KEY = "vyva.voice.timeline.v1";
const TIMELINE_UPDATED_EVENT = "vyva:voice-timeline-updated";
const MAX_TIMELINE_EVENTS = 240;
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
  simulator: "info",
};

let memoryTimeline: VoiceTimelineEvent[] = EMPTY_EVENTS;

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
    if (!raw) return memoryTimeline;
    const parsed = JSON.parse(raw) as VoiceTimelineEvent[];
    if (!Array.isArray(parsed)) return EMPTY_EVENTS;
    memoryTimeline = parsed
      .filter((event) => event && typeof event.id === "string" && typeof event.at === "number")
      .slice(-MAX_TIMELINE_EVENTS);
    return memoryTimeline;
  } catch {
    return memoryTimeline;
  }
}

function writeStoredTimeline(events: VoiceTimelineEvent[]) {
  memoryTimeline = events.slice(-MAX_TIMELINE_EVENTS);
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(TIMELINE_STORAGE_KEY, JSON.stringify(memoryTimeline));
    } catch {
      // Local storage is best-effort; keep the in-memory timeline.
    }
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
  return event;
}

export function clearVoiceTimeline() {
  writeStoredTimeline(EMPTY_EVENTS);
  if (canUseStorage()) {
    try {
      window.localStorage.removeItem(TIMELINE_STORAGE_KEY);
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

export function useVoiceTimeline() {
  return useSyncExternalStore(
    subscribeVoiceTimeline,
    getVoiceTimelineEvents,
    () => EMPTY_EVENTS,
  );
}
