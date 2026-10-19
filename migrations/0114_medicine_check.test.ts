import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("./0114_medicine_check.sql", import.meta.url), "utf8").toLowerCase();
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
});
