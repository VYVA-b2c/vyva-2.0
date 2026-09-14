import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type RideCanvasRolloutConfig = CanvasRolloutConfig;
export const parseRideCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isRideCanvasEnabled = isCanvasRolloutEnabled;
