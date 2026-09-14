import { describe, expect, it } from "vitest";
import {
  isProviderReplyCanvasEnabled,
  parseProviderReplyCanvasRolloutConfig,
} from "./providerReplyCanvasRollout";

describe("provider reply Canvas rollout", () => {
  it("fails closed for missing or malformed runtime configuration", () => {
    expect(parseProviderReplyCanvasRolloutConfig(undefined)).toEqual({
      enabled: false,
      rolloutPercent: 0,
    });
    expect(
      parseProviderReplyCanvasRolloutConfig({
        enabled: true,
        rolloutPercent: "bad",
      }),
    ).toEqual({ enabled: true, rolloutPercent: 0 });
    expect(isProviderReplyCanvasEnabled(undefined, "reply-1")).toBe(false);
  });

  it("supports immediate full enable and kill-switch disable", () => {
    expect(
      isProviderReplyCanvasEnabled(
        { enabled: true, rolloutPercent: 100 },
        "reply-1",
      ),
    ).toBe(true);
    expect(
      isProviderReplyCanvasEnabled(
        { enabled: false, rolloutPercent: 100 },
        "reply-1",
      ),
    ).toBe(false);
  });

  it("assigns partial rollout cohorts deterministically", () => {
    const config = { enabled: true, rolloutPercent: 25 };
    expect(isProviderReplyCanvasEnabled(config, "reply-1")).toBe(
      isProviderReplyCanvasEnabled(config, "reply-1"),
    );
  });
});
