import { describe, expect, it } from "vitest";
import {
  getRecommendedLevelForGame,
  getRepeatLevelForResult,
  getVisualMemoryLevelProgress,
  MEMORY_LEVEL_UP_ACCURACY,
  pickNextVariantForSameGame,
  VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
} from "./progressionEngine";
import type { GameResult } from "./types";
import { memoryGameRegistry } from "./memoryGameRegistry";

function visualResult(level: number, accuracy: number, minutesAgo: number): GameResult {
  return {
    userId: "user-1",
    gameType: "memory_match",
    cognitiveDomain: "visual_memory",
    variantId: `memory_match-l${level}-v${minutesAgo + 1}`,
    level,
    score: 500,
    accuracy,
    mistakes: 0,
    durationSeconds: 30,
    completedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    language: "en",
  };
}

describe("memory game progression", () => {
  it("keeps repeat on the current level below the level-up threshold", () => {
    expect(getRepeatLevelForResult(3, MEMORY_LEVEL_UP_ACCURACY - 1)).toBe(3);
  });

  it("moves repeat to the next level at the level-up threshold", () => {
    expect(getRepeatLevelForResult(3, MEMORY_LEVEL_UP_ACCURACY)).toBe(4);
  });

  it("does not move beyond the maximum level", () => {
    expect(getRepeatLevelForResult(20, 100)).toBe(20);
  });

  it("can exclude the just-played variant before storage history catches up", () => {
    const nextVariant = pickNextVariantForSameGame([], "memory_match", 1, "memory_match-l1-v1");

    expect(nextVariant.id).not.toBe("memory_match-l1-v1");
    expect(nextVariant.level).toBe(1);
  });

  it("advances Visual Memory after one completed board without trapping lower scores", () => {
    expect(getVisualMemoryLevelProgress([], 4)).toMatchObject({
      completedRounds: 1,
      roundsRequired: VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
      levelCompleted: true,
      advanced: true,
      nextLevel: 5,
    });
  });

  it("uses a completed lower-score Visual Memory board to recommend the next level", () => {
    expect(getRecommendedLevelForGame([visualResult(7, 45, 0)], "memory_match")).toBe(8);
  });

  it("opens the next recommended Visual Memory level after one completed board", () => {
    expect(getRecommendedLevelForGame([visualResult(9, 46, 0)], "memory_match")).toBe(10);
  });

  it("keeps the highest Visual Memory level unlocked after replaying an earlier level", () => {
    const history = [visualResult(4, 100, 0), visualResult(12, 70, 10)];

    expect(getRecommendedLevelForGame(history, "memory_match")).toBe(13);
  });

  it("unlocks Level 21 after completing the former Level 20 ceiling", () => {
    expect(getVisualMemoryLevelProgress([], 20)).toMatchObject({
      completedRounds: 1,
      levelCompleted: true,
      advanced: true,
      nextLevel: 21,
    });
    expect(getRecommendedLevelForGame([visualResult(20, 100, 0)], "memory_match")).toBe(21);
  });

  it("completes Mastery at Level 40 without inventing a Level 41", () => {
    expect(getVisualMemoryLevelProgress([], 40)).toMatchObject({
      completedRounds: 1,
      levelCompleted: true,
      advanced: false,
      nextLevel: 40,
    });
    expect(getRecommendedLevelForGame([visualResult(40, 100, 0)], "memory_match")).toBe(40);
  });

  it("avoids the immediately previous Visual Memory theme", () => {
    const level = memoryGameRegistry.memory_match.levels[20];
    const justPlayed = level.variants[0];
    const previousTheme = (justPlayed.content.en ?? justPlayed.content.es).payload.themeId;
    const nextVariant = pickNextVariantForSameGame(
      [{ ...visualResult(21, 100, 0), variantId: justPlayed.id }],
      "memory_match",
      21,
      justPlayed.id,
    );

    expect((nextVariant.content.en ?? nextVariant.content.es).payload.themeId).not.toBe(previousTheme);
  });
});
