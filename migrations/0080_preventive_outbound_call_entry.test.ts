import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  preventiveOutboundCallAttempts,
  preventiveOutboundCallConsents,
  preventiveOutboundCallWebhookEvents,
} from "../shared/schema.js";

const migrationSql = fs.readFileSync(
  new URL("./0080_preventive_outbound_call_entry.sql", import.meta.url),
  "utf8",
);

const task11PostgresUrl = process.env.TASK11_POSTGRES_URL;

function assertScratchTask11Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task11") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 11 PostgreSQL tests require a scratch database name containing task11 and test/tmp/ci/scratch");
  }
}

describe("Task 11 preventive outbound call migration 0080", () => {
  it("adds dedicated consent, call-attempt and webhook-event storage", () => {
    expect(migrationSql).toContain("create extension if not exists pgcrypto");
    expect(migrationSql).toContain("preventive_outbound_call_consents");
    expect(migrationSql).toContain("preventive_outbound_call_attempts");
    expect(migrationSql).toContain("preventive_outbound_call_webhook_events");
    expect(migrationSql).toContain("call_key text not null unique");
    expect(migrationSql).toContain("phone_digest text not null");
    expect(migrationSql).toContain("provider_conversation_id");
    expect(migrationSql).toContain("twilio_call_sid");
    expect(migrationSql).toContain("confirmation_token_digest");
    expect(migrationSql).toContain("flow_entry_claim_token");
    expect(migrationSql).toContain("cancellation_status");
    expect(migrationSql).toContain("check (channel = 'voice_call')");
    expect(migrationSql).toContain("check (purpose_id = 'daily_wellbeing_check')");
    expect(migrationSql).toContain("check (flow_id = 'health.preventive_check' and flow_version = '1.0.0')");
  });

  it("keeps Drizzle Task 11 metadata in parity with migration constraints", () => {
    const consentConfig = getTableConfig(preventiveOutboundCallConsents);
    const attemptConfig = getTableConfig(preventiveOutboundCallAttempts);
    const webhookConfig = getTableConfig(preventiveOutboundCallWebhookEvents);
    expect(consentConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_outbound_call_consents_revision_chk",
      "preventive_outbound_call_consents_phone_chk",
      "preventive_outbound_call_consents_enabled_requires_phone_chk",
    ]));
    expect(attemptConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_outbound_call_attempts_status_chk",
      "preventive_outbound_call_attempts_channel_chk",
      "preventive_outbound_call_attempts_purpose_chk",
      "preventive_outbound_call_attempts_flow_chk",
      "preventive_outbound_call_attempts_provider_attempt_required_chk",
      "preventive_outbound_call_attempts_provider_correlation_required_chk",
      "preventive_outbound_call_attempts_flow_entry_evidence_chk",
      "preventive_outbound_call_attempts_cancellation_status_chk",
    ]));
    expect(webhookConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_outbound_call_webhook_events_provider_chk",
      "preventive_outbound_call_webhook_events_key_chk",
      "preventive_outbound_call_webhook_events_status_chk",
    ]));
  });

  it.runIf(task11PostgresUrl)(
    "applies idempotently on a disposable PostgreSQL database and enforces provider identity constraints",
    async () => {
      if (!task11PostgresUrl) throw new Error("TASK11_POSTGRES_URL is required");
      assertScratchTask11Database(task11PostgresUrl);
      const client = new pg.Client({ connectionString: task11PostgresUrl });
      await client.connect();
      try {
        await client.query(migrationSql);
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task11-postgres] ${version.rows[0]?.version ?? "unknown"}`);
        const consent = await client.query<{ id: string }>(
          `insert into public.preventive_outbound_call_consents (
              user_id, profile_id, enabled, consent_revision, phone_e164,
              phone_digest, phone_last4, phone_verified_at, verification_source,
              verification_reference, granted_at, updated_at
            ) values (
              'user-1', 'profile-1', true, 1, '+15551234567',
              $1, '4567', now(), 'admin_provisioned', 'ticket-1', now(), now()
            )
            returning id`,
          [`sha256:${"a".repeat(64)}`],
        );
        const callKey = `call.${randomUUID()}`;
        await client.query(
          `insert into public.preventive_outbound_call_attempts (
              call_key, user_id, profile_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version,
              status, consent_id, consent_revision, phone_digest,
              provider_attempt_id, provider_conversation_id, twilio_call_sid,
              confirmation_token_digest, confirmation_token_expires_at
            ) values (
              $1, 'user-1', 'profile-1', 'occurrence-1',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'voice_call',
              'health.preventive_check', '1.0.0',
              'provider_started', $2, 1, $3,
              'provider-attempt-1', 'conversation-1', 'CA11111111111111111111111111111111',
              $4, now() + interval '15 minutes'
            )`,
          [callKey, consent.rows[0].id, `sha256:${"a".repeat(64)}`, `sha256:${"b".repeat(64)}`],
        );
        await expect(client.query(
          `insert into public.preventive_outbound_call_attempts (
              call_key, user_id, profile_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version,
              status, consent_id, consent_revision, phone_digest,
              provider_attempt_id, provider_conversation_id, twilio_call_sid
            ) values (
              $1, 'user-1', 'profile-1', 'occurrence-2',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'voice_call',
              'health.preventive_check', '1.0.0',
              'provider_started', $2, 1, $3,
              'provider-attempt-2', 'conversation-2', 'CA11111111111111111111111111111111'
            )`,
          [`call.duplicate.${randomUUID()}`, consent.rows[0].id, `sha256:${"a".repeat(64)}`],
        )).rejects.toMatchObject({ code: "23505" });
        await expect(client.query(
          `insert into public.preventive_outbound_call_attempts (
              call_key, user_id, profile_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version,
              status, consent_id, consent_revision, phone_digest
            ) values (
              $1, 'user-1', 'profile-1', 'occurrence-3',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'voice_call',
              'health.preventive_check', '1.0.0',
              'provider_started', $2, 1, $3
            )`,
          [`call.missing-provider.${randomUUID()}`, consent.rows[0].id, `sha256:${"a".repeat(64)}`],
        )).rejects.toMatchObject({ code: "23514" });
      } finally {
        await client.end();
      }
    },
    180_000,
  );
});
