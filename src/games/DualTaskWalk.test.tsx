import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import DualTaskWalk, { isGreatDualTaskResult } from "./DualTaskWalk";

const gameDataMock = vi.hoisted(() => {
  const query: Record<string, unknown> = {
    data: [],
    error: null,
  };

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.gte = vi.fn(() => query);
  query.insert = vi.fn(() => query);
  query.upsert = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  query.single = vi.fn(async () => ({ data: null, error: null }));

  return {
    from: vi.fn(() => query),
  };
});

vi.mock("./shared/gameDataApi", () => ({
  gameData: {
    table: gameDataMock.from,
  },
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn(),
}));

describe("DualTaskWalk", () => {
  beforeEach(() => {
    setLanguage("en");
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  it("opens on the canonical intro with one clear start action", async () => {
    render(<DualTaskWalk userId="" onExit={vi.fn()} />);

    expect(await screen.findByTestId("dual-task-intro")).toBeInTheDocument();
    expect(screen.getByTestId("dual-task-walk-flow-shell").querySelector("h1")).toHaveTextContent("Dual Task");
    expect(screen.getByRole("button", { name: "Start exercise" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "How it works" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Instructions" })).not.toBeInTheDocument();
  });

  it("uses task accuracy for the praise tone instead of raw points", () => {
    expect(isGreatDualTaskResult({
      serial7s_accuracy_pct: 100,
      tap_accuracy_pct: 100,
      dual_task_score: 500,
    })).toBe(true);
    expect(isGreatDualTaskResult({
      serial7s_accuracy_pct: 67,
      tap_accuracy_pct: 75,
      dual_task_score: 710,
    })).toBe(false);
  });
});
