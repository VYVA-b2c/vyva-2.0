import { describe, expect, it } from "vitest";
import {
  getScreenPresentation,
  shouldShowHeadingDetail,
} from "./screenPresentation";

describe("screen presentation", () => {
  it("keeps Home voice mode orb-first with cards and chips hidden", () => {
    const presentation = getScreenPresentation({ screenId: "home", mode: "voice" });

    expect(presentation.primarySurface).toBe("orb");
    expect(presentation.cards).toBe("hidden");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(true);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "home",
      "data-screen-mode": "voice",
      "data-primary-surface": "orb",
      "data-cards": "hidden",
      "data-chips": "hidden",
      "data-heading-detail": "visible",
    });
  });

  it("makes Home touch mode the card surface without loose heading detail", () => {
    const presentation = getScreenPresentation({ screenId: "home", mode: "touch" });

    expect(presentation.primarySurface).toBe("cards");
    expect(presentation.cards).toBe("visible");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(false);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "home",
      "data-screen-mode": "touch",
      "data-primary-surface": "cards",
      "data-cards": "visible",
      "data-chips": "hidden",
      "data-heading-detail": "hidden",
    });
  });

  it("keeps Health as a clean card hub with no loose heading detail", () => {
    const presentation = getScreenPresentation({ screenId: "health" });

    expect(presentation.template).toBe("cardHub");
    expect(presentation.primarySurface).toBe("cards");
    expect(presentation.cards).toBe("visible");
    expect(presentation.chips).toBe("hidden");
    expect(presentation.showHeadingDetail).toBe(false);
    expect(presentation.dataAttributes).toMatchObject({
      "data-screen-contract": "health",
      "data-template": "cardHub",
      "data-primary-surface": "cards",
      "data-cards": "visible",
      "data-chips": "hidden",
      "data-heading-detail": "hidden",
      "data-bottom-nav-clearance": "112",
    });
  });

  it("hides heading detail when a screen has cards or structured output", () => {
    expect(shouldShowHeadingDetail("cards", "visible")).toBe(false);
    expect(shouldShowHeadingDetail("dashboard", "visible")).toBe(false);
    expect(shouldShowHeadingDetail("answer", "contextual")).toBe(false);
  });

  it("carries bottom navigation clearance for fixed nav screens", () => {
    const presentation = getScreenPresentation({ screenId: "concierge" });

    expect(presentation.bottomNavClearancePx).toBeGreaterThanOrEqual(112);
    expect(presentation.bottomNavClearanceClassName).toBe("pb-[112px]");
    expect(presentation.dataAttributes["data-bottom-nav-clearance"]).toBe("112");
  });
});
