import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderTaskWizard } from "./ProviderTaskWizard";

const criteria = [
  { key: "nearby", label: "Nearby", description: "Nearby or easy to reach" },
  { key: "reputation", label: "Good reputation", description: "Verifiable reviews" },
  { key: "accessible", label: "Easy access", description: "Accessible and simple" },
  { key: "clear-price", label: "Clear price", description: "No hidden fees" },
];

function renderWizard(overrides: Partial<React.ComponentProps<typeof ProviderTaskWizard>> = {}) {
  const props: React.ComponentProps<typeof ProviderTaskWizard> = {
    step: "need", onStepChange: vi.fn(), providerType: "Specialist", query: "find a specialist",
    providerMode: "specialist", locale: "en", serviceIntake: { mode: "specialist", serviceType: "Physiotherapist", answers: {}, mustHaveAnswerIds: [] }, onServiceIntakeChange: vi.fn(),
    onQueryChange: vi.fn(), criteria: ["nearby", "reputation", "accessible"], criterionOptions: criteria,
    onToggleCriterion: vi.fn(), selectionLimitReached: true, isSpanish: false, isSearching: false,
    onSearch: vi.fn(), results: <p>Provider results</p>, onPrepareContact: vi.fn(), ...overrides,
  };
  render(<ProviderTaskWizard {...props} />);
  return props;
}

describe("ProviderTaskWizard", () => {
  it("requires a need before continuing", () => {
    renderWizard({ query: "" });
    expect(screen.getByTestId("button-provider-wizard-need-next")).toBeDisabled();
  });

  it("orders selected priorities and disables a fourth choice", () => {
    renderWizard({ step: "priorities" });
    expect(screen.getByRole("button", { name: /Nearby/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-provider-criterion-clear-price")).toBeDisabled();
    expect(screen.getByText("You can choose up to three priorities.")).toBeInTheDocument();
  });

  it("starts search only from the explicit review action", () => {
    const onSearch = vi.fn();
    renderWizard({ step: "search_review", onSearch });
    expect(onSearch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("button-provider-wizard-search"));
    expect(onSearch).toHaveBeenCalledOnce();
  });

  it("does not prepare contact without a selected provider", () => {
    renderWizard({ step: "contact_review", selectedProvider: null });
    expect(screen.getByTestId("button-provider-wizard-prepare-contact")).toBeDisabled();
  });

  it("asks specialist-specific questions one at a time", () => {
    renderWizard({ step: "details" });
    expect(screen.getByRole("group", { name: "What is the appointment for?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Routine appointment" })).toBeInTheDocument();
    expect(screen.queryByText("What should the professional know before arriving?")).not.toBeInTheDocument();
  });

  it("uses home-service questions instead of healthcare questions", () => {
    renderWizard({
      step: "details",
      providerType: "Home service",
      providerMode: "home-service",
      serviceIntake: { mode: "home-service", serviceType: "Plumbing", answers: {}, mustHaveAnswerIds: [] },
    });
    expect(screen.getByRole("group", { name: "How urgent is the problem?" })).toBeInTheDocument();
    expect(screen.queryByText("What is the appointment for?")).not.toBeInTheDocument();
  });

  it("stops a normal search path when immediate danger is selected", () => {
    renderWizard({
      step: "details",
      providerType: "Home service",
      providerMode: "home-service",
      serviceIntake: { mode: "home-service", serviceType: "Electrical", answers: { home_urgency: ["danger"] }, mustHaveAnswerIds: [] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("immediate danger");
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
