import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type RefillCanvasRolloutConfig = CanvasRolloutConfig;
export const parseRefillCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isRefillCanvasEnabled = isCanvasRolloutEnabled;
