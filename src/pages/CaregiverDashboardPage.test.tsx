import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const baseCaregiverPayload = {
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
    status: "new",
    acknowledged_at: null,
    acknowledged_by: null,
    contacted_at: null,
    resolved_at: null,
    resolved_by: null,
    caregiver_note: null,
    created_at: "2026-05-29T10:01:00.000Z",
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mockApi() {
  const caregiverState = clone(baseCaregiverPayload);

  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);

    if (path.includes("/api/checkins/today")) {
      return new Response(JSON.stringify(checkinPayload), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (path.includes("/workflow") && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body ?? "{}")) as { status: "new" | "reviewed" | "contacted" | "resolved"; caregiver_note?: string | null };
      const alert = caregiverState.alerts[0];
      const updated = {
        ...alert,
        status: body.status,
        acknowledged_at: body.status === "reviewed" || body.status === "contacted" || body.status === "resolved"
          ? alert.acknowledged_at ?? "2026-05-29T10:02:00.000Z"
          : alert.acknowledged_at,
        acknowledged_by: body.status === "reviewed" || body.status === "contacted" || body.status === "resolved"
          ? alert.acknowledged_by ?? "caregiver-1"
          : alert.acknowledged_by,
        contacted_at: body.status === "contacted" ? alert.contacted_at ?? "2026-05-29T10:03:00.000Z" : alert.contacted_at,
        resolved_at: body.status === "resolved" ? alert.resolved_at ?? "2026-05-29T10:04:00.000Z" : alert.resolved_at,
        resolved_by: body.status === "resolved" ? alert.resolved_by ?? "caregiver-1" : alert.resolved_by,
        caregiver_note: Object.prototype.hasOwnProperty.call(body, "caregiver_note") ? body.caregiver_note ?? null : alert.caregiver_note,
      };
      caregiverState.alerts[0] = updated;
      return new Response(JSON.stringify({ alert: updated }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(caregiverState), { status: 200, headers: { "Content-Type": "application/json" } });
  });

  return caregiverState;
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

  it("marks an alert reviewed through the workflow API without changing the alert message", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() => {
      expect(screen.getByText("Reviewed")).toBeInTheDocument();
    });
    expect(screen.getByText(/Seek urgent help now/i)).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/vitals-engine/caregiver/alerts/alert-1/workflow",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "reviewed" }),
      }),
    );
  });

  it("keeps workflow state after rerender because it comes from the server response", async () => {
    mockApi();

    const firstRender = renderPage();

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark contacted" }));
    await waitFor(() => {
      expect(screen.getByText("Contacted")).toBeInTheDocument();
    });

    firstRender.unmount();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Contacted")).toBeInTheDocument();
    });
  });

  it("shows that caregiver status tracking is server-backed", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Saved caregiver workflow")).toBeInTheDocument();
    });

    expect(screen.getByText("Status updates are saved to this alert and available after refresh or another caregiver session.")).toBeInTheDocument();
  });

  it("saves a caregiver note through the workflow API", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Caregiver note")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Caregiver note"), { target: { value: "Called and left a voicemail." } });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/vitals-engine/caregiver/alerts/alert-1/workflow",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "new", caregiver_note: "Called and left a voicemail." }),
        }),
      );
    });
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
