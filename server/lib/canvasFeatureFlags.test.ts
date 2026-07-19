import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  CANVAS_FEATURE_FLAG_ENDPOINTS,
  CANVAS_FEATURE_FLAGS,
  resolveCanvasFeatureFlag,
  type CanvasFeatureFlagKey,
} from "./canvasFeatureFlags";

const featureKeys = Object.keys(CANVAS_FEATURE_FLAGS) as CanvasFeatureFlagKey[];

function endpointApp(env: Record<string, string | undefined>) {
  const app = express();
  CANVAS_FEATURE_FLAG_ENDPOINTS.forEach(({ endpoint, feature }) => {
    app.get(endpoint, (_req, res) => {
      res.setHeader("cache-control", "no-store");
      res.json(resolveCanvasFeatureFlag(feature, env));
    });
  });
  return app;
}

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

  it.each(CANVAS_FEATURE_FLAG_ENDPOINTS)(
    "$endpoint fails closed and disables caching at the HTTP boundary",
    async ({ endpoint }) => {
      const response = await request(endpointApp({})).get(endpoint).expect(200);

      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toEqual({
        enabled: false,
        rolloutPercent: 0,
      });
    },
  );

  it.each(CANVAS_FEATURE_FLAG_ENDPOINTS)(
    "$endpoint resolves the exact feature flag key configured for the route",
    async ({ endpoint, feature }) => {
      const config = CANVAS_FEATURE_FLAGS[feature];
      const response = await request(endpointApp({
        [config.enableEnv]: "true",
        [config.rolloutEnv]: "37.6",
      }))
        .get(endpoint)
        .expect(200);

      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body).toEqual({
        enabled: true,
        rolloutPercent: 38,
      });
    },
  );
});
