import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, type VoiceTriageTouchAnswerDetail } from "@/lib/voiceSessionBridge";
import {
  CanvasSafetyError,
  canvasLaunchSignalForTelemetry,
  canvasOutcomeForStep,
  dispatchCanvasTelemetryEvent,
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasTelemetryEnvelope,
} from "./canvasPlatform";
import { CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS } from "./canvasLaunchReadiness";
import {
  applyVoiceCanvasAgentPresence,
  findVoiceCanvasSpokenOption,
  useCanvasExternalActionGate,
  useVoiceCanvasMultimodalInteraction,
  voiceCanvasTextMatchesAny,
  voiceCanvasAgentPresenceStateFor,
} from "./useVoiceCanvasPlatform";
import type { VoiceCanvasAgentPresenceCopy, VoiceCanvasViewModel } from "./types";

describe("Canvas platform outcomes", () => {
  it.each([
    ["review", "prepared"],
    ["pending_detail", "pending"],
    ["waiting", "confirmed"],
    ["completed", "completed"],
    ["error", "blocked"],
  ])("maps %s to the canonical %s outcome", (step, outcome) => {
    expect(canvasOutcomeForStep(step)).toBe(outcome);
  });

  it("does not invent an outcome for data-entry scenes", () => {
    expect(canvasOutcomeForStep("address")).toBeUndefined();
  });

  it.each([
    [{ name: "scene_viewed", step: "provider", restored: false }, "started"],
    [{ name: "scene_viewed", step: "provider", restored: true }, "resumed"],
    [{ name: "draft_restored", step: "review", restored: true }, "resumed"],
    [{ name: "abandoned", step: "listening", restored: false }, "abandoned"],
    [{ name: "confirmation_submitted", step: "review", restored: false }, "confirmed"],
    [{ name: "completed", step: "completed", restored: false }, "completed"],
    [{ name: "pending", step: "pending", restored: false }, "completed"],
    [{ name: "failed", step: "blocked", restored: false }, "blocked"],
    [{ name: "urgent_help_shown", step: "urgent", restored: false }, "blocked"],
  ] as const)("maps %s to the %s launch signal", (event, signal) => {
    expect(canvasLaunchSignalForTelemetry({
      ...event,
      input: "system",
      attempt: 1,
    })).toBe(signal);
  });

  it("does not turn intermediate preparation events into launch completion", () => {
    expect(canvasLaunchSignalForTelemetry({
      name: "saved",
      step: "saved",
      input: "system",
      attempt: 1,
      restored: false,
    })).toBeUndefined();
    expect(canvasLaunchSignalForTelemetry({
      name: "pending",
      step: "pending_detail",
      input: "system",
      attempt: 1,
      restored: false,
    })).toBeUndefined();
  });
});

describe("Canvas platform safety primitives", () => {
  it("drops sensitive or free-text fields at the telemetry boundary", () => {
    let detail: unknown;
    window.addEventListener("canvas-test", (event) => {
      detail = (event as CustomEvent).detail;
    }, { once: true });
    const forbiddenPayload = Object.fromEntries(
      CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS.map((field) => [
        field,
        `private-${field}`,
      ]),
    );
    dispatchCanvasTelemetryEvent("canvas-test", {
      name: "completed",
      step: "completed",
      input: "system",
      attempt: 1,
      restored: false,
      ...forbiddenPayload,
    } as CanvasTelemetryEnvelope & Record<string, string>);
    expect(detail).toEqual({
      name: "completed",
      step: "completed",
      input: "system",
      attempt: 1,
      restored: false,
    });
  });
  it("standardizes fail-closed rollout behavior", () => {
    expect(parseCanvasRolloutConfig(null)).toEqual({
      enabled: false,
      rolloutPercent: 0,
    });
    expect(
      parseCanvasRolloutConfig({ enabled: "yes", rolloutPercent: 100 }),
    ).toEqual({ enabled: false, rolloutPercent: 100 });
    expect(
      parseCanvasRolloutConfig({ enabled: true, rolloutPercent: 500 }),
    ).toEqual({ enabled: true, rolloutPercent: 100 });
    expect(
      isCanvasRolloutEnabled({ enabled: false, rolloutPercent: 100 }, "person"),
    ).toBe(false);
  });
  it("rejects action without explicit confirmation", () => {
    const { result } = renderHook(() => useCanvasExternalActionGate());
    expect(() => result.current.begin(1)).toThrow(CanvasSafetyError);
  });
  it("prevents duplicate action and invalidates confirmation after material change", () => {
    const { result } = renderHook(() => useCanvasExternalActionGate());
    act(() => result.current.authorize(1, 0));
    expect(result.current.begin(1, 0)).toBeInstanceOf(AbortController);
    expect(result.current.begin(1, 0)).toBeNull();
    expect(() => result.current.begin(1, 1)).toThrow(CanvasSafetyError);
    act(() => result.current.authorize(2, 1));
    expect(result.current.begin(2, 1)).toBeInstanceOf(AbortController);
  });
});

