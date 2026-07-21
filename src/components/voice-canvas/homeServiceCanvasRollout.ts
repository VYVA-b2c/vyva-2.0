import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type HomeServiceCanvasRolloutConfig = CanvasRolloutConfig;
export const parseHomeServiceCanvasRolloutConfig = parseCanvasRolloutConfig;
export const isHomeServiceCanvasEnabled = isCanvasRolloutEnabled;

const RESTORABLE_HOME_SERVICE_STATUSES = new Set([
  "draft",
  "needs_provider",
  "options_ready",
]);

export function isRestorableHomeServiceRequestStatus(status: unknown) {
  return typeof status === "string" && RESTORABLE_HOME_SERVICE_STATUSES.has(status);
}
