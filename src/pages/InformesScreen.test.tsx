import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView, InformesMain } from "./InformesScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const fallback = typeof fallbackOrValues === "string" ? fallbackOrValues : _key;
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(interpolation?.[key] ?? `{{${key}}}`));
      },
    }),
  };
});

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <span data-testid="location-path">{location.pathname}</span>
      <span data-testid="route-state">{JSON.stringify(location.state ?? {})}</span>
    </>
  );
}

const report = {
  id: "report-1",
  chief_complaint: "Chest discomfort",
  symptoms: ["pressure"],
  urgency: "routine" as const,
  recommendations: ["Contact your doctor today"],
  disclaimer: "This is not emergency medical care.",
  ai_summary: null,
  next_step_label: "Talk to a doctor today",
  next_step_level: "doctor_today" as const,
  triage_reasons: ["Chest pressure can need a same-day check."],
  watch_signs: [],
  profile_considerations: [],
  vitals_notes: [],
  scan_notes: [],
  bpm: null,
  respiratory_rate: null,
  duration_seconds: null,
  created_at: "2026-06-01T09:00:00.000Z",
};

function renderDetail(profile: unknown, reportOverride: Partial<typeof report> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => profile,
      },
    },
  });
  queryClient.setQueryData(["/api/profile"], profile);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/informes/report-1"]}>
        <LocationProbe />
        <DetailView report={{ ...report, ...reportOverride }} onBack={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderMain(profile: unknown, summaryOverride: Partial<{
  latestTriage: typeof report | null;
  latestVitals: unknown;
  todayMeds: { taken: number; total: number; adherencePct: number | null };
}> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => null,
      },
    },
  });
  queryClient.setQueryData(["/api/profile"], profile);
  queryClient.setQueryData(["/api/reports/vitals/history"], { readings: [] });
  queryClient.setQueryData(["/api/reports/summary"], {
    latestTriage: {
      ...report,
      recommendations: [
        "Contact your doctor today",
        "Consider visiting an urgent care center",
      ],
    },
    latestVitals: null,
    todayMeds: { taken: 0, total: 0, adherencePct: null },
    ...summaryOverride,
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/informes"]}>
        <LocationProbe />
        <InformesMain />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Informes report detail actions", () => {
  it("surfaces fast service actions on the reports overview latest report", async () => {
    renderMain({
      country: "ES",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    expect(await screen.findByTestId("latest-report-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-latest-report-service-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-latest-report-service-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-latest-report-service-doctor_help")).toBeInTheDocument();
    expect(screen.getByTestId("button-latest-report-service-book_ride")).toBeInTheDocument();
    expect(screen.getByTestId("button-latest-report-service-schedule_appointment")).toBeInTheDocument();
  });

  it("opens concierge from the reports overview with saved report context", async () => {
    renderMain({
      country: "ES",
      gpPhone: "+34 612 345 678",
    });

    fireEvent.click(await screen.findByTestId("button-latest-report-service-schedule_appointment"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Chest discomfort");
  });

  it("keeps the latest report card open action separate from service buttons", async () => {
    renderMain({
      gpPhone: "+34 612 345 678",
    });

    fireEvent.click(await screen.findByTestId("button-open-latest-symptom-report"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/informes/report-1"));
  });

  it("adds service actions to abnormal vitals on the reports overview", async () => {
    renderMain(
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        latestVitals: {
          id: "vitals-1",
          bpm: 112,
          respiratory_rate: 28,
          recorded_at: "2026-06-01T10:00:00.000Z",
        },
      },
    );

    expect(await screen.findByTestId("reports-vitals-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-reports-vitals-review")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-vitals-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-reports-vitals-call-gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-reports-vitals-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-reports-vitals-email-gp")).toHaveAttribute("href", expect.stringContaining("112%20bpm"));
    expect(screen.getByTestId("button-reports-vitals-doctor")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-vitals-ride")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reports-vitals-appointment"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("112 bpm");
    expect(screen.getByTestId("route-state")).toHaveTextContent("28/min");
  });

  it("keeps normal vitals focused on reviewing readings", async () => {
    renderMain(
      {},
      {
        latestVitals: {
          id: "vitals-1",
          bpm: 72,
          respiratory_rate: 16,
          recorded_at: "2026-06-01T10:00:00.000Z",
        },
      },
    );

    fireEvent.click(await screen.findByTestId("button-reports-vitals-review"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/health/vitals"));
    expect(screen.queryByTestId("button-reports-vitals-doctor")).not.toBeInTheDocument();
  });

  it("adds pharmacy and clinician actions when medication is still pending", async () => {
    renderMain(
      {
        gpName: "Dr Garcia",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        todayMeds: { taken: 1, total: 3, adherencePct: 33 },
      },
    );

    expect(await screen.findByTestId("reports-meds-service-actions")).toHaveTextContent("Fast service access");
    expect(screen.getByTestId("button-reports-meds-review")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-meds-call-gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-reports-meds-call-gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-reports-meds-email-gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-reports-meds-email-gp")).toHaveAttribute("href", expect.stringContaining("1%20of%203"));
    expect(screen.getByTestId("button-reports-meds-doctor")).toBeInTheDocument();
    expect(screen.getByTestId("button-reports-meds-appointment")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-reports-meds-refill"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/concierge/shopping"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"pharmacy_basics\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("1 of 3");
  });

  it("renders direct GP call and email actions for saved recommendations", async () => {
    renderDetail({
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    });

    const call = await screen.findByTestId("button-report-detail-action-0-call_gp");
    const email = await screen.findByTestId("button-report-detail-action-0-email_gp");

    expect(call).toHaveAttribute("href", "tel:+34612345678");
    expect(email).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-report-detail-action-0-doctor_help")).toBeInTheDocument();
  });

  it("renders direct GP actions from the saved next step when recommendations are empty", async () => {
    renderDetail(
      {
        country: "ES",
        gpPhone: "+34 612 345 678",
        gpEmail: "gp@example.com",
      },
      {
        recommendations: [],
        triage_reasons: [],
        next_step_label: "Talk to a doctor today",
      },
    );

    const call = await screen.findByTestId("button-report-detail-next-step-action-0-call_gp");
    const email = await screen.findByTestId("button-report-detail-next-step-action-1-email_gp");

    expect(call).toHaveAttribute("href", "tel:+34612345678");
    expect(email).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-report-detail-next-step-action-2-doctor_help")).toBeInTheDocument();
    expect(screen.queryByTestId("report-detail-actions-0")).not.toBeInTheDocument();
  });

  it("renders an emergency call action from a saved emergency next step", async () => {
    renderDetail(
      { country: "ES" },
      {
        urgency: "urgent",
        recommendations: [],
        triage_reasons: [],
        next_step_label: "Call emergency services now",
        next_step_level: "emergency",
      },
    );

    const emergencyCall = await screen.findByTestId("button-report-detail-next-step-action-0-call_emergency");

    expect(emergencyCall).toHaveAttribute("href", "tel:112");
    expect(emergencyCall).toHaveTextContent("Call 112");
  });

  it("offers doctor setup when no GP contact exists", async () => {
    renderDetail({});

    const addDoctor = await screen.findByTestId("button-report-detail-action-0-add_doctor_contact");
    expect(screen.getByTestId("button-report-detail-action-0-doctor_help")).toBeInTheDocument();

    fireEvent.click(addDoctor);

    await waitFor(() => {
      expect(screen.getByTestId("location-path")).toHaveTextContent("/onboarding/profile/gp");
    });
  });
});
