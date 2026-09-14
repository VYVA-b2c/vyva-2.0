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
    source_type: "directory",
    source_url: "https://directory.example/harbour",
    checked_at: "2026-07-10T09:00:00.000Z",
    comparison: {
      distance: { criterion: "distance", value: "1.2 km", status: "verified", source: "Map listing" },
      price: { criterion: "price", value: "EUR 60", status: "reported", source: "Provider website", sourceType: "provider_owned", sourceUrl: "https://clinic.example/prices", checkedAt: "2026-07-10T08:30:00.000Z" },
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
    expect(screen.getByTestId("provider-fact-provider-a-price")).toHaveTextContent("Not independently verified");
    expect(screen.getByTestId("provider-fact-provider-a-price")).toHaveTextContent("Provider source");
    expect(screen.getByTestId("provider-fact-source-provider-a-price")).toHaveTextContent("Provider website");
    expect(screen.getByTestId("provider-fact-checked-provider-a-price")).not.toHaveTextContent("Check time not provided");
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

  it("supports an explicit preferred choice only when the follow-up flow enables it", () => {
    const onSelectPreferred = vi.fn();
    const { rerender } = render(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={["provider-a"]}
        onToggleShortlist={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
        onSelectPreferred={onSelectPreferred}
      />,
    );

    fireEvent.click(screen.getByTestId("button-provider-comparison-choose-provider-a"));
    expect(onSelectPreferred).toHaveBeenCalledWith(options[0]);

    rerender(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={["provider-a"]}
        preferredId="provider-a"
        onToggleShortlist={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
        onSelectPreferred={onSelectPreferred}
      />,
    );
    expect(screen.getByTestId("button-provider-comparison-choose-provider-a")).toHaveTextContent("Preferred choice");
  });

  it("keeps unavailable options visible but disables decision and contact actions", () => {
    const onPrepareContact = vi.fn();
    render(
      <ProviderComparisonPanel
        options={options}
        locale="en"
        shortlistedIds={["provider-a"]}
        unavailableIds={["provider-a"]}
        onToggleShortlist={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={onPrepareContact}
        onSelectPreferred={vi.fn()}
      />,
    );

    expect(screen.getByTestId("badge-provider-unavailable-provider-a")).toHaveTextContent("Unavailable in latest check");
    expect(screen.getByTestId("button-provider-comparison-save-provider-a")).toBeDisabled();
    expect(screen.getByTestId("button-provider-comparison-contact-provider-a")).toBeDisabled();
    expect(screen.getByTestId("button-provider-comparison-choose-provider-a")).toBeDisabled();
  });

  it("shows a clear warning when evidence sources conflict", () => {
    const conflicting = buildProviderComparisonOptions([{
      id: "provider-conflict",
      name: "Harbour Clinic",
      category: "Doctor",
      comparison: {
        price: {
          criterion: "price",
          value: "EUR 70",
          status: "verified",
          source: "Clinic price list",
          sourceType: "provider_owned",
          checkedAt: "2026-07-10T08:00:00.000Z",
          evidence: [
            { value: "EUR 70", status: "verified", source: "Clinic price list", sourceType: "provider_owned", sourceUrl: "https://clinic.example/prices", checkedAt: "2026-07-10T08:00:00.000Z" },
            { value: "EUR 75", status: "reported", source: "Regional directory", sourceType: "directory", sourceUrl: "https://directory.example/clinic", checkedAt: "2026-07-10T09:00:00.000Z" },
          ],
          sourceUrl: "https://clinic.example/prices",
          conflict: true,
        },
      },
    }]);

    render(
      <ProviderComparisonPanel
        options={conflicting}
        locale="en"
        shortlistedIds={[]}
        onToggleShortlist={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
      />,
    );

    expect(screen.getByTestId("provider-fact-provider-conflict-price")).toHaveTextContent("Sources disagree");
    expect(screen.getByTestId("provider-fact-conflict-provider-conflict-price")).toHaveTextContent("Review this detail before deciding");
  });
});
