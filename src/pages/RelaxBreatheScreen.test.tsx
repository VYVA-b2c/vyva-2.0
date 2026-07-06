import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RelaxBreatheScreen from "./RelaxBreatheScreen";

const voiceMock = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
  sendContextUpdate: vi.fn(),
  status: "idle" as "idle" | "connecting" | "connected",
}));

const labels: Record<string, string> = {
  "activities.relaxBreathe.title": "Relax & Breathe",
  "activities.relaxBreathe.intro": "A guided calm pause. Tap once and VYVA leads you.",
  "activities.relaxBreathe.backToMindMemory": "Back to Mind & Memory",
  "activities.relaxBreathe.duration": "Guided breathing",
  "activities.relaxBreathe.modeLabel": "Guide mode",
  "activities.relaxBreathe.visualMode": "App",
  "activities.relaxBreathe.voiceMode": "Voice",
  "activities.relaxBreathe.visualModeTitle": "App guide",
  "activities.relaxBreathe.visualModeBody": "The app moves through each breath for you.",
  "activities.relaxBreathe.voiceModeTitle": "Voice guide",
  "activities.relaxBreathe.voiceModeBody": "Marco can talk you through the breathing session.",
  "activities.relaxBreathe.stepLabel": "Phase",
  "activities.relaxBreathe.ofLabel": "of",
  "activities.relaxBreathe.levelLabel": "Level",
  "activities.relaxBreathe.chooseLevel": "Choose a level",
  "activities.relaxBreathe.breatheIn": "Breathe in",
  "activities.relaxBreathe.breatheOut": "Breathe out",
  "activities.relaxBreathe.safety": "If breathing feels difficult, painful, or unusual, stop and seek help.",
  "activities.relaxBreathe.startGuide": "Start guide",
  "activities.relaxBreathe.pauseSession": "Pause",
  "activities.relaxBreathe.resumeSession": "Resume",
  "activities.relaxBreathe.endSession": "End",
  "activities.relaxBreathe.guideStarting": "Starting...",
  "activities.relaxBreathe.guideLive": "Voice guide is live",
  "activities.relaxBreathe.voiceRetry": "Voice was not available. The app guide is still running.",
  "activities.relaxBreathe.replay": "Repeat voice cue",
  "activities.relaxBreathe.completeTitle": "A calm pause is complete.",
  "activities.relaxBreathe.completeBody": "You can come back to this whenever you want a quieter moment.",
  "activities.relaxBreathe.tryAgain": "Try again",
  "activities.relaxBreathe.audioUnavailable": "The app guide still works without audio.",
  "activities.relaxBreathe.routineTitle": "Your calm routine",
  "activities.relaxBreathe.routineStart": "First pause today",
  "activities.relaxBreathe.routineDoneToday": "Done today",
  "activities.relaxBreathe.routineCountOne": "{n} calm pause",
  "activities.relaxBreathe.routineCountMany": "{n} calm pauses",
  "activities.relaxBreathe.routineStreak": "{n} day streak",
  "activities.relaxBreathe.motionPause": "Pause motion",
  "activities.relaxBreathe.motionResume": "Resume motion",
  "activities.relaxBreathe.motionSystemPaused": "Motion paused",
  "activities.relaxBreathe.nowLabel": "Now",
  "activities.relaxBreathe.notStartedLabel": "Ready",
  "activities.relaxBreathe.runningLabel": "Guiding",
  "activities.relaxBreathe.pausedLabel": "Paused",
  "activities.relaxBreathe.timeLeft": "{n}s left",
  "activities.relaxBreathe.sessionProgress": "{n}% complete",
  "activities.relaxBreathe.levels.easy.title": "Easy",
  "activities.relaxBreathe.levels.easy.summary": "Simple in and out breathing.",
  "activities.relaxBreathe.levels.easy.duration": "About 1 minute",
  "activities.relaxBreathe.levels.steady.title": "Steady",
  "activities.relaxBreathe.levels.steady.summary": "A slightly longer breath out.",
  "activities.relaxBreathe.levels.steady.duration": "About 1 minute",
  "activities.relaxBreathe.levels.deeper.title": "Deeper",
  "activities.relaxBreathe.levels.deeper.summary": "Adds a tiny comfortable pause.",
  "activities.relaxBreathe.levels.deeper.duration": "About 1 minute",
  "activities.relaxBreathe.phases.settle.title": "Settle",
  "activities.relaxBreathe.phases.settle.instruction": "Sit comfortably. Let your shoulders soften.",
  "activities.relaxBreathe.phases.settle.cue": "Find a comfortable seat.",
  "activities.relaxBreathe.phases.inhale.title": "Breathe in",
  "activities.relaxBreathe.phases.inhale.instruction": "Breathe in gently as the circle grows.",
  "activities.relaxBreathe.phases.inhale.cue": "Easy breath in.",
  "activities.relaxBreathe.phases.exhale.title": "Breathe out",
  "activities.relaxBreathe.phases.exhale.instruction": "Let the breath out slowly as the circle settles.",
  "activities.relaxBreathe.phases.exhale.cue": "Soft breath out.",
  "activities.relaxBreathe.phases.longExhale.title": "Long breath out",
  "activities.relaxBreathe.phases.longExhale.instruction": "Breathe out a little longer, only while it feels comfortable.",
  "activities.relaxBreathe.phases.longExhale.cue": "Longer breath out.",
  "activities.relaxBreathe.phases.softPause.title": "Soft pause",
  "activities.relaxBreathe.phases.softPause.instruction": "Rest for a moment. Skip the pause if it does not feel good.",
  "activities.relaxBreathe.phases.softPause.cue": "Tiny resting pause.",
  "activities.relaxBreathe.phases.return.title": "Return gently",
  "activities.relaxBreathe.phases.return.instruction": "Notice the chair, the room, and one calm breath.",
  "activities.relaxBreathe.phases.return.cue": "Come back to the room gently.",
};

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (key: string, fallback?: string, params?: Record<string, string | number>) => {
      const value = labels[key] ?? fallback ?? key;
      if (!params) return value;
      return Object.entries(params).reduce(
        (text, [paramKey, paramValue]) => text.replaceAll(`{${paramKey}}`, String(paramValue)),
        value,
      );
    },
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: voiceMock.startVoice,
    stopVoice: voiceMock.stopVoice,
    sendText: voiceMock.sendText,
    sendContextUpdate: voiceMock.sendContextUpdate,
    status: voiceMock.status,
    isConnecting: false,
    lastError: null,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function mockReducedMotion(matches: boolean) {
  const mediaQuery = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(mediaQuery));
}

