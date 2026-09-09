import { describe, expect, it } from "vitest";
import { BRAIN_COACH_MAX_LEVEL } from "../shared/brainCoachProgression";
import { getVisualMemoryDifficulty, memoryGameRegistry } from "./memoryGameRegistry";
import type { ConnectionsPayload } from "./connectionsData";
import type { MemoryGameType, MemoryGameVariant } from "./types";
import { getVisualMemoryBand, VISUAL_MEMORY_MAX_LEVEL } from "./visualMemoryJourney";

const sharedLeveledGames: MemoryGameType[] = [
  "association_memory",
  "word_recall",
  "story_recall",
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

  it.each([
    [1, 3, 3, 0],
    [3, 3, 4, 3],
    [6, 4, 5, 4],
    [11, 5, 6, 4],
    [16, 5, 7, 5],
  ])("builds adult Connections rounds at level %i", (level, connectionCount, questionCount, resetCount) => {
    const content = memoryGameRegistry.association_memory.levels[level - 1].variants[0].content.en!;
    const payload = content.payload as ConnectionsPayload;

    expect(content.title).toBe("Connections");
    expect(payload.roundVersion).toBe("connections_v2");
    expect(payload.connections).toHaveLength(connectionCount);
    expect(payload.questions).toHaveLength(questionCount);
    expect(payload.resetNumbers).toHaveLength(resetCount);
    payload.questions.forEach((question) => {
      expect(question.prompt.length).toBeGreaterThan(8);
      expect(question.options).toContain(question.answer);
      expect(new Set(question.options).size).toBe(question.options.length);
    });
  });

  it("provides 30 levels and 12 variants per level for Number Memory only", () => {
    expect(memoryGameRegistry.number_memory.levels).toHaveLength(30);
    expect(memoryGameRegistry.number_memory.levels.map((level) => level.level)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(memoryGameRegistry.number_memory.levels.every((level) => level.variants.length === 12)).toBe(true);
  });

  it("changes Word Recall content across levels and variants", () => {
    const levels = memoryGameRegistry.word_recall.levels;
    const firstVariantSignatures = levels.map((level) => getWordRecallSignature(level.variants[0]));

    firstVariantSignatures.slice(1).forEach((signature, index) => {
      expect(signature).not.toBe(firstVariantSignatures[index]);
    });

    levels.forEach((level) => {
      const signatures = level.variants.map(getWordRecallSignature);
      expect(new Set(signatures).size).toBe(signatures.length);
    });
  });

  it("increases the Word Recall load across Foundation levels", () => {
    const wordCounts = memoryGameRegistry.word_recall.levels
      .slice(0, 5)
      .map((level) => (level.variants[0].content.en?.payload.words as string[]).length);

    expect(wordCounts).toEqual([3, 4, 5, 6, 6]);
  });

  it("uses category-matched Word Recall distractors", () => {
    const clothingRound = memoryGameRegistry.word_recall.levels[13].variants[0].content.en?.payload;

    expect(clothingRound?.words).toEqual(expect.arrayContaining(["sock", "glove", "scarf"]));
    expect(clothingRound?.distractors).toEqual(expect.arrayContaining(["trousers", "jacket", "cap"]));
    expect(clothingRound?.distractors).not.toContain("train");
  });

  it("localizes every Connections variant in all supported languages", () => {
    const languages = ["en", "es", "fr", "de", "it", "pt"] as const;
    memoryGameRegistry.association_memory.levels.forEach((level) => {
      level.variants.forEach((variant) => {
        languages.forEach((language) => {
          const content = variant.content[language];
          const payload = content?.payload as ConnectionsPayload | undefined;
          expect(content?.title).toBeTruthy();
          expect(payload?.connections.length).toBeGreaterThanOrEqual(3);
          expect(payload?.questions.every((question) => question.prompt && question.answer)).toBe(true);
        });
      });
    });
  });

  it("provides localized Number Memory prompts for all order modes", () => {
    const levelOne = memoryGameRegistry.number_memory.levels[0].variants[0].content.en;
    const levelEleven = memoryGameRegistry.number_memory.levels[10].variants[0].content.en;
    const levelTwentyOne = memoryGameRegistry.number_memory.levels[20].variants[0].content.en;

    expect(levelOne?.title).toBe("Number Memory");
    expect(levelOne?.prompt).toContain("same order");
    expect(levelEleven?.prompt).toContain("reverse order");
    expect(levelTwentyOne?.prompt).toContain("lowest to highest");
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

function getWordRecallSignature(variant: MemoryGameVariant) {
  const content = variant.content.en ?? variant.content.es;
  return ((content.payload.words as string[]) ?? []).join("|");
}
