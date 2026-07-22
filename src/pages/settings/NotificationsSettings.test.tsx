import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NotificationsSettings from "./NotificationsSettings";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/onboarding/PhoneFrame", () => ({
  PhoneFrame: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const preferences = {
  preferred_checkin_channel: "voice_outbound",
  preferred_reminder_channel: "whatsapp_outbound",
  support_mode: "ai_powered",
  voice_available_from: "08:00",
  voice_available_until: "21:00",
  whatsapp_available_from: "07:00",
  whatsapp_available_until: "22:00",
  max_outbound_calls_per_day: 1,
  max_whatsapp_messages_per_day: 5,
  concierge_task_notifications_enabled: true,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => preferences,
      },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationsSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationsSettings", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({ ok: true, json: async () => ({
      ...preferences,
      concierge_task_notifications_enabled: false,
    }) } as Response);
  });

  it("lets a user turn Concierge task alerts off and saves the preference", async () => {
    renderPage();
    const toggle = await screen.findByTestId("switch-concierge-task-notifications");
    expect(toggle).toHaveAttribute("data-state", "checked");
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("button", { name: "settings.notifications.savePreferences" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const [, request] = apiFetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      concierge_task_notifications_enabled: false,
    });
  });
});
