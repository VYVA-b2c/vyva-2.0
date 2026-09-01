import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { healthSemanticMemoryOutbox } from "../shared/schema.js";

const migrationSql = fs.readFileSync(
  new URL("./0081_health_semantic_memory_outbox.sql", import.meta.url),
  "utf8",
);

const task13PostgresUrl = process.env.TASK13_POSTGRES_URL;

function assertScratchTask13Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task13") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 13 PostgreSQL tests require a scratch database name containing task13 and test/tmp/ci/scratch");
  }
}

describe("Task 13 health semantic memory migration 0081", () => {
  it("adds a dedicated Health semantic memory outbox", () => {
    expect(migrationSql).toContain("create extension if not exists pgcrypto");
    expect(migrationSql).toContain("health_semantic_memory_outbox");
    expect(migrationSql).toContain("idempotency_key text not null unique");
    expect(migrationSql).toContain("semantic_digest text not null");
    expect(migrationSql).toContain("provenance jsonb not null");
    expect(migrationSql).toContain("check (target = 'mem0')");
    expect(migrationSql).toContain("status in (");
    expect(migrationSql).toContain("delivery_in_progress");
    expect(migrationSql).toContain("local_visibility text not null default 'active'");
    expect(migrationSql).toContain("health_semantic_memory_outbox_suppression_reference_chk");
    expect(migrationSql).toContain("health_semantic_memory_outbox_sensitive_delivery_chk");
    expect(migrationSql).toContain("health_semantic_memory_outbox_user_category_status_idx");
  });

  it("keeps Drizzle metadata in parity with migration constraints", () => {
    const config = getTableConfig(healthSemanticMemoryOutbox);
    expect(config.name).toBe("health_semantic_memory_outbox");
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "health_semantic_memory_outbox_schema_version_chk",
      "health_semantic_memory_outbox_flow_chk",
      "health_semantic_memory_outbox_digest_chk",
      "health_semantic_memory_outbox_category_chk",
      "health_semantic_memory_outbox_target_chk",
      "health_semantic_memory_outbox_operation_chk",
      "health_semantic_memory_outbox_status_chk",
      "health_semantic_memory_outbox_local_visibility_chk",
      "health_semantic_memory_outbox_suppression_reference_chk",
      "health_semantic_memory_outbox_sensitive_delivery_chk",
      "health_semantic_memory_outbox_content_pair_chk",
      "health_semantic_memory_outbox_provenance_chk",
    ]));
  });

  it.runIf(task13PostgresUrl)(
    "applies idempotently on a disposable PostgreSQL database and enforces outbox constraints",
    async () => {
      if (!task13PostgresUrl) throw new Error("TASK13_POSTGRES_URL is required");
      assertScratchTask13Database(task13PostgresUrl);
      const client = new pg.Client({ connectionString: task13PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task13-postgres] ${version.rows[0]?.version ?? "unknown"}`);

        const proposalId = `health.memory.${randomUUID()}`;
        const idempotencyKey = `task13:${randomUUID()}`;
        const digest = `sha256:${"a".repeat(64)}`;
        const policyDigest = `sha256:${"b".repeat(64)}`;
        const semanticDigest = `sha256:${"c".repeat(64)}`;
        const normalizedProposal = {
          proposalId,
          idempotencyKey,
          schemaVersion: "1.0.0",
          status: "approval_required",
        };
        await client.query(
          `insert into public.health_semantic_memory_outbox (
              proposal_id, schema_version, idempotency_key, user_id, profile_id,
              mem0_user_id, flow_id, flow_version, flow_instance_id,
              completion_reference, answer_digest, category, target, operation,
              status, content, content_digest, policy_decision, policy_reason_code,
              policy_decision_digest, consent_revision, approval_reference,
              provenance, provider, normalized_proposal, semantic_digest
            ) values (
              $1, '1.0.0', $2, 'user-task13', 'profile-task13',
              'mem0-task13', 'health.preventive_check', '1.0.0', 'session-task13',
              'completion-task13', $3, 'routine_health_context', 'mem0', 'write',
              'approval_required', 'Routine context only', $4, 'approval_required',
              'health_memory_policy_approval_required', $5, 1, 'consent-task13',
              $6::jsonb, 'mem0', $7::jsonb, $8
            )`,
          [
            proposalId,
            idempotencyKey,
            digest,
            digest,
            policyDigest,
            JSON.stringify({
              source: "health.preventive_check",
              sourceRecordId: "completion-task13",
              sourceDigest: digest,
              observedAt: "2026-08-08T09:30:00.000Z",
              flowInstanceId: "session-task13",
            }),
            JSON.stringify(normalizedProposal),
            semanticDigest,
          ],
        );
        await expect(client.query(
          `insert into public.health_semantic_memory_outbox (
              proposal_id, schema_version, idempotency_key, user_id, mem0_user_id,
              flow_id, flow_version, flow_instance_id, completion_reference,
              answer_digest, category, target, operation, status,
              policy_decision, policy_reason_code, policy_decision_digest,
              provenance, provider, provider_memory_id, normalized_proposal, semantic_digest
            ) values (
              $1, '1.0.0', $2, 'user-task13', 'mem0-task13',
              'health.preventive_check', '1.0.0', 'session-task13', 'completion-task13',
              $3, 'mental_health', 'mem0', 'write', 'delivered',
              'allow', 'health_memory_policy_write_allowed', $4,
              $5::jsonb, 'mem0', 'mem0.mental.invalid', $6::jsonb, $7
            )`,
          [
            `health.memory.invalid.${randomUUID()}`,
            `task13.invalid.${randomUUID()}`,
            digest,
            policyDigest,
            JSON.stringify({
              source: "health.preventive_check",
              sourceRecordId: "completion-task13",
              sourceDigest: digest,
              observedAt: "2026-08-08T09:30:00.000Z",
              flowInstanceId: "session-task13",
            }),
            JSON.stringify(normalizedProposal),
            semanticDigest,
          ],
        )).rejects.toMatchObject({ code: "23514" });
      } finally {
        await client.end();
      }
    },
    180_000,
  );
});
