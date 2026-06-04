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
    const bridgeRounds = table.rounds.filter((round) => round.kind === "bridge");

    expect(table.tableLabel).toBe("Today's table");
    expect(uniqueKinds).toEqual(["chess", "word", "dominoes", "bridge"]);
    expect(chessRounds.length).toBeGreaterThanOrEqual(60);
    expect(new Set(chessRounds.map((round) => round.id)).size).toBe(chessRounds.length);
    expect(wordRounds).toHaveLength(80);
    expect(new Set(wordRounds.map((round) => round.id)).size).toBe(wordRounds.length);
    expect(dominoesRounds).toHaveLength(80);
    expect(new Set(dominoesRounds.map((round) => round.id)).size).toBe(dominoesRounds.length);
    expect(bridgeRounds).toHaveLength(80);
    expect(new Set(bridgeRounds.map((round) => round.id)).size).toBe(bridgeRounds.length);
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

  it("adds visual puzzle metadata to every generated round", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);

      for (const round of table.rounds) {
        expect(round.visual).toBeDefined();
        if (round.kind === "word") expect(round.visual?.kind).toBe("wordTiles");
        if (round.kind === "chess") expect(round.visual?.kind).toBe("chessBoard");
        if (round.kind === "dominoes") expect(round.visual?.kind).toBe("dominoes");
        if (round.kind === "bridge") expect(round.visual?.kind).toBe("bridgeCards");
      }
    }
  });

  it("keeps word prompts from spelling out tile racks", () => {
    const tileListPattern = /[A-Z],\s*[A-Z]/;
    const oldTilePromptPattern = /Use the tiles|Usa las letras|Nutze die Buchstaben|Avec les lettres|Con le lettere|Com as letras/;

    for (const language of supportedGameLanguages) {
      const wordRounds = buildGameTable(language, 6).rounds.filter((round) => round.kind === "word");

      expect(wordRounds.every((round) => !tileListPattern.test(round.prompt))).toBe(true);
      expect(wordRounds.every((round) => !oldTilePromptPattern.test(round.prompt))).toBe(true);

      for (const round of wordRounds) {
        if (round.visual?.kind !== "wordTiles" || round.visual.answerLength <= 2) continue;
        const rackText = round.visual.tiles.join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const answerText = round.answer.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        expect(rackText).not.toBe(answerText);
      }
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

  it("keeps the bridge puzzle bank available in each supported app language", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const bridgeRounds = table.rounds.filter((round) => round.kind === "bridge");

      expect(bridgeRounds).toHaveLength(80);
      expect(new Set(bridgeRounds.map((round) => round.id)).size).toBe(bridgeRounds.length);
      expect(bridgeRounds.every((round) => round.tags.includes("bridge"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("cards"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("game:bridge"))).toBe(true);
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
      ["games", "game:bridge"],
      [
        {
          userId: "hidden",
          displayName: "Hidden",
          interestTags: ["games", "game:bridge"],
          discoverable: false,
        },
      ],
      { roomSlug: "games-room", gameKind: "bridge" },
    );

    expect(best).toBeNull();
  });

  it("prioritizes discoverable bridge players for Bridge table", () => {
    const best = pickBestSocialMatch(
      ["games", "game:bridge", "cards"],
      [
        {
          userId: "hidden-bridge",
          displayName: "Hidden",
          interestTags: ["games", "game:bridge", "cards"],
          discoverable: false,
        },
        {
          userId: "dominoes-player",
          displayName: "Luis",
          interestTags: ["games", "game:dominoes"],
          discoverable: true,
        },
        {
          userId: "bridge-player",
          displayName: "Marta",
          interestTags: ["games", "game:bridge", "cards"],
          discoverable: true,
        },
      ],
      { roomSlug: "games-room", gameKind: "bridge" },
    );

    expect(best).toMatchObject({
      userId: "bridge-player",
      displayName: "Marta",
    });
    expect(best?.shared).toContain("game:bridge");
  });

  it("formats selected game tags for match copy", () => {
    expect(formatSharedTopic("game:word", "en")).toBe("word games");
    expect(formatSharedTopic("game:dominoes", "es")).toBe("domino");
    expect(formatSharedTopic("game:chess", "de")).toBe("Schach");
    expect(formatSharedTopic("game:bridge", "en")).toBe("Bridge table");
  });
});
