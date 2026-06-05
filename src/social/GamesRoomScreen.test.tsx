import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GamesRoomScreen from "./GamesRoomScreen";
import type { SocialGameRound, SocialRoomResponse } from "./types";

const apiFetchMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

function createWordRound(index: number): SocialGameRound {
  if (index === 0) {
    return {
      id: "word-tiles-anagram-smile",
      kind: "word",
      title: "Word tiles",
      body: "Make a word from the tiles.",
      prompt: "Arrange the tiles into a friendly word.",
      choices: ["SMILE", "LIMES", "MILES"],
      answer: "SMILE",
      hint: "Choose the word you could send as a greeting.",
      tags: ["games", "scrabble", "words", "game:word", "word:anagram"],
      estimatedDurationSeconds: 75,
      successMessage: "Lovely. Anagrams make word games feel quick and social.",
      interaction: {
        kind: "wordBuild",
        instruction: "Tap tiles into your tray.",
        shuffleEnabled: true,
        revealLetterCount: 1,
      },
      visual: {
        kind: "wordTiles",
        tiles: ["E", "I", "M", "L", "S"],
        answerLength: 5,
      },
    };
  }

  if (index === 1) {
    return {
      id: "word-tiles-anagram-peace",
      kind: "word",
      title: "Word tiles",
      body: "Make a word from the tiles.",
      prompt: "Arrange the tiles into a friendly word.",
      choices: ["PEACE", "PACES", "CAPES"],
      answer: "PEACE",
      hint: "It means calm between people.",
      tags: ["games", "scrabble", "words", "game:word", "word:anagram"],
      estimatedDurationSeconds: 80,
      successMessage: "Lovely. Anagrams make word games feel quick and social.",
      interaction: {
        kind: "wordBuild",
        instruction: "Tap tiles into your tray.",
        shuffleEnabled: true,
        revealLetterCount: 1,
      },
      visual: {
        kind: "wordTiles",
        tiles: ["E", "A", "P", "C", "E"],
        answerLength: 5,
      },
    };
  }

  return {
    id: `word-tiles-test-${index + 1}`,
    kind: "word",
    title: "Word tiles",
    body: "Solve a short word clue.",
    prompt: `Choose the friendly test word ${index + 1}.`,
    choices: [`WORD${index + 1}`, `TILE${index + 1}`, `GAME${index + 1}`],
    answer: `WORD${index + 1}`,
    hint: "Pick the first friendly word.",
    tags: ["games", "scrabble", "words", "game:word", "word:test"],
    estimatedDurationSeconds: 80,
    successMessage: "Nice word choice.",
    interaction: {
      kind: "wordBuild",
      instruction: "Tap tiles into your tray.",
      shuffleEnabled: true,
      revealLetterCount: 1,
    },
    visual: {
      kind: "wordTiles",
      tiles: [`D${index + 1}`, `WOR${index + 1}`],
      answerLength: 2,
    },
  };
}

const wordRounds = Array.from({ length: 80 }, (_, index) => createWordRound(index));

