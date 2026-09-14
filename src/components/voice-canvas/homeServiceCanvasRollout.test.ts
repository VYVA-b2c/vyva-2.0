import { describe, expect, it } from "vitest";
import {
  isHomeServiceCanvasEnabled,
  isRestorableHomeServiceRequestStatus,
  parseHomeServiceCanvasRolloutConfig,
} from "./homeServiceCanvasRollout";

describe("Home Service Canvas rollout", () => {
  it("fails closed for missing, malformed, or disabled configuration", () => {
    expect(isHomeServiceCanvasEnabled(undefined, "session")).toBe(false);
    expect(parseHomeServiceCanvasRolloutConfig({ enabled: "true", rolloutPercent: 100 })).toEqual({
      enabled: false,
      rolloutPercent: 100,
    });
    expect(isHomeServiceCanvasEnabled({ enabled: false, rolloutPercent: 100 }, "session")).toBe(false);
  });

  it("supports independent full rollout", () => {
    expect(isHomeServiceCanvasEnabled({ enabled: true, rolloutPercent: 100 }, "session")).toBe(true);
  });

  it("restores drafts but never waiting or in-flight requests", () => {
    expect(isRestorableHomeServiceRequestStatus("needs_provider")).toBe(true);
    expect(isRestorableHomeServiceRequestStatus("options_ready")).toBe(true);
    expect(isRestorableHomeServiceRequestStatus("pending")).toBe(false);
    expect(isRestorableHomeServiceRequestStatus("calling")).toBe(false);
    expect(isRestorableHomeServiceRequestStatus("completed")).toBe(false);
  });
});
