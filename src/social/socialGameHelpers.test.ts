import { describe, expect, it } from "vitest";
import { buildGameDefaultRoundIds, buildGamePreferenceTag, buildGameTable } from "../../server/lib/socialGameRounds";
import { buildReadingClubDestination } from "../../server/lib/readingClubDestination";
import { formatSharedTopic, pickBestSocialMatch, supportsSocialMatching } from "../../server/lib/socialMatching";
import type { SocialGameDifficulty, SocialGameKind, SocialGameLanguage } from "./types";

const supportedGameLanguages: SocialGameLanguage[] = ["es", "en", "fr", "de", "it", "pt"];
const supportedGameKinds: SocialGameKind[] = ["chess", "word", "dominoes", "bridge"];
const supportedGameDifficulties: SocialGameDifficulty[] = ["easy", "medium", "hard", "expert"];

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
    expect(table.rounds.every((round) => round.difficulty && round.tags.includes(`difficulty:${round.difficulty}`))).toBe(true);
    expect(table.readyMembers.length).toBeGreaterThan(0);
  });

  it("calibrates game difficulty across every supported language and game", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const defaultRound = table.rounds.find((round) => round.id === table.defaultRoundId);

      expect(defaultRound?.difficulty).toBe("medium");

      for (const kind of supportedGameKinds) {
        const kindRounds = table.rounds.filter((round) => round.kind === kind);
        const defaultRoundId = table.defaultRoundIdsByKind?.[kind];
        const kindDefaultRound = kindRounds.find((round) => round.id === defaultRoundId);

        expect(kindRounds).toHaveLength(80);
        expect(kindDefaultRound?.difficulty).toBe("medium");

        for (const difficulty of supportedGameDifficulties) {
          expect(kindRounds.filter((round) => round.difficulty === difficulty)).toHaveLength(20);
          expect(kindRounds.every((round) => round.tags.includes(`difficulty:${round.difficulty}`))).toBe(true);
        }
      }
    }
  });

  it("keeps game prompts varied across every supported language", () => {
    const promptVarietyExpectations: Record<Exclude<SocialGameKind, "chess">, { minUnique: number; maxRepeat: number }> = {
      word: { minUnique: 45, maxRepeat: 5 },
      dominoes: { minUnique: 72, maxRepeat: 1 },
      bridge: { minUnique: 70, maxRepeat: 3 },
    };
    const promptVarietyKinds = supportedGameKinds.filter((kind): kind is Exclude<SocialGameKind, "chess"> => kind !== "chess");

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);

      for (const kind of promptVarietyKinds) {
        const rounds = table.rounds.filter((round) => round.kind === kind);
        const promptCounts = new Map<string, number>();

        for (const round of rounds) {
          promptCounts.set(round.prompt, (promptCounts.get(round.prompt) ?? 0) + 1);
        }

        const expectation = promptVarietyExpectations[kind];
        expect(promptCounts.size).toBeGreaterThanOrEqual(expectation.minUnique);
        expect(Math.max(...promptCounts.values())).toBeLessThanOrEqual(expectation.maxRepeat);
      }
    }
  });

  it("keeps the chess puzzle bank available in each supported app language", () => {
    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      expect(table.rounds.filter((round) => round.kind === "chess")).toHaveLength(80);
      expect(table.rounds.find((round) => round.id === table.defaultRoundId)?.difficulty).toBe("medium");
    }
  });

  it("generates non-giveaway chess prompts and tactile instructions", () => {
    const bestMovePrompt: Record<SocialGameLanguage, RegExp> = {
      en: /^(White|Black) to move\. Find the best move\.$/,
      es: /^(Juegan blancas|Juegan negras)\. Encuentra la mejor jugada\.$/,
      fr: /^(Aux blancs|Aux noirs)\. Trouvez le meilleur coup\.$/,
      de: /^(Weiss|Schwarz) am Zug\. Finde den besten Zug\.$/,
      it: /^Muove il (Bianco|Nero)\. Trova la mossa migliore\.$/,
      pt: /^(Brancas|Pretas) jogam\. Encontre o melhor lance\.$/,
    };
    const genericInstruction: Record<SocialGameLanguage, string> = {
      en: "Tap a piece, then its square.",
      es: "Toca una pieza y luego su casilla.",
      fr: "Touchez une piece, puis sa case.",
      de: "Tippe eine Figur an, dann ihr Zielfeld.",
      it: "Tocca un pezzo, poi la casa.",
      pt: "Toque numa peca e depois na casa.",
    };
    const giveawayPattern = /white (queen|rook|bishop|knight|pawn)|dama blanca|torre blanca|alfil blanco|caballo blanco|peon blanco|weisse dame|weissen turm|weissen laeufer|weissen springer|weissen bauern|dame blanche|tour blanche|fou blanc|cavalier blanc|pion blanc|donna bianca|torre bianca|alfiere bianco|cavallo bianco|pedone bianco|dama branca|torre branca|bispo branco|cavalo branco|peao branco|fork|horquilla|gabel|fourchette|forchetta|garfo|double threat|doble amenaza|doppelte drohung|double menace|doppia minaccia|ameaca dupla|back-rank mate|mate de primera fila|grundreihenmatt|mat du couloir|matto di corridoio|mate de corredor|\bpin\b|clouage|inchiodatura|cravada|skewer|enfilade|infilata|espeto/i;

    for (const language of supportedGameLanguages) {
      const chessRounds = buildGameTable(language, 6).rounds.filter((round) => round.kind === "chess");
      const promptCounts = new Map<string, number>();

      expect(chessRounds).toHaveLength(80);

      for (const round of chessRounds) {
        promptCounts.set(round.prompt, (promptCounts.get(round.prompt) ?? 0) + 1);
        expect(round.prompt).toMatch(bestMovePrompt[language]);
        expect(round.prompt).not.toMatch(giveawayPattern);
        expect(round.prompt.toLocaleLowerCase()).not.toContain(round.answer.toLocaleLowerCase());
        expect(round.interaction?.kind).toBe("chessMove");
        if (round.interaction?.kind !== "chessMove") continue;
        expect(round.interaction.instruction).toBe(genericInstruction[language]);
        expect(round.prompt).not.toContain(round.interaction.from);
        expect(round.prompt).not.toContain(round.interaction.to);
        expect(round.prompt).not.toContain(round.interaction.moveLabel);
        expect(round.choices.length).toBeGreaterThan(0);
        expect(round.explanation).toContain(round.interaction.moveLabel);
        expect(round.explanation).toContain(round.answer);
      }

      const chessThemeTags = new Set(
        chessRounds.flatMap((round) => round.tags.filter((tag) => tag.startsWith("chess:"))),
      );

      expect(promptCounts.size).toBeLessThanOrEqual(2);
      expect(chessThemeTags.size).toBe(20);
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
    expect(table.defaultRoundIndexesByKind?.chess).toBe(1);
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
      lastSeenAt: index === 9 ? "2026-05-01T10:00:00.000Z" : `2026-06-${String((index % 28) + 1).padStart(2, "0")}T10:00:00.000Z`,
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
          expect(round.interaction.kind).toBe("chessMove");
          expect(round.visual?.kind).toBe("chessBoard");
          if (round.interaction.kind !== "chessMove" || round.visual?.kind !== "chessBoard") continue;
          const validSquarePattern = /^[a-h][1-8]$/;
          const pieceSquares = round.visual.pieces.map((piece) => piece.square);
          const piecesBySquare = new Map(round.visual.pieces.map((piece) => [piece.square, piece.piece]));
          expect(pieceSquares.every((square) => validSquarePattern.test(square))).toBe(true);
          expect(new Set(pieceSquares).size).toBe(pieceSquares.length);
          expect(round.visual.pieces.filter((piece) => piece.piece === "whiteKing")).toHaveLength(1);
          expect(round.visual.pieces.filter((piece) => piece.piece === "blackKing")).toHaveLength(1);
          expect(validSquarePattern.test(round.interaction.from)).toBe(true);
          expect(validSquarePattern.test(round.interaction.to)).toBe(true);
          expect(piecesBySquare.has(round.interaction.from)).toBe(true);
          expect(round.interaction.selectableSquares.length).toBeGreaterThanOrEqual(3);
          expect(round.interaction.selectableSquares).toContain(round.interaction.from);
          expect(round.interaction.candidateMoves.length).toBeGreaterThanOrEqual(3);
          expect(round.interaction.candidateMoves).toEqual(expect.arrayContaining([
            expect.objectContaining({ from: round.interaction.from, to: round.interaction.to }),
          ]));
          expect(round.interaction.candidateMoves.every((move) => validSquarePattern.test(move.from) && validSquarePattern.test(move.to))).toBe(true);
          expect(round.interaction.candidateMoves.every((move) => round.interaction.kind === "chessMove" && round.interaction.selectableSquares.includes(move.from))).toBe(true);
          expect(round.interaction.hintSquares).toEqual(expect.arrayContaining([round.interaction.from, round.interaction.to]));
          expect(round.visual.pieces.length).toBeGreaterThanOrEqual(6);
          expect(round.visual.pieces.length).toBeLessThanOrEqual(12);
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

  it("builds unique club-smart chess positions and balanced answer moves", () => {
    for (const language of supportedGameLanguages) {
      const chessRounds = buildGameTable(language, 6).rounds.filter((round) => round.kind === "chess");
      const boardSignatures = chessRounds.map((round) => {
        if (round.visual?.kind !== "chessBoard") return "";
        return JSON.stringify({
          caption: round.visual.caption,
          pieces: [...round.visual.pieces].sort((a, b) => a.square.localeCompare(b.square)),
        });
      });
      const answerTargetCounts = new Map<string, number>();
      const answerPieceCounts = new Map<string, number>();

      expect(new Set(boardSignatures).size).toBe(80);

      for (const round of chessRounds) {
        expect(round.interaction?.kind).toBe("chessMove");
        expect(round.visual?.kind).toBe("chessBoard");
        if (round.interaction?.kind !== "chessMove" || round.visual?.kind !== "chessBoard") continue;
        const answerPiece = round.visual.pieces.find((piece) => piece.square === round.interaction.from)?.piece ?? "";
        const answerPieceRole = answerPiece.replace(/^white|^black/, "");
        answerTargetCounts.set(round.interaction.to, (answerTargetCounts.get(round.interaction.to) ?? 0) + 1);
        answerPieceCounts.set(answerPieceRole, (answerPieceCounts.get(answerPieceRole) ?? 0) + 1);
      }

      expect(Math.max(...answerTargetCounts.values())).toBeLessThanOrEqual(5);
      expect(Math.max(...answerPieceCounts.values())).toBeLessThanOrEqual(24);
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
    const genericOnlyQuestionPattern = /^(What is the best bridge action|Cual es la mejor accion de bridge|Was ist die beste Bridge-Aktion|Quelle est la meilleure action de bridge|Qual e la migliore azione di bridge|Qual e a melhor acao de bridge)\?$/;

    for (const language of supportedGameLanguages) {
      const table = buildGameTable(language, 6);
      const bridgeRounds = table.rounds.filter((round) => round.kind === "bridge");
      const bridgeTags = new Set(bridgeRounds.flatMap((round) => round.tags));
      const promptCounts = new Map<string, number>();

      for (const round of bridgeRounds) {
        promptCounts.set(round.prompt, (promptCounts.get(round.prompt) ?? 0) + 1);
      }

      expect(bridgeRounds).toHaveLength(80);
      expect(new Set(bridgeRounds.map((round) => round.id)).size).toBe(bridgeRounds.length);
      expect(bridgeRounds.every((round) => round.id.startsWith("bridge-table-"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("bridge"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("cards"))).toBe(true);
      expect(bridgeRounds.every((round) => round.tags.includes("game:bridge"))).toBe(true);
      expect(bridgeRounds.every((round) => !round.tags.some((tag) => retiredBridgeTags.has(tag)))).toBe(true);
      expect(bridgeRounds.every((round) => !noviceCopyPattern.test(`${round.prompt} ${round.body} ${round.successMessage}`))).toBe(true);
      expect(bridgeRounds.every((round) => !genericOnlyQuestionPattern.test(round.prompt))).toBe(true);
      expect(promptCounts.size).toBeGreaterThanOrEqual(70);
      expect(Math.max(...promptCounts.values())).toBeLessThanOrEqual(3);
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
