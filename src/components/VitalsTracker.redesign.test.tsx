import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VitalsTracker, { type VitalsTrackerPreviewData } from "./VitalsTracker";
import VitalsAddReadingFlow, { type VitalsAcquisitionContext } from "./VitalsAddReadingFlow";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

afterEach(() => {
  apiFetchMock.mockReset();
  delete (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS;
});

const previewData: VitalsTrackerPreviewData = {
  analysis: {
    safety_status: "steady",
    recommended_action: "steady",
    risk_score: 16,
    senior_message: "Your latest readings look steady.",
  },
  recent_readings: [
    { signal_type: "resting_hr_bpm", value: 72, recorded_at: "2026-08-28T08:00:00.000Z", source: "manual_entry", source_confidence: "high", deviation_pct: 1, context_tag: "resting" },
    { signal_type: "oxygen_saturation", value: 98, recorded_at: "2026-08-28T07:59:00.000Z", source: "connected_device", source_confidence: "high", deviation_pct: 0, context_tag: "resting", capture_method: "web_bluetooth", source_ref: { device_name: "Pulse oximeter" } },
    { signal_type: "mood_score", value: 8, recorded_at: "2026-08-28T07:58:00.000Z", source: "manual_entry", source_confidence: "medium", deviation_pct: 0, context_tag: "general", source_display_label: "Latest chat conversation", source_ref: { conversation_channel: "chat", agent_name: "VYVA" } },
  ],
  latest_alert: null,
};

function renderTracker(onVoiceStateChange?: Parameters<typeof VitalsTracker>[0]["onVoiceStateChange"]) {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VitalsTracker userId="preview-user" userConditions={[]} language="en" previewData={previewData} onVoiceStateChange={onVoiceStateChange} />
    </MemoryRouter>,
  );
}

