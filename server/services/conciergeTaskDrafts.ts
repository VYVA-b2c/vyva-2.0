import { pool } from "../db.js";
import type {
  ConciergeTaskDraft,
  ConciergeTaskEntryPayload,
  ConciergeTaskProgressPayload,
  PersistedConciergeTaskStage,
} from "../../shared/conciergeTaskDrafts.js";

type TaskDraftDbRow = Omit<ConciergeTaskDraft, "created_at" | "updated_at" | "completed_at" | "deleted_at"> & {
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
  deleted_at: Date | string | null;
};

export class ConciergeTaskUnavailableError extends Error {
  constructor(public readonly status: "completed" | "deleted") {
    super(`Concierge task is ${status}`);
  }
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeTask(row: TaskDraftDbRow): ConciergeTaskDraft {
  return {
    ...row,
    created_at: iso(row.created_at)!,
    updated_at: iso(row.updated_at)!,
    completed_at: iso(row.completed_at),
    deleted_at: iso(row.deleted_at),
  };
}

async function taskForUser(id: string, userId: string): Promise<ConciergeTaskDraft | null> {
  const result = await pool.query<TaskDraftDbRow>(
    `select * from concierge_task_drafts where id = $1::uuid and user_id = $2 limit 1`,
    [id, userId],
  );
  return result.rows[0] ? normalizeTask(result.rows[0]) : null;
}

async function requireActiveTask(id: string, userId: string): Promise<ConciergeTaskDraft> {
  const task = await taskForUser(id, userId);
  if (!task) throw new Error("Concierge task not found");
  if (task.status !== "active") throw new ConciergeTaskUnavailableError(task.status);
  return task;
}

export async function listActiveConciergeTaskDrafts(userId: string): Promise<ConciergeTaskDraft[]> {
  const result = await pool.query<TaskDraftDbRow>(
    `
      select *
      from concierge_task_drafts
      where user_id = $1 and status = 'active'
      order by updated_at desc
      limit 50
    `,
    [userId],
  );
  return result.rows.map(normalizeTask);
}

export async function getConciergeTaskDraft(id: string, userId: string): Promise<ConciergeTaskDraft | null> {
  const task = await taskForUser(id, userId);
  if (!task) return null;
  if (task.status !== "active") throw new ConciergeTaskUnavailableError(task.status);
  return task;
}

export async function createConciergeTaskDraft(input: {
  userId: string;
  entry: ConciergeTaskEntryPayload;
  language: string;
  idempotencyKey?: string;
}): Promise<ConciergeTaskDraft> {
  if (input.idempotencyKey) {
    const existing = await pool.query<TaskDraftDbRow>(
      `
        select *
        from concierge_task_drafts
        where user_id = $1
          and status = 'active'
          and progress_payload ->> 'crossPillarIdempotencyKey' = $2
        order by updated_at desc
        limit 1
      `,
      [input.userId, input.idempotencyKey],
    );
    if (existing.rows[0]) return normalizeTask(existing.rows[0]);
  }

  const initialProgress = input.idempotencyKey
    ? { crossPillarIdempotencyKey: input.idempotencyKey }
    : {};
  const result = await pool.query<TaskDraftDbRow>(
    `
      insert into concierge_task_drafts (user_id, kind, entry_payload, progress_payload, language)
      values ($1, $2, $3::jsonb, $4::jsonb, $5)
      returning *
    `,
    [
      input.userId,
      input.entry.kind,
      JSON.stringify(input.entry),
      JSON.stringify(initialProgress),
      input.language,
    ],
  );
  return normalizeTask(result.rows[0]!);
}

export async function updateConciergeTaskDraft(input: {
  id: string;
  userId: string;
  progress: ConciergeTaskProgressPayload;
  stage: PersistedConciergeTaskStage;
}): Promise<ConciergeTaskDraft> {
  await requireActiveTask(input.id, input.userId);
  const result = await pool.query<TaskDraftDbRow>(
    `
      update concierge_task_drafts
      set progress_payload = progress_payload || $3::jsonb, stage = $4, updated_at = now()
      where id = $1::uuid and user_id = $2 and status = 'active'
      returning *
    `,
    [input.id, input.userId, JSON.stringify(input.progress), input.stage],
  );
  if (!result.rows[0]) throw new Error("Concierge task not found");
  return normalizeTask(result.rows[0]);
}

export async function completeConciergeTaskDraft(id: string, userId: string): Promise<ConciergeTaskDraft> {
  await requireActiveTask(id, userId);
  const result = await pool.query<TaskDraftDbRow>(
    `
      update concierge_task_drafts
      set status = 'completed', completed_at = now(), updated_at = now()
      where id = $1::uuid and user_id = $2 and status = 'active'
      returning *
    `,
    [id, userId],
  );
  return normalizeTask(result.rows[0]!);
}

export async function deleteConciergeTaskDraft(id: string, userId: string): Promise<ConciergeTaskDraft> {
  await requireActiveTask(id, userId);
  const result = await pool.query<TaskDraftDbRow>(
    `
      update concierge_task_drafts
      set status = 'deleted', deleted_at = now(), updated_at = now()
      where id = $1::uuid and user_id = $2 and status = 'active'
      returning *
    `,
    [id, userId],
  );
  return normalizeTask(result.rows[0]!);
}
