import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db.js";
import { withConciergeExecutionTask } from "../../shared/conciergeActionExecution.js";
import {
  OPERATOR_CONCIERGE_QUEUE_STATUSES,
  buildOperatorConciergeQueueTotals,
  executionTaskFromPayload,
  isOperatorConciergeQueueStatus,
  normalizeOperatorConciergeQueueStatus,
  type OperatorConciergeQueueItem,
  type OperatorConciergeQueueStatus,
} from "../../shared/conciergeOperatorQueue.js";

const router = Router();

type PendingQueueRow = {
  id: string;
  user_id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  action_summary: string | null;
  action_payload: Record<string, unknown> | null;
  status: string | null;
  confirmed_at: Date | string | null;
  expires_at: Date | string | null;
  updated_at: Date | string | null;
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_number: string | null;
};

type SessionQueueRow = {
  id: string;
  pending_id: string | null;
  user_id: string;
  use_case: string;
  provider_name: string | null;
  provider_phone: string | null;
  action_summary: string | null;
  action_payload: Record<string, unknown> | null;
  outcome: string | null;
  outcome_payload: Record<string, unknown> | null;
  outcome_summary: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  phone_number: string | null;
};

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function profileLabel(row: Pick<PendingQueueRow, "user_id" | "full_name" | "preferred_name" | "email" | "phone_number">): string {
  return row.preferred_name?.trim()
    || row.full_name?.trim()
    || row.email?.trim()
    || row.phone_number?.trim()
    || row.user_id;
}

function profileContact(row: Pick<PendingQueueRow, "email" | "phone_number">): string | null {
  return row.phone_number?.trim() || row.email?.trim() || null;
}

function taskMissingLabels(task: ReturnType<typeof executionTaskFromPayload>): string[] {
  return (task?.missing_requirements ?? [])
    .map((requirement) => requirement.label_en || requirement.label_es)
    .filter((label): label is string => Boolean(label));
}

function pendingItem(row: PendingQueueRow): OperatorConciergeQueueItem | null {
  const payload = withConciergeExecutionTask({
    useCase: row.use_case,
    payload: row.action_payload ?? {},
    providerName: row.provider_name,
    providerPhone: row.provider_phone,
    summary: row.action_summary,
    pendingStatus: row.status,
  });
  const task = executionTaskFromPayload(payload);
  const status = normalizeOperatorConciergeQueueStatus(task?.lifecycle_status ?? row.status);
  if (!status) return null;

  return {
    id: row.id,
    source: "pending",
    user_id: row.user_id,
    user_label: profileLabel(row),
    user_contact: profileContact(row),
    use_case: row.use_case,
    provider_name: row.provider_name,
    provider_phone: row.provider_phone,
    action_summary: row.action_summary || "Concierge task",
    status,
    pending_status: row.status,
    flow_reference: task?.flow_reference ?? null,
    action_type: task?.action_type ?? null,
    active_tool: task?.active_tool ?? null,
    missing_labels: taskMissingLabels(task),
    user_confirmed: Boolean(task?.user_confirmed),
    confirmed_at: isoDate(task?.confirmed_at ?? row.confirmed_at),
    updated_at: isoDate(task?.updated_at ?? row.updated_at ?? row.confirmed_at ?? row.expires_at),
  };
}

function sessionItem(row: SessionQueueRow): OperatorConciergeQueueItem | null {
  const payloadWithTask = executionTaskFromPayload(row.outcome_payload)
    ? row.outcome_payload
    : withConciergeExecutionTask({
        useCase: row.use_case,
        payload: row.action_payload ?? {},
        providerName: row.provider_name,
        providerPhone: row.provider_phone,
        summary: row.outcome_summary ?? row.action_summary,
        pendingStatus: row.outcome === "completed" ? "completed" : row.outcome,
        lifecycleStatus: row.outcome === "completed" ? "done" : row.outcome === "failed" ? "failed" : undefined,
        userConfirmed: true,
      });
  const task = executionTaskFromPayload(payloadWithTask);
  const status = normalizeOperatorConciergeQueueStatus(task?.lifecycle_status ?? row.outcome);
  if (!status) return null;

  return {
    id: row.id,
    source: "session",
    user_id: row.user_id,
    user_label: profileLabel(row),
    user_contact: profileContact(row),
    use_case: row.use_case,
    provider_name: row.provider_name,
    provider_phone: row.provider_phone,
    action_summary: row.outcome_summary || row.action_summary || "Completed Concierge task",
    status,
    pending_status: row.outcome,
    flow_reference: task?.flow_reference ?? null,
    action_type: task?.action_type ?? null,
    active_tool: task?.active_tool ?? null,
    missing_labels: taskMissingLabels(task),
    user_confirmed: Boolean(task?.user_confirmed ?? true),
    confirmed_at: isoDate(task?.confirmed_at ?? row.started_at),
    updated_at: isoDate(task?.updated_at ?? row.completed_at ?? row.started_at),
  };
}

function sortByUpdatedAt(items: OperatorConciergeQueueItem[]): OperatorConciergeQueueItem[] {
  return [...items].sort((a, b) => Date.parse(b.updated_at ?? "") - Date.parse(a.updated_at ?? ""));
}

router.get("/", async (req: Request, res: Response) => {
  const requestedStatus = typeof req.query.status === "string" && isOperatorConciergeQueueStatus(req.query.status)
    ? req.query.status as OperatorConciergeQueueStatus
    : null;

  try {
    const [pendingResult, sessionResult] = await Promise.all([
      pool.query<PendingQueueRow>(
        `
          select
            cp.id::text,
            cp.user_id,
            cp.use_case,
            cp.provider_name,
            cp.provider_phone,
            cp.action_summary,
            cp.action_payload,
            cp.status,
            cp.confirmed_at,
            cp.expires_at,
            cp.updated_at,
            p.full_name,
            p.preferred_name,
            p.email,
            p.phone_number
          from concierge_pending cp
          left join profiles p on p.id = cp.user_id
          where cp.status in ('pending', 'calling', 'failed')
          order by cp.updated_at desc nulls last, cp.confirmed_at desc nulls last
          limit 120
        `,
      ),
      pool.query<SessionQueueRow>(
        `
          select
            cs.id::text,
            cs.pending_id::text,
            cs.user_id,
            cs.use_case,
            cs.provider_name,
            cs.provider_phone,
            cs.action_summary,
            cs.action_payload,
            cs.outcome,
            cs.outcome_payload,
            cs.outcome_summary,
            cs.started_at,
            cs.completed_at,
            p.full_name,
            p.preferred_name,
            p.email,
            p.phone_number
          from concierge_sessions cs
          left join profiles p on p.id = cs.user_id
          where cs.outcome in ('completed', 'failed')
          order by cs.completed_at desc nulls last, cs.started_at desc nulls last
          limit 80
        `,
      ),
    ]);

    const allItems = sortByUpdatedAt([
      ...pendingResult.rows.map(pendingItem),
      ...sessionResult.rows.map(sessionItem),
    ].filter((item): item is OperatorConciergeQueueItem => Boolean(item)));
    const items = requestedStatus ? allItems.filter((item) => item.status === requestedStatus) : allItems;

    return res.json({
      statuses: OPERATOR_CONCIERGE_QUEUE_STATUSES,
      totals: buildOperatorConciergeQueueTotals(allItems),
      items,
    });
  } catch (err) {
    console.error("[admin/concierge/queue] failed to load queue", err);
    return res.status(500).json({ error: "Failed to load Concierge operator queue." });
  }
});

export default router;
