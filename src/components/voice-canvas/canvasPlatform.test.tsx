import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CanvasSafetyError,
  canvasOutcomeForStep,
  dispatchCanvasTelemetryEvent,
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasTelemetryEnvelope,
} from "./canvasPlatform";
import { useCanvasExternalActionGate } from "./useVoiceCanvasPlatform";

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
});

describe("Canvas platform safety primitives", () => {
  it("drops sensitive or free-text fields at the telemetry boundary", () => {
    let detail: unknown;
    window.addEventListener("canvas-test", (event) => {
      detail = (event as CustomEvent).detail;
    }, { once: true });
    dispatchCanvasTelemetryEvent("canvas-test", {
      name: "completed",
      step: "completed",
      input: "system",
      attempt: 1,
      restored: false,
      address: "private address",
      transcript: "private transcript",
    } as CanvasTelemetryEnvelope & { address: string; transcript: string });
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
