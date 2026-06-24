import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emergencyProfileContactFromState, getAppShellLayout, SosSheet } from "./AppShell";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: Record<string, string>) => {
        if (!fallback) return _key;
        return fallback.replace(/{{(\w+)}}/g, (_, token) => values?.[token] ?? "");
      },
    }),
  };
});

describe("SOS service actions", () => {
  it("turns the primary SOS action into a direct emergency call", () => {
    render(<SosSheet open onOpenChange={vi.fn()} country="US" />);

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:911");
    expect(screen.getByTestId("button-sos-confirm")).toHaveTextContent("Call 911 now");
  });

  it("adds a direct call to the saved emergency contact when available", () => {
    render(
      <SosSheet
        open
        onOpenChange={vi.fn()}
        country="ES"
        profileContact={{ name: "Maria", primaryPhone: "+34 612 345 678" }}
      />,
    );

    expect(screen.getByTestId("button-sos-confirm")).toHaveAttribute("href", "tel:112");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-sos-call-contact")).toHaveTextContent("Call Maria");
  });

  it("keeps the cancel action as a close-only action", () => {
    const onOpenChange = vi.fn();
    render(<SosSheet open onOpenChange={onOpenChange} country="ES" />);

    fireEvent.click(screen.getByTestId("button-sos-cancel"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("extracts the profile emergency contact from onboarding state", () => {
    expect(emergencyProfileContactFromState({
      profile: {
        emergency_contact: {
          name: "Maria",
          relationship: "Daughter",
          primary_phone: "+34 612 345 678",
          secondary_phone: "",
        },
      },
    })).toEqual({
      name: "Maria",
      relationship: "Daughter",
      primaryPhone: "+34 612 345 678",
      secondaryPhone: "",
    });
  });
});

describe("app shell route layout", () => {
  it.each([
    ["/", "wide"],
    ["/settings/account", "wide"],
    ["/health/symptom-check", "wide"],
    ["/health/vitals", "vitals"],
    ["/social-rooms/music-room", "wide"],
    ["/companions", "wide"],
    ["/concierge/shopping", "wide"],
    ["/senses", "wide"],
    ["/chat", "fullscreen"],
    ["/activities/relax-breathe", "fullscreen"],
    ["/memory-games/word_recall", "fullscreen"],
    ["/attention-boosters/rhythm-tap", "fullscreen"],
    ["/profiles/select", "compact"],
    ["/onboarding/profile/health", "compact"],
  ] as const)("classifies %s as %s", (pathname, layout) => {
    expect(getAppShellLayout(pathname)).toBe(layout);
  });
});
