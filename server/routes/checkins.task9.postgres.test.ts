import { readFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import pg from "pg";
import request from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnswerSubmissionModality } from "../../shared/orchestration/flowState.js";
import type { PreventiveHealthAnswers } from "../health/preventiveHealthFlow.js";
import type {
  PreventiveHealthPersistenceIdentity,
  PreventiveHealthResult,
} from "../health/preventiveHealthOrchestrator.js";

const activeProfile = vi.hoisted(() => ({
  getActiveProfileContext: vi.fn(),
}));

const dailyMonitor = vi.hoisted(() => ({
  markDailyCheckinCompleted: vi.fn(),
  getDailyCheckinTodayStatus: vi.fn(),
}));

vi.mock("../middleware/auth.js", () => ({
  requireUser: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user: { id: string; email: string } }).user = {
      id: "account-user-task9-pg",
      email: "task9-pg@example.com",
    };
    next();
  },
}));

vi.mock("../lib/profileAccess.js", () => activeProfile);

vi.mock("../services/dailyCheckinMonitor.js", () => dailyMonitor);

vi.mock("../lib/caregiverDomainAccess.js", () => ({
  resolveDomainAccess: vi.fn(async () => ({ allowed: true })),
}));

const { Client } = pg;
const task9PostgresUrl = process.env.TASK9_POSTGRES_URL;
const describeRealPostgres = task9PostgresUrl ? describe : describe.skip;
const prerequisiteSql = readFileSync(
  join(process.cwd(), "migrations/0024_daily_checkin_no_response.sql"),
  "utf8",
);
const task9MigrationSql = readFileSync(
  join(process.cwd(), "migrations/0078_task9_preventive_health_completion_identity.sql"),
  "utf8",
);

const baseAnswers: PreventiveHealthAnswers = {
  energy_level: 4,
  mood: "alegre",
  body_areas: ["ninguno"],
  sleep_quality: "bien",
  symptoms: ["dolor_cabeza"],
  symptom_details: ["headache_mild"],
  safety_flags: ["mild_stable"],
  social_contact: "algo",
};

const baseResult: PreventiveHealthResult = {
  feeling_label: "Stable day",
  overall_state: "good",
  vyva_reading: "A durable PostgreSQL preventive check result.",
  why_today: "The answers are stable.",
  trend_note: null,
  personal_plan: "Keep the day simple.",
  app_suggestion: "Use the existing health plan.",
  suggested_app_action: "concierge",
  right_now: ["Drink water"],
  today_actions: ["Take a short pause"],
  highlight: "A steady preventive check.",
  flag_caregiver: false,
  watch_for: null,
};

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

async function lockTask9PostgresHarness(client: InstanceType<typeof Client>) {
  await client.query("select pg_advisory_lock(9078, 10)");
}

async function unlockTask9PostgresHarness(client: InstanceType<typeof Client>) {
  await client.query("select pg_advisory_unlock(9078, 10)");
}

function installTask9Env() {
  process.env.DATABASE_URL = task9PostgresUrl;
  process.env.VYVA_HEALTH_PREVENTIVE_FLOW_MODE = "authoritative";
  process.env.VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_USERS = "user-task9-pg";
  delete process.env.VYVA_HEALTH_PREVENTIVE_FLOW_DENY_USERS;
  delete process.env.VYVA_HEALTH_PREVENTIVE_FLOW_ROLLOUT_BPS;
  process.env.VYVA_HEALTH_PREVENTIVE_FLOW_ALLOW_PRODUCTION = "false";
  process.env.NODE_ENV = "staging";
  delete process.env.OPENAI_API_KEY;
}