describe("Canvas agent presence adapter", () => {
  const copy: VoiceCanvasAgentPresenceCopy = {
    idleLabel: "Voice ready",
    idleDescription: "Use voice or touch.",
    listeningLabel: "Listening with you",
    listeningDescription: "Say or tap a choice.",
    speakingLabel: "VYVA is speaking",
    speakingDescription: "Follow the screen.",
    thinkingLabel: "Thinking",
    thinkingDescription: "Checking details.",
    accessibleLabel: "VYVA voice status",
  };
  const viewModel: VoiceCanvasViewModel = {
    sceneId: "ride-place",
    kind: "place",
    title: "Where to?",
  };

  it("maps real voice state into shared Canvas presence states", () => {
    expect(voiceCanvasAgentPresenceStateFor(viewModel, { status: "connected", voiceSessionPhase: "listening" })).toBe("listening");
    expect(voiceCanvasAgentPresenceStateFor(viewModel, { status: "connected", isSpeaking: true, voiceSessionPhase: "speaking" })).toBe("speaking");
    expect(voiceCanvasAgentPresenceStateFor({ ...viewModel, kind: "waiting", status: "loading" }, { status: "connected", voiceSessionPhase: "listening" })).toBe("thinking");
    expect(voiceCanvasAgentPresenceStateFor(viewModel, { status: "connected", isMicMuted: true, voiceSessionPhase: "muted" })).toBe("idle");
  });

  it("applies flow-supplied copy without changing pure listening scenes", () => {
    expect(applyVoiceCanvasAgentPresence(viewModel, { status: "connected", voiceSessionPhase: "listening" }, copy).agentPresence).toEqual({
      state: "listening",
      label: "Listening with you",
      description: "Say or tap a choice.",
      accessibleLabel: "VYVA voice status",
      ariaLive: undefined,
    });
    const listening: VoiceCanvasViewModel = {
      sceneId: "ride-listening",
      kind: "listening",
      title: "Listening",
    };
    expect(applyVoiceCanvasAgentPresence(listening, { status: "connected", voiceSessionPhase: "listening" }, copy)).toBe(listening);
  });
});

describe("Canvas multimodal interaction layer", () => {
  type TestState = { step: "choice" | "next" | "other" };
  type TestEvent = { type: "PICK" };
  const reducer = (state: TestState, event: TestEvent): TestState =>
    event.type === "PICK" ? { step: "next" } : state;
  const viewModelFor = (state: TestState): VoiceCanvasViewModel => ({
    sceneId: state.step,
    kind: state.step === "choice" ? "choice" : "review",
    title: state.step === "next" ? "Next question" : "Choose one",
    choices: [{ id: "clinic", label: "Clinic" }],
  });

  it("standardizes spoken option matching", () => {
    const option = findVoiceCanvasSpokenOption(
      [{ label: "Riverside Clinic", voiceAliases: ["clinic"] }],
      "please choose clinic",
      (item) => [item.label, ...(item.voiceAliases ?? [])],
    );
    expect(option?.label).toBe("Riverside Clinic");
    expect(voiceCanvasTextMatchesAny("Back", ["back"], "exact")).toBe(true);
  });

  it("delays spoken choice commit, marks the selected choice, and emits the next visual prompt", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const stateRef = { current: { step: "choice" } as TestState };
    let bridgeDetail: VoiceTriageTouchAnswerDetail | undefined;
    window.addEventListener(VYVA_VOICE_TRIAGE_TOUCH_ANSWER_EVENT, (event) => {
      bridgeDetail = (event as CustomEvent<VoiceTriageTouchAnswerDetail>).detail;
    }, { once: true });
    const { result } = renderHook(() => useVoiceCanvasMultimodalInteraction({
      viewModel: viewModelFor(stateRef.current),
      agentPresenceCopy: {
        idleLabel: "Ready",
        listeningLabel: "Listening",
        speakingLabel: "Speaking",
        thinkingLabel: "Thinking",
        accessibleLabel: "VYVA status",
        spokenChoiceMessage: (label) => `VYVA heard ${label}`,
      },
      stateRef,
      reducer,
      dispatch,
      getStep: (state) => state.step,
      getViewModel: viewModelFor,
    }));

    act(() => result.current.acknowledgeChoice({
      choiceId: "clinic",
      label: "Clinic",
      expectedStep: "choice",
      event: { type: "PICK" },
      detail: { text: "clinic", transcriptEntry: { from: "user", text: "clinic" } },
    }));

    expect(result.current.viewModel.spokenChoiceFeedback?.message).toBe("VYVA heard Clinic");
    expect(result.current.viewModel.choices?.[0]).toMatchObject({
      selected: true,
      spokenSelected: true,
    });
    expect(dispatch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(650));

    expect(dispatch).toHaveBeenCalledWith({ type: "PICK" });
    expect(bridgeDetail).toMatchObject({
      choiceId: "clinic",
      utterance: "clinic",
      nextQuestion: "Next question",
      status: "next",
    });
    vi.useRealTimers();
  });

  it("drops stale spoken choices when the scene changes before the feedback delay completes", () => {
    vi.useFakeTimers();
    const dispatch = vi.fn();
    const stateRef = { current: { step: "choice" } as TestState };
    const { result } = renderHook(() => useVoiceCanvasMultimodalInteraction({
      viewModel: viewModelFor(stateRef.current),
      stateRef,
      reducer,
      dispatch,
      getStep: (state) => state.step,
      getViewModel: viewModelFor,
    }));

    act(() => result.current.acknowledgeChoice({
      choiceId: "clinic",
      label: "Clinic",
      expectedStep: "choice",
      event: { type: "PICK" },
      detail: { text: "clinic", transcriptEntry: { from: "user", text: "clinic" } },
    }));
    stateRef.current = { step: "other" };
    act(() => vi.advanceTimersByTime(650));

    expect(dispatch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
