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
    expect(screen.getByRole("button", { name: "Historial" })).toBeInTheDocument();
    expect(screen.queryByText("Daily are-you-okay check")).not.toBeInTheDocument();
    expect(screen.queryByText("You checked in today. VYVA has a fresh wellbeing signal.")).not.toBeInTheDocument();
  });
});

describe("VisualHealthScanCardContent", () => {
  it("uses broader visual health scan copy and category chips", () => {
    render(<VisualHealthScanCardContent t={englishT} analyzing={false} onScan={vi.fn()} />);

    expect(screen.getByText("Visual Health Scan")).toBeInTheDocument();
    expect(screen.queryByText("Scan My Wound")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Take or upload image" })).toBeInTheDocument();

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
    expect(screen.getByText("What VYVA can see")).toBeInTheDocument();
    expect(screen.getByText("What may need review")).toBeInTheDocument();
    expect(screen.getByText("Limits of this image")).toBeInTheDocument();
    expect(screen.getByText("Suggested next step")).toBeInTheDocument();
    expect(screen.getByText("Assistive description only, not medical advice or diagnosis. A qualified clinician should review anything concerning.")).toBeInTheDocument();
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
          { kind: "book_ride", label: "Book ride", Icon: vi.fn(() => null), onClick: ride },
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

    expect(screen.getByTestId("button-visual-scan-action-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-visual-scan-action-email_gp")).toHaveAttribute("href", "mailto:gp@example.com");
    fireEvent.click(screen.getByTestId("button-visual-scan-action-doctor_help"));
    fireEvent.click(screen.getByTestId("button-visual-scan-action-schedule_appointment"));
    fireEvent.click(screen.getByTestId("button-visual-scan-action-book_ride"));

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
