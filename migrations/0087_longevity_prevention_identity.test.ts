import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0087_longevity_prevention_identity.sql", import.meta.url), "utf8").toLowerCase();

describe("longevity prevention plan identity repair", () => {
  it("removes the Supabase-only policy and RLS dependency", () => {
    expect(sql).toContain("drop policy if exists user_own_prevention_plans");
    expect(sql).toContain("disable row level security");
    expect(sql).not.toContain("auth.uid()");
  });

  it("converts ownership to the canonical health profile", () => {
    expect(sql).toContain("drop constraint if exists longevity_prevention_plans_user_id_fkey");
    expect(sql).toMatch(/alter column user_id type text using user_id::text/);
    expect(sql).toMatch(/foreign key \(user_id\) references public\.profiles\(id\) on delete cascade/);
  });

  it("preserves existing plan rows", () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
    expect(sql).not.toMatch(/\btruncate\b/);
  });
});
