import { describe, expect, it } from "vitest";
import { canShowVoiceActionSimulator } from "./VoiceActionSimulator";

describe("canShowVoiceActionSimulator", () => {
  it("keeps the lab available during local development on localhost", () => {
    expect(canShowVoiceActionSimulator({
      isDev: true,
      flagValue: undefined,
      userRole: "user",
      hostname: "localhost",
    })).toBe(true);
  });

  it("hides the lab from regular users even when the feature flag is enabled", () => {
    expect(canShowVoiceActionSimulator({
      isDev: false,
      flagValue: "true",
      userRole: "user",
      hostname: "localhost",
    })).toBe(false);
  });

  it("shows the lab to admins only on localhost when the feature flag is enabled", () => {
    expect(canShowVoiceActionSimulator({
      isDev: false,
      flagValue: "true",
      userRole: "admin",
      hostname: "127.0.0.1",
    })).toBe(true);
  });

  it("hides the lab on deployed hosts even if the app is running in dev mode", () => {
    expect(canShowVoiceActionSimulator({
      isDev: true,
      flagValue: "true",
      userRole: "admin",
      hostname: "v2.vyva.life",
    })).toBe(false);
  });
});
