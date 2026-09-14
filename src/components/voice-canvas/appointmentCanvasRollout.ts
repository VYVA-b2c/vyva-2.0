import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type AppointmentCanvasRolloutConfig = CanvasRolloutConfig;
export const parseAppointmentCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isAppointmentCanvasEnabled = isCanvasRolloutEnabled;
