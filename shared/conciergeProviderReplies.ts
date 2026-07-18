import {
  buildConciergeProviderReplyResolution,
  parseConciergeProviderReplyResolution,
  type ConciergeProviderReplyResolution,
} from "./conciergeProviderReplyResolution";

export const CONCIERGE_PROVIDER_TASK_STATUSES = [
  "waiting",
  "reply_received",
  "action_needed",
  "done",
] as const;

export type ConciergeProviderTaskStatus = (typeof CONCIERGE_PROVIDER_TASK_STATUSES)[number];
export type ConciergeProviderReplySource = "simulated" | "live";

export type ConciergeProviderReplySnapshot = {
  status: ConciergeProviderTaskStatus;
  summary: string;
  reply: string;
  source: ConciergeProviderReplySource;
  receivedAt: string | null;
  followUpRequiresConfirmation: boolean;
  resolution: ConciergeProviderReplyResolution | null;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function explicitStatus(value: unknown): ConciergeProviderTaskStatus | null {
  return CONCIERGE_PROVIDER_TASK_STATUSES.includes(value as ConciergeProviderTaskStatus)
    ? value as ConciergeProviderTaskStatus
    : null;
}

function replySource(payload: Record<string, unknown>): ConciergeProviderReplySource {
  const explicit = text(payload.provider_reply_source);
  if (explicit === "simulated" || explicit === "live") return explicit;
  return payload.dry_run === true || payload.simulated_outcome === true ? "simulated" : "live";
}

export function conciergeProviderReplySnapshot(
  payloadValue: Record<string, unknown> | null | undefined,
  options: { completed?: boolean } = {},
): ConciergeProviderReplySnapshot | null {
  const payload = record(payloadValue);
  const response = record(payload.provider_response);
  const reply = text(response.reply) || text(payload.provider_reply);
  const summary = text(response.summary)
    || text(payload.provider_response_summary)
    || text(payload.provider_last_contact_summary)
    || reply;
  const receivedAt = text(response.received_at)
    || text(payload.provider_reply_received_at)
    || text(payload.provider_last_contact_at)
    || null;
  const hasProviderState = Boolean(
    explicitStatus(payload.provider_task_status)
    || reply
    || payload.waiting_for_provider === true
    || text(payload.provider_follow_up_status)
    || text(payload.provider_reply_status),
  );
  if (!hasProviderState && !options.completed) return null;

  let status = explicitStatus(payload.provider_task_status);
  if (options.completed) status = "done";
  if (!status && (text(payload.provider_reply_status) === "needs_more_info" || text(payload.provider_follow_up_status) === "needs_human_help")) {
    status = "action_needed";
  }
  if (!status && reply) status = "reply_received";
  if (!status && (payload.waiting_for_provider === true || text(payload.mission_status) === "awaiting_provider_reply")) {
    status = "waiting";
  }
  if (!status) return null;

  const resolution = parseConciergeProviderReplyResolution(
    payload.provider_reply_resolution || response.resolution,
  ) || (reply ? buildConciergeProviderReplyResolution({
    reply,
    summary,
    subject: text(payload.provider_inbound_subject) || text(payload.email_subject),
    channel: text(payload.provider_inbound_channel) || text(payload.execution_channel),
    knownFacts: payload,
  }) : null);

  return {
    status,
    summary,
    reply,
    source: replySource({ ...payload, ...response }),
    receivedAt,
    followUpRequiresConfirmation: status !== "done"
      && payload.provider_follow_up_confirmed !== true,
    resolution,
  };
}

export function buildConciergeProviderReplyPatch(input: {
  payload: Record<string, unknown> | null | undefined;
  reply: string;
  summary: string;
  source: ConciergeProviderReplySource;
  receivedAt?: string;
  details?: Record<string, unknown>;
  resolution?: ConciergeProviderReplyResolution;
}): Record<string, unknown> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const reply = input.reply.trim();
  const summary = input.summary.trim() || reply;
  const payload = {
    ...record(input.payload),
    ...record(input.details),
  };
  const resolution = input.resolution ?? buildConciergeProviderReplyResolution({
    reply,
    summary,
    subject: text(payload.provider_inbound_subject) || text(payload.email_subject),
    channel: text(payload.provider_inbound_channel) || text(payload.execution_channel),
    knownFacts: payload,
  });
  return {
    ...payload,
    provider_task_status: "reply_received",
    provider_reply_status: "confirmed",
    provider_reply: reply,
    provider_response_summary: summary,
    provider_reply_received_at: receivedAt,
    provider_reply_source: input.source,
    provider_reply_resolution: resolution,
    provider_response: {
      status: "reply_received",
      reply,
      summary,
      source: input.source,
      received_at: receivedAt,
      resolution,
    },
    waiting_for_provider: false,
    provider_follow_up_requires_confirmation: true,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
    live_handoff_status: "ready",
    live_handoff_outcome: "provider_replied",
    mission_status: "awaiting_user_save",
  };
}

export function buildConciergeProviderActionNeededPatch(input: {
  payload: Record<string, unknown> | null | undefined;
  question: string;
  source: ConciergeProviderReplySource;
  receivedAt?: string;
  resolution?: ConciergeProviderReplyResolution;
}): Record<string, unknown> {
  const receivedAt = input.receivedAt ?? new Date().toISOString();
  const question = input.question.trim();
  const payload = record(input.payload);
  const resolution = input.resolution ?? buildConciergeProviderReplyResolution({
    reply: question,
    summary: question,
    subject: text(payload.provider_inbound_subject) || text(payload.email_subject),
    channel: text(payload.provider_inbound_channel) || text(payload.execution_channel),
    knownFacts: payload,
  });
  return {
    ...payload,
    provider_task_status: "action_needed",
    provider_reply_status: "needs_more_info",
    provider_reply: question,
    provider_response_summary: question,
    provider_reply_received_at: receivedAt,
    provider_reply_source: input.source,
    provider_reply_resolution: resolution,
    provider_response: {
      status: "action_needed",
      reply: question,
      summary: question,
      source: input.source,
      received_at: receivedAt,
      resolution,
    },
    waiting_for_provider: false,
    provider_follow_up_requires_confirmation: true,
    provider_follow_up_confirmed: false,
    no_external_action_without_confirmation: true,
    live_handoff_status: "needs_human_help",
    live_handoff_outcome: "provider_needs_more_info",
    mission_status: "needs_info",
  };
}

export function conciergeProviderCompletionSummary(
  payload: Record<string, unknown> | null | undefined,
  fallback: string,
): string {
  const snapshot = conciergeProviderReplySnapshot(payload, { completed: true });
  return snapshot?.summary || fallback;
}
