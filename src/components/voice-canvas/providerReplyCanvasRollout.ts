import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";

export type ProviderReplyCanvasRolloutConfig = CanvasRolloutConfig;
export const parseProviderReplyCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isProviderReplyCanvasEnabled = isCanvasRolloutEnabled;
