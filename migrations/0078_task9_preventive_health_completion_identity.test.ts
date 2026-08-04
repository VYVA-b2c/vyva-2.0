import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "migrations/0078_task9_preventive_health_completion_identity.sql"),
  "utf8",
);
const prerequisiteSql = readFileSync(
  join(process.cwd(), "migrations/0024_daily_checkin_no_response.sql"),
  "utf8",
);
const task9PostgresUrl = process.env.TASK9_POSTGRES_URL;
const { Client } = pg;

function safeScratchDatabase(url: string): boolean {
  try {
    const parsed = new URL(url);
    const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
    return /(?:task9|test|tmp|ci|scratch)/.test(databaseName);
  } catch {
    return false;
  }
}

async function ensurePgcryptoExtension(client: InstanceType<typeof Client>) {
  await client.query("select pg_advisory_lock(9078, 9)");
  try {
    await client.query("create extension if not exists pgcrypto");
  } finally {
    await client.query("select pg_advisory_unlock(9078, 9)");
  }
}

describe("Task 9 preventive Health completion identity migration", () => {
  it("is additive to the existing check-in session table", () => {
    expect(migrationSql).toContain("alter table public.checkin_sessions");
    expect(migrationSql).toContain("add column if not exists orchestration_flow_id text");
    expect(migrationSql).toContain("add column if not exists orchestration_flow_version text");
    expect(migrationSql).toContain("add column if not exists orchestration_flow_instance_id text");
    expect(migrationSql).toContain("add column if not exists orchestration_completion_reference text");
    expect(migrationSql).toContain("add column if not exists orchestration_answer_digest text");
    expect(migrationSql).toContain("add column if not exists orchestration_completion_status text");
    expect(migrationSql).toContain("add column if not exists orchestration_claim_token text");
    expect(migrationSql).toContain("add column if not exists orchestration_claimed_at timestamptz");
    expect(migrationSql).toContain("add column if not exists orchestration_claim_expires_at timestamptz");
    expect(migrationSql).toContain("add column if not exists orchestration_failure_reason text");
    expect(migrationSql).not.toMatch(/\bdrop\s+(table|column|index)\b/i);
    expect(migrationSql).not.toMatch(/\bdelete\s+from\b/i);
    expect(migrationSql).not.toMatch(/\bupdate\s+public\.checkin_sessions\b/i);
  });

  it("declares durable exactly-once completion uniqueness", () => {
    expect(migrationSql).toContain(
      "create unique index if not exists checkin_sessions_task9_completion_unique_idx",
    );
    expect(migrationSql).toContain("user_id");
    expect(migrationSql).toContain("orchestration_flow_id");
    expect(migrationSql).toContain("orchestration_flow_version");
    expect(migrationSql).toContain("orchestration_flow_instance_id");
    expect(migrationSql).toContain("orchestration_completion_reference");
    expect(migrationSql).toContain("where orchestration_completion_reference is not null");
  });

  it("persists the existing response fields needed for retry parity", () => {
    expect(migrationSql).toContain("add column if not exists why_today text");
    expect(migrationSql).toContain("add column if not exists trend_note text");
    expect(migrationSql).toContain("add column if not exists personal_plan text");
    expect(migrationSql).toContain("add column if not exists app_suggestion text");
    expect(migrationSql).toContain("add column if not exists suggested_app_action text");
  });

  it("does not collide with another migration 0078 filename", () => {
    const numbered = readdirSync(join(process.cwd(), "migrations"))
      .filter((file) => file.startsWith("0078_") && file.endsWith(".sql"));
    expect(numbered).toEqual(["0078_task9_preventive_health_completion_identity.sql"]);
  });
});

const describeRealPostgres = task9PostgresUrl ? describe : describe.skip;

