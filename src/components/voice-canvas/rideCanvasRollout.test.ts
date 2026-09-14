import { describe, expect, it } from "vitest";
import { isRideCanvasEnabled, parseRideCanvasRolloutConfig } from "./rideCanvasRollout";

describe("ride Canvas rollout", () => {
  it("fails closed for missing or malformed runtime configuration", () => {
    expect(parseRideCanvasRolloutConfig(undefined)).toEqual({ enabled: false, rolloutPercent: 0 });
    expect(parseRideCanvasRolloutConfig({ enabled: true, rolloutPercent: 400 })).toEqual({ enabled: true, rolloutPercent: 100 });
    expect(isRideCanvasEnabled(undefined, "person-1")).toBe(false);
  });

  it("supports an immediate global kill switch and full rollout", () => {
    expect(isRideCanvasEnabled({ enabled: false, rolloutPercent: 100 }, "person-1")).toBe(false);
    expect(isRideCanvasEnabled({ enabled: true, rolloutPercent: 100 }, "person-1")).toBe(true);
  });

  it("assigns partial rollout cohorts deterministically", () => {
    const config = { enabled: true, rolloutPercent: 35 };
    expect(isRideCanvasEnabled(config, "stable-person")).toBe(isRideCanvasEnabled(config, "stable-person"));
  });
});
