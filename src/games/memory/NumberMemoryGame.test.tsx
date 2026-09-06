import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNumberMemoryLevels, getNumberMemoryExpectedAnswer, type NumberMemoryPayload } from "./numberMemoryData";
import NumberMemoryGame from "./NumberMemoryGame";
import { saveGameResult } from "./gameStorage";

vi.mock("./gameStorage", () => ({ saveGameResult: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/hooks/useHomeMasterTheme", () => ({ useHomeMasterTheme: () => ({ isDark: false }) }));

const level = buildNumberMemoryLevels()[0];
const variant = level.variants[0];
const content = variant.content.en!;
const payload = content.payload as unknown as NumberMemoryPayload;

function renderGame(onVoiceContextChange = vi.fn()) {
  return render(
    <NumberMemoryGame
      plan={{ gameType: "number_memory", level: 1, variantId: variant.id, reasonLabel: "" }}
      localizedVariant={content}
      cognitiveDomain="working_memory"
      userId="user-1"
      language="en"
      onBack={vi.fn()}
      onOpenSameGame={vi.fn()}
      actionLoading={null}
      onVoiceContextChange={onVoiceContextChange}
    />,
  );
}

async function showWholeRound(roundIndex: number) {
  fireEvent.click(screen.getByRole("button", { name: "Show numbers" }));
  act(() => { vi.advanceTimersByTime(700); });
  for (let index = 0; index < payload.rounds[roundIndex].digits.length; index += 1) {
    act(() => { vi.advanceTimersByTime(payload.rounds[roundIndex].presentationMsPerDigit); });
  }
  expect(screen.getByRole("heading", { name: "Enter your answer" })).toBeInTheDocument();
}

describe("NumberMemoryGame", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(saveGameResult).mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows first-use guidance, then presents one digit at a time", () => {
    renderGame();
    expect(screen.getByRole("heading", { name: "Same order" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Round 1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show numbers" }));
    expect(screen.getByText("Ready")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.getByText(payload.rounds[0].digits[0])).toBeInTheDocument();
    expect(screen.queryByText(payload.rounds[0].digits)).not.toBeInTheDocument();
  });

  it("cancels an interrupted presentation without scoring it", () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    renderGame();
    fireEvent.click(screen.getByRole("button", { name: "Show numbers" }));
    act(() => { vi.advanceTimersByTime(700); });
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("button", { name: "Show numbers" })).toBeInTheDocument();
    expect(saveGameResult).not.toHaveBeenCalled();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("supports three rounds, keyboard recall, deferred review, and safe metadata", async () => {
    window.localStorage.setItem("numberMemory:guidance:v2:user-1:forward", "true");
    const voice = vi.fn();
    renderGame(voice);

    for (let roundIndex = 0; roundIndex < 3; roundIndex += 1) {
      await showWholeRound(roundIndex);
      const expected = getNumberMemoryExpectedAnswer(payload.rounds[roundIndex]);
      expected.split("").forEach((digit) => fireEvent.keyDown(window, { key: digit }));
      fireEvent.keyDown(window, { key: "Enter" });
      if (roundIndex < 2) expect(screen.getByRole("button", { name: "Show numbers" })).toBeInTheDocument();
    }

    expect(screen.getByText("3/3 exact rounds")).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(saveGameResult).toHaveBeenCalledTimes(1);
    const saved = vi.mocked(saveGameResult).mock.calls[0][0];
    expect(saved).toMatchObject({ score: 100, accuracy: 100, mistakes: 0 });
    expect(saved.metadata).toMatchObject({ roundVersion: "number_memory_v2", roundCount: 3, exactRoundCount: 3, levelPassed: true });
    expect(JSON.stringify(saved.metadata)).not.toContain(payload.rounds[0].digits);
    expect(voice).toHaveBeenCalledWith(expect.objectContaining({ activity: "number_memory", level: 1 }));
  });
});
