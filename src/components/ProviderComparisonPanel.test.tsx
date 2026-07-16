import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { buildProviderComparisonOptions } from "../../shared/providerComparison";
import ProviderComparisonPanel from "./ProviderComparisonPanel";

const options = buildProviderComparisonOptions([
  {
    id: "provider-a",
    name: "Harbour Clinic",
    category: "Doctor",
    source_label: "Regional directory",
    source_status: "verified",
    comparison: {
      distance: { criterion: "distance", value: "1.2 km", status: "verified", source: "Map listing" },
      price: { criterion: "price", value: "EUR 60", status: "reported", source: "Provider website" },
      reputation: { criterion: "reputation", value: "4.6 from 120 reviews", status: "reported", source: "Public reviews" },
      availability: { criterion: "availability", value: "Tuesday", status: "reported", source: "Provider website" },
      accessibility: { criterion: "accessibility", value: null, status: "unknown", source: null },
      coverage: { criterion: "coverage", value: null, status: "unknown", source: null },
    },
  },
]);

describe("ProviderComparisonPanel", () => {
  it("shows factual criteria and missing information without a numeric score", () => {
    render(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={[]}
        onToggleShortlist={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
      />,
    );

    const panel = screen.getByTestId("provider-comparison-panel");
    expect(panel).toHaveTextContent("Distance");
    expect(panel).toHaveTextContent("Insurance / coverage");
    expect(panel).toHaveTextContent("Not provided");
    expect(panel).toHaveTextContent("Why this may suit you");
    expect(panel).not.toHaveTextContent("/100");
    expect(panel).not.toHaveTextContent("VYVA score");
  });

  it("supports shortlist, save provider, contact preparation, and optional watch", () => {
    const onToggleShortlist = vi.fn();
    const onSaveShortlist = vi.fn();
    const onSaveProvider = vi.fn();
    const onPrepareContact = vi.fn();
    const onWatch = vi.fn();

    const { rerender } = render(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={[]}
        onToggleShortlist={onToggleShortlist}
        onSaveShortlist={onSaveShortlist}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
        onWatch={onWatch}
      />,
    );

    fireEvent.click(screen.getByTestId("button-provider-shortlist-provider-a"));
    expect(onToggleShortlist).toHaveBeenCalledWith(options[0]);

    rerender(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={["provider-a"]}
        onToggleShortlist={onToggleShortlist}
        onSaveShortlist={onSaveShortlist}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
        onWatch={onWatch}
      />,
    );

    fireEvent.click(screen.getByTestId("button-provider-shortlist-save"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-save-provider-a"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-contact-provider-a"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-watch-provider-a"));

    expect(onSaveShortlist).toHaveBeenCalledWith(options);
    expect(onSaveProvider).toHaveBeenCalledWith(options[0]);
    expect(onPrepareContact).toHaveBeenCalledWith(options[0]);
    expect(onWatch).toHaveBeenCalledWith(options[0]);
  });
});