describeRealPostgres("Task 9 real PostgreSQL repository and route idempotency", () => {
  let admin: InstanceType<typeof Client> | null = null;
  let postgresVersion = "";

  beforeAll(async () => {
    if (!task9PostgresUrl) return;
    if (!safeScratchDatabase(task9PostgresUrl)) {
      throw new Error(
        "TASK9_POSTGRES_URL must point at a scratch/test database whose name contains task9, test, tmp, ci, or scratch.",
      );
    }
    admin = new Client({ connectionString: task9PostgresUrl });
    await admin.connect();
    const version = await admin.query<{ version: string }>("select version()");
    postgresVersion = version.rows[0]?.version ?? "";
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.end();
  });

  function postgres(): InstanceType<typeof Client> {
    if (!admin) throw new Error("Task 9 PostgreSQL client was not initialized");
    return admin;
  }

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("../health/healthSpecialistAdapter.js");
    activeProfile.getActiveProfileContext.mockReset();
    activeProfile.getActiveProfileContext.mockResolvedValue({ profileId: "user-task9-pg" });
    dailyMonitor.markDailyCheckinCompleted.mockReset();
    dailyMonitor.markDailyCheckinCompleted.mockResolvedValue(undefined);
    dailyMonitor.getDailyCheckinTodayStatus.mockReset();
    installTask9Env();
    await lockTask9PostgresHarness(postgres());
    await resetDatabase();
    await applyMigrations();
  });

  afterEach(async () => {
    try {
      const db = await import("../db.js");
      await db.pool.end();
    } catch {
      // Some skipped or failed imports never create a pool.
    }
    try {
      await resetDatabase();
    } finally {
      await unlockTask9PostgresHarness(postgres());
      vi.resetModules();
    }
  });

  async function resetDatabase() {
    await postgres().query("drop table if exists public.checkin_sessions cascade");
    await postgres().query("drop table if exists public.checkin_trend_state cascade");
    await postgres().query("drop table if exists public.caregiver_alerts cascade");
  }

  async function applyMigrations() {
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
    await postgres().query(task9MigrationSql);
  }

  async function identityFor(input: {
    userId?: string;
    sessionId?: string;
  } = {}): Promise<PreventiveHealthPersistenceIdentity> {
    const flow = await import("../health/preventiveHealthFlow.js");
    const run = flow.runPreventiveHealthFlowFromAnswers({
      userId: input.userId ?? "user-task9-pg",
      sessionId: input.sessionId ?? "session-task9-pg",
      occurredAt: "2026-08-04T09:30:00.000Z",
      answers: baseAnswers,
      modality: "touch",
    });
    expect(run.ok).toBe(true);
    if (!run.ok) throw new Error("Task 9 flow did not normalize in PostgreSQL test");
    return {
      completionReference: run.result.completionReference,
      answerDigest: run.result.answerDigest,
      flowId: flow.PREVENTIVE_HEALTH_FLOW_ID,
      flowVersion: flow.PREVENTIVE_HEALTH_FLOW_VERSION,
      flowInstanceId: input.sessionId ?? "session-task9-pg",
    };
  }

  async function repository() {
    return import("./checkins.js");
  }

  it("coordinates ten concurrent claims before generation with one PostgreSQL row", async () => {
    const repo = await repository();
    const identity = await identityFor();
    const claims = await Promise.all(Array.from({ length: 10 }, () =>
      repo.acquirePreventiveHealthCompletionClaim(
        "user-task9-pg",
        "es",
        baseAnswers,
        20,
        identity,
        new Date("2026-08-04T09:30:00.000Z"),
      )));
    const claimed = claims.filter((claim) => claim.state === "claimed");
    const pending = claims.filter((claim) => claim.state === "pending");
    expect(claimed).toHaveLength(1);
    expect(pending).toHaveLength(9);

    const owner = claimed[0];
    if (owner.state !== "claimed") throw new Error("missing claim owner");
    const completed = await repo.completePreventiveHealthClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      baseResult,
      20,
      identity,
      owner.claimToken,
      new Date("2026-08-04T09:30:01.000Z"),
    );
    expect(completed).toMatchObject({
      sessionId: owner.sessionId,
      inserted: true,
      result: baseResult,
    });
    const rows = await postgres().query<{ count: string }>(
      `select count(*) from public.checkin_sessions
       where user_id = 'user-task9-pg'
         and orchestration_completion_status = 'completed'
         and orchestration_completion_reference = $1`,
      [identity.completionReference],
    );
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(1);

    const retry = await repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      identity,
      new Date("2026-08-04T09:30:02.000Z"),
    );
    expect(retry).toMatchObject({
      state: "completed",
      completion: {
        sessionId: owner.sessionId,
        result: baseResult,
      },
    });
  });

  it("rejects blank Task 9 identity before PostgreSQL insert or lookup", async () => {
    const repo = await repository();
    const identity = await identityFor();
    await expect(repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      {
        ...identity,
        completionReference: "",
      },
      new Date("2026-08-04T09:30:00.000Z"),
    )).rejects.toThrow(/Invalid Task 9 completion identity/);
    const rows = await postgres().query<{ count: string }>(
      "select count(*) from public.checkin_sessions",
    );
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(0);
  });

  it("recovers failed and abandoned claims without a second active owner", async () => {
    const repo = await repository();
    const identity = await identityFor();
    const first = await repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      identity,
      new Date("2026-08-04T09:30:00.000Z"),
    );
    expect(first.state).toBe("claimed");
    if (first.state !== "claimed") throw new Error("missing first claim");
    await repo.markPreventiveHealthClaimFailed(
      "user-task9-pg",
      identity,
      first.claimToken,
      "preventive_health_flow_generation_failed",
      new Date("2026-08-04T09:30:01.000Z"),
    );
    const retryAfterFailure = await repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      identity,
      new Date("2026-08-04T09:30:02.000Z"),
    );
    expect(retryAfterFailure.state).toBe("claimed");

    const abandonedIdentity = await identityFor({ sessionId: "session-task9-pg-abandoned" });
    const abandoned = await repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      abandonedIdentity,
      new Date("2026-08-04T09:30:00.000Z"),
    );
    expect(abandoned.state).toBe("claimed");
    await postgres().query(
      `update public.checkin_sessions
       set orchestration_claim_expires_at = '2026-08-04T09:29:59.000Z'::timestamptz
       where orchestration_completion_reference = $1`,
      [abandonedIdentity.completionReference],
    );
    const recovered = await repo.acquirePreventiveHealthCompletionClaim(
      "user-task9-pg",
      "es",
      baseAnswers,
      20,
      abandonedIdentity,
      new Date("2026-08-04T09:30:01.000Z"),
    );
    expect(recovered.state).toBe("claimed");
  });

  it("lets distinct users and Flow instances complete independently", async () => {
    const repo = await repository();
    const leftIdentity = await identityFor({ userId: "user-task9-pg", sessionId: "session-left" });
    const rightUserIdentity = await identityFor({ userId: "user-task9-pg-2", sessionId: "session-left" });
    const rightInstanceIdentity = await identityFor({ userId: "user-task9-pg", sessionId: "session-right" });
    const claims = await Promise.all([
      repo.acquirePreventiveHealthCompletionClaim("user-task9-pg", "es", baseAnswers, 20, leftIdentity, new Date("2026-08-04T09:30:00.000Z")),
      repo.acquirePreventiveHealthCompletionClaim("user-task9-pg-2", "es", baseAnswers, 20, rightUserIdentity, new Date("2026-08-04T09:30:00.000Z")),
      repo.acquirePreventiveHealthCompletionClaim("user-task9-pg", "es", baseAnswers, 20, rightInstanceIdentity, new Date("2026-08-04T09:30:00.000Z")),
    ]);
    expect(claims.every((claim) => claim.state === "claimed")).toBe(true);
  });

  async function createApp(options: { modality?: AnswerSubmissionModality } = {}) {
    const { default: checkinsRouter, setPreventiveHealthTrustedModality } = await import("./checkins.js");
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as express.Request & { language?: string }).language = "es";
      if (options.modality) setPreventiveHealthTrustedModality(res, options.modality);
      next();
    });
    app.use("/api/checkins", checkinsRouter);
    return app;
  }

  it("uses the real PostgreSQL route path for trusted modality and persisted retry", async () => {
    const app = await createApp({ modality: "voice" });
    const first = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });
    expect(first.status).toBe(200);
    expect(first.body.meta.orchestration.persistence_status).toBe("created");

    const retry = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, modality: "text", answers: baseAnswers });
    expect(retry.status).toBe(200);
    expect(retry.body.session_id).toBe(first.body.session_id);
    expect(retry.body.result).toEqual(first.body.result);
    expect(retry.body.meta.orchestration.persistence_status).toBe("existing");

    const rows = await postgres().query<{ count: string; status: string }>(
      `select count(*) as count, max(orchestration_completion_status) as status
       from public.checkin_sessions
       where user_id = 'user-task9-pg'`,
    );
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(1);
    expect(rows.rows[0]?.status).toBe("completed");
    expect(postgresVersion).toMatch(/PostgreSQL/i);
  });

  it("route-level Specialist rejection uses real PostgreSQL and writes no completion or legacy row", async () => {
    vi.resetModules();
    installTask9Env();
    vi.doMock("../health/healthSpecialistAdapter.js", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../health/healthSpecialistAdapter.js")>();
      return {
        ...actual,
        proposePreventiveHealthCompletion: vi.fn((input: Parameters<typeof actual.proposePreventiveHealthCompletion>[0]) => {
          const proposed = actual.proposePreventiveHealthCompletion(input);
          return {
            ...proposed,
            completionResult: {
              ...proposed.completionResult,
              answerDigest: `sha256:${"0".repeat(64)}`,
            },
          };
        }),
      };
    });
    const app = await createApp({ modality: "text" });
    const response = await request(app)
      .post("/api/checkins/analyze")
      .send({ language: "es", duration_seconds: 20, answers: baseAnswers });
    expect(response.status).toBe(409);
    expect(response.body.meta.orchestration).toMatchObject({
      reason_code: "preventive_health_flow_specialist_rejected",
      persistence_status: "not_started",
    });
    const rows = await postgres().query<{ count: string }>(
      "select count(*) from public.checkin_sessions",
    );
    expect(Number(rows.rows[0]?.count ?? 0)).toBe(0);
  });
});
