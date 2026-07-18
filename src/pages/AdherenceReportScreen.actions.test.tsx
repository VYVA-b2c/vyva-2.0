import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdherenceReportScreen from "./AdherenceReportScreen";

const profileMock = vi.fn();
const queryResultMock = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: unknown) => queryResultMock(options),
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => profileMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: null,
    payloadValue: () => "",
  }),
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  const translations: Record<string, string | string[]> = {
    "meds.adherence.dayLabels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "meds.medicationSummaryFallback": "my medications",
    "meds.adherenceService.title": "Medication help in one tap",
    "meds.adherenceService.kicker": "Fast help",
    "meds.adherenceService.subtitle": "Refills, doctor contact, and appointment help are ready from this report.",
    "meds.adherenceService.refill": "Prepare refill",
    "meds.adherenceService.refillSub": "Find pharmacy or delivery options. You confirm before anything is ordered.",
    "meds.adherenceService.callGpSub": "Speak to your doctor with this report ready.",
    "meds.adherenceService.emailGpSub": "Open an email with the report context filled in.",
    "meds.adherenceService.doctorHelpSub": "Talk through missed doses, side effects, or medication worries.",
    "meds.adherenceService.appointment": "Medication appointment",
    "meds.adherenceService.appointmentSub": "VYVA prepares the appointment request for you to confirm.",
    "meds.adherenceService.appointmentPrefill": "Please help me schedule a medication review appointment. Medication report: {{summary}}. Needs attention: {{attention}}. Ask me to confirm before booking anything.",
    "meds.adherenceService.doctorNoteTitle": "VYVA medication adherence report",
    "meds.callGpNamed": "Call {{name}}",
    "meds.callGp": "Call GP",
    "meds.emailGp": "Email GP",
    "meds.doctorReview": "Doctor help",
    "meds.adherence.thisWeek": "This week",
    "meds.adherence.last30Days": "Last 30 days",
    "meds.adherence.todayTitle": "Today",
    "meds.adherence.todayNeedsAttention": "{{count}} medication still needs attention today.",
    "meds.adherence.todayAllCovered": "Everything scheduled for today has been covered.",
    "meds.adherence.attentionTitle": "Needs attention",
    "meds.adherence.attentionSubtitle": "This week, keep an eye on {{names}}.",
    "meds.adherence.shareAllOnTrack": "All current medications are on track this week.",
    "meds.adherence.perMedication": "Per Medication",
  };

  return {
    ...actual,
    useTranslation: () => ({
      i18n: { language: "en" },
      t: (key: string, fallbackOrOptions?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const raw = translations[key] ?? (typeof fallbackOrOptions === "string" ? fallbackOrOptions : key);
        if (Array.isArray(raw)) return raw;
        const interpolation = typeof fallbackOrOptions === "object" ? fallbackOrOptions : values;
        return raw.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(interpolation?.[token] ?? `{{${token}}}`));
      },
    }),
  };
});

const report = {
  hasLogs: true,
  weekPct: 74,
  monthPct: 82,
  sevenDayDates: [],
  perMedication: [
    {
      name: "Metformin",
      dosage: "500mg",
      taken: 5,
      scheduled: 7,
      streak: 2,
      dailyStatus: ["taken", "missed", "taken", "taken", "none", "taken", "missed"],
    },
    {
      name: "Atorvastatin",
      dosage: "20mg",
      taken: 7,
      scheduled: 7,
      streak: 7,
      dailyStatus: ["taken", "taken", "taken", "taken", "taken", "taken", "taken"],
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? {})}</div>
    </>
  );
}

function adherenceReportUi() {
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/meds/adherence-report"]}>
      <Routes>
        <Route path="/meds/adherence-report" element={<AdherenceReportScreen />} />
        <Route path="/concierge" element={<LocationProbe />} />
        <Route path="/concierge/shopping" element={<LocationProbe />} />
        <Route path="/health/doctor" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAdherenceReport() {
  return render(adherenceReportUi());
}

describe("Adherence report service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    profileMock.mockReturnValue({
      profile: {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
    });
    queryResultMock.mockImplementation((options: { queryKey?: string[] }) => ({
      data: options?.queryKey?.[0] === "/api/config/features/medication-refill-voice-canvas"
        ? { enabled: false, rolloutPercent: 0 }
        : report,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));
  });

  it("renders direct refill, GP contact, doctor help, and appointment actions", () => {
    renderAdherenceReport();

    expect(screen.getByTestId("panel-adherence-service-actions")).toHaveTextContent("Medication help in one tap");
    expect(screen.getByTestId("button-adherence-service-refill")).toBeInTheDocument();
    expect(screen.getByTestId("button-adherence-service-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-adherence-service-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-adherence-service-doctor-help")).toBeInTheDocument();
    expect(screen.getByTestId("button-adherence-service-appointment")).toBeInTheDocument();
  });

  it("prefills pharmacy delivery from the medication report", async () => {
    renderAdherenceReport();

    fireEvent.click(screen.getByTestId("button-adherence-service-refill"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge/shopping"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"pharmacy_basics\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Metformin, Atorvastatin");
  });

  it("opens the refill Canvas when its independent flag is enabled", async () => {
    queryResultMock.mockImplementation((options: { queryKey?: string[] }) => ({
      data: options?.queryKey?.[0] === "/api/config/features/medication-refill-voice-canvas"
        ? { enabled: true, rolloutPercent: 100 }
        : report,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));
    renderAdherenceReport();

    fireEvent.click(screen.getByTestId("button-adherence-service-refill"));

    expect(await screen.findByTestId("panel-medication-refill-voice-canvas")).toBeInTheDocument();
    expect(screen.getByTestId("refill-voice-canvas")).toHaveAttribute("data-step", "listening");
    expect(screen.queryByTestId("current-route")).not.toBeInTheDocument();
  });

  it("immediately closes the Canvas when the feature flag is disabled", async () => {
    let enabled = true;
    queryResultMock.mockImplementation((options: { queryKey?: string[] }) => ({
      data: options?.queryKey?.[0] === "/api/config/features/medication-refill-voice-canvas"
        ? { enabled, rolloutPercent: enabled ? 100 : 0 }
        : report,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
      error: null,
    }));
    const view = renderAdherenceReport();
    fireEvent.click(screen.getByTestId("button-adherence-service-refill"));
    expect(await screen.findByTestId("panel-medication-refill-voice-canvas")).toBeInTheDocument();

    enabled = false;
    view.rerender(adherenceReportUi());

    await waitFor(() => expect(screen.queryByTestId("panel-medication-refill-voice-canvas")).not.toBeInTheDocument());
  });

  it("prefills appointment and doctor voice help from the medication report", async () => {
    renderAdherenceReport();

    fireEvent.click(screen.getByTestId("button-adherence-service-appointment"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"adherence_report\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
  });
});
