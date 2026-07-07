import { desc, eq } from "drizzle-orm";
import { db, pool } from "../db.js";
import { voiceTimelineEvents } from "../../shared/schema.js";

export const VOICE_TIMELINE_EVENT_KINDS = [
  "session_started",
  "context_resolved",
  "session_connected",
  "mic_muted",
  "mic_unmuted",
  "transfer_requested",
  "action_opened",
  "action_accepted",
  "action_completed",
  "action_dismissed",
  "session_ended",
  "session_error",
  "voice_triage_started",
  "voice_triage_step",
  "voice_triage_emergency",
  "voice_triage_completed",
  "voice_triage_tool_failed",
  "simulator",
] as const;

export const VOICE_TIMELINE_SEVERITIES = ["info", "success", "warning", "error"] as const;

export type VoiceTimelineEventKind = typeof VOICE_TIMELINE_EVENT_KINDS[number];
export type VoiceTimelineSeverity = typeof VOICE_TIMELINE_SEVERITIES[number];
export type VoiceTimelineEventRow = typeof voiceTimelineEvents.$inferSelect;

export type RawVoiceTimelineEvent = {
  id?: unknown;
  at?: unknown;
  kind?: unknown;
  title?: unknown;
  detail?: unknown;
  severity?: unknown;
  sessionId?: unknown;
  domain?: unknown;
  agentId?: unknown;
  agentSlug?: unknown;
  conversationPlanId?: unknown;
  route?: unknown;
  actionId?: unknown;
  actionType?: unknown;
  payload?: unknown;
};

type NormalizedVoiceTimelineEvent = {
  client_event_id: string;
  session_id: string | null;
  kind: VoiceTimelineEventKind;
  title: string;
  detail: string | null;
  severity: VoiceTimelineSeverity;
  domain: string | null;
  agent_id: string | null;
  agent_slug: string | null;
  conversation_plan_id: string | null;
  route: string | null;
  action_id: string | null;
  action_type: string | null;
  payload: Record<string, string | number | boolean>;
  client_at: Date | null;
};

let ensureTimelineTablePromise: Promise<void> | null = null;

function trimTo(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

function requiredString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isTimelineKind(value: unknown): value is VoiceTimelineEventKind {
  return typeof value === "string" && VOICE_TIMELINE_EVENT_KINDS.includes(value as VoiceTimelineEventKind);
}

function isTimelineSeverity(value: unknown): value is VoiceTimelineSeverity {
  return typeof value === "string" && VOICE_TIMELINE_SEVERITIES.includes(value as VoiceTimelineSeverity);
}

function primitivePayload(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => ["string", "number", "boolean"].includes(typeof item))
    .slice(0, 40)
    .map(([key, item]) => [
      key.slice(0, 120),
      typeof item === "string" ? item.slice(0, 500) : item,
    ]);
  return Object.fromEntries(entries) as Record<string, string | number | boolean>;
}

