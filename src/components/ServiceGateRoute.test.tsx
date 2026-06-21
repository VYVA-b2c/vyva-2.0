import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServiceGateRoute from "./ServiceGateRoute";
import type { ReadinessResponse } from "@/hooks/useServiceGate";

const useServiceGateMock = vi.fn();

vi.mock("@/hooks/useServiceGate", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useServiceGate")>();
  return {
    ...actual,
    useServiceGate: () => useServiceGateMock(),
  };
});

function readinessForDoctor(ready: boolean, reason = "Add a GP or care contact first."): ReadinessResponse {
  return {
    profile: {},
    services: {
      medications: { ready: true, missing: [] },
      adherenceReport: { ready: true, missing: [] },
      medicationReminders: { ready: true, missing: [] },
      medicationInteractions: { ready: true, missing: [] },
      sos: { ready: true, missing: [] },
      doctor: {
        ready,
        missing: ready ? [] : [{ section: "gp", path: "/onboarding/profile/gp", reason }],
      },
      localServices: { ready: true, missing: [] },
      specialistFinder: { ready: true, missing: [] },
      reports: { ready: true, missing: [] },
      concierge: { ready: true, missing: [] },
      symptomCheck: { ready: true, missing: [] },
      caregiverDashboard: { ready: true, missing: [] },
      socialRooms: { ready: true, missing: [] },
      activities: { ready: true, missing: [] },
      brainTraining: { ready: true, missing: [] },
      chat: { ready: true, missing: [] },
    },
  };
}

function renderGate(initialPath = "/health/doctor") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ServiceGateRoute service="doctor">
        <div data-testid="doctor-page">Doctor page loaded</div>
      </ServiceGateRoute>
    </MemoryRouter>,
  );
}

describe("ServiceGateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the protected page while the access check is still loading", () => {
    useServiceGateMock.mockReturnValue({
      readiness: undefined,
      isLoading: true,
      canUseService: vi.fn(),
    });

    renderGate();

    expect(screen.getByTestId("doctor-page")).toHaveTextContent("Doctor page loaded");
    expect(screen.queryByTestId("service-gate-status")).not.toBeInTheDocument();
  });

  it("shows setup guidance for blocked services and prepares the setup route", async () => {
    const canUseService = vi.fn();
    useServiceGateMock.mockReturnValue({
      readiness: readinessForDoctor(false),
      isLoading: false,
      canUseService,
    });

    renderGate("/health/doctor?from=concierge");

    expect(screen.getByTestId("service-gate-status")).toHaveTextContent("Complete setup first");
    expect(screen.getByTestId("service-gate-status")).toHaveTextContent("Add a GP or care contact first.");
    expect(screen.queryByTestId("doctor-page")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(canUseService).toHaveBeenCalledWith("doctor", "/health/doctor?from=concierge");
    });

    fireEvent.click(screen.getByTestId("button-service-gate-continue"));
    expect(canUseService).toHaveBeenCalledWith("doctor", "/health/doctor?from=concierge");
  });

  it("renders the protected page when the service is ready", () => {
    useServiceGateMock.mockReturnValue({
      readiness: readinessForDoctor(true),
      isLoading: false,
      canUseService: vi.fn(),
    });

    renderGate();

    expect(screen.getByTestId("doctor-page")).toHaveTextContent("Doctor page loaded");
    expect(screen.queryByTestId("service-gate-status")).not.toBeInTheDocument();
  });
});
