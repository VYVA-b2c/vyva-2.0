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
    expect(screen.getByTestId("button-concierge-fast-ride")).toHaveTextContent("Arrange ride");
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
          attempt: { id: "attempt-1", channel: "phone", status: "calling" },
          pending: { pendingId: "pending-1", status: "calling" },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
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

  it("sends appointment email through VYVA before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-email/confirm-attempt")) {
        return jsonResponse({
          attempt: { id: "attempt-email", channel: "email", status: "email_sent" },
          communication: {
            id: "comm-1",
            channel: "email",
            recipient: "clinic@example.com",
            status: "sent",
          },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-email",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-email",
            provider_id: "provider-email",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Email",
              email: "clinic@example.com",
              address: "Calle Mayor 2",
            },
            match_reason: "Saved medical provider",
            available_channels: ["email", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-book"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Email");
    fireEvent.click(screen.getByTestId("button-appointment-channel-email"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(screen.getByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
  });

  it("shows VYVA-handled booking form status before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-form/confirm-attempt")) {
        return jsonResponse({
          attempt: { id: "attempt-form", channel: "booking_url", status: "form_task_queued" },
          form_task: {
            status: "needs_operator",
            booking_url: "https://calendly.com/clinic/consult",
            pending_id: "pending-form",
          },
          pending: { pendingId: "pending-form", status: "queued" },
          needs_booking_confirmation: true,
          handled_by_vyva: true,
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-form",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-form",
            provider_id: "provider-form",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Form",
              booking_url: "https://calendly.com/clinic/consult",
              address: "Calle Mayor 3",
            },
            match_reason: "Saved medical provider",
            available_channels: ["booking_url", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-book"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Form");
    fireEvent.click(screen.getByTestId("button-appointment-channel-booking_url"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(screen.getByText("VYVA has the booking form task. Save the appointment once confirmed.")).toBeVisible();
  });

  it("discovers external appointment options inside the request flow", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-2/discover-options")) {
        return jsonResponse({
          request: {
            id: "request-2",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-google-1",
            provider_id: null,
            provider_source: "external",
            provider_snapshot: {
              source: "google_places",
              name: "Marbella Dermatology Centre",
              phone: "+34 600 222 333",
              address: "Avenida Principal 2",
              booking_url: "https://example.com/book",
              maps_url: "https://maps.google.com/?q=marbella",
            },
            match_reason: "Found with Google Maps",
            available_channels: ["booking_url", "phone", "manual"],
            rank: 1,
            status: "suggested",
          }],
          discovery: {
            source: "google_places",
            inserted_count: 1,
          },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-2",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
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

    expect(await screen.findByText("No saved provider for this yet.")).toBeVisible();
    fireEvent.click(screen.getByTestId("button-appointment-discover-options"));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Marbella Dermatology Centre");
    expect(screen.getByTestId("button-appointment-channel-booking_url")).toHaveTextContent("VYVA fills form");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-2/discover-options", expect.objectContaining({ method: "POST" }));
  });

  it("shows reservation-system fallbacks when external provider discovery has no result", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-3/discover-options")) {
        return jsonResponse({
          request: {
            id: "request-3",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
          discovery: {
            source: "google_places",
            fallback_reason: "no_google_results",
            inserted_count: 0,
            reservation_systems: [
              { name: "Doctoralia", category: "medical_marketplace", url: "https://www.google.com/search?q=doctoralia" },
              { name: "Top Doctors", category: "medical_marketplace", url: "https://www.google.com/search?q=topdoctors" },
            ],
          },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-3",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-book"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));
    fireEvent.click(await screen.findByTestId("button-appointment-discover-options"));

    expect(await screen.findByTestId("panel-appointment-booking-sites")).toHaveTextContent("Doctoralia");
    expect(screen.getByTestId("panel-appointment-booking-sites")).toHaveTextContent("Top Doctors");
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
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Arrange a ride");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("VYVA checks saved drivers first");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("VYVA asks before contacting or booking");
    });
  });

  it("arranges transport with VYVA without showing a provider marketplace", async () => {
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
      if (String(url).includes("/api/transport/ride-requests/ride-request-1/confirm")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.autoStart).toBe(false);
        expect(body.option.providerName).toBe("Radio Taxi");
        expect(body.option.phone).toBe("+34 612 345 678");
        return jsonResponse({
          ride_request: { id: "ride-request-1", status: "vyva_task_ready" },
          pending: { pendingId: "transport-1", status: "pending" },
          handled_by_vyva: true,
        });
      }
      if (String(url).includes("/api/transport/ride-requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.destination.address).toBe("Heart Clinic Madrid");
        return jsonResponse({
          ride_request: { id: "ride-request-1", status: "needs_confirmation" },
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
          disclaimers: [],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-ride"));

    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/transport/ride-requests", expect.objectContaining({
        method: "POST",
      }));
      expect(apiFetchMock).toHaveBeenCalledWith("/api/transport/ride-requests/ride-request-1/confirm", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("VYVA has the ride request and will prepare the next step.")).toBeVisible();
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

  it("shows compact form plan details for VYVA-handled booking tasks", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "form-task-1",
        use_case: "book_appointment",
        provider_name: "The Good Table",
        provider_phone: null,
        action_summary: "VYVA will handle the booking form for The Good Table.",
        action_payload: {
          execution_channel: "booking_url",
          booking_url: "https://www.thefork.es/restaurante/example",
          form_automation_plan: {
            adapter_label: "TheFork",
            missing_fields: ["number of guests"],
            next_step: "Collect number of guests inside VYVA before using the external form.",
          },
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-form-plan")).toHaveTextContent("System: TheFork");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Needs: number of guests");
    expect(screen.getByText("VYVA is handling it")).toBeVisible();
  });
});
