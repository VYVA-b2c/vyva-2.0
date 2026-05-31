import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
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

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo | URL) => {
    const path = String(input);
    const payload = path.includes("/api/checkins/today") ? checkinPayload : caregiverPayload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CaregiverDashboardPage />
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