describeRealPostgres("Task 9 real PostgreSQL migration behavior", () => {
  let client: InstanceType<typeof Client> | null = null;
  let postgresVersion = "";

  beforeAll(async () => {
    if (!task9PostgresUrl) return;
    if (!safeScratchDatabase(task9PostgresUrl)) {
      throw new Error(
        "TASK9_POSTGRES_URL must point at a scratch/test database whose name contains task9, test, tmp, ci, or scratch.",
      );
    }
    client = new Client({ connectionString: task9PostgresUrl });
    await client.connect();
    const version = await client.query<{ version: string }>("select version()");
    postgresVersion = version.rows[0]?.version ?? "";
  });

  afterAll(async () => {
    if (!client) return;
    await client.query("drop table if exists public.checkin_sessions cascade");
    await client.query("drop table if exists public.checkin_trend_state cascade");
    await client.query("drop table if exists public.caregiver_alerts cascade");
    await client.end();
  });

  function postgres(): InstanceType<typeof Client> {
    if (!client) throw new Error("Task 9 PostgreSQL client was not initialized");
    return client;
  }

  async function resetAndApplyPrerequisites() {
    await postgres().query("drop table if exists public.checkin_sessions cascade");
    await postgres().query("drop table if exists public.checkin_trend_state cascade");
    await postgres().query("drop table if exists public.caregiver_alerts cascade");
    await ensurePgcryptoExtension(postgres());
    await postgres().query(`
      create table public.caregiver_alerts (
        id uuid primary key default gen_random_uuid(),
        user_id text not null,
        alert_type text not null,
        created_at timestamptz not null default now()
      )
    `);
    await postgres().query(prerequisiteSql);
  }

  it("applies prerequisite 0024 and migration 0078 to a clean PostgreSQL database", async () => {
    await resetAndApplyPrerequisites();
    await postgres().query(migrationSql);

    const columns = await postgres().query<{ column_name: string }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'public' and table_name = 'checkin_sessions'`,
    );
    expect(columns.rows.map((row) => row.column_name)).toEqual(expect.arrayContaining([
      "orchestration_flow_id",
      "orchestration_flow_version",
      "orchestration_flow_instance_id",
      "orchestration_completion_reference",
      "orchestration_answer_digest",
      "orchestration_completion_status",
      "orchestration_claim_token",
      "orchestration_claimed_at",
      "orchestration_claim_expires_at",
      "orchestration_failure_reason",
    ]));
    expect(postgresVersion).toMatch(/PostgreSQL/i);
  });

  it("applies with legacy rows and keeps nullable Task 9 fields valid", async () => {
    await resetAndApplyPrerequisites();
    await postgres().query(
      `insert into public.checkin_sessions (user_id, language, completed)
       values ('legacy-user', 'es', true), ('legacy-user', 'es', true)`,
    );
    await postgres().query(migrationSql);
    const rows = await postgres().query<{ count: string }>(
      `select count(*) from public.checkin_sessions
       where user_id = 'legacy-user'
         and orchestration_completion_reference is null
         and orchestration_completion_status is null`,
    );
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(2);
  });

  it("enforces the partial unique identity only for Task 9 completion references", async () => {
    await resetAndApplyPrerequisites();
    await postgres().query(migrationSql);
    await postgres().query(
      `insert into public.checkin_sessions (user_id, language, completed)
       values ('same-user', 'es', true), ('same-user', 'es', true)`,
    );
    await postgres().query(
      `insert into public.checkin_sessions (
        user_id, language, completed, orchestration_flow_id,
        orchestration_flow_version, orchestration_flow_instance_id,
        orchestration_completion_reference, orchestration_answer_digest
       ) values (
        'same-user', 'es', true, 'health.preventive_check', '1.0.0',
        'instance-1', 'completion-1', 'sha256:${"a".repeat(64)}'
       )`,
    );
    await expect(postgres().query(
      `insert into public.checkin_sessions (
        user_id, language, completed, orchestration_flow_id,
        orchestration_flow_version, orchestration_flow_instance_id,
        orchestration_completion_reference, orchestration_answer_digest
       ) values (
        'same-user', 'es', true, 'health.preventive_check', '1.0.0',
        'instance-1', 'completion-1', 'sha256:${"a".repeat(64)}'
       )`,
    )).rejects.toMatchObject({ code: "23505" });
    await postgres().query(
      `insert into public.checkin_sessions (
        user_id, language, completed, orchestration_flow_id,
        orchestration_flow_version, orchestration_flow_instance_id,
        orchestration_completion_reference, orchestration_answer_digest
       ) values
        ('other-user', 'es', true, 'health.preventive_check', '1.0.0', 'instance-1', 'completion-1', 'sha256:${"a".repeat(64)}'),
        ('same-user', 'es', true, 'health.preventive_check', '1.0.0', 'instance-2', 'completion-1', 'sha256:${"a".repeat(64)}'),
        ('same-user', 'es', true, 'health.preventive_check', '2.0.0', 'instance-1', 'completion-1', 'sha256:${"a".repeat(64)}')`,
    );
    const count = await postgres().query<{ count: string }>(
      "select count(*) from public.checkin_sessions where orchestration_completion_reference is not null",
    );
    expect(Number(count.rows[0]?.count ?? 0)).toBe(4);
  });
});
