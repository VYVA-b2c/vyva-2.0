import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildProviderComparisonOptions,
  buildProviderShortlistRecheckPayload,
  buildProviderShortlistPayload,
  parseProviderShortlistPayload,
} from "../../shared/providerComparison";
import ProviderShortlistFollowUpPanel from "./ProviderShortlistFollowUpPanel";

const options = buildProviderComparisonOptions([
  { id: "clinic-a", name: "Harbour Clinic", category: "Doctor", phone: "+34 600 111 222" },
  { id: "clinic-b", name: "Garden Care", category: "Doctor" },
]);

function shortlist(preferredProviderId: string | null = null) {
  const payload = buildProviderShortlistPayload(options, {
    mode: "specialist",
    capturedAt: "2020-01-01T10:00:00.000Z",
  });
  payload.preferred_provider_id = preferredProviderId;
  payload.preferred_provider_name = preferredProviderId === "clinic-a" ? "Harbour Clinic" : null;
  return parseProviderShortlistPayload(payload)!;
}

describe("ProviderShortlistFollowUpPanel", () => {
  it("shows capture age, warns about old details, and exposes shortlist decisions", () => {
    const onRemove = vi.fn();
    const onAdd = vi.fn();
    const onSelectPreferred = vi.fn();
    const onSaveProvider = vi.fn();
    const onPrepareContact = vi.fn();
    const onDismiss = vi.fn();
    const onFinish = vi.fn();
    const onRecheck = vi.fn();

    render(
      <ProviderShortlistFollowUpPanel
        shortlist={shortlist()}
        locale="en"
        onRemove={onRemove}
        onAdd={onAdd}
        onSelectPreferred={onSelectPreferred}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
        onRecheck={onRecheck}
        onDismiss={onDismiss}
        onFinish={onFinish}
      />,
    );

    expect(screen.getByTestId("provider-shortlist-follow-up")).toHaveTextContent("2 saved options");
    expect(screen.getByTestId("provider-shortlist-stale-warning")).toHaveTextContent("Details may have changed");
    expect(screen.getByTestId("button-provider-shortlist-finish")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-provider-shortlist-clinic-a"));
    fireEvent.click(screen.getByTestId("button-provider-shortlist-add"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-choose-clinic-a"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-save-clinic-a"));
    fireEvent.click(screen.getByTestId("button-provider-comparison-contact-clinic-a"));
    fireEvent.click(screen.getByTestId("button-provider-shortlist-dismiss"));
    fireEvent.click(screen.getByTestId("button-provider-shortlist-recheck"));

    expect(onRemove).toHaveBeenCalledWith(options[0]);
    expect(onSelectPreferred).toHaveBeenCalledWith(options[0]);
    expect(onSaveProvider).toHaveBeenCalledWith(options[0]);
    expect(onPrepareContact).toHaveBeenCalledWith(options[0]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("enables finishing after a preferred option is saved", () => {
    const onFinish = vi.fn();
    render(
      <ProviderShortlistFollowUpPanel
        shortlist={shortlist("clinic-a")}
        locale="en"
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        onSelectPreferred={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
        onRecheck={vi.fn()}
        onDismiss={vi.fn()}
        onFinish={onFinish}
      />,
    );

    fireEvent.click(screen.getByTestId("button-provider-shortlist-finish"));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("shows saved-versus-current changes and blocks unavailable providers", () => {
    const payload = buildProviderShortlistPayload(options, {
      mode: "specialist",
      capturedAt: "2020-01-01T10:00:00.000Z",
    });
    const latest = buildProviderComparisonOptions([{
      id: "fresh-clinic-a",
      name: "Harbour Clinic",
      category: "Doctor",
      phone: "+34 600 999 888",
      comparison: {
        price: { criterion: "price", value: "EUR 75", status: "verified" },
        availability: { criterion: "availability", value: "Wednesday", status: "reported" },
      },
    }]);
    const refreshed = parseProviderShortlistPayload(
      buildProviderShortlistRecheckPayload(payload, latest, "2026-07-10T12:00:00.000Z"),
    )!;
    refreshed.preferredProviderId = "clinic-b";

    render(
      <ProviderShortlistFollowUpPanel
        shortlist={refreshed}
        locale="en"
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        onSelectPreferred={vi.fn()}
        onSaveProvider={vi.fn()}
        onPrepareContact={vi.fn()}
        onRecheck={vi.fn()}
        onDismiss={vi.fn()}
        onFinish={vi.fn()}
      />,
    );

    expect(screen.getByTestId("provider-shortlist-change-review")).toHaveTextContent("What changed");
    expect(screen.getByTestId("provider-shortlist-review-clinic-a")).toHaveTextContent("EUR 75");
    expect(screen.getByTestId("provider-shortlist-review-clinic-b")).toHaveTextContent("Not found in the latest check");
    expect(screen.getByTestId("button-provider-comparison-contact-clinic-b")).toBeDisabled();
    expect(screen.getByTestId("button-provider-comparison-choose-clinic-b")).toBeDisabled();
    expect(screen.getByTestId("button-provider-shortlist-finish")).toBeDisabled();
  });
});
