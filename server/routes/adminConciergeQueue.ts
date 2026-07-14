import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { withConciergeExecutionTask } from "../../shared/conciergeActionExecution.js";
import {
  OPERATOR_CONCIERGE_QUEUE_STATUSES,
  buildOperatorConciergeQueueTotals,
  executionTaskFromPayload,
  isOperatorConciergeQueueAction,
  isOperatorConciergeQueueStatus,
  normalizeOperatorConciergeQueueStatus,
  type OperatorConciergeQueueAction,
  type OperatorConciergeQueueItem,
  type OperatorConciergeQueueStatus,
} from "../../shared/conciergeOperatorQueue.js";

const router = Router();

const updateSchema = z.object({
  action: z.enum(["assign", "in_progress", "done", "failed"]),
  outcome_note: z.string().trim().max(1000).optional().nullable(),
});

type PendingQueueRow = {
  id: string;
  user_id: string;
  use_case: string;
  provider_id: string | null;
  provider_name: string | null;
  provider_phone: string | null;
  found_externally: boolean | null;
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

function operatorNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

function objectPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function operatorAssignmentFromPayload(payload: unknown) {
  const data = objectPayload(payload);
  return {
    operator_assigned_to: stringValue(data.operator_assigned_to),
    operator_assigned_email: stringValue(data.operator_assigned_email),
    operator_assigned_at: stringValue(data.operator_assigned_at),
  };
}

function operatorIdentity(req: Request) {
  const email = req.user?.email?.trim() || null;
  const id = req.user?.id?.trim() || email || null;
  return { id, email };
}

function assignmentBelongsToOperator(
  assignment: ReturnType<typeof operatorAssignmentFromPayload>,
  req: Request,
): boolean {
  const operator = operatorIdentity(req);
  return Boolean(
    (operator.id && assignment.operator_assigned_to === operator.id)
      || (operator.email && assignment.operator_assigned_email?.toLowerCase() === operator.email.toLowerCase()),
  );
}

function assignmentIsTaken(assignment: ReturnType<typeof operatorAssignmentFromPayload>): boolean {
  return Boolean(assignment.operator_assigned_to || assignment.operator_assigned_email);
}

function withAssignment(payload: Record<string, unknown>, req: Request, force = false): Record<string, unknown> {
  const existing = operatorAssignmentFromPayload(payload);
  if (!force && existing.operator_assigned_to) return payload;
  const operator = operatorIdentity(req);
  const assignedTo = operator.id ?? "admin";
  return {
    ...payload,
    operator_assigned_to: assignedTo,
    operator_assigned_email: operator.email ?? assignedTo,
    operator_assigned_at: new Date().toISOString(),
  };
}

function currentPendingPayload(row: PendingQueueRow): Record<string, unknown> {
  return withConciergeExecutionTask({
    useCase: row.use_case,
    payload: row.action_payload ?? {},
    providerName: row.provider_name,
    providerPhone: row.provider_phone,
    summary: row.action_summary,
    pendingStatus: row.status,
  });
}

function pendingItem(row: PendingQueueRow): OperatorConciergeQueueItem | null {
  const payload = currentPendingPayload(row);
  const task = executionTaskFromPayload(payload);
  if (!task?.user_confirmed) return null;
  const status = normalizeOperatorConciergeQueueStatus(task?.lifecycle_status ?? row.status);
  if (!status) return null;
  const assignment = operatorAssignmentFromPayload(payload);

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
    ...assignment,
    missing_labels: taskMissingLabels(task),
    user_confirmed: Boolean(task?.user_confirmed),
    confirmed_at: isoDate(task?.confirmed_at ?? row.confirmed_at),
    updated_at: isoDate(task?.updated_at ?? row.updated_at ?? row.confirmed_at ?? row.expires_at),
  };
}

async function loadPendingQueueRow(pendingId: string): Promise<PendingQueueRow | null> {
  const result = await pool.query<PendingQueueRow>(
    `
      select
        cp.id::text,
        cp.user_id,
        cp.use_case,
        cp.provider_id::text,
        cp.provider_name,
        cp.provider_phone,
        cp.found_externally,
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
      where cp.id = $1::uuid
      limit 1
    `,
    [pendingId],
  );
  return result.rows[0] ?? null;
}

function buildUpdatedPendingPayload(
  row: PendingQueueRow,
  action: OperatorConciergeQueueAction,
  note: string | null,
  req: Request,
): Record<string, unknown> {
  const nextStatus = action === "done" ? "completed" : action === "failed" ? "failed" : "calling";
  const basePayload = withAssignment({
    ...(row.action_payload ?? {}),
    operator_note: note,
    operator_updated_at: new Date().toISOString(),
  }, req);

  return withConciergeExecutionTask({
    useCase: row.use_case,
    payload: basePayload,
    providerName: row.provider_name,
    providerPhone: row.provider_phone,
    summary: note || row.action_summary,
    pendingStatus: nextStatus,
    lifecycleStatus: action,
    userConfirmed: true,
    confirmationSource: "operator_queue",
    failureReason: action === "failed" ? note || "operator_marked_failed" : undefined,
    outcome: note || row.action_summary || action,
  });
}

