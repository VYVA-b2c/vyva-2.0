import { act, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import VoiceCallOverlay from "./VoiceCallOverlay";
import type { TranscriptEntry, VoiceDiagnosticStep } from "@/hooks/useVyvaVoice";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const baseProps = {
  isSpeaking: false,
  isConnecting: false,
  transcript: [] as TranscriptEntry[],
  onEnd: vi.fn(),
  onMinimize: vi.fn(),
};

const canvasGradientMock = {
  addColorStop: vi.fn(),
};

const canvasContextMock = {
  clearRect: vi.fn(),
  save: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  clip: vi.fn(),
  createRadialGradient: vi.fn(() => canvasGradientMock),
  fillRect: vi.fn(),
  fill: vi.fn(),
  restore: vi.fn(),
  setTransform: vi.fn(),
};

const canvasMocks = [
  canvasGradientMock.addColorStop,
  canvasContextMock.clearRect,
  canvasContextMock.save,
  canvasContextMock.beginPath,
  canvasContextMock.arc,
  canvasContextMock.clip,
  canvasContextMock.createRadialGradient,
  canvasContextMock.fillRect,
  canvasContextMock.fill,
  canvasContextMock.restore,
  canvasContextMock.setTransform,
];

function renderOverlay(transcript: TranscriptEntry[], props: Partial<ComponentProps<typeof VoiceCallOverlay>> = {}) {
  return render(
    <VoiceCallOverlay
      {...baseProps}
      {...props}
      transcript={transcript}
    />,
  );
}

describe("VoiceCallOverlay word transcript", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalResizeObserver = window.ResizeObserver;

  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => canvasContextMock),
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)),
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: vi.fn((timerId: number) => window.clearTimeout(timerId)),
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: class ResizeObserverMock {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalGetContext,
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalRequestAnimationFrame,
    });
    Object.defineProperty(window, "cancelAnimationFrame", {
      configurable: true,
      writable: true,
      value: originalCancelAnimationFrame,
    });
    Object.defineProperty(window, "ResizeObserver", {
      configurable: true,
      value: originalResizeObserver,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
    baseProps.onEnd.mockClear();
    baseProps.onMinimize.mockClear();
    canvasMocks.forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows VYVA transcript one word at a time", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Hello");
    expect(screen.getByTestId("text-call-transcript")).toHaveClass("font-body");
    expect(screen.getByTestId("text-call-transcript")).not.toHaveClass("font-display");
    expect(screen.getByTestId("voice-mode-zamora-orb")).toBeInTheDocument();
    expect(screen.getByTestId("voice-indicator-zamora-orb")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(450);
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Karim");
  });

  it("does not animate user transcript as the large word transcript", () => {
    renderOverlay([{ from: "user", text: "Hello VYVA", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("voiceHero.listening");
    expect(screen.queryByTestId("text-call-speaker")).not.toBeInTheDocument();
  });

  it("resets playback when a new VYVA transcript arrives", () => {
    const { rerender } = renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    act(() => {
      vi.advanceTimersByTime(450);
    });
    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Karim");

    act(() => {
      rerender(
        <VoiceCallOverlay
          {...baseProps}
          transcript={[{ from: "vyva", text: "Welcome back", timestamp: 2 }]}
        />,
      );
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Welcome");
  });

  it("keeps the connecting fallback when no VYVA transcript is available", () => {
    renderOverlay([], { isConnecting: true });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("voiceHero.connecting");
  });

  it("keeps long words contained with responsive transcript styles", () => {
    renderOverlay([{ from: "vyva", text: "Supercalifragilisticexpialidocious", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveStyle({
      fontSize: "clamp(56px, 16vw, 118px)",
      maxWidth: "90vw",
      overflowWrap: "anywhere",
    });
  });

  it("minimizes the focused voice screen without ending the session", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(baseProps.onMinimize).toHaveBeenCalledTimes(1);
    expect(baseProps.onEnd).not.toHaveBeenCalled();
  });

  it("keeps the purple screen in an error state with retry available", () => {
    const onRetry = vi.fn();
    const voiceDiagnostics: VoiceDiagnosticStep[] = [
      { id: "browser_microphone", label: "Microphone", status: "passed", detail: "Microphone access granted" },
      { id: "account_access", label: "Account access", status: "passed", detail: "Voice access verified" },
      { id: "server_credentials", label: "Server key", status: "failed", detail: "Missing ElevenLabs API key" },
    ];
    renderOverlay([], {
      connectionError: "Missing ElevenLabs API key",
      connectionErrorCode: "ELEVENLABS_API_KEY_MISSING",
      voiceDiagnostics,
      onRetry,
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Voice setup needed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("The ElevenLabs API key is missing on the server.");
    expect(screen.getByTestId("text-call-status")).toHaveTextContent("Setup needed");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("Stopped at Server key");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("Microphone");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("OK");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("Server key");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("Stopped");

    fireEvent.click(screen.getByTestId("button-retry-call"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers a back-to-app escape when voice is in an error state", () => {
    renderOverlay([], {
      connectionError: "We could not verify access right now. Please try again.",
      connectionErrorCode: "VOICE_ACCESS_UNAVAILABLE",
    });

    fireEvent.click(screen.getByTestId("button-back-to-app"));

    expect(baseProps.onMinimize).toHaveBeenCalledTimes(1);
    expect(baseProps.onEnd).not.toHaveBeenCalled();
  });

  it("shows a clear microphone permission message", () => {
    renderOverlay([], {
      connectionError: "Microphone permission was denied.",
      connectionErrorCode: "MICROPHONE_PERMISSION_DENIED",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Microphone is blocked");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("Please allow microphone access for VYVA, then try again.");
  });

  it("shows the missing agent setup reason", () => {
    renderOverlay([], {
      connectionError: "No ElevenLabs agent configured for this room yet.",
      connectionErrorCode: "ELEVENLABS_AGENT_MISSING",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Voice setup needed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("No ElevenLabs agent is configured for this voice entry point.");
  });

  it("shows a safe session start failure detail without leaking the signed URL", () => {
    renderOverlay([], {
      connectionError: "Failed to connect to wss://api.elevenlabs.io/v1/convai/conversation?token=secret-token&agent_id=agent_123 because websocket closed with code 1006",
      connectionErrorCode: "VOICE_SESSION_START_FAILED",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Voice session failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("ElevenLabs could not start: Failed to connect to [voice session url hidden] because websocket closed with code 1006");
    expect(screen.getByTestId("text-call-error-detail")).not.toHaveTextContent("secret-token");
  });

  it("infers session start failures from generic startup messages", () => {
    renderOverlay([], {
      connectionError: "Unable to start voice session",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Voice session failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("ElevenLabs could not start: Unable to start voice session");
  });

  it("shows access verification failures without blaming ElevenLabs", () => {
    renderOverlay([], {
      connectionError: "We could not verify access right now. Please try again.",
      connectionErrorCode: "VOICE_ACCESS_UNAVAILABLE",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Access check failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("VYVA could not verify account access right now. Please try again.");
  });

  it("infers access verification failures from the server message", () => {
    renderOverlay([], {
      connectionError: "We could not verify access right now. Please try again.",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Access check failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("VYVA could not verify account access right now. Please try again.");
  });
});
