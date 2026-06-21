import { describe, expect, it } from "vitest";
import rememberLaterSql from "../../migrations/0040_remember_later.sql?raw";

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
});
