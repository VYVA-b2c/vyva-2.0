import { type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import VoiceCallOverlay from "./VoiceCallOverlay";
import type { TranscriptEntry, VoiceDiagnosticStep } from "@/hooks/useVyvaVoice";
import { VYVA_OPEN_SOS_EVENT } from "@/lib/sosEvents";
import type { VoiceSessionPhase } from "@/lib/voiceSessionState";

const overlayVoiceState = vi.hoisted(() => ({
  status: "idle" as "idle" | "connecting" | "connected",
  isSpeaking: false,
  isConnecting: false,
  isMicMuted: false,
  voiceSessionPhase: "idle" as VoiceSessionPhase,
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => overlayVoiceState,
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: vi.fn(),
  },
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

describe("VoiceCallOverlay voice room", () => {
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
    overlayVoiceState.status = "idle";
    overlayVoiceState.isSpeaking = false;
    overlayVoiceState.isConnecting = false;
    overlayVoiceState.isMicMuted = false;
    overlayVoiceState.voiceSessionPhase = "idle";
    baseProps.onEnd.mockClear();
    baseProps.onMinimize.mockClear();
    canvasMocks.forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows the calm voice room with the VYVA transcript as the main message", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }], {
      onMicToggle: vi.fn(),
      onType: vi.fn(),
      isSpeaking: true,
    });

    expect(screen.getByTestId("voice-call-header")).toBeInTheDocument();
    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Hello Karim");
    expect(screen.getByTestId("text-call-transcript")).toHaveClass("font-body");
    expect(screen.queryByTestId("text-call-subtitle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-call-transcript-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-mode-zamora-orb")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-indicator-zamora-orb")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-call-speaker")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-call-status")).toHaveTextContent("Speaking");
    expect(screen.getByTestId("button-toggle-call-mic")).toHaveTextContent("Mic on");
    expect(screen.getByTestId("button-end-call")).toHaveTextContent("End");
    expect(screen.getByTestId("button-type-call")).toHaveTextContent("Touch");
  });

  it("keeps user transcript as a small preview instead of a giant word", () => {
    renderOverlay([{ from: "user", text: "Hello VYVA", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("I'm listening");
    expect(screen.getByTestId("text-call-transcript-preview")).toHaveTextContent("You: Hello VYVA");
  });

  it("shows mic off when the microphone is muted", () => {
    renderOverlay([], {
      isMicMuted: true,
      onMicToggle: vi.fn(),
    });

    expect(screen.getByTestId("button-toggle-call-mic")).toHaveTextContent("Mic off");
  });

  it("keeps the latest VYVA caption visible after the user replies", () => {
    renderOverlay([
      { from: "vyva", text: "Tell me what feels different today.", timestamp: 1 },
      { from: "user", text: "My head hurts", timestamp: 2 },
    ]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Tell me what feels different today.");
    expect(screen.getByTestId("text-call-transcript-preview")).toHaveTextContent("You: My head hurts");
  });

  it("updates the main transcript when a new VYVA transcript arrives", () => {
    const { rerender } = renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Hello Karim");

    rerender(
      <VoiceCallOverlay
        {...baseProps}
        transcript={[{ from: "vyva", text: "Welcome back", timestamp: 2 }]}
      />,
    );

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Welcome back");
  });

  it("plays long VYVA transcripts as readable caption chunks", () => {
    const longTranscript = "Soy su asistente personal. Puedo ayudarle con muchas cosas, como recordarle sus medicinas, hacer ejercicios para la mente, revisar sus síntomas si no se siente bien, o simplemente charlar un rato.";
    renderOverlay([{ from: "vyva", text: longTranscript, timestamp: 1 }], { isSpeaking: true });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Soy su asistente personal.");
    expect(screen.getByTestId("text-call-transcript")).not.toHaveTextContent("hacer ejercicios para la mente");

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Puedo ayudarle con muchas cosas, como recordarle sus medicinas,");
  });

  it("keeps the connecting state clear when no transcript is available", () => {
    renderOverlay([], { isConnecting: true });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Getting ready");
    expect(screen.getByTestId("text-call-subtitle")).toHaveTextContent("Opening voice with VYVA.");
  });

  it("keeps long main transcripts contained", () => {
    renderOverlay([{ from: "vyva", text: "Supercalifragilisticexpialidocious", timestamp: 1 }]);

    expect(screen.queryByTestId("text-call-transcript-preview")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-call-transcript")).toHaveStyle({
      maxWidth: "min(88vw, 560px)",
      maxHeight: "min(34vh, 260px)",
      overflowWrap: "anywhere",
      margin: "0",
    });
  });

  it("minimizes the focused voice screen without ending the session", () => {
    renderOverlay([{ from: "vyva", text: "Hello Karim", timestamp: 1 }]);

    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(baseProps.onMinimize).toHaveBeenCalledTimes(1);
    expect(baseProps.onEnd).not.toHaveBeenCalled();
  });

  it("renders a Canvas question and submits typed input through the shared callback", () => {
    const onCanvasPrimary = vi.fn();
    renderOverlay([], {
      canvasViewModel: {
        sceneId: "ride-destination",
        kind: "text-entry",
        title: "Where are you going?",
        textEntry: {
          label: "Destination",
          value: "",
          placeholder: "Type an address",
        },
        primaryAction: { label: "Continue" },
      },
      onCanvasPrimary,
    });

    expect(screen.getByTestId("voice-canvas-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-mode-zamora-orb")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Destination"), { target: { value: "10 Market Street" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onCanvasPrimary).toHaveBeenCalledWith("10 Market Street");
  });

  it("keeps the VYVA agent presence visible inside an active Canvas scene", () => {
    overlayVoiceState.status = "connected";
    overlayVoiceState.isSpeaking = true;
    overlayVoiceState.voiceSessionPhase = "speaking";

    renderOverlay([], {
      canvasViewModel: {
        sceneId: "ride-provider",
        kind: "choice",
        title: "Which ride option looks best?",
        helperText: "Compare the visible options while VYVA explains them.",
        agentPresenceCopy: {
          idleLabel: "VYVA is ready",
          idleDescription: "Use voice or touch.",
          listeningLabel: "Listening with you",
          listeningDescription: "Say or tap one option.",
          speakingLabel: "VYVA is speaking",
          speakingDescription: "The screen stays on the same choice.",
          thinkingLabel: "Checking options",
          thinkingDescription: "Review the screen.",
          accessibleLabel: "VYVA ride voice status",
        },
        blocks: [{
          kind: "option-card",
          id: "carecab",
          title: "CareCab",
          subtitle: "Best reputation",
          accessibleLabel: "Choose CareCab",
        }],
      },
    });

    expect(screen.getByTestId("voice-canvas-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-mode-zamora-orb")).not.toBeInTheDocument();
    const canvas = screen.getByRole("region", { name: "Which ride option looks best?" });
    expect(canvas).toHaveAttribute("data-agent-presence", "true");
    expect(canvas).toHaveAttribute("data-agent-state", "speaking");
    expect(screen.getByLabelText("VYVA ride voice status")).toHaveTextContent("VYVA is speaking");
    expect(screen.getByText("The screen stays on the same choice.")).toBeInTheDocument();
    expect(screen.getByTestId("voice-canvas-agent-orb-ride-provider")).toBeInTheDocument();
  });

  it("calls the type escape when available", () => {
    const onType = vi.fn();
    renderOverlay([], { onType });

    fireEvent.click(screen.getByTestId("button-type-call"));

    expect(onType).toHaveBeenCalledTimes(1);
    expect(baseProps.onMinimize).not.toHaveBeenCalled();
  });

  it("opens SOS through the shared shell event and minimizes the overlay", () => {
    const onSos = vi.fn();
    window.addEventListener(VYVA_OPEN_SOS_EVENT, onSos);

    renderOverlay([]);
    fireEvent.click(screen.getByTestId("button-voice-sos"));

    expect(onSos).toHaveBeenCalledTimes(1);
    expect(baseProps.onMinimize).toHaveBeenCalledTimes(1);

    window.removeEventListener(VYVA_OPEN_SOS_EVENT, onSos);
  });

  it("keeps the warm voice room in an error state with retry available", () => {
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

  it("shows account profile access failures without blaming ElevenLabs", () => {
    renderOverlay([], {
      connectionError: "Account access is disabled for the active profile. Active profile: abc12345...7890. Status: disabled.",
      connectionErrorCode: "VOICE_ACCOUNT_ACCESS_DISABLED",
      voiceDiagnostics: [
        { id: "browser_microphone", label: "Microphone", status: "passed", detail: "Microphone access granted" },
        {
          id: "account_access",
          label: "Account access",
          status: "failed",
          detail: "Account access is disabled for the active profile. Active profile: abc12345...7890. Status: disabled.",
        },
      ],
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Account access failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("Account access is disabled for the active profile.");
    expect(screen.getByTestId("voice-call-diagnostics")).toHaveTextContent("Stopped at Account access");
  });

  it("infers access verification failures from the server message", () => {
    renderOverlay([], {
      connectionError: "We could not verify access right now. Please try again.",
    });

    expect(screen.getByTestId("text-call-transcript")).toHaveTextContent("Access check failed");
    expect(screen.getByTestId("text-call-error-detail")).toHaveTextContent("VYVA could not verify account access right now. Please try again.");
  });
});
