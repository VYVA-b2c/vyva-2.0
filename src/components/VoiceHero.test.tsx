import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VoiceHero from "./VoiceHero";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useHeroMessage", () => ({
  useHeroMessage: () => null,
}));

vi.mock("@/lib/heroMessages", () => ({
  recordHeroEvent: vi.fn(),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useVyvaVoice: () => ({
    startVoice: vi.fn(),
    stopVoice: vi.fn(),
    status: "idle",
    isSpeaking: false,
    isConnecting: false,
    transcript: [],
    voiceSessionPhase: "idle",
    isMicMuted: false,
    setMicrophoneMuted: vi.fn(),
  }),
}));

function setNavigatorOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

describe("VoiceHero status indicator", () => {
  beforeEach(() => {
    setNavigatorOnline(true);
  });

  it("shows the system as online while the voice session is idle", () => {
    render(
      <VoiceHero
        headline="Good afternoon"
        weatherData={{ city: "Tarifa", temperature: 24, description: "weather.clear" }}
      />,
    );

    const statusDot = screen.getByTestId("voice-hero-status-dot");
    expect(statusDot).toHaveAccessibleName("Online");
    expect(statusDot.querySelector("span")).toHaveStyle({ background: "#34D399" });
  });

  it("turns red only when the app is offline", () => {
    setNavigatorOnline(false);

    render(
      <VoiceHero
        headline="Good afternoon"
        weatherData={{ city: "Tarifa", temperature: 24, description: "weather.clear" }}
      />,
    );

    const statusDot = screen.getByTestId("voice-hero-status-dot");
    expect(statusDot).toHaveAccessibleName("Offline");
    expect(statusDot.querySelector("span")).toHaveStyle({ background: "#EF4444" });
  });
});
