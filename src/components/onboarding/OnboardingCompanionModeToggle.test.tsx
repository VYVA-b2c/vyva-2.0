import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OnboardingCompanionModeToggle } from "./OnboardingCompanionModeToggle";

const baseProps = {
  title: "Complete this together",
  helperText:
    "Use voice for guided help, or tactile for quiet step-by-step control. You can switch anytime.",
  compactLabel: "VYVA mode",
  voiceLabel: "Voice",
  voiceDescription: "VYVA can talk you through this page.",
  tactileLabel: "Tactile",
  tactileDescription: "Use touch or keyboard controls quietly.",
  accessibleLabel: "Choose voice or tactile help for profile setup",
};

describe("OnboardingCompanionModeToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("features the guidance first, then keeps the mode switch available after fading", () => {
    vi.useFakeTimers();

    render(
      <OnboardingCompanionModeToggle {...baseProps} collapseDelayMs={1000} />
    );

    expect(screen.getByText("Complete this together")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Voice/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText("VYVA mode")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Voice/ })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Tactile/ })).toBeVisible();

    vi.useRealTimers();
  });

  it("supports touch and keyboard mode changes", () => {
    const onModeChange = vi.fn();
    render(
      <OnboardingCompanionModeToggle
        {...baseProps}
        onModeChange={onModeChange}
      />
    );

    fireEvent.click(screen.getByRole("radio", { name: /Tactile/ }));
    expect(onModeChange).toHaveBeenLastCalledWith("tactile");
    expect(screen.getByRole("radio", { name: /Tactile/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );

    fireEvent.keyDown(screen.getByRole("radio", { name: /Tactile/ }), {
      key: "ArrowLeft",
    });
    expect(onModeChange).toHaveBeenLastCalledWith("voice");
    expect(screen.getByRole("radio", { name: /Voice/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it.each([390, 768, 1440])(
    "keeps long translated labels available at %s px",
    (width) => {
      Object.defineProperty(window, "innerWidth", {
        value: width,
        configurable: true,
      });

      render(
        <OnboardingCompanionModeToggle
          {...baseProps}
          voiceLabel="Aide vocale accompagnée très longue"
          tactileLabel="Contrôle tactile calme et très détaillé"
        />
      );

      expect(
        screen.getByRole("radio", {
          name: /Aide vocale accompagnée très longue/,
        })
      ).toBeVisible();
      expect(
        screen.getByRole("radio", {
          name: /Contrôle tactile calme et très détaillé/,
        })
      ).toBeVisible();
    }
  );
});
