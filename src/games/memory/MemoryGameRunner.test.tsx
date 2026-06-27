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

function renderWordRecall() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/memory-games/word_recall?level=1&variant=word_recall-l1-v1"]}>
      <Routes>
        <Route path="/memory-games/:gameType" element={<MemoryGameRunner />} />
      </Routes>
    </MemoryRouter>,
  );
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
    setLanguage("fr");
    mocks.speakSequence.mockClear();
    mocks.stopTts.mockClear();
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    vi.mocked(saveGameResult).mockReset();
    vi.mocked(saveGameResult).mockReturnValue(new Promise<void>(() => undefined));
    window.scrollTo = vi.fn();
    window.localStorage.clear();
  });

  it("advances after Continue even when result persistence is still pending", async () => {
    renderWordRecall();

    fireEvent.click(await screen.findByRole("button", { name: /je suis pret/i }));
    fireEvent.click(await screen.findByRole("button", { name: "pain" }));

    const continueButton = screen.getByRole("button", { name: "Continuer" });
    expect(continueButton).not.toBeDisabled();

    fireEvent.click(continueButton);

    expect(await screen.findByText("Tres bien")).toBeInTheDocument();
    expect(screen.getByText("Vous avez termine cet exercice")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuer" })).not.toBeDisabled();
    expect(saveGameResult).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      gameType: "word_recall",
      cognitiveDomain: "episodic_memory",
      variantId: "word_recall-l1-v1",
      language: "fr",
    }));
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
