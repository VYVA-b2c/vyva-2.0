import { desc, eq, sql } from "drizzle-orm";
import { db, pool } from "../db.js";
export { verifyElevenLabsWebhookSignature } from "../../shared/elevenLabsWebhookSignature.js";
import {
  elevenlabsConversationAccessEvents,
  elevenlabsConversations,
  type ElevenLabsConversationRow,
} from "../../shared/schema.js";

export const ELEVENLABS_REVIEW_STATUSES = [
  "unreviewed",
  "reviewed",
  "needs_follow_up",
  "quality_issue",
] as const;

export type ElevenLabsReviewStatus = typeof ELEVENLABS_REVIEW_STATUSES[number];
export type ElevenLabsAccessAction = "view_details" | "play_audio" | "review_update";

export class ElevenLabsProviderError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown, maxLength = 500): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dateFromSeconds(value: unknown): Date | null {
  const seconds = number(value);
  return seconds === null ? null : new Date(seconds * 1000);
}

function retentionDays() {
  const parsed = Number.parseInt(process.env.ELEVENLABS_CONVERSATION_RETENTION_DAYS ?? "30", 10);
  return Math.max(1, Math.min(Number.isFinite(parsed) ? parsed : 30, 365));
}

function retentionDate(completedAt: Date) {
  return new Date(completedAt.getTime() + retentionDays() * 86_400_000);
}

function allowedAgentIds() {
  const configured = process.env.ELEVENLABS_ADMIN_REVIEW_AGENT_IDS || process.env.ELEVENLABS_DR_AI_AGENT_ID || "";
  return new Set(configured.split(",").map((value) => value.trim()).filter(Boolean));
}

export function isElevenLabsReviewStatus(value: unknown): value is ElevenLabsReviewStatus {
  return typeof value === "string" && ELEVENLABS_REVIEW_STATUSES.includes(value as ElevenLabsReviewStatus);
}

export type ElevenLabsWebhookMetadata = {
  providerConversationId: string;
  vyvaSessionId: string | null;
  userId: string | null;
  agentId: string | null;
  agentName: string | null;
  branchId: string | null;
  versionId: string | null;
  status: string;
  locale: string | null;
  callSuccessful: string | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  consentStatus: string;
  consentVersion: string | null;
  consentRecordedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date;
  durationSeconds: number | null;
};

export function extractElevenLabsWebhookMetadata(payload: unknown): ElevenLabsWebhookMetadata | null {
  const envelope = record(payload);
  if (envelope.type !== "post_call_transcription") return null;
  const data = record(envelope.data);
  const providerConversationId = text(data.conversation_id, 220);
  if (!providerConversationId || !/^[A-Za-z0-9._:-]+$/.test(providerConversationId)) return null;

  const agentId = text(data.agent_id, 220);
  const allowlist = allowedAgentIds();
  if (allowlist.size > 0 && (!agentId || !allowlist.has(agentId))) return null;

  const initiation = record(data.conversation_initiation_client_data);
  const dynamic = record(initiation.dynamic_variables);
  const metadata = record(data.metadata);
  const analysis = record(data.analysis);
  const transcript = Array.isArray(data.transcript) ? data.transcript : [];
  const durationSeconds = number(metadata.call_duration_secs);
  const startedAt = dateFromSeconds(metadata.start_time_unix_secs);
  const eventAt = dateFromSeconds(envelope.event_timestamp);
  const completedAt = eventAt ?? (startedAt && durationSeconds !== null
    ? new Date(startedAt.getTime() + durationSeconds * 1000)
    : new Date());
  const consentRecordedAt = text(dynamic.recording_consent_at, 80);

  return {
    providerConversationId,
    vyvaSessionId: text(dynamic.conversation_id, 220),
    userId: text(dynamic.user_id, 220),
    agentId,
    agentName: text(data.agent_name, 220),
    branchId: text(data.branch_id, 220),
    versionId: text(data.version_id, 220),
    status: text(data.status, 80) ?? "done",
    locale: text(dynamic.language, 24) ?? text(dynamic.locale, 24),
    callSuccessful: text(analysis.call_successful, 80),
    hasAudio: data.has_audio === true || metadata.has_audio === true,
    hasTranscript: transcript.length > 0,
    consentStatus: text(dynamic.recording_consent, 40) ?? "not_captured",
    consentVersion: text(dynamic.recording_consent_version, 120),
    consentRecordedAt: consentRecordedAt ? new Date(consentRecordedAt) : null,
    startedAt,
    completedAt,
    durationSeconds: durationSeconds === null ? null : Math.max(0, Math.round(durationSeconds)),
  };
}

let ensureTablesPromise: Promise<void> | null = null;

