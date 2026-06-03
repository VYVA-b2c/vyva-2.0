import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ReportScreen } from "./SymptomCheckScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string, values?: Record<string, unknown>) => {
        if (!fallback) return _key;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? `{{${key}}}`));
      },
    }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state)}</span>
    </>
  );
}

type ReportScreenProps = ComponentProps<typeof ReportScreen>;

const summary: ReportScreenProps["summary"] = {
  chiefComplaint: "Chest discomfort",
  symptoms: ["pressure"],
  urgency: "routine",
  recommendations: [],
  disclaimer: "This is not emergency medical care.",
  nextStepLabel: "Talk to a doctor today",
  nextStepLevel: "doctor_today",
  triageReasons: [],
  watchSigns: [],
};

function renderReport(
  profileContacts: { gpPhone?: string | null; gpEmail?: string | null } = {},
  options: {
    summaryOverride?: Partial<ReportScreenProps["summary"]>;
    emergencyContact?: { label: string; telHref?: string };
  } = {},
) {
  return render(
    <MemoryRouter initialEntries={["/health/symptom-check"]}>
      <LocationProbe />
      <ReportScreen
        summary={{ ...summary, ...options.summaryOverride }}
        bpm={null}
        respiratoryRate={null}
        durationSeconds={null}
        reportId="report-1"
        profileContacts={profileContacts}
        careTeamMembers={[]}
        emergencyContact={options.emergencyContact ?? null}
        refinementStatus={{ state: "idle" }}
        onRefineVital={vi.fn(async () => undefined)}
        onDone={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SymptomCheck report service actions", () => {
  it("puts an emergency call action on the live next step when an emergency number is known", () => {
    renderReport(
      {},
      {
        emergencyContact: { label: "112", telHref: "tel:112" },
        summaryOverride: {
          urgency: "urgent",
          nextStepLevel: "emergency",
          nextStepLabel: "Call emergency services now",
        },
      },
    );

    expect(screen.getByTestId("button-report-emergency")).toHaveTextContent("Call 112");
    expect(screen.getByTestId("button-report-next-step-action-0-call_emergency")).toHaveAttribute("href", "tel:112");
  });

  it("puts direct GP call and email actions on the live next step", () => {
    renderReport({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    expect(screen.getByTestId("button-report-call-gp")).toHaveTextContent("Call GP");
    expect(screen.getByTestId("button-report-next-step-action-0-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-report-next-step-action-1-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-report-next-step-action-2-doctor_help")).toBeInTheDocument();
  });

  it("offers doctor contact setup directly on the live next step when GP contact is missing", async () => {
    renderReport();

    expect(screen.getByTestId("button-report-doctor")).toHaveTextContent("Talk to doctor");
    expect(screen.getByTestId("button-report-next-step-action-0-doctor_help")).toBeInTheDocument();
    const addDoctor = screen.getByTestId("button-report-next-step-action-1-add_doctor_contact");

    fireEvent.click(addDoctor);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/gp");
    });
  });

  it("routes practical hydration advice to a support package instead of a generic order", async () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: ["Stay hydrated and drink fluids"],
      },
    });

    const packageAction = screen.getByTestId("button-report-action-0-online_order");
    expect(packageAction).toHaveTextContent("Get support package");

    fireEvent.click(packageAction);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"packageId\":\"hydration_support\"");
      expect(screen.getByTestId("route-state")).toHaveTextContent("\"sourceRecommendation\":\"Stay hydrated and drink fluids\"");
    });
  });

  it("does not show a package action when fluids are part of a medical warning", () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: ["Talk to a doctor today if symptoms worsen or fluids are difficult."],
      },
    });

    expect(screen.getByTestId("button-report-action-0-doctor_help")).toBeInTheDocument();
    expect(screen.queryByTestId("button-report-action-0-online_order")).not.toBeInTheDocument();
    expect(screen.queryByText("Get support package")).not.toBeInTheDocument();
  });
});
