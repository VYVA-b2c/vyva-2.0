import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("./0114_medicine_check.sql", import.meta.url), "utf8").toLowerCase();
const runtime = readFileSync(new URL("../server/routes/medsAdherence.ts", import.meta.url), "utf8").toLowerCase();
describe("0114 medicine check migration", () => {
  it("uses profile foreign keys and no Supabase auth", () => { expect(sql).toContain("references public.profiles(id)"); expect(sql).not.toContain("auth.users"); expect(sql).not.toContain("auth.uid()"); });
  it("ships all approvals empty", () => expect(sql).toContain("set approved_locales = '{}'") );
  it("requires reviewer and localized why before approval", () => { expect(sql).toContain("reviewed_by is not null"); expect(sql).toContain("messages #>>"); });
  it("preserves legacy columns and the dismissals table while copying their data", () => {
    expect(sql).not.toMatch(/drop column/);
    expect(sql).not.toContain("interaction_flag_dismissals rename to interaction_flag_states");
    expect(sql).toContain("create table if not exists public.interaction_flag_states");
    expect(sql).toContain("from public.interaction_flag_dismissals");
    expect(sql).toContain("case reason when 'asked_pharmacist' then 'asked' when 'not_now' then 'snoozed'");
    expect(sql).toContain("case when reason = 'asked_pharmacist' then dismissed_at end");
  });
  it("keeps the migration and runtime state-table contracts aligned", () => {
    for (const fragment of [
      "id uuid primary key default gen_random_uuid()",
      "user_id text not null",
      "rule_id uuid references",
      "medicine_pair jsonb not null",
      "flag_key text not null",
      "status text not null default 'open'",
      "opened_at timestamptz not null default now()",
      "asked_at timestamptz",
      "snooze_until timestamptz",
      "snooze_count integer not null default 0",
      "interaction_flag_states_status_check",
      "interaction_flag_states_user_id_profiles_fk",
      "interaction_flag_states_user_key_unique",
    ]) {
      expect(sql).toContain(fragment);
      expect(runtime).toContain(fragment);
    }
  });
});
