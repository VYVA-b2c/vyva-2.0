import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { OnboardingCompanionModeChip } from "./OnboardingCompanionModeChip";
import { OnboardingCompanionTarget } from "./OnboardingCompanionTarget";
import {
  OnboardingCompanionGuidanceProvider,
  useOnboardingCompanionGuidance,
} from "./useOnboardingCompanionGuidance";

const chipProps = {
  compactLabel: "VYVA mode",
  voiceLabel: "Voice",
  voiceDescription: "VYVA can talk you through this page.",
  tactileLabel: "Tactile",
  tactileDescription: "Use touch or keyboard controls quietly.",
  accessibleLabel: "Choose voice or tactile help",
  statusLabels: {
    idle: "Ready",
    listening: "Listening",
    speaking: "Speaking",
    thinking: "Thinking",
    error: "Needs attention",
  },
};

function TargetControls() {
  const { setGuidance } = useOnboardingCompanionGuidance();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          setGuidance({
            voiceStatus: "listening",
            currentPrompt: "Choose the long translated profile option.",
            activeTargetId: "long-option",
          })
        }
      >
        Highlight long option
      </button>
      <button
        type="button"
        onClick={() =>
          setGuidance({
            voiceStatus: "listening",
            currentPrompt: "This target is not mounted.",
            activeTargetId: "missing-target",
          })
        }
      >
        Missing target
      </button>
    </div>
  );
}

describe("OnboardingCompanionTarget", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("highlights only the active companion target", () => {
    render(
      <OnboardingCompanionGuidanceProvider>
        <TargetControls />
        <OnboardingCompanionTarget targetId="long-option">
          <button type="button">
            Opción de perfil traducida deliberadamente larga para probar ajuste visual
          </button>
        </OnboardingCompanionTarget>
        <OnboardingCompanionTarget targetId="other-option">
          <button type="button">Other option</button>
        </OnboardingCompanionTarget>
      </OnboardingCompanionGuidanceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Highlight long option" }));

    expect(
      screen.getByText(
        "Opción de perfil traducida deliberadamente larga para probar ajuste visual"
      ).parentElement
    ).toHaveAttribute("data-vyva-companion-target-active", "true");
    expect(screen.getByText("Other option").parentElement).not.toHaveAttribute(
      "data-vyva-companion-target-active"
    );
  });

  it("keeps guidance visible when the active target is not mounted", () => {
    render(
      <OnboardingCompanionGuidanceProvider>
        <TargetControls />
        <OnboardingCompanionModeChip {...chipProps} />
        <OnboardingCompanionTarget targetId="visible-target">
          <button type="button">Visible target</button>
        </OnboardingCompanionTarget>
      </OnboardingCompanionGuidanceProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Missing target" }));

    expect(screen.getByText("Listening")).toBeInTheDocument();
    expect(screen.getByText("This target is not mounted.")).toBeInTheDocument();
    expect(screen.getByText("Visible target").parentElement).not.toHaveAttribute(
      "data-vyva-companion-target-active"
    );
  });

  it.each([390, 768, 1440])(
    "keeps long labels targetable at %s px",
    (width) => {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
      });

      render(
        <OnboardingCompanionGuidanceProvider
          initialState={{ activeTargetId: "long-option" }}
        >
          <OnboardingCompanionTarget targetId="long-option">
            <button type="button">
              Eine besonders lange übersetzte Beschriftung für eine Profilentscheidung
            </button>
          </OnboardingCompanionTarget>
        </OnboardingCompanionGuidanceProvider>
      );

      expect(
        screen.getByText(
          "Eine besonders lange übersetzte Beschriftung für eine Profilentscheidung"
        ).parentElement
      ).toHaveAttribute("data-vyva-companion-target-active", "true");
    }
  );

  it("keeps reduced-motion and keyboard focus classes on target wrappers", () => {
    render(
      <OnboardingCompanionGuidanceProvider
        initialState={{ activeTargetId: "keyboard-target" }}
      >
        <OnboardingCompanionTarget targetId="keyboard-target">
          <button type="button">Keyboard target</button>
        </OnboardingCompanionTarget>
      </OnboardingCompanionGuidanceProvider>
    );

    const target = screen.getByText("Keyboard target").parentElement;
    expect(target?.className).toContain("motion-reduce:transition-none");
    expect(target?.className).toContain("focus-within:outline");
  });
});
