import type { Pool, PoolClient } from "pg";
import { pool } from "../db.js";
import {
  classifyConciergeInboundReply,
  normalizeInboundEmailAddress,
  type ConciergeInboundReplyCandidate,
  type ConciergeInboundReplyClassification,
  type ConciergeInboundReplyReviewItem,
} from "../../shared/conciergeInboundReplies.js";
import {
  buildConciergeProviderActionNeededPatch,
  buildConciergeProviderReplyPatch,
} from "../../shared/conciergeProviderReplies.js";
import { buildConciergeProviderReplyResolution } from "../../shared/conciergeProviderReplyResolution.js";
import { pendingIdFromConciergeReplyRecipient } from "./conciergeInboundEmailRouting.js";

export type ConciergeInboundProviderEmail = {
  channel: "email";
  providerEventId: string;
  webhookEventId: string | null;
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  text: string | null;
  html: string | null;
  receivedAt: string;
  providerMetadata?: Record<string, unknown>;
};

export type ConciergeInboundReplyResult = {
  status: "matched" | "unmatched" | "duplicate";
  messageId: string;
  pendingId: string | null;
  providerTaskStatus: "reply_received" | "action_needed" | null;
  reason: string | null;
};

export type ConciergeInboundPendingMatch = {
  id: string;
  userId: string;
  providerName: string | null;
  providerEmail: string | null;
  actionPayload: Record<string, unknown>;
};

export type StoredConciergeInboundReply = {
  id: string;
  providerEventId: string;
  senderEmail: string;
  recipientEmails: string[];
  subject: string;
  bodyText: string;
  receivedAt: string;
  providerMetadata: Record<string, unknown>;
};

export interface ConciergeInboundReplyRepository {
  reserve(message: ConciergeInboundProviderEmail, classification: ConciergeInboundReplyClassification): Promise<{ id: string; duplicate: boolean }>;
  findOpenPendingById(pendingId: string): Promise<ConciergeInboundPendingMatch | null>;
  findOpenPendingBySender(senderEmail: string): Promise<ConciergeInboundPendingMatch[]>;
  attach(input: {
    messageId: string;
    pending: ConciergeInboundPendingMatch;
    patch: Record<string, unknown>;
    classification: ConciergeInboundReplyClassification;
    matchMethod: "signed_recipient" | "unique_sender" | "admin_review";
    reviewedBy?: string | null;
  }): Promise<boolean>;
  markUnmatched(messageId: string, reason: string): Promise<void>;
  markFailed(messageId: string, reason: string): Promise<void>;
  getMessage(messageId: string): Promise<StoredConciergeInboundReply | null>;
  ignore(messageId: string, reviewedBy: string): Promise<boolean>;
  listReviewItems(): Promise<ConciergeInboundReplyReviewItem[]>;
}
type PendingMatchRow = {
  id: string;
  user_id: string;
  provider_name: string | null;
  provider_email: string | null;
  action_payload: Record<string, unknown> | null;
};

type InboundRow = {
  id: string;
  provider_event_id: string;
  sender_email: string;
  recipient_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  received_at: Date | string;
  provider_metadata: Record<string, unknown> | null;
};

const PROVIDER_EMAIL_SQL = `
  coalesce(
    nullif(cp.action_payload->>'provider_email', ''),
    nullif(cp.action_payload->>'recipient_email', ''),
    nullif(cp.action_payload->'execution_adapter'->>'provider_contact', ''),
    nullif(cp.action_payload->'adapter_result'->>'provider_contact', ''),
    nullif(up.email, '')
  )
`;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function pendingMatch(row: PendingMatchRow): ConciergeInboundPendingMatch {
  return {
    id: row.id,
    userId: row.user_id,
    providerName: row.provider_name,
    providerEmail: row.provider_email,
    actionPayload: record(row.action_payload),
  };
}

function dateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function withInboundReplySafetyReset(
  patch: Record<string, unknown>,
  classification: ConciergeInboundReplyClassification,
  message: Pick<ConciergeInboundProviderEmail, "providerEventId" | "senderEmail" | "subject" | "receivedAt">,
): Record<string, unknown> {
  const executionTask = record(patch.execution_task);
  const audit = Array.isArray(patch.execution_audit) ? patch.execution_audit : [];
  return {
    ...patch,
    provider_inbound_message_id: message.providerEventId,
    provider_inbound_channel: "email",
    provider_inbound_sender: message.senderEmail,
    provider_inbound_subject: message.subject,
    provider_inbound_received_at: message.receivedAt,
    provider_follow_up_requires_confirmation: true,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
    ...(executionTask.version === 1 ? {
      execution_task: {
        ...executionTask,
        lifecycle_status: classification.actionNeeded ? "needs_info" : "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
        confirmation_source: "provider_email_reply_received",
        updated_at: message.receivedAt,
      },
    } : {}),
    execution_audit: [
      ...audit,
      {
        event: "provider_email_reply_received",
        at: message.receivedAt,
        source: "resend_inbound",
        pending_status: "pending",
        lifecycle_status: classification.actionNeeded ? "needs_info" : "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
        provider_message_id: message.providerEventId,
      },
    ],
  };
}

function providerReplyPatch(
  pending: ConciergeInboundPendingMatch,
  classification: ConciergeInboundReplyClassification,
  message: ConciergeInboundProviderEmail,
): Record<string, unknown> {
  const resolution = buildConciergeProviderReplyResolution({
    reply: classification.reply,
    summary: classification.summary,
    subject: message.subject,
    channel: message.channel,
    knownFacts: pending.actionPayload,
  });
  const actionNeeded = resolution.primaryAction !== "mark_complete";
  const resolvedClassification: ConciergeInboundReplyClassification = {
    ...classification,
    status: actionNeeded ? "action_needed" : "reply_received",
    actionNeeded,
    summary: resolution.summary,
    resolution,
  };
  const base = actionNeeded
    ? buildConciergeProviderActionNeededPatch({
        payload: pending.actionPayload,
        question: classification.reply,
        source: "live",
        receivedAt: message.receivedAt,
        resolution,
      })
    : buildConciergeProviderReplyPatch({
        payload: pending.actionPayload,
        reply: classification.reply,
        summary: resolution.summary,
        source: "live",
        receivedAt: message.receivedAt,
        resolution,
      });
  return withInboundReplySafetyReset(base, resolvedClassification, message);
}

function signedPendingId(recipients: string[]): string | null {
  for (const recipient of recipients) {
    const pendingId = pendingIdFromConciergeReplyRecipient(recipient);
    if (pendingId) return pendingId;
  }
  return null;
}

