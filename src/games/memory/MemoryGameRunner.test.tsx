import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { getGameHistory, saveGameResult } from "./gameStorage";
import type { GameResult } from "./types";
import MemoryGameRunner from "./MemoryGameRunner";

const mocks = vi.hoisted(() => ({
  speakSequence: vi.fn(),
  stopTts: vi.fn(),
  startListening: vi.fn(() => false),
  stopListening: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useTtsReadout: () => ({
    speakSequence: mocks.speakSequence,
    stopTts: mocks.stopTts,
    isTtsSpeaking: false,
  }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("./useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: false,
    isListening: false,
    startListening: mocks.startListening,
    stopListening: mocks.stopListening,
  }),
}));

vi.mock("./gameStorage", async () => {
  const actual = await vi.importActual<typeof import("./gameStorage")>("./gameStorage");
  return {
    ...actual,
    getGameHistory: vi.fn(),
    saveGameResult: vi.fn(),
  };
});

function renderMemoryGame(initialEntry: string) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/memory-games/:gameType" element={<MemoryGameRunner />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWordRecall() {
  return renderMemoryGame("/memory-games/word_recall?level=1&variant=word_recall-l1-v1");
}

function renderRhythmTap() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/attention-boosters/rhythm-tap?level=1&variant=sequence_memory-l1-v1"]}>
      <Routes>
        <Route
          path="/attention-boosters/rhythm-tap"
          element={<MemoryGameRunner forcedGameType="sequence_memory" returnPath="/attention-boosters" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function visualResult(minutesAgo: number): GameResult {
  return {
    userId: "user-1",
    gameType: "memory_match",
    cognitiveDomain: "visual_memory",
    variantId: `memory_match-l1-v${minutesAgo + 2}`,
    level: 1,
    score: 500,
    accuracy: 100,
    mistakes: 0,
    durationSeconds: 20,
    completedAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    language: "en",
  };
}

async function completeLevelOneVisualMemoryBoard() {
  const cards = await screen.findAllByTestId("visual-memory-card");

  fireEvent.click(cards[0]);
  fireEvent.click(cards[5]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
  fireEvent.click(cards[1]);
  fireEvent.click(cards[2]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
  fireEvent.click(cards[3]);
  fireEvent.click(cards[4]);
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 500));
  });
}

describe("MemoryGameRunner word recall", () => {
  beforeEach(() => {
    setLanguage("en");
    mocks.speakSequence.mockClear();
    mocks.stopTts.mockClear();
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    vi.mocked(saveGameResult).mockReset();
    vi.mocked(saveGameResult).mockReturnValue(new Promise<void>(() => undefined));
    vi.mocked(getGameHistory).mockReset();
    vi.mocked(getGameHistory).mockResolvedValue([]);
    vi.spyOn(Math, "random").mockReturnValue(0);
    window.scrollTo = vi.fn();
    window.localStorage.clear();
  });

  it("keeps the next-level action available when result persistence is still pending", async () => {
    renderWordRecall();

    fireEvent.click(await screen.findByRole("button", { name: /hide words/i }));
    fireEvent.click(await screen.findByRole("button", { name: "bread" }));
    fireEvent.click(await screen.findByRole("button", { name: "milk" }));
    fireEvent.click(await screen.findByRole("button", { name: "cheese" }));

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);

    expect(await screen.findByText("Well done")).toBeInTheDocument();
    expect(screen.getByText(/building the base/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to Level 2" })).not.toBeDisabled();
    expect(saveGameResult).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      gameType: "word_recall",
      cognitiveDomain: "episodic_memory",
      variantId: "word_recall-l1-v1",
      language: "en",
    }));
  });

  it("uses fewer Association choices in Foundation and more in Challenge", async () => {
    const { unmount } = renderMemoryGame("/memory-games/association_memory?level=1&variant=association_memory-l1-v1");

    expect(await screen.findByText("Remember one link.")).toBeInTheDocument();
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText("fruit")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ready to choose" }));

    expect(await screen.findByText("What matches this?")).toBeInTheDocument();
    expect(screen.getAllByTestId("association-choice")).toHaveLength(2);

    unmount();
    renderMemoryGame("/memory-games/association_memory?level=11&variant=association_memory-l11-v1");

    expect(await screen.findByText("Level 11 - Challenge")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ready to choose" }));

    expect(await screen.findByText("What matches this?")).toBeInTheDocument();
    expect(screen.getAllByTestId("association-choice")).toHaveLength(4);
  });

  it("shows Number Memory order and level mode before recall", async () => {
    renderMemoryGame("/memory-games/number_memory?level=6&variant=number_memory-l6-v1");

    expect(await screen.findByText("Level 6 - Build")).toBeInTheDocument();
    expect(screen.getByText("Reverse order")).toBeInTheDocument();
    expect(screen.getByText("4 digits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide digits" }));

    expect(await screen.findByLabelText("Type the digits in reverse")).toBeInTheDocument();
  });

  it("shows Rhythm Tap instructions once and reopens them from the icon", async () => {
    setLanguage("en");
    renderRhythmTap();

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(window.localStorage.getItem("sequenceMemory:tutorialSeen:v1:user-1")).toBe("true");
    expect(await screen.findByRole("button", { name: "Instructions" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Instructions" }));

    expect(await screen.findByRole("heading", { name: "How it works" })).toBeInTheDocument();
  });

  it("shows Visual Memory instructions once at Level 1 and reopens them on request", async () => {
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    expect(await screen.findByRole("heading", { name: "Find the pairs" })).toBeInTheDocument();
    expect(screen.getByText("Different pictures? Both cards turn back. Try another pair.")).toBeInTheDocument();
    expect(screen.getByText("Find all 3 pairs to finish. There is no timer.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Do not show these instructions again." })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Start Level 1" }));

    expect(window.localStorage.getItem("visualMemory:tutorialSeen:v1:user-1")).toBe("true");
    fireEvent.click(await screen.findByRole("button", { name: "Instructions" }));
    expect(await screen.findByRole("heading", { name: "Find the pairs" })).toBeInTheDocument();
  });

  it("starts Visual Memory above Level 1 without repeating basic instructions", async () => {
    renderMemoryGame("/memory-games/memory_match?level=2&variant=memory_match-l2-v1");

    expect(await screen.findByRole("heading", { name: /Visual memory/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Find the pairs" })).not.toBeInTheDocument();
    expect(screen.queryByText("Tap two cards to find the pair.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Instructions" })).toBeInTheDocument();
  });

  it("shows Next round and Play Again while Visual Memory level progress is still building", async () => {
    window.localStorage.setItem("visualMemory:tutorialSeen:v1:user-1", "true");
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    await completeLevelOneVisualMemoryBoard();

    expect(await screen.findByRole("dialog")).toHaveTextContent("1/3");
    expect(screen.getByRole("button", { name: "Next round" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next Level/i })).not.toBeInTheDocument();
  });

  it("offers Next Level, Next round, and Play Again after three strong Visual Memory rounds", async () => {
    window.localStorage.setItem("visualMemory:tutorialSeen:v1:user-1", "true");
    vi.mocked(getGameHistory).mockResolvedValue([visualResult(0), visualResult(1)]);
    renderMemoryGame("/memory-games/memory_match?level=1&variant=memory_match-l1-v1");

    await completeLevelOneVisualMemoryBoard();

    expect(await screen.findByRole("dialog")).toHaveTextContent("3/3");
    expect(screen.getByRole("button", { name: "Next Level 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next round" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeInTheDocument();
  });
});
