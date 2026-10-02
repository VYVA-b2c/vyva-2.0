import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0104_concierge_reminder_dismissals.sql", import.meta.url), "utf8");

describe("Concierge reminder dismissal migration", () => {
  it("is repeatable and keeps one dismissal per user and task", () => {
    expect(sql).toContain("create table if not exists public.concierge_reminder_dismissals");
    expect(sql).toContain("references public.profiles(id) on delete cascade");
    expect(sql).toContain("primary key (user_id, task_key)");
    expect(sql).toContain("revision text not null");
    expect(sql).not.toMatch(/drop|truncate/i);
  });
});
