import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ConciergeReadinessAdminPage from "./ConciergeReadinessAdminPage";
import { CONCIERGE_FLOW_REFERENCES } from "../../../shared/conciergeFlowRegistry";
import { buildConciergeLaunchSmokeAudit } from "../../../shared/conciergeLaunchSmokeAudit";
import { buildConciergeReadinessRows, type ConciergeReadinessRow } from "../../../shared/conciergeReadinessDashboard";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "karim.assad@mokadigital.net", role: "admin" },
    logout: vi.fn(),
  }),
}));

function renderPage(rowsOverride?: ConciergeReadinessRow[]) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/concierge-readiness"]}>
      <ConciergeReadinessAdminPage rowsOverride={rowsOverride} />
    </MemoryRouter>,
  );
}

describe("ConciergeReadinessAdminPage", () => {
  it("renders the internal readiness table and summary metrics", () => {
    renderPage();

    expect(screen.getByTestId("page-concierge-readiness")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /concierge flow readiness/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /concierge readiness.*flow coverage and launch gates/i }))
      .toHaveAttribute("aria-current", "page");

    expect(within(screen.getByTestId("metric-concierge-readiness-total")).getByText("10")).toBeInTheDocument();
    expect(within(screen.getByTestId("metric-concierge-readiness-ready")).getByText("10")).toBeInTheDocument();
    expect(within(screen.getByTestId("metric-concierge-readiness-needs-attention")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("metric-concierge-readiness-qa-checks")).getByText("50")).toBeInTheDocument();

    const table = screen.getByTestId("table-concierge-readiness");
    expect(screen.getAllByTestId(/row-concierge-readiness-/)).toHaveLength(10);
    expect(within(table).getByText("Book ride / transport")).toBeInTheDocument();
    expect(within(table).getAllByText("OTC pharmacy help").length).toBeGreaterThan(0);
    expect(within(table).getByText("Scam or safety check")).toBeInTheDocument();
    expect(screen.getByTestId("section-manual-qa-script")).toBeInTheDocument();
    expect(screen.getAllByTestId(/manual-qa-script-/)).toHaveLength(10);
  });

  it("shows provider setup, entry points, and tool dependencies for launch review", () => {
    renderPage();

    const transportRow = screen.getByTestId("row-concierge-readiness-flow-transport-booking");
    expect(within(transportRow).getByText("Smoke pass")).toBeInTheDocument();
    expect(within(transportRow).getByText("Registry ready")).toBeInTheDocument();
    expect(within(transportRow).getByText("Trusted transport / taxi")).toBeInTheDocument();
    expect(within(transportRow).getByText("Mobility preferences")).toBeInTheDocument();
    expect(within(transportRow).getAllByText("Book Ride")).toHaveLength(2);
    expect(within(transportRow).getByText("Phone call")).toBeInTheDocument();
    expect(within(transportRow).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(transportRow).getByText("10/10 stages")).toBeInTheDocument();
    expect(within(transportRow).getByText(/confirm pickup, destination, time/i)).toBeInTheDocument();
    expect(within(transportRow).getByText("Handoff and completed history")).toBeInTheDocument();

    const scamRow = screen.getByTestId("row-concierge-readiness-flow-scam-check");
    expect(within(scamRow).getByText("No saved provider required")).toBeInTheDocument();
    expect(within(scamRow).getByText("Not required")).toBeInTheDocument();
    expect(within(scamRow).getByText("Camera / upload")).toBeInTheDocument();
    expect(within(scamRow).getByText("Web search")).toBeInTheDocument();
  });

  it("renders generated manual QA scripts with provider paths, confirmation, and history checks", () => {
    renderPage();

    const manualSection = screen.getByTestId("section-manual-qa-script");
    expect(within(manualSection).getByRole("heading", { name: /flow-by-flow test guide/i })).toBeInTheDocument();

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    expect(within(transportScript).getByText("Provider path")).toBeInTheDocument();
    expect(within(transportScript).getByText("Missing provider path")).toBeInTheDocument();
    expect(within(transportScript).getByText("Saved provider path")).toBeInTheDocument();
    expect(within(transportScript).getByText(/confirm pickup, destination, time/i)).toBeInTheDocument();
    expect(within(transportScript).getByText("Completed history")).toBeInTheDocument();

    const scamScript = screen.getByTestId("manual-qa-script-flow-scam-check");
    expect(within(scamScript).getByText("No provider setup required")).toBeInTheDocument();
    expect(within(scamScript).queryByText("Missing provider path")).not.toBeInTheDocument();
    expect(within(scamScript).queryByText("Saved provider path")).not.toBeInTheDocument();
    expect(within(scamScript).getByText("Camera / upload")).toBeInTheDocument();
    expect(within(scamScript).getByText("Final user confirmation")).toBeInTheDocument();
    expect(within(scamScript).getByText("Outcome capture")).toBeInTheDocument();
  });

  it("keeps manual QA scripts aligned with an injected smoke-audit failure", () => {
    const launchAudit = buildConciergeLaunchSmokeAudit().map((audit) => {
      if (audit.reference !== CONCIERGE_FLOW_REFERENCES.transportBooking) return audit;
      return {
        ...audit,
        checks: audit.checks.map((check, index) => (
          index === 0
            ? { ...check, passed: false, details: ["Book ride entry point lost its route."] }
            : check
        )),
        failures: ["Book ride entry point lost its route."],
      };
    });
    const rows = buildConciergeReadinessRows({ launchAudit });

    renderPage(rows);

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    expect(within(transportScript).getByText("Smoke issue")).toBeInTheDocument();
    const scamScript = screen.getByTestId("manual-qa-script-flow-scam-check");
    expect(within(scamScript).getByText("Smoke pass")).toBeInTheDocument();
  });

  it("surfaces smoke audit failures as a clear needs-attention state", () => {
    const launchAudit = buildConciergeLaunchSmokeAudit().map((audit) => {
      if (audit.reference !== CONCIERGE_FLOW_REFERENCES.transportBooking) return audit;
      return {
        ...audit,
        checks: audit.checks.map((check, index) => (
          index === 0
            ? { ...check, passed: false, details: ["Book ride entry point lost its route."] }
            : check
        )),
        failures: ["Book ride entry point lost its route."],
      };
    });
    const rows = buildConciergeReadinessRows({ launchAudit });

    renderPage(rows);

    expect(within(screen.getByTestId("metric-concierge-readiness-ready")).getByText("9")).toBeInTheDocument();
    expect(within(screen.getByTestId("metric-concierge-readiness-needs-attention")).getByText("1")).toBeInTheDocument();

    const transportRow = screen.getByTestId("row-concierge-readiness-flow-transport-booking");
    expect(within(transportRow).getByTestId(`needs-attention-${CONCIERGE_FLOW_REFERENCES.transportBooking}`)).toBeInTheDocument();
    expect(within(transportRow).getByText("Needs attention")).toBeInTheDocument();
    expect(within(transportRow).getAllByText("Entry points open correct flow").length).toBeGreaterThan(0);
    expect(within(transportRow).getByText("Book ride entry point lost its route.")).toBeInTheDocument();
  });
});
