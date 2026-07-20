import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ProviderSetupFallbackPanel from "./ProviderSetupFallbackPanel";

describe("ProviderSetupFallbackPanel", () => {
  it("offers add, nearby search, and helper setup paths without taking action itself", () => {
    const onAddProvider = vi.fn();
    const onFindOptions = vi.fn();
    const onAskHelper = vi.fn();

    render(
      <ProviderSetupFallbackPanel
        testId="panel-test-provider-fallback"
        title="Need a provider first?"
        description="Save one, find options, or ask someone trusted to help."
        addLabel="Add my usual provider"
        findLabel="Find nearby options"
        helperLabel="Ask family/caregiver"
        onAddProvider={onAddProvider}
        onFindOptions={onFindOptions}
        onAskHelper={onAskHelper}
      />,
    );

    expect(screen.getByTestId("panel-test-provider-fallback")).toHaveTextContent("Need a provider first?");
    expect(screen.getByTestId("panel-test-provider-fallback")).toHaveTextContent("VYVA still asks before calling, booking, or sharing details.");

    fireEvent.click(screen.getByTestId("panel-test-provider-fallback-add"));
    fireEvent.click(screen.getByTestId("panel-test-provider-fallback-find"));
    fireEvent.click(screen.getByTestId("panel-test-provider-fallback-helper"));

    expect(onAddProvider).toHaveBeenCalledTimes(1);
    expect(onFindOptions).toHaveBeenCalledTimes(1);
    expect(onAskHelper).toHaveBeenCalledTimes(1);
  });
});
