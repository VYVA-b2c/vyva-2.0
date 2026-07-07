import { describe, expect, it } from "vitest";
import { adjustBreathingIntentForControl, parseBreathingVoiceText } from "./breathingVoice";

describe("breathing voice parser", () => {
  it("extracts sleep intent, duration, and gentle difficulty", () => {
    expect(parseBreathingVoiceText("I need help sleeping for five minutes, something easy")).toEqual({
      intent: expect.objectContaining({
        purpose: "sleep",
        mood: "restless",
        durationMinutes: 5,
        difficulty: "easy",
        mode: "voice",
      }),
    });
  });

  it("detects safety stop language", () => {
    expect(parseBreathingVoiceText("I feel dizzy and I can't breathe")).toMatchObject({
      safetyBlock: true,
      intent: {
        safetyFlags: ["dizziness", "shortness of breath"],
      },
    });
  });

  it("recognizes common controls", () => {
    expect(parseBreathingVoiceText("yes start")).toEqual({ control: "confirm" });
    expect(parseBreathingVoiceText("please slow down")).toEqual({ control: "slower" });
    expect(parseBreathingVoiceText("make it shorter")).toEqual({ control: "shorter" });
    expect(parseBreathingVoiceText("stop now")).toEqual({ control: "stop" });
  });

  it("adjusts intent for plan changes", () => {
    expect(adjustBreathingIntentForControl({ purpose: "sleep", durationMinutes: 5 }, "shorter")).toMatchObject({
      purpose: "sleep",
      durationMinutes: 4,
    });
    expect(adjustBreathingIntentForControl({ purpose: "focus" }, "easier")).toMatchObject({
      purpose: "focus",
      difficulty: "easy",
    });
  });
});
