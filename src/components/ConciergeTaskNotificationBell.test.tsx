import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConciergeTaskNotificationBell from "./ConciergeTaskNotificationBell";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);
const notificationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const taskPath = "/concierge/tasks/pending%3Abbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function LocationProbe() {
  return <span data-testid="location-path">{useLocation().pathname}</span>;
}

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/"]}>
        <ConciergeTaskNotificationBell />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ConciergeTaskNotificationBell", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async (url) => {
      if (url === "/api/concierge/notifications") {
        return jsonResponse({
          unreadCount: 1,
          items: [{
            id: notificationId,
            eventType: "information_needed",
            title: "Harbour Clinic needs information",
            body: "Please confirm your insurance plan.",
            taskPath,
            readAt: null,
            createdAt: "2026-07-19T10:00:00.000Z",
          }],
        });
      }
      return jsonResponse({ ok: true });
    });
  });

  it("shows the unread count and opens the exact task while marking the alert read", async () => {
    renderBell();
    expect(await screen.findByTestId("concierge-task-notification-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("button-concierge-task-notifications"));
    expect(await screen.findByText("Harbour Clinic needs information")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`concierge-task-notification-${notificationId}`));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent(taskPath));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/concierge/notifications/${notificationId}/read`,
      { method: "POST" },
    ));
  });
});
