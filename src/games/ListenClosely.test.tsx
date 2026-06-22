import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListenClosely from "./ListenClosely";

const translate = (_key: string, fallback?: string) => fallback ?? _key;

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: translate,
  }),
}));

vi.mock("./shared/brainCoachSessions", () => ({
  recordCognitiveSession: vi.fn(async () => ({ persisted: false })),
}));

describe("Listen Closely", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the senior-friendly intro and starts the listening screen", async () => {
    const onExit = vi.fn();
    render(<ListenClosely userId="" onExit={onExit} />);

    expect(await screen.findByRole("heading", { name: "Listen Closely" })).toBeInTheDocument();
    expect(screen.getByText("A gentle sound game for calm focus.")).toBeInTheDocument();
    expect(screen.getByText("Listen for")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toHaveClass("min-h-[72px]");

    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(
      await screen.findByText(/Tap when you hear it\.|Just listen\./),
    ).toBeInTheDocument();
  });

  it("exits through the provided callback from the intro", async () => {
    const onExit = vi.fn();
    render(<ListenClosely userId="" onExit={onExit} />);

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
