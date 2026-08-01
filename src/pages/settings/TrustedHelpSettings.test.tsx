import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRUSTED_HELP_PARTNERS_STORAGE_KEY, type TrustedHelpPartner } from "@/data/trustedHelpPartners";
import TrustedHelpSettings from "./TrustedHelpSettings";

vi.mock("@/components/onboarding/PhoneFrame", () => ({
  PhoneFrame: ({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) => (
    <div data-testid="phone-frame">
      <button type="button" onClick={onBack} data-testid="phone-frame-back">Back</button>
      {children}
    </div>
  ),
}));

vi.mock("@/components/onboarding/ProfileSectionHero", () => ({
  ProfileSectionHero: (props: { title: string; description?: string }) => (
    <header data-testid="trusted-help-hero">
      <h1>{props.title}</h1>
      <p>{props.description}</p>
    </header>
  ),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(() => new Promise(() => {})),
}));

function renderTrustedHelp() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/settings/trusted-help"]}>
      <Routes>
        <Route path="/settings/trusted-help" element={<TrustedHelpSettings />} />
        <Route path="/settings" element={<div data-testid="settings-route">Settings</div>} />
        <Route path="/concierge" element={<div data-testid="concierge-route">Concierge</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function openTrustedHelpTab(tab: "dashboard" | "service" | "provider" | "controls" | "review") {
  fireEvent.click(screen.getByTestId(`button-trusted-help-tab-${tab}`));
}

describe("TrustedHelpSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens on a visual dashboard before the setup flow", () => {
    renderTrustedHelp();

    expect(screen.getByTestId("trusted-help-settings")).toBeInTheDocument();
    expect(screen.getByTestId("trusted-help-hero")).toHaveTextContent("My Trusted Help");
    expect(screen.getByTestId("trusted-help-tabs")).toHaveTextContent("Overview");
    expect(screen.getByTestId("trusted-help-tabs")).toHaveTextContent("Service");
    expect(screen.getByTestId("trusted-help-tabs")).toHaveTextContent("Provider");
    expect(screen.getByTestId("trusted-help-tabs")).toHaveTextContent("Controls");
    expect(screen.getByTestId("trusted-help-tabs")).toHaveTextContent("Review");
    expect(screen.getByTestId("section-trusted-help-dashboard")).toHaveTextContent("Your trusted help");
    expect(screen.getByTestId("card-trusted-help-stat-providers")).toHaveTextContent("1");
    expect(screen.getByTestId("card-trusted-help-stat-orders")).toHaveTextContent("1");
    expect(screen.getByTestId("card-trusted-help-stat-ready")).toHaveTextContent("1/5");
    expect(screen.getByTestId("card-trusted-help-stat-approvals")).toHaveTextContent("1");
    expect(screen.getByTestId("section-trusted-help-dashboard-ready")).toHaveTextContent("Groceries");
    expect(screen.getByTestId("section-trusted-help-dashboard-ready")).toHaveTextContent("Other");
    expect(screen.queryByTestId("button-trusted-help-dashboard-service-water")).not.toBeInTheDocument();
    expect(screen.getByTestId("section-trusted-help-dashboard-providers")).toHaveTextContent("AquaHome Water");
    expect(screen.getByTestId("coverage-trusted-help-dashboard-provider-provider-water")).toHaveTextContent("Water");
    expect(screen.queryByTestId("section-trusted-help-guide")).not.toBeInTheDocument();
  });

  it("shows the setup flow and advances from service choice to provider", () => {
    renderTrustedHelp();

    fireEvent.click(screen.getByTestId("button-trusted-help-dashboard-add-service"));
    expect(screen.getByTestId("section-trusted-help-guide")).toHaveTextContent("Groceries");
    expect(screen.getByTestId("section-trusted-help-guide")).toHaveTextContent("Food, water, household");
    expect(screen.getByTestId("section-trusted-help-guide")).toHaveTextContent("Wellness");
    expect(screen.getByTestId("section-trusted-help-guide")).toHaveTextContent("Other");
    expect(screen.queryByTestId("button-trusted-help-service-water")).not.toBeInTheDocument();
    expect(screen.getByTestId("section-trusted-help-guide")).not.toHaveTextContent("Repeat essentials");
    expect(screen.getByTestId("section-trusted-help-guide")).not.toHaveTextContent("Pharmacy");
    expect(screen.getByTestId("section-trusted-help-guide")).not.toHaveTextContent("Appointments");
    expect(screen.getByTestId("section-trusted-help-guide")).not.toHaveTextContent("Care Support");
    expect(screen.queryByTestId("section-trusted-help-provider-source")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-trusted-help-service-other"));
    expect(screen.getByTestId("section-trusted-help-provider-source")).toHaveTextContent("My Provider");
    expect(screen.queryByTestId("section-trusted-help-subservices")).not.toBeInTheDocument();
    expect(screen.queryByTestId("section-trusted-help-guide")).not.toBeInTheDocument();

    openTrustedHelpTab("controls");
    expect(screen.getByTestId("section-trusted-help-mode")).toHaveTextContent("Ask Me First");
    expect(screen.getByTestId("section-trusted-help-payment")).toHaveTextContent("Family Approves");
    expect(screen.getByTestId("section-trusted-help-caregivers")).toHaveTextContent("Rayan");

    openTrustedHelpTab("review");
    expect(screen.queryByTestId("section-trusted-help-test-run")).not.toBeInTheDocument();
    expect(screen.getByTestId("modal-trusted-help-test-run")).toHaveTextContent("You approve before VYVA acts");
    expect(screen.getByTestId("section-trusted-help-readiness")).toHaveTextContent("Wellness");
    expect(screen.getByTestId("section-trusted-help-readiness")).toHaveTextContent("Other");
    expect(screen.getByTestId("section-trusted-help-readiness")).not.toHaveTextContent("Pharmacy");
    expect(screen.getByTestId("section-trusted-help-save")).toHaveTextContent("Save setup");
    expect(screen.queryByTestId("button-trusted-help-full-provider-setup")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-trusted-help-open-concierge")).not.toBeInTheDocument();
  });

  it("keeps the safe test run aligned to the selected provider source", () => {
    renderTrustedHelp();

    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA starts with AquaHome Water for groceries.");

    openTrustedHelpTab("provider");
    fireEvent.click(screen.getByTestId("button-trusted-help-source-partner"));
    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA starts with Aquaservice for groceries.");

    openTrustedHelpTab("provider");
    fireEvent.click(screen.getByTestId("button-trusted-help-source-vyva-find"));
    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA can search using your rules: Nearby, Fresh food, Ask first, Best value.");
  });

  it("nudges the user to add a usual provider when My Provider is empty", () => {
    renderTrustedHelp();

    openTrustedHelpTab("provider");
    expect(screen.queryByTestId("label-trusted-help-source-own-empty")).not.toBeInTheDocument();
    expect(screen.getByTestId("coverage-trusted-provider-provider-water")).toHaveTextContent("Water");

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-wellness"));
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-wellness-massage"));

    expect(screen.getByTestId("label-trusted-help-source-own-empty")).toHaveTextContent("Add provider");
    expect(screen.getByTestId("nudge-trusted-help-empty-provider")).toHaveTextContent("No massage provider saved yet");

    fireEvent.click(screen.getByTestId("button-trusted-help-empty-provider-add"));
    fireEvent.change(screen.getByPlaceholderText("AquaHome Water"), { target: { value: "Healing Hands" } });
    fireEvent.click(screen.getByTestId("button-trusted-help-save-provider"));

    expect(screen.queryByTestId("label-trusted-help-source-own-empty")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nudge-trusted-help-empty-provider")).not.toBeInTheDocument();
  });

  it("moves the user to the next setup step after each choice", async () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    renderTrustedHelp();

    fireEvent.click(screen.getByTestId("button-trusted-help-dashboard-add-service"));
    fireEvent.click(screen.getByTestId("button-trusted-help-service-home-care"));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Home Care type");

    scrollIntoView.mockClear();
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-home-care-plumbing"));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(screen.getByTestId("section-trusted-help-provider-source")).toHaveTextContent("Who should VYVA use for plumbing?");
  });

  it("adapts VYVA Find rules to the selected service", () => {
    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-wellness"));
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Massage");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Hair Care");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Nail Care");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Foot Care");
    expect(screen.getByTestId("section-trusted-help-subservices")).not.toHaveTextContent("Beauty");
    expect(screen.getByTestId("section-trusted-help-subservices")).not.toHaveTextContent("Spa");
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-wellness-massage"));
    fireEvent.click(screen.getByTestId("button-trusted-help-source-vyva-find"));

    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Service");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Hair Care");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Nail Care");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Massage");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Foot Care");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Place");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).not.toHaveTextContent("Residence");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Budget");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).not.toHaveTextContent("Search area");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).not.toHaveTextContent("Specialist");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).not.toHaveTextContent("Medical");

    fireEvent.click(screen.getByTestId("button-trusted-help-rule-service-type-massage"));
    fireEvent.click(screen.getByTestId("button-trusted-help-rule-location-home-visit"));
    fireEvent.click(screen.getByTestId("button-trusted-help-rule-trust-reviewed"));
    fireEvent.click(screen.getByTestId("button-trusted-help-rule-budget-low-cost"));

    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA can search using your rules: Massage, Home visit, Reviewed, Low cost.");
  });

  it("lets Other use safe generic concierge rules", () => {
    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-other"));
    fireEvent.click(screen.getByTestId("button-trusted-help-source-vyva-find"));

    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("Request details");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Need");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Trusted search");
    expect(screen.getByTestId("panel-trusted-help-vyva-find")).toHaveTextContent("Family ok");

    fireEvent.click(screen.getByTestId("button-trusted-help-rule-need-errand"));
    fireEvent.click(screen.getByTestId("button-trusted-help-rule-source-family-input"));
    fireEvent.click(screen.getByTestId("button-trusted-help-rule-control-prepare-only"));

    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA can search using your rules: Errand, Family input, Prepare only.");
  });

  it("shows the VYVA plan as a first-time modal only", () => {
    const { unmount } = renderTrustedHelp();

    openTrustedHelpTab("review");
    expect(screen.getByTestId("modal-trusted-help-test-run")).toHaveTextContent("This setup tells VYVA");
    expect(screen.queryByTestId("section-trusted-help-test-run")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-trusted-help-modal-continue")).toHaveTextContent("Continue to review");
    fireEvent.click(screen.getByTestId("button-trusted-help-modal-continue"));
    expect(screen.queryByTestId("modal-trusted-help-test-run")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("vyva.trustedHelp.testRunSeen")).toBe("true");

    unmount();
    renderTrustedHelp();
    openTrustedHelpTab("review");
    expect(screen.queryByTestId("modal-trusted-help-test-run")).not.toBeInTheDocument();
  });

  it("shows provider detail prompts for concierge-only services", () => {
    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-home-care"));
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Plumbing");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Electrical");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Safety Fixes");
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-home-care-plumbing"));
    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("What needs fixing");
    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("Quote first");

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-transport"));
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Accessible Ride");
    expect(screen.getByTestId("section-trusted-help-subservices")).toHaveTextContent("Assisted Ride");
    expect(screen.getByTestId("section-trusted-help-subservices")).not.toHaveTextContent("Scheduled ride");

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-wellness"));
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-wellness-hair-care"));
    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("Wellness details");
    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("Service type");
    expect(screen.getByTestId("panel-trusted-help-provider-details")).toHaveTextContent("Preferred person");
  });

  it("shows partner brands that match the selected service type", () => {
    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-groceries"));
    expect(screen.queryByTestId("section-trusted-help-subservices")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-trusted-help-source-partner"));

    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Aquaservice");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Waterdrop Home");
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Mercadona");
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Glovo");
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Uber Eats");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-aquaservice")).toHaveTextContent("Water");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-mercadona")).toHaveTextContent("Food");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-mercadona")).toHaveTextContent("Household");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-glovo-groceries")).toHaveTextContent("Meals");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-ubereats-meals")).toHaveTextContent("Meals");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-aquaservice")).toHaveTextContent("Aqua");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-mercadona")).toHaveTextContent("M");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-glovo-groceries")).toHaveTextContent("G");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-ubereats-meals")).toHaveTextContent("Uber");

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-home-care"));
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-home-care-plumbing"));
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Taskrabbit");
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Cronoshare");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-taskrabbit")).toHaveTextContent("Task");

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-wellness"));
    fireEvent.click(screen.getByTestId("button-trusted-help-subservice-wellness-hair-care"));
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Treatwell");
    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Wellness booking");
    expect(screen.getByTestId("logo-trusted-help-partner-partner-treatwell")).toHaveTextContent("T");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Quiron Salud");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Doctoralia");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Cuideo");
  });

  it("reads VYVA partners from the managed catalog", () => {
    const managedPartners: TrustedHelpPartner[] = [
      {
        id: "partner-local-market",
        name: "Local Market",
        service: "groceries",
        label: "Groceries and water",
        method: "Phone order",
        payment: "Family approves",
        coverage: ["Food", "Water"],
        enabled: true,
        logo: { text: "LM", bg: "#ECFDF5", fg: "#047857", border: "#BBF7D0" },
      },
      {
        id: "partner-hidden-market",
        name: "Hidden Market",
        service: "groceries",
        label: "Hidden groceries",
        method: "Online",
        payment: "Saved payment",
        coverage: ["Food"],
        enabled: false,
        logo: { text: "H", bg: "#F8FAFC", fg: "#111827", border: "#CBD5E1" },
      },
    ];
    window.localStorage.setItem(TRUSTED_HELP_PARTNERS_STORAGE_KEY, JSON.stringify(managedPartners));

    renderTrustedHelp();

    openTrustedHelpTab("provider");
    fireEvent.click(screen.getByTestId("button-trusted-help-source-partner"));

    expect(screen.getByTestId("panel-trusted-help-partners")).toHaveTextContent("Local Market");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Mercadona");
    expect(screen.getByTestId("panel-trusted-help-partners")).not.toHaveTextContent("Hidden Market");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-local-market")).toHaveTextContent("Food");
    expect(screen.getByTestId("coverage-trusted-help-partner-partner-local-market")).toHaveTextContent("Water");
  });

  it("hides the VYVA Partner source when a selected service has no enabled partners", () => {
    const managedPartners: TrustedHelpPartner[] = [
      {
        id: "partner-local-market",
        name: "Local Market",
        service: "groceries",
        label: "Groceries and water",
        method: "Phone order",
        payment: "Family approves",
        coverage: ["Food", "Water"],
        enabled: true,
        logo: { text: "LM", bg: "#ECFDF5", fg: "#047857", border: "#BBF7D0" },
      },
    ];
    window.localStorage.setItem(TRUSTED_HELP_PARTNERS_STORAGE_KEY, JSON.stringify(managedPartners));

    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-other"));

    expect(screen.getByTestId("section-trusted-help-provider-source")).toHaveTextContent("My Provider");
    expect(screen.getByTestId("section-trusted-help-provider-source")).toHaveTextContent("Let VYVA Find");
    expect(screen.queryByTestId("button-trusted-help-source-partner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-trusted-help-partners")).not.toBeInTheDocument();
  });

  it("lets a family member add a usual provider for a service", () => {
    renderTrustedHelp();

    openTrustedHelpTab("service");
    fireEvent.click(screen.getByTestId("button-trusted-help-service-groceries"));
    fireEvent.click(screen.getByTestId("button-trusted-help-add-provider"));
    fireEvent.change(screen.getByPlaceholderText("AquaHome Water"), { target: { value: "Corner Market" } });
    fireEvent.change(screen.getByPlaceholderText("Phone, WhatsApp, email, booking link"), { target: { value: "WhatsApp" } });
    fireEvent.click(screen.getByTestId("button-trusted-help-save-provider"));

    expect(screen.getByTestId("section-trusted-help-providers")).toHaveTextContent("Corner Market");
    expect(screen.getByTestId("coverage-trusted-provider-provider-water")).toHaveTextContent("Water");
    expect(screen.getByTestId("section-trusted-help-providers")).toHaveTextContent("Food");
    expect(screen.getByTestId("section-trusted-help-providers")).toHaveTextContent("Household");
    openTrustedHelpTab("review");
    expect(screen.getByTestId("trusted-help-test-run-copy")).toHaveTextContent("VYVA starts with Corner Market for groceries.");
  });

  it("can add a VYVA partner as a saved provider", () => {
    renderTrustedHelp();

    openTrustedHelpTab("provider");
    fireEvent.click(screen.getByTestId("button-trusted-help-source-partner"));
    fireEvent.click(screen.getByTestId("button-trusted-help-partner-partner-aquaservice"));

    expect(screen.getByTestId("section-trusted-help-providers")).toHaveTextContent("Aquaservice");
    expect(screen.getByTestId("section-trusted-help-providers")).toHaveTextContent("Water");
  });

  it("lets caregiver permissions be toggled without granting broad admin access", () => {
    renderTrustedHelp();

    openTrustedHelpTab("controls");
    const caregiverCard = screen.getByTestId("card-trusted-help-caregiver-ana");
    const approveButton = within(caregiverCard).getByTestId("button-caregiver-ana-approve");

    expect(approveButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(approveButton);
    expect(approveButton).toHaveAttribute("aria-pressed", "true");
  });

  it("saves setup before offering Concierge or another service", () => {
    renderTrustedHelp();

    openTrustedHelpTab("review");
    fireEvent.click(screen.getByTestId("button-trusted-help-modal-continue"));
    fireEvent.click(screen.getByTestId("button-trusted-help-save-setup"));

    expect(screen.getByTestId("section-trusted-help-save")).toHaveTextContent("Setup saved");
    expect(screen.getByTestId("button-trusted-help-add-another")).toHaveTextContent("Add another service");
    fireEvent.click(screen.getByTestId("button-trusted-help-add-another"));
    expect(screen.getByTestId("section-trusted-help-guide")).toHaveTextContent("Groceries");
    expect(screen.queryByTestId("button-trusted-help-service-water")).not.toBeInTheDocument();

    openTrustedHelpTab("review");
    fireEvent.click(screen.getByTestId("button-trusted-help-save-setup"));
    fireEvent.click(screen.getByTestId("button-trusted-help-open-concierge"));
    expect(screen.getByTestId("concierge-route")).toBeInTheDocument();
  });
});
