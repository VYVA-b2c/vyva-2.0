import { describe, expect, it } from "vitest";
import rememberLaterSql from "../../migrations/0040_remember_later.sql?raw";
import { buildRememberLaterRounds, TIER_SETTINGS } from "../../scripts/generate-remember-later-seed.mjs";

describe("Remember Later migration seed", () => {
  it("creates the required tables and policies", () => {
    expect(rememberLaterSql).toContain("create table if not exists public.remember_later_rounds");
    expect(rememberLaterSql).toContain("create table if not exists public.remember_later_sessions");
    expect(rememberLaterSql).toContain("create table if not exists public.remember_later_user_state");
    expect(rememberLaterSql).toContain("has_seen_tutorial boolean not null default false");
    expect(rememberLaterSql).toContain("remember_later_rounds_read");
    expect(rememberLaterSql).toContain("remember_later_sessions_user_all");
    expect(rememberLaterSql).toContain("remember_later_state_user_all");
  });

  it("seeds exactly 200 language-independent rounds", () => {
    const seededRows = rememberLaterSql.match(/\(\s*'[0-9a-f-]{36}',\s*'(event_based|time_based|dual)'/g) ?? [];

    expect(seededRows).toHaveLength(200);
    expect(rememberLaterSql).toContain("on conflict (id) do nothing");
    expect(rememberLaterSql).not.toMatch(/\blanguage\b/);

    for (let tier = 1; tier <= 10; tier += 1) {
      const tierRows = rememberLaterSql.match(new RegExp(`'${tier <= 4 ? "event_based" : tier <= 8 ? "time_based" : "dual"}',\\s*${tier},`, "g")) ?? [];
      expect(tierRows).toHaveLength(20);
    }
  });

  it("generates the 20-level progression content", () => {
    const generatedRows = buildRememberLaterRounds();

    expect(generatedRows).toHaveLength(400);
    expect(TIER_SETTINGS).toHaveLength(20);

    for (let tier = 1; tier <= 20; tier += 1) {
      const tierRows = generatedRows.filter((row) => row.difficulty_tier === tier);
      const expectedRoundType = tier <= 4 ? "event_based" : tier <= 8 ? "time_based" : "dual";

      expect(tierRows).toHaveLength(20);
      expect(tierRows.every((row) => row.round_type === expectedRoundType)).toBe(true);
    }

    expect(generatedRows.filter((row) => row.difficulty_tier >= 15).every((row) => row.filler_item_interval_ms <= 1500)).toBe(true);
  });
});
