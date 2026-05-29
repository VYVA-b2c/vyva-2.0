import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

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
  it("shows the latest safety status and caregiver alert", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(JSON.stringify({
      latest_analysis: {
        recommended_action: "share_with_caregiver",
        caregiver_note: "Share with caregiver: A repeated baseline change is visible.",
        risk_score: 48,
        acknowledged_at: null,
        analysed_at: "2026-05-29T10:00:00.000Z",
      },
      alerts: [{
        id: "alert-1",
        alert_type: "vitals_safety_check",
        severity: "info",
        message: "Share with caregiver: A repeated baseline change is visible.",
        created_at: "2026-05-29T10:01:00.000Z",
        resolved_at: null,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Caregiver aware")).toBeInTheDocument();
    });
    expect(screen.getAllByText(/repeated baseline change/i).length).toBeGreaterThan(0);
    expect(screen.getByText("1 open")).toBeInTheDocument();
  });
});
