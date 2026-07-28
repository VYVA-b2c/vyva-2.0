import { pool } from "../db.js";
import {
  summarizeCrossPillarToolHealth,
  type CrossPillarExecutionAttemptInput,
  type CrossPillarExecutionAttemptSnapshot,
} from "../../shared/crossPillarExecutionObservability.js";

type AttemptRow = {
  id: string;
  handoff_id: string;
  attempt_number: number;
  action_id: CrossPillarExecutionAttemptInput["actionId"];
  pillar: CrossPillarExecutionAttemptInput["pillar"];
  workflow_reference: string;
  tool_families: CrossPillarExecutionAttemptInput["toolFamilies"];
  confirmation_id: string | null;
  outcome: CrossPillarExecutionAttemptInput["outcome"];
  started_at: Date | string;
  finished_at: Date | string | null;
  duration_ms: number | null;
  fallback_path: string | null;
  fallback_reason: string | null;
  idempotency_key: string;
  retry_of_attempt_id: string | null;
  what_happened: string | null;
  what_remains: string | null;
  error_code: string | null;
  created_at: Date | string;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function snapshot(row: AttemptRow): CrossPillarExecutionAttemptSnapshot {
  return {
    id: row.id,
    handoffId: row.handoff_id,
    attemptNumber: row.attempt_number,
    actionId: row.action_id,
    pillar: row.pillar,
    workflowReference: row.workflow_reference,
    toolFamilies: row.tool_families,
    confirmationId: row.confirmation_id || undefined,
    outcome: row.outcome,
    startedAt: iso(row.started_at),
    finishedAt: row.finished_at ? iso(row.finished_at) : undefined,
    durationMs: row.duration_ms ?? undefined,
    fallbackPath: row.fallback_path || undefined,
    fallbackReason: row.fallback_reason || undefined,
    idempotencyKey: row.idempotency_key,
    retryOfAttemptId: row.retry_of_attempt_id || undefined,
    whatHappened: row.what_happened || undefined,
    whatRemains: row.what_remains || undefined,
    errorCode: row.error_code || undefined,
    createdAt: iso(row.created_at),
  };
}

export async function recordCrossPillarExecutionAttempt(
  userId: string,
  input: CrossPillarExecutionAttemptInput,
): Promise<{ attempt: CrossPillarExecutionAttemptSnapshot; duplicate: boolean }> {
  const succeeded = await pool.query<AttemptRow>(
    `select *
       from public.cross_pillar_execution_attempts
      where user_id = $1::uuid and handoff_id = $2 and outcome = 'succeeded'
      order by attempt_number desc
      limit 1`,
    [userId, input.handoffId],
  );
  if (succeeded.rows[0] && input.outcome !== "started") {
    const prior = succeeded.rows[0];
    input = {
      ...input,
      attemptNumber: Math.max(input.attemptNumber, prior.attempt_number + 1),
      outcome: "duplicate",
      confirmationId: input.confirmationId ?? prior.confirmation_id ?? undefined,
      finishedAt: input.finishedAt ?? new Date().toISOString(),
      whatHappened: input.whatHappened ?? "The action was already completed. Nothing was sent twice.",
      whatRemains: input.whatRemains ?? "Review the existing confirmation.",
      errorCode: input.errorCode ?? "duplicate_prevented",
    };
  }

  const values = [
    userId, input.handoffId, input.attemptNumber, input.actionId, input.pillar,
    input.workflowReference, input.toolFamilies, input.confirmationId ?? null,
    input.outcome, input.startedAt, input.finishedAt ?? null, input.durationMs ?? null,
    input.fallbackPath ?? null, input.fallbackReason ?? null, input.idempotencyKey,
    input.retryOfAttemptId ?? null, input.whatHappened ?? null, input.whatRemains ?? null,
    input.errorCode ?? null,
  ];
  const result = await pool.query<AttemptRow>(
    `insert into public.cross_pillar_execution_attempts (
       user_id, handoff_id, attempt_number, action_id, pillar, workflow_reference,
       tool_families, confirmation_id, outcome, started_at, finished_at, duration_ms,
       fallback_path, fallback_reason, idempotency_key, retry_of_attempt_id,
       what_happened, what_remains, error_code
     ) values (
       $1::uuid, $2, $3, $4, $5, $6, $7::text[], $8, $9, $10::timestamptz,
       $11::timestamptz, $12, $13, $14, $15, $16::uuid, $17, $18, $19
     )
     on conflict (user_id, handoff_id, attempt_number) do update set
       confirmation_id = coalesce(excluded.confirmation_id, cross_pillar_execution_attempts.confirmation_id),
       outcome = excluded.outcome,
       finished_at = coalesce(excluded.finished_at, cross_pillar_execution_attempts.finished_at),
       duration_ms = coalesce(excluded.duration_ms, cross_pillar_execution_attempts.duration_ms),
       fallback_path = coalesce(excluded.fallback_path, cross_pillar_execution_attempts.fallback_path),
       fallback_reason = coalesce(excluded.fallback_reason, cross_pillar_execution_attempts.fallback_reason),
       what_happened = coalesce(excluded.what_happened, cross_pillar_execution_attempts.what_happened),
       what_remains = coalesce(excluded.what_remains, cross_pillar_execution_attempts.what_remains),
       error_code = coalesce(excluded.error_code, cross_pillar_execution_attempts.error_code),
       updated_at = now()
     returning *`,
    values,
  );
  return { attempt: snapshot(result.rows[0]), duplicate: input.outcome === "duplicate" };
}

export async function listOwnCrossPillarExecutionAttempts(userId: string, limit = 30) {
  const result = await pool.query<AttemptRow>(
    `select *
       from public.cross_pillar_execution_attempts
      where user_id = $1::uuid
      order by started_at desc
      limit $2`,
    [userId, limit],
  );
  return result.rows.map(snapshot);
}

export async function buildAdminCrossPillarExecutionSummary(hours = 24) {
  const result = await pool.query<AttemptRow>(
    `select *
       from public.cross_pillar_execution_attempts
      where started_at >= now() - ($1::text || ' hours')::interval
      order by started_at desc
      limit 1000`,
    [hours],
  );
  const attempts = result.rows.map(snapshot);
  const failureOutcomes = new Set(["failed", "timed_out", "blocked", "fallback"]);
  const failures = attempts.filter((attempt) => failureOutcomes.has(attempt.outcome));
  const groupedActions = Object.values(failures.reduce<Record<string, {
    actionId: string;
    failures: number;
    lastFailureAt: string;
  }>>((groups, attempt) => {
    const current = groups[attempt.actionId];
    groups[attempt.actionId] = {
      actionId: attempt.actionId,
      failures: (current?.failures ?? 0) + 1,
      lastFailureAt: current?.lastFailureAt && current.lastFailureAt > attempt.startedAt
        ? current.lastFailureAt
        : attempt.startedAt,
    };
    return groups;
  }, {})).sort((a, b) => b.failures - a.failures);

  return {
    generatedAt: new Date().toISOString(),
    windowHours: hours,
    totalAttempts: attempts.length,
    successful: attempts.filter((attempt) => attempt.outcome === "succeeded").length,
    failed: failures.length,
    duplicatesPrevented: attempts.filter((attempt) => attempt.outcome === "duplicate").length,
    recentFailures: failures.slice(0, 30),
    failuresByAction: groupedActions,
    toolHealth: summarizeCrossPillarToolHealth(attempts),
  };
}
