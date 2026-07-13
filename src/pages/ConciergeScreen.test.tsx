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
      if (String(url).includes("/api/appointments/requests/request-1/mark-booked")) {
        const body = JSON.parse(String(init?.body));
        expect(body.provider_name).toBe("Clinica Lopez");
        expect(body.location).toBe("Calle Mayor 1");
        expect(body.notes).toContain("Provider reply: Confirmed Tuesday at 10");
        expect(body.notes).toContain("Reference: REF-22");
        return jsonResponse({
          scheduled_event: { id: "scheduled-1", scheduled_for: body.scheduled_for, title: "Appointment" },
          mission: { status: "booked", current_step: "booked", preferred_channel: "phone", activity_log: [] },
        });
      }
      if (String(url).includes("/api/concierge/actions/pending-1/complete")) {
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toContain("Medical appointment confirmed with Clinica Lopez");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
          appointment_request_id: "request-1",
          appointment_type: "medical",
          provider_name: "Clinica Lopez",
          provider_reply: "Confirmed Tuesday at 10",
          reference: "REF-22",
          scheduled_event_id: "scheduled-1",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-appointment-1" });
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
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: phone call");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Recipient: Clinica Lopez");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Tool ready: call");
    expect(screen.queryByTestId("button-appointment-channel-phone")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
    expect(screen.getByText("VYVA is calling now. Save the appointment once confirmed.")).toBeVisible();
    fireEvent.change(screen.getByTestId("input-appointment-provider-reply"), {
      target: { value: "Confirmed Tuesday at 10" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-time"), {
      target: { value: "2026-07-14T10:00" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-reference"), {
      target: { value: "REF-22" },
    });
    fireEvent.click(screen.getByTestId("button-appointment-save-confirmed"));

    expect(await screen.findByText("Appointment saved in Scheduled Support. The task is closed.")).toBeVisible();
    expect(screen.queryByTestId("panel-appointment-mark-booked")).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/appointments/requests/request-1/confirm-attempt", expect.objectContaining({ method: "POST" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/pending-1/complete", expect.objectContaining({ method: "POST" }));
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
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Current path: email");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
    expect(screen.getByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
  });

  it("routes missing medical provider setup to trusted providers", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/appointments/requests")) {
        return jsonResponse({
          request: {
            id: "request-no-provider",
            appointment_type: "medical",
            reason_detail: "cardiology",
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
      target: { value: "cardiology" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("No saved provider for this yet.");
    expect(screen.getByTestId("button-appointment-provider-setup")).toHaveTextContent("Add doctor or clinic");
    fireEvent.click(screen.getByTestId("button-appointment-provider-setup"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("doctor_clinic");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.medicalAppointment);
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
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: booking link");
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Current path: booking link");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(await screen.findByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm appointment");
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

    fireEvent.click(screen.getByRole("button", { name: /review available benefits/i }));

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

  it("turns provider results into clear prepared-contact tasks", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories", "public reviews"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          options: [{
            label: "Opcion recomendada",
            name: "Marbella Care Clinic",
            category: "Care",
            what_it_offers: "Personal care assessment.",
            price_or_advantage: "Clear first-visit price.",
            why_good_option: "Close, trusted, and accessible.",
            distance_or_availability: "1.2 km away and available this week.",
            contact_method: "Phone",
            phone: "+34 600 111 222",
            trust_note: "Verified reviews and published contact.",
            score: 88,
            score_breakdown: {
              distance: 90,
              price_value: 78,
              trust: 86,
              simplicity: 82,
              preference_match: 84,
            },
          }],
          next_step: "Confirm before contacting any provider.",
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("find_provider");
        expect(body.auto_start).toBe(false);
        expect(body.action_summary).toBe("Provider search prepared: Marbella Care Clinic.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          requested_tool: "operator_review",
          action_label: "Prepare contact",
          confirmation_required_before_action: true,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me prepare contact with Marbella Care Clinic");
        expect(body.action_payload.draft_message).toContain("Chosen criteria:");
        expect(body.action_payload.draft_message).toContain("Do not call, book, message, or share details without my confirmation.");
        return jsonResponse({ pendingId: "provider-contact-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByTestId("button-provider-criterion-clear-price"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    const badges = await screen.findByTestId("panel-provider-result-badges-opcion-recomendada-marbella-care-clinic");
    expect(badges).toHaveTextContent("Nearby");
    expect(badges).toHaveTextContent("Good reputation");
    expect(badges).toHaveTextContent("Easy access");
    expect(badges).toHaveTextContent("Clear price");

    const fit = screen.getByTestId("panel-provider-result-fit-opcion-recomendada-marbella-care-clinic");
    expect(fit).toHaveTextContent("Why this fits");
    expect(fit).toHaveTextContent("Close, trusted, and accessible.");
    expect(fit).toHaveTextContent("1.2 km away and available this week.");
    expect(screen.queryByRole("button", { name: /watch changes/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-provider-prepare-contact-opcion-recomendada-marbella-care-clinic"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Provider search ready");
    expect(prefill).toHaveTextContent("Provider search prepared: Marbella Care Clinic.");
    expect(prefill).toHaveTextContent("Prepare contact");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
  }, 60000);

  it("adds provider search criteria to care option searches", async () => {
    let searchBody: { query?: string; locale?: string } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/offers/search")) {
        searchBody = JSON.parse(String(init?.body));
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories", "public reviews"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          options: [],
          next_step: "Confirm before contacting any provider.",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));

    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    expect(screen.getByTestId("button-provider-criterion-nearby")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-provider-criterion-reputation")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-provider-criterion-accessible")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByTestId("button-provider-criterion-clear-price"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    await waitFor(() => {
      expect(searchBody?.query).toContain("compare a specialist, personal care, or residence");
    });
    expect(searchBody?.locale).toBe("en");
    expect(searchBody?.query).toContain("nearby or easy to reach");
    expect(searchBody?.query).toContain("strong reputation with verifiable reviews");
    expect(searchBody?.query).toContain("accessible for older adults");
    expect(searchBody?.query).toContain("clear pricing and no hidden fees");
    expect(searchBody?.query).toContain("Do not contact or share details without confirmation");
  });

  it("offers manual search and setup fallbacks when provider results are empty", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/offers/search")) {
        return jsonResponse({
          category: "Care options",
          decision_explanation: "Ranked by fit, trust, access, and cost clarity.",
          neutrality_note: "No provider paid for placement.",
          source_guidance: ["verified local directories"],
          protection_summary: {
            title: "Protected search",
            checkpoints: ["No contact without confirmation."],
            notification_triggers: [],
            action_guardrail: "VYVA asks before contacting anyone.",
          },
          no_results_message: "No verified provider matched those needs.",
          options: [],
          next_step: "Save a trusted provider or ask VYVA to search manually.",
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));
    fireEvent.click(screen.getByTestId("button-offers-search"));

    expect(await screen.findByText("No verified provider matched those needs.")).toBeVisible();
    expect(screen.getByTestId("button-provider-search-manual")).toHaveTextContent("Ask VYVA to search");
    expect(screen.getByTestId("button-provider-search-setup")).toHaveTextContent("Set up trusted provider");

    fireEvent.click(screen.getByTestId("button-provider-search-setup"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    expect(screen.getByTestId("route-state")).toHaveTextContent("personal_care");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Add a trusted provider");
    expect(screen.getByTestId("route-state")).toHaveTextContent(CONCIERGE_FLOW_REFERENCES.toolGatedTask);
  });

  it("shows provider search follow-through and routes saving to trusted providers", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "provider-search-active",
            use_case: "find_provider",
            provider_name: "VYVA review",
            provider_phone: "+34 600 111 222",
            action_summary: "Provider search prepared: Marbella Care Clinic.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              action_label: "Prepare contact",
              execution_channel: "manual",
              draft_message: [
                "Help me prepare contact with Marbella Care Clinic.",
                "Type: personal care.",
                "Chosen criteria: Nearby, Good reputation, Easy access.",
                "Available contact: +34 600 111 222.",
                "Do not call, book, message, or share details without my confirmation.",
              ].join("\n"),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-provider-search-follow-through");
    expect(panel).toHaveTextContent("Provider shortlisted");
    expect(panel).toHaveTextContent("Marbella Care Clinic");
    expect(panel).toHaveTextContent("Personal care");
    expect(panel).toHaveTextContent("Nearby, Good reputation, Easy access");
    expect(panel).toHaveTextContent("Nothing is contacted without your OK");

    fireEvent.click(screen.getByTestId("button-provider-search-save-provider-provider-search-active"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Save provider from Concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("personal_care");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Marbella Care Clinic");
    expect(screen.getByTestId("route-state")).toHaveTextContent("+34 600 111 222");
  });

  it("lets provider search users record replies or prepare another search", async () => {
    let triggerBody: { action_payload?: { draft_message?: string }; action_summary?: string; use_case?: string } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "provider-search-active",
            use_case: "find_provider",
            provider_name: "VYVA review",
            provider_phone: null,
            action_summary: "Provider search prepared: Marbella Care Clinic.",
            action_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
              action_label: "Prepare contact",
              execution_channel: "manual",
              draft_message: [
                "Help me prepare contact with Marbella Care Clinic.",
                "Type: personal care.",
                "Chosen criteria: Nearby, Good reputation.",
                "Do not call, book, message, or share details without my confirmation.",
              ].join("\n"),
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        triggerBody = JSON.parse(String(init?.body));
        return jsonResponse({ pendingId: "provider-search-alt", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-search-reply-provider-search-active"));
    expect(screen.getByTestId("panel-provider-reply-confirmed-provider-search-active")).toBeInTheDocument();
    expect(screen.getByTestId("input-provider-reply-text-provider-search-active")).toHaveValue("");

    fireEvent.click(screen.getByTestId("button-provider-search-try-another-provider-search-active"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Provider search ready");
    expect(prefill).toHaveTextContent("Alternative provider search prepared.");
    expect(prefill).toHaveTextContent("Find another provider");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(triggerBody).toMatchObject({
        use_case: "find_provider",
        action_summary: "Alternative provider search prepared.",
        action_payload: expect.objectContaining({
          draft_message: expect.stringContaining("Find another option similar to Marbella Care Clinic"),
          no_external_action_without_confirmation: true,
        }),
      });
    });
    expect(triggerBody?.action_payload?.draft_message).toContain("Do not contact or share details without my confirmation");
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
    expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Recipient: Trusted search");
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
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Saved Plumber",
            role: "plumber",
            phone: "+34 600 222 333",
            email: "plumber@example.com",
            whatsapp: "+34 600 222 334",
            bookingUrl: "https://plumber.example/book",
            preferredChannel: "whatsapp",
          }],
        });
      }
      if (target.endsWith("/api/appointments/requests/request-voice-home-service/confirm-attempt")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          option_id: "option-saved-plumber",
          channel: "whatsapp",
        });
        return jsonResponse({
          attempt: { id: "attempt-home-service", channel: "whatsapp", status: "whatsapp_sent" },
          pending: { pendingId: "pending-home-service", status: "queued" },
          communication: {
            id: "communication-home-service",
            channel: "whatsapp",
            recipient: "+34 600 222 334",
            status: "sent",
          },
          handled_by_vyva: true,
          needs_booking_confirmation: true,
        });
      }
      if (target.endsWith("/api/concierge/actions/pending-home-service/complete")) {
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toContain("Home service visit confirmed with Saved Plumber");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
          appointment_request_id: "request-voice-home-service",
          appointment_type: "home-service",
          provider_name: "Saved Plumber",
          service_type: "plumber",
          service_label: "Plumber",
          urgency: "today",
          criteria: "trusted",
          estimated_cost: "EUR80",
          scheduled_event_id: "scheduled-home-service",
        });
        expect(body.outcome_payload.safety_flags).toEqual(expect.arrayContaining(["active_water_damage"]));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-home-service" });
      }
      if (target.endsWith("/api/appointments/requests/request-voice-home-service/mark-booked")) {
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          provider_name: "Saved Plumber",
          location: "Home kitchen",
        });
        expect(body.notes).toContain("Provider reply: Can visit tomorrow at 10:00. Estimated cost EUR80.");
        expect(body.notes).toContain("Notes: Caregiver will open the door.");
        return jsonResponse({
          scheduled_event: {
            id: "scheduled-home-service",
            scheduled_for: body.scheduled_for,
            title: "Saved Plumber",
          },
          mission: {
            status: "booked",
            current_step: "Saved",
            preferred_channel: "whatsapp",
            user_control_state: {
              listening: false,
              muted: false,
              stopped: true,
              awaiting_confirmation: false,
            },
            activity_log: ["Saved"],
          },
        });
      }
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
            provider_snapshot: {
              name: "Saved Plumber",
              phone: "+34 600 222 333",
              email: "plumber@example.com",
              whatsapp: "+34 600 222 334",
              booking_url: "https://plumber.example/book",
              preferred_channel: "whatsapp",
            },
            match_reason: "Saved plumber provider",
            available_channels: ["whatsapp", "booking_url", "phone", "email", "manual"],
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
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Tool ready");
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Direct tool: WhatsApp");
      expect(screen.getByTestId("panel-home-service-readiness")).toHaveTextContent("Recipient: Saved Plumber");
    });
    await waitFor(() => {
      expect(screen.getByTestId("button-appointment-start-home-service")).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId("button-appointment-start-home-service"));

    expect(await screen.findByText("Saved Plumber")).toBeVisible();
    expect(screen.getByTestId("panel-appointment-readiness")).toHaveTextContent("Direct tool: WhatsApp");
    expect(screen.getByTestId("panel-appointment-confirmation-checkpoint")).toHaveTextContent("Tool ready: WhatsApp");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests/request-voice-home-service/confirm-attempt",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("VYVA sent the message. Save the appointment when they reply.")).toBeVisible();
    expect(screen.getByTestId("panel-appointment-mark-booked")).toHaveTextContent("Review and confirm visit");

    fireEvent.change(screen.getByTestId("input-appointment-provider-reply"), {
      target: { value: "Can visit tomorrow at 10:00. Estimated cost EUR80." },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-time"), {
      target: { value: "2026-08-04T10:00" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-location"), {
      target: { value: "Home kitchen" },
    });
    fireEvent.change(screen.getByTestId("input-appointment-confirmed-note"), {
      target: { value: "Caregiver will open the door." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save confirmed visit" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests/request-voice-home-service/mark-booked",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Appointment saved in Scheduled Support. The task is closed.")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/pending-home-service/complete", expect.objectContaining({ method: "POST" }));
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
      expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Save a provider first");
    });
  });

  it("opens an insurance admin router and prepares a claim review request", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("admin_task");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("Paperwork task prepared: Claim or reimbursement.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
          requested_tool: "email",
          active_tool: "operator_review",
          readiness_status: "manual_review",
          execution_channel: "manual",
          action_label: "Claim or reimbursement",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me prepare a claim or reimbursement");
        return jsonResponse({ pendingId: "admin-task-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-fast-fill-form"));

    const panel = await screen.findByTestId("panel-insurance-admin");
    expect(panel).toHaveTextContent("What do you need to prepare?");
    expect(panel).toHaveTextContent("Insurance letter or bill");
    expect(panel).toHaveTextContent("Claim or reimbursement");
    expect(panel).toHaveTextContent("Government/admin form");
    expect(panel).toHaveTextContent("Call or email someone");
    expect(screen.getByTestId("panel-insurance-admin-readiness-insurance-letter")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-insurance-admin-readiness-insurance-letter")).toHaveTextContent("Direct tool: camera or upload");
    expect(screen.getByTestId("panel-insurance-admin-readiness-government-form")).toHaveTextContent("Current path: camera or upload");
    expect(screen.getByTestId("panel-insurance-admin-readiness-claim")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-insurance-admin-readiness-claim")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-insurance-admin-readiness-call-email")).toHaveTextContent("Direct tool: phone call");
    expect(screen.getByTestId("panel-insurance-admin-readiness-call-email")).toHaveTextContent("Review path ready");

    fireEvent.click(screen.getByTestId("button-insurance-admin-claim"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Paperwork task ready");
    expect(prefill).toHaveTextContent("Help me prepare a claim or reimbursement");
    expect(prefill).toHaveTextContent("Prepare a draft for review");
    expect(prefill).toHaveTextContent("Add to Right now");
    expect(prefill).toHaveTextContent("Nothing is booked or requested without your confirmation");
    expect(screen.queryByTestId("panel-insurance-admin")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("turns Home Find Care prefills into structured provider-search tasks", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("find_provider");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("VYVA prepares trusted options before contacting anyone.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          requested_tool: "operator_review",
          active_tool: "operator_review",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Prepare care search",
          confirmation_required_before_action: true,
          review_fallback: true,
          no_external_action_without_confirmation: true,
          source: "home_quick_action",
        });
        expect(body.action_payload.draft_message).toContain("Help me find care or support options");
        return jsonResponse({ pendingId: "provider-search-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation.",
          flowReference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
          requestedTool: "operator_review",
          actionLabel: "Prepare care search",
          summary: "VYVA prepares trusted options before contacting anyone.",
          useCase: "find_provider",
          source: "home_quick_action",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Provider search ready");
    expect(prefill).toHaveTextContent("VYVA prepares trusted options before contacting anyone.");
    expect(prefill).toHaveTextContent("Prepare care search");
    expect(prefill).toHaveTextContent("Add to Right now");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
  }, 60000);

  it("opens a scam check router and prepares a safe review request", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("scam_check");
        expect(body.auto_start).toBe(false);
        expect(body.provider_name).toBe("VYVA review");
        expect(body.action_summary).toBe("Safe check prepared: Company or offer.");
        expect(body.action_payload).toMatchObject({
          flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
          requested_tool: "web_search",
          active_tool: "web_search",
          readiness_status: "ready",
          execution_channel: "manual",
          action_label: "Company or offer",
          confirmation_required_before_action: true,
          review_fallback: false,
          no_external_action_without_confirmation: true,
        });
        expect(body.action_payload.draft_message).toContain("Help me check a company, offer, seller, or service reputation online");
        return jsonResponse({ pendingId: "scam-check-1", status: "pending" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showScamCheckFastHelp());
    vi.useRealTimers();

    const panel = await screen.findByTestId("panel-scam-check");
    expect(panel).toHaveTextContent("Check a possible scam");
    expect(panel).toHaveTextContent("Email or message");
    expect(panel).toHaveTextContent("Document or photo");
    expect(panel).toHaveTextContent("Phone number");
    expect(panel).toHaveTextContent("Company or offer");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Review path ready");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-scam-check-readiness-email")).toHaveTextContent("Current path: VYVA review");
    expect(screen.getByTestId("panel-scam-check-readiness-document")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-scam-check-readiness-document")).toHaveTextContent("Direct tool: camera or upload");
    expect(screen.getByTestId("panel-scam-check-readiness-phone")).toHaveTextContent("Direct tool: web search");
    expect(screen.getByTestId("panel-scam-check-readiness-company")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-scam-check-readiness-company")).toHaveTextContent("Current path: web search");

    fireEvent.click(screen.getByTestId("button-scam-check-company"));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Safe check ready");
    expect(prefill).toHaveTextContent("Help me check a company, offer, seller, or service reputation online");
    expect(prefill).toHaveTextContent("Do not click, reply, pay, or share personal details");
    expect(prefill).toHaveTextContent("Add to Right now");
    expect(screen.queryByTestId("panel-scam-check")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(screen.queryByTestId("panel-concierge-route-prefill")).not.toBeInTheDocument();
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
          savedProviders: [{ name: "Trusted Taxi", role: "taxi", phone: "+34 600 111 222", preferredChannel: "phone" }],
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
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Tool ready");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Direct tool: phone call");
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Recipient: Trusted Taxi");
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
      expect(screen.getByTestId("panel-transport-readiness")).toHaveTextContent("Current path: VYVA review");
    });
    expect(screen.getByTestId("button-transport-find-options")).toHaveTextContent("Add transport provider");
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

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
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            email: "pharmacy@example.com",
            whatsapp: "+34 600 333 445",
            bookingUrl: "https://pharmacy.example/order",
            preferredChannel: "whatsapp",
          }],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (String(url).includes("/api/concierge/actions/trigger")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.use_case).toBe("order_medicine");
        expect(body.provider_name).toBe("Neighborhood Pharmacy");
        expect(body.provider_phone).toBe("+34 600 333 444");
        expect(body.auto_start).toBe(false);
        expect(body.action_payload.provider_email).toBe("pharmacy@example.com");
        expect(body.action_payload.provider_whatsapp).toBe("+34 600 333 445");
        expect(body.action_payload.booking_url).toBe("https://pharmacy.example/order");
        expect(body.action_payload.preferred_channel).toBe("whatsapp");
        expect(body.action_payload.execution_channel).toBe("whatsapp");
        expect(body.action_payload.whatsapp_message).toContain("over-the-counter pharmacy items: Vitamins");
        expect(body.action_payload.item_scope).toBe("over_the_counter_only");
        expect(body.action_payload.prescription_items_allowed).toBe(false);
        expect(body.action_payload.item_text).toBe("Vitamins");
        expect(body.action_payload.fulfillment_preference).toBe("pickup");
        expect(body.action_payload.requested_time).toBe("tomorrow");
        return jsonResponse({ pendingId: "otc-1", status: "pending" });
      }
      if (String(url).includes("/api/concierge/actions/otc-1/complete")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toBe("OTC pharmacy request saved with Neighborhood Pharmacy.");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: "FLOW_OTC_PHARMACY",
          pharmacy_name: "Neighborhood Pharmacy",
          item_text: "Vitamins",
          item_scope: "over_the_counter_only",
          prescription_items_allowed: false,
          fulfillment_preference: "pickup",
          requested_time: "tomorrow",
          availability: "Available after 5pm",
          cost_estimate: "EUR12",
          fulfillment_note: "Pickup counter",
          pharmacy_reference: "PH-22",
          notes: "Bring ID",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "otc-session-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showOtcPharmacyFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    });
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Direct tool: WhatsApp");
    expect(screen.getByTestId("panel-otc-pharmacy-readiness")).toHaveTextContent("Recipient: Neighborhood Pharmacy");
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
    expect(screen.getByTestId("panel-otc-pharmacy-confirmation")).toHaveTextContent("Tool ready: WhatsApp");
    expect(screen.getByTestId("button-otc-pharmacy-prepare")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-otc-pharmacy-prepare"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("OTC request prepared. Confirm before VYVA contacts the pharmacy.")).toBeVisible();
    expect(screen.getByTestId("panel-otc-pharmacy-outcome")).toHaveTextContent("Pharmacy reply");
    expect(screen.getByTestId("button-otc-outcome-save")).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-otc-outcome-availability"), {
      target: { value: "Available after 5pm" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-cost"), {
      target: { value: "EUR12" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-fulfillment"), {
      target: { value: "Pickup counter" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-reference"), {
      target: { value: "PH-22" },
    });
    fireEvent.change(screen.getByTestId("input-otc-outcome-notes"), {
      target: { value: "Bring ID" },
    });
    expect(screen.getByTestId("button-otc-outcome-save")).not.toBeDisabled();
    fireEvent.click(screen.getByTestId("button-otc-outcome-save"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/otc-1/complete", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Pharmacy reply saved. The OTC task is closed.")).toBeVisible();
    expect(screen.queryByTestId("panel-otc-pharmacy-outcome")).not.toBeInTheDocument();
  });

  it("finds transport options and prepares a provider without starting a booking", async () => {
    vi.useFakeTimers();
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Radio Taxi",
            role: "taxi",
            phone: "+34 612 345 678",
            whatsapp: "+34 612 345 679",
            preferredChannel: "whatsapp",
          }],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
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
            whatsapp: "+34 612 345 679",
            preferredChannel: "whatsapp",
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
        expect(body.action_payload.provider_whatsapp).toBe("+34 612 345 679");
        expect(body.action_payload.preferred_channel).toBe("whatsapp");
        expect(body.action_payload.execution_channel).toBe("whatsapp");
        expect(body.action_payload.whatsapp_message).toContain("Destination: Heart Clinic Madrid");
        return jsonResponse({ pendingId: "transport-1", status: "pending" });
      }
      if (String(url).includes("/api/profile/scheduled-events")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          event_type: "transport",
          title: "Ride with Radio Taxi",
          source: "concierge",
          status: "upcoming",
        });
        expect(body.description).toContain("Pickup: Saved home");
        expect(body.description).toContain("Destination: Heart Clinic Madrid");
        expect(body.description).toContain("Provider reply: Confirmed, arrives at 09:30.");
        expect(body.description).toContain("Price: EUR18");
        expect(body.description).toContain("Reference: RT-123");
        expect(body.metadata).toMatchObject({
          flow_reference: "FLOW_TRANSPORT_BOOKING",
          pending_id: "transport-1",
          provider_name: "Radio Taxi",
          provider_phone: "+34 612 345 678",
          provider_whatsapp: "+34 612 345 679",
          option_kind: "local_taxi",
          pickup_address: "Saved home",
          destination_address: "Heart Clinic Madrid",
          requested_time: "now",
          provider_reply: "Confirmed, arrives at 09:30.",
          price_estimate: "EUR18",
          booking_reference: "RT-123",
        });
        return jsonResponse({ event: { id: "ride-event-1", title: body.title } });
      }
      if (String(url).includes("/api/concierge/actions/transport-1/complete")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.outcome_summary).toBe("Ride saved with Radio Taxi.");
        expect(body.outcome_payload).toMatchObject({
          flow_reference: "FLOW_TRANSPORT_BOOKING",
          provider_name: "Radio Taxi",
          provider_reply: "Confirmed, arrives at 09:30.",
          price_estimate: "EUR18",
          booking_reference: "RT-123",
          pickup_address: "Saved home",
          destination_address: "Heart Clinic Madrid",
        });
        return jsonResponse({ ok: true, status: "completed", sessionId: "transport-session-1" });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(await showBookRideFastHelp());
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Radio Taxi");
    });
    fireEvent.change(screen.getByTestId("input-transport-destination"), {
      target: { value: "Heart Clinic Madrid" },
    });
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    expect(await screen.findByTestId("card-transport-option-local-taxi-radio-taxi")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("link-transport-call-local-taxi-radio-taxi")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Confirm first");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Destination: Heart Clinic Madrid");
    expect(screen.getByTestId("panel-transport-confirm-local-taxi-radio-taxi")).toHaveTextContent("Tool ready: WhatsApp");

    const prepareButton = screen.getByTestId("button-transport-prepare-local-taxi-radio-taxi");
    await waitFor(() => expect(prepareButton).not.toBeDisabled());
    await act(async () => {
      fireEvent.click(prepareButton);
    });

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Ride request prepared. Confirm contact in Right now, then review and save the ride.")).toBeVisible();
    expect(screen.getByTestId("panel-transport-final-review")).toHaveTextContent("Review and confirm ride");

    fireEvent.change(screen.getByTestId("input-transport-provider-reply"), {
      target: { value: "Confirmed, arrives at 09:30." },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-time"), {
      target: { value: "2026-08-04T09:30" },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-price"), {
      target: { value: "EUR18" },
    });
    fireEvent.change(screen.getByTestId("input-transport-confirmed-reference"), {
      target: { value: "RT-123" },
    });

    fireEvent.click(screen.getByTestId("button-transport-save-confirmed-ride"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/profile/scheduled-events", expect.objectContaining({
        method: "POST",
      }));
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/transport-1/complete", expect.objectContaining({
        method: "POST",
      }));
    });
    expect(await screen.findByText("Ride saved in Scheduled Support. The task is closed.")).toBeVisible();
  });
});

