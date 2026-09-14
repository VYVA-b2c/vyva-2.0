import { fireEvent, render, screen } from "@testing-library/react";
import { VOICE_ORB_HINT_SEEN_STORAGE_KEY } from "@/lib/voiceOrbHint";
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
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => null),
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: originalGetContext,
    });
  });

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
    window.localStorage.removeItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY);
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

    expect(screen.getByTestId("button-session")).toHaveTextContent("Speaking");
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

  it("keeps active voice mode on the shared animated orb visual", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "speaking";
    voiceState.isSpeaking = true;

    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        visual="voiceOrb"
        testId="button-session"
      />,
    );

    expect(screen.getByTestId("button-session")).toHaveAccessibleName("Speaking");
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "speaking");
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-idle-visual-style", "default");
    expect(screen.getByTestId("home-dormant-zamora-orb-visual-canvas")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-session"));

    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
    expect(voiceState.startVoice).not.toHaveBeenCalled();
  });

  it("shows a softer gold Home orb idle hint", () => {
    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        supportingLabel="Touch the orb to begin."
        visual="voiceOrb"
        voiceOrbCaptionTestId="home-master-hero-subtitle"
        testId="button-session"
      />,
    );

    const caption = screen.getByTestId("home-master-hero-subtitle");

    expect(caption).toHaveTextContent("Touch the orb to begin.");
    expect(caption).toHaveClass("font-semibold");
    expect(caption).not.toHaveClass("font-bold");
    expect(caption).toHaveClass("!text-[#A86610]");
    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-idle-visual-style", "homeCalm");
    expect(screen.getByTestId("home-dormant-zamora-orb-idle-attractor")).toBeInTheDocument();
    expect(screen.getByTestId("home-dormant-zamora-orb-idle-attractor").querySelectorAll("span")).toHaveLength(3);
  });

  it("allows the Home idle orb to keep its larger inviting scale", () => {
    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        visual="voiceOrb"
        voiceOrbSize={204}
        testId="button-session"
      />,
    );

    expect(screen.getByTestId("home-dormant-zamora-orb")).toHaveStyle({
      height: "204px",
      width: "204px",
    });
  });

  it("keeps the Home orb visible and hides the idle hint while listening", () => {
    voiceState.status = "connected";
    voiceState.voiceSessionPhase = "listening";

    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        supportingLabel="Touch the orb to begin."
        visual="voiceOrb"
        voiceOrbCaptionTestId="home-master-hero-subtitle"
        testId="button-session"
      />,
    );

    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "listening");
    expect(screen.queryByTestId("home-dormant-zamora-orb-idle-attractor")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-master-hero-subtitle")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-session")).toBeInTheDocument();
  });

  it("uses calm actionable copy when the Home orb cannot start voice", () => {
    voiceState.voiceSessionPhase = "error";
    voiceState.lastError = "Voice connection failed";

    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        supportingLabel="Touch the orb to begin."
        visual="voiceOrb"
        voiceOrbDark
        voiceOrbCaptionTestId="home-master-hero-subtitle"
        testId="button-session"
      />,
    );

    const caption = screen.getByTestId("home-master-hero-subtitle");

    expect(screen.getByTestId("home-dormant-zamora-orb-visual")).toHaveAttribute("data-orb-state", "error");
    expect(caption).toHaveTextContent("Voice isn’t available right now. Use the hand button, or tap to retry.");
    expect(caption).not.toHaveTextContent("Tap to try again.");
    expect(caption).toHaveClass("!text-[#F6C75B]");
  });

  it("remembers the first successful orb activation", () => {
    const onFirstVoiceOrbActivation = vi.fn();

    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        visual="voiceOrb"
        onFirstVoiceOrbActivation={onFirstVoiceOrbActivation}
        testId="button-session"
      />,
    );

    fireEvent.click(screen.getByTestId("button-session"));

    expect(window.localStorage.getItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY)).toBe("true");
    expect(onFirstVoiceOrbActivation).toHaveBeenCalledTimes(1);
    expect(voiceState.startVoice).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("does not repeat first-use guidance after it has been remembered", () => {
    window.localStorage.setItem(VOICE_ORB_HINT_SEEN_STORAGE_KEY, "true");
    const onFirstVoiceOrbActivation = vi.fn();

    render(
      <VyvaSessionCta
        label="Talk to VYVA"
        visual="voiceOrb"
        onFirstVoiceOrbActivation={onFirstVoiceOrbActivation}
        testId="button-session"
      />,
    );

    fireEvent.click(screen.getByTestId("button-session"));

    expect(onFirstVoiceOrbActivation).not.toHaveBeenCalled();
    expect(voiceState.startVoice).toHaveBeenCalledTimes(1);
  });
});
