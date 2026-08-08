import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ScreenContactSheet from "./ScreenContactSheet";

describe("ScreenContactSheet", () => {
  it("renders the locked template families", () => {
    render(<ScreenContactSheet />);

    expect(screen.getByRole("heading", { name: "VYVA screen templates" })).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-voice-idle")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-listening")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-speaking")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-touch-mode")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-guided-flow")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-output-review")).toBeInTheDocument();
    expect(screen.getByTestId("contact-sheet-setup-dashboard")).toBeInTheDocument();
  });

  it("keeps cards out of the voice idle template", () => {
    render(<ScreenContactSheet />);

    const voiceIdle = screen.getByTestId("contact-sheet-voice-idle");
    expect(within(voiceIdle).getByTestId("voice-template-idle")).toBeInTheDocument();
    expect(within(voiceIdle).queryByText("My Health")).not.toBeInTheDocument();
    expect(within(voiceIdle).queryByText("Concierge")).not.toBeInTheDocument();
  });

  it("shows cards only in the touch template", () => {
    render(<ScreenContactSheet />);

    const touchMode = screen.getByTestId("contact-sheet-touch-mode");
    expect(within(touchMode).getByTestId("card-hub-template")).toBeInTheDocument();
    expect(within(touchMode).getByText("My Health")).toBeInTheDocument();
    expect(within(touchMode).getByText("My Mind")).toBeInTheDocument();
    expect(within(touchMode).getByText("Concierge")).toBeInTheDocument();
  });

  it("renders bottom navigation inside every preview shell", () => {
    render(<ScreenContactSheet />);

    expect(screen.getAllByTestId("template-bottom-nav")).toHaveLength(8);
  });

  it("keeps explanatory copy out from under headings when screens have elements", () => {
    render(<ScreenContactSheet />);

    expect(screen.queryByText("VYVA asks one clear question, then moves to the next step.")).not.toBeInTheDocument();
    expect(screen.queryByText("Review the recommendation before anything is booked or paid.")).not.toBeInTheDocument();
    expect(screen.queryByText("Providers, approvals, and payment rules stay visible.")).not.toBeInTheDocument();
  });
});
