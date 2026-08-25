import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0086_longevity_prevention_plans.sql", import.meta.url), "utf8").toLowerCase();

describe("longevity prevention plans migration", () => {
  it("creates the monthly five-pillar plan store and indexes", () => {
    expect(sql).toContain("create table if not exists public.longevity_prevention_plans");
    expect(sql).toContain("pillar_heart");
    expect(sql).toContain("cross_pillar_patterns");
    expect(sql).toContain("idx_lpp_user_generated");
    expect(sql).toContain("idx_lpp_user_active");
  });

  it("enables ownership RLS for reads and writes", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("using (auth.uid() = user_id)");
    expect(sql).toContain("with check (auth.uid() = user_id)");
  });

  it("does not apply destructive table or column changes", () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
  });
});
