import type { PrescriptionFollowUpStep } from "./prescriptionFollowUpMachine";
import { dispatchCanvasTelemetryEvent } from "./canvasPlatform";
export type PrescriptionFollowUpTelemetryName =
  | "scene_viewed"
  | "draft_restored"
  | "confirmation_submitted"
  | "completed"
  | "pending"
  | "failed"
  | "retried"
  | "abandoned";
export interface PrescriptionFollowUpTelemetryEvent {
  name: PrescriptionFollowUpTelemetryName;
  step: PrescriptionFollowUpStep;
  input: "voice" | "touch_or_keyboard" | "system";
  attempt: number;
  restored: boolean;
}
export const VYVA_PRESCRIPTION_FOLLOW_UP_TELEMETRY_EVENT =
  "vyva:prescription-follow-up-telemetry";
export function trackPrescriptionFollowUpEvent(
  event: PrescriptionFollowUpTelemetryEvent,
) {
  dispatchCanvasTelemetryEvent(
    VYVA_PRESCRIPTION_FOLLOW_UP_TELEMETRY_EVENT,
    event,
  );
}
