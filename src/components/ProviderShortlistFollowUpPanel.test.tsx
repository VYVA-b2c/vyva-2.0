import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  buildProviderComparisonOptions,
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

    render(
      <ProviderShortlistFollowUpPanel
        shortlist={shortlist()}
        locale="en"
        onRemove={onRemove}
        onAdd={onAdd}
        onSelectPreferred={onSelectPreferred}
        onSaveProvider={onSaveProvider}
        onPrepareContact={onPrepareContact}
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

    expect(onRemove).toHaveBeenCalledWith(options[0]);
    expect(onSelectPreferred).toHaveBeenCalledWith(options[0]);
    expect(onSaveProvider).toHaveBeenCalledWith(options[0]);
    expect(onPrepareContact).toHaveBeenCalledWith(options[0]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
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
        onDismiss={vi.fn()}
        onFinish={onFinish}
      />,
    );

    fireEvent.click(screen.getByTestId("button-provider-shortlist-finish"));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
