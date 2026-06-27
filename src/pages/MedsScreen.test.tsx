import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
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
  "meds.heroDoseHeadline": "Don't forget your\n{{medication}}",
  "meds.heroDoseDueInMinutes_one": "Due in {{count}} min. Tap Reminders when done.",
  "meds.heroDoseDueInMinutes_other": "Due in {{count}} min. Tap Reminders when done.",
  "meds.heroAllDoneHeadline": "All medicines\ndone today",
  "meds.heroAllDoneSub": "Nice work. Nothing else is due today.",
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
    t: (key: string, fallbackOrOptions?: string | Record<string, unknown>) => {
      if (key === "meds.headlines" && typeof fallbackOrOptions === "object" && fallbackOrOptions?.returnObjects) {
        return [];
      }
      const options = typeof fallbackOrOptions === "object" ? fallbackOrOptions : {};
      const template = labels[key] ?? (typeof fallbackOrOptions === "string" ? fallbackOrOptions : String(options.defaultValue ?? key));
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(options[name] ?? ""));
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
  default: (props: { voiceAgentSlug?: string; headline?: ReactNode; subtitle?: ReactNode }) => {
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

function renderMedsScreen(medications: TestMedication[] = [], safety = safetyResponse()) {
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
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the health-style meds layout and keeps the schedule hidden by default", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("voice-hero")).toBeInTheDocument();
    expect(mocks.voiceHero).toHaveBeenCalledWith(expect.objectContaining({
      voiceAgentSlug: "meds",
    }));
    expect(screen.queryByText("Today's Schedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-no-medications")).not.toBeInTheDocument();
    expect(screen.queryByText("Medication")).not.toBeInTheDocument();

    expect(screen.getByTestId("button-meds-primary-reminders")).toHaveTextContent("Reminders");
    expect(screen.getByTestId("button-meds-primary-refills")).toHaveTextContent("Refills");
    expect(screen.getByTestId("button-meds-primary-interactions")).toHaveTextContent("Interactions");
    expect(screen.getByTestId("button-meds-primary-adherence")).toHaveTextContent("Adherence");
    expect(screen.getByTestId("button-meds-primary-safety")).toHaveTextContent("Safety signals");
    expect(screen.getByTestId("grid-meds-primary-actions")).toHaveClass("min-[340px]:grid-cols-2");

    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("I can help you with");
    expect(screen.getByTestId("button-assistant-naturalMedicine")).toHaveTextContent("Natural Options");
    expect(screen.getByTestId("button-assistant-advances")).toHaveTextContent("Medication Research");
    expect(screen.getByTestId("button-assistant-sideEffects")).toHaveTextContent("Side Effect Check");
    expect(screen.queryByTestId("button-assistant-interactions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-assistant-order")).not.toBeInTheDocument();
  });

  it("uses the next pending dose as the hero reminder", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-06-26T07:50:00"));

    renderMedsScreen([
      {
        id: "med-monoprost",
        medication_name: "Monoprost",
        dosage: "1 drop",
        frequency: "once_daily",
        scheduled_times: ["08:00"],
        takenToday: false,
        takenCountToday: 0,
        scheduledCountToday: 1,
      },
    ]);

    await waitFor(() => {
      const props = mocks.voiceHero.mock.calls.at(-1)?.[0] as {
        headline?: { props?: { children?: unknown } };
        subtitle?: unknown;
      };

      expect(props.headline?.props?.children).toBe("Don't forget your\nMonoprost");
      expect(props.subtitle).toBe("Due in 10 min. Tap Reminders when done.");
    });

    vi.useRealTimers();
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
    expect(screen.getAllByRole("button", { name: "Add by voice" })).toHaveLength(1);
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
