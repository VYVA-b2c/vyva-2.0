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
    t: (key: string, fallbackOrOptions?: string | { returnObjects?: boolean }) => {
      if (key === "meds.headlines" && typeof fallbackOrOptions === "object" && fallbackOrOptions?.returnObjects) {
        return [];
      }
      return labels[key] ?? (typeof fallbackOrOptions === "string" ? fallbackOrOptions : key);
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
  default: () => <div data-testid="voice-hero" />,
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

function renderMedsScreen(medications: TestMedication[] = []) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/meds/adherence-report/today") {
            return { medications };
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

  it("renders the health-style meds layout and keeps the schedule hidden by default", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("voice-hero")).toBeInTheDocument();
    expect(screen.queryByText("Today's Schedule")).not.toBeInTheDocument();
    expect(screen.queryByTestId("status-no-medications")).not.toBeInTheDocument();

    expect(screen.getByTestId("button-meds-primary-reminders")).toHaveTextContent("Reminders");
    expect(screen.getByTestId("button-meds-primary-refills")).toHaveTextContent("Refills");
    expect(screen.getByTestId("button-meds-primary-interactions")).toHaveTextContent("Interactions");
    expect(screen.getByTestId("button-meds-primary-adherence")).toHaveTextContent("Adherence");

    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("section-meds-can-help")).toHaveTextContent("I can help you with");
    expect(screen.getByTestId("button-assistant-naturalMedicine")).toHaveTextContent("Natural Options");
    expect(screen.getByTestId("button-assistant-advances")).toHaveTextContent("Medication Research");
    expect(screen.getByTestId("button-assistant-sideEffects")).toHaveTextContent("Side Effect Check");
    expect(screen.queryByTestId("button-assistant-interactions")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-assistant-order")).not.toBeInTheDocument();
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
