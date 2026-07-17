import type { ConciergeExecutionTask, ConciergeExecutionTaskStatus } from "./conciergeActionExecution";
import type { ConciergeAdapterPayloadPreview } from "./conciergeAdapterPayloadContract";

export const OPERATOR_CONCIERGE_ADAPTER_STATUSES = [
  "blocked",
  "failed",
  "sent",
  "simulated",
] as const;

export type OperatorConciergeAdapterStatus = typeof OPERATOR_CONCIERGE_ADAPTER_STATUSES[number];

export const OPERATOR_CONCIERGE_QUEUE_STATUSES = [
  "needs_info",
  "ready",
  "confirmed",
  "in_progress",
  "done",
  "failed",
] as const;

export type OperatorConciergeQueueStatus = typeof OPERATOR_CONCIERGE_QUEUE_STATUSES[number];

export const OPERATOR_CONCIERGE_QUEUE_ACTIONS = [
  "assign",
  "in_progress",
  "done",
  "failed",
  "retry_adapter",
  "manual_follow_up",
] as const;

export type OperatorConciergeQueueAction = typeof OPERATOR_CONCIERGE_QUEUE_ACTIONS[number];

export type OperatorConciergeAdapterAttempt = {
  event: string;
  at: string | null;
  source: string | null;
  status: OperatorConciergeAdapterStatus | null;
  adapter: string | null;
  mode: string | null;
  channel: string | null;
  provider_name: string | null;
  provider_contact: string | null;
  result: string | null;
  result_id?: string | null;
  blocker?: string | null;
  error?: string | null;
  response_status?: number | null;
  reason?: string | null;
};

export type OperatorConciergeAdapterIncident = {
  status: OperatorConciergeAdapterStatus;
  adapter: string | null;
  mode: string | null;
  channel: string | null;
  tool: string | null;
  attempted_at: string | null;
  provider_name: string | null;
  provider_contact: string | null;
  external_action_allowed: boolean;
  result: string | null;
  result_id?: string | null;
  blocker?: string | null;
  error?: string | null;
  response_status?: number | null;
  simulated: boolean;
  live: boolean;
  retry_allowed: boolean;
  retry_blocker: string | null;
  manual_follow_up_allowed: boolean;
  manual_follow_up_queued_at: string | null;
  attempts: OperatorConciergeAdapterAttempt[];
};

export type OperatorConciergeQueueItem = {
  id: string;
  source: "pending" | "session";
  user_id: string;
  user_label: string;
  user_contact?: string | null;
  use_case: string;
  provider_name?: string | null;
  provider_phone?: string | null;
  action_summary: string;
  status: OperatorConciergeQueueStatus;
  pending_status?: string | null;
  flow_reference?: string | null;
  action_type?: string | null;
  active_tool?: string | null;
  operator_assigned_to?: string | null;
  operator_assigned_email?: string | null;
  operator_assigned_at?: string | null;
  missing_labels: string[];
  user_confirmed: boolean;
  confirmed_at?: string | null;
  updated_at?: string | null;
  adapter_incident?: OperatorConciergeAdapterIncident | null;
  adapter_payload_preview?: ConciergeAdapterPayloadPreview | null;
};

export type OperatorConciergeQueueTotals = Record<OperatorConciergeQueueStatus, number>;

export const OPERATOR_CONCIERGE_QUEUE_STATUS_LABELS: Record<OperatorConciergeQueueStatus, string> = {
  needs_info: "Needs info",
  ready: "Ready",
  confirmed: "Confirmed",
  in_progress: "In progress",
  done: "Done",
  failed: "Failed",
};

export function isOperatorConciergeQueueStatus(value: unknown): value is OperatorConciergeQueueStatus {
  return typeof value === "string" && OPERATOR_CONCIERGE_QUEUE_STATUSES.includes(value as OperatorConciergeQueueStatus);
}

export function isOperatorConciergeQueueAction(value: unknown): value is OperatorConciergeQueueAction {
  return typeof value === "string" && OPERATOR_CONCIERGE_QUEUE_ACTIONS.includes(value as OperatorConciergeQueueAction);
}

