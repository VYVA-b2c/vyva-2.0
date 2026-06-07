import { describe, expect, it } from "vitest";
import { buildGameDefaultRoundIds, buildGamePreferenceTag, buildGameTable } from "../../server/lib/socialGameRounds";
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
    const bridgeRounds = table.rounds.filter((round) => round.kind === "bridge");

    expect(table.tableLabel).toBe("Today's table");
    expect(uniqueKinds).toEqual(["chess", "word", "dominoes", "bridge"]);
    expect(chessRounds).toHaveLength(80);
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
      expect(table.rounds.filter((round) => round.kind === "chess")).toHaveLength(80);
      expect(table.defaultRoundId).toBe("chess-clue-fork");
    }
  });

  it("generates non-giveaway chess prompts and tactile instructions", () => {
    const actionPromptStart: Record<SocialGameLanguage, RegExp> = {
      en: /^Find /,
      es: /^Encuentra /,
      fr: /^Trouvez /,
      de: /^Finde[ ,]/,
      it: /^Trova /,
      pt: /^Encontre /,
    };
    const genericInstruction: Record<SocialGameLanguage, string> = {
      en: "Tap a piece or square.",
      es: "Toca una pieza o casilla.",
      fr: "Touchez une piece ou une case.",
      de: "Tippe auf eine Figur oder ein Feld.",
      it: "Tocca un pezzo o una casa.",
      pt: "Toque numa peca ou casa.",
    };
    const giveawayPattern = /white (queen|rook|bishop|knight|pawn)|dama blanca|torre blanca|alfil blanco|caballo blanco|peon blanco|weisse dame|weissen turm|weissen laeufer|weissen springer|weissen bauern|dame blanche|tour blanche|fou blanc|cavalier blanc|pion blanc|donna bianca|torre bianca|alfiere bianco|cavallo bianco|pedone bianco|dama branca|torre branca|bispo branco|cavalo branco|peao branco|fork|horquilla|gabel|fourchette|forchetta|garfo|back-rank mate|mate de primera fila|grundreihenmatt|mat du couloir|matto di corridoio|mate de corredor|pin|clouage|inchiodatura|cravada|skewer|enfilade|infilata|espeto/i;

    for (const language of supportedGameLanguages) {
      const chessRounds = buildGameTable(language, 6).rounds.filter((round) => round.kind === "chess");

      expect(chessRounds).toHaveLength(80);

      for (const round of chessRounds) {
        expect(round.prompt).toMatch(actionPromptStart[language]);
        expect(round.prompt).not.toMatch(giveawayPattern);
        expect(round.prompt.toLocaleLowerCase()).not.toContain(round.answer.toLocaleLowerCase());
        expect(round.interaction?.kind).toBe("chessTap");
        if (round.interaction?.kind !== "chessTap") continue;
        expect(round.interaction.instruction).toBe(genericInstruction[language]);
      }
    }
  });

  it("personalizes default game rounds from stable exposure history", () => {
    const table = buildGameTable("en", 6);
    const firstChessRound = table.rounds.find((round) => round.kind === "chess");
    expect(firstChessRound).toBeDefined();

    const afterChessStart = buildGameTable("en", 6, [
      {
        gameKind: "chess",
        roundId: firstChessRound!.id,
        startedCount: 1,
        completedCount: 0,
        lastSeenAt: "2026-06-01T10:00:00.000Z",
      },
    ]);

    const recommendedRound = afterChessStart.rounds.find((round) => round.id === afterChessStart.defaultRoundId);
    expect(recommendedRound?.kind).toBe("word");
    expect(afterChessStart.defaultRoundIdsByKind?.chess).not.toBe(firstChessRound!.id);
  });

  it("can build a compact game table while preserving bank counts", () => {
    const table = buildGameTable("en", 6, [], { compact: true });

    expect(table.rounds).toHaveLength(4);
    expect(table.rounds.map((round) => round.kind)).toEqual(["chess", "word", "dominoes", "bridge"]);
    expect(table.roundCountsByKind).toMatchObject({
      chess: 80,
      word: 80,
      dominoes: 80,
      bridge: 80,
    });
    expect(table.defaultRoundIndexesByKind?.chess).toBe(0);
  });

  it("prefers rounds outside the repeat cooldown after a bank has all been seen", () => {
    const wordRounds = buildGameTable("en", 6).rounds.filter((round) => round.kind === "word").slice(0, 3);
    const attempts = wordRounds.map((round, index) => ({
      gameKind: round.kind,
      roundId: round.id,
      startedCount: 1,
      completedCount: 0,
      skippedCount: 0,
      lastSeenAt: index === 2 ? "2026-05-01T10:00:00.000Z" : "2026-06-01T10:00:00.000Z",
    }));

    expect(buildGameDefaultRoundIds(wordRounds, attempts, { now: new Date("2026-06-05T12:00:00.000Z") }).word).toBe(wordRounds[2].id);
  });

  it("keeps repeat prevention working when a puzzle bank grows beyond 80", () => {
    const wordRounds = buildGameTable("en", 6).rounds.filter((round) => round.kind === "word");
    const expandedWordRounds = [
      ...wordRounds,
      {
        ...wordRounds[0],
        id: "word-table-new-neighbor",
      },
    ];
    const attempts = wordRounds.map((round, index) => ({
      gameKind: round.kind,
      roundId: round.id,
      startedCount: index === 9 ? 1 : 2,
      completedCount: 0,
      lastSeenAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
    }));

    expect(buildGameDefaultRoundIds(expandedWordRounds, attempts).word).toBe("word-table-new-neighbor");
    expect(buildGameDefaultRoundIds(wordRounds, attempts).word).toBe(wordRounds[9].id);
  });

  it("keeps the word tile puzzle bank available in each supported app language", () => {
    const retiredVisibleCopyPattern = /friendly word|gentle word|calm word|palabra amable|mot calme|parola calma|palavra calma|what word means|which word means|quel mot veut dire|quale parola significa|qual palavra significa|choose the friendly/i;
    const retiredWordTags = new Set(["word:gentle-clue", "word:food", "word:home", "word:greeting", "word:best-word", "word:score"]);
    const requiredStrategyTags = [
      "word:anagram",
      "word:rack-strategy",
      "word:front-hook",
      "word:back-hook",
      "word:score-style",
      "word:crossword-clue",
    ];

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const wordRounds = table.rounds.filter((round) => round.kind === "word");
      const wordTags = new Set(wordRounds.flatMap((round) => round.tags));
      const extraRackRounds = wordRounds.filter((round) => {
        if (round.visual?.kind !== "wordTiles" || round.visual.answerLength <= 2) return false;
        return round.visual.tiles.length > round.visual.answerLength;
      });

      expect(wordRounds).toHaveLength(80);
      expect(new Set(wordRounds.map((round) => round.id)).size).toBe(wordRounds.length);
      expect(wordRounds.every((round) => round.id.startsWith("word-table-"))).toBe(true);
      expect(wordRounds.every((round) => round.tags.includes("scrabble"))).toBe(true);
      expect(wordRounds.every((round) => round.tags.includes("words"))).toBe(true);
      expect(wordRounds.every((round) => round.tags.includes("word:strategy"))).toBe(true);
      expect(wordRounds.every((round) => !round.tags.some((tag) => retiredWordTags.has(tag)))).toBe(true);
      expect(extraRackRounds.length).toBeGreaterThanOrEqual(60);
      expect(Array.from(wordTags)).toEqual(expect.arrayContaining(requiredStrategyTags));

      for (const round of wordRounds) {
        const visualClue = round.visual?.kind === "wordTiles" ? round.visual.clue ?? "" : "";
        expect(`${round.prompt} ${round.body} ${round.successMessage} ${visualClue}`).not.toMatch(retiredVisibleCopyPattern);
      }
    }
  });

  it("adds visual puzzle metadata to every generated round", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);

      for (const round of table.rounds) {
        expect(round.visual).toBeDefined();
        expect(round.interaction).toBeDefined();
        expect(round.choices.length).toBeGreaterThan(0);
        expect(round.explanation).toContain(round.hint);
        expect(round.tableTalkPrompt?.length).toBeGreaterThan(0);
        if (round.kind === "word") expect(round.visual?.kind).toBe("wordTiles");
        if (round.kind === "chess") expect(round.visual?.kind).toBe("chessBoard");
        if (round.kind === "dominoes") expect(round.visual?.kind).toBe("dominoes");
        if (round.kind === "bridge") expect(round.visual?.kind).toBe("bridgeCards");
      }
    }
  });

  it("adds valid tactile interaction targets to every generated round", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);

      for (const round of table.rounds) {
        expect(round.interaction).toBeDefined();
        if (!round.interaction) continue;

        if (round.kind === "word") {
          expect(round.interaction.kind).toBe("wordBuild");
          if (round.interaction.kind === "wordBuild") {
            expect(round.interaction.shuffleEnabled).toBe(true);
            expect(round.interaction.revealLetterCount).toBeGreaterThanOrEqual(1);
          }
        }

        if (round.kind === "chess") {
          expect(round.interaction.kind).toBe("chessTap");
          expect(round.visual?.kind).toBe("chessBoard");
          if (round.interaction.kind !== "chessTap" || round.visual?.kind !== "chessBoard") continue;
          const validSquares = new Set([
            ...round.visual.pieces.map((piece) => piece.square),
            ...(round.visual.highlights ?? []),
          ]);
          expect(round.interaction.answerSquares.length).toBeGreaterThan(0);
          expect(round.interaction.answerSquares.every((square) => validSquares.has(square))).toBe(true);
          expect(round.interaction.selectableSquares?.length).toBeGreaterThanOrEqual(5);
          expect(round.interaction.answerSquares.every((square) => round.interaction.kind === "chessTap" && round.interaction.selectableSquares?.includes(square))).toBe(true);
          expect(round.visual.pieces.length).toBeGreaterThanOrEqual(6);
          expect(round.visual.pieces.length).toBeLessThanOrEqual(10);
        }

        if (round.kind === "dominoes") {
          expect(round.interaction.kind).toBe("dominoPlay");
          expect(round.visual?.kind).toBe("dominoes");
          if (round.interaction.kind !== "dominoPlay") continue;
          if (round.visual?.kind === "dominoes") {
            expect(round.visual.hand?.length ?? 0).toBeGreaterThanOrEqual(3);
            expect(round.visual.openEnds).toBeDefined();
            expect(round.visual.leftEnd).toBeDefined();
            expect(round.visual.rightEnd).toBeDefined();
          }
          if (round.interaction.answerTile) {
            const answerKey = [...round.interaction.answerTile].sort((a, b) => a - b).join("-");
            const candidateKeys = (round.interaction.candidateTiles ?? []).map((tile) => [...tile].sort((a, b) => a - b).join("-"));
            expect(candidateKeys).toContain(answerKey);
            if (round.interaction.answerEndSide) {
              expect(round.interaction.candidateEnds).toEqual(["left", "right"]);
            }
          } else {
            expect(round.interaction.actions?.length).toBeGreaterThan(0);
            expect(round.interaction.actions?.some((action) => action.id === round.interaction.answerActionId)).toBe(true);
          }
        }

        if (round.kind === "bridge") {
          expect(round.interaction.kind).toBe("bridgeAction");
          expect(round.visual?.kind).toBe("bridgeCards");
          if (round.visual?.kind === "bridgeCards") {
            expect(round.visual.cards?.length ?? 0).toBeGreaterThanOrEqual(4);
            expect(round.visual.cards?.some((card) => card.role === "key")).toBe(true);
            expect(round.visual.cards?.every((card) => !/[♠♥♦♣]/.test(`${card.rank} ${card.suit}`))).toBe(true);
          }
          if (round.interaction.kind !== "bridgeAction") continue;
          expect(round.interaction.actions.length).toBeGreaterThan(0);
          expect(round.interaction.actions.some((action) => action.id === round.interaction.answerActionId)).toBe(true);
        }
      }
    }
  });

  it("keeps early chess puzzle boards distinct when browsing variants", () => {
    for (const language of supportedGameLanguages) {
      const chessRounds = buildGameTable(language, 6).rounds.filter((round) => round.kind === "chess");
      const firstFourBoards = chessRounds.slice(0, 4).map((round) => JSON.stringify(round.visual));

      expect(new Set(firstFourBoards).size).toBe(4);

      const secondBoard = chessRounds[1].visual;
      expect(secondBoard?.kind).toBe("chessBoard");
      if (secondBoard?.kind !== "chessBoard") continue;
      expect(secondBoard.pieces.some((piece) => piece.piece === "whiteRook")).toBe(true);
      expect(secondBoard.pieces.some((piece) => piece.piece === "blackBishop")).toBe(true);
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
        const visualClue = round.visual?.kind === "wordTiles" ? round.visual.clue ?? "" : "";
        expect(tileListPattern.test(visualClue)).toBe(false);
        expect(oldTilePromptPattern.test(visualClue)).toBe(false);

        if (round.visual?.kind !== "wordTiles" || round.visual.answerLength <= 2) continue;
        const rackText = round.visual.tiles.join("").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const answerText = round.answer.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        expect(rackText).not.toBe(answerText);
      }

      if (language === "fr" || language === "it" || language === "pt") {
        expect(wordRounds.every((round) => round.visual?.kind === "wordTiles" && round.visual.clue !== round.hint)).toBe(true);
      }
    }
  });

  it("keeps the dominoes puzzle bank available in each supported app language", () => {
    const answerGivingPromptPattern = /\b(target|keep|avoid)\b|count the pips|what is a double|strongest opener|which tile has the most/i;

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const dominoesRounds = table.rounds.filter((round) => round.kind === "dominoes");
      const twoStepRounds = dominoesRounds.filter((round) => round.interaction?.kind === "dominoPlay" && round.interaction.answerEndSide);
      const tableDecisionRounds = dominoesRounds.filter((round) => {
        if (round.visual?.kind !== "dominoes") return false;
        return Boolean(round.visual.recentPass !== undefined || round.visual.remainingTiles !== undefined || round.interaction?.kind === "dominoPlay" && round.interaction.answerEndSide || (round.visual.hand?.length ?? 0) >= 4);
      });

      expect(dominoesRounds).toHaveLength(80);
      expect(new Set(dominoesRounds.map((round) => round.id)).size).toBe(dominoesRounds.length);
      expect(dominoesRounds.every((round) => round.id.startsWith("domino-table-"))).toBe(true);
      expect(dominoesRounds.every((round) => round.tags.includes("dominoes"))).toBe(true);
      expect(dominoesRounds.every((round) => round.tags.includes("game:dominoes"))).toBe(true);
      expect(dominoesRounds.every((round) => !answerGivingPromptPattern.test(round.prompt))).toBe(true);
      expect(dominoesRounds.every((round) => !round.tags.some((tag) => ["dominoes:pip-count", "dominoes:vocabulary", "dominoes:opening-double"].includes(tag)))).toBe(true);
      expect(tableDecisionRounds.length).toBeGreaterThanOrEqual(72);
      expect(twoStepRounds.length).toBeGreaterThanOrEqual(16);
    }
  });

  it("keeps the bridge puzzle bank available in each supported app language", () => {
    const retiredBridgeTags = new Set(["bridge:vocabulary", "bridge:table-trust", "bridge:no-trump-basics", "bridge:simple-finesse"]);
    const noviceCopyPattern = /calm|gentle|vocabulary|which bridge word|table manners|kind bridge|tranquil|calme|ruhig|amable|aimable/i;

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const bridgeRounds = table.rounds.filter((round) => round.kind === "bridge");
      const bridgeTags = new Set(bridgeRounds.flatMap((round) => round.tags));

      expect(bridgeRounds).toHaveLength(80);
      expect(new Set(bridgeRounds.map((round) => round.id)).size).toBe(bridgeRounds.length);
      expect(bridgeRounds.every((round) => round.id.startsWith("bridge-table-"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("bridge"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("cards"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("game:bridge"))).toBe(true);
      expect(bridgeRounds.every((round) => !round.tags.some((tag) => retiredBridgeTags.has(tag)))).toBe(true);
      expect(bridgeRounds.every((round) => !noviceCopyPattern.test(`${round.prompt} ${round.body} ${round.successMessage}`))).toBe(true);
      expect(Array.from(bridgeTags)).toEqual(expect.arrayContaining([
        "bridge:stayman-transfer",
        "bridge:competitive-auction",
        "bridge:hold-up",
        "bridge:endplay",
        "bridge:squeeze-pressure",
      ]));
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

    expect(buildGameTable("fr", 6).rounds.find((round) => round.id === "word-table-anagram-smile")?.answer).toBe("SOURIRE");
    expect(buildGameTable("it", 6).rounds.find((round) => round.id === "word-table-anagram-smile")?.answer).toBe("SORRISO");
    expect(buildGameTable("pt", 6).rounds.find((round) => round.id === "word-table-anagram-smile")?.answer).toBe("SORRISO");
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

  it("builds a destination-level reading club program in each supported app language", () => {
    const expectedTitles: Record<SocialGameLanguage, RegExp> = {
      es: /Club Literario/i,
      en: /Literary Club/i,
      fr: /club litteraire/i,
      de: /Literaturclub/i,
      it: /club letterario/i,
      pt: /Clube Literario/i,
    };

    for (const language of supportedGameLanguages) {
      const club = buildReadingClubDestination(language, [
        { id: "member-maria", name: "Maria", sharedTopic: "memoir" },
        { id: "member-jose", name: "Jose", sharedTopic: "history" },
        { id: "member-carmen", name: "Carmen", sharedTopic: "stories" },
      ], 9);

      expect(club.title).toMatch(expectedTitles[language]);
      expect(club.metrics).toHaveLength(3);
      expect(club.agenda).toHaveLength(3);
      expect(club.shelves.length).toBeGreaterThanOrEqual(2);
      expect(club.companionModes.map((mode) => mode.id)).toEqual(["one-to-one", "small-circle", "pen-note"]);
      expect(club.passportItems.map((item) => item.id)).toEqual(["share", "recommend", "greet"]);
      expect(club.guidelines.length).toBeGreaterThanOrEqual(3);
    }
  });
});
