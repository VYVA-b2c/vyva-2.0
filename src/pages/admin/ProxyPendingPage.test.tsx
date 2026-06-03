import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, queryClient as sharedQueryClient } from "@/lib/queryClient";
import ProxyPendingPage from "./ProxyPendingPage";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);
const invalidateQueriesMock = vi.mocked(sharedQueryClient.invalidateQueries);

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function confirmedCaregiver() {
  return {
    id: "profile-1",
    full_name: "Test Karim",
    preferred_name: "Test Karim",
    proxy_initiator_id: "Mary Helper (Daughter)",
    proxy_name: "Mary Helper (Daughter)",
    proxy_initiated_at: "2026-05-01T10:00:00.000Z",
    elder_confirmed_at: "2026-05-02T10:00:00.000Z",
    phone_number: null,
    email: null,
    whatsapp_number: null,
    caregiver_name: "Mary Helper",
    caregiver_contact: "+34600111222",
    contact_method: null,
    channel_reports: "email",
    channel_chats: "in_app",
    channel_notifications: "whatsapp",
    language: "es",
    timezone: "Europe/Madrid",
    onboarding_channel: "proxy_web",
    current_stage: "complete",
    onboarding_complete: true,
    subscription_tier: "premium",
    account_status: "active",
    created_at: "2026-05-01T09:00:00.000Z",
    elder: {
      id: "profile-1",
      name: "Test Karim",
      full_name: "Test Karim",
      preferred_name: "Test Karim",
      phone_number: null,
      email: null,
      whatsapp_number: null,
      account_status: "active",
      subscription_tier: "premium",
      onboarding_stage: "complete",
      onboarding_channel: "proxy_web",
      onboarding_complete: true,
    },
    caregiver: {
      name: "Mary Helper (Daughter)",
      saved_name: "Mary Helper",
      saved_contact: "+34600111222",
      team: [],
    },
    preferences: {
      language: "es",
      timezone: "Europe/Madrid",
      contact_method: null,
      reports: "email",
      chats: "in_app",
      notifications: "whatsapp",
      channel: null,
    },
    automations: {
      upcoming_events_count: 0,
      next_event: null,
      active_support_count: 0,
      support_schedules: [],
      communications_count: 0,
      recent_communications: [],
      unresolved_alerts_count: 0,
      recent_alerts: [],
    },
  };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  apiFetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/admin/proxy-pending") {
      return jsonResponse({ pending: [], confirmed: [confirmedCaregiver()] });
    }
    if (String(input) === "/api/admin/proxy-caregiver/profile-1" && init?.method === "DELETE") {
      return jsonResponse({
        ok: true,
        action: "caregiver_removed",
        revoked_memberships: 1,
        revoked_invitations: 1,
      });
    }
    return jsonResponse({ error: "Unexpected request" }, { status: 500 });
  });

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin/proxy-pending"]}>
        <ProxyPendingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
  invalidateQueriesMock.mockReset();
});

describe("ProxyPendingPage caregiver removal", () => {
  it("shows a confirmation panel and removes caregiver access through the admin API", async () => {
    renderPage();

    const card = await screen.findByTestId("card-proxy-profile-profile-1");
    fireEvent.click(within(card).getByTestId("button-remove-caregiver-profile-1"));

    expect(within(card).getByTestId("panel-remove-caregiver-profile-1")).toHaveTextContent(
      "This revokes caregiver dashboard access",
    );

    fireEvent.click(within(card).getByTestId("button-remove-caregiver-confirm-profile-1"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/admin/proxy-caregiver/profile-1", { method: "DELETE" });
      expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: ["/api/admin/proxy-pending"] });
    });
  });
});
