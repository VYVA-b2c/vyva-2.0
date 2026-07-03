import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminActivityPage from "./AdminActivityPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const activity = [
  {
    id: "activity-1",
    source: "communication",
    actor: "system",
    action: "Email send failed",
    event_type: "communication_failed",
    result: "Failed",
    result_status: "failed",
    target_type: "user",
    target_name: "Karim Assad",
    target_detail: "karim@example.com",
    channel: "email",
    details: "Provider rejected the message.",
    created_at: "2026-07-02T10:00:00.000Z",
  },
  {
    id: "activity-2",
    source: "lifecycle",
    actor: "ops@example.com",
    action: "Consent queued",
    event_type: "consent_call",
    result: "Queued",
    result_status: "warning",
    target_type: "user",
    target_name: "Hassan Assad",
    target_detail: "phone",
    channel: "phone",
    details: "Waiting for callback.",
    created_at: "2026-07-02T09:00:00.000Z",
  },
  {
    id: "activity-3",
    source: "lifecycle",
    actor: "ops@example.com",
    action: "Tier changed",
    event_type: "tier_changed",
    result: "Completed",
    result_status: "success",
    target_type: "user",
    target_name: "Sara Assad",
    target_detail: null,
    channel: null,
    details: "Premium applied.",
    created_at: "2026-07-02T08:00:00.000Z",
  },
] as const;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  apiFetchMock.mockResolvedValue(jsonResponse({
    activity,
    summary: {
      total: 3,
      failed: 1,
      warning: 1,
      latest_at: "2026-07-02T10:00:00.000Z",
    },
  }));

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/activity"]}>
      <AdminActivityPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("AdminActivityPage", () => {
  it("shows the review queue and filters by result and source", async () => {
    renderPage();

    expect((await screen.findAllByText("Email send failed")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Consent queued").length).toBeGreaterThan(0);
    expect(screen.getByText("3 visible of 3 loaded events.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Show failed/i }));
    expect(screen.getByText("1 visible of 3 loaded events.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Source filter"), { target: { value: "lifecycle" } });
    expect(screen.getByText("0 visible of 3 loaded events.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reset/i }));
    await waitFor(() => {
      expect(screen.getByText("3 visible of 3 loaded events.")).toBeInTheDocument();
    });
  });
});
