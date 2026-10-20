import { readFileSync } from "node:fs";
import pg from "pg";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(new URL("./0114_medicine_check.sql", import.meta.url), "utf8");
const task13PostgresUrl = process.env.TASK13_POSTGRES_URL;

function assertScratchDatabase(url: string): void {
  const databaseName = new URL(url).pathname.toLowerCase().replace(/^\//u, "");
  if (!databaseName.includes("task13") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Migration 0114 PostgreSQL tests require the disposable Task 13 test database");
  }
}

const existingRuntimeSchema = `
  create table public.profiles (id text primary key);
  insert into public.profiles (id) values ('user-1');

  create table public.interaction_flag_rules (
    id uuid primary key default gen_random_uuid(),
    class_a text not null,
    class_b text not null,
    flag_message_es text not null,
    flag_message_de text not null,
    flag_message_en text not null,
    severity_tier text not null default 'worth_asking',
    is_active boolean not null default false,
    reviewed_by text,
    reviewed_at timestamptz,
    created_at timestamptz not null default now()
  );
  create unique index interaction_flag_rules_class_pair_unique
    on public.interaction_flag_rules (class_a, class_b);

  create table public.interaction_flag_dismissals (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    rule_id uuid not null references public.interaction_flag_rules(id) on delete cascade,
    medicine_pair jsonb not null,
    dismissed_at timestamptz not null default now(),
    reason text
  );

  -- This is the pre-migration runtime shape already present in DEV and PROD.
  create table public.interaction_flag_states (
    id uuid primary key default gen_random_uuid(),
    user_id text not null,
    rule_id uuid references public.interaction_flag_rules(id) on delete cascade,
    medicine_pair jsonb not null,
    flag_key text not null,
    status text not null default 'open',
    opened_at timestamptz not null default now(),
    asked_at timestamptz,
    snooze_until timestamptz,
    snooze_count integer not null default 0
  );
  create unique index interaction_flag_states_user_key_unique
    on public.interaction_flag_states (user_id, flag_key);

  create table public.my_medicines (
    user_id text not null,
    item_type text not null default 'prescription',
    drug_class_tag text,
    added_via text not null default 'voice'
  );
  create table public.my_medicines_change_log (user_id text not null);
  create table public.user_medications (user_id text not null);
  create table public.medication_adherence (user_id text not null);
  create table public.medication_inventory_events (user_id text not null, actor_user_id text not null);
  create table public.medication_refill_alerts (user_id text not null);
  create table public.medication_refill_push_deliveries (profile_id text not null, recipient_user_id text not null);
  create table public.medication_safety_signals (user_id text not null);
  create table public.medication_safety_cases (user_id text not null);
  create table public.medication_safety_case_events (user_id text not null);

  insert into public.interaction_flag_rules (
    id, class_a, class_b, flag_message_en, flag_message_es, flag_message_de
  ) values (
    '11111111-1111-4111-8111-111111111111',
    'blood_thinner', 'nsaid_pain_reliever',
    'Ask about these medicines', 'Pregunta por estos medicamentos', 'Fragen Sie nach diesen Medikamenten'
  );
  insert into public.interaction_flag_dismissals (
    id, user_id, rule_id, medicine_pair, dismissed_at, reason
  ) values (
    '22222222-2222-4222-8222-222222222222',
    'user-1', '11111111-1111-4111-8111-111111111111',
    '["Warfarin", "Ibuprofen"]'::jsonb,
    '2026-10-18T12:00:00Z', 'asked_pharmacist'
  );
`;

describe("Migration 0114 against the existing runtime Medicine Check schema", () => {
  it.runIf(task13PostgresUrl)(
    "keeps the existing state table, copies dismissals, and applies its contract idempotently",
    async () => {
      if (!task13PostgresUrl) throw new Error("TASK13_POSTGRES_URL is required");
      assertScratchDatabase(task13PostgresUrl);
      const client = new pg.Client({ connectionString: task13PostgresUrl });
      await client.connect();
      try {
        await client.query("begin");
        await client.query(existingRuntimeSchema);
        await client.query(migrationSql);
        await client.query(`
          update public.interaction_flag_rules
          set messages = jsonb_set(messages, '{en,why}', '"edited"'::jsonb),
              approved_locales = array['en']::text[],
              is_active = true,
              reviewed_by = 'test',
              reviewed_at = now()
          where id = '11111111-1111-4111-8111-111111111111'
        `);
        await client.query(migrationSql);

        const reviewedRule = await client.query<{
          why: string;
          approved_locales: string[];
          is_active: boolean;
          reviewed_by: string;
        }>(`
          select
            messages #>> '{en,why}' as why,
            approved_locales,
            is_active,
            reviewed_by
          from public.interaction_flag_rules
          where id = '11111111-1111-4111-8111-111111111111'
        `);
        expect(reviewedRule.rows[0]).toEqual({
          why: "edited",
          approved_locales: ["en"],
          is_active: true,
          reviewed_by: "test",
        });

        const stateRows = await client.query<{
          id: string;
          status: string;
          asked_at: Date | null;
          snooze_count: number;
        }>(`
          select id::text, status, asked_at, snooze_count
          from public.interaction_flag_states
          where user_id = 'user-1'
        `);
        expect(stateRows.rows).toEqual([expect.objectContaining({
          id: "22222222-2222-4222-8222-222222222222",
          status: "asked",
          asked_at: new Date("2026-10-18T12:00:00Z"),
          snooze_count: 0,
        })]);

        const legacyRows = await client.query<{ count: string }>(
          "select count(*)::text as count from public.interaction_flag_dismissals",
        );
        expect(legacyRows.rows[0]?.count).toBe("1");

        const legacyColumns = await client.query<{ column_name: string }>(`
          select column_name
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'interaction_flag_rules'
            and column_name in ('flag_message_en', 'flag_message_es', 'flag_message_de')
          order by column_name
        `);
        expect(legacyColumns.rows.map((row) => row.column_name)).toEqual([
          "flag_message_de",
          "flag_message_en",
          "flag_message_es",
        ]);

        const contract = await client.query<{ status_checks: string; unique_indexes: string; profile_fks: string }>(`
          select
            (select count(*)::text from pg_constraint
             where conrelid = 'public.interaction_flag_states'::regclass
               and conname = 'interaction_flag_states_status_check') as status_checks,
            (select count(*)::text from pg_indexes
             where schemaname = 'public'
               and tablename = 'interaction_flag_states'
               and indexname = 'interaction_flag_states_user_key_unique') as unique_indexes,
            (select count(*)::text from pg_constraint
             where conrelid = 'public.interaction_flag_states'::regclass
               and conname = 'interaction_flag_states_user_id_profiles_fk') as profile_fks
        `);
        expect(contract.rows[0]).toEqual({
          status_checks: "1",
          unique_indexes: "1",
          profile_fks: "1",
        });

        const columns = await client.query<{ column_name: string; data_type: string }>(`
          select column_name, data_type
          from information_schema.columns
          where table_schema = 'public' and table_name = 'interaction_flag_states'
          order by ordinal_position
        `);
        expect(columns.rows).toEqual([
          { column_name: "id", data_type: "uuid" },
          { column_name: "user_id", data_type: "text" },
          { column_name: "rule_id", data_type: "uuid" },
          { column_name: "medicine_pair", data_type: "jsonb" },
          { column_name: "flag_key", data_type: "text" },
          { column_name: "status", data_type: "text" },
          { column_name: "opened_at", data_type: "timestamp with time zone" },
          { column_name: "asked_at", data_type: "timestamp with time zone" },
          { column_name: "snooze_until", data_type: "timestamp with time zone" },
          { column_name: "snooze_count", data_type: "integer" },
        ]);
      } finally {
        await client.query("rollback").catch(() => undefined);
        await client.end();
      }
    },
    180_000,
  );
});
