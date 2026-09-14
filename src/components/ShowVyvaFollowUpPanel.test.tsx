import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ShowVyvaFollowUpPanel from "./ShowVyvaFollowUpPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe("ShowVyvaFollowUpPanel", () => {
  it("renders scam review actions and emits the selected action", () => {
    const onSelect = vi.fn();

    render(
      <ShowVyvaFollowUpPanel
        context="scam"
        testIdSuffix="test"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Next safe step")).toBeInTheDocument();
    expect(screen.getByText("Check company")).toBeInTheDocument();
    expect(screen.getByText("Call trusted contact")).toBeInTheDocument();
    expect(screen.getByText("Save or report")).toBeInTheDocument();
    expect(screen.getByText("Continue with VYVA")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-check_company-test"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      id: "check_company",
      requiresConfirmation: true,
    }));
  });

  it("shows the global confirmation rule", () => {
    render(
      <ShowVyvaFollowUpPanel
        context="document"
        testIdSuffix="doc"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByText(/sent, bought, booked, called, uploaded, or shared/i)).toBeInTheDocument();
  });
});
