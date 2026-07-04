import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import ChatScreen from "./ChatScreen";

const voiceMocks = vi.hoisted(() => ({
  startVoice: vi.fn(),
  stopVoice: vi.fn(),
  sendText: vi.fn(),
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
    sendText: voiceMocks.sendText,
    transcript: [],
    status: "idle",
    isConnecting: false,
    isSpeaking: false,
    voiceSessionPhase: "idle",
    isMicMuted: true,
    setMicrophoneMuted: vi.fn(),
    lastError: null,
    lastErrorCode: null,
  }),
}));

vi.mock("@/components/VoiceCallOverlay", () => ({
  default: ({ isConnecting }: { isConnecting: boolean }) => (
    <div data-testid="voice-call-overlay" data-connecting={String(isConnecting)} />
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderChat(initialEntry: string | { pathname: string; search?: string; state?: Record<string, unknown> }) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/chat"
          element={(
            <>
              <ChatScreen />
              <LocationProbe />
            </>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ChatScreen", () => {
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  beforeEach(() => {
    voiceMocks.startVoice.mockReset();
    voiceMocks.stopVoice.mockReset();
    voiceMocks.sendText.mockReset();
  });

  it("removes the legacy type and voice mode switch", () => {
    renderChat("/chat?mode=type");

    expect(screen.queryByTestId("chat-mode-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-chat-mode-voice")).not.toBeInTheDocument();
  });

  it("shows a usable empty state for direct text-mode chat links", () => {
    renderChat("/chat?mode=type");

    expect(screen.getByTestId("chat-empty-state")).toHaveTextContent("Ask VYVA");
    expect(screen.getByTestId("input-chat-type")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-call-overlay")).not.toBeInTheDocument();
  });

  it("renders only the focused voice overlay for voice mode links", async () => {
    renderChat("/chat?mode=voice&q=hello");

    expect(screen.getByTestId("location")).toHaveTextContent("/chat?mode=voice&q=hello");
    expect(screen.getByTestId("voice-call-overlay")).toHaveAttribute("data-connecting", "true");
    expect(screen.queryByText("chat.started")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-chat-type")).not.toBeInTheDocument();

    await waitFor(() => expect(voiceMocks.startVoice).toHaveBeenCalled());
    expect(voiceMocks.startVoice).toHaveBeenLastCalledWith("companion", undefined, {
      skipMicrophone: false,
      autoStartListening: true,
      dynamicVariables: {
        app_entrypoint: "chat_voice_mode",
      },
    });
  });

  it("treats route voice auto-start state as focused voice mode", async () => {
    renderChat({
      pathname: "/chat",
      state: { [SECTION_VOICE_AUTO_START_KEY]: true },
    });

    expect(screen.getByTestId("voice-call-overlay")).toHaveAttribute("data-connecting", "true");
    expect(screen.queryByText("chat.started")).not.toBeInTheDocument();
    expect(screen.queryByTestId("input-chat-type")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/chat?mode=voice");
    });
    expect(voiceMocks.startVoice).toHaveBeenLastCalledWith("companion", undefined, {
      skipMicrophone: false,
      autoStartListening: true,
      dynamicVariables: {
        app_entrypoint: "chat_voice_mode",
      },
    });
  });
});