function createDominoesRound(index: number): SocialGameRound {
  if (index === 0) {
    return {
      id: "dominoes-open-double-six",
      kind: "dominoes",
      title: "Dominoes",
      body: "Choose the strongest opening tile.",
      prompt: "You are starting and have these doubles: Double six, Double five, Double three. Which tile is the strongest opener?",
      choices: ["Double six", "Double five", "Double three"],
      answer: "Double six",
      hint: "The highest double gives the table a clear anchor.",
      tags: ["games", "dominoes", "game:dominoes", "dominoes:opening-double"],
      estimatedDurationSeconds: 75,
      successMessage: "Nice table sense. A strong double gives everyone an easy start.",
      interaction: {
        kind: "dominoPlay",
        instruction: "Tap the tile you would play.",
        answerTile: [6, 6],
        candidateTiles: [[6, 6], [5, 5], [3, 3]],
      },
      visual: {
        kind: "dominoes",
        caption: "Choose the strongest opening tile.",
        candidateTiles: [[6, 6], [5, 5], [3, 3]],
      },
    };
  }

  if (index === 1) {
    return {
      id: "dominoes-open-double-five",
      kind: "dominoes",
      title: "Dominoes",
      body: "Choose the strongest opening tile.",
      prompt: "You are starting and have these doubles: Double five, Double four, Double two. Which tile is the strongest opener?",
      choices: ["Double five", "Double four", "Double two"],
      answer: "Double five",
      hint: "The highest double gives the table a clear anchor.",
      tags: ["games", "dominoes", "game:dominoes", "dominoes:opening-double"],
      estimatedDurationSeconds: 75,
      successMessage: "Nice table sense. A strong double gives everyone an easy start.",
      interaction: {
        kind: "dominoPlay",
        instruction: "Tap the tile you would play.",
        answerTile: [5, 5],
        candidateTiles: [[5, 5], [4, 4], [2, 2]],
      },
      visual: {
        kind: "dominoes",
        caption: "Choose the strongest opening tile.",
        candidateTiles: [[5, 5], [4, 4], [2, 2]],
      },
    };
  }

  return {
    id: `dominoes-test-${index + 1}`,
    kind: "dominoes",
    title: "Dominoes",
    body: "Solve a short dominoes table clue.",
    prompt: `Choose the useful dominoes test tile ${index + 1}.`,
    choices: [`Tile ${index + 1}`, `Pass ${index + 1}`, `Draw ${index + 1}`],
    answer: `Tile ${index + 1}`,
    hint: "Pick the first useful tile.",
    tags: ["games", "dominoes", "game:dominoes", "dominoes:test"],
    estimatedDurationSeconds: 75,
    successMessage: "Nice table sense.",
    interaction: {
      kind: "dominoPlay",
      instruction: "Tap the tile you would play.",
      answerTile: [1, 2],
      candidateTiles: [[1, 2], [2, 3], [3, 4]],
    },
    visual: {
      kind: "dominoes",
      caption: "Solve a short dominoes table clue.",
      candidateTiles: [[1, 2], [2, 3], [3, 4]],
    },
  };
}

const dominoesRounds = Array.from({ length: 80 }, (_, index) => createDominoesRound(index));

function createBridgeRound(index: number): SocialGameRound {
  if (index === 0) {
    return {
      id: "bridge-opening-bid-five-hearts",
      kind: "bridge",
      title: "Bridge table",
      body: "Choose a calm opening bid.",
      prompt: "You have 13 points and 5 hearts. Which calm choice fits best?",
      choices: ["Bid 1 hearts", "Bid 1 no-trump", "Pass"],
      answer: "Bid 1 hearts",
      hint: "Bid the longest suit",
      tags: ["games", "bridge", "cards", "game:bridge", "bridge:opening-bid"],
      estimatedDurationSeconds: 85,
      successMessage: "Good start. A clear opening helps partner relax.",
      interaction: {
        kind: "bridgeAction",
        instruction: "Tap the calm table action.",
        actions: [
          { id: "bid:1:hearts", label: "Bid 1 hearts" },
          { id: "bid:1:noTrump", label: "Bid 1 no-trump" },
          { id: "pass", label: "Pass" },
        ],
        answerActionId: "bid:1:hearts",
      },
      visual: {
        kind: "bridgeCards",
        caption: "Choose a calm opening bid.",
        points: 13,
        suitLengths: [{ suit: "hearts", length: 5 }],
      },
    };
  }

  if (index === 1) {
    return {
      id: "bridge-opening-bid-five-spades",
      kind: "bridge",
      title: "Bridge table",
      body: "Choose a calm opening bid.",
      prompt: "You have 12 points and 5 spades. Which calm choice fits best?",
      choices: ["Bid 1 spades", "Bid 1 clubs", "Pass"],
      answer: "Bid 1 spades",
      hint: "Bid the longest suit",
      tags: ["games", "bridge", "cards", "game:bridge", "bridge:opening-bid"],
      estimatedDurationSeconds: 85,
      successMessage: "Good start. A clear opening helps partner relax.",
      interaction: {
        kind: "bridgeAction",
        instruction: "Tap the calm table action.",
        actions: [
          { id: "bid:1:spades", label: "Bid 1 spades" },
          { id: "bid:1:clubs", label: "Bid 1 clubs" },
          { id: "pass", label: "Pass" },
        ],
        answerActionId: "bid:1:spades",
      },
      visual: {
        kind: "bridgeCards",
        caption: "Choose a calm opening bid.",
        points: 12,
        suitLengths: [{ suit: "spades", length: 5 }],
      },
    };
  }

  return {
    id: `bridge-test-${index + 1}`,
    kind: "bridge",
    title: "Bridge table",
    body: "Solve a gentle bridge table puzzle.",
    prompt: `Choose the useful bridge test action ${index + 1}.`,
    choices: [`Bridge ${index + 1}`, `Pass ${index + 1}`, `Lead ${index + 1}`],
    answer: `Bridge ${index + 1}`,
    hint: "Pick the first bridge action.",
    tags: ["games", "bridge", "cards", "game:bridge", "bridge:test"],
    estimatedDurationSeconds: 85,
    successMessage: "Nice bridge table choice.",
    interaction: {
      kind: "bridgeAction",
      instruction: "Tap the calm table action.",
      actions: [
        { id: `bridge-${index + 1}`, label: `Bridge ${index + 1}` },
        { id: `pass-${index + 1}`, label: `Pass ${index + 1}` },
        { id: `lead-${index + 1}`, label: `Lead ${index + 1}` },
      ],
      answerActionId: `bridge-${index + 1}`,
    },
    visual: {
      kind: "bridgeCards",
      caption: "Solve a gentle bridge table puzzle.",
      cards: [{ rank: "ace", suit: "spades" }],
    },
  };
}

