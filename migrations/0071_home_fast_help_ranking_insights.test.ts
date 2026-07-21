import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0071_home_fast_help_ranking_insights.sql", import.meta.url), "utf8");

describe("Home Fast Help ranking insights migration", () => {
  it("stores only ordered action exposure, ranking version, owner, and time", () => {
    expect(sql).toContain("user_id uuid not null references auth.users(id) on delete cascade");
    expect(sql).toContain("action_ids text[] not null");
    expect(sql).toContain("ranking_version text not null");
    expect(sql).toContain("shown_at timestamptz not null");
    expect(sql).toContain("cardinality(action_ids) = 3");
    expect(sql).toContain("action_ids[1] <> action_ids[2]");
    expect(sql).not.toMatch(/diagnos|cognitive|symptom|condition|score|reason|metadata/i);
  });

  it("links journeys to impressions and keeps strict per-user RLS", () => {
    expect(sql).toContain("add column if not exists impression_id uuid");
    expect(sql).toContain("foreign key (impression_id, user_id)");
    expect(sql).toContain("references public.home_fast_help_impressions(id, user_id)");
    expect(sql).toContain("deferrable initially deferred");
    expect(sql).toContain("alter table public.home_fast_help_impressions enable row level security");
    expect(sql).toContain("for select");
    expect(sql).toContain("for insert");
    expect(sql).toContain("using (auth.uid() = user_id)");
    expect(sql).toContain("with check (auth.uid() = user_id)");
    expect(sql).not.toContain("for all");
    expect(sql).not.toContain("auth.uid()::text");
  });
});
