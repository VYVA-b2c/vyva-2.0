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
  chiefComplaint: "Stomach symptoms",
  symptoms: ["nausea"],
  urgency: "routine",
  recommendations: [],
  disclaimer: "This is not emergency medical care.",
  nextStepLabel: "Talk to a doctor today",
  nextStepLevel: "doctor_today",
  triageReasons: [],
  watchSigns: [],
};

function renderReport(summaryOverride: Partial<ReportScreenProps["summary"]> = {}) {
  return render(
    <MemoryRouter initialEntries={["/health/symptom-check"]}>
      <LocationProbe />
      <ReportScreen
        summary={{ ...summary, ...summaryOverride }}
        bpm={null}
        respiratoryRate={null}
        durationSeconds={null}
        reportId="report-1"
        profileContacts={{}}
        careTeamMembers={[]}
        emergencyContact={null}
        refinementStatus={{ state: "idle" }}
        onRefineVital={vi.fn(async () => undefined)}
        onDone={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SymptomCheck report support package actions", () => {
  it("routes practical hydration advice to a support package instead of a generic order", async () => {
    renderReport({
      recommendations: ["Stay hydrated and drink fluids"],
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
    renderReport({
      recommendations: ["Talk to a doctor today if symptoms worsen or fluids are difficult."],
    });

    expect(screen.getByTestId("button-report-action-0-doctor_help")).toBeInTheDocument();
    expect(screen.queryByTestId("button-report-action-0-online_order")).not.toBeInTheDocument();
    expect(screen.queryByText("Get support package")).not.toBeInTheDocument();
  });
});
