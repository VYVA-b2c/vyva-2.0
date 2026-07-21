import type { RideCanvasStep } from "./rideCanvasMachine";
import { dispatchCanvasTelemetryEvent } from "./canvasPlatform";

export type RideCanvasTelemetryName =
  | "scene_viewed"
  | "abandoned"
  | "retried"
  | "confirmation_submitted"
  | "completed"
  | "failed";

export interface RideCanvasTelemetryEvent {
  name: RideCanvasTelemetryName;
  step: RideCanvasStep;
  input: "touch_or_keyboard" | "voice" | "system";
  attempt: number;
  restored: boolean;
}

export const VYVA_RIDE_CANVAS_TELEMETRY_EVENT = "vyva:ride-canvas-telemetry";

/** Dispatches an intentionally closed, PII-free event shape for the app analytics bridge. */
export function trackRideCanvasEvent(event: RideCanvasTelemetryEvent) {
  dispatchCanvasTelemetryEvent(VYVA_RIDE_CANVAS_TELEMETRY_EVENT, event);
}