export function ensureElevenLabsConversationReviewTables() {
  ensureTablesPromise ??= (async () => {
    await pool.query(`
      create table if not exists elevenlabs_conversations (
        id uuid primary key default gen_random_uuid(), provider_conversation_id text not null unique,
        vyva_session_id text, user_id text, agent_id text, agent_name text, branch_id text, version_id text,
        status text not null default 'done', locale text, call_successful text,
        has_audio boolean not null default false, has_transcript boolean not null default false,
        consent_status text not null default 'not_captured', consent_version text, consent_recorded_at timestamptz,
        started_at timestamptz, completed_at timestamptz, duration_seconds integer,
        retention_delete_at timestamptz not null, provider_deleted_at timestamptz,
        review_status text not null default 'unreviewed', review_note text, reviewed_by text, reviewed_at timestamptz,
        last_provider_sync_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
      )
    `);
    await pool.query(`create index if not exists elevenlabs_conversations_user_completed_idx on elevenlabs_conversations (user_id, completed_at desc)`);
    await pool.query(`create index if not exists elevenlabs_conversations_review_completed_idx on elevenlabs_conversations (review_status, completed_at desc)`);
    await pool.query(`create index if not exists elevenlabs_conversations_retention_idx on elevenlabs_conversations (retention_delete_at)`);
    await pool.query(`
      create table if not exists elevenlabs_conversation_access_events (
        id uuid primary key default gen_random_uuid(),
        conversation_id uuid not null references elevenlabs_conversations(id) on delete cascade,
        provider_conversation_id text not null, actor_user_id text not null, action text not null,
        reason text not null, succeeded boolean not null default true, metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    `);
    await pool.query(`create index if not exists elevenlabs_access_events_conversation_created_idx on elevenlabs_conversation_access_events (conversation_id, created_at desc)`);
    await pool.query(`create index if not exists elevenlabs_access_events_actor_created_idx on elevenlabs_conversation_access_events (actor_user_id, created_at desc)`);
  })().catch((error) => {
    ensureTablesPromise = null;
    throw error;
  });
  return ensureTablesPromise;
}

export async function ingestElevenLabsPostCall(payload: unknown) {
  const metadata = extractElevenLabsWebhookMetadata(payload);
  if (!metadata) return { accepted: false as const };
  await ensureElevenLabsConversationReviewTables();
  const [conversation] = await db.insert(elevenlabsConversations).values({
    provider_conversation_id: metadata.providerConversationId,
    vyva_session_id: metadata.vyvaSessionId,
    user_id: metadata.userId,
    agent_id: metadata.agentId,
    agent_name: metadata.agentName,
    branch_id: metadata.branchId,
    version_id: metadata.versionId,
    status: metadata.status,
    locale: metadata.locale,
    call_successful: metadata.callSuccessful,
    has_audio: metadata.hasAudio,
    has_transcript: metadata.hasTranscript,
    consent_status: metadata.consentStatus,
    consent_version: metadata.consentVersion,
    consent_recorded_at: metadata.consentRecordedAt,
    started_at: metadata.startedAt,
    completed_at: metadata.completedAt,
    duration_seconds: metadata.durationSeconds,
    retention_delete_at: retentionDate(metadata.completedAt),
  }).onConflictDoUpdate({
    target: elevenlabsConversations.provider_conversation_id,
    set: {
      vyva_session_id: metadata.vyvaSessionId,
      user_id: metadata.userId,
      agent_id: metadata.agentId,
      agent_name: metadata.agentName,
      branch_id: metadata.branchId,
      version_id: metadata.versionId,
      status: metadata.status,
      locale: metadata.locale,
      call_successful: metadata.callSuccessful,
      has_audio: metadata.hasAudio,
      has_transcript: metadata.hasTranscript,
      consent_status: metadata.consentStatus,
      consent_version: metadata.consentVersion,
      consent_recorded_at: metadata.consentRecordedAt,
      started_at: metadata.startedAt,
      completed_at: metadata.completedAt,
      duration_seconds: metadata.durationSeconds,
      retention_delete_at: retentionDate(metadata.completedAt),
      updated_at: sql`now()`,
    },
  }).returning();
  return { accepted: true as const, conversation };
}

function availability(row: ElevenLabsConversationRow) {
  const withinRetention = row.retention_delete_at.getTime() > Date.now();
  return {
    details: withinRetention && !row.provider_deleted_at && row.has_transcript,
    audio: withinRetention && !row.provider_deleted_at && row.has_audio,
    reason: !withinRetention ? "retention_expired" : row.provider_deleted_at ? "provider_deleted" : null,
  };
}

