import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import { saveGameResult } from "./gameStorage";
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

describe("MemoryGameRunner word recall", () => {
  beforeEach(() => {
    setLanguage("en");
    mocks.speakSequence.mockClear();
    mocks.stopTts.mockClear();
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    vi.mocked(saveGameResult).mockReset();
    vi.mocked(saveGameResult).mockReturnValue(new Promise<void>(() => undefined));
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
});
