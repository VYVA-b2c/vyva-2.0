import { describe, expect, it } from "vitest";
import { getRepeatLevelForResult, MEMORY_LEVEL_UP_ACCURACY, pickNextVariantForSameGame } from "./progressionEngine";

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
});
