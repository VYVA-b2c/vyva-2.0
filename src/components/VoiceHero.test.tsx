import { act } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import VoiceHero from "./VoiceHero";

const voiceMocks = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  setMicrophoneMuted: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: voiceMocks.startVoice,
    stopVoice: voiceMocks.stopVoice,
    status: "idle",
    isSpeaking: false,
    isPreparing: false,
    isConnecting: false,
    transcript: [],
    voiceSessionPhase: null,
    isMicMuted: false,
    setMicrophoneMuted: voiceMocks.setMicrophoneMuted,
    voiceDiagnostics: [],
  }),
}));

vi.mock("@/hooks/useHeroMessage", () => ({
  useHeroMessage: () => undefined,
}));

vi.mock("@/components/VoiceCallOverlay", () => ({
  default: ({
    connectionError,
    onMinimize,
    onRetry,
  }: {
    connectionError?: string | null;
    onMinimize?: () => void;
    onRetry?: () => void;
  }) => (
    <div data-testid="voice-call-overlay" data-error={connectionError ?? ""}>
      {onMinimize && (
        <button type="button" data-testid="button-minimize-call" onClick={onMinimize}>
          Minimize
        </button>
      )}
      {onRetry && (
        <button type="button" data-testid="button-retry-call" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  ),
}));

function setNavigatorOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("VoiceHero status dot", () => {
  beforeEach(() => {
    setNavigatorOnline(true);
    voiceMocks.startVoice.mockClear();
    voiceMocks.stopVoice.mockClear();
    voiceMocks.setMicrophoneMuted.mockClear();
  });

  it("shows browser online state instead of idle voice state", () => {
    render(<VoiceHero headline="Good evening" weatherData={null} />);

    const statusDot = screen.getByTestId("voice-hero-status-dot");
    expect(statusDot).toHaveAttribute("title", "Online");
    expect(statusDot.querySelector("span")).toHaveStyle({ background: "#34D399" });
  });

  it("keeps the home hero avatar-free with only the small status dot up top", () => {
    render(
      <VoiceHero
        headline="Good morning"
        weatherData={{ city: "Tarifa", temperature: 24, description: "weather.clear" }}
        contextHint="app_open"
      />,
    );

    expect(screen.queryByAltText("VYVA")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-voice-hero-signal")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-hero-status-dot").querySelectorAll("svg")).toHaveLength(0);

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    expect(voiceMocks.startVoice).toHaveBeenCalledWith("app_open", undefined, undefined);
  });

  it("turns red when the browser goes offline", () => {
    render(<VoiceHero headline="Good evening" weatherData={null} />);

    setNavigatorOnline(false);
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const statusDot = screen.getByTestId("voice-hero-status-dot");
    expect(statusDot).toHaveAttribute("title", "Offline");
    expect(statusDot.querySelector("span")).toHaveStyle({ background: "#EF4444" });
  });

  it("passes a specialist agent slug when starting voice from the CTA", () => {
    render(<VoiceHero headline="Brain coach" contextHint="brain training" voiceAgentSlug="brain-coach" />);

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    expect(voiceMocks.startVoice).toHaveBeenCalledWith("brain training", undefined, {
      agentSlug: "brain-coach",
    });
  });

  it("does not start or show the call overlay just because Home configured tapped voice mode", () => {
    render(
      <VoiceHero
        headline="Good morning"
        weatherData={null}
        contextHint="app_open"
        voiceDynamicVariables={{ app_entrypoint: "home_open" }}
        autoStartListening
        showVoiceOverlay
      />,
    );

    expect(voiceMocks.startVoice).not.toHaveBeenCalled();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("keeps the existing start payload when no agent slug is provided", () => {
    render(<VoiceHero headline="Good evening" contextHint="app_open" />);

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    expect(voiceMocks.startVoice).toHaveBeenCalledWith("app_open", undefined, undefined);
  });

  it("starts the main VYVA agent when Home provides the main slug", () => {
    render(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        voiceDynamicVariables={{ app_entrypoint: "home_open" }}
        autoStartListening
      />,
    );

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    expect(voiceMocks.startVoice).toHaveBeenCalledWith("app_open", undefined, {
      agentSlug: "main-vyva",
      dynamicVariables: { app_entrypoint: "home_open" },
      autoStartListening: true,
    });
  });

  it("keeps an existing active voice session out of the full overlay when this hero was not tapped", () => {
    render(
      <VoiceHero
        headline="Concierge"
        showVoiceOverlay={false}
        voiceControls={{
          status: "connected",
          isSpeaking: false,
          isConnecting: false,
          transcript: [],
          onEnd: voiceMocks.stopVoice,
        }}
      />,
    );

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("opens the full overlay after the user chooses voice from any hero", () => {
    const baseVoiceControls = {
      status: "idle" as const,
      isSpeaking: false,
      isConnecting: false,
      transcript: [],
      onEnd: voiceMocks.stopVoice,
    };
    const { rerender } = render(
      <VoiceHero
        headline="Concierge"
        contextHint="concierge"
        voiceAgentSlug="concierge"
        showVoiceOverlay={false}
        voiceControls={baseVoiceControls}
      />,
    );

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));
    expect(voiceMocks.startVoice).toHaveBeenCalledWith("concierge", undefined, {
      agentSlug: "concierge",
    });

    rerender(
      <VoiceHero
        headline="Concierge"
        contextHint="concierge"
        voiceAgentSlug="concierge"
        showVoiceOverlay={false}
        voiceControls={{
          ...baseVoiceControls,
          status: "connecting",
          isConnecting: true,
        }}
      />,
    );

    expect(screen.getByTestId("voice-call-overlay")).toBeInTheDocument();
  });

  it("shows a checking label without opening the full overlay during voice readiness", () => {
    render(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay
        voiceControls={{
          status: "idle",
          isSpeaking: false,
          isPreparing: true,
          isConnecting: false,
          transcript: [],
          onEnd: voiceMocks.stopVoice,
        }}
      />,
    );

    expect(screen.getByTestId("button-voice-hero-talk")).toHaveTextContent("Checking voice...");
    expect(screen.getByTestId("button-voice-hero-talk")).toBeDisabled();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("keeps readiness failures inline instead of opening the purple overlay", () => {
    const baseVoiceControls = {
      status: "idle" as const,
      isSpeaking: false,
      isPreparing: false,
      isConnecting: false,
      transcript: [],
      onEnd: voiceMocks.stopVoice,
    };
    const { rerender } = render(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay
        voiceControls={baseVoiceControls}
      />,
    );

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    rerender(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay
        voiceControls={{
          ...baseVoiceControls,
          lastError: "Missing ElevenLabs API key",
          voiceDiagnostics: [
            { id: "browser_microphone", label: "Microphone", status: "passed", detail: "Microphone access granted" },
            { id: "account_access", label: "Account access", status: "passed", detail: "Voice access verified" },
            { id: "server_credentials", label: "Server key", status: "failed", detail: "Missing ElevenLabs API key" },
          ],
        }}
      />,
    );

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-hero-inline-error")).toHaveTextContent("Voice is not ready yet");
    expect(screen.getByTestId("voice-hero-inline-error")).toHaveTextContent("Missing ElevenLabs API key");
    expect(screen.getByTestId("voice-hero-diagnostics")).toHaveTextContent("Stopped at Server key");
    expect(screen.getByTestId("voice-hero-diagnostics")).toHaveTextContent("Microphone");
    expect(screen.getByTestId("voice-hero-diagnostics")).toHaveTextContent("OK");
    expect(screen.getByTestId("voice-hero-diagnostics")).toHaveTextContent("Server key");
    expect(screen.getByTestId("voice-hero-diagnostics")).toHaveTextContent("Stopped");

    fireEvent.click(screen.getByTestId("button-voice-hero-retry"));

    expect(voiceMocks.startVoice).toHaveBeenLastCalledWith("app_open", undefined, {
      agentSlug: "main-vyva",
    });
  });

  it("lets the user minimize the focused overlay without ending voice", () => {
    const baseVoiceControls = {
      status: "idle" as const,
      isSpeaking: false,
      isConnecting: false,
      transcript: [],
      onEnd: voiceMocks.stopVoice,
    };
    const { rerender } = render(
      <VoiceHero
        headline="Concierge"
        contextHint="concierge"
        voiceAgentSlug="concierge"
        showVoiceOverlay={false}
        voiceControls={baseVoiceControls}
      />,
    );

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    rerender(
      <VoiceHero
        headline="Concierge"
        contextHint="concierge"
        voiceAgentSlug="concierge"
        showVoiceOverlay={false}
        voiceControls={{
          ...baseVoiceControls,
          status: "connected",
        }}
      />,
    );

    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(voiceMocks.stopVoice).not.toHaveBeenCalled();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("keeps the focused overlay open when the voice connection fails after connecting starts", async () => {
    const baseVoiceControls = {
      status: "idle" as const,
      isSpeaking: false,
      isConnecting: false,
      transcript: [],
      onEnd: voiceMocks.stopVoice,
    };
    const { rerender } = render(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay={false}
        voiceControls={baseVoiceControls}
      />,
    );

    fireEvent.click(screen.getByTestId("button-voice-hero-talk"));

    rerender(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay={false}
        voiceControls={{
          ...baseVoiceControls,
          status: "connecting",
          isConnecting: true,
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("voice-call-overlay")).toBeInTheDocument());

    rerender(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        showVoiceOverlay={false}
        voiceControls={{
          ...baseVoiceControls,
          lastError: "Missing ElevenLabs API key",
        }}
      />,
    );

    expect(screen.getByTestId("voice-call-overlay")).toHaveAttribute("data-error", "Missing ElevenLabs API key");
  });

  it("retries the same voice start payload from an inline readiness error", () => {
    const baseVoiceControls = {
      status: "idle" as const,
      isSpeaking: false,
      isConnecting: false,
      transcript: [],
      onEnd: voiceMocks.stopVoice,
      lastError: "Missing ElevenLabs API key",
    };
    render(
      <VoiceHero
        headline="Good morning"
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        voiceDynamicVariables={{ app_entrypoint: "home_open" }}
        autoStartListening
        showVoiceOverlay
        voiceControls={baseVoiceControls}
      />,
    );

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-voice-hero-retry"));

    expect(voiceMocks.startVoice).toHaveBeenLastCalledWith("app_open", undefined, {
      agentSlug: "main-vyva",
      dynamicVariables: { app_entrypoint: "home_open" },
      autoStartListening: true,
    });
  });
});