const bridgeRounds = Array.from({ length: 80 }, (_, index) => createBridgeRound(index));

const roomResponse: SocialRoomResponse = {
  room: {
    slug: "games-room",
    name: "Games Room",
    category: "activity",
    agentSlug: "viktor-sanz",
    agentFullName: "Viktor Sanz",
    agentColour: "#F59E0B",
    agentCredential: "Games companion",
    ctaLabel: "Play",
    topicTags: ["games"],
    timeSlots: ["afternoon"],
    featured: true,
    participantCount: 6,
    sessionDate: "2026-06-04",
    topic: "Chess, words, dominoes and small challenges.",
    opener: "Hello, I'm Viktor. We can play chess, words or a short challenge.",
    quote: "",
    activityType: "game",
    contentTag: "",
    contentTitle: "A short challenge",
    contentBody: "Choose chess, word tiles, dominoes or bridge.",
    options: [],
    liveBadge: "6 in the room",
  },
  transcript: [],
  promptChips: [],
  members: [],
  memberChat: [
    {
      id: "chat-1",
      authorId: "member-ana",
      authorName: "Ana",
      text: "Word games feel easier when the round is short.",
      createdAt: "2026-06-04T10:00:00.000Z",
      connectable: true,
    },
  ],
  gameTable: {
    hostLine: "Viktor is hosting short classic rounds.",
    tableLabel: "Today's table",
    readyLabel: "3 people ready",
    chooseRoundLabel: "Choose a round",
    connectionTitle: "Find a playing partner",
    connectionBody: "Contact details stay private.",
    startRoundLabel: "Start this puzzle",
    completeRoundLabel: "Check answer",
    findPartnerLabel: "Find a playing partner",
    sayHelloLabel: "Say hello",
    roundCompleteLabel: "Puzzle complete",
    defaultRoundId: "chess-clue-fork",
    readyMembers: [
      {
        id: "member-ana",
        name: "Ana",
        gameKind: "word",
        statusLabel: "Ana likes word games",
        sharedTopic: "word games",
      },
    ],
    rounds: [
      {
        id: "chess-clue-fork",
        kind: "chess",
        title: "Chess clue",
        body: "Spot a friendly tactic.",
        prompt: "White's knight can check the king and attack the queen. What tactic is this?",
        choices: ["Fork", "Castle", "Trade pawns"],
        answer: "Fork",
        hint: "One piece makes two threats at the same time.",
        tags: ["games", "chess", "game:chess", "chess:fork"],
        estimatedDurationSeconds: 90,
        successMessage: "Nice steady thinking. Forks are a classic way to start a chess chat.",
        interaction: {
          kind: "chessTap",
          instruction: "Tap the piece or square Viktor should notice.",
          answerSquares: ["d5"],
          selectableSquares: ["d5", "f6", "b6", "g1"],
        },
        visual: {
          kind: "chessBoard",
          caption: "One white piece points at two black targets.",
          pieces: [
            { square: "d5", piece: "whiteKnight" },
            { square: "f6", piece: "blackKing" },
            { square: "b6", piece: "blackQueen" },
            { square: "g1", piece: "whiteKing" },
          ],
          highlights: ["d5", "f6", "b6"],
        },
      },
      {
        id: "chess-clue-back-rank",
        kind: "chess",
        title: "Chess clue",
        body: "Find the trapped king.",
        prompt: "Black's king is stuck behind its own pawns and White has a rook on the open file. What idea should White look for?",
        choices: ["Back-rank mate", "En passant", "Pawn promotion"],
        answer: "Back-rank mate",
        hint: "The king has no safe square because its own pawns block the escape.",
        tags: ["games", "chess", "game:chess", "chess:mate"],
        estimatedDurationSeconds: 95,
        successMessage: "Good eye. Back-rank patterns are small puzzles that many chess players enjoy.",
        interaction: {
          kind: "chessTap",
          instruction: "Tap the piece or square Viktor should notice.",
          answerSquares: ["e8"],
          selectableSquares: ["e8", "g8", "f7", "g7", "h7", "g1"],
        },
        visual: {
          kind: "chessBoard",
          caption: "The black king is boxed in behind its own pawns.",
          pieces: [
            { square: "e8", piece: "whiteRook" },
            { square: "g8", piece: "blackKing" },
            { square: "f7", piece: "blackPawn" },
            { square: "g7", piece: "blackPawn" },
            { square: "h7", piece: "blackPawn" },
            { square: "g1", piece: "whiteKing" },
          ],
          highlights: ["e8", "g8", "f7", "g7", "h7"],
        },
      },
      ...wordRounds,
      ...dominoesRounds,
      ...bridgeRounds,
    ],
  },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function gameRoundRequestBodies() {
  return apiFetchMock.mock.calls
    .filter(([url]) => url === "/api/social/rooms/games-room/game-round")
    .map(([, options]) => JSON.parse(String((options as RequestInit).body ?? "{}")));
}

describe("GamesRoomScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/game-rounds")) {
        const parsedUrl = new URL(url, "http://localhost");
        const gameKind = parsedUrl.searchParams.get("gameKind");
        const rounds = roomResponse.gameTable?.rounds.filter((round) => round.kind === gameKind) ?? [];
        return Promise.resolve(jsonResponse({
          gameKind,
          rounds,
          roundCount: rounds.length,
          defaultRoundId: rounds[0]?.id ?? null,
          defaultRoundIndex: 0,
        }));
      }
      if (url.endsWith("/match")) {
        return Promise.resolve(jsonResponse({
          noMatch: false,
          matchedUser: { userId: "senior-2", name: "Ana" },
          sharedTopics: ["game:word"],
          agentMessage: "I found someone who also enjoys word games.",
        }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });
  });

  it("lets the chess clue card browse more than one chess puzzle", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("Dominoes")).toBeInTheDocument();
    expect(screen.getByText("Bridge table")).toBeInTheDocument();
    expect(screen.queryByText("Trivia")).not.toBeInTheDocument();
    expect(screen.queryByText("Memory match")).not.toBeInTheDocument();
    expect(screen.getByText("Puzzle 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Next puzzle")).not.toBeInTheDocument();
    const puzzleControls = screen.getByTestId("games-puzzle-controls");
    expect(within(puzzleControls).getByTestId("games-start-round")).toHaveTextContent("Start this puzzle");
    expect(within(puzzleControls).getByTestId("games-next-puzzle")).toBeInTheDocument();
    expect(screen.getByText("White's knight can check the king and attack the queen. What tactic is this?")).toBeInTheDocument();
    const chessBoard = screen.getByTestId("games-visual-chess");
    expect(chessBoard).toBeInTheDocument();
    expect(within(chessBoard).getByRole("img", { name: "White knight" })).toBeInTheDocument();
    expect(within(chessBoard).getByRole("img", { name: "Black queen" })).toBeInTheDocument();
    expect(within(chessBoard).queryByText("WN")).not.toBeInTheDocument();
    expect(within(chessBoard).queryByText("BQ")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Black's king is stuck behind its own pawns and White has a rook on the open file. What idea should White look for?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));
    expect(screen.queryByTestId("games-start-round")).not.toBeInTheDocument();
    expect(screen.queryByTestId("games-help-choices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("chess-square-e8"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"roundId":"chess-clue-back-rank"'),
        }),
      );
    });
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "chess-clue-back-rank",
          gameKind: "chess",
          status: "completed",
        }),
      ]));
    });
  });

  it("honors personalized default rounds for initial load and game cards", () => {
    const personalizedResponse: SocialRoomResponse = {
      ...roomResponse,
      gameTable: {
        ...roomResponse.gameTable!,
        defaultRoundId: "dominoes-open-double-five",
        defaultRoundIdsByKind: {
          chess: "chess-clue-back-rank",
          word: "word-tiles-anagram-peace",
          dominoes: "dominoes-open-double-five",
          bridge: "bridge-opening-bid-five-spades",
        },
      },
    };

    render(<GamesRoomScreen roomResponse={personalizedResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("You are starting and have these doubles: Double five, Double four, Double two. Which tile is the strongest opener?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-round-chess"));
    expect(screen.getByText("Puzzle 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Black's king is stuck behind its own pawns and White has a rook on the open file. What idea should White look for?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-round-word"));
    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.queryByText("PEACE")).not.toBeInTheDocument();
  });

  it("loads puzzle banks on demand from a compact Games Room payload", async () => {
    const compactResponse: SocialRoomResponse = {
      ...roomResponse,
      gameTable: {
        ...roomResponse.gameTable!,
        rounds: [
          roomResponse.gameTable!.rounds.find((round) => round.id === "chess-clue-fork")!,
          roomResponse.gameTable!.rounds.find((round) => round.id === "word-tiles-anagram-smile")!,
          roomResponse.gameTable!.rounds.find((round) => round.id === "dominoes-open-double-six")!,
          roomResponse.gameTable!.rounds.find((round) => round.id === "bridge-opening-bid-five-hearts")!,
        ],
        roundCountsByKind: {
          chess: 2,
          word: 80,
          dominoes: 80,
          bridge: 80,
        },
        defaultRoundIdsByKind: {
          chess: "chess-clue-fork",
          word: "word-tiles-anagram-smile",
          dominoes: "dominoes-open-double-six",
          bridge: "bridge-opening-bid-five-hearts",
        },
        defaultRoundIndexesByKind: {
          chess: 0,
          word: 0,
          dominoes: 0,
          bridge: 0,
        },
      },
    };

    render(<GamesRoomScreen roomResponse={compactResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("Puzzle 1 of 2")).toBeInTheDocument();
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/social/rooms/games-room/game-rounds?lang=en&gameKind=chess");
    });
    await waitFor(() => expect(screen.getByTestId("games-next-puzzle")).toBeEnabled());

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 2")).toBeInTheDocument();
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "chess-clue-fork",
          gameKind: "chess",
          status: "skipped",
        }),
      ]));
    });

    fireEvent.click(screen.getByTestId("games-start-round"));
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "chess-clue-back-rank",
          gameKind: "chess",
          status: "started",
        }),
      ]));
    });
  });

  it("keeps Games Room controls localized for expanded app languages", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="fr" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByText("Puzzle 1 sur 2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"lang":"fr".*"status":"started"/),
        }),
      );
    });
  });

  it("lets the Word tiles card browse an 80-puzzle word bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-word"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("Arrange the tiles into a friendly word.")).toBeInTheDocument();
    expect(screen.queryByText("SMILE")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("Arrange the tiles into a friendly word.")).toBeInTheDocument();
    expect(screen.queryByText("PEACE")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    expect(screen.getByTestId("games-word-tiles-panel")).toBeInTheDocument();
    expect(screen.getByTestId("word-answer-tray")).toBeInTheDocument();
    expect(screen.getByTestId("word-tile-progress")).toHaveTextContent("0 of 5 placed");
    expect(screen.queryByTestId("word-help-choices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("word-shuffle"));

    fireEvent.click(screen.getByTestId("word-show-help"));
    expect(screen.getByTestId("word-help-panel")).toHaveTextContent("Hint: It means calm between people.");
    expect(screen.queryByTestId("word-help-choices")).not.toBeInTheDocument();
    expect(screen.queryByText("PEACE")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("word-reveal-letter"));
    expect(screen.getByTestId("word-tile-progress")).toHaveTextContent("1 of 5 placed");

    fireEvent.click(screen.getByTestId("word-show-choices"));
    expect(screen.getByTestId("word-help-choices")).toBeInTheDocument();
    expect(screen.getByText("PEACE")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"word-tiles-anagram-peace".*"gameKind":"word".*"status":"started"/),
        }),
      );
    });
  });

  it("lets the Dominoes card browse an 80-puzzle dominoes bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-dominoes"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("You are starting and have these doubles: Double six, Double five, Double three. Which tile is the strongest opener?")).toBeInTheDocument();
    expect(screen.getByTestId("games-visual-dominoes")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("You are starting and have these doubles: Double five, Double four, Double two. Which tile is the strongest opener?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));
    expect(screen.getByTestId("games-tactile-dominoes")).toBeInTheDocument();
    expect(screen.queryByTestId("games-help-choices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("domino-tile-5-5"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"dominoes-open-double-five".*"gameKind":"dominoes".*"status":"started"/),
        }),
      );
    });
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "dominoes-open-double-five",
          gameKind: "dominoes",
          status: "completed",
        }),
      ]));
    });
  });

  it("lets the Bridge table card browse an 80-puzzle bridge bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-bridge"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("You have 13 points and 5 hearts. Which calm choice fits best?")).toBeInTheDocument();
    expect(screen.getByTestId("games-visual-bridge")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("You have 12 points and 5 spades. Which calm choice fits best?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));
    expect(screen.getByTestId("games-tactile-bridge")).toBeInTheDocument();
    expect(screen.queryByTestId("games-help-choices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bridge-action-bid:1:spades"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"bridge-opening-bid-five-spades".*"gameKind":"bridge".*"status":"started"/),
        }),
      );
    });
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "bridge-opening-bid-five-spades",
          gameKind: "bridge",
          status: "completed",
        }),
      ]));
    });
  });

  it("searches for a Bridge partner using the bridge game kind", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-bridge"));
    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"gameKind":"bridge".*"status":"started"/),
        }),
      );
    });

    expect(screen.queryByTestId("games-help-choices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bridge-action-pass"));
    expect(screen.getByText("Close. Look at the hint and try another table move.")).toBeInTheDocument();
    expect(screen.getByTestId("games-help-choices")).toBeInTheDocument();
    expect(screen.queryByText("Puzzle complete")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("bridge-action-bid:1:hearts"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "bridge-opening-bid-five-hearts",
          gameKind: "bridge",
          status: "completed",
        }),
      ]));
    });
    fireEvent.click(screen.getByTestId("games-find-partner"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/match",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"gameKind":"bridge"'),
        }),
      );
    });
  });

  it("reveals Word tiles help after a wrong tile attempt", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-word"));
    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"word-tiles-anagram-smile".*"gameKind":"word".*"status":"started"/),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("word-tile-0"));
    fireEvent.click(screen.getByTestId("word-tile-1"));
    fireEvent.click(screen.getByTestId("word-tile-2"));
    fireEvent.click(screen.getByTestId("word-tile-3"));
    fireEvent.click(screen.getByTestId("word-tile-4"));
    fireEvent.click(screen.getByTestId("word-check-answer"));

    expect(screen.getByText("Close. Try another order or use the help.")).toBeInTheDocument();
    expect(screen.getByTestId("word-help-choices")).toBeInTheDocument();
    expect(screen.getByText("SMILE")).toBeInTheDocument();

    fireEvent.click(screen.getByText("SMILE"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "word-tiles-anagram-smile",
          gameKind: "word",
          status: "completed",
        }),
      ]));
    });
  });

  it("runs a guided round and searches for a partner using the selected game kind", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Games Room" })).toBeInTheDocument();
    expect(screen.getByText("3 people ready")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-round-word"));
    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"gameKind":"word".*"status":"started"/),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("word-tile-4"));
    fireEvent.click(screen.getByTestId("word-tile-2"));
    fireEvent.click(screen.getByTestId("word-tile-1"));
    fireEvent.click(screen.getByTestId("word-tile-3"));
    fireEvent.click(screen.getByTestId("word-tile-0"));
    fireEvent.click(screen.getByTestId("word-check-answer"));
    expect(screen.getByText("Puzzle complete")).toBeInTheDocument();
    await waitFor(() => {
      expect(gameRoundRequestBodies()).toEqual(expect.arrayContaining([
        expect.objectContaining({
          roundId: "word-tiles-anagram-smile",
          gameKind: "word",
          status: "completed",
        }),
      ]));
    });

    fireEvent.click(screen.getByTestId("games-find-partner"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/match",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"gameKind":"word"'),
        }),
      );
    });
    expect(await screen.findByTestId("games-match-result")).toHaveTextContent("Ana");
  });
});
