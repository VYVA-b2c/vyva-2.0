import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VitalsTracker, { vitalsSafetyActionKindsFor } from "./VitalsTracker";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

function latestResponse(recommendedAction: string, acknowledgedAt?: string) {
  return new Response(JSON.stringify({
    analysis: {
      id: "analysis-1",
      analysed_at: "2026-06-01T10:00:00.000Z",
      recommended_action: recommendedAction,
      risk_score: recommendedAction === "urgent_help" ? 86 : 62,
      senior_message: recommendedAction === "urgent_help"
        ? "Your readings need urgent support."
        : "Please speak with your doctor about this reading.",
      acknowledged_at: acknowledgedAt ?? null,
    },
    recent_readings: [
      {
        signal_type: "resting_hr_bpm",
        value: 112,
        recorded_at: "2026-06-01T10:00:00.000Z",
        source: "manual",
        deviation_pct: 28,
        context_tag: "general",
      },
    ],
    latest_alert: null,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function acknowledgeResponse() {
  return new Response(JSON.stringify({
    id: "analysis-1",
    acknowledged_at: "2026-06-01T10:05:00.000Z",
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function setupApi(recommendedAction: string, acknowledgedAt?: string) {
  apiFetchMock.mockImplementation(async (url) => {
    if (String(url).includes("/api/vitals-engine/acknowledge")) return acknowledgeResponse();
    return latestResponse(recommendedAction, acknowledgedAt);
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state)}</pre>
    </>
  );
}

function renderTracker(
  recommendedAction: string,
  props: Partial<ComponentProps<typeof VitalsTracker>> = {},
  acknowledgedAt?: string,
) {
  setupApi(recommendedAction, acknowledgedAt);
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/health/vitals"]}>
      <Routes>
        <Route
          path="/health/vitals"
          element={(
            <VitalsTracker
              userId="user-1"
              userConditions={[]}
              language="en"
              {...props}
            />
          )}
        />
        <Route path="/health/doctor" element={<LocationProbe />} />
        <Route path="/onboarding/profile/gp" element={<LocationProbe />} />
        <Route path="/concierge" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Vitals safety service actions", () => {
  afterEach(() => {
    apiFetchMock.mockReset();
  });

  it("maps doctor safety advice to direct GP contact and doctor help", () => {
    expect(vitalsSafetyActionKindsFor("contact_doctor", {
      hasGpPhone: true,
      hasGpEmail: true,
    })).toEqual(["call_gp", "email_gp", "doctor_help", "schedule_appointment", "book_ride"]);
  });

  it("keeps the compact risk summary while omitting the detailed safety panel", async () => {
    renderTracker("urgent_help", { country: "US" });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/latest"));
    expect(screen.getByTestId("personalized-vitals-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("daily-safety-check")).not.toBeInTheDocument();
    expect(screen.getByTestId("vitals-risk-score")).toBeInTheDocument();
  });

  it("does not report a default zero risk score while the assessment is loading", () => {
    apiFetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <VitalsTracker userId="user-1" userConditions={[]} language="en" />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId("vitals-risk-score")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});
