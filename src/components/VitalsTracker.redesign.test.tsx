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
  it("uses the real safety label, shows a labelled risk score, and declutters untracked readings", () => {
    renderTracker();

    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("Steady");
    expect(screen.getByTestId("vitals-hero")).toHaveClass("-mx-2", "sm:-mx-4", "lg:-mx-14");
    expect(screen.getByLabelText("Steady")).toBeVisible();
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Risk score");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("16/100");
    expect(screen.getByTestId("vitals-risk-score")).toHaveTextContent("Lower is better");
    expect(screen.getByTestId("vitals-risk-score")).toHaveClass("sm:mx-auto", "sm:w-[380px]");
    expect(screen.queryByTestId("vitals-hero-marker")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Latest readings 1" }));
    expect(screen.queryByTestId("vitals-risk-score")).not.toBeInTheDocument();
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("Heart rate");
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("72 bpm");
    expect(screen.getByTestId("vitals-hero-marker")).toHaveClass("sm:mx-auto", "sm:w-[380px]");
    fireEvent.click(screen.getByRole("button", { name: "Latest readings 2" }));
    expect(screen.getByTestId("vitals-hero-marker")).toHaveTextContent("Oxygen");
    expect(screen.getByTestId("vitals-hero-marker")).not.toHaveTextContent("0%");
    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("Your latest readings look steady.");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Heart");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Breathing");
    expect(screen.getByTestId("vitals-reading-groups")).toHaveTextContent("Wellbeing");
    expect(screen.getByLabelText("Device - High")).toHaveTextContent("Device");
    expect(screen.getByTestId("vitals-more-readings")).toHaveTextContent("More vitals");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveAccessibleName("Add reading");
    expect(screen.getByTestId("button-vitals-hero-add")).not.toHaveTextContent("Add reading");
    expect(screen.getByTestId("button-vitals-hero-add")).toHaveClass("right-6", "top-[26px]", "sm:right-8");

    fireEvent.click(screen.getByText("How VYVA connects your health signals"));
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("personal baseline");
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("signals that move together");
    expect(screen.getByTestId("vitals-evidence-guide")).toHaveTextContent("anticipate possible outcomes and flag risks");
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

    expect(screen.getByTestId("vitals-hero")).not.toHaveTextContent("VYVA noticed a change worth same-day medical advice.");
    expect(screen.getByTestId("daily-safety-check")).toHaveTextContent("Rapport de symptômes : Douleur à la tête ou au cou");
    expect(screen.getByTestId("button-safety-call-gp")).toHaveTextContent("Appeler Quiron");
    expect(screen.getByTestId("button-safety-email-gp")).toHaveTextContent("Envoyer un e-mail au médecin");
    expect(screen.getByTestId("button-safety-doctor-help")).toHaveTextContent("Aide médicale");
    expect(screen.getByTestId("button-safety-schedule-appointment")).toHaveTextContent("Prendre rendez-vous");
    expect(screen.getByTestId("button-safety-book-ride")).toHaveTextContent("Trouver un transport");
    expect(screen.queryByText(/VYVA noticed|Symptom report|Next:|Doctor help|Book appointment|Find transport/i)).not.toBeInTheDocument();
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
