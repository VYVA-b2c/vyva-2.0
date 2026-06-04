import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      prompt: "Use the tiles S, M, I, L, E. Which word can you make?",
      choices: ["SMILE", "LIMES", "MILES"],
      answer: "SMILE",
      hint: "Choose the word you could send as a greeting.",
      tags: ["games", "scrabble", "words", "game:word", "word:anagram"],
      estimatedDurationSeconds: 75,
      successMessage: "Lovely. Anagrams make word games feel quick and social.",
    };
  }

  if (index === 1) {
    return {
      id: "word-tiles-anagram-peace",
      kind: "word",
      title: "Word tiles",
      body: "Make a word from the tiles.",
      prompt: "Use the tiles P, E, A, C, E. Which word can you make?",
      choices: ["PEACE", "PACES", "CAPES"],
      answer: "PEACE",
      hint: "It means calm between people.",
      tags: ["games", "scrabble", "words", "game:word", "word:anagram"],
      estimatedDurationSeconds: 80,
      successMessage: "Lovely. Anagrams make word games feel quick and social.",
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
    startRoundLabel: "Start round",
    completeRoundLabel: "Complete round",
    findPartnerLabel: "Find a playing partner",
    sayHelloLabel: "Say hello",
    roundCompleteLabel: "Round complete",
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

describe("GamesRoomScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
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
    expect(screen.getByText("White's knight can check the king and attack the queen. What tactic is this?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Black's king is stuck behind its own pawns and White has a rook on the open file. What idea should White look for?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"roundId":"chess-clue-back-rank"'),
        }),
      );
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
          body: expect.stringContaining('"lang":"fr"'),
        }),
      );
    });
  });

  it("lets the Word tiles card browse an 80-puzzle word bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-word"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("Use the tiles S, M, I, L, E. Which word can you make?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("Use the tiles P, E, A, C, E. Which word can you make?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"word-tiles-anagram-peace".*"gameKind":"word"/),
        }),
      );
    });
  });

  it("lets the Dominoes card browse an 80-puzzle dominoes bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-dominoes"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("You are starting and have these doubles: Double six, Double five, Double three. Which tile is the strongest opener?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("You are starting and have these doubles: Double five, Double four, Double two. Which tile is the strongest opener?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"dominoes-open-double-five".*"gameKind":"dominoes"/),
        }),
      );
    });
  });

  it("lets the Bridge table card browse an 80-puzzle bridge bank", async () => {
    render(<GamesRoomScreen roomResponse={roomResponse} language="en" visitId="visit-1" onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("games-round-bridge"));

    expect(screen.getByText("Puzzle 1 of 80")).toBeInTheDocument();
    expect(screen.getByText("You have 13 points and 5 hearts. Which calm choice fits best?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-next-puzzle"));

    expect(screen.getByText("Puzzle 2 of 80")).toBeInTheDocument();
    expect(screen.getByText("You have 12 points and 5 spades. Which calm choice fits best?")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("games-start-round"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/social/rooms/games-room/game-round",
        expect.objectContaining({
          method: "POST",
          body: expect.stringMatching(/"roundId":"bridge-opening-bid-five-spades".*"gameKind":"bridge"/),
        }),
      );
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
          body: expect.stringContaining('"gameKind":"bridge"'),
        }),
      );
    });

    fireEvent.click(screen.getByText("Bid 1 hearts"));
    fireEvent.click(screen.getByTestId("games-complete-round"));
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
          body: expect.stringContaining('"gameKind":"word"'),
        }),
      );
    });

    fireEvent.click(screen.getByText("SMILE"));
    fireEvent.click(screen.getByTestId("games-complete-round"));
    expect(screen.getByText("Round complete")).toBeInTheDocument();

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
