import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import SharedCheckinReport, { sharedCheckinContext, sharedCheckinServiceActionsFor } from "./SharedCheckinReport";

const sharedPayload = {
  report: {
    name: "Maria",
    language: "en",
    result: {
      feeling_label: "Careful day",
      overall_state: "moderate",
      vyva_reading: "VYVA noticed chest discomfort and low energy.",
      highlight: "Chest discomfort should be checked carefully.",
      flag_caregiver: true,
      watch_for: "If chest pain or shortness of breath appears, seek medical attention.",
      right_now: ["Keep the phone nearby."],
      today_actions: ["Speak with a doctor if symptoms continue."],
    },
  },
  created_at: "2026-06-01T10:00:00.000Z",
};

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </>
  );
}

function renderSharedReport() {
  window.history.pushState({}, "", "/shared/check-in/token-1");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/shared/check-in/token-1"]}>
        <Routes>
          <Route path="/shared/check-in/:token" element={<SharedCheckinReport />} />
          <Route path="/health/doctor" element={<LocationProbe />} />
          <Route path="/concierge" element={<LocationProbe />} />
          <Route path="/concierge/shopping" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockSharedReportFetch(payload = sharedPayload) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SharedCheckinReport service actions", () => {
  it("maps shared care-risk reports to doctor, appointment, and ride actions", () => {
    const result = sharedPayload.report.result;

    expect(sharedCheckinServiceActionsFor(result, "Maria", "en").map((action) => action.key)).toEqual([
      "doctor_help",
      "appointment",
      "ride",
    ]);
    expect(sharedCheckinContext(result, "Maria", "en")).toContain("Chest discomfort");
  });

  it("does not show service buttons for calm shared reports", () => {
    expect(sharedCheckinServiceActionsFor({
      feeling_label: "Good day",
      overall_state: "good",
      vyva_reading: "A calm day.",
      flag_caregiver: false,
      right_now: ["Enjoy lunch."],
      today_actions: ["Listen to music."],
    }, "Maria", "en")).toEqual([]);
  });

  it("maps shared practical-support reports to delivery and home-help actions", () => {
    const actions = sharedCheckinServiceActionsFor({
      feeling_label: "Support day",
      overall_state: "moderate",
      vyva_reading: "Hydration and home support would help.",
      flag_caregiver: false,
      right_now: ["Order water and electrolytes for delivery."],
      today_actions: ["Have someone stay with you and request home care support."],
    }, "Maria", "en");

    expect(actions.map((action) => action.key)).toEqual(["order", "quote"]);
  });

  it("renders service buttons and opens doctor help with report context", async () => {
    mockSharedReportFetch();

    renderSharedReport();

    await waitFor(() => {
      expect(screen.getByTestId("shared-checkin-service-actions")).toBeInTheDocument();
    });
    expect(screen.getByTestId("shared-checkin-service-actions")).toHaveTextContent("Doctor help");
    expect(screen.getByTestId("shared-checkin-service-actions")).toHaveTextContent("Book appointment");
    expect(screen.getByTestId("shared-checkin-service-actions")).toHaveTextContent("Arrange ride");

    fireEvent.click(screen.getByTestId("button-shared-checkin-service-doctor_help"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/health/doctor");
    expect(screen.getByTestId("route-state")).toHaveTextContent("shared_checkin");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Chest discomfort");
  });

  it("opens concierge appointment and ride flows with shared report prefill", async () => {
    mockSharedReportFetch();

    const firstRender = renderSharedReport();

    await waitFor(() => {
      expect(screen.getByTestId("button-shared-checkin-service-appointment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-shared-checkin-service-appointment"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"appointment\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"shared_checkin\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Chest discomfort");

    firstRender.unmount();
    renderSharedReport();
    await waitFor(() => {
      expect(screen.getByTestId("button-shared-checkin-service-ride")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-shared-checkin-service-ride"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"ride\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"shared_checkin\"");
  });

  it("opens shared delivery and quote flows with report prefill", async () => {
    const supportPayload = {
      ...sharedPayload,
      report: {
        ...sharedPayload.report,
        result: {
          ...sharedPayload.report.result,
          flag_caregiver: false,
          watch_for: null,
          highlight: "Hydration and company",
          right_now: ["Order water and electrolytes for delivery."],
          today_actions: ["Have someone stay with you and request home care support."],
        },
      },
    };
    mockSharedReportFetch(supportPayload);

    const firstRender = renderSharedReport();

    await waitFor(() => {
      expect(screen.getByTestId("button-shared-checkin-service-order")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-shared-checkin-service-order"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge/shopping");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"category\":\"groceries\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Hydration and company");

    firstRender.unmount();
    renderSharedReport();
    await waitFor(() => {
      expect(screen.getByTestId("button-shared-checkin-service-quote")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-shared-checkin-service-quote"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"kind\":\"home_care_quote\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"source\":\"shared_checkin\"");
  });
});
