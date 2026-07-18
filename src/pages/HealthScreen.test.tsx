import { fireEvent, render, screen } from "@testing-library/react";
import type { TFunction } from "i18next";
import { describe, expect, it, vi } from "vitest";
import { translate } from "@/i18n";
import {
  DailyCheckinCard,
  profileLocationFromParts,
  VisualHealthScanCardContent,
  VisualScanResultPanel,
  visualScanDoctorContext,
  visualScanServiceActionKindsFor,
} from "./HealthScreen";
import { SHOW_VYVA_USE_CASE_IDS } from "../../shared/showVyvaFlow";

const spanishT = ((key: string, fallback?: string) => translate("es", key, fallback)) as TFunction;
const englishT = ((key: string, fallback?: string) => translate("en", key, fallback)) as TFunction;

describe("DailyCheckinCard", () => {
  it("uses localized Spanish copy instead of English API status copy", () => {
    render(
      <DailyCheckinCard
        checkin={{
          status: "completed",
          date_key: "2026-05-30",
          timezone: "Europe/Madrid",
          schedule: {
            id: "schedule-1",
            active: true,
            times_of_day: ["09:00"],
            next_run_at: "2026-05-31T07:00:00.000Z",
            last_completed_at: "2026-05-30T17:04:00.000Z",
            grace_minutes: 30,
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
          message: "You checked in today. VYVA has a fresh wellbeing signal.",
          action_label: "View history",
        }}
        t={spanishT}
        onPrimary={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(screen.getByText("Control diario")).toBeInTheDocument();
    expect(screen.getByText("Hecho hoy")).toBeInTheDocument();
    expect(screen.getByText("Como estas hoy?")).toBeInTheDocument();
    expect(screen.getByText("VYVA tiene la senal de hoy.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mi plan de salud" })).toBeInTheDocument();
    expect(screen.queryByText("Daily are-you-okay check")).not.toBeInTheDocument();
    expect(screen.queryByText("You checked in today. VYVA has a fresh wellbeing signal.")).not.toBeInTheDocument();
  });
});

describe("VisualHealthScanCardContent", () => {
  it("uses the shared Show VYVA review chooser and category chips", () => {
    const onScanSource = vi.fn();
    const onPasteReview = vi.fn();

    render(
      <VisualHealthScanCardContent
        t={englishT}
        analyzing={false}
        onScanSource={onScanSource}
        onPasteReview={onPasteReview}
      />,
    );

    expect(screen.getByText("Show VYVA")).toBeInTheDocument();
    expect(screen.queryByText("Scan My Wound")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Paste text or link" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(onScanSource).toHaveBeenCalledWith("upload", SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto, "");

    for (const label of ["Wounds", "Bruises", "Fluids", "Stool", "Urine", "X-rays"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});

describe("Find specialist profile location", () => {
  it("does not expose a country code as the whole visible location", () => {
    expect(profileLocationFromParts({ country: "ES" })).toBe("");
  });

  it("uses real area details and expands known country codes", () => {
    expect(profileLocationFromParts({ postalCode: "11380", cityState: "Tarifa", country: "ES" })).toBe("11380, Tarifa, Spain");
  });

  it("uses the full saved street address for specialist searches", () => {
    expect(profileLocationFromParts({
      street: "6 calle montemenor",
      postalCode: "11380",
      cityState: "Tarifa",
      region: "Cadiz",
      country: "ES",
    })).toBe("6 calle montemenor, 11380, Tarifa, Cadiz, Spain");
  });
});

describe("VisualScanResultPanel", () => {
  it("renders structured review sections and the safety disclaimer", () => {
    render(
      <VisualScanResultPanel
        t={englishT}
        onClose={vi.fn()}
        result={{
          severity: "Moderate",
          resultTitle: "Possible X-ray finding",
          advice: "Ask a clinician to review this.",
          imageType: "xray",
          visibleObservations: ["Possible visible line near the ankle"],
          potentialConcerns: ["May warrant radiologist or clinician review"],
          uncertainty: ["Image quality limits confidence"],
          recommendedNextStep: "Ask a qualified clinician to review the image.",
        }}
      />,
    );

    expect(screen.getByText("X-ray")).toBeInTheDocument();
    expect(screen.getByText("What VYVA reviewed")).toBeInTheDocument();
    expect(screen.getByText("What is visible")).toBeInTheDocument();
    expect(screen.getByText("Warning signs")).toBeInTheDocument();
    expect(screen.getByText("What VYVA cannot confirm")).toBeInTheDocument();
    expect(screen.getByText("Risk or urgency")).toBeInTheDocument();
    expect(screen.getByText("Recommended next step")).toBeInTheDocument();
    expect(screen.getByText("Assistive description only, not medical advice or diagnosis. A qualified clinician should review anything concerning.")).toBeInTheDocument();
  });

  it("uses the selected medicine or OTC purpose for uploaded labels", () => {
    render(
      <VisualScanResultPanel
        t={englishT}
        onClose={vi.fn()}
        reviewInput={{
          useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
          source: "upload",
          fileName: "medicine-label.pdf",
          mimeType: "application/pdf",
        }}
        result={{
          severity: "Moderate",
          resultTitle: "Medicine label",
          advice: "Prepare questions before changing anything.",
          imageType: "unclear",
          visibleObservations: ["Dose wording is visible"],
          recommendedNextStep: "Ask a pharmacist to review the label.",
        }}
      />,
    );

    expect(screen.getByTestId("show-vyva-result-input-health-current")).toHaveTextContent("Uploaded document");
    expect(screen.getByText("Pharmacist questions")).toBeInTheDocument();
    expect(screen.getByText("Review safety")).toBeInTheDocument();
    expect(screen.queryByText("Next health step")).not.toBeInTheDocument();
  });

  it("renders senior-friendly service actions when clinical review is suggested", () => {
    const doctorHelp = vi.fn();
    const appointment = vi.fn();
    const ride = vi.fn();

    render(
      <VisualScanResultPanel
        t={englishT}
        onClose={vi.fn()}
        actions={[
          { kind: "call_gp", label: "Call GP", Icon: vi.fn(() => null), href: "tel:+34612345678" },
          { kind: "email_gp", label: "Email GP", Icon: vi.fn(() => null), href: "mailto:gp@example.com" },
          { kind: "doctor_help", label: "Doctor help", Icon: vi.fn(() => null), onClick: doctorHelp },
          { kind: "schedule_appointment", label: "Appointment", Icon: vi.fn(() => null), onClick: appointment },
          { kind: "book_ride", label: "Find transport", Icon: vi.fn(() => null), onClick: ride },
        ]}
        result={{
          severity: "Moderate",
          resultTitle: "Possible X-ray finding",
          advice: "Ask a clinician to review this.",
          imageType: "xray",
          recommendedNextStep: "Ask a qualified clinician to review the image.",
        }}
      />,
    );

    expect(screen.getByTestId("show-vyva-follow-up-health-current")).toBeInTheDocument();
    expect(screen.getByText("Ask VYVA to help or save for later")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-doctor_help-health-current"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-schedule_appointment-health-current"));
    fireEvent.click(screen.getByTestId("button-show-vyva-follow-up-book_ride-health-current"));

    expect(doctorHelp).toHaveBeenCalledTimes(1);
    expect(appointment).toHaveBeenCalledTimes(1);
    expect(ride).toHaveBeenCalledTimes(1);
  });

  it("maps visual scan review advice to doctor, appointment, and ride actions", () => {
    const result = {
      severity: "Moderate",
      resultTitle: "Possible skin concern",
      advice: "Ask a clinician to review this.",
      imageType: "skin_lesion" as const,
      recommendedNextStep: "Book a clinical review.",
    };

    expect(visualScanServiceActionKindsFor(result)).toEqual([
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(visualScanServiceActionKindsFor(result, { hasGpPhone: true, hasGpEmail: true })).toEqual([
      "call_gp",
      "email_gp",
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(visualScanDoctorContext(result)).toContain("VYVA visual health scan");
    expect(visualScanDoctorContext(result)).toContain("Suggested next step: Book a clinical review.");
  });
});
