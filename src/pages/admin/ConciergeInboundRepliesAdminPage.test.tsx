import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConciergeInboundRepliesAdminPage from "./ConciergeInboundRepliesAdminPage";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({ apiFetch: apiFetchMock }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "ops@vyva.life", role: "admin" },
    logout: vi.fn(),
  }),
}));

const MESSAGE_ID = "11111111-1111-4111-8111-111111111111";
const PENDING_ID = "22222222-2222-4222-8222-222222222222";

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ConciergeInboundRepliesAdminPage />
    </MemoryRouter>,
  );
}

describe("Concierge inbound reply review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockReturnValue(response({
      items: [{
        id: MESSAGE_ID,
        senderEmail: "clinic@example.com",
        subject: "Re: Appointment request",
        preview: "Please confirm which day works.",
        receivedAt: "2026-07-18T10:00:00.000Z",
        matchReason: "multiple_open_tasks_for_sender",
        candidates: [{
          id: PENDING_ID,
          userLabel: "Karim",
          providerName: "City Clinic",
          actionSummary: "Arrange an appointment",
          updatedAt: "2026-07-18T09:00:00.000Z",
        }],
      }],
    }));
  });

  it("shows a simple unmatched reply and connects it to a task", async () => {
    renderPage();

    expect(await screen.findByText("Re: Appointment request")).toBeInTheDocument();
    expect(screen.queryByText("multiple_open_tasks_for_sender")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Matching task"), { target: { value: PENDING_ID } });
    apiFetchMock.mockReturnValueOnce(response({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenLastCalledWith(
      `/api/admin/concierge/inbound-replies/${MESSAGE_ID}`,
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ action: "link", pending_id: PENDING_ID }),
      }),
    ));
    expect(await screen.findByText("Reply connected to the task.")).toBeInTheDocument();
  });

  it("shows a clear empty state", async () => {
    apiFetchMock.mockReturnValue(response({ items: [] }));
    renderPage();

    expect(await screen.findByText("No replies need review")).toBeInTheDocument();
  });
});
