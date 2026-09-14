import type { ProviderReplyCanvasStep } from "./providerReplyCanvasMachine";
import { dispatchCanvasTelemetryEvent } from "./canvasPlatform";

export const VYVA_PROVIDER_REPLY_CANVAS_TELEMETRY_EVENT =
  "vyva:provider-reply-canvas:telemetry";

export type ProviderReplyCanvasTelemetryName =
  | "scene_viewed"
  | "draft_restored"
  | "confirmation_submitted"
  | "retried"
  | "abandoned"
  | "saved"
  | "completed"
  | "failed";

export interface ProviderReplyCanvasTelemetryEvent {
  name: ProviderReplyCanvasTelemetryName;
  step: ProviderReplyCanvasStep;
  input: "voice" | "touch_or_keyboard" | "system";
  attempt: number;
  restored: boolean;
  revision?: number;
}

export function trackProviderReplyCanvasEvent(
  event: ProviderReplyCanvasTelemetryEvent,
) {
  dispatchCanvasTelemetryEvent(VYVA_PROVIDER_REPLY_CANVAS_TELEMETRY_EVENT, event);
}
