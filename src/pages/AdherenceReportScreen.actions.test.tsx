import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdherenceReportScreen from "./AdherenceReportScreen";

const profileMock = vi.fn();
const queryResultMock = vi.fn();
const apiFetchMock = vi.fn();

vi.mock("@/lib/queryClient",async(importOriginal)=>{const actual=await importOriginal<typeof import("@/lib/queryClient")>();return{...actual,apiFetch:(...args:unknown[])=>apiFetchMock(...args)}});

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
    "meds.adherenceService.refill": "Check refill need",
    "meds.adherenceService.refillSub": "See estimated supply or update the quantity you have.",
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

function adherenceReportUi(initialEntries: ComponentProps<typeof MemoryRouter>["initialEntries"] = ["/meds/adherence-report"]) {
  return (
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={initialEntries}>
      <Routes>
        <Route path="/meds/adherence-report" element={<AdherenceReportScreen />} />
        <Route path="/meds/refills" element={<LocationProbe />} />
        <Route path="/concierge" element={<LocationProbe />} />
        <Route path="/concierge/shopping" element={<LocationProbe />} />
        <Route path="/health/doctor" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>
  );
}

function renderAdherenceReport(initialEntries?: ComponentProps<typeof MemoryRouter>["initialEntries"]) {
  return render(adherenceReportUi(initialEntries));
}

describe("Adherence report service actions", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({ok:true,json:async()=>({pendingId:"PREP-1"})});
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

  it("shows medication progress by default with weekly, monthly, quarterly, and custom filters", () => {
    renderAdherenceReport();

    const progressSection = screen.getByTestId("adherence-weekly-details");
    expect(progressSection.tagName).toBe("SECTION");
    expect(progressSection).toBeVisible();
    expect(screen.getByTestId("button-adherence-period-weekly")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("button-adherence-period-monthly")).toBeInTheDocument();
    expect(screen.getByTestId("button-adherence-period-quarterly")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-adherence-period-custom"));

    expect(screen.getByTestId("input-adherence-custom-start")).toBeVisible();
    expect(screen.getByTestId("input-adherence-custom-end")).toBeVisible();
  });

  it("renders direct refill, GP contact, doctor help, and appointment actions", () => {
    renderAdherenceReport();

    expect(screen.getByTestId("panel-adherence-service-actions")).toHaveTextContent("More medication help");
    expect(screen.getByTestId("panel-adherence-service-actions")).toHaveTextContent("Refills, doctor contact, and appointment help");
    expect(screen.getByTestId("button-adherence-service-refill")).toBeInTheDocument();
    expect(screen.getByTestId("button-adherence-service-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-adherence-service-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-adherence-service-doctor-help")).toBeInTheDocument();
    expect(screen.getByTestId("button-adherence-service-appointment")).toBeInTheDocument();
  });

  it("routes refill help to the dedicated inventory tracker", async () => {
    renderAdherenceReport();

    fireEvent.click(screen.getByTestId("button-adherence-service-refill"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/meds/refills"));
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.anything());
  });

  it("redirects legacy refill-resume links to the tracker without opening an ordering Canvas", async () => {
    renderAdherenceReport([{ pathname: "/meds/adherence-report", state: { resumeCanvas: "refill" } }]);
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/meds/refills"));
    expect(screen.queryByTestId("panel-medication-refill-voice-canvas")).not.toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalledWith("/api/concierge/actions/trigger", expect.anything());
  });

  it("prefills appointment and doctor voice help from the medication report", async () => {
    renderAdherenceReport();

    fireEvent.click(screen.getByTestId("button-adherence-service-appointment"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"adherence_report\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
  });
});
