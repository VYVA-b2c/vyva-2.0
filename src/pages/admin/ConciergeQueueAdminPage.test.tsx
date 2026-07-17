import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeQueueAdminPage from "./ConciergeQueueAdminPage";
import { apiFetch } from "@/lib/queryClient";
import type { OperatorConciergeQueueItem } from "../../../shared/conciergeOperatorQueue";

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

const confirmedTask: OperatorConciergeQueueItem = {
  id: "pending-1",
  source: "pending",
  user_id: "user-1",
  user_label: "Carmen",
  user_contact: "+34 600 000 001",
  use_case: "book_ride",
  provider_name: "Safe Taxi",
  provider_phone: "+34 611 111 111",
  action_summary: "Book a ride to the clinic",
  status: "confirmed",
  pending_status: "pending",
  flow_reference: "FLOW_TRANSPORT_BOOKING",
  action_type: "phone_call",
  active_tool: "phone_call",
  missing_labels: [],
  user_confirmed: true,
  confirmed_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:05:00.000Z",
};

const needsInfoTask: OperatorConciergeQueueItem = {
  id: "pending-2",
  source: "pending",
  user_id: "user-2",
  user_label: "Luis",
  user_contact: null,
  use_case: "home_service",
  provider_name: null,
  provider_phone: null,
  action_summary: "Arrange home repair",
  status: "needs_info",
  pending_status: "pending",
  flow_reference: "FLOW_HOME_SERVICE",
  action_type: "manual_review",
  active_tool: "operator_review",
  missing_labels: ["Provider", "Service type"],
  user_confirmed: false,
  confirmed_at: null,
  updated_at: "2026-07-01T10:04:00.000Z",
};

const doneTask: OperatorConciergeQueueItem = {
  id: "session-1",
  source: "session",
  user_id: "user-3",
  user_label: "Ana",
  user_contact: "ana@example.com",
  use_case: "order_medicine",
  provider_name: "Trusted Pharmacy",
  provider_phone: null,
  action_summary: "OTC items confirmed",
  status: "done",
  pending_status: "completed",
  flow_reference: "FLOW_OTC_PHARMACY",
  action_type: "message",
  active_tool: "whatsapp",
  missing_labels: [],
  user_confirmed: true,
  operator_assigned_email: "admin@example.com",
  operator_assigned_to: "admin-1",
  operator_assigned_at: "2026-07-01T09:02:00.000Z",
  confirmed_at: "2026-07-01T09:00:00.000Z",
  updated_at: "2026-07-01T09:30:00.000Z",
};

const otherAssignedTask: OperatorConciergeQueueItem = {
  ...confirmedTask,
  id: "pending-other",
  user_id: "user-4",
  user_label: "Marta",
  action_summary: "Confirm home cleaner",
  use_case: "home_service",
  provider_name: "Clean Home",
  operator_assigned_email: "other@example.com",
  operator_assigned_to: "admin-2",
  operator_assigned_at: "2026-07-01T10:10:00.000Z",
};

