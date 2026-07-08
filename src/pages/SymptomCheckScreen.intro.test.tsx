import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssessmentConfidenceTracker, IntroScreen } from "./SymptomCheckScreen";
import type { TriagePersonalizedSuggestion } from "@/triage";

const { apiFetchMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: apiFetchMock,
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

describe("SymptomCheck intro chips", () => {
  afterEach(() => {
    vi.useRealTimers();
    apiFetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  const profileSuggestions: TriagePersonalizedSuggestion[] = [
    {
      id: "heart-chest-pressure",
      kind: "common_concern",
      label: "Chest pressure or tightness",
      description: "VYVA will check warning signs first.",
      initialClue: "Chest pressure or tightness",
      tone: "red",
      icon: "heart",
      source: "profile",
      priority: 99,
      reasonCode: "condition_match",
      score: 3430,
    },
    {
      id: "heart-bp-check",
      kind: "health_improvement",
      label: "Blood pressure check",
      description: "Add a BP reading before deciding next steps.",
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      source: "profile",
      priority: 90,
      reasonCode: "condition_match",
      score: 3421,
    },
  ];

  it("shows a dynamic confidence tracker instead of a plain progress bar", () => {
    const { rerender } = render(<AssessmentConfidenceTracker current="chat" variant="compact" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Confidence improving");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Medium");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Safety check");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByTestId("assessment-confidence-signals")).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    rerender(<AssessmentConfidenceTracker current="report" />);

    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("Ready to guide");
    expect(screen.getByTestId("assessment-confidence-tracker")).toHaveTextContent("High");
    expect(screen.getByRole("meter", { name: "Confidence level" })).toHaveAttribute("aria-valuenow", "5");
  });

  it("renders one senior-friendly start panel", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    expect(screen.getByTestId("symptom-emergency-modal")).toHaveTextContent("If this feels urgent, do not wait");
    expect(screen.getByTestId("symptom-check-start-panel")).toHaveTextContent("Tell VYVA what has changed");
    expect(screen.getByPlaceholderText("Type what changed...")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start check" })).toBeVisible();
    expect(screen.getByText("How VYVA helps")).toBeVisible();
    expect(screen.queryByTestId("symptom-check-one-question-note")).not.toBeInTheDocument();
    expect(screen.queryByText("One question at a time")).not.toBeInTheDocument();
    expect(screen.queryByText("Profile tuned")).not.toBeInTheDocument();
    expect(screen.queryByText("Common concerns from your profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Ways to improve health")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/button-symptom-example-/)).toHaveLength(3);
  });

  it("dismisses the emergency modal before the symptom check", () => {
    render(<IntroScreen onStart={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "I understand, continue to symptom check" }));

    expect(screen.queryByTestId("symptom-emergency-modal")).not.toBeInTheDocument();
    expect(screen.getByTestId("input-symptom-clue")).toBeVisible();
  });

  it("uses a single voice entry point when Talk to VYVA is available", () => {
    render(<IntroScreen onStart={vi.fn()} onTalkToVyva={vi.fn()} />);

    expect(screen.getByTestId("button-symptom-check-talk-to-vyva")).toHaveTextContent("Talk to VYVA");
    expect(screen.queryByTestId("button-symptom-clue-voice")).not.toBeInTheDocument();
  });

  it("starts a guided check when the emergency uncertainty action is used", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} />);

    fireEvent.click(screen.getByRole("button", { name: "Help me decide" }));

    expect(onStart).toHaveBeenCalledWith("I am not sure if this is urgent");
  });

  it("shows profile-aware examples and keeps extra ideas collapsed", () => {
    render(
      <IntroScreen
        onStart={vi.fn()}
        personalizedSuggestions={profileSuggestions}
        profileContextItems={["medications", "latest vitals"]}
      />,
    );

    expect(screen.getByRole("button", { name: /Chest pressure or tightness/i })).toBeVisible();
    expect(screen.getByText("More ideas")).toBeVisible();
    expect(screen.getByRole("button", { name: /Blood pressure check/i })).not.toBeVisible();

    fireEvent.click(screen.getByText("More ideas"));

    expect(screen.getByRole("button", { name: /Blood pressure check/i })).toBeVisible();
    expect(screen.getByText("Profile tuned")).toBeVisible();
    expect(screen.queryByText("condition_match")).not.toBeInTheDocument();
    expect(screen.queryByText("3430")).not.toBeInTheDocument();
  });

  it("fills the symptom input from a concern chip and keeps Continue explicit", () => {
    const onStart = vi.fn();
    render(<IntroScreen onStart={onStart} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByRole("button", { name: /Chest pressure or tightness/i }));

    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("Chest pressure or tightness");
    expect(onStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Start check" }));

    expect(onStart).toHaveBeenCalledWith("Chest pressure or tightness");
  });

  it("fills the symptom input from the voice transcription button", async () => {
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    });

    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["symptom voice audio content with enough bytes"], { type: "audio/webm" }),
        } as BlobEvent);
        this.onstop?.(new Event("stop"));
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ transcript: "bad headache" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<IntroScreen onStart={vi.fn()} />);

    const voiceButton = screen.getByTestId("button-symptom-clue-voice");
    fireEvent.click(voiceButton);

    expect(await screen.findByText("Listening... tap again to stop. It stops after 30 seconds.")).toBeVisible();

    fireEvent.click(voiceButton);

    await waitFor(() => {
      expect(screen.getByTestId("input-symptom-clue")).toHaveValue("bad headache");
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/api/triage/transcribe?language=en", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
    }));
    expect(trackStop).toHaveBeenCalled();
  });

  it("automatically stops voice capture after the safety limit", async () => {
    vi.useFakeTimers();
    const trackStop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    });
    const recorderStop = vi.fn();

    class MockMediaRecorder {
      static isTypeSupported = vi.fn(() => true);
      mimeType = "audio/webm";
      state: RecordingState = "inactive";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;

      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {}

      start() {
        this.state = "recording";
      }

      stop() {
        recorderStop();
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["automatic stop voice audio content with enough bytes"], { type: "audio/webm" }),
        } as BlobEvent);
        this.onstop?.(new Event("stop"));
      }
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    vi.stubGlobal("MediaRecorder", MockMediaRecorder);
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({ transcript: "aching back" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    render(<IntroScreen onStart={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("button-symptom-clue-voice"));
      await Promise.resolve();
    });
    expect(screen.getByText("Listening... tap again to stop. It stops after 30 seconds.")).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(recorderStop).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("input-symptom-clue")).toHaveValue("aching back");
    expect(trackStop).toHaveBeenCalled();
  });

  it("opens support routes from improvement chips", () => {
    const onNavigate = vi.fn();
    render(<IntroScreen onStart={vi.fn()} onNavigate={onNavigate} personalizedSuggestions={profileSuggestions} />);

    fireEvent.click(screen.getByText("More ideas"));
    fireEvent.click(screen.getByRole("button", { name: /Blood pressure check/i }));

    expect(onNavigate).toHaveBeenCalledWith("/health/vitals");
  });

  it("shows three fallback example chips and moves other ideas behind disclosure", () => {
    render(<IntroScreen onStart={vi.fn()} personalizedSuggestions={[]} />);

    expect(screen.queryByText("Helpful starts")).not.toBeInTheDocument();
    expect(screen.queryByText("Common concerns to start with")).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/button-symptom-example-/)).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Breathing feels different/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Dizzy or weak/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /Check vitals/i })).not.toBeVisible();

    fireEvent.click(screen.getByText("More ideas"));

    expect(screen.getByRole("button", { name: /Check vitals/i })).toBeVisible();
  });
});