export function isOperatorConciergeAdapterStatus(value: unknown): value is OperatorConciergeAdapterStatus {
  return typeof value === "string" && OPERATOR_CONCIERGE_ADAPTER_STATUSES.includes(value as OperatorConciergeAdapterStatus);
}

export function normalizeOperatorConciergeQueueStatus(
  value: ConciergeExecutionTaskStatus | string | null | undefined,
): OperatorConciergeQueueStatus | null {
  if (value === "calling") return "in_progress";
  if (value === "completed") return "done";
  if (isOperatorConciergeQueueStatus(value)) return value;
  return null;
}

export function emptyOperatorConciergeQueueTotals(): OperatorConciergeQueueTotals {
  return {
    needs_info: 0,
    ready: 0,
    confirmed: 0,
    in_progress: 0,
    done: 0,
    failed: 0,
  };
}

export function buildOperatorConciergeQueueTotals(items: OperatorConciergeQueueItem[]): OperatorConciergeQueueTotals {
  return items.reduce((totals, item) => {
    totals[item.status] += 1;
    return totals;
  }, emptyOperatorConciergeQueueTotals());
}

export function filterOperatorConciergeQueueItems(
  items: OperatorConciergeQueueItem[],
  status: OperatorConciergeQueueStatus | "all",
): OperatorConciergeQueueItem[] {
  if (status === "all") return items;
  return items.filter((item) => item.status === status);
}

export function buildOperatorConciergeAdapterTotals(
  items: OperatorConciergeQueueItem[],
): Record<OperatorConciergeAdapterStatus, number> {
  return items.reduce<Record<OperatorConciergeAdapterStatus, number>>((totals, item) => {
    const status = item.adapter_incident?.status;
    if (status) totals[status] += 1;
    return totals;
  }, {
    blocked: 0,
    failed: 0,
    sent: 0,
    simulated: 0,
  });
}

export function executionTaskFromPayload(payload: unknown): ConciergeExecutionTask | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const task = (payload as Record<string, unknown>).execution_task;
  if (!task || typeof task !== "object" || Array.isArray(task)) return null;
  return task as ConciergeExecutionTask;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directAdapterResultFromPayload(payload: unknown): Record<string, unknown> | null {
  const data = objectPayload(payload);
  const executionAdapter = objectPayload(data.execution_adapter);
  if (executionAdapter.version === 1) return executionAdapter;
  const adapterResult = objectPayload(data.adapter_result);
  if (adapterResult.version === 1) return adapterResult;
  return null;
}

function adapterAttemptKey(result: Record<string, unknown>): string {
  return [
    stringValue(result.adapter) ?? "",
    stringValue(result.mode) ?? "",
    stringValue(result.channel) ?? "",
    stringValue(result.status) ?? "",
    stringValue(result.attempted_at) ?? "",
    stringValue(result.result_id) ?? "",
  ].join("|");
}

function adapterAttemptFromResult(
  result: Record<string, unknown>,
  event: string,
  at: string | null,
  source: string | null,
  reason: string | null,
): OperatorConciergeAdapterAttempt | null {
  const status = stringValue(result.status);
  if (!isOperatorConciergeAdapterStatus(status)) return null;
  return {
    event,
    at: at ?? stringValue(result.attempted_at),
    source,
    status,
    adapter: stringValue(result.adapter),
    mode: stringValue(result.mode),
    channel: stringValue(result.channel),
    provider_name: stringValue(result.provider_name),
    provider_contact: stringValue(result.provider_contact),
    result: stringValue(result.result),
    ...(stringValue(result.result_id) ? { result_id: stringValue(result.result_id) } : {}),
    ...(stringValue(result.blocker) ? { blocker: stringValue(result.blocker) } : {}),
    ...(stringValue(result.error) ? { error: stringValue(result.error) } : {}),
    ...(numberValue(result.response_status) !== null ? { response_status: numberValue(result.response_status) } : {}),
    ...(reason ? { reason } : {}),
  };
}

