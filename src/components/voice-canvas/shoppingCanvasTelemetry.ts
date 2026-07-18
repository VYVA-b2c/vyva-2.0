import type { ShoppingCanvasStep } from "./shoppingCanvasMachine";
import { dispatchCanvasTelemetryEvent } from "./canvasPlatform";
export const VYVA_SHOPPING_CANVAS_TELEMETRY_EVENT =
  "vyva:shopping-canvas-telemetry";
export type ShoppingCanvasTelemetryName =
  | "scene_viewed"
  | "draft_restored"
  | "confirmation_submitted"
  | "reconfirmation_required"
  | "retried"
  | "abandoned"
  | "completed"
  | "pending"
  | "failed";
export interface ShoppingCanvasTelemetryEvent {
  name: ShoppingCanvasTelemetryName;
  step: ShoppingCanvasStep;
  input: "voice" | "touch_or_keyboard" | "system";
  attempt: number;
  revision: number;
  restored: boolean;
}
export function trackShoppingCanvasEvent(event: ShoppingCanvasTelemetryEvent) {
  dispatchCanvasTelemetryEvent(VYVA_SHOPPING_CANVAS_TELEMETRY_EVENT, event);
}
