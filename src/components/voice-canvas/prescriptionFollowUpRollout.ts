import {
  isCanvasRolloutEnabled,
  parseCanvasRolloutConfig,
  type CanvasRolloutConfig,
} from "./canvasPlatform";
export type PrescriptionFollowUpRolloutConfig = CanvasRolloutConfig;
export const parsePrescriptionFollowUpRolloutConfig = parseCanvasRolloutConfig;
export const isPrescriptionFollowUpEnabled = isCanvasRolloutEnabled;
