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
  "activities.relaxBreathe.intro": "A quiet pause for your body and mind.",
  "activities.relaxBreathe.backToMindMemory": "Back to Mind & Memory",
  "activities.relaxBreathe.duration": "3 gentle steps",
  "activities.relaxBreathe.modeLabel": "Guide mode",
  "activities.relaxBreathe.visualMode": "Visual",
  "activities.relaxBreathe.voiceMode": "Voice",
  "activities.relaxBreathe.visualModeTitle": "Visual mode",
  "activities.relaxBreathe.visualModeBody": "Follow the breathing circle quietly at your own pace.",
  "activities.relaxBreathe.voiceModeTitle": "Voice mode",
  "activities.relaxBreathe.voiceModeBody": "Marco can talk you through each step.",
  "activities.relaxBreathe.stepLabel": "Step",
  "activities.relaxBreathe.ofLabel": "of",
  "activities.relaxBreathe.breatheIn": "Breathe in",
  "activities.relaxBreathe.breatheOut": "Breathe out",
  "activities.relaxBreathe.safety": "If breathing feels difficult, painful, or unusual, stop and seek help.",
  "activities.relaxBreathe.startGuide": "Start Marco guide",
  "activities.relaxBreathe.guideStarting": "Starting...",
  "activities.relaxBreathe.guideLive": "Marco guide is live",
  "activities.relaxBreathe.voiceRetry": "Tap Voice again to retry.",
  "activities.relaxBreathe.replay": "Replay",
  "activities.relaxBreathe.back": "Back",
  "activities.relaxBreathe.next": "Next",
  "activities.relaxBreathe.finish": "Finish",
  "activities.relaxBreathe.completeTitle": "A calm pause is complete.",
  "activities.relaxBreathe.completeBody": "You can come back to this whenever you want a quieter moment.",
  "activities.relaxBreathe.tryAgain": "Try again",
  "activities.relaxBreathe.audioUnavailable": "The visual guide still works without audio.",
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
  "activities.relaxBreathe.stages.settle.title": "Settle",
  "activities.relaxBreathe.stages.settle.instruction": "Sit comfortably. Let your shoulders soften.",
  "activities.relaxBreathe.stages.settle.cue": "Find a comfortable seat.",
  "activities.relaxBreathe.stages.breathe.title": "Breathe slowly",
  "activities.relaxBreathe.stages.breathe.instruction": "Breathe in as the circle grows. Breathe out as it settles.",
  "activities.relaxBreathe.stages.breathe.cue": "Follow the slow circle.",
  "activities.relaxBreathe.stages.return.title": "Return gently",
  "activities.relaxBreathe.stages.return.instruction": "Notice the chair, the room, and one calm breath.",
  "activities.relaxBreathe.stages.return.cue": "Come back to the room gently.",
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

  it("renders the calm guide with three stages, visual cue, safety copy, and controls", () => {
    renderRelaxBreathe();

    expect(screen.getByRole("heading", { name: "Relax & Breathe" })).toBeInTheDocument();
    expect(screen.getByTestId("relax-breathe-visual")).toBeInTheDocument();
    expect(screen.getByTestId("relax-breathe-orb")).toHaveTextContent("Breathe in");
    expect(screen.getByTestId("relax-breathe-safety")).toHaveTextContent("If breathing feels difficult");
    expect(screen.getByTestId("relax-breathe-mode-switch")).toBeInTheDocument();
    expect(screen.getByTestId("button-relax-breathe-mode-visual")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("relax-breathe-routine")).toHaveTextContent("First pause today");
    expect(screen.getByTestId("button-relax-breathe-motion-toggle")).toHaveTextContent("Pause motion");
    expect(screen.getByTestId("relax-breathe-mobile-focus")).toHaveTextContent("Sit comfortably");
    expect(screen.getByTestId("relax-breathe-visual-mode-panel")).toHaveTextContent("Follow the breathing circle");
    expect(within(screen.getByTestId("relax-breathe-stage-list")).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-relax-breathe-finish")).toHaveTextContent("Finish");
  });

  it("lets the user switch between visual and voice modes with one tap", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));
    expect(screen.getByTestId("button-relax-breathe-mode-voice")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("relax-breathe-voice-mode-panel")).toHaveTextContent("Marco can talk you through each step.");
    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("relax-breathe-voice-status")).toHaveTextContent("Marco guide is live");
    expect(screen.queryByTestId("button-relax-breathe-start-guide")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-visual"));
    expect(screen.getByTestId("button-relax-breathe-mode-visual")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("relax-breathe-visual-mode-panel")).toHaveTextContent("Follow the breathing circle");
  });

  it("lets the user move back and next through the visible stages", () => {
    renderRelaxBreathe();

    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Sit comfortably");

    fireEvent.click(screen.getByTestId("button-relax-breathe-stage-next"));
    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Breathe in as the circle grows");

    fireEvent.click(screen.getByTestId("button-relax-breathe-stage-back"));
    expect(screen.getByTestId("relax-breathe-stage-instruction")).toHaveTextContent("Sit comfortably");
  });

  it("keeps the next step reachable in the mobile focus card", () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mobile-stage-next"));
    expect(screen.getByTestId("relax-breathe-mobile-focus")).toHaveTextContent("Breathe in as the circle grows");

    fireEvent.click(screen.getByTestId("button-relax-breathe-mobile-stage-next"));
    fireEvent.click(screen.getByTestId("button-relax-breathe-mobile-finish"));

    expect(screen.getByTestId("relax-breathe-complete")).toHaveTextContent("A calm pause is complete.");
  });

  it("lets the user pause breathing motion and remembers the choice", () => {
    renderRelaxBreathe();

    expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "animated");

    fireEvent.click(screen.getByTestId("button-relax-breathe-motion-toggle"));

    expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "static");
    expect(screen.getByTestId("button-relax-breathe-motion-toggle")).toHaveTextContent("Resume motion");
    expect(window.localStorage.getItem("vyva_relax_breathe_progress")).toContain('"motionPaused":true');
  });

  it("starts Marco voice with calm-session context and sends the visible stage prompt", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));

    await waitFor(() => expect(voiceMock.startVoice).toHaveBeenCalled());
    expect(voiceMock.startVoice).toHaveBeenCalledWith(
      expect.stringContaining("Current stage 1 of 3: Settle"),
      undefined,
      expect.objectContaining({
        agentSlug: "marco-reyes",
        roomSlug: "evening-wind-down",
        autoStartListening: false,
        dynamicVariables: expect.objectContaining({
          app_entrypoint: "relax_breathe_session",
          session_title: "Relax & Breathe",
          stage_key: "settle",
          current_stage_number: 1,
        }),
      }),
    );
    expect(voiceMock.sendText).toHaveBeenCalledWith(
      expect.stringContaining("Visible instruction: Sit comfortably"),
      { invisibleInTranscript: true },
    );
  });

  it("sends updated Marco prompts for next and replay when audio is live", () => {
    voiceMock.status = "connected";
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));
    fireEvent.click(screen.getByTestId("button-relax-breathe-stage-next"));
    expect(voiceMock.sendText).toHaveBeenLastCalledWith(
      expect.stringContaining("Current stage 2 of 3: Breathe slowly"),
      { invisibleInTranscript: true },
    );

    fireEvent.click(screen.getByTestId("button-relax-breathe-replay"));
    expect(voiceMock.sendText).toHaveBeenLastCalledWith(
      expect.stringContaining("Current stage 2 of 3: Breathe slowly"),
      { invisibleInTranscript: true },
    );
  });

  it("stops the voice guide when switching back to visual mode", () => {
    voiceMock.status = "connected";
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-voice"));
    fireEvent.click(screen.getByTestId("button-relax-breathe-mode-visual"));

    expect(voiceMock.stopVoice).toHaveBeenCalled();
  });

  it("finishes with a calm completion state without activity logging", () => {
    const fetchMock = vi.mocked(fetch);
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-finish"));

    expect(screen.getByTestId("relax-breathe-complete")).toHaveTextContent("A calm pause is complete.");
    expect(screen.getByTestId("relax-breathe-progress-summary")).toHaveTextContent("1 calm pause");
    expect(screen.getByTestId("relax-breathe-progress-summary")).toHaveTextContent("Done today");
    expect(window.localStorage.getItem("vyva_relax_breathe_progress")).toContain('"totalSessions":1');
    expect(voiceMock.stopVoice).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/api/activity/log"), expect.anything());
  });

  it("returns to Mind & Memory from the back button", async () => {
    renderRelaxBreathe();

    fireEvent.click(screen.getByTestId("button-relax-breathe-back-mind-memory"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory"));
    expect(voiceMock.stopVoice).toHaveBeenCalled();
  });

  it("uses a static breathing cue when reduced motion is preferred", async () => {
    mockReducedMotion(true);
    renderRelaxBreathe();

    await waitFor(() => expect(screen.getByTestId("relax-breathe-orb")).toHaveAttribute("data-motion", "static"));
  });
});
