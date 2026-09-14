import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTtsReadout, type TtsSegment } from "./useVyvaVoice";

class MockSpeechSynthesisUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const spoken: MockSpeechSynthesisUtterance[] = [];
const speechSynthesis = {
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
    spoken.push(utterance);
    utterance.onstart?.();
  }),
  getVoices: vi.fn(() => [
    { default: true, lang: "en-US", localService: true, name: "English", voiceURI: "english" },
    { default: false, lang: "fr-FR", localService: true, name: "French", voiceURI: "french" },
  ] as SpeechSynthesisVoice[]),
};

describe("useTtsReadout", () => {
  beforeEach(() => {
    spoken.length = 0;
    Object.values(speechSynthesis).forEach((mock) => "mockClear" in mock && mock.mockClear());
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    });
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: speechSynthesis,
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
    Reflect.deleteProperty(window, "speechSynthesis");
  });

  it("plays a localized sequence and supports pause, resume, stop, and replay", async () => {
    const progress = vi.fn();
    const complete = vi.fn();
    const segments: TtsSegment[] = [
      { text: "Bonjour", lang: "fr", delayMs: 0 },
      { text: "Lecon", lang: "fr", delayMs: 0 },
    ];
    const { result } = renderHook(() => useTtsReadout());

    act(() => {
      expect(result.current.speakSequence(segments, { onProgress: progress, onComplete: complete })).toBe(true);
    });

    expect(result.current.playbackStatus).toBe("playing");
    expect(spoken[0]).toMatchObject({ text: "Bonjour", lang: "fr-FR", rate: 0.9 });
    expect(spoken[0].voice?.name).toBe("French");
    expect(progress).toHaveBeenCalledWith(0, 2);

    act(() => {
      expect(result.current.pauseTts()).toBe(true);
    });
    expect(speechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(result.current.playbackStatus).toBe("paused");

    act(() => {
      expect(result.current.resumeTts()).toBe(true);
    });
    expect(speechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(result.current.playbackStatus).toBe("playing");

    await act(async () => {
      spoken[0].onend?.();
      await new Promise((resolve) => window.setTimeout(resolve, 5));
    });
    expect(spoken[1].text).toBe("Lecon");
    expect(progress).toHaveBeenLastCalledWith(1, 2);

    act(() => spoken[1].onend?.());
    expect(result.current.playbackStatus).toBe("completed");
    expect(complete).toHaveBeenCalledTimes(1);

    act(() => {
      expect(result.current.replayTts()).toBe(true);
    });
    expect(spoken[2].text).toBe("Bonjour");

    act(() => result.current.stopTts());
    expect(speechSynthesis.cancel).toHaveBeenCalled();
    expect(result.current.playbackStatus).toBe("idle");
  });

  it("reports playback as unavailable when the browser has no speech engine", () => {
    Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
    Reflect.deleteProperty(window, "speechSynthesis");
    const { result } = renderHook(() => useTtsReadout());

    expect(result.current.isTtsSupported).toBe(false);
    expect(result.current.playbackStatus).toBe("unavailable");
    expect(result.current.speakText("Hello", "en")).toBe(false);
  });
});
