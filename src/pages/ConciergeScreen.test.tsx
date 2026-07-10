import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConciergeScreen from "./ConciergeScreen";
import { apiFetch } from "@/lib/queryClient";

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
  default: (props: {
    autoStartVoice?: boolean | string;
    sourceText?: ReactNode;
    headline?: ReactNode;
    subtitle?: ReactNode;
    voiceAgentSlug?: string;
  }) => {
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
      return typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
        ? String(value)
        : "";
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
const APPOINTMENT_MISSION_GUIDE_STORAGE_KEY =
  "vyva_concierge_appointment_mission_guide_hidden_v1";
const HOME_SERVICE_GUIDE_STORAGE_KEY =
  "vyva_concierge_home_service_guide_hidden_v1";

async function dismissAppointmentGuide() {
  fireEvent.click(
    await screen.findByTestId("button-appointment-mission-understood"),
  );
  await waitFor(() => {
    expect(
      screen.queryByTestId("modal-appointment-mission"),
    ).not.toBeInTheDocument();
  });
}

async function dismissHomeServiceGuide() {
  fireEvent.click(
    await screen.findByTestId("button-home-service-guide-understood"),
  );
  await waitFor(() => {
    expect(
      screen.queryByTestId("modal-home-service-guide"),
    ).not.toBeInTheDocument();
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

function renderScreen(
  initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = [
    "/concierge",
  ],
) {
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

async function completeRideGuideWithSimpleChoices() {
  const guide = await screen.findByTestId("guided-action-concierge.book_ride");
  expect(guide).toHaveTextContent("Where are you going?");

  fireEvent.click(
    screen.getByTestId("guided-action-choice-destination-doctor"),
  );
  expect(await screen.findByText("Where should we pick you up?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-pickup-saved_home"));
  expect(await screen.findByText("When do you need to go?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-time-later_today"));
  expect(await screen.findByText("Any help getting in or out?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-mobility-none"));
  fireEvent.click(screen.getByTestId("guided-action-next-mobility"));

  await waitFor(() => {
    expect(
      screen.getByTestId("guided-action-concierge.book_ride"),
    ).toHaveTextContent("Ride details ready");
  });
}

async function completeRideGuideWithSavedMobility() {
  const guide = await screen.findByTestId("guided-action-concierge.book_ride");
  expect(guide).toHaveTextContent("Where are you going?");

  fireEvent.click(
    screen.getByTestId("guided-action-choice-destination-doctor"),
  );
  expect(await screen.findByText("Where should we pick you up?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-pickup-saved_home"));
  expect(await screen.findByText("When do you need to go?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-time-later_today"));

  await waitFor(() => {
    expect(
      screen.getByTestId("guided-action-concierge.book_ride"),
    ).toHaveTextContent("Ride details ready");
  });
  expect(
    screen.queryByText("Any help getting in or out?"),
  ).not.toBeInTheDocument();
}

async function completeMedicalAppointmentGuideWithSimpleChoices() {
  const guide = await screen.findByTestId(
    "guided-action-concierge.book_medical_appointment",
  );
  expect(guide).toHaveTextContent("What kind of care do you need?");

  fireEvent.click(screen.getByTestId("guided-action-choice-need-specialist"));
  expect(await screen.findByText("What is this for?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-reason-symptom"));
  expect(
    await screen.findByText("Which provider should VYVA try first?"),
  ).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-provider-saved"));
  expect(await screen.findByText("When would you like it?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-timing-this_week"));
  expect(await screen.findByText("How should VYVA handle it?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-contact-ask_vyva"));

  await waitFor(() => {
    expect(
      screen.getByTestId("guided-action-concierge.book_medical_appointment"),
    ).toHaveTextContent("Appointment request ready");
  });
}

async function completeMedicationHelpOtcWithoutSavedPharmacy() {
  const guide = await screen.findByTestId(
    "guided-action-health.medication_help",
  );
  expect(guide).toHaveTextContent("What do you need help with?");

  fireEvent.click(screen.getByTestId("guided-action-choice-need-refill"));
  expect(
    await screen.findByText("Which medicine is this about?"),
  ).toBeVisible();

  fireEvent.click(
    screen.getByTestId("guided-action-choice-medicine-saved_medicine"),
  );
  expect(
    await screen.findByText("Use your saved pharmacy?"),
  ).toBeVisible();
  expect(
    await screen.findByTestId("panel-medication-guided-pharmacy-note"),
  ).toHaveTextContent("needs a saved pharmacy");

  fireEvent.click(
    screen.getByTestId("guided-action-choice-pharmacy-setup_pharmacy_first"),
  );
  expect(await screen.findByText("How soon do you need help?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-urgency-routine"));
  expect(await screen.findByText("What should VYVA prepare?")).toBeVisible();

  fireEvent.click(
    screen.getByTestId("guided-action-choice-next_step-ask_vyva"),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId("guided-action-health.medication_help"),
    ).toHaveTextContent("Medication request ready");
  });
}

async function completeMedicationHelpOtcWithSavedPharmacy() {
  const guide = await screen.findByTestId(
    "guided-action-health.medication_help",
  );
  expect(guide).toHaveTextContent("What do you need help with?");

  fireEvent.click(screen.getByTestId("guided-action-choice-need-refill"));
  expect(
    await screen.findByText("Which medicine is this about?"),
  ).toBeVisible();

  fireEvent.click(
    screen.getByTestId("guided-action-choice-medicine-saved_medicine"),
  );
  expect(
    await screen.findByText("Use your saved pharmacy?"),
  ).toBeVisible();
  expect(
    await screen.findByTestId("panel-medication-guided-pharmacy-note"),
  ).toHaveTextContent("Farmacia Central");

  fireEvent.click(
    screen.getByTestId("guided-action-choice-pharmacy-usual_pharmacy"),
  );
  expect(await screen.findByText("How soon do you need help?")).toBeVisible();

  fireEvent.click(screen.getByTestId("guided-action-choice-urgency-routine"));
  expect(await screen.findByText("What should VYVA prepare?")).toBeVisible();

  fireEvent.click(
    screen.getByTestId("guided-action-choice-next_step-call_pharmacy"),
  );

  await waitFor(() => {
    expect(
      screen.getByTestId("guided-action-health.medication_help"),
    ).toHaveTextContent("Medication request ready");
  });
}

afterEach(() => {
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

    expect(await screen.findByTestId("concierge-guided-hub")).toBeVisible();
    expect(screen.getByTestId("concierge-fast-help")).toBeVisible();
    expect(screen.getByTestId("voice-hero")).toHaveTextContent(
      "What do you need done?",
    );
    expect(screen.getByTestId("voice-hero")).toHaveTextContent(
      "VYVA compares options and asks before booking, ordering, or contacting anyone.",
    );
    expect(voiceHeroMock).toHaveBeenCalledWith(
      expect.objectContaining({
        autoStartVoice: false,
        voiceAgentSlug: "concierge",
      }),
    );
    expect(screen.getByTestId("concierge-guided-hub")).not.toHaveTextContent(
      "Shop",
    );
    for (const label of [
      "Home Care",
      "Personal Care",
      "Order In",
      "Book Now",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    expect(
      screen.queryByTestId("concierge-standalone-help"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Plan a Trip" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Find Events" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("button-concierge-card-service")).not.toHaveClass(
      "bg-vyva-purple",
    );
    for (const key of ["service", "ride", "delivery", "appointment"]) {
      const card = screen.getByTestId(`button-concierge-card-${key}`);
      expect(card).toHaveClass("min-h-[160px]");
      expect(card).toHaveClass("rounded-[28px]");
      expect(card).toHaveClass("bg-[#FFFCF8]");
      expect(card).not.toHaveClass("rounded-[22px]");
      expect(card).not.toHaveClass("min-h-[104px]");
    }
    expect(screen.getByTestId("concierge-guided-hub")).toHaveTextContent(
      "Groceries, household, prepared meals",
    );
    expect(screen.getByTestId("concierge-fast-help")).toHaveTextContent(
      "Fast help",
    );
    expect(
      screen.getByTestId("button-concierge-fast-safe-home"),
    ).toHaveTextContent("Safe Home");
    expect(
      screen.getByTestId("button-concierge-fast-paperwork"),
    ).toHaveTextContent("Paperwork Help");
    expect(
      screen.getByTestId("button-concierge-fast-find-plumber"),
    ).toHaveTextContent("Find Plumber");
    expect(
      screen.getByTestId("button-concierge-fast-book-ride"),
    ).toHaveTextContent("Book Ride");
    expect(
      screen.getByTestId("button-concierge-fast-order-groceries"),
    ).toHaveTextContent("Order Groceries");
    expect(
      screen.getByTestId("button-concierge-fast-find-specialist"),
    ).toHaveTextContent("Find Specialist");
    expect(
      screen.getByTestId("button-concierge-fast-find-residence"),
    ).toHaveTextContent("Find Residence");
    expect(
      screen.getByTestId("button-concierge-fast-book-medical"),
    ).toHaveTextContent("Book Medical");
    expect(
      screen.getByTestId("button-concierge-fast-government-help"),
    ).toHaveTextContent("Government Help");
    expect(
      screen.getByTestId("button-concierge-fast-prepared-meals"),
    ).toHaveTextContent("Prepared Meals");
    expect(
      screen.queryByTestId("button-concierge-fast-best-deal"),
    ).not.toBeInTheDocument();
  });

  it("routes delivery through the shopping helper", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-delivery"),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/concierge/shopping",
      );
      expect(screen.getByTestId("route-state")).toHaveTextContent(
        '"category":"groceries"',
      );
      expect(screen.getByTestId("route-state")).toHaveTextContent('"delivery"');
      expect(screen.getByTestId("route-state")).toHaveTextContent(
        '"simplicity"',
      );
      expect(screen.getByTestId("route-state")).toHaveTextContent('"safety"');
    });
  });

  it("opens appointment, service, and prepared request flows in place", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent(
      "Schedule an appointment",
    );
    expect(
      await screen.findByTestId("modal-appointment-mission"),
    ).toBeVisible();
    expect(screen.getByTestId("panel-appointment-mission")).toHaveTextContent(
      "Appointment mission",
    );
    for (const label of [
      "Medical",
      "Personal care",
      "Government",
      "Home service",
      "Social or restaurant",
    ]) {
      expect(screen.getByRole("button", { name: label })).toBeVisible();
    }
    await dismissAppointmentGuide();

    fireEvent.click(screen.getByTestId("button-concierge-card-service"));
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent(
      "Find home service",
    );
    expect(
      screen.getByTestId("button-appointment-start-home-service"),
    ).toHaveTextContent("Find trusted options");
    await dismissHomeServiceGuide();

    fireEvent.click(screen.getByTestId("button-concierge-fast-paperwork"));
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("paperwork, forms, letters, documents, or bills");
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("Nothing is booked");

    fireEvent.click(screen.getByTestId("button-concierge-fast-book-ride"));
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("Transport options");
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("Where are you going?");
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("Nothing is booked");

    fireEvent.click(
      screen.getByTestId("button-concierge-fast-government-help"),
    );
    expect(
      screen.getByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("government task");
  });

  it("routes Safe Home from Concierge Fast Help", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-fast-safe-home"),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/safe-home",
      );
    });
  });

  it("shows the appointment mission as a one-time popup with a saved hide option", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );

    expect(
      await screen.findByTestId("modal-appointment-mission"),
    ).toBeVisible();
    expect(screen.getByTestId("panel-appointment-mission")).toHaveTextContent(
      "Appointment mission",
    );

    fireEvent.click(
      screen.getByTestId("button-appointment-mission-understood"),
    );
    await waitFor(() => {
      expect(
        screen.queryByTestId("modal-appointment-mission"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByTestId("button-appointment-open-mission-guide"),
    ).toBeVisible();

    fireEvent.click(
      screen.getByTestId("button-appointment-open-mission-guide"),
    );
    expect(
      await screen.findByTestId("modal-appointment-mission"),
    ).toBeVisible();
    fireEvent.click(screen.getByTestId("checkbox-appointment-mission-never"));
    fireEvent.click(
      screen.getByTestId("button-appointment-mission-understood"),
    );

    await waitFor(() => {
      expect(
        screen.queryByTestId("modal-appointment-mission"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("button-appointment-open-mission-guide"),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(APPOINTMENT_MISSION_GUIDE_STORAGE_KEY)).toBe(
      "true",
    );
  });

  it("shows the home service guide as a one-time popup with a saved hide option", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));

    expect(await screen.findByTestId("modal-home-service-guide")).toBeVisible();
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent(
      "Saved list checked",
    );
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent(
      "Trusted search",
    );
    expect(screen.getByTestId("panel-home-service-guide")).toHaveTextContent(
      "You confirm",
    );

    fireEvent.click(screen.getByTestId("button-home-service-guide-understood"));
    await waitFor(() => {
      expect(
        screen.queryByTestId("modal-home-service-guide"),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("button-home-service-open-guide")).toBeVisible();

    fireEvent.click(screen.getByTestId("button-home-service-open-guide"));
    expect(await screen.findByTestId("modal-home-service-guide")).toBeVisible();
    fireEvent.click(screen.getByTestId("checkbox-home-service-guide-never"));
    fireEvent.click(screen.getByTestId("button-home-service-guide-understood"));

    await waitFor(() => {
      expect(
        screen.queryByTestId("modal-home-service-guide"),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("button-home-service-open-guide"),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(HOME_SERVICE_GUIDE_STORAGE_KEY)).toBe("true");
  });

  it("creates an appointment request and asks VYVA to handle the saved provider before booking", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (
        String(url).includes(
          "/api/appointments/requests/request-1/confirm-attempt",
        )
      ) {
        expect(JSON.parse(String(init?.body))).toEqual({
          option_id: "option-1",
          channel: "phone",
        });
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
          options: [
            {
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
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.change(
      screen.getByPlaceholderText(
        "E.g. dermatology, Tuesday morning, WhatsApp if possible",
      ),
      {
        target: { value: "dermatology" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(
      await screen.findByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Clinica Lopez");
    fireEvent.click(
      screen.getByTestId("button-appointment-open-mission-guide"),
    );
    expect(screen.getByTestId("panel-appointment-mission")).toHaveTextContent(
      "VYVA chooses the safe path",
    );
    await dismissAppointmentGuide();
    expect(
      screen.getByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Ask VYVA to handle this");
    expect(
      screen.getByTestId("panel-appointment-confirmation-checkpoint"),
    ).toHaveTextContent("Confirm before VYVA acts");
    expect(
      screen.getByTestId("panel-appointment-confirmation-checkpoint"),
    ).toHaveTextContent("Insurance: not saved yet");
    expect(
      screen.queryByTestId("button-appointment-channel-phone"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(
      await screen.findByTestId("panel-appointment-mark-booked"),
    ).toHaveTextContent("When it is confirmed");
    fireEvent.click(
      screen.getByTestId("button-appointment-open-mission-guide"),
    );
    expect(
      screen.getByTestId("panel-appointment-live-controls"),
    ).toHaveTextContent("VYVA is calling");
    fireEvent.click(screen.getByTestId("button-appointment-call-mute"));
    expect(screen.getByTestId("panel-appointment-mission")).toHaveTextContent(
      "Muted",
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/appointments/requests",
      expect.objectContaining({ method: "POST" }),
    );
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/appointments/requests/request-1/confirm-attempt",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends appointment email through VYVA before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (
        target.includes(
          "/api/appointments/requests/request-email/confirm-attempt",
        )
      ) {
        expect(JSON.parse(String(init?.body))).toEqual({
          option_id: "option-email",
          channel: "email",
        });
        return jsonResponse({
          attempt: {
            id: "attempt-email",
            channel: "email",
            status: "email_sent",
          },
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
          options: [
            {
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
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(
      await screen.findByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Clinica Email");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(
      await screen.findByTestId("panel-appointment-mark-booked"),
    ).toHaveTextContent("When it is confirmed");
    expect(
      screen.getByText(
        "VYVA sent the message. Save the appointment when they reply.",
      ),
    ).toBeVisible();
  });

  it("shows VYVA-handled booking form status before booking is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (
        target.includes(
          "/api/appointments/requests/request-form/confirm-attempt",
        )
      ) {
        expect(JSON.parse(String(init?.body))).toEqual({
          option_id: "option-form",
          channel: "booking_url",
        });
        return jsonResponse({
          attempt: {
            id: "attempt-form",
            channel: "booking_url",
            status: "form_task_queued",
          },
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
          options: [
            {
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
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(
      await screen.findByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Clinica Form");
    fireEvent.click(screen.getByTestId("button-appointment-handle-provider"));

    expect(
      await screen.findByTestId("panel-appointment-mark-booked"),
    ).toHaveTextContent("When it is confirmed");
    expect(
      screen.getByText(
        "VYVA has the booking form task. Save the appointment once confirmed.",
      ),
    ).toBeVisible();
  });

  it("updates the active appointment mission from user voice or chat edits", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.change(
      screen.getByPlaceholderText(
        "E.g. dermatology, Tuesday morning, WhatsApp if possible",
      ),
      {
        target: {
          value: "Prefer Tuesday morning and ask about wheelchair access",
        },
      },
    );
    fireEvent.click(
      screen.getByTestId("button-appointment-open-mission-guide"),
    );
    fireEvent.click(screen.getByTestId("button-appointment-apply-edit"));

    expect(screen.getByTestId("panel-appointment-mission")).toHaveTextContent(
      "User edit: Prefer Tuesday morning",
    );
    expect(
      screen.getByDisplayValue(
        "Prefer Tuesday morning and ask about wheelchair access",
      ),
    ).toBeVisible();
  });

  it("discovers external appointment options inside the request flow", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (
        target.includes("/api/appointments/requests/request-2/discover-options")
      ) {
        return jsonResponse({
          request: {
            id: "request-2",
            appointment_type: "medical",
            reason_detail: "dermatology",
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [
            {
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
            },
          ],
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
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.change(
      screen.getByPlaceholderText(
        "E.g. dermatology, Tuesday morning, WhatsApp if possible",
      ),
      {
        target: { value: "dermatology" },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));

    expect(
      await screen.findByText("No saved provider for this yet."),
    ).toBeVisible();
    fireEvent.click(screen.getByTestId("button-appointment-discover-options"));

    expect(
      await screen.findByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Marbella Dermatology Centre");
    expect(
      screen.getByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent(
      "Confirm before VYVA acts",
    );
    expect(
      screen.getByTestId("panel-appointment-confirmation-checkpoint"),
    ).toHaveTextContent("Contact route: VYVA fills form");
    expect(
      screen.getByTestId("button-appointment-handle-provider"),
    ).toHaveTextContent("Ask VYVA to handle this");
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/appointments/requests/request-2/discover-options",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows reservation-system fallbacks when external provider discovery has no result", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      const target = String(url);
      if (
        target.includes("/api/appointments/requests/request-3/discover-options")
      ) {
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
              {
                name: "Doctoralia",
                category: "medical_marketplace",
                url: "https://www.google.com/search?q=doctoralia",
              },
              {
                name: "Top Doctors",
                category: "medical_marketplace",
                url: "https://www.google.com/search?q=topdoctors",
              },
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
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.click(screen.getByRole("button", { name: "Medical" }));
    fireEvent.click(
      await screen.findByTestId("button-appointment-discover-options"),
    );

    expect(
      await screen.findByTestId("panel-appointment-booking-sites"),
    ).toHaveTextContent("Doctoralia");
    expect(
      screen.getByTestId("panel-appointment-booking-sites"),
    ).toHaveTextContent("Top Doctors");
  });

  it("collects plumber intake, stores app origin, and automatically searches when no saved provider exists", async () => {
    let createdBody: Record<string, any> | null = null;
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (
        target.includes(
          "/api/appointments/requests/request-home-service/discover-options",
        )
      ) {
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
          options: [
            {
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
            },
          ],
          discovery: { source: "google_places", inserted_count: 1 },
        });
      }
      if (target.endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        createdBody = body;
        expect(body.appointment_type).toBe("home-service");
        expect(body.detail).toContain("Plumber needed");
        expect(body.detail).toContain("Leak");
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
        expect(body.preferences.service_intake.safety_flags).toContain(
          "active_water_damage",
        );
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

    expect(
      await screen.findByTestId("panel-appointment-assistant"),
    ).toHaveTextContent("Find home service");
    expect(
      screen.queryByTestId("panel-appointment-home-service-summary"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("panel-home-service-intake")).toBeVisible();
    expect(
      screen.getByTestId("button-appointment-start-home-service"),
    ).toHaveTextContent("Find trusted options");
    expect(
      screen.getByTestId("button-appointment-start-home-service"),
    ).toBeDisabled();

    fireEvent.click(screen.getByTestId("button-home-service-type-plumber"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.change(screen.getByPlaceholderText(/water leaking/i), {
      target: { value: "Water leaking under the kitchen sink" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-leak"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-yes"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-kitchen"));
    fireEvent.click(
      screen.getByTestId("button-home-service-answer-cannot_find"),
    );
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));
    fireEvent.change(screen.getByPlaceholderText(/Door code/i), {
      target: { value: "Lift available; caregiver can open the door" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent(
      "Ready",
    );
    expect(
      screen.getByTestId("button-appointment-start-home-service"),
    ).not.toBeDisabled();
    fireEvent.click(
      screen.getByTestId("button-appointment-start-home-service"),
    );

    expect(await screen.findByText("Marbella Rapid Plumbing")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/appointments/requests/request-home-service/discover-options",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("asks electrician-specific questions instead of plumbing questions", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-electrician"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-today"));
    fireEvent.change(screen.getByPlaceholderText(/water leaking/i), {
      target: { value: "The lights keep going out in the bedroom" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "What kind of electrical issue?",
    );
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "Breaker trips",
    );
    expect(
      screen.getByTestId("panel-home-service-question"),
    ).not.toHaveTextContent("Blocked drain");
  });

  it("asks other service users what service they need before urgency", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-service"));
    await dismissHomeServiceGuide();
    fireEvent.click(screen.getByTestId("button-home-service-type-other"));

    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "What service do you need?",
    );
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "Next step",
    );
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "Step 1 of 5",
    );
    expect(
      screen.getByTestId("panel-home-service-question"),
    ).not.toHaveTextContent("How urgent is it?");
    fireEvent.change(screen.getByPlaceholderText(/gardener/i), {
      target: { value: "Pest control" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));

    expect(screen.getByTestId("panel-home-service-intake")).toHaveTextContent(
      "Pest control",
    );
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "How urgent is it?",
    );
    expect(screen.getByTestId("panel-home-service-question")).toHaveTextContent(
      "Step 2 of 5",
    );
  });

  it("prepares a Concierge request instead of showing raw feature-access errors for home service", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      const target = String(url);
      if (target.endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.appointment_type).toBe("home-service");
        expect(body.detail).toContain("Pest control needed");
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
    fireEvent.change(screen.getByPlaceholderText(/water leaking/i), {
      target: { value: "Wasps are near the front door" },
    });
    fireEvent.click(screen.getByTestId("button-home-service-answer-next"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-trusted"));
    fireEvent.click(screen.getByTestId("button-home-service-answer-skip"));

    expect(screen.getByTestId("panel-home-service-ready")).toHaveTextContent(
      "Ready",
    );
    fireEvent.click(
      screen.getByTestId("button-appointment-start-home-service"),
    );

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Key details");
    expect(prefill).toHaveTextContent("Need");
    expect(prefill).toHaveTextContent("Pest control needed");
    expect(prefill).toHaveTextContent("Urgency");
    expect(prefill).toHaveTextContent("Today");
    expect(prefill).toHaveTextContent("Nothing is booked");
    expect(prefill).not.toHaveTextContent("provider search access");
    expect(prefill).not.toHaveTextContent("without my confirmation");
    expect(
      screen.queryByText("Could not verify feature access"),
    ).not.toBeInTheDocument();
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
    fireEvent.click(
      await screen.findByTestId("button-concierge-card-appointment"),
    );
    await dismissAppointmentGuide();
    fireEvent.change(
      screen.getByPlaceholderText(
        "E.g. dermatology, Tuesday morning, WhatsApp if possible",
      ),
      {
        target: {
          value: "Please help me schedule a passport renewal appointment",
        },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Government" }));

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Government");
    expect(prefill).toHaveTextContent("passport renewal");
    expect(prefill).toHaveTextContent("Nothing is booked");
    expect(prefill).not.toHaveTextContent("verify access");
    expect(
      screen.queryByText(
        "I could not verify access right now. Please try again.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Could not verify feature access"),
    ).not.toBeInTheDocument();
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
            problem_summary: "Water leaking under the kitchen sink",
            problem_type: "leak",
          }),
        });
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
          options: [
            {
              id: "option-saved-plumber",
              provider_id: "provider-1",
              provider_source: "saved",
              provider_snapshot: {
                name: "Saved Plumber",
                phone: "+34 600 222 333",
                preferred_channel: "phone",
              },
              match_reason: "Saved plumber provider",
              available_channels: ["phone", "manual"],
              rank: 1,
              status: "recommended",
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(
      await screen.findByTestId("panel-home-service-ready"),
    ).toHaveTextContent("Ready");
    fireEvent.click(
      screen.getByTestId("button-appointment-start-home-service"),
    );

    expect(await screen.findByText("Saved Plumber")).toBeVisible();
  });

  it("prepares personal care requests without booking", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen();
    fireEvent.click(await screen.findByTestId("button-concierge-card-ride"));

    await waitFor(() => {
      expect(
        screen.getByTestId("panel-concierge-route-prefill"),
      ).toHaveTextContent("personal care support");
      expect(
        screen.getByTestId("panel-concierge-route-prefill"),
      ).toHaveTextContent("specialist or residence");
      expect(
        screen.getByTestId("panel-concierge-route-prefill"),
      ).toHaveTextContent("Nothing is booked");
    });
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
            reason_detail:
              "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
            status: "needs_provider",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [],
        });
      }
      return jsonResponse({ items: [] });
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ response: "I can help with that." }));

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            message:
              "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
            source: "symptom_report",
          },
        },
      },
    ]);

    expect(
      await screen.findByTestId("panel-concierge-route-prefill"),
    ).toHaveTextContent("Appointment request ready");
    expect(screen.getByTestId("panel-appointment-assistant")).toHaveTextContent(
      "Schedule an appointment",
    );
    expect(
      screen.getByDisplayValue(
        "Please help me schedule care for chest discomfort. Ask me to confirm before booking.",
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const [, init] =
      apiFetchMock.mock.calls.find(([url]) =>
        String(url).includes("/api/appointments/requests"),
      ) ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.detail).toContain("Please help me schedule care");
    expect(body.language).toBe("en");
  });

  it("turns a daily check-in task handoff into a prepared concierge request", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ response: "I can prepare options." }));

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "task",
            message: "Please prepare an easy outing with transport if needed.",
            source: "daily_checkin",
          },
        },
      },
    ]);

    const prefill = await screen.findByTestId("panel-concierge-route-prefill");
    expect(prefill).toHaveTextContent("Review request");
    expect(prefill).toHaveTextContent("Please prepare an easy outing");

    fireEvent.click(screen.getByTestId("button-concierge-prefill-send"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/concierge",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.prompt).toContain("easy outing");
  });

  it("guides a medical appointment request and checks saved providers first", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.appointment_type).toBe("medical");
        expect(body.detail).toContain("Care needed: Specialist");
        expect(body.detail).toContain("Reason: New symptom");
        expect(body.detail).toContain("Provider: Saved doctor first");
        expect(body.detail).toContain("Timing: This week");
        expect(body.detail).toContain("Contact route: Let VYVA choose");
        expect(body.preferences.guided_flow).toBe(
          "concierge.book_medical_appointment",
        );
        expect(body.preferences.guided_answers).toMatchObject({
          need: "specialist",
          reason: "new_symptom",
          provider: "saved_provider",
          timing: "this_week",
          contact: "ask_vyva",
        });
        return jsonResponse({
          request: {
            id: "request-guided-medical",
            appointment_type: "medical",
            reason_detail: body.detail,
            status: "options_ready",
            selected_provider_option_id: null,
            selected_channel: null,
          },
          options: [
            {
              id: "option-saved-doctor",
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
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "concierge.book_medical_appointment",
            message: "Help me book a medical appointment.",
            source: "health_home_doctor",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    await completeMedicalAppointmentGuideWithSimpleChoices();
    fireEvent.click(screen.getByTestId("button-appointment-guided-start"));

    expect(
      await screen.findByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Clinica Lopez");
    expect(
      screen.getByTestId("panel-appointment-provider-options"),
    ).toHaveTextContent("Ask VYVA to handle this");
  });

  it("shows a safety note when the guided appointment reason is urgent", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "concierge.book_medical_appointment",
            message: "Help me book a medical appointment.",
            source: "health_home_doctor",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    fireEvent.click(
      await screen.findByTestId("guided-action-choice-need-doctor"),
    );
    fireEvent.click(screen.getByTestId("guided-action-choice-reason-urgent"));

    expect(
      await screen.findByTestId("panel-appointment-guided-urgent-note"),
    ).toHaveTextContent("use SOS or urgent care now");
  });

  it("blocks OTC pharmacy help until a pharmacy is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [],
          serviceReadiness: { hasSavedPharmacy: false },
        });
      }
      if (String(url).endsWith("/api/appointments/requests")) {
        throw new Error("OTC pharmacy help should not post without setup");
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "health.medication_help",
            message: "Help me with medication.",
            source: "medication_support",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    await completeMedicationHelpOtcWithoutSavedPharmacy();
    expect(screen.getByTestId("button-medication-guided-start")).toHaveTextContent(
      "Add saved pharmacy first",
    );
    fireEvent.click(screen.getByTestId("button-medication-guided-start"));

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent(
        "/onboarding/profile/providers",
      );
    });
    expect(
      apiFetchMock.mock.calls.some(
        ([url]) => String(url) === "/api/appointments/requests",
      ),
    ).toBe(false);
  });

  it("prepares OTC pharmacy help when a pharmacy is saved", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({
          savedProviders: [
            {
              name: "Farmacia Central",
              category: "pharmacy",
              role: "pharmacy",
            },
          ],
          serviceReadiness: { hasSavedPharmacy: true },
        });
      }
      if (String(url).endsWith("/api/appointments/requests")) {
        expect(init?.method).toBe("POST");
        const body = JSON.parse(String(init?.body));
        expect(body.appointment_type).toBe("medical");
        expect(body.detail).toContain("Need: OTC pharmacy item");
        expect(body.detail).toContain("Medicine: Saved medicine");
        expect(body.detail).toContain("Pharmacy: use the saved pharmacy only");
        expect(body.detail).toContain("Timing: Routine");
        expect(body.detail).toContain("Next step: Ask saved pharmacy");
        expect(body.detail).toContain("do not order prescription medication");
        expect(body.preferences.guided_flow).toBe("health.medication_help");
        expect(body.preferences.guided_answers).toMatchObject({
          need: "refill",
          medicine: "saved_medicine",
          pharmacy: "usual_pharmacy",
          urgency: "routine",
          next_step: "call_pharmacy",
        });
        expect(body.route_prefill_source).toBe("medication_support");
        return jsonResponse({
          request: {
            id: "request-medication-help",
            appointment_type: "medical",
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

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "health.medication_help",
            message: "Help me with medication.",
            source: "medication_support",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    await completeMedicationHelpOtcWithSavedPharmacy();
    fireEvent.click(screen.getByTestId("button-medication-guided-start"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("skips the pharmacy question when medication help is not a refill", async () => {
    apiFetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "health.medication_help",
            message: "Help me with medication.",
            source: "medication_support",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    fireEvent.click(
      await screen.findByTestId("guided-action-choice-need-schedule"),
    );
    fireEvent.click(
      screen.getByTestId("guided-action-choice-medicine-saved_medicine"),
    );

    expect(await screen.findByText("How soon do you need help?")).toBeVisible();
    expect(
      screen.queryByText("Use your saved pharmacy?"),
    ).not.toBeInTheDocument();
  });

  it("supports adding a new medicine without asking for pharmacy details", async () => {
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url) === "/api/appointments/requests") {
        const body = JSON.parse(String(init?.body));
        expect(body.appointment_type).toBe("medical");
        expect(body.detail).toContain("Need: Add medicine");
        expect(body.detail).toContain("Medicine: Vitamin D");
        expect(body.detail).toContain("Timing: Routine");
        expect(body.detail).toContain("Next step: Add reminder");
        expect(body.detail).not.toContain("Pharmacy:");
        expect(body.preferences.guided_flow).toBe("health.medication_help");
        expect(body.preferences.guided_answers).toMatchObject({
          need: "add_medicine",
          medicine: "Vitamin D",
          urgency: "routine",
          next_step: "add_reminder",
        });
        expect(body.route_prefill_source).toBe("medication_support");
        return jsonResponse({
          request: {
            id: "request-add-medicine",
            appointment_type: "medical",
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

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "appointment",
            guidedFlow: "health.medication_help",
            message: "Help me with medication.",
            source: "medication_support",
          },
        },
      },
    ]);

    await dismissAppointmentGuide();
    fireEvent.click(
      await screen.findByTestId("guided-action-choice-need-add_medicine"),
    );
    expect(
      await screen.findByText("Which medicine is this about?"),
    ).toBeVisible();

    fireEvent.change(screen.getByTestId("guided-action-text-medicine"), {
      target: { value: "Vitamin D" },
    });
    fireEvent.click(screen.getByTestId("guided-action-use-text-medicine"));

    expect(await screen.findByText("How soon do you need help?")).toBeVisible();
    expect(
      screen.queryByText("Use your saved pharmacy?"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("guided-action-choice-urgency-routine"));
    expect(await screen.findByText("What should VYVA prepare?")).toBeVisible();
    fireEvent.click(
      screen.getByTestId("guided-action-choice-next_step-add_reminder"),
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("guided-action-health.medication_help"),
      ).toHaveTextContent("Medication request ready");
    });

    fireEvent.click(screen.getByTestId("button-medication-guided-start"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/appointments/requests",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("guides a ride request and shows a saved transport provider first", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/transport/options") {
        return jsonResponse({
          options: [
            {
              id: "saved-radio-taxi",
              kind: "saved_provider",
              label: "Radio Taxi",
              description: "Saved trusted transport provider.",
              phone: "+34 612 345 678",
              url: null,
              actions: ["call", "start_concierge_action"],
            },
            {
              id: "ride-app",
              kind: "ride_app",
              label: "Ride app",
              description: "Open a ride app and compare before booking.",
              phone: null,
              url: "https://example.com/ride",
              actions: ["open_external"],
            },
          ],
          disclaimers: [
            "Compare first.",
            "Check price.",
            "Nothing is booked without your confirmation.",
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "ride",
            guidedFlow: "concierge.book_ride",
            message: "Help me book a ride.",
            source: "home_quick_action",
          },
        },
      },
    ]);

    await completeRideGuideWithSimpleChoices();
    expect(
      screen.getByTestId("button-transport-find-options"),
    ).toHaveTextContent("Compare safe rides");
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/transport/options",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] =
      apiFetchMock.mock.calls.find(
        ([url]) => String(url) === "/api/transport/options",
      ) ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.destination.address).toBe("Doctor or clinic");
    expect(body.pickup.address).toBe("Saved home");
    expect(body.requestedTime).toBe("later today");
    expect(body.mobilityNeeds).toEqual([]);

    expect(
      await screen.findByTestId("transport-provider-status"),
    ).toHaveTextContent("Saved transport provider found");
    expect(screen.getByTestId("transport-options-list")).toHaveTextContent(
      "Radio Taxi",
    );
    expect(screen.getByTestId("transport-options-list")).toHaveTextContent(
      "Ride app",
    );
  });

  it("skips the ride mobility question when mobility is already saved", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({ mobilityLevel: "Walker" });
      }
      if (String(url) === "/api/transport/options") {
        return jsonResponse({
          options: [
            {
              id: "saved-radio-taxi",
              kind: "saved_provider",
              label: "Radio Taxi",
              description: "Saved trusted transport provider.",
              phone: "+34 612 345 678",
              url: null,
              actions: ["call", "start_concierge_action"],
            },
          ],
          disclaimers: [
            "Compare first.",
            "Check price.",
            "Nothing is booked without your confirmation.",
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "ride",
            guidedFlow: "concierge.book_ride",
            message: "Help me book a ride.",
            source: "home_quick_action",
          },
        },
      },
    ]);

    await completeRideGuideWithSavedMobility();
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/transport/options",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] =
      apiFetchMock.mock.calls.find(
        ([url]) => String(url) === "/api/transport/options",
      ) ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.mobilityNeeds).toEqual(["Walker"]);
    expect(
      apiFetchMock.mock.calls.some(
        ([url]) => String(url) === "/api/profile/mobility",
      ),
    ).toBe(false);
  });

  it("asks ride mobility once when it is missing and saves the answer", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({ mobilityLevel: "" });
      }
      if (String(url) === "/api/profile/mobility") {
        return jsonResponse({ mobilityLevel: "Wheelchair" });
      }
      if (String(url) === "/api/transport/options") {
        return jsonResponse({
          options: [],
          disclaimers: [
            "Compare first.",
            "Check price.",
            "Nothing is booked without your confirmation.",
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "ride",
            guidedFlow: "concierge.book_ride",
            message: "Help me book a ride.",
            source: "home_quick_action",
          },
        },
      },
    ]);

    const guide = await screen.findByTestId(
      "guided-action-concierge.book_ride",
    );
    expect(guide).toHaveTextContent("Where are you going?");
    fireEvent.click(
      screen.getByTestId("guided-action-choice-destination-doctor"),
    );
    fireEvent.click(
      screen.getByTestId("guided-action-choice-pickup-saved_home"),
    );
    fireEvent.click(
      screen.getByTestId("guided-action-choice-time-later_today"),
    );

    expect(
      await screen.findByText("Any help getting in or out?"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByTestId("guided-action-choice-mobility-wheelchair"),
    );
    fireEvent.click(screen.getByTestId("guided-action-next-mobility"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/profile/mobility",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ mobilityLevel: "Wheelchair" }),
        }),
      );
    });

    fireEvent.click(screen.getByTestId("button-transport-find-options"));
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/transport/options",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, init] =
      apiFetchMock.mock.calls.find(
        ([url]) => String(url) === "/api/transport/options",
      ) ?? [];
    const body = JSON.parse(String(init?.body));
    expect(body.mobilityNeeds).toEqual(["Wheelchair"]);
  });

  it("guides a ride request when no saved transport provider exists", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/transport/options") {
        return jsonResponse({
          options: [
            {
              id: "open-ride-app",
              kind: "ride_app",
              label: "Open ride app",
              description: "Compare a ride app before booking.",
              phone: null,
              url: "https://example.com/ride",
              actions: ["open_external"],
            },
            {
              id: "manual-help",
              kind: "manual_request",
              label: "Ask VYVA to prepare it",
              description:
                "VYVA can prepare the request and ask before contacting anyone.",
              phone: null,
              url: null,
              actions: ["start_concierge_action"],
            },
          ],
          disclaimers: [
            "Compare first.",
            "Check price.",
            "Nothing is booked without your confirmation.",
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen([
      {
        pathname: "/concierge",
        state: {
          conciergePrefill: {
            kind: "ride",
            message: "Help me book a ride.",
            source: "home_quick_action",
          },
        },
      },
    ]);

    await completeRideGuideWithSimpleChoices();
    fireEvent.click(screen.getByTestId("button-transport-find-options"));

    expect(
      await screen.findByTestId("transport-provider-status"),
    ).toHaveTextContent("No saved transport provider found");
    expect(screen.getByTestId("transport-options-list")).toHaveTextContent(
      "Open ride app",
    );
    expect(screen.getByTestId("transport-options-list")).toHaveTextContent(
      "Ask VYVA to prepare it",
    );
  });

  it("renders prepared provider phone actions as direct call links", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({ mobilityLevel: "" });
      }
      if (String(url) === "/api/concierge/actions/pending") {
        return jsonResponse({
          items: [
            {
              id: "ride-1",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              provider_phone: "+34 612 345 678",
              action_summary:
                "Taxi option prepared for the health appointment.",
              action_payload: null,
              status: "pending",
              language: "en",
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    const callLink = await screen.findByRole("link", {
      name: "Call +34 612 345 678",
    });
    expect(callLink).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByText("Ready to confirm")).toBeVisible();
    expect(
      screen.getByTestId("button-concierge-confirm-ride-1"),
    ).toHaveTextContent("Confirm and call");
  });

  it("shows compact form plan details for VYVA-handled booking tasks", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url) === "/api/profile") {
        return jsonResponse({ mobilityLevel: "" });
      }
      if (String(url) === "/api/concierge/actions/pending") {
        return jsonResponse({
          items: [
            {
              id: "form-task-1",
              use_case: "book_appointment",
              provider_name: "The Good Table",
              provider_phone: null,
              action_summary:
                "VYVA will handle the booking form for The Good Table.",
              action_payload: {
                mission_status: "form_in_progress",
                preferred_channel: "booking_url",
                execution_channel: "booking_url",
                booking_url: "https://www.thefork.es/restaurante/example",
                form_automation_plan: {
                  adapter_label: "TheFork",
                  missing_fields: ["number of guests"],
                  next_step:
                    "Collect number of guests inside VYVA before using the external form.",
                },
              },
              status: "pending",
              language: "en",
            },
          ],
        });
      }
      return jsonResponse({ items: [] });
    });

    renderScreen();

    expect(await screen.findByText("In progress")).toBeVisible();
    expect(
      await screen.findByTestId("panel-concierge-appointment-mission"),
    ).toHaveTextContent("Preparing form");
    expect(
      screen.getByTestId("panel-concierge-appointment-mission"),
    ).toHaveTextContent("VYVA chooses the safe path");
    expect(
      await screen.findByTestId("panel-concierge-form-plan"),
    ).toHaveTextContent("System: TheFork");
    expect(screen.getByTestId("panel-concierge-form-plan")).toHaveTextContent(
      "Needs: number of guests",
    );
    expect(screen.getByText("VYVA is handling it")).toBeVisible();
  });
});
