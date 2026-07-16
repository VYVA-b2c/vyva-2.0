import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConciergeReadinessAdminPage from "./ConciergeReadinessAdminPage";
import { CONCIERGE_FLOW_REFERENCES } from "../../../shared/conciergeFlowRegistry";
import { buildConciergeLaunchSmokeAudit } from "../../../shared/conciergeLaunchSmokeAudit";
import { buildConciergeReadinessRows, type ConciergeReadinessRow } from "../../../shared/conciergeReadinessDashboard";
import {
  buildConciergeManualQaJsonExport,
  normalizeConciergeManualQaRunnerState,
  updateConciergeManualQaRunnerStatus,
} from "../../../shared/conciergeManualQaRunner";

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
  beforeEach(() => {
    window.localStorage.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

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
    expect(screen.getAllByTestId(/dry-run-fixture-/)).toHaveLength(10);
    expect(screen.getByTestId("manual-qa-runner-summary")).toBeInTheDocument();
    expect(screen.getByTestId("manual-qa-priority-pass")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-not-tested")).getByText(/\d+/)).toBeInTheDocument();
  });

  it("surfaces the high-risk manual QA pass before the remaining Concierge scripts", () => {
    renderPage();

    const priorityPass = screen.getByTestId("manual-qa-priority-pass");
    expect(within(priorityPass).getByText("Test these six high-risk flows first")).toBeInTheDocument();
    expect(within(priorityPass).getByText(/use only qa-controlled phone numbers/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/Book ride \/ transport: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/OTC pharmacy help: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/Medical appointment: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/Home service: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/Insurance \/ admin help: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).getByText(/Scam or safety check: Not tested/i)).toBeInTheDocument();
    expect(within(priorityPass).queryByText(/Shopping \/ groceries \/ meals/i)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-priority-untested")).getByText(/\d+/)).toBeInTheDocument();

    const scriptCards = screen.getAllByTestId(/manual-qa-script-/);
    expect(within(scriptCards[0]).getByRole("heading", { name: "Book ride / transport" })).toBeInTheDocument();
    expect(within(scriptCards[1]).getByRole("heading", { name: "OTC pharmacy help" })).toBeInTheDocument();
    expect(within(scriptCards[2]).getByRole("heading", { name: "Medical appointment" })).toBeInTheDocument();
    expect(within(scriptCards[3]).getByRole("heading", { name: "Home service" })).toBeInTheDocument();
    expect(within(scriptCards[4]).getByRole("heading", { name: "Insurance / admin help" })).toBeInTheDocument();
    expect(within(scriptCards[5]).getByRole("heading", { name: "Scam or safety check" })).toBeInTheDocument();
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
    expect(within(transportScript).getByText("Live Phone call test")).toBeInTheDocument();
    expect(within(transportScript).getByTestId("dry-run-fixture-flow-transport-booking")).toHaveTextContent("Test mode");
    expect(within(transportScript).getByTestId("dry-run-fixture-flow-transport-booking")).toHaveTextContent("+12025550100");
    expect(within(transportScript).getByText("Dry-run test fixture")).toBeInTheDocument();
    expect(within(transportScript).getByText("Missing provider path")).toBeInTheDocument();
    expect(within(transportScript).getByText("Saved provider path")).toBeInTheDocument();
    expect(within(transportScript).getByText(/confirm pickup, destination, time/i)).toBeInTheDocument();
    expect(within(transportScript).getByText("Completed history")).toBeInTheDocument();
    expect(within(transportScript).getByText("Waiting survives reload")).toBeInTheDocument();
    expect(within(transportScript).getByText("No answer and retry confirmation")).toBeInTheDocument();

    expect(within(screen.getByTestId("manual-qa-script-flow-otc-pharmacy")).getByText("Live WhatsApp test")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-script-flow-medical-appointment")).getByText("Live Email test")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-script-flow-home-service")).getByText("Live Booking form test")).toBeInTheDocument();

    const scamScript = screen.getByTestId("manual-qa-script-flow-scam-check");
    expect(within(scamScript).getByText("No provider setup required")).toBeInTheDocument();
    expect(within(scamScript).queryByText("Missing provider path")).not.toBeInTheDocument();
    expect(within(scamScript).queryByText("Saved provider path")).not.toBeInTheDocument();
    expect(within(scamScript).getByText("Camera / upload")).toBeInTheDocument();
    expect(within(scamScript).getByText("Final user confirmation")).toBeInTheDocument();
    expect(within(scamScript).getByText("Outcome capture")).toBeInTheDocument();
  });

  it("lets testers mark manual QA steps and updates the roll-up", () => {
    renderPage();

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    const firstBookRideStatus = within(transportScript).getAllByLabelText(/QA status for Start from Book Ride/i)[0];
    fireEvent.change(firstBookRideStatus, { target: { value: "fail" } });

    expect(within(screen.getByTestId("manual-qa-metric-flows-blocked")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-failed-checks")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-priority-blocked")).getByText("1")).toBeInTheDocument();
    expect(within(transportScript).getByText("Blocked")).toBeInTheDocument();
    expect(within(transportScript).getAllByText("Fail").length).toBeGreaterThan(0);
  });

  it("copies failed and needs-review QA notes for PR or task follow-up", () => {
    renderPage();

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    const bookRideStatuses = within(transportScript).getAllByLabelText(/QA status for Start from Book Ride/i);
    fireEvent.change(bookRideStatuses[0], { target: { value: "fail" } });
    fireEvent.change(bookRideStatuses[1], { target: { value: "needs_review" } });

    fireEvent.click(screen.getByRole("button", { name: /copy qa notes/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const notes = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(notes).toContain("Concierge manual QA notes");
    expect(notes).toContain("Book ride / transport");
    expect(notes).toContain("Fail: Start from Book Ride");
    expect(notes).toContain("Needs review: Start from Book Ride");
    expect(screen.getByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("exports the manual QA report as Markdown and JSON", () => {
    renderPage();

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    const firstBookRideStatus = within(transportScript).getAllByLabelText(/QA status for Start from Book Ride/i)[0];
    fireEvent.change(firstBookRideStatus, { target: { value: "fail" } });

    fireEvent.click(screen.getByRole("button", { name: /copy markdown report/i }));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining("# Concierge manual QA report"));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining("Exported at:"));
    expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(expect.stringContaining("Failed steps:"));
    expect(screen.getByText("Markdown QA report copied.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy json report/i }));
    const clipboardCalls = vi.mocked(navigator.clipboard.writeText).mock.calls;
    const json = clipboardCalls[clipboardCalls.length - 1]?.[0] ?? "";
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe("concierge-manual-qa-runner-v1");
    expect(parsed.exportedAt).toBeTruthy();
    expect(parsed.summary.failedCheckpoints).toBe(1);
    expect(screen.getByText("JSON QA report copied.")).toBeInTheDocument();
  });

  it("imports pasted QA JSON into the local runner state", () => {
    const rows = buildConciergeReadinessRows();
    const scripts = rows.map((row) => row.manualQaScript);
    const transportStep = rows.find((row) => (
      row.reference === CONCIERGE_FLOW_REFERENCES.transportBooking
    ))!.manualQaScript.steps[0];
    let state = normalizeConciergeManualQaRunnerState(scripts, null);
    state = updateConciergeManualQaRunnerStatus(state, transportStep.id, "fail");
    const json = buildConciergeManualQaJsonExport(scripts, state, "2026-07-15T12:00:00.000Z");

    renderPage(rows);

    fireEvent.change(screen.getByLabelText(/import qa state from json/i), { target: { value: json } });
    fireEvent.click(screen.getByRole("button", { name: /import qa state/i }));

    expect(screen.getByText("Imported QA state from 2026-07-15T12:00:00.000Z.")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-failed-checks")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-script-flow-transport-booking")).getByDisplayValue("Fail")).toBeInTheDocument();
  });

  it("shows a clear error when pasted QA JSON is invalid", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/import qa state from json/i), { target: { value: "{bad" } });
    fireEvent.click(screen.getByRole("button", { name: /import qa state/i }));

    expect(screen.getByText("The pasted QA JSON is not valid.")).toBeInTheDocument();
  });

  it("restores locally saved manual QA status from this browser", () => {
    const rows = buildConciergeReadinessRows();
    const transportStep = rows.find((row) => (
      row.reference === CONCIERGE_FLOW_REFERENCES.transportBooking
    ))!.manualQaScript.steps[0];
    window.localStorage.setItem("vyva:conciergeManualQaRunner:v1", JSON.stringify({
      [transportStep.id]: "needs_review",
    }));

    renderPage(rows);

    const transportScript = screen.getByTestId("manual-qa-script-flow-transport-booking");
    expect(within(transportScript).getByDisplayValue("Needs review")).toBeInTheDocument();
    expect(within(screen.getByTestId("manual-qa-metric-needs-review")).getByText("1")).toBeInTheDocument();
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