describe("VitalsTracker redesign", () => {
  it("shows a large personalized dashboard without the risk-led presentation", () => {
    renderTracker();

    expect(screen.queryByText("Your vitals today")).not.toBeInTheDocument();
    expect(screen.getByTestId("personalized-vitals-grid")).toHaveClass("md:grid-cols-2");
    expect(screen.getByTestId("vitals-dashboard-card-mood_score")).toHaveTextContent("Sentiment");
    expect(screen.getByTestId("vitals-dashboard-card-mood_score")).toHaveTextContent("8 /10");
    expect(screen.getByTestId("vitals-dashboard-card-mood_score")).toHaveTextContent("Latest chat conversation");
    expect(screen.getByTestId("vitals-dashboard-card-resting_hr_bpm")).toHaveTextContent("72 bpm");
    expect(screen.getByTestId("vitals-dashboard-card-oxygen_saturation")).toHaveTextContent("98 %");
    expect(screen.getByTestId("vitals-dashboard-card-oxygen_saturation")).toHaveTextContent("Pulse oximeter");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Risk score");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("16");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("All good · Lower is better");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveAccessibleName("Capture latest vitals");
    expect(screen.queryByTestId("daily-safety-check")).not.toBeInTheDocument();
  });

  it("promotes genuine glucose data ahead of mood for a diabetic profile", () => {
    const diabeticPreview: VitalsTrackerPreviewData = {
      analysis: null,
      recent_readings: [{
        signal_type: "glucose_mgdl",
        value: 136,
        recorded_at: "2026-09-19T08:30:00.000Z",
        source: "connected_device",
        source_confidence: "high",
        deviation_pct: null,
        context_tag: "fasting",
        source_ref: { device_name: "Libre 3" },
      }],
      latest_alert: null,
    };
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VitalsTracker userId="preview-user" userConditions={["Type 2 diabetes"]} language="en" previewData={diabeticPreview} />
      </MemoryRouter>,
    );

    const cards = screen.getByTestId("personalized-vitals-grid").querySelectorAll(":scope > button");
    expect(cards[0]).toHaveAttribute("data-testid", "vitals-dashboard-card-glucose_mgdl");
    expect(cards[0]).toHaveTextContent("136 mg/dL");
    expect(cards[0]).toHaveTextContent("Libre 3");
    expect(cards[1]).toHaveAttribute("data-testid", "vitals-dashboard-card-mood_score");
    expect(cards[1]).toHaveTextContent("No recent insight");
    expect(cards[1]).toHaveTextContent("latest VYVA voice or chat conversation");
  });

  it("opens a vital-first picker and keeps phone camera separate from device photo", () => {
    renderTracker();
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));

    expect(screen.getByRole("heading", { name: "What would you like to add?" })).toBeVisible();
    expect(screen.queryByText("Heart rate variability")).not.toBeInTheDocument();
    expect(screen.queryByText("Steps")).not.toBeInTheDocument();
    expect(screen.getAllByText("Blood pressure")).toHaveLength(2);
    expect(screen.queryByText("Blood pressure top number")).not.toBeInTheDocument();
    expect(screen.queryByText("Blood pressure bottom number")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Systolic blood pressure mmHg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Diastolic blood pressure mmHg" })).toBeVisible();

    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));
    expect(screen.getByTestId("vitals-method-picker")).toBeVisible();
    expect(screen.getByTestId("button-method-phone_camera")).toHaveTextContent("Phone camera");
    expect(screen.getByTestId("button-method-device_photo")).toHaveTextContent("Device photo");
    expect(screen.getByTestId("button-method-web_bluetooth")).toBeVisible();
  });

  it("uses the Rouast camera UI to return heart rate and breathing together", async () => {
    const onVoiceStateChange = vi.fn();
    (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS = 1;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    const data = new Uint8ClampedArray(40 * 40 * 4).fill(120);
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data })),
      })),
    });
    apiFetchMock.mockResolvedValue(new Response(JSON.stringify({
      proposed_readings: [
        {
          signal_type: "resting_hr_bpm",
          value: 70,
          unit: "bpm",
          context_tag: "resting",
          recorded_at: "2026-09-01T10:00:00.000Z",
          source: "phone_estimate",
          capture_method: "phone_camera",
          confidence: "medium",
          explanation: "VitalLens face-scan heart-rate estimate.",
          source_ref: { provider: "rouast_vitallens" },
        },
        {
          signal_type: "respiratory_rate",
          value: 15,
          unit: "/min",
          context_tag: "resting",
          recorded_at: "2026-09-01T10:00:00.000Z",
          source: "phone_estimate",
          capture_method: "phone_camera",
          confidence: "medium",
          explanation: "VitalLens face-scan breathing estimate.",
          source_ref: { provider: "rouast_vitallens" },
        },
      ],
      needs_confirmation: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    renderTracker(onVoiceStateChange);
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));
    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));
    fireEvent.click(screen.getByTestId("button-method-phone_camera"));

    expect(screen.getByTestId("vital-lens-face-scan")).toHaveTextContent("Heart rate & breathing");
    fireEvent.click(screen.getByTestId("button-start-vital-lens-scan"));

    const confirmation = await screen.findByTestId("vitals-confirm-readings");
    expect(screen.getByRole("heading", { name: "Heart rate & breathing" })).toBeVisible();
    expect(confirmation).toHaveTextContent("Pulse: 70 bpm");
    expect(confirmation).toHaveTextContent("Breathing: 15 /min");
    expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/face-scan", expect.objectContaining({ method: "POST" }));
    await waitFor(() => expect(onVoiceStateChange).toHaveBeenCalledWith(expect.objectContaining({
      view: "add_reading",
      stage: "confirm",
      selectedSignal: "resting_hr_bpm",
      selectedSignalLabel: "Heart rate",
      captureMethod: "phone_camera",
      scanStatus: "complete",
      pendingReadings: expect.arrayContaining([
        expect.objectContaining({ signal: "resting_hr_bpm", value: 70 }),
        expect.objectContaining({ signal: "respiratory_rate", value: 15 }),
      ]),
    })));
  });

  it("localizes saved English safety and alert copy when the account language is French", () => {
    const frenchPreview: VitalsTrackerPreviewData = {
      analysis: {
        safety_status: "contact_doctor",
        recommended_action: "contact_doctor",
        risk_score: 62,
        senior_message: "VYVA noticed a change worth same-day medical advice. Share this summary if you can.",
      },
      recent_readings: [],
      latest_alert: {
        id: "alert-1",
        severity: "warning",
        message: "Symptom report: Douleur à la tête ou au cou\nNext: Rest the painful area.",
      },
    };

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VitalsTracker
          userId="preview-user"
          userConditions={[]}
          language="fr"
          gpName="Quiron"
          gpPhone="+34 612 345 678"
          gpEmail="gp@example.com"
          previewData={frenchPreview}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Vos constantes aujourd'hui")).not.toBeInTheDocument();
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Score de risque");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveAccessibleName("Relever les constantes");
    expect(screen.queryByText(/VYVA noticed|Rapport de symptômes|Aide médicale|Prendre rendez-vous|Trouver un transport/i)).not.toBeInTheDocument();
  });
});

describe("VitalsAddReadingFlow current-reading shortcut", () => {
  it("offers the log-anyway escape hatch for a current connected reading", () => {
    const currentReading = {
      signalType: "resting_hr_bpm" as const,
      value: 71,
      unit: "bpm",
      recordedAt: new Date().toISOString(),
      source: "connected_device" as const,
      captureMethod: "web_bluetooth" as const,
      confidence: "high" as const,
      qualityFlag: "clean",
      sourceRef: { device_name: "Heart monitor" },
      freshness: "current" as const,
    };
    const context: VitalsAcquisitionContext = {
      readings: [currentReading],
      signals: [{ signal_type: "resting_hr_bpm", current_reading: currentReading, compatible_methods: ["web_bluetooth", "phone_camera", "device_photo", "voice", "manual"] }],
      devices: [{ deviceName: "Heart monitor", capabilities: ["resting_hr_bpm"] }],
    };

    render(<VitalsAddReadingFlow previewMode previewContext={context} onBack={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));

    expect(screen.getByTestId("vitals-already-tracked")).toHaveTextContent("Heart rate is already being tracked via Heart monitor");
    fireEvent.click(screen.getByRole("button", { name: "Log anyway" }));
    expect(screen.getByTestId("vitals-method-picker")).toBeVisible();
  });
});
