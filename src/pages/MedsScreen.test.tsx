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
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: mocks.apiFetch,
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

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ profile: {} }),
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

  it("does not repeat Add by voice in the empty schedule state", async () => {
    renderMedsScreen();

    expect(await screen.findByTestId("status-no-medications")).toBeInTheDocument();
    expect(screen.getByTestId("button-meds-add-by-voice-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("button-meds-add-by-voice")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-confirm-all-meds")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add by voice" })).toHaveLength(1);
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
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
