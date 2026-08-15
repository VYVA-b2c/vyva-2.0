import { render, screen } from "@testing-library/react";
import ZamoraVoiceOrb from "./ZamoraVoiceOrb";

describe("ZamoraVoiceOrb", () => {
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

  it("keeps the default idle orb visual unchanged unless Home explicitly opts into calm idle", () => {
    const { rerender } = render(<ZamoraVoiceOrb state="idle" testId="orb-default" />);

    expect(screen.getByTestId("orb-default")).toHaveAttribute("data-idle-visual-style", "default");

    rerender(<ZamoraVoiceOrb state="idle" idleVisualStyle="homeCalm" testId="orb-default" />);

    expect(screen.getByTestId("orb-default")).toHaveAttribute("data-idle-visual-style", "homeCalm");
  });
});
