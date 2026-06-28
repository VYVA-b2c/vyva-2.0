import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import MedsScreen from "./MedsScreen";

const labels: Record<string, string> = {
  "meds.addByVoice": "Add by voice",
  "meds.voiceStop": "Stop voice input",
  "meds.voiceTranscribing": "Turning voice into text",
  "meds.voiceRecording": "Listening... tap again to stop.",
  "meds.noMedsTitle": "No medications added yet",
  "meds.noMedsSub": "Use the button below to add your medications by voice",
  "meds.todaySchedule": "Today's Schedule",
  "meds.quickAccess": "Medication",
  "meds.primary.reminders": "Reminders",
  "meds.primary.remindersSub": "Review today's schedule and add medication reminders.",
  "meds.primary.refills": "Refills",
  "meds.primary.refillsSub": "Prepare repeat prescriptions or delivery.",
  "meds.primary.interactions": "Interactions",
  "meds.primary.interactionsSub": "Check medicines and supplements.",
  "meds.primary.adherence": "Adherence",
  "meds.primary.adherenceSub": "See progress and missed doses.",
  "meds.primary.safety": "Safety signals",
  "meds.primary.safetySub": "Review early signals and draft case packets.",
  "meds.dashboard.title": "Medication dashboard",
  "meds.dashboard.loadingStatus": "Checking today's medicines",
  "meds.dashboard.emptyStatus": "Add medicines to start tracking today",
  "meds.dashboard.doneStatus": "All scheduled doses are done",
  "meds.dashboard.steadyStatus": "Today is mostly on track",
  "meds.dashboard.watchStatus": "A few doses still need attention",
  "meds.dashboard.focusNow": "Focus now",
  "meds.dashboard.noPlanLabel": "No plan yet",
  "meds.dashboard.allClearLabel": "All clear today",
  "meds.dashboard.dosesLeftLabel": "doses left today",
  "meds.dashboard.adherenceRingLabel": "Today's adherence is {{value}}",
  "meds.dashboard.rhythmTitle": "Today rhythm",
  "meds.dashboard.rhythmSub": "{{taken}} of {{scheduled}} planned doses confirmed",
  "meds.dashboard.rhythmEmpty": "Add medicines to see your daily rhythm.",
  "meds.dashboard.reviewSchedule": "Review schedule",
  "meds.dashboard.hideSchedule": "Hide schedule",
  "meds.dashboard.takenToday": "Taken today",
  "meds.dashboard.takenDetail": "confirmed doses",
  "meds.dashboard.dueNow": "Due now",
  "meds.dashboard.dueDetail": "still due today",
  "meds.dashboard.noneDueDetail": "nothing due",
  "meds.dashboard.adherence": "Adherence",
  "meds.dashboard.adherenceDetail": "today's schedule",
  "meds.dashboard.medicines": "Medicines",
  "meds.dashboard.medicinesDetail": "tracked here",
  "meds.dashboard.nextMedicine": "Next medicine",
  "meds.dashboard.checkingSchedule": "Checking schedule...",
  "meds.dashboard.dailyRoutine": "Daily routine",
  "meds.dashboard.scheduledTime": "at {{time}}",
  "meds.dashboard.confirmNext": "Confirm taken",
  "meds.dashboard.doseDue": "{{count}} dose due",
  "meds.dashboard.allDoneTitle": "All scheduled doses are done",
  "meds.dashboard.allDoneSub": "Your medicine routine is complete for today.",
  "meds.dashboard.pharmacy": "Pharmacy",
  "meds.dashboard.noPharmacyTitle": "No pharmacy saved yet",
  "meds.dashboard.noPharmacySub": "Add a pharmacy so contact details are ready.",
  "meds.dashboard.callPharmacy": "Call pharmacy",
  "meds.dashboard.addPharmacy": "Add pharmacy",
  "meds.dashboard.orderRefill": "Order refill",
  "meds.dashboard.personalGuidance": "Personal guidance",
  "meds.dashboard.guidanceSub": "Small steps matched to the health profile VYVA can see.",
  "meds.dashboard.healthTipTitle": "Health tip",
  "meds.dashboard.exerciseTipTitle": "Exercise tip",
  "meds.dashboard.tipContextConditions": "Based on {{conditions}}",
  "meds.dashboard.tipContextMedicines": "Based on current medicines",
  "meds.dashboard.tipContextMobility": "Based on mobility level",
  "meds.dashboard.tipContextHobby": "Based on saved hobbies",
  "meds.dashboard.tipContextProfile": "Based on your saved profile",
  "meds.dashboard.tipContextRoutine": "Based on today's medicine routine",
  "meds.dashboard.healthTipDiabetesBloodPressure": "For {{conditions}}, use a meal cue for medicine checks and stand up slowly. Note shakiness, thirst, or dizziness.",
  "meds.dashboard.healthTipBloodPressure": "For blood pressure, rise slowly after sitting and note dizziness, swelling, or headaches for your next health chat.",
  "meds.dashboard.healthTipDiabetes": "For diabetes, keep medicine checks close to your normal meal rhythm and ask for help if you feel shaky or unusually thirsty.",
  "meds.dashboard.healthTipBloodThinner": "Because your medicines include aspirin or a blood thinner, keep an eye on unusual bruising or bleeding and check with a pharmacist before adding new painkillers.",
  "meds.dashboard.healthTipRespiratory": "With breathing support in your profile, keep inhalers or breathing medicines easy to find and note any new breathlessness before your next health conversation.",
  "meds.dashboard.healthTipStatin": "Because a cholesterol medicine is on your list, make a note of new muscle pain or weakness so you can mention it to your pharmacist or doctor.",
  "meds.dashboard.healthTipConditionFallback": "With {{conditions}} saved in your profile, keep a short note of how you feel after medicines so your next pharmacy or doctor chat is easier.",
  "meds.dashboard.healthTipGeneric": "Keep medicines in the routine your doctor gave you, and ask a pharmacist before adding supplements or over-the-counter medicines.",
  "meds.dashboard.exerciseTipMobility": "For your mobility profile, try seated ankle circles or slow sit-to-stand practice beside a steady chair.",
  "meds.dashboard.exerciseTipDiabetesBloodPressure": "For diabetes and blood pressure, choose 5 to 10 minutes of easy walking or seated marching after a meal, keeping the pace comfortable enough to talk.",
  "meds.dashboard.exerciseTipDiabetes": "For diabetes, a short gentle walk after a meal can support the routine; wear comfortable shoes and stop if you feel shaky or unwell.",
  "meds.dashboard.exerciseTipBloodPressure": "For blood pressure, try a steady walk or chair marching and avoid holding your breath during strength movements.",
  "meds.dashboard.exerciseTipRespiratory": "For breathing support, try a slow walk with relaxed shoulders and pause for pursed-lip breathing if you feel short of breath.",
  "meds.dashboard.exerciseTipGardening": "Since gardening is in your profile, use it gently: water plants, tend pots, or walk the garden for 5 minutes without bending too long.",
  "meds.dashboard.exerciseTipGeneric": "Try 5 to 10 minutes of gentle walking or seated movement when you feel ready, and keep it easy enough to talk.",
  "meds.dashboard.actionsTitle": "What can I do next?",
  "meds.dashboard.addByVoiceSub": "Say a medicine name, dose, and routine.",
  "meds.safety.title": "Medication safety signals",
  "meds.safety.subtitle": "Early signal review and audit-ready case packets.",
  "meds.safety.steadyBadge": "Steady",
  "meds.safety.steadyTitle": "No medication safety signals found",
  "meds.safety.steadySub": "Today looks steady from the medication data VYVA can see.",
  "meds.safety.statSignals": "Signals",
  "meds.safety.statCases": "Cases",
  "meds.safety.statReady": "Ready",
  "meds.safety.emptyTitle": "No case needed right now",
  "meds.safety.emptySub": "A single missed confirmation stays in reminders. Draft cases appear only for explicit or repeated signals.",
  "meds.safety.analyse": "Analyse signals",
  "meds.safety.newCase": "New side-effect note",
  "meds.safety.newCaseTitle": "New safety case",
  "meds.safety.reviewCase": "Review safety case",
  "meds.safety.caseDrawerSub": "Prepare a review packet. This does not submit anything to a regulator.",
  "meds.safety.caseFallback": "Medication safety case",
  "meds.safety.readyToExport": "Ready to export",
  "meds.safety.missingTitle": "Missing for audit-ready export",
  "meds.safety.status": "Status",
  "meds.safety.severity": "Severity",
  "meds.safety.suspectedMedication": "Suspected medication",
  "meds.safety.reaction": "Symptom or reaction",
  "meds.safety.reactionStarted": "Reaction start date",
  "meds.safety.seriousness": "Seriousness assessment",
  "meds.safety.outcome": "Outcome",
  "meds.safety.actionTaken": "Action taken",
  "meds.safety.reporterName": "Reporter name",
  "meds.safety.reporterContact": "Reporter contact",
  "meds.safety.narrative": "Narrative",
  "meds.safety.evidence": "Evidence timeline",
  "meds.safety.exportPacket": "Export packet",
  "meds.safety.export": "Export packet",
  "meds.fastHelpKicker": "Fast help",
  "meds.canHelpWith": "I can help you with",
  "meds.assistant.interactions.label": "Check Interactions",
  "meds.assistant.interactions.sub": "See if any medications conflict",
  "meds.assistant.naturalMedicine.label": "Natural Options",
  "meds.assistant.naturalMedicine.sub": "Check herbal and supplement fit",
  "meds.assistant.order.label": "Order Online",
  "meds.assistant.order.sub": "Repeat prescriptions and home delivery",
  "meds.assistant.advances.label": "Medication Research",
  "meds.assistant.advances.sub": "See recent updates in plain language",
  "meds.assistant.sideEffects.label": "Side Effect Check",
  "meds.assistant.sideEffects.sub": "Talk through symptoms to watch",
  "meds.confirmRemaining": "Confirm remaining doses",
  "meds.allTaken": "All doses taken",
  "meds.taken": "Taken",
  "meds.confirm": "Confirm",
  "meds.toastAdded": "Medication added",
  "meds.toastAddedDesc": "{{name}} has been added to your list.",
  "meds.added": "Added",
};

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  toast: vi.fn(),
  navigate: vi.fn(),
  voiceHero: vi.fn(),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: string | { returnObjects?: boolean; defaultValue?: string; count?: number }) => {
      const interpolate = (value: string, params?: Record<string, unknown>) =>
        value.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(params?.[token] ?? ""));
      if (key === "meds.headlines" && typeof fallbackOrOptions === "object" && fallbackOrOptions?.returnObjects) {
        return [];
      }
      if (typeof fallbackOrOptions === "object" && typeof fallbackOrOptions.defaultValue === "string") {
        return interpolate(fallbackOrOptions.defaultValue, fallbackOrOptions as Record<string, unknown>);
      }
      const value = labels[key] ?? (typeof fallbackOrOptions === "string" ? fallbackOrOptions : key);
      return typeof fallbackOrOptions === "object"
        ? interpolate(value, fallbackOrOptions as Record<string, unknown>)
        : value;
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({
    action: null,
    payloadValue: () => "",
  }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: { voiceAgentSlug?: string }) => {
    mocks.voiceHero(props);
    return <div data-testid="voice-hero" />;
  },
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/MedsAssistantSheet", () => ({
  default: () => null,
}));

