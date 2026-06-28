import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders the personalised plan, live signal cards, and fast-help actions", async () => {
    renderHealthScreen();

    expect(screen.getByTestId("voice-hero")).toBeInTheDocument();
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-mobile-talk-label", "Talk to doctor");
    expect(mocks.voiceHero).toHaveBeenCalledWith(expect.objectContaining({
      voiceAgentSlug: "health",
    }));
    expect(screen.queryByTestId("daily-checkin-status-card")).not.toBeInTheDocument();

    expect(await screen.findByTestId("health-plan-lead")).toHaveTextContent("Today's health plan");
    expect(screen.getByTestId("health-plan-lead")).toHaveTextContent("Metformin due at");
    expect(screen.getByTestId("health-plan-primary-insight")).toHaveTextContent("1 dose left today");
    expect(screen.getByTestId("health-plan-primary-insight")).toHaveTextContent("Vitals stable");
    expect(screen.getByTestId("health-plan-primary-insight")).not.toHaveTextContent("Pulse: 72 bpm");
    expect(screen.getByTestId("health-plan-primary-insight")).not.toHaveTextContent("Metformin last");
    expect(screen.getByTestId("health-plan-lead")).not.toHaveTextContent("No urgent action");
    expect(screen.getByTestId("health-plan-lead")).not.toHaveTextContent("Metformin last taken");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("Pulse: 72 bpm");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("Stable");
    expect(screen.getByTestId("health-plan-checklist")).toHaveTextContent("Vitals");
    expect(screen.getByTestId("button-health-plan-step-vitals")).toHaveTextContent("Stable");
    expect(screen.getByTestId("button-health-plan-step-medicine")).toHaveTextContent("Due tonight");
    expect(screen.getByTestId("button-health-plan-step-checkin")).toHaveTextContent("Done");
    expect(screen.queryByTestId("button-health-plan-step-symptoms")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-plan-open")).toHaveTextContent("Mark taken");
    expect(screen.getByTestId("button-health-plan-review-medicine")).toHaveTextContent("Review medicine");
    expect(screen.getByTestId("health-plan-updated-at")).toHaveTextContent("Updated");
    expect(screen.queryByTestId("health-primary-grid")).not.toBeInTheDocument();

    expect(screen.getByTestId("health-tool-section")).toHaveTextContent("All health areas");
    expect(screen.getByTestId("button-health-tool-plan")).toHaveTextContent("Health Plan");
    expect(screen.getByTestId("button-health-tool-plan")).toHaveTextContent("1 step left");
    expect(screen.getByTestId("button-health-tool-vitals")).toHaveTextContent("Vitals");
    expect(screen.getByTestId("button-health-tool-vitals")).toHaveTextContent("Pulse stable");
    expect(screen.getByTestId("button-health-tool-symptoms")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("button-health-tool-symptoms")).toHaveTextContent("Monitor only");
    expect(screen.getByTestId("button-health-tool-medicine")).toHaveTextContent("Medicine");
    expect(screen.getByTestId("button-health-tool-medicine")).toHaveTextContent("1 due tonight");

    expect(screen.queryByTestId("health-signal-section")).not.toBeInTheDocument();
    expect(screen.queryByTestId("health-signal-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-vitals")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-checkin")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-symptoms")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-medication")).not.toBeInTheDocument();

    expect(screen.getByTestId("health-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("health-fast-help")).toHaveTextContent("Need help now?");
    expect(screen.getByTestId("button-health-fast-reports")).toHaveTextContent("My Reports");
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveTextContent("Visual Health Scan");
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("section-health-visual-scan")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-fast-specialist")).toHaveTextContent("Find a Specialist");
  });

  it("keeps plan, signal cards, and fast-help actions wired", async () => {
    renderHealthScreen();

    await screen.findByTestId("health-plan-lead");
    await waitFor(() => expect(screen.getByTestId("button-health-plan-open")).toHaveTextContent("Mark taken"));

    fireEvent.click(screen.getByTestId("button-health-plan-open"));
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledWith(
      "/api/meds/adherence-report/confirm",
      expect.objectContaining({ method: "POST" }),
    ));
    const confirmOptions = mocks.apiFetch.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(confirmOptions.body))).toEqual({
      medication_name: "Metformin",
      scheduled_time: "20:00",
    });
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      description: "Metformin marked taken.",
    })));

    fireEvent.click(screen.getByTestId("button-health-plan-review-medicine"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/meds");

    fireEvent.click(screen.getByTestId("button-health-plan-checkin"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/check-ins");

    fireEvent.click(screen.getByTestId("button-health-tool-plan"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    fireEvent.click(screen.getByTestId("button-health-tool-vitals"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    fireEvent.click(screen.getByTestId("button-health-tool-symptoms"));
    expect(mocks.navigate).toHaveBeenCalledWith("/informes/triage-1");

    fireEvent.click(screen.getByTestId("button-health-tool-medicine"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/meds");

    expect(screen.queryByTestId("button-health-signal-checkin")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("health-plan-vitals-snapshot"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    expect(screen.queryByTestId("button-health-signal-symptoms")).not.toBeInTheDocument();

    expect(screen.queryByTestId("button-health-signal-medication")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-fast-reports"));
    expect(mocks.navigate).toHaveBeenCalledWith("/informes");

    fireEvent.click(screen.getByTestId("button-health-fast-specialist"));
    expect(screen.getByTestId("section-health-specialist")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-fast-visual-scan"));
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("section-health-visual-scan")).toBeInTheDocument();
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

    expect(await screen.findByTestId("health-plan-lead")).toHaveTextContent("Add one BP reading");
    expect(screen.getByTestId("health-plan-primary-insight")).toHaveTextContent("Start your baseline");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("Add vitals");
    expect(screen.getByTestId("button-health-plan-open")).toHaveTextContent("Capture vitals");
    expect(screen.getByTestId("button-health-plan-step-vitals")).toHaveTextContent("Add reading");
    expect(screen.getByTestId("button-health-plan-step-medicine")).toHaveTextContent("Set schedule");
    expect(screen.getByTestId("button-health-plan-step-checkin")).toHaveTextContent("Ready now");
    expect(screen.getByTestId("button-health-plan-step-symptoms")).toHaveTextContent("Start check");
    expect(screen.queryByTestId("button-health-signal-plan")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-health-signal-vitals")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-signal-checkin")).toHaveTextContent("Ready now");
    expect(screen.getByTestId("button-health-signal-symptoms")).toHaveTextContent("Quick body check");
    expect(screen.getByTestId("button-health-signal-symptoms")).toHaveTextContent("Tell VYVA what feels different");
    expect(screen.getByTestId("button-health-signal-medication")).toHaveTextContent("Set medicine schedule");
    expect(screen.getByTestId("button-health-signal-medication")).toHaveTextContent("Add times and reminders");

    fireEvent.click(screen.getByTestId("health-plan-vitals-snapshot"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/vitals");

    fireEvent.click(screen.getByTestId("button-health-signal-symptoms"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/symptom-check");

    fireEvent.click(screen.getByTestId("button-health-plan-checkin"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/check-in");
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

    expect(await screen.findByTestId("health-plan-lead")).toHaveTextContent("Today's health plan");
    expect(screen.getByTestId("health-plan-lead")).toHaveTextContent("Vitals need review");
    expect(screen.getByTestId("health-plan-lead")).toHaveTextContent("Blood pressure is higher than usual.");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("BP 168/96 mmHg");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("Needs review");
    expect(screen.queryByTestId("button-health-signal-vitals")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-signal-medication")).toHaveTextContent("1 due");
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

    expect(await screen.findByTestId("health-plan-lead")).toHaveTextContent("Review symptom follow-up");
    expect(screen.getByTestId("health-plan-lead")).toHaveTextContent("Chest tightness");
    expect(screen.getByTestId("button-health-plan-open")).toHaveTextContent("Open report");
    expect(screen.getByTestId("health-plan-vitals-snapshot")).toHaveTextContent("Pulse: 72 bpm");
    expect(screen.queryByTestId("button-health-signal-symptoms")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-signal-medication")).toHaveTextContent("1 due");
  });
});
