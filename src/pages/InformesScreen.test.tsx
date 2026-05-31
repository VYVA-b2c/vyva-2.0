import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetailView } from "./InformesScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallback?: string) => fallback ?? _key,
    }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
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

function renderDetail(profile: unknown) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async () => profile,
      },
    },
  });
  queryClient.setQueryData(["/api/profile"], profile);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/informes/report-1"]}>
        <LocationProbe />
        <DetailView report={report} onBack={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Informes report detail actions", () => {
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
