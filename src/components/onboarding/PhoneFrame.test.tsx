import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PhoneFrame } from "./PhoneFrame";
import { OnboardingCompanionModeToggle } from "./OnboardingCompanionModeToggle";
import {
  OnboardingCompanionGuidanceProvider,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("@/hooks/useVyvaVoice", () => ({
  useOptionalVyvaVoice: () => null,
}));

describe("PhoneFrame companion mode", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the compact mode chip inside profile sections", () => {
    render(
      <PhoneFrame subtitle="Health conditions" showBack showAllSections>
        <button type="button">Save section</button>
      </PhoneFrame>
    );

    expect(screen.getByTestId("onboarding-companion-mode-chip")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Voice/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("button", { name: "Save section" })).toBeVisible();
  });

  it("keeps the selected mode shared from overview to sections", () => {
    render(
      <>
        <OnboardingCompanionModeToggle
          title="Choose your mode"
          helperText="Switch anytime"
          compactLabel="VYVA mode"
          voiceLabel="Voice"
          voiceDescription="VYVA can talk you through this page."
          tactileLabel="Tactile"
          tactileDescription="Use touch or keyboard controls quietly."
          accessibleLabel="Choose voice or tactile help"
        />
        <PhoneFrame subtitle="Medications">
          <p>Medication form</p>
        </PhoneFrame>
      </>
    );

    fireEvent.click(screen.getAllByRole("radio", { name: /Tactile/ })[0]);

    expect(screen.getAllByRole("radio", { name: /Tactile/ })[1]).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it("can hide the chip for exceptional section screens", () => {
    render(
      <PhoneFrame subtitle="Quiet screen" showCompanionMode={false}>
        <p>Only content</p>
      </PhoneFrame>
    );

    expect(screen.queryByTestId("onboarding-companion-mode-chip")).not.toBeInTheDocument();
  });

  it("shows live voice status, prompt, heard feedback, and error fallback", () => {
    function GuidanceControls() {
      const { setGuidance } = useOnboardingCompanionGuidance();
      return (
        <div>
          <button
            type="button"
            onClick={() =>
              setGuidance({
                voiceStatus: "listening",
                currentPrompt: "Tell VYVA one health condition.",
              })
            }
          >
            Start listening
          </button>
          <button
            type="button"
            onClick={() =>
              setGuidance({
                voiceStatus: "thinking",
                lastHeardText: "Heard: high blood pressure",
              })
            }
          >
            Heard condition
          </button>
          <button
            type="button"
            onClick={() =>
              setGuidance({
                voiceStatus: "error",
                error: "Voice paused. You can keep using touch.",
              })
            }
          >
            Voice error
          </button>
        </div>
      );
    }

    render(
      <OnboardingCompanionGuidanceProvider>
        <PhoneFrame subtitle="Health conditions">
          <GuidanceControls />
        </PhoneFrame>
      </OnboardingCompanionGuidanceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Start listening" }));
    expect(screen.getByTestId("onboarding-companion-mode-chip")).toHaveAttribute(
      "data-voice-status",
      "listening"
    );
    expect(screen.getByText("Listening")).toBeInTheDocument();
    expect(screen.getByText("Tell VYVA one health condition.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Heard condition" }));
    expect(screen.getByText("Thinking")).toBeInTheDocument();
    expect(screen.getByText("Heard: high blood pressure")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voice error" }));
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(screen.getByText("Voice paused. You can keep using touch.")).toBeInTheDocument();
  });
});