function clientDate(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function ensureVoiceTimelineEventsTable(): Promise<void> {
  ensureTimelineTablePromise ??= (async () => {
    await pool.query(`
      create table if not exists voice_timeline_events (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        client_event_id text not null,
        session_id text,
        kind text not null,
        title text not null,
        detail text,
        severity text not null default 'info',
        domain text,
        agent_id text,
        agent_slug text,
        conversation_plan_id text,
        route text,
        action_id text,
        action_type text,
        source text not null default 'app',
        payload jsonb not null default '{}'::jsonb,
        client_at timestamptz,
        created_at timestamptz not null default now(),
        constraint voice_timeline_events_user_client_event_unique unique (user_id, client_event_id)
      )
    `);
    await pool.query(`
      create index if not exists voice_timeline_events_created_idx
      on voice_timeline_events (created_at desc)
    `);
    await pool.query(`
      create index if not exists voice_timeline_events_user_created_idx
      on voice_timeline_events (user_id, created_at desc)
    `);
    await pool.query(`
      create index if not exists voice_timeline_events_kind_created_idx
      on voice_timeline_events (kind, created_at desc)
    `);
    await pool.query(`
      create index if not exists voice_timeline_events_session_idx
      on voice_timeline_events (session_id, created_at desc)
    `);
  })().catch((err) => {
    ensureTimelineTablePromise = null;
    throw err;
  });

  return ensureTimelineTablePromise;
}

export function normalizeVoiceTimelineEvent(raw: RawVoiceTimelineEvent): NormalizedVoiceTimelineEvent | null {
  const clientEventId = requiredString(raw.id, 220);
  const title = requiredString(raw.title, 260);
  if (!clientEventId || !title || !isTimelineKind(raw.kind)) return null;

  return {
    client_event_id: clientEventId,
    session_id: trimTo(raw.sessionId, 180),
    kind: raw.kind,
    title,
    detail: trimTo(raw.detail, 1000),
    severity: isTimelineSeverity(raw.severity) ? raw.severity : "info",
    domain: trimTo(raw.domain, 80),
    agent_id: trimTo(raw.agentId, 180),
    agent_slug: trimTo(raw.agentSlug, 120),
    conversation_plan_id: trimTo(raw.conversationPlanId, 180),
    route: trimTo(raw.route, 220),
    action_id: trimTo(raw.actionId, 220),
    action_type: trimTo(raw.actionType, 120),
    payload: primitivePayload(raw.payload),
    client_at: clientDate(raw.at),
  };
}

export async function recordVoiceTimelineEvents(input: {
  userId: string;
  events: RawVoiceTimelineEvent[];
  source?: string;
}) {
  const source = trimTo(input.source, 80) ?? "app";
  const rows = input.events
    .map(normalizeVoiceTimelineEvent)
    .filter((event): event is NormalizedVoiceTimelineEvent => Boolean(event))
    .slice(0, 80)
    .map((event) => ({
      ...event,
      user_id: input.userId,
      source,
    }));

  if (!input.userId || rows.length === 0) {
    return { stored: 0, receivedClientEventIds: [] as string[] };
  }

  await ensureVoiceTimelineEventsTable();
  await db
    .insert(voiceTimelineEvents)
    .values(rows)
    .onConflictDoNothing({
      target: [voiceTimelineEvents.user_id, voiceTimelineEvents.client_event_id],
    });

  return {
    stored: rows.length,
    receivedClientEventIds: rows.map((row) => row.client_event_id),
  };
}

export async function getRecentVoiceTimelineEvents(input: {
  userId?: string;
  limit?: number;
} = {}) {
  await ensureVoiceTimelineEventsTable();
  const limit = Math.max(1, Math.min(input.limit ?? 120, 240));
  const base = db
    .select()
    .from(voiceTimelineEvents)
    .orderBy(desc(voiceTimelineEvents.created_at))
    .limit(limit);

  if (!input.userId) return base;

  return db
    .select()
    .from(voiceTimelineEvents)
    .where(eq(voiceTimelineEvents.user_id, input.userId))
    .orderBy(desc(voiceTimelineEvents.created_at))
    .limit(limit);
}

export function voiceTimelineEventToApi(row: VoiceTimelineEventRow) {
  return {
    id: row.id,
    clientEventId: row.client_event_id,
    userId: row.user_id,
    at: row.client_at?.getTime() ?? row.created_at.getTime(),
    kind: row.kind,
    title: row.title,
    detail: row.detail ?? undefined,
    severity: row.severity,
    sessionId: row.session_id ?? undefined,
    domain: row.domain ?? undefined,
    agentId: row.agent_id ?? undefined,
    agentSlug: row.agent_slug ?? undefined,
    conversationPlanId: row.conversation_plan_id ?? undefined,
    route: row.route ?? undefined,
    actionId: row.action_id ?? undefined,
    actionType: row.action_type ?? undefined,
    payload: row.payload ?? {},
    source: row.source,
    createdAt: row.created_at.getTime(),
  };
}