export async function ingestConciergeInboundReply(
  rawMessage: ConciergeInboundProviderEmail,
  repository: ConciergeInboundReplyRepository = postgresConciergeInboundReplyRepository,
): Promise<ConciergeInboundReplyResult> {
  const message: ConciergeInboundProviderEmail = {
    ...rawMessage,
    senderEmail: normalizeInboundEmailAddress(rawMessage.senderEmail),
    recipientEmails: rawMessage.recipientEmails.map(normalizeInboundEmailAddress).filter(Boolean),
  };
  const classification = classifyConciergeInboundReply(message);
  const reserved = await repository.reserve(message, classification);
  if (reserved.duplicate) {
    return {
      status: "duplicate",
      messageId: reserved.id,
      pendingId: null,
      providerTaskStatus: null,
      reason: "already_received",
    };
  }

  try {
    const routedPendingId = signedPendingId(message.recipientEmails);
    let pending: ConciergeInboundPendingMatch | null = null;
    let matchMethod: "signed_recipient" | "unique_sender" = "unique_sender";
    let unmatchedReason = "no_matching_task";

    if (routedPendingId) {
      matchMethod = "signed_recipient";
      pending = await repository.findOpenPendingById(routedPendingId);
      if (!pending) {
        unmatchedReason = "signed_task_not_available";
      } else {
        const expectedSender = normalizeInboundEmailAddress(pending.providerEmail);
        if (expectedSender && expectedSender !== message.senderEmail) {
          pending = null;
          unmatchedReason = "provider_sender_mismatch";
        }
      }
    } else {
      const senderMatches = await repository.findOpenPendingBySender(message.senderEmail);
      if (senderMatches.length === 1) {
        pending = senderMatches[0];
      } else if (senderMatches.length > 1) {
        unmatchedReason = "multiple_open_tasks_for_sender";
      }
    }

    if (!pending) {
      await repository.markUnmatched(reserved.id, unmatchedReason);
      return {
        status: "unmatched",
        messageId: reserved.id,
        pendingId: null,
        providerTaskStatus: null,
        reason: unmatchedReason,
      };
    }

    const attached = await repository.attach({
      messageId: reserved.id,
      pending,
      patch: providerReplyPatch(pending, classification, message),
      classification,
      matchMethod,
    });
    if (!attached) {
      await repository.markUnmatched(reserved.id, "task_closed_before_attach");
      return {
        status: "unmatched",
        messageId: reserved.id,
        pendingId: null,
        providerTaskStatus: null,
        reason: "task_closed_before_attach",
      };
    }

    return {
      status: "matched",
      messageId: reserved.id,
      pendingId: pending.id,
      providerTaskStatus: classification.status,
      reason: null,
    };
  } catch (error) {
    await repository.markFailed(reserved.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function linkConciergeInboundReply(
  input: { messageId: string; pendingId: string; reviewedBy: string },
  repository: ConciergeInboundReplyRepository = postgresConciergeInboundReplyRepository,
): Promise<boolean> {
  const [message, pending] = await Promise.all([
    repository.getMessage(input.messageId),
    repository.findOpenPendingById(input.pendingId),
  ]);
  if (!message || !pending) return false;
  const classification = classifyConciergeInboundReply({ text: message.bodyText, subject: message.subject });
  const normalizedMessage: ConciergeInboundProviderEmail = {
    channel: "email",
    providerEventId: message.providerEventId,
    webhookEventId: null,
    senderEmail: message.senderEmail,
    recipientEmails: message.recipientEmails,
    subject: message.subject,
    text: message.bodyText,
    html: null,
    receivedAt: message.receivedAt,
    providerMetadata: message.providerMetadata,
  };
  return repository.attach({
    messageId: message.id,
    pending,
    patch: providerReplyPatch(pending, classification, normalizedMessage),
    classification,
    matchMethod: "admin_review",
    reviewedBy: input.reviewedBy,
  });
}

async function pendingById(database: Pool, pendingId: string): Promise<ConciergeInboundPendingMatch | null> {
  const result = await database.query<PendingMatchRow>(`
    select
      cp.id::text,
      cp.user_id,
      cp.provider_name,
      ${PROVIDER_EMAIL_SQL} as provider_email,
      cp.action_payload
    from concierge_pending cp
    left join user_providers up on up.id = cp.provider_id
    where cp.id = $1::uuid
      and cp.status in ('pending', 'calling')
      and coalesce(cp.action_payload->>'provider_task_status', '') <> 'done'
    limit 1
  `, [pendingId]);
  return result.rows[0] ? pendingMatch(result.rows[0]) : null;
}

async function attachWithClient(client: PoolClient, input: Parameters<ConciergeInboundReplyRepository["attach"]>[0]): Promise<boolean> {
  const messageResult = await client.query<{ match_status: string }>(`
    select match_status
    from concierge_inbound_messages
    where id = $1::uuid
    for update
  `, [input.messageId]);
  const messageStatus = messageResult.rows[0]?.match_status;
  if (!messageStatus || messageStatus === "ignored") return false;
  if (messageStatus === "matched") return true;

  const pendingResult = await client.query<{ id: string }>(`
    select id::text
    from concierge_pending
    where id = $1::uuid
      and status in ('pending', 'calling')
      and coalesce(action_payload->>'provider_task_status', '') <> 'done'
    for update
  `, [input.pending.id]);
  if (!pendingResult.rows[0]) return false;

  await client.query(`
    update concierge_pending
    set action_payload = $2::jsonb, status = 'pending', updated_at = now()
    where id = $1::uuid
  `, [input.pending.id, JSON.stringify(input.patch)]);

  await client.query(`
    update concierge_sessions
    set
      action_payload = $2::jsonb,
      outcome_payload = coalesce(outcome_payload, '{}'::jsonb) || $3::jsonb,
      outcome_summary = $4
    where id = (
      select id
      from concierge_sessions
      where pending_id = $1::uuid
        and outcome_payload->>'receipt_kind' = 'provider_contact_sent'
      order by completed_at desc nulls last
      limit 1
    )
  `, [
    input.pending.id,
    JSON.stringify(input.patch),
    JSON.stringify({
      provider_task_status: input.patch.provider_task_status ?? input.classification.status,
      provider_reply: input.classification.reply,
      provider_response_summary: input.patch.provider_response_summary ?? input.classification.summary,
      provider_reply_resolution: input.patch.provider_reply_resolution ?? input.classification.resolution,
      provider_reply_source: "live",
      provider_follow_up_requires_confirmation: true,
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
      inbound_message_id: input.messageId,
    }),
    `Provider replied: ${input.classification.summary}`,
  ]);

  await client.query(`
    update concierge_inbound_messages
    set
      matched_pending_id = $2::uuid,
      match_status = 'matched',
      match_method = $3,
      match_reason = null,
      action_needed = $4,
      review_status = 'resolved',
      reviewed_by = coalesce($5, reviewed_by),
      reviewed_at = case when $5 is null then reviewed_at else now() end,
      updated_at = now()
    where id = $1::uuid
  `, [input.messageId, input.pending.id, input.matchMethod, input.classification.actionNeeded, input.reviewedBy ?? null]);
  return true;
}

export class PostgresConciergeInboundReplyRepository implements ConciergeInboundReplyRepository {
  constructor(private readonly database: Pool = pool) {}

  async reserve(message: ConciergeInboundProviderEmail, classification: ConciergeInboundReplyClassification) {
    const result = await this.database.query<{ id: string; duplicate: boolean }>(`
      with restarted as (
        update concierge_inbound_messages
        set match_status = 'processing', match_reason = null, updated_at = now()
        where channel = $1
          and provider_event_id = $2
          and match_status = 'failed'
        returning id::text
      ), inserted as (
        insert into concierge_inbound_messages (
          channel, provider_event_id, webhook_event_id, sender_email, recipient_emails,
          subject, body_text, received_at, action_needed, provider_metadata
        )
        select $1, $2, $3, $4, $5::text[], $6, $7, $8::timestamptz, $9, $10::jsonb
        where not exists (select 1 from restarted)
        on conflict (channel, provider_event_id) do nothing
        returning id::text
      ), claimed as (
        select id, false as duplicate from restarted
        union all
        select id, false as duplicate from inserted
      )
      select id, duplicate from claimed
      union all
      select id::text, true as duplicate
      from concierge_inbound_messages
      where channel = $1 and provider_event_id = $2
        and not exists (select 1 from claimed)
      limit 1
    `, [
      message.channel,
      message.providerEventId,
      message.webhookEventId,
      message.senderEmail,
      message.recipientEmails,
      message.subject,
      classification.reply,
      message.receivedAt,
      classification.actionNeeded,
      JSON.stringify(message.providerMetadata ?? {}),
    ]);
    const row = result.rows[0];
    if (!row) throw new Error("Inbound email receipt could not be reserved.");
    return row;
  }

  findOpenPendingById(pendingId: string) {
    return pendingById(this.database, pendingId);
  }

  async findOpenPendingBySender(senderEmail: string) {
    const result = await this.database.query<PendingMatchRow>(`
      select
        cp.id::text,
        cp.user_id,
        cp.provider_name,
        ${PROVIDER_EMAIL_SQL} as provider_email,
        cp.action_payload
      from concierge_pending cp
      left join user_providers up on up.id = cp.provider_id
      where cp.status in ('pending', 'calling')
        and coalesce(cp.action_payload->>'provider_task_status', '') <> 'done'
        and lower(${PROVIDER_EMAIL_SQL}) = lower($1)
      order by cp.updated_at desc nulls last
      limit 3
    `, [senderEmail]);
    return result.rows.map(pendingMatch);
  }

  async attach(input: Parameters<ConciergeInboundReplyRepository["attach"]>[0]) {
    const client = await this.database.connect();
    try {
      await client.query("begin");
      const attached = await attachWithClient(client, input);
      await client.query("commit");
      return attached;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async markUnmatched(messageId: string, reason: string) {
    await this.database.query(`
      update concierge_inbound_messages
      set match_status = 'unmatched', match_reason = $2, review_status = 'pending', updated_at = now()
      where id = $1::uuid and match_status <> 'matched'
    `, [messageId, reason]);
  }

  async markFailed(messageId: string, reason: string) {
    await this.database.query(`
      update concierge_inbound_messages
      set match_status = 'failed', match_reason = $2, updated_at = now()
      where id = $1::uuid and match_status <> 'matched'
    `, [messageId, reason.slice(0, 500)]);
  }

  async getMessage(messageId: string): Promise<StoredConciergeInboundReply | null> {
    const result = await this.database.query<InboundRow>(`
      select id::text, provider_event_id, sender_email, recipient_emails, subject, body_text,
             received_at, provider_metadata
      from concierge_inbound_messages
      where id = $1::uuid and match_status = 'unmatched' and review_status = 'pending'
      limit 1
    `, [messageId]);
    const row = result.rows[0];
    return row ? {
      id: row.id,
      providerEventId: row.provider_event_id,
      senderEmail: row.sender_email,
      recipientEmails: row.recipient_emails ?? [],
      subject: row.subject ?? "",
      bodyText: row.body_text ?? "",
      receivedAt: dateString(row.received_at),
      providerMetadata: record(row.provider_metadata),
    } : null;
  }

  async ignore(messageId: string, reviewedBy: string) {
    const result = await this.database.query(`
      update concierge_inbound_messages
      set match_status = 'ignored', review_status = 'ignored', reviewed_by = $2,
          reviewed_at = now(), updated_at = now()
      where id = $1::uuid and match_status = 'unmatched' and review_status = 'pending'
      returning id
    `, [messageId, reviewedBy]);
    return (result.rowCount ?? 0) > 0;
  }

  async listReviewItems(): Promise<ConciergeInboundReplyReviewItem[]> {
    const [messageResult, candidateResult] = await Promise.all([
      this.database.query<InboundRow & { match_reason: string | null }>(`
        select id::text, provider_event_id, sender_email, recipient_emails, subject, body_text,
               received_at, provider_metadata, match_reason
        from concierge_inbound_messages
        where match_status = 'unmatched' and review_status = 'pending'
        order by received_at desc
        limit 50
      `),
      this.database.query<{
        id: string;
        user_label: string | null;
        provider_name: string | null;
        action_summary: string;
        updated_at: Date | string | null;
      }>(`
        select cp.id::text, coalesce(p.preferred_name, p.full_name, p.email, 'VYVA user') as user_label,
               cp.provider_name, cp.action_summary, cp.updated_at
        from concierge_pending cp
        left join profiles p on p.id = cp.user_id
        where cp.status in ('pending', 'calling')
          and coalesce(cp.action_payload->>'provider_task_status', '') <> 'done'
        order by cp.updated_at desc nulls last
        limit 50
      `),
    ]);
    const candidates: ConciergeInboundReplyCandidate[] = candidateResult.rows.map((row) => ({
      id: row.id,
      userLabel: row.user_label ?? "VYVA user",
      providerName: row.provider_name ?? "Provider",
      actionSummary: row.action_summary,
      updatedAt: row.updated_at ? dateString(row.updated_at) : null,
    }));
    return messageResult.rows.map((row) => ({
      id: row.id,
      senderEmail: row.sender_email,
      subject: row.subject || "No subject",
      preview: (row.body_text || "Provider reply").replace(/\s+/g, " ").slice(0, 280),
      receivedAt: dateString(row.received_at),
      matchReason: row.match_reason,
      candidates,
    }));
  }
}

export const postgresConciergeInboundReplyRepository = new PostgresConciergeInboundReplyRepository();

export function listConciergeInboundReplyReviewItems() {
  return postgresConciergeInboundReplyRepository.listReviewItems();
}

export function ignoreConciergeInboundReply(messageId: string, reviewedBy: string) {
  return postgresConciergeInboundReplyRepository.ignore(messageId, reviewedBy);
}
