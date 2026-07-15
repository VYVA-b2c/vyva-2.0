import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ConciergeReadinessAdminPage from "./ConciergeReadinessAdminPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "karim.assad@mokadigital.net", role: "admin" },
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/concierge-readiness"]}>
      <ConciergeReadinessAdminPage />
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

    const table = screen.getByTestId("table-concierge-readiness");
    expect(within(table).getByText("Book ride / transport")).toBeInTheDocument();
    expect(within(table).getAllByText("OTC pharmacy help").length).toBeGreaterThan(0);
    expect(within(table).getByText("Scam or safety check")).toBeInTheDocument();
  });

  it("shows provider setup, entry points, and tool dependencies for launch review", () => {
    renderPage();

    const transportRow = screen.getByTestId("row-concierge-readiness-flow-transport-booking");
    expect(within(transportRow).getByText("Ready")).toBeInTheDocument();
    expect(within(transportRow).getByText("Trusted transport / taxi")).toBeInTheDocument();
    expect(within(transportRow).getByText("Mobility preferences")).toBeInTheDocument();
    expect(within(transportRow).getAllByText("Book Ride")).toHaveLength(2);
    expect(within(transportRow).getByText("Phone call")).toBeInTheDocument();
    expect(within(transportRow).getByText("WhatsApp")).toBeInTheDocument();
    expect(within(transportRow).getByText("10/10 stages")).toBeInTheDocument();

    const scamRow = screen.getByTestId("row-concierge-readiness-flow-scam-check");
    expect(within(scamRow).getByText("No saved provider required")).toBeInTheDocument();
    expect(within(scamRow).getByText("Camera / upload")).toBeInTheDocument();
    expect(within(scamRow).getByText("Web search")).toBeInTheDocument();
  });
});
