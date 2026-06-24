import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n";
import BreathGarden, {
  bloomLevelForMetrics,
  computeBreathGardenMetrics,
  getDefaultBreathGardenUserState,
  nextBreathTap,
} from "./BreathGarden";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
}));

function stateResponse(overrides = {}) {
  return new Response(JSON.stringify({
    state: {
      ...getDefaultBreathGardenUserState("user-1"),
      total_sessions: 1,
      preferred_theme: "garden",
      ...overrides,
    },
  }), { status: 200 });
}

function sessionResponse(overrides = {}) {
  return new Response(JSON.stringify({
    session: { id: "session-1" },
    state: {
      ...getDefaultBreathGardenUserState("user-1"),
      total_sessions: 2,
      streak_days: 1,
      preferred_theme: "garden",
      ...overrides,
    },
  }), { status: 201 });
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("BreathGarden helpers", () => {
  it("alternates inhale and exhale tap phases", () => {
    const first = nextBreathTap([], 1000);
    const second = nextBreathTap([first], 2500);
    const third = nextBreathTap([first, second], 4200);

    expect([first.phase, second.phase, third.phase]).toEqual(["inhale_peak", "exhale_peak", "inhale_peak"]);
  });

  it("turns calm, steady cycles into a fuller bloom", () => {
    const metrics = computeBreathGardenMetrics([
      { timestamp_ms: 0, phase: "inhale_peak" },
      { timestamp_ms: 5000, phase: "exhale_peak" },
      { timestamp_ms: 10000, phase: "inhale_peak" },
      { timestamp_ms: 15000, phase: "exhale_peak" },
      { timestamp_ms: 20000, phase: "inhale_peak" },
      { timestamp_ms: 25000, phase: "exhale_peak" },
    ], 25);

    expect(metrics.breathCycleCount).toBe(4);
    expect(bloomLevelForMetrics(metrics)).toBe(5);
  });
});

describe("BreathGarden component", () => {
  beforeEach(() => {
    setLanguage("en");
    apiFetchMock.mockReset();
    window.localStorage.clear();
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(6000)
      .mockReturnValueOnce(11000)
      .mockReturnValueOnce(16000)
      .mockReturnValue(21000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the theme picker on local first play and starts after a theme is chosen", async () => {
    render(<BreathGarden userId="" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Choose your garden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tide" }));

    expect(screen.getByText("Tap gently as you breathe.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I understand" }));

    expect(screen.getByRole("heading", { name: "Breath Garden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(screen.getByRole("button", { name: "Tap as you inhale... and exhale" })).toBeInTheDocument();
  });

  it("remembers the tutorial and reopens it from Instructions", async () => {
    const { unmount } = render(<BreathGarden userId="" onExit={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Choose your garden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Garden" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(window.localStorage.getItem("breathGarden:tutorialSeen:v1")).toBe("true");
    expect(screen.getByRole("button", { name: /Instructions/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Instructions/i }));
    expect(screen.getByText("Tap gently as you breathe.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "I understand" }));
    unmount();

    render(<BreathGarden userId="" onExit={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Choose your garden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Garden" }));

    expect(screen.queryByText("Tap gently as you breathe.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("saves a completed session with alternating breath taps", async () => {
    window.localStorage.setItem("breathGarden:tutorialSeen:v1:user-1", "true");
    apiFetchMock
      .mockResolvedValueOnce(stateResponse())
      .mockResolvedValueOnce(sessionResponse());

    render(<BreathGarden userId="user-1" onExit={vi.fn()} />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const tapButton = screen.getByRole("button", { name: "Tap as you inhale... and exhale" });
    fireEvent.click(tapButton);
    fireEvent.click(tapButton);
    fireEvent.click(screen.getByRole("button", { name: "Finish" }));
    await flushPromises();

    expect(await screen.findByRole("heading", { name: "Today's garden" })).toBeInTheDocument();

    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/breath-garden/sessions");
    expect(sessionCall?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      breathTaps: [
        expect.objectContaining({ phase: "inhale_peak" }),
        expect.objectContaining({ phase: "exhale_peak" }),
      ],
      gardenTheme: "garden",
      completed: true,
      abandoned: false,
    });
  });

  it("saves an abandoned exit while playing", async () => {
    const onExit = vi.fn();
    window.localStorage.setItem("breathGarden:tutorialSeen:v1:user-1", "true");
    apiFetchMock
      .mockResolvedValueOnce(stateResponse())
      .mockResolvedValueOnce(sessionResponse());

    render(<BreathGarden userId="user-1" onExit={onExit} />);
    await flushPromises();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    await flushPromises();

    const sessionCall = apiFetchMock.mock.calls.find(([url]) => url === "/api/games/breath-garden/sessions");
    expect(JSON.parse(String(sessionCall?.[1]?.body))).toMatchObject({
      completed: false,
      abandoned: true,
    });
    expect(onExit).toHaveBeenCalled();
  });
});