const failedAdapterTask: OperatorConciergeQueueItem = {
  ...confirmedTask,
  id: "pending-failed",
  user_id: "user-5",
  user_label: "Elena",
  user_contact: "elena@example.com",
  use_case: "paperwork",
  provider_name: "City Clinic",
  provider_phone: null,
  action_summary: "Email clinic paperwork",
  status: "failed",
  pending_status: "failed",
  flow_reference: "FLOW_INSURANCE_ADMIN",
  action_type: "message",
  active_tool: "email",
  updated_at: "2026-07-01T10:20:00.000Z",
  adapter_incident: {
    status: "failed",
    adapter: "concierge_email_adapter",
    mode: "live",
    channel: "email",
    tool: "email",
    attempted_at: "2026-07-01T10:19:00.000Z",
    provider_name: "City Clinic",
    provider_contact: "frontdesk@example.com",
    external_action_allowed: true,
    result: "failed",
    error: "Adapter endpoint failed with 500.",
    response_status: 500,
    simulated: false,
    live: true,
    retry_allowed: true,
    retry_blocker: null,
    manual_follow_up_allowed: true,
    manual_follow_up_queued_at: null,
    attempts: [
      {
        event: "adapter_execution_failed",
        at: "2026-07-01T10:19:00.000Z",
        source: "confirm_endpoint",
        status: "failed",
        adapter: "concierge_email_adapter",
        mode: "live",
        channel: "email",
        provider_name: "City Clinic",
        provider_contact: "frontdesk@example.com",
        result: "failed",
        error: "Adapter endpoint failed with 500.",
        response_status: 500,
      },
      {
        event: "adapter_retry_requested",
        at: "2026-07-01T10:21:00.000Z",
        source: "operator_queue",
        status: null,
        adapter: null,
        mode: "live",
        channel: null,
        provider_name: null,
        provider_contact: null,
        result: null,
        reason: "retry after endpoint restored",
      },
    ],
  },
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage(items: OperatorConciergeQueueItem[] = [confirmedTask, needsInfoTask, doneTask]) {
  apiFetchMock.mockImplementation((path, init) => {
    if (path === "/api/admin/concierge/queue" && (init?.method ?? "GET") === "GET") {
      return Promise.resolve(jsonResponse({
        items,
        totals: {
          needs_info: items.filter((item) => item.status === "needs_info").length,
          ready: items.filter((item) => item.status === "ready").length,
          confirmed: items.filter((item) => item.status === "confirmed").length,
          in_progress: items.filter((item) => item.status === "in_progress").length,
          done: items.filter((item) => item.status === "done").length,
          failed: items.filter((item) => item.status === "failed").length,
        },
      }));
    }
    if (String(path).startsWith("/api/admin/concierge/queue/") && init?.method === "PATCH") {
      return Promise.resolve(jsonResponse({ ok: true }));
    }
    return Promise.resolve(new Response(JSON.stringify({ error: "Unexpected request" }), { status: 500 }));
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/concierge-queue"]}>
      <ConciergeQueueAdminPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("ConciergeQueueAdminPage", () => {
  it("loads the operator queue and summarizes task statuses", async () => {
    renderPage();

    expect(await screen.findByText("Book a ride to the clinic")).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/concierge/queue");
    const summary = screen.getByTestId("admin-concierge-queue-summary");
    expect(summary).toHaveTextContent("Showing 3 of 3 Concierge tasks.");
    expect(summary).toHaveTextContent("Needs info");
    expect(summary).toHaveTextContent("Confirmed");
    expect(summary).toHaveTextContent("Done");

    const list = screen.getByTestId("admin-concierge-queue-list");
    expect(within(list).getByText("Carmen - +34 600 000 001")).toBeInTheDocument();
    expect(within(list).getByText("Safe Taxi")).toBeInTheDocument();
    expect(within(list).getByText("Assigned to me")).toBeInTheDocument();
    expect(within(list).getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(within(list).getByText("Provider, Service type")).toBeInTheDocument();
  });

  it("filters the visible queue by operator status", async () => {
    renderPage();

    expect(await screen.findByText("Arrange home repair")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("admin-concierge-queue-filter-confirmed"));

    const list = screen.getByTestId("admin-concierge-queue-list");
    expect(within(list).getByText("Book a ride to the clinic")).toBeInTheDocument();
    expect(within(list).queryByText("Arrange home repair")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-concierge-queue-summary")).toHaveTextContent("Showing 1 of 3 Concierge tasks.");

    fireEvent.click(screen.getByTestId("admin-concierge-queue-filter-needs_info"));

    expect(within(list).getByText("Arrange home repair")).toBeInTheDocument();
    expect(within(list).queryByText("Book a ride to the clinic")).not.toBeInTheDocument();
  });

  it("filters visible tasks by adapter status", async () => {
    renderPage([confirmedTask, failedAdapterTask, doneTask]);

    expect(await screen.findByText("Email clinic paperwork")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("admin-concierge-adapter-filter-failed"));

    const list = screen.getByTestId("admin-concierge-queue-list");
    expect(within(list).getByText("Email clinic paperwork")).toBeInTheDocument();
    expect(within(list).queryByText("Book a ride to the clinic")).not.toBeInTheDocument();
    expect(within(list).queryByText("OTC items confirmed")).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-concierge-queue-summary")).toHaveTextContent("Showing 1 of 3 Concierge tasks.");
  });

  it("filters by owner and lets the operator take an unassigned task", async () => {
    renderPage();

    expect(await screen.findByText("Book a ride to the clinic")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("admin-concierge-owner-filter-mine"));

    const list = screen.getByTestId("admin-concierge-queue-list");
    expect(within(list).getByText("OTC items confirmed")).toBeInTheDocument();
    expect(within(list).queryByText("Book a ride to the clinic")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("admin-concierge-owner-filter-unassigned"));
    expect(within(list).getByText("Book a ride to the clinic")).toBeInTheDocument();

    fireEvent.click(within(list).getAllByRole("button", { name: "Take task" })[0]);

    expect(await screen.findByText("Task assigned to you.")).toBeInTheDocument();
    const assignCall = apiFetchMock.mock.calls.find(([path, init]) => (
      path === "/api/admin/concierge/queue/pending-1"
      && init?.method === "PATCH"
      && String(init.body).includes('"action":"assign"')
    ));
    expect(assignCall).toBeTruthy();
  });

  it("opens task details and records an operator outcome", async () => {
    renderPage();

    expect(await screen.findByText("Book a ride to the clinic")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Open task" })[0]);

    const dialog = screen.getByRole("dialog", { name: "Book a ride to the clinic" });
    expect(dialog).toHaveTextContent("Safe Taxi");
    fireEvent.change(within(dialog).getByLabelText("Operator note"), {
      target: { value: "Taxi confirmed for 10:30." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark done" }));

    expect(await screen.findByText("Concierge task updated.")).toBeInTheDocument();
    const patchCall = apiFetchMock.mock.calls.find(([path, init]) => (
      path === "/api/admin/concierge/queue/pending-1" && init?.method === "PATCH"
    ));
    expect(patchCall).toBeTruthy();
    expect(String(patchCall?.[1]?.body)).toContain('"action":"done"');
    expect(String(patchCall?.[1]?.body)).toContain("Taxi confirmed for 10:30.");
  });

  it("shows adapter incident history and requests recovery actions", async () => {
    renderPage([failedAdapterTask]);

    expect(await screen.findByText("Email clinic paperwork")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open task" }));

    const dialog = screen.getByRole("dialog", { name: "Email clinic paperwork" });
    expect(dialog).toHaveTextContent("Channel incident");
    expect(dialog).toHaveTextContent("Adapter endpoint failed with 500.");
    expect(dialog).toHaveTextContent("adapter retry requested");

    fireEvent.change(within(dialog).getByLabelText("Operator note"), {
      target: { value: "Endpoint fixed; retrying." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry live action" }));

    expect(await screen.findByText("Adapter retry requested.")).toBeInTheDocument();
    const retryCall = apiFetchMock.mock.calls.find(([path, init]) => (
      path === "/api/admin/concierge/queue/pending-failed"
      && init?.method === "PATCH"
      && String(init.body).includes('"action":"retry_adapter"')
    ));
    expect(retryCall).toBeTruthy();
    expect(String(retryCall?.[1]?.body)).toContain("Endpoint fixed; retrying.");
  });

  it("queues manual follow-up for a failed live adapter task", async () => {
    renderPage([failedAdapterTask]);

    expect(await screen.findByText("Email clinic paperwork")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open task" }));

    const dialog = screen.getByRole("dialog", { name: "Email clinic paperwork" });
    fireEvent.change(within(dialog).getByLabelText("Operator note"), {
      target: { value: "Calling clinic manually." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Manual follow-up queued" }));

    expect(await screen.findByText("Manual follow-up queued.")).toBeInTheDocument();
    const manualCall = apiFetchMock.mock.calls.find(([path, init]) => (
      path === "/api/admin/concierge/queue/pending-failed"
      && init?.method === "PATCH"
      && String(init.body).includes('"action":"manual_follow_up"')
    ));
    expect(manualCall).toBeTruthy();
    expect(String(manualCall?.[1]?.body)).toContain("Calling clinic manually.");
  });

  it("shows another operator assignment as read-only for the current operator", async () => {
    renderPage([otherAssignedTask]);

    expect(await screen.findByText("Confirm home cleaner")).toBeInTheDocument();
    expect(screen.getByText("Assigned to other@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Take task" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open task" }));

    const dialog = screen.getByRole("dialog", { name: "Confirm home cleaner" });
    expect(dialog).toHaveTextContent("Assigned to other@example.com");
    expect(within(dialog).queryByRole("button", { name: "Mark done" })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/read-only/i)).toBeInTheDocument();
  });
});
