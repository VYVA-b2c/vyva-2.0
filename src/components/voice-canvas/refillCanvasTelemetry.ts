import type { RefillCanvasStep } from "./refillCanvasMachine";
import { dispatchCanvasTelemetryEvent } from "./canvasPlatform";
export type RefillCanvasTelemetryName =
  | "scene_viewed"
  | "draft_restored"
  | "abandoned"
  | "retried"
  | "confirmation_submitted"
  | "completed"
  | "failed"
  | "urgent_help_shown";
export interface RefillCanvasTelemetryEvent {
  name: RefillCanvasTelemetryName;
  step: RefillCanvasStep;
  input: "touch_or_keyboard" | "voice" | "system";
  attempt: number;
  restored: boolean;
}
export const VYVA_REFILL_CANVAS_TELEMETRY_EVENT =
  "vyva:refill-canvas-telemetry";
/** Closed event shape. Never add medication, provider, notes, symptoms, transcript, schedule, or reference data. */
export function trackRefillCanvasEvent(event: RefillCanvasTelemetryEvent) {
  dispatchCanvasTelemetryEvent(VYVA_REFILL_CANVAS_TELEMETRY_EVENT, event);
}
