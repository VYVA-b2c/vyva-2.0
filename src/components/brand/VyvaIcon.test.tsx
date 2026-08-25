import { render, screen } from "@testing-library/react";
import { Brain, Mic } from "lucide-react";
import { describe, expect, it } from "vitest";
import { VyvaIcon } from "./VyvaIcon";

describe("VyvaIcon", () => {
  it("applies the VYVA gradient and rounded stroke grammar to utility icons", () => {
    render(<VyvaIcon icon={Brain} testId="brand-utility-icon" />);

    const icon = screen.getByTestId("brand-utility-icon");
    expect(icon).toHaveAttribute("data-vyva-icon", "utility");
    expect(icon.getAttribute("stroke")).toMatch(/^url\(#vyva-icon-/);
    expect(icon.querySelector("linearGradient stop:first-child")).toHaveAttribute("stop-color", "#9D4FE0");
    expect(icon.querySelector("linearGradient stop:last-child")).toHaveAttribute("stop-color", "#5C22B9");
  });

  it("keeps inverse control icons familiar and legible", () => {
    render(<VyvaIcon icon={Mic} tone="inverse" testId="inverse-icon" />);

    expect(screen.getByTestId("inverse-icon")).toHaveAttribute("stroke", "#FFFFFF");
    expect(screen.getByTestId("inverse-icon").querySelector("linearGradient")).not.toBeInTheDocument();
  });

  it("renders custom ribbon glyphs with the restrained gold accent", () => {
    render(<VyvaIcon glyph="medication" testId="medication-glyph" />);

    const glyph = screen.getByTestId("medication-glyph");
    expect(glyph).toHaveAttribute("data-brand-icon", "medication");
    expect(glyph.querySelector('[fill="#F8AE1B"]')).toBeInTheDocument();
  });
});