const apiFetchMock = vi.mocked(apiFetch);

function installMediaRecorderMock() {
  const getUserMedia = vi.fn().mockResolvedValue({
    getTracks: () => [{ stop: vi.fn() }],
  });
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  class MockMediaRecorder {
    static isTypeSupported = vi.fn(() => true);
    state: "inactive" | "recording" = "inactive";
    mimeType = "audio/webm";
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      this.mimeType = options?.mimeType ?? "audio/webm";
    }

    start() {
      this.state = "recording";
    }

    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob([new Uint8Array(64)], { type: this.mimeType }) });
      this.onstop?.();
    }
  }

  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
}

type TestMedication = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  scheduled_times: string[];
  takenToday: boolean;
  takenCountToday: number;
  scheduledCountToday: number;
};

type TestProvider = {
  name?: string;
  role?: string;
  phone?: string;
  address?: string;
  contact_phone?: string;
};

type TestProfile = {
  conditions?: Array<{ name: string; category?: string }>;
  medications?: Array<{ name: string; dosage?: string; frequency?: string; times?: string }>;
  mobility_level?: string;
  living_situation?: string;
  data_sharing_consent?: {
    conditions?: {
      health_conditions?: string[];
      mobility_level?: string | null;
      living_situation?: string | null;
    };
    hobbies?: {
      hobbies?: string[];
    };
    diet?: {
      dietary_preferences?: string[];
      dietary_notes?: string;
    };
  };
};

