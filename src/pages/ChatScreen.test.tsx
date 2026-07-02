import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
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
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderChat(initialEntry: string) {
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

  it("normalizes legacy voice mode links to typed chat without starting listening", async () => {
    renderChat("/chat?mode=voice&q=hello");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/chat?mode=type&q=hello");
    });

    await waitFor(() => expect(voiceMocks.startVoice).toHaveBeenCalled());
    expect(voiceMocks.startVoice).toHaveBeenLastCalledWith("companion", undefined, {
      skipMicrophone: true,
      autoStartListening: false,
      dynamicVariables: {
        app_entrypoint: "chat_type_mode",
      },
    });
    expect(voiceMocks.startVoice).not.toHaveBeenCalledWith(
      "companion",
      undefined,
      expect.objectContaining({ autoStartListening: true }),
    );
  });
});