async function updatePendingAssignment(row: PendingQueueRow, req: Request): Promise<void> {
  const payload = withConciergeExecutionTask({
    useCase: row.use_case,
    payload: withAssignment(row.action_payload ?? {}, req, true),
    providerName: row.provider_name,
    providerPhone: row.provider_phone,
    summary: row.action_summary,
    pendingStatus: row.status,
    userConfirmed: true,
    confirmationSource: "operator_queue",
  });
  await pool.query(
    `
      update concierge_pending
      set action_payload = $2::jsonb, updated_at = now()
      where id = $1::uuid
    `,
    [row.id, JSON.stringify(payload)],
  );
}

async function updatePendingInProgress(row: PendingQueueRow, note: string | null, req: Request): Promise<void> {
  const payload = buildUpdatedPendingPayload(row, "in_progress", note, req);
  await pool.query(
    `
      update concierge_pending
      set status = 'calling', action_payload = $2::jsonb, updated_at = now()
      where id = $1::uuid
    `,
    [row.id, JSON.stringify(payload)],
  );
}

async function closePending(row: PendingQueueRow, action: "done" | "failed", note: string | null, req: Request): Promise<void> {
  const pendingStatus = action === "done" ? "completed" : "failed";
  const sessionOutcome = action === "done" ? "completed" : "failed";
  const payload = buildUpdatedPendingPayload(row, action, note, req);
  const assignment = operatorAssignmentFromPayload(payload);
  const outcomePayload = {
    ...(row.action_payload ?? {}),
    operator_note: note,
    operator_actor: req.user?.email ?? req.user?.id ?? null,
    ...assignment,
    operator_completed_at: new Date().toISOString(),
    execution_task: executionTaskFromPayload(payload),
  };

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existingSession = await client.query<{ id: string }>(
      `
        select id
        from concierge_sessions
        where pending_id = $1::uuid
          and outcome = $2
        order by completed_at desc nulls last, started_at desc nulls last
        limit 1
      `,
      [row.id, sessionOutcome],
    );

    if (!existingSession.rows[0]) {
      await client.query(
        `
          insert into concierge_sessions (
            user_id,
            pending_id,
            use_case,
            provider_id,
            provider_name,
            provider_phone,
            found_externally,
            action_summary,
            action_payload,
            outcome,
            outcome_payload,
            outcome_summary,
            completed_at
          )
          values ($1, $2::uuid, $3, $4::uuid, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12, now())
        `,
        [
          row.user_id,
          row.id,
          row.use_case,
          row.provider_id,
          row.provider_name,
          row.provider_phone,
          Boolean(row.found_externally),
          row.action_summary,
          JSON.stringify(payload),
          sessionOutcome,
          JSON.stringify(outcomePayload),
          note || row.action_summary || sessionOutcome,
        ],
      );
    }

    await client.query(
      `
        update concierge_pending
        set status = $2, action_payload = $3::jsonb, updated_at = now()
        where id = $1::uuid
      `,
      [row.id, pendingStatus, JSON.stringify(payload)],
    );
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
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
  const assignment = operatorAssignmentFromPayload(payloadWithTask);

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
    ...assignment,
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
            cp.provider_id::text,
            cp.provider_name,
            cp.provider_phone,
            cp.found_externally,
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
          where cp.status in ('pending', 'calling')
             or (
               cp.status = 'failed'
               and not exists (
                 select 1
                 from concierge_sessions cs
                 where cs.pending_id = cp.id
                   and cs.outcome = 'failed'
               )
             )
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

router.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!isOperatorConciergeQueueAction(parsed.data.action)) {
    return res.status(400).json({ error: "Unsupported queue action." });
  }

  try {
    const row = await loadPendingQueueRow(req.params.id);
    if (!row) return res.status(404).json({ error: "Concierge task not found." });

    if (row.status === "completed" || row.status === "cancelled") {
      return res.status(409).json({ error: "This Concierge task is already closed." });
    }

    const currentTask = executionTaskFromPayload(currentPendingPayload(row));
    if (!currentTask?.user_confirmed) {
      return res.status(409).json({ error: "User confirmation is required before an operator can handle this task." });
    }
    const currentAssignment = operatorAssignmentFromPayload(currentPendingPayload(row));
    const assignedToAnotherOperator = assignmentIsTaken(currentAssignment) && !assignmentBelongsToOperator(currentAssignment, req);
    if (assignedToAnotherOperator) {
      return res.status(409).json({ error: "This Concierge task is assigned to another operator." });
    }

    const note = operatorNote(parsed.data.outcome_note);
    if (parsed.data.action === "assign") {
      await updatePendingAssignment(row, req);
    } else if (parsed.data.action === "in_progress") {
      await updatePendingInProgress(row, note, req);
    } else {
      await closePending(row, parsed.data.action, note, req);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("[admin/concierge/queue] failed to update task", err);
    return res.status(500).json({ error: "Failed to update Concierge task." });
  }
});

export default router;
