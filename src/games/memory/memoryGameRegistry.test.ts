import { describe, expect, it } from "vitest";
import { BRAIN_COACH_MAX_LEVEL } from "../shared/brainCoachProgression";
import { getVisualMemoryDifficulty, memoryGameRegistry } from "./memoryGameRegistry";
import type { MemoryGameType, MemoryGameVariant } from "./types";
import { getVisualMemoryBand, VISUAL_MEMORY_MAX_LEVEL } from "./visualMemoryJourney";

const sharedLeveledGames: MemoryGameType[] = [
  "association_memory",
  "word_recall",
  "story_recall",
  "number_memory",
  "sequence_memory",
];

describe("memory game registry", () => {
  it("provides 40 levels for Visual Memory", () => {
    const definition = memoryGameRegistry.memory_match;

    expect(definition.levels).toHaveLength(VISUAL_MEMORY_MAX_LEVEL);
    expect(definition.levels.map((level) => level.level)).toEqual(
      Array.from({ length: VISUAL_MEMORY_MAX_LEVEL }, (_, index) => index + 1),
    );
  });

  it.each(sharedLeveledGames)("keeps 20 levels for %s", (gameType) => {
    const definition = memoryGameRegistry[gameType];

    expect(definition.levels).toHaveLength(BRAIN_COACH_MAX_LEVEL);
    expect(definition.levels.map((level) => level.level)).toEqual(
      Array.from({ length: BRAIN_COACH_MAX_LEVEL }, (_, index) => index + 1),
    );
    expect(definition.levels.every((level) => level.variants.length > 0)).toBe(true);
  });

  it("rotates low-level visual memory content before repeating a theme", () => {
    const levelOne = memoryGameRegistry.memory_match.levels.find((level) => level.level === 1);
    expect(levelOne).toBeDefined();
    expect(levelOne?.variants.length).toBeGreaterThan(10);

    const firstVariant = levelOne!.variants[0];
    const firstTheme = getEnglishTitle(firstVariant);
    const repeatedThemeVariant = levelOne!.variants.find(
      (variant, index) => index > 0 && getEnglishTitle(variant) === firstTheme,
    );

    expect(repeatedThemeVariant).toBeDefined();
    expect(getPairSignature(repeatedThemeVariant!)).not.toEqual(getPairSignature(firstVariant));
  });

  it("starts Foundation with a real three-pair board and ramps steadily", () => {
    const pairCounts = memoryGameRegistry.memory_match.levels.slice(0, 5).map((level) => {
      const content = level.variants[0].content.en ?? level.variants[0].content.es;
      return ((content.payload.pairItems as unknown[]) ?? []).length;
    });

    expect(pairCounts).toEqual([3, 4, 4, 5, 5]);
  });

  it("keeps increasing Visual Memory difficulty after the board reaches eight pairs", () => {
    const levelTen = getVisualMemoryDifficulty(10);
    const levelFifteen = getVisualMemoryDifficulty(15);
    const levelTwenty = getVisualMemoryDifficulty(20);
    const levelForty = getVisualMemoryDifficulty(40);

    expect(levelTen).toMatchObject({ pairCount: 8, showLabels: true });
    expect(levelFifteen).toMatchObject({ pairCount: 8, showLabels: false });
    expect(levelTwenty).toMatchObject({ pairCount: 8, showLabels: false });
    expect(levelForty).toMatchObject({ pairCount: 8, showLabels: false, mismatchRevealMs: 600, matchRevealMs: 300 });
    expect(levelFifteen.mismatchRevealMs).toBeLessThan(levelTen.mismatchRevealMs);
    expect(levelTwenty.mismatchRevealMs).toBeLessThan(levelFifteen.mismatchRevealMs);
    expect(levelTwenty.matchRevealMs).toBeLessThan(levelTen.matchRevealMs);
  });

  it("provides twelve variants and four in-band themes at every Visual Memory level", () => {
    memoryGameRegistry.memory_match.levels.forEach((level) => {
      const themeIds = level.variants.map((variant) => getPayload(variant).themeId);
      const bandIds = level.variants.map((variant) => getPayload(variant).bandId);

      expect(level.variants.length).toBeGreaterThanOrEqual(12);
      expect(new Set(themeIds).size).toBeGreaterThanOrEqual(4);
      expect(new Set(bandIds)).toEqual(new Set([getVisualMemoryBand(level.level).id]));
    });
  });

  it("gives each required Visual Memory round a distinct board at every level", () => {
    memoryGameRegistry.memory_match.levels.forEach((level) => {
      const requiredRoundBoards = level.variants.slice(0, 3);
      const signatures = requiredRoundBoards.map(getPairSignature);

      expect(requiredRoundBoards).toHaveLength(3);
      expect(new Set(signatures).size).toBe(3);
    });
  });

  it("uses pattern visuals after labels are removed and keeps every accessible label localized", () => {
    const patternLevel = memoryGameRegistry.memory_match.levels.find((level) => level.level === 21);
    expect(patternLevel).toBeDefined();

    for (const variant of patternLevel!.variants) {
      for (const language of ["es", "en", "fr", "de", "it", "pt"] as const) {
        const content = variant.content[language];
        const pairItems = (content?.payload.pairItems ?? []) as Array<{ label: string; visual: { kind: string } }>;
        expect(content?.payload.showLabels).toBe(false);
        expect(pairItems).toHaveLength(8);
        expect(pairItems.every((item) => item.visual.kind === "pattern" && item.label.trim().length > 0)).toBe(true);
      }
    }
  });

  it("provides English Association content instead of Spanish-only fallback", () => {
    const variant = memoryGameRegistry.association_memory.levels[0].variants[0];
    const content = variant.content.en;

    expect(content?.title).toBe("Association 1");
    expect(content?.prompt).toBe("Link the item to its group.");
    expect(content?.payload).toEqual(expect.objectContaining({
      left: "apple",
      right: "fruit",
      choiceCount: 2,
    }));
  });

  it("provides English Number Memory prompts for order modes", () => {
    const levelOne = memoryGameRegistry.number_memory.levels[0].variants[0].content.en;
    const levelSix = memoryGameRegistry.number_memory.levels[5].variants[0].content.en;

    expect(levelOne?.title).toBe("Numbers 1");
    expect(levelOne?.prompt).toBe("Remember 3 digits in order.");
    expect(levelSix?.prompt).toBe("Remember 4 digits and enter them in reverse order.");
  });
});

function getEnglishTitle(variant: MemoryGameVariant) {
  return variant.content.en?.title ?? variant.content.es.title;
}

function getPairSignature(variant: MemoryGameVariant) {
  const content = variant.content.en ?? variant.content.es;
  const pairs = (content.payload.pairItems as Array<{ emoji: string; label: string; visual?: unknown }>) ?? [];

  return pairs.map((item) => `${item.emoji}:${item.label}:${JSON.stringify(item.visual)}`).join("|");
}

function getPayload(variant: MemoryGameVariant) {
  return (variant.content.en ?? variant.content.es).payload as { themeId: string; bandId: string };
}
