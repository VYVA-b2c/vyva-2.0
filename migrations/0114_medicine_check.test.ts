import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("./0114_medicine_check.sql", import.meta.url), "utf8").toLowerCase();
describe("0114 medicine check migration", () => {
  it("uses profile foreign keys and no Supabase auth", () => { expect(sql).toContain("references public.profiles(id)"); expect(sql).not.toContain("auth.users"); expect(sql).not.toContain("auth.uid()"); });
  it("ships all approvals empty", () => expect(sql).toContain("set approved_locales = '{}'") );
  it("requires reviewer and localized why before approval", () => { expect(sql).toContain("reviewed_by is not null"); expect(sql).toContain("messages #>>"); });
});
