import { describe, expect, it, vi } from "vitest";
import {
  CANVAS_LAUNCH_SIGNALS,
  CanvasLaunchTelemetryCounter,
  canvasLaunchTelemetrySampleFromEnvelope,
  createCanvasLaunchTelemetryListener,
  emptyCanvasLaunchTelemetryCounts,
  isCanvasTelemetryEnvelope,
  type CanvasLaunchTelemetrySnapshot,
} from "./canvasLaunchTelemetry";
import { CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS } from "./canvasLaunchReadiness";
import type { CanvasTelemetryEnvelope } from "./canvasPlatform";

function launchEvent(
  overrides: Partial<CanvasTelemetryEnvelope> = {},
): CanvasTelemetryEnvelope {
  return {
    name: "scene_viewed",
    step: "review",
    input: "touch_or_keyboard",
    attempt: 1,
    restored: false,
    ...overrides,
  };
}

describe("Canvas launch telemetry aggregation", () => {
  it("starts every launch signal count at zero", () => {
    expect(Object.keys(emptyCanvasLaunchTelemetryCounts()).sort()).toEqual([
      ...CANVAS_LAUNCH_SIGNALS,
    ].sort());
    expect(emptyCanvasLaunchTelemetryCounts()).toEqual({
      started: 0,
      resumed: 0,
      abandoned: 0,
      blocked: 0,
      confirmed: 0,
      completed: 0,
    });
  });

  it("derives aggregate launch counts from closed Canvas envelopes", () => {
    const counter = new CanvasLaunchTelemetryCounter();

    counter.record(launchEvent());
    counter.record(launchEvent({ restored: true }));
    counter.record(launchEvent({ name: "draft_restored", restored: true }));
    counter.record(launchEvent({ name: "abandoned", step: "listening" }));
    counter.record(launchEvent({ name: "failed", step: "blocked", input: "system" }));
    counter.record(launchEvent({ name: "confirmation_submitted", step: "review" }));
    counter.record(launchEvent({ name: "completed", step: "completed", input: "system" }));
    counter.record(launchEvent({ name: "pending", step: "pending", input: "system" }));
    counter.record(launchEvent({ name: "saved", step: "completed", input: "system" }));

    expect(counter.snapshot().counts).toEqual({
      started: 1,
      resumed: 2,
      abandoned: 1,
      blocked: 1,
      confirmed: 1,
      completed: 2,
    });
  });

  it("keeps samples aggregate-only even when a source detail contains private fields", () => {
    const counter = new CanvasLaunchTelemetryCounter();
    const forbiddenPayload = Object.fromEntries(
      CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS.map((field) => [
        field,
        `private-${field}`,
      ]),
    );

    counter.record({
      ...launchEvent({ name: "completed", step: "completed", input: "system" }),
      ...forbiddenPayload,
    });

    const serialized = JSON.stringify(counter.snapshot());
    expect(serialized).toContain("completed");
    for (const forbiddenField of CANVAS_LAUNCH_FORBIDDEN_TELEMETRY_FIELDS) {
      expect(serialized).not.toContain(`private-${forbiddenField}`);
      expect(serialized).not.toContain(`"${forbiddenField}"`);
    }
  });

  it("returns defensive snapshots", () => {
    const counter = new CanvasLaunchTelemetryCounter();
    counter.record(launchEvent());
    const snapshot = counter.snapshot() as CanvasLaunchTelemetrySnapshot & {
      samples: Array<{ step: string }>;
    };

    snapshot.counts.started = 99;
    snapshot.samples[0].step = "changed";

    expect(counter.snapshot()).toEqual({
      counts: {
        started: 1,
        resumed: 0,
        abandoned: 0,
        blocked: 0,
        confirmed: 0,
        completed: 0,
      },
      samples: [
        {
          signal: "started",
          name: "scene_viewed",
          step: "review",
          input: "touch_or_keyboard",
          attempt: 1,
          restored: false,
        },
      ],
    });
  });

  it("listens to selected flow events and stops after disposal", () => {
    const target = new EventTarget();
    const onSample = vi.fn();
    const listener = createCanvasLaunchTelemetryListener({
      eventNames: ["flow-a", "flow-a", "flow-b"],
      target,
      onSample,
    });

    target.dispatchEvent(new CustomEvent("flow-a", { detail: launchEvent() }));
    target.dispatchEvent(
      new CustomEvent("flow-b", {
        detail: launchEvent({ name: "completed", step: "completed" }),
      }),
    );
    target.dispatchEvent(new CustomEvent("flow-c", { detail: launchEvent() }));
    target.dispatchEvent(new CustomEvent("flow-a", { detail: { nope: true } }));

    expect(listener.snapshot().counts.started).toBe(1);
    expect(listener.snapshot().counts.completed).toBe(1);
    expect(onSample).toHaveBeenCalledTimes(2);

    listener.dispose();
    target.dispatchEvent(new CustomEvent("flow-a", { detail: launchEvent() }));
    expect(listener.snapshot().counts.started).toBe(1);
  });

  it("rejects malformed envelopes before deriving a signal", () => {
    expect(isCanvasTelemetryEnvelope(launchEvent())).toBe(true);
    expect(isCanvasTelemetryEnvelope({ ...launchEvent(), step: "" })).toBe(false);
    expect(isCanvasTelemetryEnvelope({ ...launchEvent(), input: "tap" })).toBe(false);
    expect(isCanvasTelemetryEnvelope({ ...launchEvent(), attempt: Number.NaN })).toBe(false);
    expect(isCanvasTelemetryEnvelope({ ...launchEvent(), restored: "false" })).toBe(false);
    expect(
      canvasLaunchTelemetrySampleFromEnvelope(
        launchEvent({ name: "retried", step: "blocked" }),
      ),
    ).toBeNull();
  });
});
