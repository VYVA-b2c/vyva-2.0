import {
  canvasLaunchSignalForTelemetry,
  type CanvasInputMethod,
  type CanvasLaunchSignal,
  type CanvasTelemetryEnvelope,
  type CanvasTelemetryName,
} from "./canvasPlatform";

export const CANVAS_LAUNCH_SIGNALS = [
  "started",
  "resumed",
  "abandoned",
  "blocked",
  "confirmed",
  "completed",
] as const satisfies readonly CanvasLaunchSignal[];

const CANVAS_TELEMETRY_NAMES = [
  "scene_viewed",
  "draft_restored",
  "confirmation_submitted",
  "reconfirmation_required",
  "retried",
  "abandoned",
  "urgent_help_shown",
  "saved",
  "prepared",
  "pending",
  "confirmed",
  "completed",
  "failed",
] as const satisfies readonly CanvasTelemetryName[];

const CANVAS_INPUT_METHODS = [
  "voice",
  "touch_or_keyboard",
  "system",
] as const satisfies readonly CanvasInputMethod[];

export type CanvasLaunchTelemetryCounts = Record<CanvasLaunchSignal, number>;

export interface CanvasLaunchTelemetrySample {
  signal: CanvasLaunchSignal;
  name: CanvasTelemetryName;
  step: string;
  input: CanvasInputMethod;
  attempt: number;
  restored: boolean;
  revision?: number;
}

export interface CanvasLaunchTelemetrySnapshot {
  counts: CanvasLaunchTelemetryCounts;
  samples: readonly CanvasLaunchTelemetrySample[];
}

export interface CanvasLaunchTelemetryListener {
  snapshot: () => CanvasLaunchTelemetrySnapshot;
  dispose: () => void;
}

export interface CreateCanvasLaunchTelemetryListenerOptions {
  eventNames: readonly string[];
  target?: EventTarget;
  onSample?: (sample: CanvasLaunchTelemetrySample) => void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function emptyCounts(): CanvasLaunchTelemetryCounts {
  return Object.fromEntries(
    CANVAS_LAUNCH_SIGNALS.map((signal) => [signal, 0]),
  ) as CanvasLaunchTelemetryCounts;
}

export function emptyCanvasLaunchTelemetryCounts() {
  return emptyCounts();
}

export function isCanvasTelemetryEnvelope(
  value: unknown,
): value is CanvasTelemetryEnvelope {
  if (!isRecord(value)) return false;
  if (!isOneOf(value.name, CANVAS_TELEMETRY_NAMES)) return false;
  if (typeof value.step !== "string" || value.step.trim().length === 0)
    return false;
  if (!isOneOf(value.input, CANVAS_INPUT_METHODS)) return false;
  if (typeof value.attempt !== "number" || !Number.isFinite(value.attempt))
    return false;
  if (typeof value.restored !== "boolean") return false;
  if (
    value.revision !== undefined &&
    (typeof value.revision !== "number" || !Number.isFinite(value.revision))
  )
    return false;
  return true;
}

export function canvasLaunchTelemetrySampleFromEnvelope(
  event: CanvasTelemetryEnvelope,
): CanvasLaunchTelemetrySample | null {
  const signal = canvasLaunchSignalForTelemetry(event);
  if (!signal) return null;
  return {
    signal,
    name: event.name,
    step: event.step,
    input: event.input,
    attempt: event.attempt,
    restored: event.restored,
    ...(event.revision === undefined ? {} : { revision: event.revision }),
  };
}

export class CanvasLaunchTelemetryCounter {
  private readonly counts = emptyCounts();
  private readonly samples: CanvasLaunchTelemetrySample[] = [];

  record(value: unknown) {
    if (!isCanvasTelemetryEnvelope(value)) return null;
    const sample = canvasLaunchTelemetrySampleFromEnvelope(value);
    if (!sample) return null;
    this.counts[sample.signal] += 1;
    this.samples.push(sample);
    return { ...sample };
  }

  snapshot(): CanvasLaunchTelemetrySnapshot {
    return {
      counts: { ...this.counts },
      samples: this.samples.map((sample) => ({ ...sample })),
    };
  }
}

function defaultTelemetryTarget() {
  return typeof window === "undefined" ? undefined : window;
}

export function createCanvasLaunchTelemetryListener({
  eventNames,
  target = defaultTelemetryTarget(),
  onSample,
}: CreateCanvasLaunchTelemetryListenerOptions): CanvasLaunchTelemetryListener {
  const counter = new CanvasLaunchTelemetryCounter();
  const listener: EventListener = (event) => {
    const sample = counter.record((event as CustomEvent<unknown>).detail);
    if (sample) onSample?.(sample);
  };
  const uniqueEventNames = [...new Set(eventNames)];

  if (target) {
    uniqueEventNames.forEach((eventName) => {
      target.addEventListener(eventName, listener);
    });
  }

  return {
    snapshot: () => counter.snapshot(),
    dispose: () => {
      if (!target) return;
      uniqueEventNames.forEach((eventName) => {
        target.removeEventListener(eventName, listener);
      });
    },
  };
}
