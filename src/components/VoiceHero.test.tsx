import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
    isConnecting: false,
    transcript: [],
    voiceSessionPhase: null,
    isMicMuted: false,
    setMicrophoneMuted: voiceMocks.setMicrophoneMuted,
  }),
}));

vi.mock("@/hooks/useHeroMessage", () => ({
  useHeroMessage: () => undefined,
}));

vi.mock("@/components/VoiceCallOverlay", () => ({
  default: ({ connectionError, onRetry }: { connectionError?: string | null; onRetry?: () => void }) => (
    <div data-testid="voice-call-overlay" data-error={connectionError ?? ""}>
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

  it("keeps the focused overlay open when the voice connection fails", () => {
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
          lastError: "Missing ElevenLabs API key",
        }}
      />,
    );

    expect(screen.getByTestId("voice-call-overlay")).toHaveAttribute("data-error", "Missing ElevenLabs API key");
  });

  it("retries the same voice start payload from the error overlay", () => {
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

    fireEvent.click(screen.getByTestId("button-retry-call"));

    expect(voiceMocks.startVoice).toHaveBeenCalledWith("app_open", undefined, {
      agentSlug: "main-vyva",
      dynamicVariables: { app_entrypoint: "home_open" },
      autoStartListening: true,
    });
  });
});
