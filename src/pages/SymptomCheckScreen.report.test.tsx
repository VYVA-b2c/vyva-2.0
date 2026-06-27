import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/health/symptom-check"]}>
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
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-emergency")).toHaveTextContent("Call 112 now");
  });

  it("keeps one direct GP primary action and moves share controls behind disclosure", () => {
    renderReport({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    expect(screen.getByTestId("button-report-call-gp")).toHaveTextContent("Call GP");
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-report-share")).not.toBeVisible();
    expect(screen.getByTestId("button-report-view-reports")).not.toBeVisible();

    fireEvent.click(screen.getByText("Share or save"));

    expect(screen.getByTestId("button-report-share")).toBeVisible();
    expect(screen.getByTestId("button-report-view-reports")).toBeVisible();
  });

  it("offers doctor contact setup from the doctor details row when GP contact is missing", async () => {
    renderReport();

    expect(screen.getByTestId("button-report-doctor")).toHaveTextContent("Talk to doctor");
    expect(screen.queryByTestId("report-next-step-actions")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Details for doctor"));
    const addDoctor = screen.getByTestId("button-report-add-doctor-contact");

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

  it("shows two Do now steps by default and collapses supporting report detail", () => {
    renderReport({}, {
      summaryOverride: {
        recommendations: [
          "Drink water now",
          "Rest somewhere cool",
          "Call a doctor if symptoms worsen",
          "Write down any new symptoms",
        ],
        triageReasons: ["Symptoms were mild and stable."],
        watchSigns: ["Chest pain", "Confusion"],
        vitalsNotes: ["Heart Rate: 72 bpm"],
        evidenceSummary: "Checked trusted guidance.",
      },
    });

    expect(screen.queryByTestId("card-report-next-step-explainer")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-report-do-now")).toHaveTextContent("Drink water now");
    expect(screen.getByTestId("card-report-do-now")).toHaveTextContent("Rest somewhere cool");
    expect(screen.getByTestId("report-all-steps")).toHaveTextContent("Show all steps");
    expect(screen.getByText("Why this answer")).toBeVisible();
    expect(screen.getByText("What to watch for")).toBeVisible();
    expect(screen.getByText("Readings used")).toBeVisible();
    expect(screen.getByText("Full report")).toBeVisible();
    screen.getAllByText("Chest pain").forEach((match) => {
      expect(match).not.toBeVisible();
    });

    fireEvent.click(screen.getByText("Show all steps"));

    expect(within(screen.getByTestId("report-all-steps")).getByText("Call a doctor if symptoms worsen")).toBeVisible();
    expect(within(screen.getByTestId("report-all-steps")).getByText("Write down any new symptoms")).toBeVisible();
  });

  it("renders vital refinement as an action, not a passive note", () => {
    renderReport({}, {
      summaryOverride: {
        chiefComplaint: "Blood pressure feels high",
        symptoms: ["blood pressure"],
        triageReasons: ["Blood pressure was mentioned."],
      },
    });

    expect(screen.getByTestId("card-report-vital-refinement-note")).toHaveTextContent("Check blood pressure now");
    expect(screen.getByTestId("button-report-vital-add-bloodPressure")).toHaveTextContent("Add reading");
    expect(screen.queryByText("A relevant reading can help VYVA update this assessment. Phone estimates are useful for trends; device or manual readings are stronger evidence.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-report-vital-add-bloodPressure"));

    expect(screen.getByPlaceholderText("120/80")).toBeVisible();
  });
});
