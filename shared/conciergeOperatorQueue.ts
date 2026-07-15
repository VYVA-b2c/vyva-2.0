import type { ConciergeExecutionTask, ConciergeExecutionTaskStatus } from "./conciergeActionExecution";

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
] as const;

export type OperatorConciergeQueueAction = typeof OPERATOR_CONCIERGE_QUEUE_ACTIONS[number];

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

export function executionTaskFromPayload(payload: unknown): ConciergeExecutionTask | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const task = (payload as Record<string, unknown>).execution_task;
  if (!task || typeof task !== "object" || Array.isArray(task)) return null;
  return task as ConciergeExecutionTask;
}
