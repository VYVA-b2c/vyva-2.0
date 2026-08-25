import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0086_longevity_prevention_plans.sql", import.meta.url), "utf8").toLowerCase();

describe("longevity prevention plans migration", () => {
  it("creates the monthly five-pillar plan store and indexes", () => {
    expect(sql).toContain("create table if not exists public.longevity_prevention_plans");
    expect(sql).toMatch(/user_id\s+text\s+not null references public\.profiles\(id\) on delete cascade/);
    expect(sql).toContain("pillar_heart");
    expect(sql).toContain("cross_pillar_patterns");
    expect(sql).toContain("idx_lpp_user_generated");
    expect(sql).toContain("idx_lpp_user_active");
  });

  it("uses the canonical health-profile identity without Supabase-only auth dependencies", () => {
    expect(sql).not.toContain("auth.users");
    expect(sql).not.toContain("auth.uid()");
    expect(sql).not.toContain("enable row level security");
    expect(sql).toContain("access is enforced by authenticated express routes");
  });

  it("does not apply destructive table or column changes", () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
  });
});
