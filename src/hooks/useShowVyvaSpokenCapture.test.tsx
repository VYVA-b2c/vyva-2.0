import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VYVA_VOICE_USER_MESSAGE_EVENT } from "@/lib/voiceNavigation";
import {
  SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY,
  useShowVyvaSpokenCapture,
} from "./useShowVyvaSpokenCapture";

const mocks = vi.hoisted(() => ({
  language: "en",
  speechOptions: null as null | { onTranscript: (text: string) => void },
  recognition: {
    isSupported: true,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  },
  speakText: vi.fn(() => true),
  stopTts: vi.fn(),
  sharedVoice: null as null | {
    status: string;
    isMicMuted: boolean;
    isSpeaking: boolean;
    interruptAgentAudio: ReturnType<typeof vi.fn>;
  },
}));

const copy: Record<string, string> = {
  "showVyva.liveCamera.spoken.prompt.find_more_light": "Find more light.",
  "showVyva.liveCamera.spoken.prompt.move_closer": "Move closer.",
  "showVyva.liveCamera.spoken.prompt.tilt_away_from_glare": "Tilt away from the glare.",
  "showVyva.liveCamera.spoken.prompt.hold_steady": "Hold steady.",
  "showVyva.liveCamera.spoken.countdown.three": "Three",
  "showVyva.liveCamera.spoken.countdown.two": "Two",
  "showVyva.liveCamera.spoken.countdown.one": "One",
  "showVyva.liveCamera.spoken.captured": "Photo taken.",
};

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: mocks.language,
    t: (key: string) => copy[key] ?? key,
  }),
}));

vi.mock("@/games/memory/useSpeechRecognition", () => ({
  useSpeechRecognition: (options: { onTranscript: (text: string) => void }) => {
    mocks.speechOptions = options;
    return mocks.recognition;
  },
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => mocks.sharedVoice,
  useTtsReadout: () => ({
    speakText: mocks.speakText,
    stopTts: mocks.stopTts,
    isTtsSupported: true,
    isTtsSpeaking: false,
  }),
}));

function renderCapture(overrides: Partial<Parameters<typeof useShowVyvaSpokenCapture>[0]> = {}) {
  const callbacks = {
    onTakePhoto: vi.fn(),
    onCancel: vi.fn(),
    onUpload: vi.fn(),
  };
  const initialProps = {
    phase: "live" as const,
    status: "ready" as const,
    countdown: null as number | null,
    ...callbacks,
    ...overrides,
  };
  const hook = renderHook((props) => useShowVyvaSpokenCapture(props), { initialProps });
  return { ...hook, callbacks };
}

describe("useShowVyvaSpokenCapture", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.language = "en";
    mocks.speechOptions = null;
    mocks.sharedVoice = null;
    mocks.recognition.isSupported = true;
    mocks.recognition.isListening = false;
    mocks.recognition.startListening.mockReset();
    mocks.recognition.stopListening.mockReset();
    mocks.speakText.mockReset();
    mocks.speakText.mockReturnValue(true);
    mocks.stopTts.mockReset();
  });

  afterEach(() => cleanup());

  it("speaks short coaching and each countdown step", () => {
    const { rerender } = renderCapture({ status: "dark" });
    expect(mocks.speakText).toHaveBeenCalledWith("Find more light.", "en-US", undefined);

    act(() => rerender({
      phase: "live",
      status: "ready",
      countdown: 3,
      onTakePhoto: vi.fn(),
      onCancel: vi.fn(),
      onUpload: vi.fn(),
    }));
    expect(mocks.speakText).toHaveBeenLastCalledWith("Three", "en-US", undefined);

    act(() => rerender({
      phase: "live",
      status: "ready",
      countdown: 2,
      onTakePhoto: vi.fn(),
      onCancel: vi.fn(),
      onUpload: vi.fn(),
    }));
    expect(mocks.speakText).toHaveBeenLastCalledWith("Two", "en-US", undefined);
  });

  it("runs camera actions from local and shared voice transcripts", () => {
    const { callbacks } = renderCapture();
    act(() => mocks.speechOptions?.onTranscript("Take photo"));
    expect(callbacks.onTakePhoto).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
      detail: { text: "Upload instead" },
    })));
    expect(callbacks.onUpload).toHaveBeenCalledTimes(1);

    act(() => window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
      detail: { text: "Cancel" },
    })));
    expect(callbacks.onCancel).toHaveBeenCalledTimes(1);
  });

  it("announces a successful capture before resolving", async () => {
    const { result } = renderCapture();
    let announcement: Promise<void>;
    act(() => {
      announcement = result.current.announceCaptureSuccess();
    });
    expect(mocks.speakText).toHaveBeenLastCalledWith(
      "Photo taken.",
      "en-US",
      expect.objectContaining({ onComplete: expect.any(Function), onError: expect.any(Function) }),
    );
    const options = mocks.speakText.mock.calls.at(-1)?.[2] as { onComplete?: () => void };
    act(() => options.onComplete?.());
    await expect(announcement!).resolves.toBeUndefined();
  });

  it("respects the persisted spoken-guidance preference", () => {
    window.localStorage.setItem(SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY, "off");
    const { result } = renderCapture({ status: "dark" });
    expect(mocks.speakText).not.toHaveBeenCalled();

    act(() => result.current.toggleSpokenGuidance());
    expect(window.localStorage.getItem(SHOW_VYVA_SPOKEN_GUIDANCE_STORAGE_KEY)).toBe("on");
  });

  it("uses the shared voice transcript without opening a second microphone", () => {
    mocks.sharedVoice = {
      status: "connected",
      isMicMuted: false,
      isSpeaking: false,
      interruptAgentAudio: vi.fn(),
    };
    const { callbacks } = renderCapture();
    expect(mocks.recognition.startListening).not.toHaveBeenCalled();

    act(() => window.dispatchEvent(new CustomEvent(VYVA_VOICE_USER_MESSAGE_EVENT, {
      detail: { text: "Take photo" },
    })));
    expect(callbacks.onTakePhoto).toHaveBeenCalledTimes(1);
  });
});
