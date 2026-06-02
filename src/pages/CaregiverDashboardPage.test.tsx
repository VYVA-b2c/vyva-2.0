import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage, { caregiverAlertContext, caregiverAlertServiceActionKindsFor, caregiverAlertServiceActionsFor } from "./CaregiverDashboardPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const caregiverPayload = {
  latest_analysis: {
    recommended_action: "share_with_caregiver",
    caregiver_note: "Share with caregiver: A repeated baseline change is visible.",
    risk_score: 48,
    acknowledged_at: null,
    analysed_at: "2026-05-29T10:00:00.000Z",
  },
  alerts: [{
    id: "alert-1",
    alert_type: "triage_report",
    severity: "urgent_help",
    message: "Symptom report: chest discomfort\nNext: Seek urgent help now.",
    sent_to: ["+1 555 0100", "nurse@example.com"],
    created_at: "2026-05-29T10:01:00.000Z",
    resolved_at: null,
  }],
};

const checkinPayload = {
  status: "completed",
  latest_checkin: {
    completed_at: "2026-05-29T09:30:00.000Z",
    feeling_label: "Feeling okay today",
    highlight: null,
  },
  no_response: {
    overdue: false,
    alert_created: false,
    can_alert_caregiver: true,
    reason: null,
  },
  caregiver_alert: null,
  message: "Daily check-in complete",
};

const profilePayload = {
  gpName: "Dr Garcia",
  gpPhone: "+34 612 345 678",
  gpEmail: "gp@example.com",
};

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo | URL) => {
    const path = String(input);
    const payload = path.includes("/api/checkins/today")
      ? checkinPayload
      : path.includes("/api/profile")
        ? profilePayload
        : caregiverPayload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </div>
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CaregiverDashboardPage />} />
          <Route path="/health/doctor" element={<LocationProbe />} />
          <Route path="/concierge" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("CaregiverDashboardPage", () => {
  it("shows the caregiver action center with the existing safety status and alert timeline", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Caregiver aware")).toBeInTheDocument();
    });
    expect(screen.getByText("Caregiver action center")).toBeInTheDocument();
    expect(screen.getByText("Unified safety summary")).toBeInTheDocument();
    expect(screen.getByText("Alert timeline")).toBeInTheDocument();
    expect(screen.getAllByText("1 open").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Symptom report: chest discomfort/i).length).toBeGreaterThan(0);
  });

  it("lets a caregiver acknowledge an alert without changing the alert message", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    expect(screen.getByText(/Seek urgent help now/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("vyva_caregiver_alert_workflow_v1")).toContain("acknowledged");
  });

  it("shows that caregiver status tracking is local to this device", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Local caregiver workspace")).toBeInTheDocument();
    });

    expect(screen.getByText("These status updates are stored on this device only.")).toBeInTheDocument();
  });

  it("renders contact actions from existing alert recipients", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /call \+1 555 0100/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /call \+1 555 0100/i })).toHaveAttribute("href", "tel:+15550100");
    expect(screen.getByRole("link", { name: /email nurse@example.com/i })).toHaveAttribute("href", "mailto:nurse@example.com");
  });

  it("maps urgent caregiver alerts to direct service actions", () => {
    expect(caregiverAlertServiceActionKindsFor(caregiverPayload.alerts[0], "urgent_help")).toEqual([
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(caregiverAlertContext(caregiverPayload.alerts[0], "Urgent help")).toContain("VYVA caregiver alert");
    expect(caregiverAlertContext(caregiverPayload.alerts[0], "Urgent help")).toContain("Symptom report");
  });

  it("adds saved GP call and email links to caregiver alert service actions", () => {
    const actions = caregiverAlertServiceActionsFor(caregiverPayload.alerts[0], "urgent_help", profilePayload);

    expect(actions.map((action) => action.kind)).toEqual([
      "call_gp",
      "email_gp",
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(actions[0]).toMatchObject({
      label: "Call Dr Garcia",
      href: "tel:+34612345678",
    });
    expect(actions[1]).toMatchObject({
      label: "Email GP",
      href: expect.stringContaining("mailto:gp@example.com"),
    });
    expect(actions[1].href).toContain("VYVA%20caregiver%20alert");
  });

  it("renders saved GP call and email actions inside caregiver alert fast services", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toBeInTheDocument();
    });

    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-email_gp")).toHaveTextContent("Email GP");
  });

  it("opens doctor support with caregiver alert context", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-doctor_help")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-caregiver-alert-service-alert-1-doctor_help"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/health/doctor");
    expect(screen.getByTestId("route-state")).toHaveTextContent("caregiver_alert");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Symptom report");
  });

  it("opens concierge with prepared appointment and ride requests", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-schedule_appointment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-caregiver-alert-service-alert-1-schedule_appointment"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("caregiver_alert");
    expect(screen.getByTestId("route-state")).toHaveTextContent("appointment");
  });

  it("builds a weekly caregiver digest from the existing alert feed", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Weekly caregiver digest")).toBeInTheDocument();
    });

    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText(/Current safety status: Caregiver aware/i)).toBeInTheDocument();
    expect(screen.getByText(/Open alerts: 1/i)).toBeInTheDocument();
  });
});