type RenderOptions = {
  personalisation?: {
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  };
  providers?: TestProvider[];
  profile?: TestProfile;
};

function safetyResponse(overrides: Record<string, unknown> = {}) {
  return {
    summary: {
      status: "steady",
      severity: "watch",
      title: "No medication safety signals found",
      message: "Today looks steady from the medication data VYVA can see.",
      signalCount: 0,
      openCaseCount: 0,
      lastAnalysedAt: null,
    },
    signalCandidates: [],
    signals: [],
    openCases: [],
    exportAvailability: {
      canExport: false,
      readyCount: 0,
      needsReviewCount: 0,
    },
    ...overrides,
  };
}

function renderMedsScreen(medications: TestMedication[] = [], safety = safetyResponse(), options: RenderOptions = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/meds/adherence-report/today") {
            return { medications };
          }
          if (queryKey[0] === "/api/meds/safety") {
            return safety;
          }
          if (queryKey[0] === "/api/profile/personalisation") {
            return options.personalisation ?? {
              conditions: [],
              hobbies: [],
              hasMedications: medications.length > 0,
            };
          }
          if (queryKey[0] === "/api/onboarding/state") {
            return {
              profile: {
                ...(options.profile ?? {}),
                data_sharing_consent: {
                  ...(options.profile?.data_sharing_consent ?? {}),
                  providers: {
                    providers: options.providers ?? [],
                  },
                },
              },
            };
          }
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MedsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MedsScreen schedule actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the medication dashboard and keeps the full schedule hidden by default", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("section-meds-dashboard")).toBeInTheDocument();
    expect(screen.getByText("Medication dashboard")).toBeInTheDocument();
    expect(screen.getByText("Add medicines to start tracking today")).toBeInTheDocument();
    expect(screen.getByTestId("metric-meds-taken")).toHaveTextContent("--");
    expect(screen.getByTestId("metric-meds-due")).toHaveTextContent("0");
    expect(screen.getByTestId("metric-meds-adherence")).toHaveTextContent("--");
    expect(screen.getByTestId("metric-meds-count")).toHaveTextContent("0");
    expect(screen.getByTestId("section-meds-next")).toHaveTextContent("No medications added yet");
    expect(screen.getByTestId("panel-meds-pharmacy")).toHaveTextContent("No pharmacy saved yet");
    expect(screen.getByTestId("card-meds-health-tip")).toHaveTextContent("Health tip");
    expect(screen.getByTestId("card-meds-exercise-tip")).toHaveTextContent("Exercise tip");
    expect(
      screen.getByTestId("section-meds-dashboard-tips").compareDocumentPosition(screen.getByTestId("panel-meds-pharmacy")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText("Today's Schedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-no-medications")).not.toBeInTheDocument();
    expect(screen.queryByText("Medication")).not.toBeInTheDocument();

    expect(screen.getByTestId("button-meds-primary-reminders")).toHaveTextContent("Reminders");
    expect(screen.getByTestId("button-meds-primary-refills")).toHaveTextContent("Refills");
    expect(screen.getByTestId("button-meds-primary-interactions")).toHaveTextContent("Interactions");
    expect(screen.getByTestId("button-meds-primary-adherence")).toHaveTextContent("Adherence");
    expect(screen.getByTestId("button-meds-primary-safety")).toHaveTextContent("Safety signals");
    expect(screen.getByTestId("button-meds-primary-add-by-voice")).toHaveTextContent("Add by voice");

    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("I can help you with");
    expect(screen.getByTestId("button-assistant-naturalMedicine")).toHaveTextContent("Natural Options");
    expect(screen.getByTestId("button-assistant-advances")).toHaveTextContent("Medication Research");
    expect(screen.getByTestId("button-assistant-sideEffects")).toHaveTextContent("Side Effect Check");
    expect(screen.queryByTestId("button-assistant-interactions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-assistant-order")).not.toBeInTheDocument();
  });

  it("shows dashboard metrics, next medicine, saved pharmacy, and condition-aware tips", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "twice_daily",
        scheduled_times: ["08:00", "20:00"],
        takenToday: false,
        takenCountToday: 1,
        scheduledCountToday: 2,
      },
      {
        id: "med-2",
        medication_name: "Aspirin",
        dosage: "100mg",
        frequency: "once_daily",
        scheduled_times: ["09:00"],
        takenToday: true,
        takenCountToday: 1,
        scheduledCountToday: 1,
      },
    ], safetyResponse(), {
      personalisation: {
        conditions: ["Type 2 diabetes"],
        hobbies: [],
        hasMedications: true,
      },
      providers: [
        {
          name: "Farmacia Central",
          role: "pharmacy",
          phone: "+34 600 111 222",
          address: "High Street 1",
        },
      ],
    });

    expect(await screen.findByTestId("section-meds-dashboard")).toHaveTextContent("Today is mostly on track");
    expect(screen.getByTestId("metric-meds-taken")).toHaveTextContent("2/3");
    expect(screen.getByTestId("metric-meds-due")).toHaveTextContent("1");
    expect(screen.getByTestId("metric-meds-adherence")).toHaveTextContent("67%");
    expect(screen.getByTestId("metric-meds-count")).toHaveTextContent("2");
    expect(screen.getByTestId("section-meds-next")).toHaveTextContent("Metformin");
    expect(screen.getByTestId("text-meds-pharmacy-name")).toHaveTextContent("Farmacia Central");
    expect(screen.getByTestId("link-meds-pharmacy-phone")).toHaveAttribute("href", "tel:+34600111222");
    expect(screen.getByTestId("card-meds-health-tip")).toHaveTextContent("Based on Type 2 diabetes");
    expect(screen.getByTestId("card-meds-health-tip")).toHaveTextContent("normal meal rhythm");
    expect(screen.getByTestId("card-meds-exercise-tip")).toHaveTextContent("Based on Type 2 diabetes");
    expect(screen.getByTestId("card-meds-exercise-tip")).toHaveTextContent("short gentle walk after a meal");
  });

  it("uses richer saved health profile signals for combined conditions and mobility", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Lisinopril",
        dosage: "10mg",
        frequency: "once_daily",
        scheduled_times: ["09:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ], safetyResponse(), {
      personalisation: {
        conditions: ["Type 2 diabetes"],
        hobbies: ["gardening"],
        hasMedications: true,
      },
      profile: {
        conditions: [{ name: "High blood pressure" }, { name: "Arthritis" }],
        mobility_level: "Limited mobility with cane",
      },
    });

    expect(await screen.findByTestId("card-meds-health-tip")).toHaveTextContent("Based on Type 2 diabetes + High blood pressure");
    expect(screen.getByTestId("card-meds-health-tip")).toHaveTextContent("meal cue");
    expect(screen.getByTestId("card-meds-health-tip")).toHaveTextContent("stand up slowly");
    expect(screen.getByTestId("card-meds-exercise-tip")).toHaveTextContent("Based on mobility level");
    expect(screen.getByTestId("card-meds-exercise-tip")).toHaveTextContent("seated ankle circles");
  });

  it("confirms the next pending medicine from the dashboard", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "once_daily",
        scheduled_times: ["08:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ]);

    fireEvent.click(await screen.findByTestId("button-confirm-next-med"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/meds/adherence-report/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          medication_name: "Metformin",
          scheduled_time: "08:00",
        }),
      }),
    ));
  });

  it("routes refill ordering through the existing concierge flow", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "once_daily",
        scheduled_times: ["08:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ]);

    fireEvent.click(await screen.findByTestId("button-meds-pharmacy-order"));

    expect(mocks.navigate).toHaveBeenCalledWith(
      "/concierge/shopping",
      expect.objectContaining({
        state: expect.objectContaining({
          shoppingPrefill: expect.objectContaining({
            category: "pharmacy_basics",
          }),
        }),
      }),
    );
  });

  it("reveals the compact reminders add-by-voice area from the Reminders card", async () => {
    renderMedsScreen();

    fireEvent.click(await screen.findByTestId("button-meds-primary-reminders"));

    expect(await screen.findByTestId("section-meds-reminders")).toBeInTheDocument();
    expect(screen.getByText("Today's Schedule")).toBeInTheDocument();
    expect(screen.getByTestId("status-no-medications")).toBeInTheDocument();
    expect(screen.getByTestId("button-meds-add-by-voice-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("button-meds-add-by-voice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-confirm-all-meds")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-meds-primary-add-by-voice")).toHaveTextContent("Add by voice");
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
  });

  it("navigates to the adherence report from the Adherence card", async () => {
    renderMedsScreen();

    fireEvent.click(await screen.findByTestId("button-meds-primary-adherence"));

    expect(mocks.navigate).toHaveBeenCalledWith("/meds/adherence-report");
  });

  it("reveals the safety signal panel without opening reminders", async () => {
    renderMedsScreen();

    fireEvent.click(await screen.findByTestId("button-meds-primary-safety"));

    expect(await screen.findByTestId("section-meds-safety")).toBeInTheDocument();
    expect(screen.getByText("Medication safety signals")).toBeInTheDocument();
    expect(screen.getByText("No case needed right now")).toBeInTheDocument();
    expect(screen.getByTestId("button-meds-safety-analyse")).toHaveTextContent("Analyse signals");
    expect(screen.getByTestId("button-meds-safety-new-case")).toHaveTextContent("New side-effect note");
    expect(screen.queryByTestId("section-meds-reminders")).not.toBeInTheDocument();
  });

  it("opens a safety case drawer and exports an audit packet", async () => {
    const safetyCase = {
      id: "case-1",
      status: "draft",
      severity: "attention",
      signal_type: "possible_side_effect",
      suspected_medication: "Aspirin",
      reaction: "Rash",
      reaction_started_at: null,
      seriousness_flags: [],
      outcome: null,
      action_taken: null,
      reporter_name: null,
      reporter_contact: null,
      reporter_role: "patient_or_caregiver",
      narrative: null,
      evidence: [{ type: "manual_report" }],
      missing_fields: ["Reaction start date"],
      export_ready: false,
    };
    apiFetchMock.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/export")) {
        return new Response(JSON.stringify({
          case: { ...safetyCase, missing_fields: [], export_ready: true },
          export: {
            human_readable_text: "VYVA Medication Safety Case Packet\nAspirin",
            export_ready: true,
            missing_fields: [],
          },
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).includes("/api/meds/safety/cases/case-1") && init?.method === "PATCH") {
        return new Response(JSON.stringify({
          case: { ...safetyCase, outcome: "Improving", missing_fields: [], export_ready: true },
          sent_to: [],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    renderMedsScreen([], safetyResponse({
      summary: {
        status: "needs_review",
        severity: "attention",
        title: "1 medication safety case to review",
        message: "Review the case details.",
        signalCount: 1,
        openCaseCount: 1,
        lastAnalysedAt: null,
      },
      openCases: [safetyCase],
      exportAvailability: {
        canExport: true,
        readyCount: 0,
        needsReviewCount: 1,
      },
    }));

    fireEvent.click(await screen.findByTestId("button-meds-primary-safety"));
    fireEvent.click(await screen.findByTestId("button-review-safety-case-0"));

    expect(await screen.findByTestId("sheet-meds-safety-case")).toBeInTheDocument();
    expect(screen.getByTestId("input-safety-case-medication")).toHaveValue("Aspirin");
    expect(screen.getAllByText("Reaction start date").length).toBeGreaterThanOrEqual(1);

    fireEvent.change(screen.getByTestId("input-safety-case-outcome"), { target: { value: "Improving" } });
    fireEvent.click(screen.getByTestId("button-safety-case-save"));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/meds/safety/cases/case-1",
      expect.objectContaining({ method: "PATCH" }),
    ));

    fireEvent.click(screen.getByTestId("button-safety-case-export"));
    const exportText = await screen.findByTestId("textarea-safety-case-export") as HTMLTextAreaElement;
    expect(exportText.value).toContain("VYVA Medication Safety Case Packet");
  });

  it("keeps the footer Add by voice action when medications exist", async () => {
    renderMedsScreen([
      {
        id: "med-1",
        medication_name: "Metformin",
        dosage: "500mg",
        frequency: "once_daily",
        scheduled_times: ["08:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ]);

    fireEvent.click(await screen.findByTestId("button-meds-primary-reminders"));

    expect(await screen.findByTestId("button-meds-add-by-voice")).toBeInTheDocument();
    expect(screen.queryByTestId("button-meds-add-by-voice-empty")).not.toBeInTheDocument();
  });

  it("starts inline voice capture and adds the parsed medication without opening a modal", async () => {
    installMediaRecorderMock();
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).startsWith("/api/meds-voice-transcribe")) {
        return new Response(JSON.stringify({ transcript: "I take Metformin 500mg twice daily" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (String(url) === "/api/meds-voice-parse") {
        return new Response(JSON.stringify({
          name: "Metformin",
          dosage: "500mg",
          frequency: "twice_daily",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    renderMedsScreen();

    fireEvent.click(await screen.findByTestId("button-meds-primary-reminders"));

    const voiceButton = await screen.findByTestId("button-meds-add-by-voice-empty");
    fireEvent.click(voiceButton);
    expect(await screen.findByTestId("meds-voice-status")).toHaveTextContent("Listening... tap again to stop.");

    fireEvent.click(voiceButton);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/meds-voice-transcribe"),
      expect.objectContaining({ method: "POST" }),
    ));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/meds-voice-parse",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transcript: "I take Metformin 500mg twice daily" }),
      }),
    ));
    expect(await screen.findByText("Metformin")).toBeInTheDocument();
    expect(screen.queryByTestId("modal-voice-meds")).not.toBeInTheDocument();
  });
});
