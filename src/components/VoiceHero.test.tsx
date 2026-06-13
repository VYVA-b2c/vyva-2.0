import { act } from "react";
import { render, screen } from "@testing-library/react";
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
});
