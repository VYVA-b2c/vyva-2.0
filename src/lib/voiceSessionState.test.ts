import { describe, expect, it } from "vitest";
import { deriveVoiceSessionPhase, voiceSessionPhaseLabel } from "./voiceSessionState";

describe("voice session state", () => {
  it("keeps transfer state ahead of idle teardown", () => {
    expect(deriveVoiceSessionPhase({
      status: "idle",
      isTransferring: true,
      hasEnded: true,
    })).toBe("transferring");
  });

  it("separates listening, muted, and speaking while connected", () => {
    expect(deriveVoiceSessionPhase({
      status: "connected",
      isMicMuted: false,
    })).toBe("listening");

    expect(deriveVoiceSessionPhase({
      status: "connected",
      isMicMuted: true,
    })).toBe("muted");

    expect(deriveVoiceSessionPhase({
      status: "connected",
      isMicMuted: false,
      isSpeaking: true,
    })).toBe("speaking");
  });

  it("labels muted state as mic off", () => {
    expect(voiceSessionPhaseLabel("muted")).toBe("Mic off");
  });
});
