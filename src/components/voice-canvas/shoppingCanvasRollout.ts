import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type ShoppingCanvasRolloutConfig = CanvasRolloutConfig;
export const parseShoppingCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isShoppingCanvasEnabled = isCanvasRolloutEnabled;
