import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  useCanvasExternalActionGate,
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
