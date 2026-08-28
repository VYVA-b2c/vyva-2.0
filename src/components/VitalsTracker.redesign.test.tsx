import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import VitalsTracker, { type VitalsTrackerPreviewData } from "./VitalsTracker";
import VitalsAddReadingFlow, { type VitalsAcquisitionContext } from "./VitalsAddReadingFlow";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));

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
    { signal_type: "mood_score", value: 8, recorded_at: "2026-08-28T07:58:00.000Z", source: "manual_entry", source_confidence: "medium", deviation_pct: 0, context_tag: "general" },
  ],
  latest_alert: null,
};

function renderTracker() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <VitalsTracker userId="preview-user" userConditions={[]} language="en" previewData={previewData} />
    </MemoryRouter>,
  );
}

describe("VitalsTracker redesign", () => {
  it("uses the real safety label, hides raw risk by default, and groups readings", () => {
    renderTracker();

    expect(screen.getByTestId("vitals-hero")).toHaveTextContent("Steady");
    expect(screen.queryByText("Risk score: 16/100 — lower is better.")).not.toBeInTheDocument();
    expect(screen.getByTestId("vitals-hero-metrics")).toHaveTextContent("Pulse: 72 bpm");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Heart");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Breathing");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Wellbeing");
    expect(screen.getByLabelText("Device - High")).toHaveTextContent("Device");

    fireEvent.click(screen.getByRole("button", { name: "See details" }));
    expect(screen.getByTestId("vitals-risk-details")).toHaveTextContent("Risk score: 16/100 — lower is better.");
  });

  it("opens a vital-first picker and keeps phone camera separate from device photo", () => {
    renderTracker();
    fireEvent.click(screen.getByTestId("button-vitals-hero-add"));

    expect(screen.getByRole("heading", { name: "What would you like to add?" })).toBeVisible();
    expect(screen.queryByText("Heart rate variability")).not.toBeInTheDocument();
    expect(screen.queryByText("Steps")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-vital-resting_hr_bpm"));
    expect(screen.getByTestId("vitals-method-picker")).toBeVisible();
    expect(screen.getByTestId("button-method-phone_camera")).toHaveTextContent("Phone camera");
    expect(screen.getByTestId("button-method-device_photo")).toHaveTextContent("Device photo");
    expect(screen.getByTestId("button-method-web_bluetooth")).toBeVisible();
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
