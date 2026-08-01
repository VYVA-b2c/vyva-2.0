import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CareTeamFlow from "./CareTeamFlow";
import { queryClient } from "@/lib/queryClient";

vi.mock("@/i18n", () => ({
  getLanguageSnapshot: () => ({ language: "en", source: "test" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en" },
    t: (key: string, fallback?: unknown) => (typeof fallback === "string" ? fallback : key),
  }),
}));

vi.mock("@/components/onboarding/SpeakItOverlay", () => ({
  default: () => null,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderCareTeamFlow() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <CareTeamFlow />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-path">{location.pathname}</div>
      <div data-testid="location-state">{JSON.stringify(location.state ?? null)}</div>
    </>
  );
}

function renderCareTeamFlowWithReturnState(state: Record<string, unknown>) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        initialEntries={[{ pathname: "/onboarding/careteam", state }]}
      >
        <LocationProbe />
        <Routes>
          <Route path="/onboarding/careteam" element={<CareTeamFlow />} />
          <Route path="/concierge" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CareTeamFlow", () => {
  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("allows continuing with name and phone when optional email is blank", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ members: [] })));
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    renderCareTeamFlow();

    fireEvent.click(await screen.findByTestId("button-careteam-step1-continue"));

    const continueButton = screen.getByTestId("button-careteam-step2-continue");
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByTestId("input-careteam-name"), {
      target: { value: "Hassoun Assad" },
    });
    fireEvent.change(screen.getByTestId("input-careteam-phone"), {
      target: { value: "+34671442638" },
    });

    await waitFor(() => expect(continueButton).not.toBeDisabled());
  });

  it("returns to Concierge with setup-help context after sending a helper invite", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ members: [] })));
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });

    renderCareTeamFlowWithReturnState({
      returnTo: "/concierge",
      setupReason: "Ask trusted helper to set up transport",
      conciergeResume: {
        kind: "transport",
        destination: "City Clinic",
        time: "tomorrow morning",
      },
    });

    fireEvent.click(await screen.findByTestId("button-careteam-step1-continue"));
    fireEvent.change(screen.getByTestId("input-careteam-name"), {
      target: { value: "Maya Helper" },
    });
    fireEvent.change(screen.getByTestId("input-careteam-phone"), {
      target: { value: "+34671442638" },
    });
    fireEvent.click(screen.getByTestId("button-careteam-step2-continue"));
    fireEvent.click(screen.getByText("onboarding.careTeam.step3.confirm"));
    fireEvent.click(screen.getByText("onboarding.careTeam.step4.sendInvitation"));

    await waitFor(() => expect(screen.getAllByTestId("location-path").at(-1)).toHaveTextContent("/concierge"));
    expect(screen.getAllByTestId("location-state").at(-1)).toHaveTextContent("providerSetupHelpRequested");
    expect(screen.getAllByTestId("location-state").at(-1)).toHaveTextContent("Ask trusted helper to set up transport");
    expect(screen.getAllByTestId("location-state").at(-1)).toHaveTextContent("Maya Helper");
    expect(screen.getAllByTestId("location-state").at(-1)).toHaveTextContent("City Clinic");
  });
});
