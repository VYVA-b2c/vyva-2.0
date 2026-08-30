import { describe, expect, it } from "vitest";
import listenCloselySql from "../../migrations/0043_listen_closely.sql?raw";
import { BRAIN_COACH_MAX_LEVEL } from "./shared/brainCoachProgression";
import {
  LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES,
  computeListenCloselyResult,
  getDefaultListenCloselyUserState,
  getNextListenCloselyStateAfterSession,
} from "./shared/listenCloselyData";

describe("Listen Closely data and scoring", () => {
  it("creates the required database tables, policies, and generated seed", () => {
    expect(listenCloselySql).toContain("create table if not exists public.listen_closely_soundscapes");
    expect(listenCloselySql).toContain("create table if not exists public.listen_closely_sessions");
    expect(listenCloselySql).toContain("create table if not exists public.listen_closely_user_state");
    expect(listenCloselySql).toContain("listen_closely_soundscapes_read");
    expect(listenCloselySql).toContain("listen_closely_sessions_user_all");
    expect(listenCloselySql).toContain("listen_closely_state_user_all");
    expect(listenCloselySql).toContain("generate_series(1, 10)");
    expect(listenCloselySql).toContain("generate_series(1, 20)");
    expect(listenCloselySql).toContain("on conflict (id) do nothing");
  });

  it("provides 20 local fallback soundscapes per tier", () => {
    expect(LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES).toHaveLength(BRAIN_COACH_MAX_LEVEL * 20);

    for (let tier = 1; tier <= BRAIN_COACH_MAX_LEVEL; tier += 1) {
      const tierRows = LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES.filter((row) => row.difficulty_tier === tier);
      expect(tierRows).toHaveLength(20);
      expect(new Set(tierRows.map((row) => row.mode)).size).toBe(3);
    }
  });

  it("scores tap modes with hits, misses, false positives, and reaction time", () => {
    const result = computeListenCloselyResult({
      soundscape: {
        id: "local",
        mode: "find_it",
        difficulty_tier: 2,
        duration_seconds: 18,
        target_sound_character: "chime",
        target_event_times: [1000, 3000],
        distractor_events: [],
        response_window_ms: 1000,
      },
      tapTimesMs: [1200, 2500, 3200, 5200],
    });

    expect(result.hits).toBe(2);
    expect(result.misses).toBe(0);
    expect(result.false_positives).toBe(2);
    expect(result.avg_reaction_time_ms).toBe(200);
    expect(result.accuracy_pct).toBe(100);
    expect(result.score).toBeGreaterThan(900);
  });

  it("scores count-compare mode from the final choice", () => {
    const result = computeListenCloselyResult({
      soundscape: {
        id: "local-compare",
        mode: "count_compare",
        difficulty_tier: 1,
        duration_seconds: 18,
        target_sound_character: "tap",
        target_event_times: [1000, 3000, 5000],
        second_target_sound_character: "ring",
        second_target_event_times: [2000],
        response_window_ms: 1500,
      },
      comparisonChoice: "tap",
    });

    expect(result.comparison_correct).toBe(true);
    expect(result.accuracy_pct).toBe(100);
    expect(result.score).toBe(700);
  });

  it("promotes after three wins and keeps streak state", () => {
    const previous = {
      ...getDefaultListenCloselyUserState("user-1"),
      current_tier: 2,
      consecutive_wins: 2,
      last_streak_date: "2026-06-21",
      streak_days: 4,
    };
    const next = getNextListenCloselyStateAfterSession(previous, {
      mode: "find_it",
      accuracy_pct: 90,
      score: 850,
      abandoned: false,
    }, new Date("2026-06-22T10:00:00Z"));

    expect(next.current_tier).toBe(3);
    expect(next.consecutive_wins).toBe(0);
    expect(next.streak_days).toBe(5);
    expect(next.best_score).toBe(850);
  });
});
