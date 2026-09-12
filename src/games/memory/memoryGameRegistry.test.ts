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
    const signature = (variant: MemoryGameVariant) => {
      const content = variant.content.en ?? variant.content.es;
      return ((content.payload.words as string[]) ?? []).join("|");
    };
    const firstVariantSignatures = levels.map((level) => signature(level.variants[0]));

    firstVariantSignatures.slice(1).forEach((value, index) => {
      expect(value).not.toBe(firstVariantSignatures[index]);
    });
    levels.forEach((level) => {
      expect(new Set(level.variants.map(signature)).size).toBe(level.variants.length);
    });
  });

  it("offers a fresh same-theme word set at every next level", () => {
    const levels = memoryGameRegistry.word_recall.levels;

    levels.slice(0, -1).forEach((level, levelIndex) => {
      const nextLevel = levels[levelIndex + 1];

      level.variants.forEach((variant) => {
        const payload = (variant.content.en ?? variant.content.es).payload;
        const currentWords = new Set((payload.words as string[]) ?? []);
        const sameThemeNextVariants = nextLevel.variants.filter((candidate) => {
          const candidatePayload = (candidate.content.en ?? candidate.content.es).payload;
          return candidatePayload.themeId === payload.themeId;
        });
        const hasFreshSet = sameThemeNextVariants.some((candidate) => {
          const candidatePayload = (candidate.content.en ?? candidate.content.es).payload;
          return ((candidatePayload.words as string[]) ?? []).every((word) => !currentWords.has(word));
        });

        expect(hasFreshSet, `${variant.id} should have a fresh same-theme set at level ${nextLevel.level}`).toBe(true);
      });
    });
  });

  it("uses five-step Word Recall bands with richer challenge metadata", () => {
    const levels = memoryGameRegistry.word_recall.levels;
    const expectedCounts = [3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6];

    levels.forEach((level, index) => {
      level.variants.forEach((variant) => {
        const payload = (variant.content.en ?? variant.content.es).payload;
        expect(payload.words).toHaveLength(expectedCounts[index]);
        expect(["home", "garden", "food", "travel", "community"]).toContain(payload.themeId);
        expect(payload.wordIcons).toHaveLength(expectedCounts[index]);
        expect(payload.showWordCues).toBe(level.level <= 8);
      });
    });

    expect((levels[9].variants[0].content.en ?? levels[9].variants[0].content.es).payload.challengeKind).toBe("first");
    expect((levels[12].variants[0].content.en ?? levels[12].variants[0].content.es).payload.challengeKind).toBe("category");
    expect((levels[16].variants[0].content.en ?? levels[16].variants[0].content.es).payload.challengeKind).toBe("order");
    expect(new Set(levels.slice(5).map((level) => (level.variants[0].content.en ?? level.variants[0].content.es).payload.distractionType))).toEqual(
      new Set(["count_backwards", "choose_blue", "breathe_continue", "number_order"]),
    );
  });

  it("provides 64 themed Story Recall concepts across four bands and six languages", () => {
    const levels = memoryGameRegistry.story_recall.levels;
    const languages = ["en", "es", "fr", "de", "it", "pt"] as const;
    const storyIds = new Set<string>();
    const themeIds = new Set<string>();

    levels.forEach((level) => {
      expect(level.variants).toHaveLength(16);
      level.variants.forEach((variant) => {
        languages.forEach((language) => {
          const content = variant.content[language];
          expect(content?.payload.story).toBeTruthy();
          expect(content?.payload.choiceQuestions).toBeInstanceOf(Array);
        });
        const payload = variant.content.en!.payload;
        storyIds.add(String(payload.storyId));
        themeIds.add(String(payload.themeId));
      });
    });

    expect(storyIds.size).toBe(64);
    expect(themeIds.size).toBe(8);
  });

  it("ramps Story Recall length, facts, and questions across the four bands", () => {
    const ranges = [
      { levels: [1, 5], words: [35, 60], facts: [3, 5], questions: [2, 3] },
      { levels: [6, 10], words: [60, 90], facts: [5, 7], questions: [3, 4] },
      { levels: [11, 15], words: [90, 125], facts: [7, 9], questions: [4, 5] },
      { levels: [16, 20], words: [125, 170], facts: [9, 12], questions: [5, 6] },
    ];

    ranges.forEach((band) => {
      for (let level = band.levels[0]; level <= band.levels[1]; level += 1) {
        const payload = memoryGameRegistry.story_recall.levels[level - 1].variants[0].content.en!.payload;
        const wordCount = String(payload.story).trim().split(/\s+/).length;
        expect(wordCount).toBeGreaterThanOrEqual(band.words[0]);
        expect(wordCount).toBeLessThanOrEqual(band.words[1]);
        expect((payload.keyFacts as unknown[]).length).toBeGreaterThanOrEqual(band.facts[0]);
        expect((payload.keyFacts as unknown[]).length).toBeLessThanOrEqual(band.facts[1]);
        expect((payload.choiceQuestions as unknown[]).length).toBeGreaterThanOrEqual(band.questions[0]);
        expect((payload.choiceQuestions as unknown[]).length).toBeLessThanOrEqual(band.questions[1]);
      }
    });
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