export function elevenLabsConversationToApi(row: ElevenLabsConversationRow) {
  return {
    id: row.id,
    providerConversationId: row.provider_conversation_id,
    vyvaSessionId: row.vyva_session_id,
    userId: row.user_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    status: row.status,
    locale: row.locale,
    callSuccessful: row.call_successful,
    hasAudio: row.has_audio,
    hasTranscript: row.has_transcript,
    consentStatus: row.consent_status,
    consentVersion: row.consent_version,
    consentRecordedAt: row.consent_recorded_at?.getTime() ?? null,
    startedAt: row.started_at?.getTime() ?? null,
    completedAt: row.completed_at?.getTime() ?? null,
    durationSeconds: row.duration_seconds,
    retentionDeleteAt: row.retention_delete_at.getTime(),
    reviewStatus: row.review_status,
    reviewNote: row.review_note ?? "",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at?.getTime() ?? null,
    availability: availability(row),
  };
}

export async function listElevenLabsConversations(limit = 100) {
  await ensureElevenLabsConversationReviewTables();
  return db.select().from(elevenlabsConversations)
    .orderBy(desc(elevenlabsConversations.completed_at), desc(elevenlabsConversations.created_at))
    .limit(Math.max(1, Math.min(limit, 250)));
}

export async function findElevenLabsConversation(providerConversationId: string) {
  await ensureElevenLabsConversationReviewTables();
  const [row] = await db.select().from(elevenlabsConversations)
    .where(eq(elevenlabsConversations.provider_conversation_id, providerConversationId)).limit(1);
  return row ?? null;
}

export async function auditElevenLabsConversationAccess(input: {
  conversation: ElevenLabsConversationRow;
  actorUserId: string;
  action: ElevenLabsAccessAction;
  reason: string;
  succeeded: boolean;
  metadata?: JsonRecord;
}) {
  await ensureElevenLabsConversationReviewTables();
  await db.insert(elevenlabsConversationAccessEvents).values({
    conversation_id: input.conversation.id,
    provider_conversation_id: input.conversation.provider_conversation_id,
    actor_user_id: input.actorUserId.slice(0, 220),
    action: input.action,
    reason: input.reason.trim().slice(0, 500),
    succeeded: input.succeeded,
    metadata: input.metadata ?? {},
  });
}

function requireProviderAccess(row: ElevenLabsConversationRow, content: "details" | "audio") {
  const state = availability(row);
  if (!state[content]) {
    throw new ElevenLabsProviderError(
      state.reason === "retention_expired" ? "The review retention window has expired" : "This provider content is unavailable",
      410,
    );
  }
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new ElevenLabsProviderError("ElevenLabs review access is not configured", 503);
  return apiKey;
}

async function providerFetch(row: ElevenLabsConversationRow, suffix: string) {
  const apiKey = requireProviderAccess(row, suffix === "/audio" ? "audio" : "details");
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(row.provider_conversation_id)}${suffix}`, {
    headers: { "xi-api-key": apiKey },
  });
  if (response.status === 404 || response.status === 410) {
    await db.update(elevenlabsConversations).set({ provider_deleted_at: new Date(), updated_at: sql`now()` })
      .where(eq(elevenlabsConversations.id, row.id));
    throw new ElevenLabsProviderError("The conversation is no longer available at ElevenLabs", 410);
  }
  if (!response.ok) throw new ElevenLabsProviderError("ElevenLabs could not provide this conversation", 502);
  await db.update(elevenlabsConversations).set({ last_provider_sync_at: new Date(), updated_at: sql`now()` })
    .where(eq(elevenlabsConversations.id, row.id));
  return response;
}

export async function retrieveElevenLabsConversationDetails(row: ElevenLabsConversationRow) {
  const response = await providerFetch(row, "");
  const data = record(await response.json());
  const analysis = record(data.analysis);
  const transcript = (Array.isArray(data.transcript) ? data.transcript : []).slice(0, 500).map((turn) => {
    const item = record(turn);
    return {
      role: text(item.role, 20) ?? "unknown",
      message: text(item.message, 6_000) ?? "",
      timeInCallSeconds: number(item.time_in_call_secs),
      interrupted: item.interrupted === true,
    };
  }).filter((turn) => turn.message);
  return {
    providerConversationId: row.provider_conversation_id,
    status: text(data.status, 80) ?? row.status,
    summary: text(analysis.transcript_summary, 6_000) ?? "",
    callSuccessful: text(analysis.call_successful, 80) ?? row.call_successful,
    transcript,
  };
}

export async function retrieveElevenLabsConversationAudio(row: ElevenLabsConversationRow) {
  const response = await providerFetch(row, "/audio");
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}

export async function updateElevenLabsConversationReview(input: {
  conversation: ElevenLabsConversationRow;
  status: ElevenLabsReviewStatus;
  note?: string | null;
  reviewedBy: string;
}) {
  const [row] = await db.update(elevenlabsConversations).set({
    review_status: input.status,
    review_note: text(input.note, 2_400),
    reviewed_by: input.reviewedBy.slice(0, 220),
    reviewed_at: new Date(),
    updated_at: sql`now()`,
  }).where(eq(elevenlabsConversations.id, input.conversation.id)).returning();
  return row;
}
