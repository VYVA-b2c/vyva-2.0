import { describe, expect, it } from "vitest";
import { canShowVoiceActionSimulator } from "./VoiceActionSimulator";

describe("canShowVoiceActionSimulator", () => {
  it("keeps the lab available during local development", () => {
    expect(canShowVoiceActionSimulator({
      isDev: true,
      flagValue: undefined,
      userRole: "user",
    })).toBe(true);
  });

  it("hides the production lab from regular users even when the feature flag is enabled", () => {
    expect(canShowVoiceActionSimulator({
      isDev: false,
      flagValue: "true",
      userRole: "user",
    })).toBe(false);
  });

  it("shows the production lab only to admins when the feature flag is enabled", () => {
    expect(canShowVoiceActionSimulator({
      isDev: false,
      flagValue: "true",
      userRole: "admin",
    })).toBe(true);
  });
});
