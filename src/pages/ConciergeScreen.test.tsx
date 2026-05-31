import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeScreen from "./ConciergeScreen";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: () => <div data-testid="voice-hero" />,
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-fulfillment-panel" />,
}));

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  useRouteVoiceAutoStart: () => false,
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: null,
    payloadValue: () => "",
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderScreen(initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/concierge"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ConciergeScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ConciergeScreen route prefill", () => {
  it("turns a symptom appointment handoff into a one-tap concierge request", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ response: "I can help with that." }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
          source: "symptom_report",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Appointment request ready");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/concierge", expect.objectContaining({
        method: "POST",
      }));
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.prompt).toContain("Please help me schedule care");
    expect(body.locale).toBe("en");
  });
});
