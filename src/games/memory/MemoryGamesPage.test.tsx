import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import MemoryGamesPage from "./MemoryGamesPage";
import type { Recommendation } from "./types";

const mocks = vi.hoisted(() => ({
  getGameHistory: vi.fn(),
  selectNextMemoryGame: vi.fn(),
  selectGamePlan: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("./gameStorage", () => ({
  getGameHistory: mocks.getGameHistory,
}));

vi.mock("./progressionEngine", () => ({
  getRecommendedLevelForGame: () => 1,
  selectGamePlan: mocks.selectGamePlan,
  selectNextMemoryGame: mocks.selectNextMemoryGame,
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <MemoryGamesPage />
    </MemoryRouter>,
  );
}

describe("MemoryGamesPage", () => {
  beforeEach(() => {
    setLanguage("en");
    mocks.getGameHistory.mockReset();
    mocks.selectNextMemoryGame.mockReset();
    mocks.selectGamePlan.mockReset();
    mocks.getGameHistory.mockResolvedValue([]);
    mocks.selectGamePlan.mockImplementation((_userId: string, gameType: Recommendation["gameType"]) =>
      Promise.resolve({ gameType, level: 1, variantId: `${gameType}-l1-v1` }),
    );
  });

  it("waits for the recommendation before showing the alternate exercise cards", async () => {
    let resolveRecommendation: (recommendation: Recommendation) => void = () => undefined;
    const recommendationPromise = new Promise<Recommendation>((resolve) => {
      resolveRecommendation = resolve;
    });
    mocks.selectNextMemoryGame.mockReturnValue(recommendationPromise);

    renderPage();

    expect(screen.queryByText("Choose another exercise")).not.toBeInTheDocument();

    resolveRecommendation({
      gameType: "memory_match",
      level: 1,
      variantId: "memory_match-l1-v1",
      reason: "recommended",
    });

    const heading = await screen.findByText("Choose another exercise");
    const choices = heading.closest("section");
    expect(choices).not.toBeNull();

    expect(within(choices as HTMLElement).queryByText("Visual memory")).not.toBeInTheDocument();
    expect(within(choices as HTMLElement).queryByText("Curious Minds")).not.toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Remember Later")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Association")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Recall words")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Short stories")).toBeInTheDocument();
    expect(within(choices as HTMLElement).getByText("Number memory")).toBeInTheDocument();
  });
});
