import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeScreen from "./ConciergeScreen";
import { apiFetch } from "@/lib/queryClient";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";

const voiceHeroMock = vi.hoisted(() => vi.fn());
const voiceActionMock = vi.hoisted(() => ({
  action: null as null | {
    id: string;
    actionType?: string;
    domain: string;
    route: string;
    title: string;
    summary: string;
    cue: string;
    sourceText: string;
    priority: "high" | "medium" | "low";
    extractedSubject?: string;
    feedbackReason: string;
    payload?: Record<string, string | number | boolean>;
  },
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { autoStartVoice?: boolean | string; sourceText?: ReactNode; headline?: ReactNode; subtitle?: ReactNode; voiceAgentSlug?: string }) => {
    voiceHeroMock(props);
    return (
      <div data-testid="voice-hero">
        <span>{props.sourceText}</span>
        <span>{props.headline}</span>
        <span>{props.subtitle}</span>
      </div>
    );
  },
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
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
    action: voiceActionMock.action,
    payloadValue: (key: string) => {
      const value = voiceActionMock.action?.payload?.[key];
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "";
    },
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
const HOME_SERVICE_GUIDE_STORAGE_KEY = "vyva_concierge_home_service_guide_hidden_v1";

async function dismissHomeServiceGuide() {
  fireEvent.click(await screen.findByTestId("button-home-service-guide-understood"));
  await waitFor(() => {
    expect(screen.queryByTestId("modal-home-service-guide")).not.toBeInTheDocument();
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="location-search">{location.search}</span>
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

function errorResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
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
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={initialEntries}>
        <LocationProbe />
        <ConciergeScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function showBookRideFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(9000);
  });
  return screen.getByTestId("button-concierge-fast-book-ride");
}

function showOtcPharmacyFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(18000);
  });
  return screen.getByTestId("button-concierge-fast-otc-pharmacy");
}

function showScamCheckFastHelp() {
  screen.getByTestId("button-concierge-fast-home-service");
  act(() => {
    vi.advanceTimersByTime(9000);
  });
  return screen.getByTestId("button-concierge-fast-check-scam");
}

