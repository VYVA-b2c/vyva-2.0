import { describe, expect, it } from "vitest";
import { buildGamePreferenceTag, buildGameTable } from "../../server/lib/socialGameRounds";
import { buildReadingClubDestination } from "../../server/lib/readingClubDestination";
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

  it("supports matching in games, reading, and aliases but not ordinary activity rooms", () => {
    expect(supportsSocialMatching("games-room")).toBe(true);
    expect(supportsSocialMatching("reading-room")).toBe(true);
    expect(supportsSocialMatching("book-club")).toBe(true);
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

  it("prioritizes discoverable readers who share book and literature interests", () => {
    const best = pickBestSocialMatch(
      ["books", "literature", "stories", "memoir", "library"],
      [
        {
          userId: "hidden-reader",
          displayName: "Hidden",
          interestTags: ["books", "literature", "stories", "memoir", "library"],
          discoverable: false,
        },
        {
          userId: "casual-reader",
          displayName: "Luis",
          interestTags: ["books", "garden"],
          discoverable: true,
        },
        {
          userId: "literary-reader",
          displayName: "Maria",
          interestTags: ["books", "literature", "poetry", "memoir", "library"],
          discoverable: true,
        },
      ],
      { roomSlug: "book-club" },
    );

    expect(best).toMatchObject({
      userId: "literary-reader",
      displayName: "Maria",
    });
    expect(best?.shared).toEqual(["books", "literature", "memoir", "library"]);
    expect(formatSharedTopic("book_memories", "en")).toBe("book memories");
    expect(formatSharedTopic("memoir", "es")).toBe("memorias");
  });

  it("uses reading profile tags to rank a suitable shelf companion", () => {
    const best = pickBestSocialMatch(
      ["books", "reading"],
      [
        {
          userId: "memoir-reader",
          displayName: "Elena",
          interestTags: ["books", "memoir", "book_memories"],
          discoverable: true,
        },
        {
          userId: "poetry-reader",
          displayName: "Marta",
          interestTags: ["books", "poetry", "literature", "reading_companion"],
          discoverable: true,
        },
      ],
      {
        roomSlug: "reading-room",
        readingPreferenceTags: ["poetry", "literature", "reading_companion"],
      },
    );

    expect(best).toMatchObject({
      userId: "poetry-reader",
      displayName: "Marta",
    });
    expect(best?.shared).toEqual(["books", "poetry", "literature", "reading_companion"]);
  });

  it("builds a destination-level reading club program in each launch language", () => {
    for (const language of ["en", "es", "de"] as const) {
      const club = buildReadingClubDestination(language, [
        { id: "member-maria", name: "Maria", sharedTopic: "memoir" },
        { id: "member-jose", name: "Jose", sharedTopic: "history" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "stories" },
      ], 9);

      expect(club.metrics).toHaveLength(3);
      expect(club.agenda).toHaveLength(3);
      expect(club.shelves.length).toBeGreaterThanOrEqual(2);
      expect(club.companionModes.map((mode) => mode.id)).toEqual(["one-to-one", "small-circle", "pen-note"]);
      expect(club.passportItems.map((item) => item.id)).toEqual(["share", "recommend", "greet"]);
      expect(club.guidelines.length).toBeGreaterThanOrEqual(3);
    }
  });
});
