import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { healthCaregiverOperatorEscalationProjections } from "../shared/schema.js";

const migrationSql = fs.readFileSync(
  new URL("./0082_health_caregiver_operator_escalation_projections.sql", import.meta.url),
  "utf8",
);

const task14PostgresUrl = process.env.TASK14_POSTGRES_URL;

function assertScratchTask14Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task14") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 14 PostgreSQL tests require a scratch database name containing task14 and test/tmp/ci/scratch");
  }
}

describe("Task 14 health caregiver/operator escalation migration 0082", () => {
  it("adds a dedicated projection table without altering alerts or queues", () => {
    expect(migrationSql).toContain("health_caregiver_operator_escalation_projections");
    expect(migrationSql).toContain("projection_id text not null unique");
    expect(migrationSql).toContain("idempotency_key text not null unique");
    expect(migrationSql).toContain("source_event_id text not null");
    expect(migrationSql).toContain("source_alert_id text");
    expect(migrationSql).toContain("acknowledgement_state text not null default 'unacknowledged'");
    expect(migrationSql).toContain("health_escalation_projection_actor_scope_chk");
    expect(migrationSql).toContain("health_escalation_projection_ack_fields_chk");
    expect(migrationSql).not.toContain("alter table public.caregiver_alerts");
    expect(migrationSql).not.toContain("alter table public.concierge_pending");
  });

  it("keeps Drizzle metadata in parity with migration constraints", () => {
    const config = getTableConfig(healthCaregiverOperatorEscalationProjections);
    expect(config.name).toBe("health_caregiver_operator_escalation_projections");
    expect(config.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "health_escalation_projection_schema_version_chk",
      "health_escalation_projection_flow_chk",
      "health_escalation_projection_digest_chk",
      "health_escalation_projection_purpose_chk",
      "health_escalation_projection_audience_chk",
      "health_escalation_projection_actor_role_chk",
      "health_escalation_projection_actor_scope_chk",
      "health_escalation_projection_decision_chk",
      "health_escalation_projection_status_chk",
      "health_escalation_projection_ack_state_chk",
      "health_escalation_projection_ack_fields_chk",
      "health_escalation_projection_safe_summary_chk",
    ]));
  });

  it.runIf(task14PostgresUrl)(
    "applies idempotently on disposable PostgreSQL and enforces projection constraints",
    async () => {
      if (!task14PostgresUrl) throw new Error("TASK14_POSTGRES_URL is required");
      assertScratchTask14Database(task14PostgresUrl);
      const client = new pg.Client({ connectionString: task14PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task14-postgres] ${version.rows[0]?.version ?? "unknown"}`);

        const projectionId = `health.escalation.projection.${randomUUID()}`;
        const idempotencyKey = `health.escalation.idempotency.${randomUUID()}`;
        const digest = `sha256:${"a".repeat(64)}`;
        const policyDigest = `sha256:${"b".repeat(64)}`;
        const semanticDigest = `sha256:${"c".repeat(64)}`;
        await client.query(
          `insert into public.health_caregiver_operator_escalation_projections (
              schema_version, projection_id, idempotency_key, subject_user_id, profile_id,
              target_audience, target_actor_id, target_actor_role,
              flow_id, flow_version, flow_instance_id, source_event_id, source_alert_id,
              completion_reference, answer_digest, escalation_purpose, safe_summary,
              authorization_decision, authorization_reason_code,
              consent_decision, consent_reason_code, policy_decision_digest,
              consent_revision, approval_reference, status, acknowledgement_state,
              semantic_digest
            ) values (
              '1.0.0', $1, $2, 'user-task14', 'profile-task14',
              'caregiver', 'caregiver-task14', 'caregiver',
              'health.preventive_check', '1.0.0', 'flow-task14',
              'event.health.preventive_check.completed.task14', null,
              'completion-task14', $3, 'health.preventive_check.caregiver_operator_escalation',
              $4::jsonb, 'allow', 'health_escalation_authorized_caregiver',
              'allow', 'health_escalation_caregiver_consent_allowed', $5,
              1, 'stage9-consent-task14', 'visible', 'unacknowledged',
              $6
            )`,
          [
            projectionId,
            idempotencyKey,
            digest,
            JSON.stringify({
              category: "preventive_health_caregiver_flag",
              severity: "attention",
              reasonCode: "preventive_health_result_flagged_caregiver",
              rawHealthAnswerContentRetained: false,
            }),
            policyDigest,
            semanticDigest,
          ],
        );

        await expect(client.query(
          `insert into public.health_caregiver_operator_escalation_projections (
              schema_version, projection_id, idempotency_key, subject_user_id,
              target_audience, target_actor_role,
              flow_id, flow_version, flow_instance_id, source_event_id,
              completion_reference, answer_digest, escalation_purpose, safe_summary,
              authorization_decision, authorization_reason_code,
              consent_decision, consent_reason_code, policy_decision_digest,
              status, acknowledgement_state, semantic_digest
            ) values (
              '1.0.0', $1, $2, 'user-task14',
              'caregiver', 'caregiver',
              'health.preventive_check', '1.0.0', 'flow-task14', 'event-task14',
              'completion-task14', $3, 'health.preventive_check.caregiver_operator_escalation',
              $4::jsonb, 'allow', 'health_escalation_authorized_caregiver',
              'allow', 'health_escalation_caregiver_consent_allowed', $5,
              'visible', 'unacknowledged', $6
            )`,
          [
            `health.escalation.projection.invalid.${randomUUID()}`,
            `health.escalation.idempotency.invalid.${randomUUID()}`,
            digest,
            JSON.stringify({
              category: "preventive_health_caregiver_flag",
              severity: "attention",
              reasonCode: "preventive_health_result_flagged_caregiver",
              rawHealthAnswerContentRetained: false,
            }),
            policyDigest,
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
