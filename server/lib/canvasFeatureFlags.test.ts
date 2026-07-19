import { describe, expect, it } from "vitest";
import {
  CANVAS_FEATURE_FLAGS,
  resolveCanvasFeatureFlag,
  type CanvasFeatureFlagKey,
} from "./canvasFeatureFlags";

const featureKeys = Object.keys(CANVAS_FEATURE_FLAGS) as CanvasFeatureFlagKey[];

describe("Canvas feature flag runtime payloads", () => {
  it.each(featureKeys)("%s fails closed when env is missing", (feature) => {
    expect(resolveCanvasFeatureFlag(feature, {})).toEqual({
      enabled: false,
      rolloutPercent: 0,
    });
  });

  it.each(featureKeys)("%s clamps malformed rollout percentages", (feature) => {
    const config = CANVAS_FEATURE_FLAGS[feature];
    expect(
      resolveCanvasFeatureFlag(feature, {
        [config.enableEnv]: "true",
        [config.rolloutEnv]: "250",
      }),
    ).toEqual({ enabled: true, rolloutPercent: 100 });
    expect(
      resolveCanvasFeatureFlag(feature, {
        [config.enableEnv]: "true",
        [config.rolloutEnv]: "not-a-number",
      }),
    ).toEqual({ enabled: true, rolloutPercent: 0 });
  });

  it("exposes provider reply as an independently kill-switchable Canvas flow", () => {
    expect(
      resolveCanvasFeatureFlag("providerReply", {
        VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS: "true",
        VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT: "25.4",
      }),
    ).toEqual({ enabled: true, rolloutPercent: 25 });
    expect(
      resolveCanvasFeatureFlag("providerReply", {
        VYVA_ENABLE_PROVIDER_REPLY_VOICE_CANVAS: "false",
        VYVA_PROVIDER_REPLY_VOICE_CANVAS_ROLLOUT_PERCENT: "100",
      }),
    ).toEqual({ enabled: false, rolloutPercent: 100 });
  });
});
