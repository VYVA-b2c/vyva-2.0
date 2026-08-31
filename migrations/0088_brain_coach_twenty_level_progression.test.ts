import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0088_brain_coach_twenty_level_progression.sql", import.meta.url), "utf8");
const lowerSql = sql.toLowerCase();

describe("brain coach 20-level progression migration", () => {
  it("widens visible Brain Coach tier checks to twenty levels", () => {
    [
      "remember_later_rounds",
      "remember_later_sessions",
      "remember_later_user_state",
      "listen_closely_soundscapes",
      "listen_closely_sessions",
      "listen_closely_user_state",
      "dual_task_sequences",
      "dual_task_sessions",
      "dual_task_user_state",
      "category_sort_sequences",
      "category_sort_sessions",
      "category_sort_user_state",
      "number_trails_configs",
      "number_trails_sessions",
      "number_trails_user_state",
      "face_name_sets",
      "face_name_sessions",
      "face_name_user_state",
    ].forEach((tableName) => {
      expect(lowerSql).toContain(`alter table if exists public.${tableName}`);
    });

    expect(lowerSql.match(/between 1 and 20/g)?.length).toBeGreaterThanOrEqual(18);
    expect(lowerSql).not.toContain("between 1 and 10");
    expect(lowerSql).toContain("alter column current_tier set default 1");
    expect(lowerSql).toContain("set has_seen_tutorial = true");
    expect(lowerSql).toContain("where current_tier >= 2");
  });

  it("seeds tiers eleven through twenty for DB-backed visible activities", () => {
    [
      "remember_later_rounds",
      "listen_closely_soundscapes",
      "dual_task_sequences",
      "number_trails_configs",
      "category_sort_sequences",
      "face_name_sets",
    ].forEach((tableName) => {
      expect(lowerSql).toContain(`insert into public.${tableName}`);
    });

    expect(lowerSql.match(/generate_series\(11, 20\)/g)?.length).toBeGreaterThanOrEqual(6);
    expect(lowerSql.match(/variant_number <= 20/g)?.length).toBeGreaterThanOrEqual(4);
    expect(lowerSql).toContain("cross join generate_series(1, 20) as variant");
  });

  it("keeps hidden activities out of this staged migration", () => {
    expect(lowerSql).not.toMatch(/public\.spatial_navigator/);
    expect(lowerSql).not.toMatch(/public\.routine_memory/);
  });
});
