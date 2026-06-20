import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeScreen from "./ConciergeScreen";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: ({ sourceText, headline, subtitle }: { sourceText?: ReactNode; headline?: ReactNode; subtitle?: ReactNode }) => (
    <div data-testid="voice-hero">
      <span>{sourceText}</span>
      <span>{headline}</span>
      <span>{subtitle}</span>
    </div>
  ),
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

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: { type: "3rdParty", init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

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
        <LocationProbe />
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

describe("ConciergeScreen action hub", () => {
  it("renders the requested primary cards and fast help actions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();

    expect(await screen.findByTestId("concierge-guided-hub")).toBeVisible();
    expect(screen.getByTestId("concierge-fast-help")).toBeVisible();
    expect(screen.getByTestId("voice-hero")).toHaveTextContent("What should VYVA prepare?");
    expect(screen.getByTestId("voice-hero")).toHaveTextContent("Services, trips, orders, and savings stay confirmation-first.");
    expect(screen.getByTestId("concierge-guided-hub")).not.toHaveTextContent("What should VYVA prepare?");
    for (const label of ["Shop", "Book", "Order", "Save"]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    expect(screen.getByTestId("button-concierge-card-shop")).not.toHaveClass("bg-vyva-purple");
    for (const key of ["shop", "book", "order", "save"]) {
      const card = screen.getByTestId(`button-concierge-card-${key}`);
      expect(card).toHaveClass("min-h-[160px]");
      expect(card).toHaveClass("rounded-[28px]");
      expect(card).toHaveClass("bg-[#FFFCF8]");
      expect(card).not.toHaveClass("rounded-[22px]");
      expect(card).not.toHaveClass("min-h-[104px]");
    }
    expect(screen.getByTestId("concierge-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("concierge-fast-help")).toHaveTextContent("What do you need now?");
    expect(screen.getByTestId("button-concierge-fast-doctor")).toHaveTextContent("Find a trusted provider");
    expect(screen.getByTestId("button-concierge-fast-appointment")).toHaveTextContent("Book appointment");
    expect(screen.getByTestId("button-concierge-fast-ride")).toHaveTextContent("Find transport");
  });

  it("routes Shop and Order through the shopping helper", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    const firstRender = renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-shop"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping"));
    firstRender.unmount();

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-order"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"delivery\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"simplicity\"");
    });
  });

  it("opens Book, Save, and fast appointment flows in place", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-book"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule an appointment");

    fireEvent.click(screen.getByTestId("button-concierge-card-save"));
    expect(screen.getByTestId("panel-offers-search")).toBeVisible();

    fireEvent.click(screen.getByTestId("button-concierge-fast-appointment"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule an appointment");
  });

  it("creates an appointment request and confirms a saved provider channel before booking", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/appointments/requests/request-1/confirm-attempt")) {
        return jsonResponse({
          attempt: { id: "attempt-1", channel: "phone", status: "pending_confirmation" },
          pending: { pendingId: "pending-1", status: "pending" },
          needs_booking_confirmation: true,
        });
      }
      if (String(url).includes("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-1",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-1",
            provider_id: "provider-1",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Lopez",
              phone: "+34 600 111 222",
              address: "Calle Mayor 1",
            },
            match_reason: "Saved medical provider",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-book"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "dermatology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Lopez");
    fireEvent.click(screen.getByTestId("button-appointment-channel-phone"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-1/confirm-attempt", expect.objectContaining({ method: "POST" }));
  });

  it("renders compact protected savings results with expandable proof and watch confirmation", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Household costs",
          decision_explanation: "This option has the best mix of price, trust, ease, and fit.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: [
            "official or regulated comparison sources",
            "verified local businesses",
            "community programmes",
          ],
          protection_summary: {
            title: "Objective check",
            checkpoints: [
              "No paid ranking.",
              "Validates price, trust, ease, and fit.",
              "Uses official, public, or verifiable sources.",
            ],
            notification_triggers: ["price change", "renewal date"],
            action_guardrail: "VYVA asks before contact, switching, or sharing details.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "Senior Energy Saver",
            category: "Household costs",
            what_it_offers: "Lower-cost electric service.",
            price_or_advantage: "Estimated 18% monthly saving with no early switch.",
            why_good_option: "Strong fit for the current household profile.",
            distance_or_availability: "Available online.",
            contact_method: "Online",
            website: "https://example.com",
            trust_note: "Official source and verified tariff.",
            score: 91,
            score_breakdown: {
              distance: 70,
              price_value: 94,
              trust: 90,
              simplicity: 88,
              preference_match: 92,
            },
          }],
          next_step: "Confirm before contacting or switching.",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-save"));

    expect(screen.getByTestId("panel-offers-search")).toBeVisible();
    expect(screen.getByTitle("No commissions")).toBeVisible();

    fireEvent.click(screen.getByTestId("button-offers-search"));

    const proofSummary = await screen.findByTestId("panel-offers-objective-summary");
    expect(proofSummary).toHaveTextContent("Independent");
    expect(proofSummary).toHaveTextContent("3 sources");
    expect(proofSummary).toHaveTextContent("You confirm");
    expect(screen.queryByTestId("panel-offers-objective-details")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-offers-objective-toggle"));

    const proofDetails = await screen.findByTestId("panel-offers-objective-details");
    expect(proofDetails).toHaveTextContent("No paid ranking.");
    expect(proofDetails).toHaveTextContent("official or regulated comparison sources");
    expect(proofDetails).toHaveTextContent("Validates price, trust, ease, and fit.");
    expect(proofDetails).toHaveTextContent("price change");
    expect(screen.queryByText("Price or value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /score details/i }));
    expect(await screen.findByText("Price or value")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /watch changes/i }));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Watch important changes for Senior Energy Saver");
    expect(prefill).toHaveTextContent("ask me to confirm");
  });

  it("routes doctor help and prepares ride requests without booking", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    const firstRender = renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-doctor"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/health/doctor");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"autoStartVoice\":true");
      expect(screen.getByTestId("route-state")).toHaveTextContent("Concierge doctor help request");
    });
    firstRender.unmount();

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-ride"));

    await waitFor(() => {
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Compare safe ways");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Nothing is booked");
    });
  });

  it("finds transport options and prepares a provider without starting a booking", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/transport/options")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.destination.address).toBe("Heart Clinic Madrid");
        return jsonResponse({
          market: { countryCode: "ES", city: "Madrid" },
          options: [{
            id: "local-taxi-radio-taxi",
            kind: "local_taxi",
            label: "Radio Taxi",
            description: "Trusted local taxi provider.",
            providerName: "Radio Taxi",
            phone: "+34 612 345 678",
            actions: ["call_phone", "start_concierge_action"],
          }],
          disclaimers: ["Neutral", "Confirm price", "No ride is booked or requested until you confirm the next step."],
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("book_ride");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("Radio Taxi");
        expect(body.provider_phone).toBe("+34 612 345 678");
        return jsonResponse({ pendingId: "transport-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-ride"));

    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    expect(await screen.findByTestId("card-transport-option-local-taxi-radio-taxi")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("link-transport-call-local-taxi-radio-taxi")).toHaveAttribute("href", "tel:+34612345678");

    fireEvent.click(screen.getByTestId("button-transport-prepare-local-taxi-radio-taxi"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Transport request prepared. Confirm before VYVA contacts anyone.")).toBeVisible();
  });
});

describe("ConciergeScreen route prefill", () => {
  it("turns a symptom appointment handoff into a one-tap concierge request", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-prefill",
            appointment_type: "medical",
            reason_detail: "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });
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
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule an appointment");
    expect(screen.getByDisplayValue("Please help me schedule care for chest discomfort. Ask me to confirm before booking.")).toBeVisible();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const [, init] = apiFetchMock.mock.calls.find(([url]) => String(url).includes("/api/appointments/requests")) ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.detail).toContain("Please help me schedule care");
    expect(body.language).toBe("en");
  });

  it("turns a daily check-in task handoff into a prepared concierge request", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ response: "I can prepare options." }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Please prepare an easy outing with transport if needed.",
          source: "daily_checkin",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Request ready");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/concierge", expect.objectContaining({
        method: "POST",
      }));
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.prompt).toContain("easy outing");
  });

  it("renders prepared provider phone actions as direct call links", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-1",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared for the health appointment.",
        action_payload: null,
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const callLink = await screen.findByRole("link", { name: "Call +34 612 345 678" });
    expect(callLink).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-concierge-confirm-ride-1")).toHaveTextContent("Confirm and call");
  });
});
