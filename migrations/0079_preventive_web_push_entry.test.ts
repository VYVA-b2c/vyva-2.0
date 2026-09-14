import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  preventiveWebPushDeliveries,
  preventiveWebPushEntryTokens,
  preventiveWebPushSubscriptions,
  userChannelPreferences,
} from "../shared/schema.js";

const migrationSql = fs.readFileSync(
  new URL("./0079_preventive_web_push_entry.sql", import.meta.url),
  "utf8",
);

const task10PostgresUrl = process.env.TASK10_POSTGRES_URL;

function assertScratchTask10Database(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//, "");
  if (!databaseName.includes("task10") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 10 PostgreSQL tests require a scratch database name containing task10 and test/tmp/ci/scratch");
  }
}

describe("Task 10 preventive web push migration 0079", () => {
  it("adds dedicated consent, subscription, delivery and entry-token storage", () => {
    expect(migrationSql).toContain("create extension if not exists pgcrypto");
    expect(migrationSql).toContain("preventive_web_push_enabled boolean not null default false");
    expect(migrationSql).toContain("preventive_web_push_subscriptions");
    expect(migrationSql).toContain("preventive_web_push_deliveries");
    expect(migrationSql).toContain("preventive_web_push_entry_tokens");
    expect(migrationSql).toContain("endpoint_digest text not null unique");
    expect(migrationSql).toContain("delivery_key text not null unique");
    expect(migrationSql).toContain("token_digest text not null unique");
    expect(migrationSql).toContain("check (channel = 'web_push')");
    expect(migrationSql).toContain("check (purpose_id = 'daily_wellbeing_check')");
    expect(migrationSql).toContain("check (flow_id = 'health.preventive_check' and flow_version = '1.0.0')");
  });

  it("keeps Drizzle Task 10 metadata in parity with migration constraints", () => {
    const preferenceConfig = getTableConfig(userChannelPreferences);
    const subscriptionConfig = getTableConfig(preventiveWebPushSubscriptions);
    const deliveryConfig = getTableConfig(preventiveWebPushDeliveries);
    const tokenConfig = getTableConfig(preventiveWebPushEntryTokens);
    const deliveryColumns = deliveryConfig.columns.map((column) => column.name);
    expect(deliveryColumns).toEqual(expect.arrayContaining([
      "provider_attempt_id",
      "provider_attempt_number",
      "provider_attempt_started_at",
      "provider_attempt_accepted_at",
    ]));
    expect(subscriptionConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_web_push_subscriptions_status_chk",
      "preventive_web_push_subscriptions_endpoint_digest_chk",
      "preventive_web_push_subscriptions_keys_nonempty_chk",
    ]));
    expect(deliveryConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_web_push_deliveries_status_chk",
      "preventive_web_push_deliveries_channel_chk",
      "preventive_web_push_deliveries_purpose_chk",
      "preventive_web_push_deliveries_flow_chk",
      "preventive_web_push_deliveries_provider_attempt_required_chk",
    ]));
    expect(tokenConfig.checks.map((item) => item.name)).toEqual(expect.arrayContaining([
      "preventive_web_push_entry_tokens_status_chk",
      "preventive_web_push_entry_tokens_route_chk",
      "preventive_web_push_entry_tokens_expiry_chk",
    ]));
    expect(preferenceConfig.checks.map((item) => item.name)).toContain(
      "user_channel_preferences_preventive_web_push_revision_chk",
    );
  });

  it.runIf(task10PostgresUrl)(
    "applies idempotently on a disposable PostgreSQL database and preserves legacy nullable rows",
    async () => {
      if (!task10PostgresUrl) throw new Error("TASK10_POSTGRES_URL is required");
      assertScratchTask10Database(task10PostgresUrl);
      const client = new pg.Client({ connectionString: task10PostgresUrl });
      await client.connect();
      try {
        await client.query("create table if not exists public.user_channel_preferences (id uuid primary key default gen_random_uuid(), user_id text not null unique, updated_at timestamptz not null default now())");
        await client.query(migrationSql);
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task10-postgres] ${version.rows[0]?.version ?? "unknown"}`);
        await client.query("insert into public.user_channel_preferences (user_id) values ($1) on conflict do nothing", ["legacy-user"]);
        const legacy = await client.query(
          `select preventive_web_push_enabled,
                  preventive_web_push_consent_revision
             from public.user_channel_preferences
            where user_id = $1`,
          ["legacy-user"],
        );
        expect(legacy.rows[0]).toMatchObject({
          preventive_web_push_enabled: false,
          preventive_web_push_consent_revision: 0,
        });
        const deliveryKey = `delivery.${randomUUID()}`;
        await client.query(
          `insert into public.preventive_web_push_deliveries (
              delivery_key, user_id, subscription_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version
            ) values (
              $1, 'user-1', gen_random_uuid(), 'occurrence-1',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'web_push',
              'health.preventive_check', '1.0.0'
            )`,
          [deliveryKey],
        );
        await expect(client.query(
          `insert into public.preventive_web_push_deliveries (
              delivery_key, user_id, subscription_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version,
              status, provider_attempt_id
            ) values (
              $1, 'user-1', gen_random_uuid(), 'occurrence-1',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'web_push',
              'health.preventive_check', '1.0.0',
              'delivery_uncertain', 'provider-attempt.test'
            )`,
          [deliveryKey],
        )).rejects.toMatchObject({ code: "23505" });
        await expect(client.query(
          `insert into public.preventive_web_push_deliveries (
              delivery_key, user_id, subscription_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version,
              status
            ) values (
              $1, 'user-1', gen_random_uuid(), 'occurrence-2',
              'schedule.daily.checkin', 'daily_wellbeing_check', 'web_push',
              'health.preventive_check', '1.0.0',
              'delivery_uncertain'
            )`,
          [`delivery.missing-provider.${randomUUID()}`],
        )).rejects.toMatchObject({ code: "23514" });
      } finally {
        await client.end();
      }
    },
    180_000,
  );
});