function auditAttemptsFromPayloads(payloads: unknown[]): OperatorConciergeAdapterAttempt[] {
  const attempts: OperatorConciergeAdapterAttempt[] = [];
  const seen = new Set<string>();

  for (const payload of payloads) {
    const audit = objectPayload(payload).execution_audit;
    if (!Array.isArray(audit)) continue;
    for (const entry of audit) {
      const auditEntry = objectPayload(entry);
      const event = stringValue(auditEntry.event);
      if (!event) continue;
      const adapterResult = objectPayload(auditEntry.adapter_result);
      if (adapterResult.version === 1) {
        const key = adapterAttemptKey(adapterResult);
        if (seen.has(key)) continue;
        const attempt = adapterAttemptFromResult(
          adapterResult,
          event,
          stringValue(auditEntry.at),
          stringValue(auditEntry.source),
          stringValue(auditEntry.reason),
        );
        if (attempt) {
          attempts.push(attempt);
          seen.add(key);
        }
        continue;
      }

      if (event === "adapter_retry_requested" || event === "adapter_manual_follow_up_queued") {
        attempts.push({
          event,
          at: stringValue(auditEntry.at),
          source: stringValue(auditEntry.source),
          status: null,
          adapter: null,
          mode: stringValue(auditEntry.execution_mode),
          channel: null,
          provider_name: null,
          provider_contact: null,
          result: null,
          reason: stringValue(auditEntry.reason),
        });
      }
    }
  }

  return attempts;
}

function latestAdapterResultFromPayloads(payloads: unknown[]): Record<string, unknown> | null {
  for (const payload of payloads) {
    const result = directAdapterResultFromPayload(payload);
    if (result) return result;
  }

  for (const payload of payloads) {
    const audit = objectPayload(payload).execution_audit;
    if (!Array.isArray(audit)) continue;
    for (const entry of [...audit].reverse()) {
      const result = objectPayload(objectPayload(entry).adapter_result);
      if (result.version === 1) return result;
    }
  }

  return null;
}

export function adapterIncidentFromPayload(...payloads: unknown[]): OperatorConciergeAdapterIncident | null {
  const latestResult = latestAdapterResultFromPayloads(payloads);
  const status = stringValue(latestResult?.status);
  if (!latestResult || !isOperatorConciergeAdapterStatus(status)) return null;

  const attempts = auditAttemptsFromPayloads(payloads);
  if (!attempts.some((attempt) => (
    attempt.status === status
      && attempt.adapter === stringValue(latestResult.adapter)
      && attempt.mode === stringValue(latestResult.mode)
      && attempt.channel === stringValue(latestResult.channel)
      && (attempt.result_id ?? null) === stringValue(latestResult.result_id)
  ))) {
    const directAttempt = adapterAttemptFromResult(
      latestResult,
      "latest_adapter_result",
      stringValue(latestResult.attempted_at),
      null,
      null,
    );
    if (directAttempt) attempts.push(directAttempt);
  }

  const manualFollowUp = [...attempts].reverse()
    .find((attempt) => attempt.event === "adapter_manual_follow_up_queued");
  const sortedAttempts = [...attempts].sort((a, b) => Date.parse(a.at ?? "") - Date.parse(b.at ?? ""));

  return {
    status,
    adapter: stringValue(latestResult.adapter),
    mode: stringValue(latestResult.mode),
    channel: stringValue(latestResult.channel),
    tool: stringValue(latestResult.tool),
    attempted_at: stringValue(latestResult.attempted_at),
    provider_name: stringValue(latestResult.provider_name),
    provider_contact: stringValue(latestResult.provider_contact),
    external_action_allowed: booleanValue(latestResult.external_action_allowed),
    result: stringValue(latestResult.result),
    ...(stringValue(latestResult.result_id) ? { result_id: stringValue(latestResult.result_id) } : {}),
    ...(stringValue(latestResult.blocker) ? { blocker: stringValue(latestResult.blocker) } : {}),
    ...(stringValue(latestResult.error) ? { error: stringValue(latestResult.error) } : {}),
    ...(numberValue(latestResult.response_status) !== null ? { response_status: numberValue(latestResult.response_status) } : {}),
    simulated: stringValue(latestResult.mode) === "dry_run" || status === "simulated",
    live: stringValue(latestResult.mode) === "live",
    retry_allowed: false,
    retry_blocker: null,
    manual_follow_up_allowed: false,
    manual_follow_up_queued_at: manualFollowUp?.at ?? null,
    attempts: sortedAttempts,
  };
}
