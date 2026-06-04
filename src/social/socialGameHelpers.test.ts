import { describe, expect, it } from "vitest";
import { buildGamePreferenceTag, buildGameTable } from "../../server/lib/socialGameRounds";
import { formatSharedTopic, pickBestSocialMatch, supportsSocialMatching } from "../../server/lib/socialMatching";
import type { SocialGameLanguage } from "./types";

const supportedGameLanguages: SocialGameLanguage[] = ["es", "en", "fr", "de", "it", "pt"];

describe("social games room helpers", () => {
  it("builds curated classic game rounds for the games room", () => {
    const table = buildGameTable("en", 6);
    const uniqueKinds = Array.from(new Set(table.rounds.map((round) => round.kind)));
    const chessRounds = table.rounds.filter((round) => round.kind === "chess");
    const wordRounds = table.rounds.filter((round) => round.kind === "word");
    const dominoesRounds = table.rounds.filter((round) => round.kind === "dominoes");

    expect(table.tableLabel).toBe("Today's table");
    expect(uniqueKinds).toEqual(["chess", "word", "dominoes", "trivia"]);
    expect(chessRounds.length).toBeGreaterThanOrEqual(60);
    expect(new Set(chessRounds.map((round) => round.id)).size).toBe(chessRounds.length);
    expect(wordRounds).toHaveLength(80);
    expect(new Set(wordRounds.map((round) => round.id)).size).toBe(wordRounds.length);
    expect(dominoesRounds).toHaveLength(80);
    expect(new Set(dominoesRounds.map((round) => round.id)).size).toBe(dominoesRounds.length);
    expect(table.rounds.every((round) => round.tags.includes(buildGamePreferenceTag(round.kind)))).toBe(true);
    expect(table.readyMembers.length).toBeGreaterThan(0);
  });

  it("keeps the chess puzzle bank available in each supported app language", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      expect(table.rounds.filter((round) => round.kind === "chess").length).toBeGreaterThanOrEqual(60);
      expect(table.defaultRoundId).toBe("chess-clue-fork");
    }
  });

  it("keeps the word tile puzzle bank available in each supported app language", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const wordRounds = table.rounds.filter((round) => round.kind === "word");

      expect(wordRounds).toHaveLength(80);
      expect(new Set(wordRounds.map((round) => round.id)).size).toBe(wordRounds.length);
      expect(wordRounds.every((round) => round.tags.includes("scrabble"))).toBe(true);
      expect(wordRounds.every((round) => round.tags.includes("words"))).toBe(true);
    }
  });

  it("keeps the dominoes puzzle bank available in each supported app language", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const dominoesRounds = table.rounds.filter((round) => round.kind === "dominoes");

      expect(dominoesRounds).toHaveLength(80);
      expect(new Set(dominoesRounds.map((round) => round.id)).size).toBe(dominoesRounds.length);
      expect(dominoesRounds.every((round) => round.tags.includes("dominoes"))).toBe(true);
      expect(dominoesRounds.every((round) => round.tags.includes("game:dominoes"))).toBe(true);
    }
  });

  it("localizes the games table shell for every supported app language", () => {
    const expectedLabels: Record<SocialGameLanguage, string> = {
      es: "Mesa de hoy",
      en: "Today's table",
      fr: "Table du jour",
      de: "Heutiger Tisch",
      it: "Tavolo di oggi",
      pt: "Mesa de hoje",
    };

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      expect(table.tableLabel).toBe(expectedLabels[language]);
    }

    expect(buildGameTable("fr", 6).rounds.find((round) => round.id === "word-tiles-anagram-smile")?.answer).toBe("SOURIRE");
    expect(buildGameTable("it", 6).rounds.find((round) => round.id === "word-tiles-anagram-smile")?.answer).toBe("SORRISO");
    expect(buildGameTable("pt", 6).rounds.find((round) => round.id === "word-tiles-anagram-smile")?.answer).toBe("SORRISO");
  });

  it("supports matching in games and legacy connection rooms but not ordinary activity rooms", () => {
    expect(supportsSocialMatching("games-room")).toBe(true);
    expect(supportsSocialMatching("pen-pals")).toBe(true);
    expect(supportsSocialMatching("heritage-exchange")).toBe(true);
    expect(supportsSocialMatching("garden-corner")).toBe(false);
  });

  it("prioritizes discoverable people who share the selected game kind", () => {
    const best = pickBestSocialMatch(
      ["games", "game:word", "books"],
      [
        {
          userId: "hidden",
          displayName: "Hidden",
          interestTags: ["games", "game:word"],
          discoverable: false,
        },
        {
          userId: "chess-player",
          displayName: "Luis",
          interestTags: ["games", "game:chess"],
          discoverable: true,
        },
        {
          userId: "word-player",
          displayName: "Ana",
          interestTags: ["games", "game:word"],
          discoverable: true,
        },
      ],
      { roomSlug: "games-room", gameKind: "word" },
    );

    expect(best).toMatchObject({
      userId: "word-player",
      displayName: "Ana",
    });
    expect(best?.shared).toContain("game:word");
  });

  it("returns no match when nobody opted in with shared interests", () => {
    const best = pickBestSocialMatch(
      ["games", "game:trivia"],
      [
        {
          userId: "hidden",
          displayName: "Hidden",
          interestTags: ["games", "game:trivia"],
          discoverable: false,
        },
      ],
      { roomSlug: "games-room", gameKind: "trivia" },
    );

    expect(best).toBeNull();
  });

  it("formats selected game tags for match copy", () => {
    expect(formatSharedTopic("game:word", "en")).toBe("word games");
    expect(formatSharedTopic("game:dominoes", "es")).toBe("domino");
    expect(formatSharedTopic("game:chess", "de")).toBe("Schach");
  });
});