afterEach(() => {
  vi.useRealTimers();
  apiFetchMock.mockReset();
  voiceHeroMock.mockClear();
  voiceActionMock.action = null;
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("ConciergeScreen action hub", () => {
  it("renders the requested primary cards and fast help actions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();

    expect(await screen.findByTestId("concierge-master-layout")).toBeVisible();
    expect(await screen.findByTestId("concierge-guided-hub")).toBeVisible();
    expect(screen.getByTestId("concierge-fast-help")).toBeVisible();
    expect(screen.getByTestId("concierge-master-hero")).toHaveTextContent("Concierge ready");
    expect(screen.queryByTestId("voice-hero")).not.toBeInTheDocument();
    expect(voiceHeroMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("concierge-guided-hub")).not.toHaveTextContent("Shop");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveTextContent("Home Care");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveTextContent("Plumber");
    expect(screen.getByTestId("button-concierge-card-ride")).toHaveTextContent("Personal Care");
    expect(screen.getByTestId("button-concierge-card-ride")).toHaveTextContent("Find a Specialist");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveTextContent("Order In");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveTextContent("Groceries");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Book Now");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveTextContent("Ride");
    expect(screen.queryByRole("button", { name: "Plan a Trip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find Events" })).not.toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-card-service")).not.toHaveTextContent("Home service, forms, legal/admin, care");
    expect(screen.getByTestId("button-concierge-card-service")).toHaveAccessibleName("Home Care. Plumber, electrician, cleaning");
    expect(screen.getByTestId("button-concierge-card-delivery")).not.toHaveTextContent("Groceries, essentials, prepared meals");
    expect(screen.getByTestId("button-concierge-card-delivery")).toHaveAccessibleName("Order In. Groceries, household");
    expect(screen.getByTestId("button-concierge-card-appointment")).not.toHaveTextContent("Medical, government, personal care");
    expect(screen.getByTestId("button-concierge-card-appointment")).toHaveAccessibleName("Book Now. Medical, government, ride");
    expect(screen.getByTestId("concierge-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("button-concierge-fast-safe-home")).toHaveTextContent("Safe Home");
    expect(screen.getByTestId("button-concierge-fast-fill-form")).toHaveTextContent("Paperwork Help");
    expect(screen.getByTestId("button-concierge-fast-home-service")).toHaveTextContent("Find Plumber");
  });

  it("routes delivery through the shopping helper", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-delivery"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"delivery\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"simplicity\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"safety\"");
    });
  });

  it("opens appointment, service, savings, trip, and research flows in place", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
    expect(screen.queryByTestId("modal-appointment-mission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
    for (const label of ["Medical", "Personal care", "Government"]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    const appointmentPanel = screen.getByTestId("panel-appointment-assistant");
    for (const label of ["Home service", "Social or restaurant", "Other"]) {
      expect(within(appointmentPanel).queryByRole("button", { name: label })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId("button-concierge-card-service"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("button-appointment-start-home-service")).toHaveTextContent("Find trusted options");
    await dismissHomeServiceGuide();

    fireEvent.click(screen.getByTestId("button-concierge-card-ride"));
    expect(screen.getByTestId("panel-offers-search")).toBeVisible();
  });

  it("opens appointment choices directly without the old mission popup", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));

    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
    expect(screen.getByRole("button", { name: "Medical" })).toBeVisible();
    expect(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible")).toBeVisible();
    expect(screen.queryByTestId("modal-appointment-mission")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
  });

  it("shows the home service guide as a one-time popup with a saved hide option", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));

    expect(await screen.findByTestId("modal-home-service-guide")).toBeVisible();
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("Saved list checked");
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("Trusted search");
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent("You confirm");

    fireEvent.click(screen.getByTestId("checkbox-home-service-guide-never"));
    fireEvent.click(screen.getByTestId("button-home-service-guide-understood"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-home-service-guide")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("button-home-service-open-guide")).not.toBeInTheDocument();
    expect(localStorage.getItem(HOME_SERVICE_GUIDE_STORAGE_KEY)).toBe("true");
  });

  it("creates an appointment request and asks VYVA to handle the saved provider before booking", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/appointments/requests/request-1/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-1", channel: "phone" });
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "dermatology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Lopez");
    expect(screen.getByTestId("panel-appointment-provider-options")).toHaveTextContent("Ask VYVA to handle this");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Tool ready: call");
    expect(screen.queryByTestId("button-appointment-channel-phone")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(screen.getByText("VYVA is calling now. Save the appointment once confirmed.")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-1/confirm-attempt", expect.objectContaining({ method: "POST" }));
  });

  it("sends appointment email through VYVA before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-email/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-email", channel: "email" });
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Email");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(screen.getByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
  });

  it("shows VYVA-handled booking form status before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-form/confirm-attempt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ option_id: "option-form", channel: "booking_url" });
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Form");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("When it is confirmed");
    expect(screen.getByText("VYVA has the booking form task. Save the appointment once confirmed.")).toBeVisible();
  });

  it("keeps appointment details editable before VYVA starts handling it", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Prefer Tuesday morning and ask about wheelchair access" },
    });

    expect(screen.queryByTestId("button-appointment-open-mission-guide")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Prefer Tuesday morning and ask about wheelchair access")).toBeVisible();
  });

  it("saves medical coverage readiness and removes the setup card", async () => {
    let coverageSaved = false;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse(coverageSaved
          ? {
            coverage: {
              coverageType: "private",
              provider: "Sanitas",
              memberId: "AB-123",
              plan: "",
              notes: "",
            },
            serviceReadiness: { hasCoverageInfo: true },
          }
          : { serviceReadiness: { hasCoverageInfo: false } });
      }
      if (target === "/api/profile/coverage") {
        expect(init?.method).toBe("PATCH");
        const body = JSON.parse(String(init?.body));
        expect(body.coverageType).toBe("private");
        expect(body.provider).toBe("Sanitas");
        expect(body.memberId).toBe("AB-123");
        coverageSaved = true;
        return jsonResponse({
          ok: true,
          coverage: {
            coverageType: "private",
            provider: "Sanitas",
            memberId: "AB-123",
            plan: "",
            notes: "",
          },
          serviceReadiness: { hasCoverageInfo: true },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-coverage",
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-coverage-readiness")).toHaveTextContent("Coverage for medical bookings");
    fireEvent.click(screen.getByTestId("button-coverage-type-private"));
    fireEvent.change(screen.getByTestId("input-coverage-provider"), {
      target: { value: "Sanitas" },
    });
    fireEvent.change(screen.getByTestId("input-coverage-member-id"), {
      target: { value: "AB-123" },
    });
    fireEvent.click(screen.getByTestId("button-coverage-save"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/profile/coverage", expect.objectContaining({ method: "PATCH" }));
      expect(screen.queryByTestId("panel-coverage-readiness")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Coverage saved. VYVA will ask before sharing it.")).toBeVisible();
  });

  it("skips the coverage setup card when medical coverage is already saved", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          coverage: {
            coverageType: "private",
            provider: "Sanitas",
            memberId: "AB-123",
            plan: "",
            notes: "",
          },
          serviceReadiness: { hasCoverageInfo: true },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-saved-coverage",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-saved-coverage",
            provider_id: "provider-saved-coverage",
            provider_source: "saved",
            provider_snapshot: {
              name: "Clinica Coverage",
              phone: "+34 600 111 444",
              address: "Calle Salud 4",
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Clinica Coverage");
    expect(screen.queryByTestId("panel-coverage-readiness")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Insurance: saved in profile");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("VYVA will ask before sharing any details.");
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "dermatology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByText("No saved provider for this yet.")).toBeVisible();
    fireEvent.click(screen.getByTestId("button-appointment-discover-options"));

    expect(await screen.findByTestId("panel-appointment-provider-options")).toHaveTextContent("Marbella Dermatology Centre");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Confirm before VYVA acts");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Contact route: VYVA fills form");
    expect(screen.getByTestId("button-appointment-handle-provider")).toHaveTextContent("Confirm: Ask VYVA to handle this");
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));

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
    expect(prefill).toHaveTextContent("Nothing is booked");
  });

  it("collects plumber intake, stores app origin, and automatically searches when no saved provider exists", async () => {
    type HomeServiceRequestBody = {
      appointment_type?: string;
      detail?: string;
      preferences?: {
        service_intake?: Record<string, unknown>;
        [key: string]: unknown;
      };
    };
    let createdBody: HomeServiceRequestBody | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.includes("/api/appointments/requests/request-home-service/discover-options")) {
        expect(init?.method).toBe("POST");
        return jsonResponse({
          request: {
            id: "request-home-service",
            appointment_type: "home-service",
            reason_detail: createdBody?.detail,
            preferences: createdBody?.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-plumber",
            provider_id: null,
            provider_source: "external",
            provider_snapshot: {
              name: "Marbella Rapid Plumbing",
              address: "Avenida Ricardo Soriano 3",
              phone: "+34 600 111 222",
              preferred_channel: "phone",
            },
            match_reason: "Verified local plumbing option",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
          discovery: { source: "google_places", inserted_count: 1 },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body)) as HomeServiceRequestBody;
        createdBody = body;
        expect(body.appointment_type).toBe("home-service");
        expect(body.detail).toContain("Plumber needed");
        expect(body.detail).toContain("Leak");
        expect(body.detail).not.toContain("Water leaking under the kitchen sink");
        expect(body.preferences.service_intake).toMatchObject({
          version: "home-service-intake-v1",
          origin: "app",
          service_type: "plumber",
          urgency: "today",
          answers: expect.objectContaining({
            problem_type: "leak",
            active_flooding: "yes",
            affected_area: "kitchen",
            shutoff_status: "cannot_find",
          }),
        });
        expect(body.preferences.service_intake.safety_flags).toContain("active_water_damage");
        return jsonResponse({
          request: {
            id: "request-home-service",
            appointment_type: "home-service",
            reason_detail: body.detail,
            preferences: body.preferences,
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
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.queryByTestId("panel-appointment-home-service-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();
    expect(screen.getByTestId("button-appointment-start-home-service")).toHaveTextContent("Find trusted options");
    expect(screen.getByTestId("button-appointment-start-home-service")).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-home-service-type-plumber"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-leak"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-yes"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-kitchen"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-cannot_find"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    expect(screen.getByTestId("button-appointment-start-home-service")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-appointment-start-home-service"));

    expect(await screen.findByText("Marbella Rapid Plumbing")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-home-service/discover-options", expect.objectContaining({ method: "POST" }));
  });

  it("asks electrician-specific questions instead of plumbing questions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What kind of electrical issue?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Breaker trips");
    expect(screen.getByTestId("panel-home-service-question")).not.toHaveTextContent("Blocked drain");
  });

  it("switches electrician danger answers into emergency actions before provider search", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/onboarding/state")) {
        return jsonResponse({
          profile: {
            country: "ES",
            emergency_contact: {
              name: "Maria",
              primary_phone: "+34 612 345 678",
            },
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-socket_light"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-one_fixture"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-danger_now"));

    const emergencyPanel = screen.getByTestId("panel-home-service-emergency");
    expect(emergencyPanel).toHaveTextContent("Safety first");
    expect(screen.getByTestId("button-home-service-call-emergency")).toHaveAttribute("href", "tel:112");
    expect(await screen.findByTestId("button-home-service-call-caregiver")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.queryByTestId("button-appointment-start-home-service")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-service-safe-for-now"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What matters most?");
  });

  it("asks powered-medical-equipment only for outage-style electrician requests", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-power_outage"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-whole_home"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-safe_for_now"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("powered medical equipment");
  });

  it("asks other service users what service they need before urgency", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-other"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("What service do you need?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Current question");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Step 1 of 3");
    expect(screen.getByTestId("panel-home-service-question")).not.toHaveTextContent("How urgent is it?");
    fireEvent.change(screen.getByPlaceholderText(/gardener/i), {
      target: { value: "Pest control" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));

    expect(screen.getByTestId("panel-home-service-intake")).toHaveTextContent("Pest control");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("How urgent is it?");
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent("Step 2 of 3");
  });

  it("prepares a Concierge request instead of showing raw feature-access errors for home service", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        return errorResponse(503, {
          error: "Could not verify feature access",
          code: "FEATURE_ACCESS_UNAVAILABLE",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-other"));
    fireEvent.change(screen.getByPlaceholderText(/gardener/i), {
      target: { value: "Pest control" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    const startButton = screen.getByTestId("button-appointment-start-home-service");
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const appointmentCall = apiFetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/appointments/requests"));
    expect(appointmentCall?.[1]?.method).toBe("POST");
    const requestBody = JSON.parse(String(appointmentCall?.[1]?.body));
    expect(requestBody.appointment_type).toBe("home-service");
    expect(requestBody.detail).toContain("Pest control");
    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Key details");
    expect(prefill).toHaveTextContent("Pest control");
    expect(prefill).toHaveTextContent("Nothing is booked");
    expect(prefill).toHaveTextContent("without your confirmation");
    expect(prefill).not.toHaveTextContent("access error");
    expect(screen.queryByText("Could not verify feature access")).not.toBeInTheDocument();
  });

  it("prepares a review request instead of showing access errors for other appointment types", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.appointment_type).toBe("government");
        expect(body.detail).toContain("passport renewal");
        return errorResponse(503, {
          error: "Could not verify feature access",
          code: "FEATURE_ACCESS_UNAVAILABLE",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-appointment"));
    fireEvent.change(screen.getByPlaceholderText("E.g. dermatology, Tuesday morning, WhatsApp if possible"), {
      target: { value: "Please help me schedule a passport renewal appointment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Government" }));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Government");
    expect(prefill).toHaveTextContent("passport renewal");
    expect(prefill).toHaveTextContent("Nothing is booked");
    expect(prefill).not.toHaveTextContent("verify access");
    expect(screen.queryByText("I could not verify access right now. Please try again.")).not.toBeInTheDocument();
    expect(screen.queryByText("Could not verify feature access")).not.toBeInTheDocument();
  });

  it("turns a voice plumber payload into the same structured service intake", async () => {
    voiceActionMock.action = {
      id: "voice-home-service-1",
      actionType: "concierge.home_service",
      domain: "concierge",
      route: "/concierge",
      title: "Home service help",
      summary: "Opening Concierge",
      cue: "Prepare trusted options",
      sourceText: "I need a plumber today",
      priority: "high",
      feedbackReason: "User asked for a plumber",
      payload: {
        intake_origin: "voice",
        service_type: "plumber",
        urgency: "today",
        problem_summary: "Water leaking under the kitchen sink",
        problem_type: "leak",
        active_flooding: "yes",
        affected_area: "kitchen",
        shutoff_status: "cannot_find",
        criteria: "trusted",
        access_notes: "Caregiver can open the door",
      },
    };
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        const body = JSON.parse(String(init?.body));
        expect(body.preferences.service_intake).toMatchObject({
          origin: "voice",
          service_type: "plumber",
          answers: expect.objectContaining({
            problem_type: "leak",
          }),
        });
        expect(body.preferences.service_intake.answers).not.toHaveProperty("problem_summary");
        expect(body.preferences.service_intake.answers).not.toHaveProperty("access_notes");
        return jsonResponse({
          request: {
            id: "request-voice-home-service",
            appointment_type: "home-service",
            reason_detail: body.detail,
            preferences: body.preferences,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [{
            id: "option-saved-plumber",
            provider_id: "provider-1",
            provider_source: "saved",
            provider_snapshot: { name: "Saved Plumber", phone: "+34 600 222 333", preferred_channel: "phone" },
            match_reason: "Saved plumber provider",
            available_channels: ["phone", "manual"],
            rank: 1,
            status: "recommended",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("panel-home-service-ready")).toHaveTextContent("Ready");
    await waitFor(() => {
      expect(screen.getByTestId("button-appointment-start-home-service")).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId("button-appointment-start-home-service"));

    expect(await screen.findByText("Saved Plumber")).toBeVisible();
  });

  it("still prepares ride requests without booking", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Compare safe ways");
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Tell VYVA where to go first");
    });
  });

  it("opens a scam check router and prepares a safe review request", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showScamCheckFastHelp());
    vi.useRealTimers();

    const panel = await screen.findByTestId("panel-scam-check");
    expect(panel).toHaveTextContent("Check a possible scam");
    expect(panel).toHaveTextContent("Email or message");
    expect(panel).toHaveTextContent("Document or photo");
    expect(panel).toHaveTextContent("Phone number");
    expect(panel).toHaveTextContent("Company or offer");
    expect(panel).toHaveTextContent("Review path ready");

    fireEvent.click(screen.getByTestId("button-scam-check-company"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Help me check a company, offer, seller, or service reputation online");
    expect(prefill).toHaveTextContent("Do not click, reply, pay, or share personal details");
    expect(screen.queryByTestId("panel-scam-check")).not.toBeInTheDocument();
  }, 60000);

  it("opens voice ride handoffs on the transport card with known details", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        voiceActionPayload: {
          destination: "Doctor",
          time: "tomorrow morning",
          mobility_needs: "walker",
        },
        conciergePrefill: {
          kind: "ride",
          message: "Book me a ride to the doctor tomorrow morning. Prepare the next step and ask me to confirm before acting.",
          source: "voice_action",
        },
      },
    }]);

    const panel = await screen.findByTestId("panel-concierge-route-prefill");
    expect(panel).toHaveTextContent("Transport options");
    expect(screen.getByTestId("panel-concierge-transport")).toHaveTextContent("Transport options");
    expect(screen.getByDisplayValue("Doctor")).toBeVisible();
    expect(panel).toHaveTextContent("tomorrow morning");
    expect(panel).toHaveTextContent("Walker or cane");
    expect(screen.getByTestId("route-state")).toHaveTextContent("null");
  });

  it("ignores malformed voice ride route state without blanking Concierge", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "ride",
        },
      },
    }]);

    expect(await screen.findByTestId("concierge-master-layout")).toBeVisible();
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-state")).toHaveTextContent("null");
  });

  it("replaces an open home service assistant when the ride card is tapped", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(screen.getByTestId("button-concierge-card-service"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();

    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-concierge-transport")).toHaveTextContent("Transport options");
    });
    expect(screen.queryByTestId("panel-appointment-assistant")).not.toBeInTheDocument();
    expect(screen.queryByTestId("panel-home-service-intake")).not.toBeInTheDocument();
  });

  it("uses saved transport details and only asks for mobility when missing", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{ name: "Trusted Taxi", role: "taxi" }],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Trusted Taxi");
      expect(screen.getByTestId("note-transport-mobility-readiness")).toHaveTextContent("Mobility preferences saved");
    });
    expect(screen.queryByTestId("button-transport-need-wheelchair-access")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-transport-find-options")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });

    expect(screen.getByTestId("button-transport-find-options")).not.toBeDisabled();
  });

  it("routes missing transport provider setup to trusted providers", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("No saved provider yet");
    });
    fireEvent.click(screen.getByTestId("button-transport-provider-setup"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
      expect(screen.getByTestId("route-state")).toHaveTextContent("Add a saved transport provider");
      expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.transportBooking);
    });
  });

  it("requires pharmacy setup before OTC pharmacy help can start", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await showOtcPharmacyFastHelp());
    vi.useRealTimers();

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Save a pharmacy first");
    expect(screen.getByTestId("panel-otc-pharmacy")).toHaveTextContent("Service not active yet");
    fireEvent.click(screen.getByTestId("button-otc-pharmacy-setup"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
      expect(screen.getByTestId("route-state")).toHaveTextContent("Add a saved pharmacy");
      expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.otcPharmacy);
    });
  });

  it("prepares OTC pharmacy requests only through a saved pharmacy", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{ name: "Neighborhood Pharmacy", role: "pharmacy" }],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("order_medicine");
        expect(body.provider_name).toBe("Neighborhood Pharmacy");
        expect(body.auto_start).toBe(false);
        expect(body.action_payload.item_scope).toBe("over_the_counter_only");
        expect(body.action_payload.prescription_items_allowed).toBe(false);
        expect(body.action_payload.item_text).toBe("Vitamins");
        expect(body.action_payload.fulfillment_preference).toBe("pickup");
        expect(body.action_payload.requested_time).toBe("tomorrow");
        return jsonResponse({ pendingId: "otc-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showOtcPharmacyFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    });
    expect(screen.getByTestId("button-otc-pharmacy-prepare")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-otc-pharmacy-item"), {
      target: { value: "Vitamins" },
    });
    fireEvent.click(screen.getByTestId("button-otc-fulfillment-pickup"));
    fireEvent.change(screen.getByTestId("input-otc-pharmacy-time"), {
      target: { value: "tomorrow" },
    });
    fireEvent.change(screen.getByTestId("input-otc-pharmacy-notes"), {
      target: { value: "Small bottle if possible" },
    });

    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("OTC item: Vitamins");
    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("Tool ready: VYVA review");
    expect(screen.getByTestId("button-otc-pharmacy-prepare")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-otc-pharmacy-prepare"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("OTC request prepared. Confirm before VYVA contacts the pharmacy.")).toBeVisible();
  });

  it("finds transport options and prepares a provider without starting a booking", async () => {
    vi.useFakeTimers();
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
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    expect(await screen.findByTestId("card-transport-option-local-taxi-radio-taxi")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("link-transport-call-local-taxi-radio-taxi")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Confirm first");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Destination: Heart Clinic Madrid");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Tool ready: VYVA review");

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
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent("Schedule");
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

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Please prepare an easy outing");

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
          mission_status: "form_in_progress",
          preferred_channel: "booking_url",
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

    expect(await screen.findByTestId("panel-concierge-appointment-mission")).toHaveTextContent("Form in progress");
    expect(screen.getByTestId("panel-concierge-appointment-mission")).toHaveTextContent("VYVA is handling this");
    expect(await screen.findByTestId("panel-concierge-form-plan")).toHaveTextContent("System: TheFork");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Needs: number of guests");
    expect(screen.getByText("VYVA is handling it")).toBeVisible();
  });
});
