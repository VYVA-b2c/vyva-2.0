import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConciergeTaskInboxPage from "./ConciergeTaskInboxPage";
import { apiFetch } from "@/lib/queryClient";
import { buildConciergeProviderReplyResolution } from "../../shared/conciergeProviderReplyResolution";

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
    expect(screen.getByTestId("concierge-inbox-task-state-pending:reply-1")).toHaveTextContent("Needs information");
    expect(screen.getByTestId("concierge-inbox-task-scene-pending:reply-1")).toHaveTextContent("Reply");
  });

  it("opens a focused detail, keeps More details closed, and resumes the exact saved task", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("concierge-inbox-task-pending:reply-1"));

    expect(await screen.findByTestId("concierge-task-detail")).toBeInTheDocument();
    expect(screen.getByTestId("concierge-task-continuation")).toHaveTextContent("Provider reply");
    expect(screen.getByTestId("concierge-task-continuation")).toHaveTextContent("Needs information");
    expect(screen.getByTestId("concierge-task-continuation")).toHaveTextContent("Reply");
    expect(screen.getByTestId("concierge-task-provider-reply")).toHaveTextContent("Please confirm your insurance plan.");
    expect(screen.getByTestId("concierge-task-decision")).toHaveTextContent("Prepared an answer for the clinic.");
    expect(screen.getByTestId("concierge-task-more-details")).not.toHaveAttribute("open");
    expect(screen.getAllByTestId("button-concierge-task-primary-action")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("button-concierge-task-primary-action"));
    expect(screen.getByTestId("location-path")).toHaveTextContent(`/concierge/task/${draftId}`);
    expect(screen.getByTestId("location-state")).toHaveTextContent('"conciergePendingId":"reply-1"');
  });

  it("keeps long Canvas labels keyboard-focusable at mobile width", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/concierge/tasks" || target === "/api/concierge/actions/sessions") {
        return jsonResponse({ items: [] });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "long-shopping-1",
          use_case: "shopping_request",
          provider_name: "A very patient neighborhood grocery and prepared meals shop",
          action_summary: "Waiting for a very long translated shopping request label that should remain readable and not force a broken layout.",
          action_payload: {
            flow_reference: "FLOW_SHOPPING_SUPPORT",
            live_handoff_status: "sent_or_called",
          },
          status: "calling",
          updated_at: "2026-07-19T10:00:00.000Z",
        }] });
      }
      return jsonResponse({ items: [] });
    });

    renderPage();
    const task = await screen.findByTestId("concierge-inbox-task-pending:long-shopping-1");
    expect(task).toHaveAccessibleName(/Waiting/);
    expect(screen.getByTestId("concierge-inbox-task-state-pending:long-shopping-1")).toHaveTextContent("Waiting");
    expect(screen.getByTestId("concierge-inbox-task-scene-pending:long-shopping-1")).toHaveTextContent("Waiting");

    task.focus();
    expect(task).toHaveFocus();
    fireEvent.click(task);
    expect(await screen.findByTestId("concierge-task-continuation")).toHaveTextContent("Shopping Canvas");
  });

  it("surfaces stale blocked tasks and resumes through the safe Concierge path", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/concierge/tasks" || target === "/api/concierge/actions/sessions") {
        return jsonResponse({ items: [] });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "expired-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          action_summary: "Waiting for Radio Taxi.",
          action_payload: {
            flow_reference: "FLOW_TRANSPORT_BOOKING",
            live_handoff_status: "sent_or_called",
          },
          status: "calling",
          expires_at: "2000-01-01T00:00:00.000Z",
          updated_at: "2026-07-19T10:00:00.000Z",
        }] });
      }
      return jsonResponse({ items: [] });
    });

    renderPage("/concierge/tasks/pending%3Aexpired-ride");
    expect(await screen.findByTestId("concierge-task-continuation")).toHaveTextContent("Needs refresh");
    expect(screen.getByTestId("concierge-task-continuation")).toHaveTextContent("Nothing happens without a fresh confirmation.");
    expect(screen.getByTestId("button-concierge-task-primary-action")).toHaveTextContent("Review safely");

    fireEvent.click(screen.getByTestId("button-concierge-task-primary-action"));
    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/task/expired-ride");
    expect(screen.getByTestId("location-state")).toHaveTextContent('"conciergePendingId":"expired-ride"');
  });

  it("lets users exit a detail card without writing or losing the task", async () => {
    renderPage("/concierge/tasks/pending%3Areply-1");

    expect(await screen.findByTestId("concierge-task-detail")).toBeInTheDocument();
    apiFetchMock.mockClear();
    fireEvent.click(screen.getByTestId("button-concierge-task-exit"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/tasks");
    expect(await screen.findByTestId("concierge-task-inbox")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringMatching(/details|complete|review-confirm/), expect.anything());
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

  it("answers a provider directly in the saved task and requires a fresh final confirmation", async () => {
    let reviewConfirmCalls = 0;
    let pendingPayload: Record<string, unknown> = {
      provider_task_status: "action_needed",
      provider_reply_status: "needs_more_info",
      provider_reply: "Please provide the insurance plan, policy number, and phone number.",
      provider_response_summary: "Harbour Clinic needs insurance details.",
      provider_inbound_channel: "email",
      provider_inbound_sender: "frontdesk@clinic.example",
      provider_inbound_subject: "Appointment request",
      insurance_plan: "Sanitas",
      phone: "+34 600 111 222",
      provider_follow_up_confirmed: false,
    };
    pendingPayload.provider_reply_resolution = buildConciergeProviderReplyResolution({
      reply: String(pendingPayload.provider_reply),
      subject: String(pendingPayload.provider_inbound_subject),
      channel: "email",
      knownFacts: pendingPayload,
    });

    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/concierge/tasks") return jsonResponse({ items: [] });
      if (target === "/api/concierge/actions/sessions") return jsonResponse({ items: [] });
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "direct-reply-1",
          use_case: "book_appointment",
          provider_name: "Harbour Clinic",
          action_summary: "Waiting for Harbour Clinic.",
          action_payload: pendingPayload,
          status: "pending",
          updated_at: "2026-07-19T09:00:00.000Z",
        }] });
      }
      if (target === "/api/concierge/actions/direct-reply-1/details") {
        const body = JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> };
        pendingPayload = body.action_payload;
        return jsonResponse({ ok: true });
      }
      if (target === "/api/concierge/actions/direct-reply-1/review-confirm") {
        reviewConfirmCalls += 1;
        pendingPayload = {
          ...pendingPayload,
          provider_follow_up_confirmed: true,
          execution_adapter: { status: "sent" },
        };
        return jsonResponse({ historySessionId: "reply-history-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderPage("/concierge/tasks/pending%3Adirect-reply-1");

    expect(await screen.findByTestId("concierge-task-provider-reply-actions")).toBeInTheDocument();
    expect(screen.queryByTestId("concierge-task-missing-information")).not.toBeInTheDocument();
    expect(screen.getByTestId("concierge-task-provider-reply-actions")).toHaveTextContent("Policy or member number");
    expect(screen.queryByTestId("concierge-task-reply-answer-phone_number")).not.toBeInTheDocument();
    expect(screen.queryByTestId("concierge-task-reply-answer-insurance_plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-concierge-task-primary-action")).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId("concierge-task-reply-answer-policy_number"), {
      target: { value: "POL-4455" },
    });
    fireEvent.click(screen.getByTestId("button-concierge-task-prepare-reply"));

    expect(reviewConfirmCalls).toBe(0);
    expect(await screen.findByTestId("concierge-task-reply-draft")).toHaveTextContent("Policy or member number: POL-4455");
    expect(screen.getByTestId("concierge-task-reply-recipient")).toHaveTextContent("frontdesk@clinic.example");
    expect(screen.queryByTestId("button-concierge-task-send-reply")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-task-review-reply"));
    expect(screen.getByTestId("concierge-task-reply-final-confirmation")).toHaveTextContent("final confirmation");
    expect(reviewConfirmCalls).toBe(0);

    fireEvent.click(screen.getByTestId("button-concierge-task-send-reply"));
    await waitFor(() => expect(reviewConfirmCalls).toBe(1));
    expect(await screen.findByTestId("concierge-task-provider-reply-actions")).toHaveTextContent("Waiting for the provider");
  });

  it("offers accept, decline, and another-option choices without sending immediately", async () => {
    let detailsCalls = 0;
    let sendCalls = 0;
    let pendingPayload: Record<string, unknown> = {
      provider_task_status: "reply_received",
      provider_reply: "We can visit Friday at 15:00 for EUR 120.",
      provider_response_summary: "Friday at 15:00 is available for EUR 120.",
      provider_inbound_channel: "email",
      provider_inbound_sender: "repairs@example.com",
      provider_inbound_subject: "Repair quote",
    };
    pendingPayload.provider_reply_resolution = buildConciergeProviderReplyResolution({
      reply: String(pendingPayload.provider_reply),
      subject: String(pendingPayload.provider_inbound_subject),
      channel: "email",
      knownFacts: pendingPayload,
    });
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/concierge/tasks" || target === "/api/concierge/actions/sessions") {
        return jsonResponse({ items: [] });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "offer-reply-1",
          use_case: "home_service",
          provider_name: "Saved Repairs",
          action_summary: "Waiting for Saved Repairs.",
          action_payload: pendingPayload,
          status: "pending",
          updated_at: "2026-07-19T09:00:00.000Z",
        }] });
      }
      if (target.endsWith("/details")) {
        detailsCalls += 1;
        pendingPayload = (JSON.parse(String(init?.body)) as { action_payload: Record<string, unknown> }).action_payload;
        return jsonResponse({ ok: true });
      }
      if (target.endsWith("/review-confirm")) {
        sendCalls += 1;
        return jsonResponse({ status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderPage("/concierge/tasks/pending%3Aoffer-reply-1");
    expect(await screen.findByTestId("concierge-task-reply-choices")).toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-task-accept-offer")).toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-task-request-alternatives")).toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-task-decline-offer")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-task-request-alternatives"));
    await waitFor(() => expect(detailsCalls).toBe(1));
    expect(sendCalls).toBe(0);
    expect(await screen.findByTestId("concierge-task-reply-draft")).toHaveTextContent("Please share another available option");
  });

  it("keeps a confirmed provider outcome open until the user closes it and preserves history", async () => {
    let completionBody: {
      outcome_summary?: string;
      outcome_payload?: Record<string, unknown>;
    } | null = null;
    const pendingPayload: Record<string, unknown> = {
      provider_task_status: "reply_received",
      provider_reply: "Your appointment is confirmed for Tuesday at 10:00. Reference AP-77.",
      provider_response_summary: "Appointment confirmed for Tuesday at 10:00.",
      provider_inbound_channel: "email",
      provider_inbound_sender: "frontdesk@clinic.example",
    };
    pendingPayload.provider_reply_resolution = buildConciergeProviderReplyResolution({
      reply: String(pendingPayload.provider_reply),
      channel: "email",
      knownFacts: pendingPayload,
    });
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/concierge/tasks" || target === "/api/concierge/actions/sessions") {
        return jsonResponse({ items: [] });
      }
      if (target === "/api/concierge/actions/pending") {
        return jsonResponse({ items: [{
          id: "confirmed-reply-1",
          use_case: "book_appointment",
          provider_name: "Harbour Clinic",
          action_summary: "Waiting for Harbour Clinic.",
          action_payload: pendingPayload,
          status: "pending",
          updated_at: "2026-07-19T09:00:00.000Z",
        }] });
      }
      if (target === "/api/concierge/actions/confirmed-reply-1/complete") {
        completionBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "completed-session-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderPage("/concierge/tasks/pending%3Aconfirmed-reply-1");
    expect(await screen.findByTestId("button-concierge-task-complete-reply")).toBeInTheDocument();
    expect(completionBody).toBeNull();

    fireEvent.click(screen.getByTestId("button-concierge-task-complete-reply"));
    await waitFor(() => expect(completionBody).not.toBeNull());
    expect(completionBody).toMatchObject({
      outcome_summary: expect.stringContaining("Provider confirmed the booking"),
      outcome_payload: expect.objectContaining({
        provider_reply: expect.stringContaining("AP-77"),
        provider_task_status: "done",
        live_handoff_status: "completed",
        final_outcome_summary: expect.stringContaining("Provider confirmed the booking"),
        provider_reply_decisions: [expect.objectContaining({
          action: "mark_complete",
          status: "completed",
        })],
      }),
    });
  });
});