describe("ConciergeScreen route prefill", () => {
  it("resumes a ride flow after trusted provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Trusted Taxi",
            role: "taxi",
            phone: "+34 600 111 222",
            preferredChannel: "phone",
          }],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasMobilityInfo: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Trusted Taxi",
          category: "transport",
          conciergeResume: {
            kind: "transport",
            message: "Please help me book a ride to City Clinic tomorrow morning.",
            pickup: "Saved home",
            destination: "City Clinic",
            time: "tomorrow morning",
            mobilityNeeds: ["Help to the door"],
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Provider saved");
    expect(resume).toHaveTextContent("Trusted Taxi");
    expect(resume).toHaveTextContent("Continue ride");

    await waitFor(() => {
      expect(screen.getByTestId("route-state")).toHaveTextContent("null");
    });

    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("note-transport-provider-readiness")).toHaveTextContent("Saved provider first: Trusted Taxi");
    expect(screen.getByTestId("note-transport-mobility-readiness")).toHaveTextContent("Mobility preferences saved");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow morning");
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
  });

  it("resumes an OTC pharmacy flow with the original item details after provider setup returns", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            preferredChannel: "phone",
          }],
          serviceReadiness: {
            hasSavedPharmacy: true,
          },
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        trustedProviderSaved: {
          name: "Neighborhood Pharmacy",
          category: "pharmacy",
          conciergeResume: {
            kind: "otc_pharmacy",
            itemText: "Vitamin D",
            fulfillmentPreference: "pickup",
            requestedTime: "tomorrow",
            notes: "Same brand",
          },
        },
      },
    }]);

    const resume = await screen.findByTestId("panel-concierge-provider-resume");
    expect(resume).toHaveTextContent("Provider saved");
    expect(resume).toHaveTextContent("Neighborhood Pharmacy");
    expect(resume).toHaveTextContent("Continue pharmacy");

    fireEvent.click(screen.getByTestId("button-provider-resume-continue"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    expect(screen.getByTestId("input-otc-pharmacy-item")).toHaveValue("Vitamin D");
    expect(screen.getByTestId("input-otc-pharmacy-time")).toHaveValue("tomorrow");
    expect(screen.getByTestId("input-otc-pharmacy-notes")).toHaveValue("Same brand");
    expect(screen.queryByTestId("panel-concierge-provider-resume")).not.toBeInTheDocument();
  });

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
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Tool ready");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Direct tool: VYVA review");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Current path: VYVA review");

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

  it("turns a completed Home task handoff into a reusable Concierge template", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergeCompletedTemplate: {
          id: "session-ride",
          pending_id: "old-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          outcome: "completed",
          outcome_summary: "Ride saved with Radio Taxi.",
          completed_at: "2026-08-04T09:30:00.000Z",
          outcome_payload: {
            pickup_address: "Saved home",
            destination_address: "City Clinic",
            requested_time: "tomorrow 09:00",
            mobility_needs: ["Help to the door"],
          },
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow 09:00");
  });

  it("shows readiness fallback for email-style tool-gated task handoffs", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([{
      pathname: "/concierge",
      state: {
        conciergePrefill: {
          kind: "task",
          message: "Please prepare an email to my insurance company about the reimbursement.",
          source: "voice_action",
        },
      },
    }]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Please prepare an email");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Review path ready");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Direct tool: email");
    expect(screen.getByTestId("panel-route-prefill-readiness")).toHaveTextContent("Current path: VYVA review");
  });

  it("renders prepared provider phone actions as direct call links", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-1",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared for the health appointment.",
        action_payload: {
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          requested_time: "tomorrow 09:00",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const callLink = await screen.findByRole("link", { name: "Call +34 612 345 678" });
    expect(callLink).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Follow-through");
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Ready for your OK");
    expect(screen.getByTestId("timeline-step-review")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "upcoming");
    const checklist = screen.getByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("What is missing");
    expect(checklist).toHaveTextContent("VYVA asks before anything is sent, called, or booked.");
    expect(checklist).toHaveTextContent("Details");
    expect(checklist).toHaveTextContent("Ready");
    expect(checklist).toHaveTextContent("Provider");
    expect(checklist).toHaveTextContent("Radio Taxi");
    expect(checklist).toHaveTextContent("Contact");
    expect(checklist).toHaveTextContent("Phone call");
    expect(checklist).toHaveTextContent("Confirm");
    expect(checklist).toHaveTextContent("Confirm ride call");
    expect(screen.getByTestId("button-concierge-checklist-details")).toHaveTextContent("Review");
    expect(screen.getByTestId("button-concierge-checklist-provider")).toHaveTextContent("Change");
    expect(screen.getByTestId("button-concierge-checklist-confirm")).toHaveTextContent("OK");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Next step");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Review & confirm");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Provider");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Contact route");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Confirm ride call");
    expect(screen.getByTestId("button-concierge-change-ride-1")).toHaveTextContent("Change");
    expect(screen.getByTestId("button-concierge-cancel-ride-1")).toHaveTextContent("Cancel");
    expect(screen.getByTestId("button-concierge-confirm-ride-1")).toHaveTextContent("Confirm ride call");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/concierge/actions/ride-1/confirm", { method: "POST" });
    });

    fireEvent.click(screen.getByTestId("button-concierge-checklist-details"));
    expect(await screen.findByTestId("input-transport-destination")).toBeVisible();
  });

  it("shows the exact missing ride detail before allowing checklist confirmation", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-missing-destination",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared, but the destination still needs to be confirmed.",
        action_payload: {
          pickup_address: "Saved home",
          requested_time: "now",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Destination needed");
    expect(checklist).toHaveTextContent("Complete details");
    expect(screen.getByTestId("button-concierge-checklist-confirm")).toHaveTextContent("Add");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    const destinationInput = await screen.findByTestId("input-transport-destination");
    expect(destinationInput).toBeVisible();
    await waitFor(() => {
      expect(document.activeElement).toBe(destinationInput);
    });
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      "/api/concierge/actions/ride-missing-destination/confirm",
      { method: "POST" },
    );
  });

  it("expands ride details and focuses pickup when pickup is missing", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-missing-pickup",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "Taxi option prepared, but pickup still needs to be confirmed.",
        action_payload: {
          destination_address: "City Clinic",
          requested_time: "now",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Pickup needed");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    const pickupInput = await screen.findByTestId("input-transport-pickup");
    expect(pickupInput).toBeVisible();
    await waitFor(() => {
      expect(document.activeElement).toBe(pickupInput);
    });
  });

  it("opens OTC pharmacy details and focuses the missing item field", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [{
            name: "Neighborhood Pharmacy",
            role: "pharmacy",
            phone: "+34 600 333 444",
            preferredChannel: "phone",
          }],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "otc-missing-item",
            use_case: "order_medicine",
            provider_name: "Neighborhood Pharmacy",
            provider_phone: "+34 600 333 444",
            action_summary: "OTC pharmacy request prepared, but item is missing.",
            action_payload: {
              fulfillment_preference: "pickup",
              requested_time: "today",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const checklist = await screen.findByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Item needed");

    fireEvent.click(screen.getByTestId("button-concierge-checklist-confirm"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    const itemInput = await screen.findByTestId("input-otc-pharmacy-item");
    await waitFor(() => {
      expect(document.activeElement).toBe(itemInput);
    });
  });

  it("routes a missing provider checklist item to focused trusted-provider setup", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-provider-missing",
        use_case: "book_ride",
        provider_name: null,
        provider_phone: null,
        action_summary: "Ride details are ready, but no transport provider is saved yet.",
        action_payload: {
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          requested_time: "tomorrow 09:00",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-flow-checklist")).toHaveTextContent("Choose first");
    fireEvent.click(screen.getByTestId("button-concierge-checklist-provider"));

    expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/providers");
    const routeState = JSON.parse(screen.getByTestId("route-state").textContent || "{}");
    expect(routeState).toMatchObject({
      returnTo: "/concierge",
      setupFocus: "transport",
      setupFlow: CONCIERGE_FLOW_REFERENCES.transportBooking,
    });
    expect(routeState.conciergeResume).toMatchObject({
      kind: "transport",
      pickup: "Saved home",
      destination: "City Clinic",
      time: "tomorrow 09:00",
    });
  });

  it("labels home-service appointment tasks by their service flow", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "service-save-1",
        use_case: "book_appointment",
        provider_name: "Saved Plumber",
        provider_phone: null,
        action_summary: "Provider replied with a time for the plumber visit.",
        action_payload: {
          appointment_type: "home-service",
          mission_status: "awaiting_user_save",
          execution_channel: "manual",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Home service");
    });
    expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Saved Plumber");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Save confirmed service");
  });

  it("shows recent completed concierge sessions without replacing the active task", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target === "/api/profile") {
        return jsonResponse({
          savedProviders: [
            { name: "Radio Taxi", role: "taxi", phone: "+34 612 345 678", preferredChannel: "phone" },
            { name: "Neighborhood Pharmacy", role: "pharmacy", phone: "+34 600 333 444", preferredChannel: "phone" },
            { name: "Saved Plumber", role: "plumber", phone: "+34 600 222 333", preferredChannel: "phone" },
          ],
          serviceReadiness: {
            hasSavedTransportProvider: true,
            hasSavedPharmacy: true,
          },
        });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "ride-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Taxi option prepared.",
            action_payload: null,
            status: "pending",
            language: "en",
          }],
        });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [
            {
              id: "session-ride",
              pending_id: "old-ride",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              outcome: "completed",
              outcome_summary: "Ride saved with Radio Taxi.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: {
                flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
                provider_phone: "+34 612 345 678",
                pickup_address: "Saved home",
                destination_address: "City Clinic",
                requested_time: "tomorrow 09:00",
                mobility_needs: ["Help to the door"],
                price_estimate: "EUR18",
                booking_reference: "RT-123",
              },
            },
            {
              id: "session-otc",
              pending_id: "old-otc",
              use_case: "order_medicine",
              provider_name: "Neighborhood Pharmacy",
              outcome: "completed",
              outcome_summary: "OTC pharmacy request saved.",
              completed_at: "2026-08-03T17:00:00.000Z",
              outcome_payload: {
                flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
                item_text: "Vitamin D",
                fulfillment_preference: "pickup",
                requested_time: "tomorrow",
                notes: "Same brand",
                cost_estimate: "EUR12",
                pharmacy_reference: "PH-22",
              },
            },
            {
              id: "session-home",
              pending_id: "old-home",
              use_case: "book_appointment",
              provider_name: "Saved Plumber",
              outcome: "completed",
              outcome_summary: "Home service visit confirmed.",
              completed_at: "2026-08-02T10:00:00.000Z",
              outcome_payload: {
                appointment_type: "home-service",
                service_type: "plumber",
                problem_summary: "Leak under the kitchen sink",
                urgency: "tomorrow",
                estimated_cost: "EUR80",
                location: "Home kitchen",
              },
            },
            {
              id: "session-hidden",
              pending_id: "old-extra",
              use_case: "book_appointment",
              provider_name: "Extra Clinic",
              outcome: "completed",
              outcome_summary: "Should not show in the compact list.",
              completed_at: "2026-08-01T10:00:00.000Z",
              outcome_payload: {},
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-completed-history")).toHaveTextContent("Done recently");
    });
    expect(screen.getByTestId("section-concierge-active-task")).toHaveTextContent("Taxi option prepared.");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Ride");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Radio Taxi");
    expect(screen.getByTestId("card-concierge-completed-session-ride")).toHaveTextContent("Cost: EUR18");
    expect(screen.getByTestId("card-concierge-completed-session-otc")).toHaveTextContent("OTC pharmacy");
    expect(screen.getByTestId("card-concierge-completed-session-home")).toHaveTextContent("Home service");
    expect(screen.queryByTestId("card-concierge-completed-session-hidden")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-ride"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(receipt).toHaveTextContent("Receipt");
    expect(receipt).toHaveTextContent("Ride saved with Radio Taxi.");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Reference");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("RT-123");
    expect(within(receipt).getByTestId("link-concierge-receipt-contact")).toHaveAttribute("href", "tel:+34612345678");

    fireEvent.click(within(receipt).getByTestId("button-concierge-receipt-template"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-concierge-completed-receipt")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("panel-concierge-route-prefill")).toHaveTextContent("Transport options");
    expect(screen.getByTestId("input-transport-pickup")).toHaveValue("Saved home");
    expect(screen.getByTestId("input-transport-destination")).toHaveValue("City Clinic");
    expect(screen.getByTestId("input-transport-time")).toHaveValue("tomorrow 09:00");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-otc"));
    const otcReceipt = await screen.findByTestId("panel-concierge-completed-receipt");
    fireEvent.click(within(otcReceipt).getByTestId("button-concierge-receipt-template"));

    expect(await screen.findByTestId("panel-otc-pharmacy")).toHaveTextContent("Saved pharmacy: Neighborhood Pharmacy");
    expect(screen.getByTestId("input-otc-pharmacy-item")).toHaveValue("Vitamin D");
    expect(screen.getByTestId("input-otc-pharmacy-time")).toHaveValue("tomorrow");
    expect(screen.getByTestId("input-otc-pharmacy-notes")).toHaveValue("Same brand");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-home"));
    const homeReceipt = await screen.findByTestId("panel-concierge-completed-receipt");
    fireEvent.click(within(homeReceipt).getByTestId("button-concierge-receipt-template"));

    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Home service");
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();
    expect(screen.getByTestId("button-home-service-type-plumber")).toBeInTheDocument();
  });

  it("shows completed appointment history as a reusable appointment template", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({ items: [] });
      }
      if (target.endsWith("/api/concierge/actions/sessions")) {
        return jsonResponse({
          items: [{
            id: "session-appointment",
            pending_id: "old-appointment",
            use_case: "book_appointment",
            provider_name: "Clinica Lopez",
            outcome: "completed",
            outcome_summary: "Medical appointment confirmed with Clinica Lopez.",
            completed_at: "2026-08-05T11:30:00.000Z",
            outcome_payload: {
              flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
              appointment_type: "medical",
              appointment_reason: "dermatology follow-up",
              scheduled_for: "2026-08-12T09:30",
              location: "Calle Mayor 1",
              provider_phone: "+34 600 111 222",
              reference: "CL-44",
            },
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    await waitFor(() => {
      expect(screen.getByTestId("section-concierge-completed-history")).toHaveTextContent("Done recently");
    });
    expect(screen.getByTestId("card-concierge-completed-session-appointment")).toHaveTextContent("Appointment");
    expect(screen.getByTestId("card-concierge-completed-session-appointment")).toHaveTextContent("Clinica Lopez");

    fireEvent.click(screen.getByTestId("card-concierge-completed-session-appointment"));
    const receipt = await screen.findByTestId("panel-concierge-completed-receipt");
    expect(receipt).toHaveTextContent("Medical appointment confirmed with Clinica Lopez.");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("Reference");
    expect(within(receipt).getByTestId("list-concierge-completed-receipt-details")).toHaveTextContent("CL-44");
    expect(within(receipt).getByTestId("link-concierge-receipt-contact")).toHaveAttribute("href", "tel:+34600111222");

    fireEvent.click(within(receipt).getByTestId("button-concierge-receipt-template"));
    await waitFor(() => {
      expect(screen.queryByTestId("modal-concierge-completed-receipt")).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId("panel-appointment-assistant")).toHaveTextContent("Appointment");
    expect(screen.getByDisplayValue("dermatology follow-up")).toBeVisible();
    expect(screen.getByRole("button", { name: "Medical" })).toBeVisible();
  });

  it("shows requested as the active follow-through step for started actions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "ride-calling-1",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        provider_phone: "+34 612 345 678",
        action_summary: "VYVA is calling the taxi provider now.",
        action_payload: null,
        status: "calling",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-action-timeline")).toHaveTextContent("Request started");
    expect(screen.getByTestId("timeline-step-review")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-waiting")).toHaveAttribute("data-state", "upcoming");
    const checklist = screen.getByTestId("panel-concierge-flow-checklist");
    expect(checklist).toHaveTextContent("Provider reply");
    expect(checklist).toHaveTextContent("Waiting");
    expect(checklist).toHaveTextContent("After reply");
    expect(screen.getByTestId("button-concierge-checklist-reply")).toHaveTextContent("Record");
    fireEvent.click(screen.getByTestId("button-concierge-checklist-reply"));
    expect(screen.getByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
  });

  it("records a confirmed provider reply through the existing completion endpoint", async () => {
    let completeBody: { outcome_summary?: string; outcome_payload?: Record<string, unknown> } | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/concierge/actions/reply-ride-1/complete")) {
        completeBody = JSON.parse(String(init?.body));
        return jsonResponse({ ok: true, status: "completed", sessionId: "session-reply-ride-1" });
      }
      if (target.endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-ride-1",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "tomorrow 09:00",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-provider-reply")).toHaveTextContent("Provider reply");
    fireEvent.click(screen.getByTestId("button-provider-reply-confirmed-reply-ride-1"));
    fireEvent.change(screen.getByTestId("input-provider-reply-time-reply-ride-1"), {
      target: { value: "tomorrow 09:30" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-reference-reply-ride-1"), {
      target: { value: "RT-42" },
    });
    fireEvent.change(screen.getByTestId("input-provider-reply-text-reply-ride-1"), {
      target: { value: "Driver will wait outside the main door." },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-save-reply-ride-1"));

    await waitFor(() => {
      expect(completeBody).toMatchObject({
        outcome_summary: "Provider confirmed: Radio Taxi. Time: tomorrow 09:30. Reference: RT-42.",
        outcome_payload: expect.objectContaining({
          provider_name: "Radio Taxi",
          provider_phone: "+34 612 345 678",
          provider_reply_status: "confirmed",
          provider_reply: "Driver will wait outside the main door.",
          scheduled_for: "tomorrow 09:30",
          reference: "RT-42",
          pickup_address: "Saved home",
          destination_address: "City Clinic",
          completed_from: "provider_reply_panel",
        }),
      });
    });
  });

  it("prepares a provider follow-up while keeping the final send under user control", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-follow-up",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "tomorrow 09:00",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
            confirmed_at: new Date().toISOString(),
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const panel = await screen.findByTestId("panel-concierge-provider-reply");
    expect(panel).toHaveTextContent("Waiting since");
    expect(screen.getByTestId("button-provider-reply-confirmed-reply-follow-up")).toHaveTextContent("I got a reply");
    expect(screen.getByTestId("button-provider-reply-unavailable-reply-follow-up")).toHaveTextContent("Try another provider");

    fireEvent.click(screen.getByTestId("button-provider-reply-follow-up-reply-follow-up"));

    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Follow-up prepared in chat.");
  });

  it("honors Home provider follow-up route intent inside the existing provider panel", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-route-follow-up",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "reply-route-follow-up",
          mode: "follow_up",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-concierge-provider-reply")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Follow-up prepared in chat.");
    });
  });

  it("honors Home provider reply route intent by opening the reply form", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-route-confirmed",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "VYVA is waiting for the taxi provider reply.",
            action_payload: {
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([{
      pathname: "/concierge",
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "reply-route-confirmed",
          mode: "reply",
        },
      },
    }]);

    expect(await screen.findByTestId("panel-provider-reply-confirmed-reply-route-confirmed")).toBeInTheDocument();
  });

  it("opens a replacement transport search when a provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-ride",
            use_case: "book_ride",
            provider_name: "Radio Taxi",
            provider_phone: "+34 612 345 678",
            action_summary: "Taxi provider could not take the booking.",
            action_payload: {
              pickup_address: "Saved home",
              destination_address: "City Clinic",
              requested_time: "tomorrow 09:00",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-ride"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const transportQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(transportQuery).toContain("Find another transport option");
    expect(transportQuery).toContain("Destination: City Clinic");
    expect(transportQuery).toContain("Pickup: Saved home");
    expect(transportQuery).toContain("Time: tomorrow 09:00");
    expect(transportQuery).toContain("Avoid this provider: Radio Taxi");
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("Soon");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Transport search prepared with the same details.");
  });

  it("opens a replacement pharmacy search when an OTC provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-otc",
            use_case: "order_medicine",
            provider_name: "Neighborhood Pharmacy",
            provider_phone: "+34 600 333 444",
            action_summary: "Pharmacy cannot supply the requested OTC item.",
            action_payload: {
              item_text: "Vitamin D",
              fulfillment_preference: "pickup",
              requested_time: "tomorrow",
              notes: "Same brand",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-otc"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const pharmacyQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(pharmacyQuery).toContain("Find another pharmacy");
    expect(pharmacyQuery).toContain("Item: Vitamin D");
    expect(pharmacyQuery).toContain("Preference: pickup");
    expect(pharmacyQuery).toContain("Avoid this provider: Neighborhood Pharmacy");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Pharmacy search prepared with the original item.");
  });

  it("opens a replacement home-service search when a provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-home-service",
            use_case: "book_appointment",
            provider_name: "Saved Plumber",
            provider_phone: "+34 600 222 333",
            action_summary: "Plumber is not available tomorrow.",
            action_payload: {
              appointment_type: "home-service",
              service_type: "plumber",
              problem_summary: "Leak under the kitchen sink",
              urgency: "tomorrow",
              location: "Home kitchen",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-home-service"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const homeServiceQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(homeServiceQuery).toContain("Find another home-service provider");
    expect(homeServiceQuery).toContain("Type: plumber");
    expect(homeServiceQuery).toContain("Problem: Leak under the kitchen sink");
    expect(homeServiceQuery).toContain("Avoid this provider: Saved Plumber");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Home-service search prepared with the original problem.");
  });

  it("opens a replacement appointment search when a provider is unavailable", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-unavailable-appointment",
            use_case: "book_appointment",
            provider_name: "Clinica Lopez",
            provider_phone: "+34 600 111 222",
            action_summary: "Clinic cannot offer the requested slot.",
            action_payload: {
              appointment_type: "medical",
              appointment_reason: "dermatology follow-up",
              requested_time: "next Tuesday morning",
              location: "Marbella",
              mission_status: "awaiting_provider_reply",
            },
            status: "calling",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-unavailable-reply-unavailable-appointment"));

    expect(await screen.findByTestId("panel-provider-search-criteria")).toHaveTextContent("What matters most");
    const appointmentQuery = (screen.getByTestId("input-offers-query") as HTMLInputElement).value;
    expect(appointmentQuery).toContain("Find another doctor or clinic");
    expect(appointmentQuery).toContain("Type: medical");
    expect(appointmentQuery).toContain("Reason: dermatology follow-up");
    expect(appointmentQuery).toContain("Preferred time: next Tuesday morning");
    expect(appointmentQuery).toContain("Area: Marbella");
    expect(appointmentQuery).toContain("Avoid this provider: Clinica Lopez");
    expect(screen.getByTestId("panel-provider-search-criteria")).toHaveTextContent("Coverage");
    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Alternative appointment search prepared.");
  });

  it("keeps provider questions inside VYVA when more information is needed", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).endsWith("/api/concierge/actions/pending")) {
        return jsonResponse({
          items: [{
            id: "reply-more-info",
            use_case: "book_appointment",
            provider_name: "Clinic desk",
            provider_phone: null,
            action_summary: "Clinic needs one more detail before confirming.",
            action_payload: {
              appointment_type: "medical",
              mission_status: "awaiting_provider_reply",
              execution_channel: "manual",
            },
            status: "pending",
            language: "en",
          }],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    fireEvent.click(await screen.findByTestId("button-provider-reply-more-info-reply-more-info"));
    fireEvent.change(screen.getByTestId("input-provider-reply-question-reply-more-info"), {
      target: { value: "Do they need fasting before the blood test?" },
    });
    fireEvent.click(screen.getByTestId("button-provider-reply-ask-reply-more-info"));

    expect(screen.getByTestId("provider-reply-notice")).toHaveTextContent("Question added to chat.");
  });

  it("renders prepared email actions as draft mail links", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "email-1",
        use_case: "send_message",
        provider_name: "Clinic desk",
        provider_phone: null,
        action_summary: "Email draft prepared for the clinic.",
        action_payload: {
          execution_channel: "email",
          provider_email: "clinic@example.com",
          email_subject: "Question about my appointment",
          email_body: "Hello, I would like to confirm my appointment details.",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const emailLink = await screen.findByTestId("link-concierge-email-email-1");
    expect(emailLink).toHaveAttribute(
      "href",
      "mailto:clinic@example.com?subject=Question%20about%20my%20appointment&body=Hello%2C%20I%20would%20like%20to%20confirm%20my%20appointment%20details.",
    );
    expect(screen.getByTestId("button-concierge-confirm-email-1")).toHaveTextContent("Open email draft");
  });

  it("renders prepared WhatsApp actions as draft message links", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "whatsapp-1",
        use_case: "send_message",
        provider_name: "Care coordinator",
        provider_phone: "+34 611 222 333",
        action_summary: "WhatsApp draft prepared for the care coordinator.",
        action_payload: {
          preferred_channel: "whatsapp",
          whatsapp_message: "Hello, can we confirm the visit time?",
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    const whatsAppLink = await screen.findByTestId("link-concierge-whatsapp-whatsapp-1");
    expect(whatsAppLink).toHaveAttribute(
      "href",
      "https://wa.me/34611222333?text=Hello%2C%20can%20we%20confirm%20the%20visit%20time%3F",
    );
    expect(screen.getByTestId("button-concierge-confirm-whatsapp-1")).toHaveTextContent("Open WhatsApp draft");
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
    expect(screen.getByTestId("panel-concierge-action-timeline")).toHaveTextContent("Request started");
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Add missing details");
    expect(screen.getByTestId("timeline-step-requested")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("timeline-step-waiting")).toHaveAttribute("data-state", "upcoming");
    expect(await screen.findByTestId("panel-concierge-form-plan")).toHaveTextContent("System: TheFork");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Needs first: number of guests");
    expect(screen.getAllByText("Add missing details").length).toBeGreaterThan(0);
  });

  it("shows booking forms as ready to open when no details are missing", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({
      items: [{
        id: "form-ready-1",
        use_case: "book_appointment",
        provider_name: "The Good Table",
        provider_phone: null,
        action_summary: "Booking form ready for The Good Table.",
        action_payload: {
          mission_status: "form_in_progress",
          preferred_channel: "booking_url",
          execution_channel: "booking_url",
          booking_url: "https://www.thefork.es/restaurante/example",
          form_automation_plan: {
            adapter_label: "TheFork",
            missing_fields: [],
            next_step: "Use the supported booking page with the gathered details.",
            prefilled_url: "https://www.thefork.es/restaurante/example?date=tomorrow",
          },
        },
        status: "pending",
        language: "en",
      }],
    }));

    renderScreen();

    expect(await screen.findByTestId("panel-concierge-appointment-mission")).toHaveTextContent("Form ready");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent("Ready to open with the gathered details.");
    expect(screen.queryByText("VYVA is handling it")).not.toBeInTheDocument();
    expect(screen.getByTestId("link-concierge-form-form-ready-1")).toHaveAttribute(
      "href",
      "https://www.thefork.es/restaurante/example?date=tomorrow",
    );
    expect(screen.getByTestId("panel-concierge-next-action")).toHaveTextContent("Open appointment form");
    expect(screen.getByTestId("button-concierge-confirm-form-ready-1")).toHaveTextContent("Open appointment form");
  });
});
