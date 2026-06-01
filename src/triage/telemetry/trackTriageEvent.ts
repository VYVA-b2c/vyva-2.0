import type {
  TriageTelemetryEvent,
  TriageTelemetryEventName,
  TriageTelemetryPayload,
  TriageTelemetrySink,
} from "./types.js";

function isTestEnvironment() {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "test";
}

function defaultTriageTelemetrySink(event: TriageTelemetryEvent) {
  if (isTestEnvironment()) return;
  console.info("[triage.telemetry]", JSON.stringify(event));
}

let telemetrySink: TriageTelemetrySink = defaultTriageTelemetrySink;

export function setTriageTelemetrySink(sink: TriageTelemetrySink) {
  telemetrySink = sink;
}

export function resetTriageTelemetrySink() {
  telemetrySink = defaultTriageTelemetrySink;
}

function compactPayload(payload: TriageTelemetryPayload): TriageTelemetryPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null;
    }),
  ) as TriageTelemetryPayload;
}

export function trackTriageEvent(name: TriageTelemetryEventName, payload: TriageTelemetryPayload) {
  const event: TriageTelemetryEvent = {
    name,
    payload: compactPayload(payload),
    timestamp: new Date().toISOString(),
  };

  try {
    void Promise.resolve(telemetrySink(event)).catch((err) => {
      if (!isTestEnvironment()) {
        console.warn("[triage.telemetry] failed", err);
      }
    });
  } catch (err) {
    if (!isTestEnvironment()) {
      console.warn("[triage.telemetry] failed", err);
    }
  }
}
