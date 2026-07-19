import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConciergeTaskInboxPage from "./ConciergeTaskInboxPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);
const draftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="location-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function renderPage(initialEntry = "/concierge/tasks") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/concierge/tasks" element={<><ConciergeTaskInboxPage /><LocationProbe /></>} />
          <Route path="/concierge/tasks/:taskKey" element={<><ConciergeTaskInboxPage /><LocationProbe /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConciergeTaskInboxPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/concierge/tasks") {
        return jsonResponse({ items: [{
          id: draftId,
          user_id: "user-1",
          kind: "appointment",
          entry_payload: { kind: "appointment", appointmentKind: "medical" },
          progress_payload: {},
          stage: "review",
          status: "active",
          linked_pending_id: "reply-1",
          language: "en",
          created_at: "2026-07-18T08:00:00.000Z",
          updated_at: "2026-07-18T10:00:00.000Z",
          completed_at: null,
          deleted_at: null,
        }] });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "reply-1",
          use_case: "book_appointment",
          provider_name: "Harbour Clinic",
          action_summary: "Ask Harbour Clinic for an appointment.",
          action_payload: {
            provider_task_status: "action_needed",
            provider_reply_status: "needs_more_info",
            provider_reply: "Please confirm your insurance plan.",
            provider_response_summary: "Harbour Clinic needs your insurance plan.",
            provider_reply_decisions: [{
              action: "answer_provider",
              status: "draft_ready",
              recordedAt: "2026-07-18T10:05:00.000Z",
              channel: "email",
              summary: "Prepared an answer for the clinic.",
              requiresFreshConfirmation: true,
            }],
          },
          status: "pending",
          updated_at: "2026-07-18T10:05:00.000Z",
        }, {
          id: "waiting-1",
          use_case: "home_service",
          provider_name: "Saved Plumber",
          action_summary: "Waiting for the plumber.",
          action_payload: { waiting_for_provider: true, mission_status: "awaiting_provider_reply" },
          status: "calling",
          updated_at: "2026-07-18T09:00:00.000Z",
        }] });
      }
      if (target === "/api/concierge/actions/sessions") {
        return jsonResponse({ items: [{
          id: "session-1",
          pending_id: "old-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          outcome: "completed",
          outcome_summary: "Ride completed with Radio Taxi.",
          completed_at: "2026-07-17T12:00:00.000Z",
          outcome_payload: { provider_reply: "Driver arrived at 10:00.", provider_task_status: "done" },
        }] });
      }
      return jsonResponse({ items: [] });
    });
  });

  it("groups active and completed tasks without duplicating a linked draft", async () => {
    renderPage();

    expect(await screen.findByTestId("concierge-inbox-group-needs_you")).toHaveTextContent("Needs you1");
    expect(screen.getByTestId("concierge-inbox-group-waiting")).toHaveTextContent("Waiting1");
    expect(screen.getByTestId("concierge-inbox-group-completed")).toHaveTextContent("Completed1");
    expect(screen.getAllByText("Prepare an appointment")).toHaveLength(1);
    expect(screen.getByText("Harbour Clinic needs your insurance plan.")).toBeInTheDocument();
  });

  it("opens a focused detail, keeps More details closed, and resumes the exact saved task", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("concierge-inbox-task-pending:reply-1"));

    expect(await screen.findByTestId("concierge-task-detail")).toBeInTheDocument();
    expect(screen.getByTestId("concierge-task-provider-reply")).toHaveTextContent("Please confirm your insurance plan.");
    expect(screen.getByTestId("concierge-task-decision")).toHaveTextContent("Prepared an answer for the clinic.");
    expect(screen.getByTestId("concierge-task-more-details")).not.toHaveAttribute("open");
    expect(screen.getAllByTestId("button-concierge-task-primary-action")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("button-concierge-task-primary-action"));
    expect(screen.getByTestId("location-path")).toHaveTextContent(`/concierge/task/${draftId}`);
    expect(screen.getByTestId("location-state")).toHaveTextContent('"conciergePendingId":"reply-1"');
  });

  it("keeps the completed outcome and reuses it as a saved template", async () => {
    renderPage("/concierge/tasks/completed%3Asession-1");

    expect(await screen.findByTestId("concierge-task-outcome")).toHaveTextContent("Ride completed with Radio Taxi.");
    expect(screen.getByTestId("concierge-task-provider-reply")).toHaveTextContent("Driver arrived at 10:00.");
    expect(within(screen.getByTestId("concierge-task-detail")).getByRole("button", { name: /Use again/ })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-task-primary-action"));
    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("location-state")).toHaveTextContent('"id":"session-1"');
    expect(screen.getByTestId("location-state")).toHaveTextContent("Ride completed with Radio Taxi.");
  });
});
