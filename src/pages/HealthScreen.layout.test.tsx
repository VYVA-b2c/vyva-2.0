import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HealthScreen from "./HealthScreen";

const mocks = vi.hoisted(() => ({
  guardPath: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  stopDoctorVoice: vi.fn(),
  sendDoctorUserMessage: vi.fn(),
  voiceHero: vi.fn(),
  apiFetch: vi.fn(),
}));

const tMock = vi.hoisted(() => (key: string, fallback?: string, options?: Record<string, unknown>) =>
  Object.entries(options ?? {}).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
    fallback ?? key,
  ));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: tMock,
  }),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: {
      country: "ES",
      postalCode: "11380",
      cityState: "Tarifa",
    },
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  serviceForPath: () => undefined,
  useServiceGate: () => ({
    guardPath: mocks.guardPath,
    canUseService: () => true,
    readiness: { services: {} },
  }),
}));

vi.mock("@/hooks/useDoctorVoice", () => ({
  useDoctorVoice: () => ({
    stopDoctorVoice: mocks.stopDoctorVoice,
    status: "idle",
    isVoiceLive: false,
    isSpeaking: false,
    isConnecting: false,
    transcript: "",
    sendUserMessage: mocks.sendDoctorUserMessage,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { mobileTalkLabel?: string; voiceAgentSlug?: string }) => {
    mocks.voiceHero(props);
    return <div data-testid="voice-hero" data-mobile-talk-label={props.mobileTalkLabel ?? ""} />;
  },
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({
    label,
    testId,
    className,
    supportingLabel,
    visual,
  }: {
    label?: string;
    testId?: string;
    className?: string;
    supportingLabel?: string;
    visual?: string;
  }) => (
    <button type="button" data-testid={testId} className={className} aria-label={visual === "voiceRail" ? supportingLabel : label}>
      {visual === "voiceRail" ? null : label}
    </button>
  ),
}));

function renderHealthScreen(initialEntries = ["/health"], overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    "/api/profile/personalisation": { conditions: [], hobbies: [], hasMedications: true },
    "/api/wound-scan/history": [],
    "/api/reports/summary": {
      latestTriage: {
        id: "triage-1",
        chief_complaint: "Mild dizziness",
        symptoms: ["Dizzy"],
        urgency: "monitor",
        recommendations: ["Rest and monitor"],
        bpm: 72,
        respiratory_rate: null,
        created_at: "2026-06-27T08:30:00.000Z",
      },
      latestVitals: null,
      todayMeds: { taken: 0, total: 0, adherencePct: null },
    },
    "/api/profile": null,
    "/api/meds/adherence-report": {
      hasLogs: true,
      weekPct: 80,
      monthPct: 78,
      perMedication: [],
      sevenDayDates: [],
      latestTaken: {
        medication_name: "Metformin",
        scheduled_time: "08:00",
        confirmed_taken_at: "2026-06-27T08:05:00.000Z",
      },
      nextDue: {
        medication_name: "Metformin",
        scheduled_time: "20:00",
      },
      todaySummary: {
        taken: 1,
        scheduled: 2,
        remaining: 1,
        medicationCount: 1,
        completedMedicationCount: 0,
        pendingMedicationCount: 1,
      },
    },
    "/api/vitals-engine/latest": {
      analysis: null,
      recent_readings: [
        {
          signal_type: "resting_hr_bpm",
          value: 72,
          recorded_at: "2026-06-27T08:15:00.000Z",
          source: "manual_entry",
        },
      ],
      latest_alert: null,
    },
    "/api/health/prevention": {
      focus: "Follow-up",
      headline: "Follow-up today.",
      why: ["Latest symptom report: Mild dizziness."],
      todayAction: "Open the latest report and ask VYVA what to watch.",
      helpSigns: ["Symptoms get worse", "Trouble breathing"],
      primaryRoute: "/informes/triage-1",
      secondaryRoute: "/health/doctor",
      confidence: "moderate",
      generatedAt: "2026-06-27T08:40:00.000Z",
    },
    "/api/checkins/today": {
      status: "completed",
      date_key: "2026-06-27",
      timezone: "Europe/Madrid",
      schedule: {
        id: "checkin-schedule-1",
        active: true,
        times_of_day: ["10:00"],
        next_run_at: null,
        last_completed_at: "2026-06-27T08:20:00.000Z",
        grace_minutes: 90,
      },
      latest_checkin: {
        id: "checkin-1",
        completed_at: "2026-06-27T08:20:00.000Z",
        feeling_label: "Steady today",
        overall_state: "good",
        highlight: "Hydrated and rested",
      },
      no_response: {
        overdue: false,
        minutes_overdue: null,
        alert_created: false,
        can_alert_caregiver: false,
        reason: null,
      },
      caregiver_alert: null,
      message: "VYVA has today's signal.",
      action_label: "My Health Plan",
    },
    ...overrides,
  };
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          return responses[path] ?? null;
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={initialEntries}>
        <HealthScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const medicineDueNowReport = {
  hasLogs: true,
  weekPct: 80,
  monthPct: 78,
  perMedication: [],
  sevenDayDates: [],
  latestTaken: null,
  nextDue: {
    medication_name: "Metformin",
    scheduled_time: "00:00",
  },
  todaySummary: {
    taken: 0,
    scheduled: 1,
    remaining: 1,
    medicationCount: 1,
    completedMedicationCount: 0,
    pendingMedicationCount: 1,
  },
};

describe("HealthScreen home-style layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiFetch.mockResolvedValue(new Response(JSON.stringify({
      id: "dose-log-1",
      medication_name: "Metformin",
      scheduled_time: "20:00",
      confirmed_taken_at: "2026-06-27T20:01:00.000Z",
    }), { status: 201, headers: { "Content-Type": "application/json" } }));
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the approved master dashboard with a VYVA voice invitation", async () => {
    renderHealthScreen();

    expect(await screen.findByTestId("health-master-layout")).toBeInTheDocument();
    expect(screen.queryByTestId("voice-hero")).not.toBeInTheDocument();
    expect(mocks.voiceHero).not.toHaveBeenCalled();

    expect(screen.getByTestId("health-master-hero")).toHaveTextContent("Health Plan");
    expect(screen.getByTestId("health-master-hero")).toHaveTextContent("Health Plan Ready");
    expect(screen.getByTestId("button-health-hero-talk")).toHaveAccessibleName("Speak anytime");
    expect(screen.getByTestId("button-health-hero-talk")).not.toHaveTextContent("Talk to VYVA");

    const cardGrid = screen.getByTestId("health-master-cards");
    await waitFor(() => expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("My Medication"));
    expect(within(cardGrid).getAllByRole("button")).toHaveLength(4);
    expect(screen.queryByTestId("button-health-tool-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("My Vitals");
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("Pulse 72");
    expect(screen.getByTestId("button-health-tool-my-vitals")).not.toHaveTextContent("Pulse: 72 bpm");
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveAccessibleName("My Vitals. Pulse: 72 bpm");
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("My Medication");
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("1 due");
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveTextContent("Feel Better");
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveTextContent("Start");
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveAccessibleName("Feel Better. Start check");
    expect(screen.getByTestId("button-health-tool-stay-well")).toHaveTextContent("Age Well");
    expect(screen.getByTestId("button-health-tool-stay-well")).toHaveTextContent("Follow-up");
    expect(screen.getByTestId("button-health-tool-stay-well")).not.toHaveTextContent("Follow-up today.");
    expect(screen.getByTestId("button-health-tool-stay-well")).toHaveAccessibleName("Age Well. Follow-up today.");

    expect(screen.queryByTestId("health-plan-lead")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-tool-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-signal-section")).not.toBeInTheDocument();

    expect(screen.getByTestId("health-fast-help")).toHaveTextContent("Fast help");
    expect(within(screen.getByTestId("health-fast-help")).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-health-fast-my-reports")).toHaveTextContent("My Reports");
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveTextContent("Visual Scan");
    expect(screen.getByTestId("button-health-fast-find-specialist")).toHaveTextContent("Find Specialist");
    expect(screen.queryByTestId("section-health-visual-scan")).not.toBeInTheDocument();
  });

  it("keeps the master hero, cards, and fast-help actions wired", async () => {
    renderHealthScreen();

    await waitFor(() => expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("1 due"));

    expect(screen.getByTestId("button-health-hero-talk")).toHaveAccessibleName("Speak anytime");

    fireEvent.click(screen.getByTestId("button-health-tool-my-vitals"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    fireEvent.click(screen.getByTestId("button-health-tool-feel-better"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/symptom-check");

    fireEvent.click(screen.getByTestId("button-health-tool-my-medication"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/meds");

    fireEvent.click(screen.getByTestId("button-health-tool-stay-well"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/prevention");

    fireEvent.click(screen.getByTestId("button-health-fast-my-reports"));
    expect(mocks.navigate).toHaveBeenCalledWith("/informes/triage-1");

    fireEvent.click(screen.getByTestId("button-health-fast-visual-scan"));
    expect(screen.getByTestId("section-health-visual-scan")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-fast-find-specialist"));
    expect(screen.getByTestId("section-health-specialist")).toBeInTheDocument();
  });

  it("opens the specialist provider finder from the specialist URL flag", () => {
    renderHealthScreen(["/health?specialist=1"]);

    expect(screen.getByTestId("section-health-specialist")).toBeInTheDocument();
  });

  it("shows useful empty states and starts symptom check when no latest report exists", async () => {
    renderHealthScreen(["/health"], {
      "/api/reports/summary": {
        latestTriage: null,
        latestVitals: null,
        todayMeds: { taken: 0, total: 0, adherencePct: null },
      },
      "/api/meds/adherence-report": {
        latestTaken: null,
        todaySummary: {
          taken: 0,
          scheduled: 0,
          remaining: 0,
          medicationCount: 0,
          completedMedicationCount: 0,
          pendingMedicationCount: 0,
        },
      },
      "/api/vitals-engine/latest": { analysis: null, recent_readings: [], latest_alert: null },
      "/api/health/prevention": {
        focus: "Plan",
        headline: "Prevention ready.",
        why: ["No strong warning pattern stands out right now."],
        todayAction: "Do one quick check-in.",
        helpSigns: ["Sudden chest pain", "Trouble breathing", "New confusion"],
        primaryRoute: "/health/check-in",
        secondaryRoute: "/health/doctor",
        confidence: "limited",
        generatedAt: "2026-06-27T08:40:00.000Z",
      },
      "/api/checkins/today": {
        status: "due_now",
        date_key: "2026-06-27",
        timezone: "Europe/Madrid",
        schedule: {
          id: "checkin-schedule-1",
          active: true,
          times_of_day: ["10:00"],
          next_run_at: "2026-06-27T10:00:00.000Z",
          last_completed_at: null,
          grace_minutes: 90,
        },
        latest_checkin: null,
        no_response: {
          overdue: false,
          minutes_overdue: null,
          alert_created: false,
          can_alert_caregiver: false,
          reason: null,
        },
        caregiver_alert: null,
        message: "Answer in a few seconds.",
        action_label: "Check in",
      },
    });

    await waitFor(() => expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("Add"));
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("Add");
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("My Medication");
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("Schedule");
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveTextContent("Start");
    expect(screen.getByTestId("button-health-tool-stay-well")).toHaveTextContent("Plan");
    expect(screen.getByTestId("button-health-tool-stay-well")).not.toHaveTextContent("Prevention ready.");
    expect(screen.getByTestId("button-health-tool-stay-well")).toHaveAccessibleName("Age Well. Prevention ready.");
    expect(screen.queryByTestId("button-health-signal-checkin")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-symptoms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-medication")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-tool-my-vitals"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    fireEvent.click(screen.getByTestId("button-health-tool-feel-better"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/symptom-check");
  });

  it("lets abnormal vitals take over the primary health plan status", async () => {
    renderHealthScreen(["/health"], {
      "/api/vitals-engine/latest": {
        analysis: {
          safety_status: "contact_doctor",
          recommended_action: "contact_doctor",
          senior_message: "Blood pressure is higher than usual.",
        },
        recent_readings: [
          {
            signal_type: "bp_systolic",
            value: 168,
            recorded_at: "2026-06-27T08:15:00.000Z",
            source: "manual_entry",
          },
          {
            signal_type: "bp_diastolic",
            value: 96,
            recorded_at: "2026-06-27T08:15:00.000Z",
            source: "manual_entry",
          },
        ],
        latest_alert: null,
      },
      "/api/meds/adherence-report": medicineDueNowReport,
    });

    await waitFor(() => expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("BP 168/96"));
    expect(screen.getByTestId("button-health-tool-my-vitals")).not.toHaveTextContent("BP 168/96 mmHg");
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveAccessibleName("My Vitals. BP 168/96 mmHg");
    expect(screen.getByTestId("button-health-tool-my-vitals")).not.toHaveTextContent("Needs review");
    expect(screen.queryByTestId("button-health-signal-vitals")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("1 due");
  });

  it("lets urgent symptom follow-up take over when vitals are steady", async () => {
    renderHealthScreen(["/health"], {
      "/api/reports/summary": {
        latestTriage: {
          id: "triage-urgent",
          chief_complaint: "Chest tightness",
          symptoms: ["Chest tightness"],
          urgency: "routine",
          recommendations: ["Call the GP today"],
          bpm: 82,
          respiratory_rate: null,
          created_at: "2026-06-27T08:30:00.000Z",
        },
        latestVitals: null,
        todayMeds: { taken: 0, total: 0, adherencePct: null },
      },
      "/api/meds/adherence-report": medicineDueNowReport,
    });

    await waitFor(() => expect(screen.getByTestId("button-health-tool-feel-better")).toHaveTextContent("Start"));
    expect(screen.getByTestId("button-health-tool-feel-better")).not.toHaveTextContent("Chest tightness");
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveAccessibleName("Feel Better. Start check");
    expect(screen.getByTestId("button-health-tool-feel-better")).not.toHaveTextContent("Review");
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveTextContent("Pulse 72");
    expect(screen.getByTestId("button-health-tool-my-vitals")).not.toHaveTextContent("Pulse: 72 bpm");
    expect(screen.getByTestId("button-health-tool-my-vitals")).toHaveAccessibleName("My Vitals. Pulse: 72 bpm");
    expect(screen.queryByTestId("button-health-signal-symptoms")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-tool-my-medication")).toHaveTextContent("1 due");
  });

  it("uses Today for same-day symptom report tags", async () => {
    renderHealthScreen(["/health"], {
      "/api/reports/summary": {
        latestTriage: {
          id: "triage-today",
          chief_complaint: "Mild dizziness",
          symptoms: ["Dizzy"],
          urgency: "monitor",
          recommendations: ["Rest and monitor"],
          bpm: 72,
          respiratory_rate: null,
          created_at: new Date().toISOString(),
        },
        latestVitals: null,
        todayMeds: { taken: 0, total: 0, adherencePct: null },
      },
    });

    await waitFor(() => expect(screen.getByTestId("button-health-tool-feel-better")).toHaveTextContent("Start"));
    expect(screen.getByTestId("button-health-tool-feel-better")).toHaveAccessibleName("Feel Better. Start check");
  });
});
