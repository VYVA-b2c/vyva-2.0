import { fireEvent, render, screen } from "@testing-library/react";
import VyvaSessionCta from "./VyvaSessionCta";

const voiceState = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  setMicrophoneMuted: vi.fn(),
  status: "idle" as "idle" | "connecting" | "connected",
  isSpeaking: false,
  isPreparing: false,
  isConnecting: false,
  transcript: [] as Array<{ from: "user" | "vyva"; text: string; timestamp: number }>,
  voiceSessionPhase: "idle" as "idle" | "connecting" | "listening" | "muted" | "speaking" | "transferring" | "ended" | "error",
  isMicMuted: false,
  lastError: null as string | null,
  lastErrorCode: null,
  voiceDiagnostics: [],
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => voiceState,
}));

vi.mock("@/components/VoiceCallOverlay", () => ({
  default: ({
    onEnd,
    onMinimize,
  }: {
    onEnd: () => void;
    onMinimize?: () => void;
  }) => (
    <div data-testid="voice-call-overlay">
      <button type="button" data-testid="button-minimize-call" onClick={onMinimize}>
        Minimize
      </button>
      <button type="button" data-testid="button-end-call" onClick={onEnd}>
        End
      </button>
    </div>
  ),
}));

describe("VyvaSessionCta", () => {
  beforeEach(() => {
    voiceState.startVoice.mockClear();
    voiceState.stopVoice.mockClear();
    voiceState.setMicrophoneMuted.mockClear();
    voiceState.status = "idle";
    voiceState.isSpeaking = false;
    voiceState.isPreparing = false;
    voiceState.isConnecting = false;
    voiceState.transcript = [];
    voiceState.voiceSessionPhase = "idle";
    voiceState.isMicMuted = false;
    voiceState.lastError = null;
  });

  it("starts a voice session with page context when idle", () => {
    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        contextHint="Mind and memory support"
        voiceAgentSlug="brain-coach"
        voiceDynamicVariables={{ app_entrypoint: "mind_memory_master_hero" }}
        autoStartListening
        testId="button-session"
      />,
    );

    fireEvent.click(screen.getByTestId("button-session"));

    expect(voiceState.startVoice).toHaveBeenCalledWith("Mind and memory support", undefined, {
      agentSlug: "brain-coach",
      dynamicVariables: { app_entrypoint: "mind_memory_master_hero" },
      autoStartListening: true,
    });
  });

  it("opens the existing voice screen instead of starting a second session", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "listening";

    render(<VyvaSessionCta label="Talk to VYVA" testId="button-session" />);

    expect(screen.getByTestId("button-session")).toHaveTextContent("Listening");

    fireEvent.click(screen.getByTestId("button-session"));

    expect(voiceState.startVoice).not.toHaveBeenCalled();
    expect(screen.getByTestId("voice-call-overlay")).toBeInTheDocument();
  });

  it("minimizes the focused voice screen without ending the session", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "listening";

    render(<VyvaSessionCta label="Talk to VYVA" testId="button-session" />);

    fireEvent.click(screen.getByTestId("button-session"));
    fireEvent.click(screen.getByTestId("button-minimize-call"));

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(voiceState.stopVoice).not.toHaveBeenCalled();
  });

  it("only ends the session from the focused voice screen end control", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "speaking";

    render(<VyvaSessionCta label="Talk to VYVA" testId="button-session" />);

    expect(screen.getByTestId("button-session")).toHaveTextContent("VYVA speaking");
    fireEvent.click(screen.getByTestId("button-session"));
    fireEvent.click(screen.getByTestId("button-end-call"));

    expect(voiceState.stopVoice).toHaveBeenCalledTimes(1);
  });

  it("can hide the page CTA while the shared dock owns an active session", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "speaking";

    render(<VyvaSessionCta label="Talk to VYVA" hideWhenSessionActive testId="button-session" />);

    expect(screen.queryByTestId("button-session")).not.toBeInTheDocument();
    expect(voiceState.startVoice).not.toHaveBeenCalled();
  });

  it("renders the warm anytime voice rail when requested", () => {
    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        supportingLabel="Speak anytime"
        visual="voiceRail"
        testId="button-session"
      />,
    );

    expect(screen.getByTestId("button-session")).toHaveAccessibleName("Speak anytime");
    expect(screen.getByTestId("button-session")).not.toHaveTextContent("Talk to VYVA");
    expect(screen.getByTestId("button-session")).not.toHaveTextContent("Speak anytime");
  });
});
