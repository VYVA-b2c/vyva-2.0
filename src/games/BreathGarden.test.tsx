import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import BreathGarden, { buildGuidedBreathResult, getDefaultBreathGardenUserState, getGuidedBreathPhase, getGuidedCycleCount } from "./BreathGarden";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiFetch: apiFetchMock }));

function stateResponse(overrides = {}) {
  return new Response(JSON.stringify({
    state: { ...getDefaultBreathGardenUserState("user-1"), total_sessions: 1, preferred_duration_seconds: 120, ...overrides },
  }), { status: 200 });
}

function sessionResponse(overrides = {}) {
  return new Response(JSON.stringify({
    session: { id: "session-1" },
    state: { ...getDefaultBreathGardenUserState("user-1"), total_sessions: 2, preferred_duration_seconds: 120, ...overrides },
  }), { status: 201 });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("BreathGarden guided rhythm", () => {
  it("uses four seconds in and six seconds out", () => {
    expect(getGuidedBreathPhase(0).phase).toBe("inhale");
    expect(getGuidedBreathPhase(3999).phase).toBe("inhale");
    expect(getGuidedBreathPhase(4000).phase).toBe("exhale");
    expect(getGuidedBreathPhase(9999).phase).toBe("exhale");
    expect(getGuidedBreathPhase(10000).phase).toBe("inhale");
    expect(getGuidedCycleCount(59)).toBe(5);
    expect(getGuidedCycleCount(60)).toBe(6);
  });

  it("builds a guided session without inferred performance measurements", () => {
    expect(buildGuidedBreathResult({ reason: "finished_early", durationSeconds: 12, targetDurationSeconds: 60, language: "en" })).toMatchObject({
      breathTaps: [], breathCycleCount: 0, avgBreathCycleSeconds: null, breathConsistencyIndex: null,
      finalPaceBreathsPerMin: null, gardenTheme: "garden", targetDurationSeconds: 60,
      guidedCycleCount: 1, guidedPatternId: "gentle_4_6", completionReason: "finished_early",
      completed: true, abandoned: false,
    });
  });
});

describe("BreathGarden component", { timeout: 60_000 }, () => {
  beforeEach(() => {
    setLanguage("en");
    apiFetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with one garden and a two-minute recommendation", async () => {
    render(<BreathGarden userId="" onExit={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "A quiet moment to breathe" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /2 minutes/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /1 minute/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /5 minutes/i })).toBeInTheDocument();
    expect(screen.queryByText("Choose your garden")).not.toBeInTheDocument();
    expect(screen.queryByText(/Tap as you/i)).not.toBeInTheDocument();
  });

  it("moves automatically from inhale to exhale and pauses without advancing", async () => {
    render(<BreathGarden userId="" onExit={vi.fn()} />);
    await screen.findByRole("heading", { name: "A quiet moment to breathe" });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T10:00:00Z"));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(screen.getByText("Breathe in")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(4100));
    expect(screen.getByText("Breathe out")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(screen.getByText("Paused")).toBeInTheDocument();
    const timeBefore = screen.getByText(/^1:/).textContent;
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.getByText(/^1:/).textContent).toBe(timeBefore);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.getByText("Breathe out")).toBeInTheDocument();
  });

  it("remembers the selected duration returned by the account state", async () => {
    apiFetchMock.mockResolvedValueOnce(stateResponse({ preferred_duration_seconds: 300 }));
    render(<BreathGarden userId="user-1" onExit={vi.fn()} />);
    await flushPromises();
    expect(screen.getByRole("button", { name: /5 minutes/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers a minimal completion after an early finish", async () => {
    render(<BreathGarden userId="" onExit={vi.fn()} />);
    await screen.findByRole("heading", { name: "A quiet moment to breathe" });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Finish" })); });
    expect(screen.getByRole("heading", { name: "Breathing complete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Breathe again" })).toBeInTheDocument();
  });

  it("completes automatically when the selected time ends", async () => {
    apiFetchMock.mockResolvedValueOnce(stateResponse()).mockResolvedValueOnce(sessionResponse());
    render(<BreathGarden userId="user-1" onExit={vi.fn()} />);
    await flushPromises();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T10:00:00Z"));
    fireEvent.click(screen.getByRole("button", { name: /1 minute/i }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await act(async () => {
      vi.advanceTimersByTime(60000);
      await Promise.resolve();
    });
    await flushPromises();
    expect(screen.getByRole("heading", { name: "Breathing complete" })).toBeInTheDocument();
    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/breath-garden/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({ targetDurationSeconds: 60, guidedCycleCount: 6, completionReason: "timer_complete" });
  });

  it("records a header exit as abandoned", async () => {
    const onExit = vi.fn();
    apiFetchMock.mockResolvedValueOnce(stateResponse()).mockResolvedValueOnce(sessionResponse());
    render(<BreathGarden userId="user-1" onExit={onExit} />);
    await flushPromises();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-05T10:00:00Z"));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    act(() => vi.advanceTimersByTime(3500));
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await flushPromises();
    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/breath-garden/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({ completionReason: "exited", completed: false, abandoned: true });
    expect(onExit).toHaveBeenCalled();
  });
});