function renderRelaxBreathe() {
  return render(
    <MemoryRouter initialEntries={["/activities/relax-breathe"]}>
      <Routes>
        <Route path="/activities/relax-breathe" element={<RelaxBreatheScreen />} />
        <Route path="/mind-memory" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RelaxBreatheScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    voiceMock.status = "idle";
    voiceMock.startVoice.mockResolvedValue(undefined);
    mockReducedMotion(false);
    vi.stubGlobal("fetch", vi.fn());
    window.localStorage.removeItem("vyva_relax_breathe_progress");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a guided breathing session with levels and one-tap start", () => {
    renderRelaxBreathe();

    expect(screen.getByRole("heading", { name: "Relax & Breathe" })).toBeInTheDocument();
    expect(screen.getByTestId("relax-breathe-visual")).toBeInTheDocument();
    expect(screen.getByTestId("relax-breathe-orb")).toHaveTextContent("Settle");
    expect(screen.getByTestId("relax-breathe-safety")).toHaveTextContent("If breathing feels difficult");
    expect(screen.getByTestId("button-relax-breathe-mode-visual")).toHaveTextContent("App");
    expect(screen.getByTestId("relax-breathe-routine")).toHaveTextContent("First pause today");
    expect(screen.getByTestId("button-relax-breathe-motion-toggle")).toHaveTextContent("Pause motion");
    expect(screen.getByTestId("relax-breathe-mobile-focus")).toHaveTextContent("Ready");
    expect(screen.getByTestId("relax-breathe-visual-mode-panel")).toHaveTextContent("The app moves through each breath");
    expect(within(screen.getByTestId("relax-breathe-levels")).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-relax-breathe-start")).toHaveTextContent("Start guide");
    expect(screen.queryByTestId("button-relax-breathe-stage-next")).not.toBeInTheDocument();
  });

  it("lets the user choose a harder breathing level before starting", () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-level-deeper"));

    expect(screen.getByTestId("button-relax-breathe-level-deeper")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Level 3: Deeper")).toBeInTheDocument();
  });

  it("starts once and advances phases automatically", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-start"));

    expect(screen.getByTestId("relax-breathe-mobile-focus")).toHaveTextContent("Guiding");
    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Sit comfortably");

    await waitFor(() => expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Breathe in gently"));

    await waitFor(() => expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Let the breath out slowly"));
  });

  it("pauses and resumes the automatic guide", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-start"));
    fireEvent.click(screen.getByTestId("button-relax-breathe-pause"));
    expect(screen.getByTestId("button-relax-breathe-pause")).toHaveTextContent("Resume");

    await new Promise((resolve) => window.setTimeout(resolve, 160));
    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Sit comfortably");

    fireEvent.click(screen.getByTestId("button-relax-breathe-pause"));
    await waitFor(() => expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Breathe in gently"));
  });

  it("completes automatically and records the calm routine", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-start"));

    await waitFor(
      () => expect(screen.getByTestId("relax-breathe-complete")).toHaveTextContent("A calm pause is complete."),
      { timeout: 3000 },
    );
    expect(screen.getByTestId("relax-breathe-progress-summary")).toHaveTextContent("1 calm pause");
    expect(screen.getByTestId("relax-breathe-progress-summary")).toHaveTextContent("Done today");
    expect(window.localStorage.getItem("vyva_relax_breathe_progress")).toContain('"totalSessions":1');
    expect(window.localStorage.getItem("vyva_relax_breathe_progress")).toContain('"lastCompletedLevel":"easy"');
  });

  it("starts voice guidance only after Start is tapped", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));
    await waitFor(() => expect(screen.getByTestId("button-relax-breathe-mode-voice")).toHaveAttribute("aria-pressed", "true"));
    expect(voiceMock.startVoice).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("button-relax-breathe-start"));

    expect(voiceMock.startVoice).toHaveBeenCalledTimes(1);
    expect(voiceMock.startVoice.mock.calls[0][0]).toContain("Selected level 1: Easy");
    expect(voiceMock.startVoice.mock.calls[0][2]).toMatchObject({
      agentSlug: "marco-reyes",
      dynamicVariables: expect.objectContaining({
        level_key: "easy",
        phase_key: "settle",
      }),
    });
    await waitFor(() => expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("do not ask the user to tap next"),
      { invisibleInTranscript: true },
    ));
  });

  it("sends the next voice cue when the app advances phases", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));
    await waitFor(() => expect(screen.getByTestId("button-relax-breathe-mode-voice")).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(screen.getByTestId("button-relax-breathe-start"));
    expect(voiceMock.startVoice).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Current phase 2"),
      { invisibleInTranscript: true },
    ));
  });

  it("lets the user pause breathing motion and remembers the choice", () => {
    renderRelaxBreathe();

    expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "animated");

    fireEvent.click(screen.getByTestId("button-relax-breathe-motion-toggle"));

    expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "static");
    expect(screen.getByTestId("button-relax-breathe-motion-toggle")).toHaveTextContent("Resume motion");
    expect(window.localStorage.getItem("vyva_relax_breathe_progress")).toContain('"motionPaused":true');
  });

  it("uses static motion when reduced motion is preferred", async () => {
    mockReducedMotion(true);
    renderRelaxBreathe();

    await waitFor(() => expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "static"));
    expect(screen.getByTestId("button-relax-breathe-motion-toggle")).toHaveTextContent("Motion paused");
  });

  it("returns to Mind & Memory and stops voice", () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-back-mind-memory"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory");
    expect(voiceMock.stopVoice).toHaveBeenCalled();
  });
});
