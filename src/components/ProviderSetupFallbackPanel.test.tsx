import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import { APP_WORKFLOW_REFERENCES } from "../../shared/workflowRegistry";
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

  it("uses workflow matrix choices when a provider-backed reference is supplied", () => {
    render(
      <ProviderSetupFallbackPanel
        testId="panel-workflow-provider-fallback"
        workflowReference={CONCIERGE_FLOW_REFERENCES.transportBooking}
        returnTo="/concierge?task=ride"
        title="Need transport first?"
        description="Choose how to set this up."
        onAddProvider={vi.fn()}
        onFindOptions={vi.fn()}
        onAskHelper={vi.fn()}
      />,
    );

    expect(screen.getByTestId("panel-workflow-provider-fallback-add")).toHaveTextContent("Add usual transport / taxi");
    expect(screen.getByTestId("panel-workflow-provider-fallback-find")).toHaveTextContent("Find options nearby");
    expect(screen.getByTestId("panel-workflow-provider-fallback-helper")).toHaveTextContent("Ask family or caregiver");
    expect(screen.getByTestId("panel-workflow-provider-fallback-find")).toHaveAttribute("title", expect.stringContaining("proximity"));
  });

  it("does not show provider actions for non-provider workflow fallbacks", () => {
    render(
      <ProviderSetupFallbackPanel
        testId="panel-workflow-non-provider-fallback"
        workflowReference={APP_WORKFLOW_REFERENCES.visualScan}
        title="Need an input first?"
        description="Choose what to show."
        onAddProvider={vi.fn()}
        onFindOptions={vi.fn()}
        onAskHelper={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("panel-workflow-non-provider-fallback-add")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-workflow-non-provider-fallback-find")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-workflow-non-provider-fallback-helper")).not.toBeInTheDocument();
  });
});
