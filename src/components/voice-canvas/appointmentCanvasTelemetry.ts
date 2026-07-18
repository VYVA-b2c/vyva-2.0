import type{AppointmentCanvasStep}from"./appointmentCanvasMachine";
export type AppointmentCanvasTelemetryName="scene_viewed"|"abandoned"|"retried"|"confirmation_submitted"|"completed"|"failed";
export interface AppointmentCanvasTelemetryEvent{name:AppointmentCanvasTelemetryName;step:AppointmentCanvasStep;input:"touch_or_keyboard"|"voice"|"system";attempt:number;restored:boolean}
export const VYVA_APPOINTMENT_CANVAS_TELEMETRY_EVENT="vyva:appointment-canvas-telemetry";
/** Closed PII-free event shape. Never add provider, reason, schedule, transcript, or reference fields. */
export function trackAppointmentCanvasEvent(event:AppointmentCanvasTelemetryEvent){window.dispatchEvent(new CustomEvent(VYVA_APPOINTMENT_CANVAS_TELEMETRY_EVENT,{detail:event}))}
