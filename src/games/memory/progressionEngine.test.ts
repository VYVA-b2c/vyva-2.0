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

  it("advances Visual Memory after three completed boards without trapping lower scores", () => {
    const history = [visualResult(4, 55, 1), visualResult(4, 85, 2)];

    expect(getVisualMemoryLevelProgress(history.slice(0, 1), 4)).toMatchObject({
      completedRounds: 2,
      roundsRequired: VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
      levelCompleted: false,
      advanced: false,
      nextLevel: 4,
    });
    expect(getVisualMemoryLevelProgress(history, 4)).toMatchObject({
      completedRounds: 3,
      levelCompleted: true,
      advanced: true,
      nextLevel: 5,
    });
  });

  it("counts a lower-score Visual Memory board without resetting progress", () => {
    const history = [visualResult(7, 92, 1)];

    expect(getVisualMemoryLevelProgress(history, 7)).toEqual({
      completedRounds: 2,
      roundsRequired: VISUAL_MEMORY_ROUNDS_TO_ADVANCE,
      levelCompleted: false,
      advanced: false,
      nextLevel: 7,
    });
    expect(getRecommendedLevelForGame([visualResult(7, 45, 0), ...history], "memory_match")).toBe(7);
  });

  it("opens the next recommended Visual Memory level after three completed boards", () => {
    const twoCompletedRounds = [visualResult(9, 91, 0), visualResult(9, 46, 1)];
    const threeCompletedRounds = [...twoCompletedRounds, visualResult(9, 72, 2)];

    expect(getRecommendedLevelForGame(twoCompletedRounds, "memory_match")).toBe(9);
    expect(getRecommendedLevelForGame(threeCompletedRounds, "memory_match")).toBe(10);
  });

  it("completes Mastery at Level 20 without inventing a Level 21", () => {
    const history = [visualResult(20, 94, 1), visualResult(20, 90, 2)];

    expect(getVisualMemoryLevelProgress(history, 20)).toMatchObject({
      completedRounds: 3,
      levelCompleted: true,
      advanced: false,
      nextLevel: 20,
    });
  });
});
