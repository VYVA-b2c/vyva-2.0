import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BenefitsNavigatorScreen from "./BenefitsNavigatorScreen";

const apiFetchMock = vi.hoisted(() => vi.fn());
const canonicalVoiceButtonMock = vi.hoisted(() => vi.fn());
const profileState = vi.hoisted(() => ({
  profile: {
    country: "ES",
    region: "Madrid",
    dateOfBirth: "1947-02-14",
    livingSituation: "alone",
  } as Record<string, unknown> | null,
  isLoading: false,
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({ ...profileState, fullName: "Elena García", initials: "EG", firstName: "Elena" }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/components/CanonicalDetailFlowShell", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/CanonicalDetailFlowShell")>();
  return {
    ...actual,
    CanonicalVoiceButton: (props: { agentSlug?: string; dynamicVariables?: Record<string, string> }) => {
      canonicalVoiceButtonMock(props);
      return <button type="button" data-testid="button-benefits-voice">Talk to Inés</button>;
    },
  };
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname + location.search}</div>;
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={["/benefits"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/benefits" element={<><BenefitsNavigatorScreen /><LocationProbe /></>} />
        <Route path="/social-rooms/experts/ines" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BenefitsNavigatorScreen", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    canonicalVoiceButtonMock.mockReset();
    profileState.profile = {
      country: "ES",
      region: "Madrid",
      dateOfBirth: "1947-02-14",
      livingSituation: "alone",
    };
    profileState.isLoading = false;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses Inés for the permanent voice and chat entry point", () => {
    renderScreen();

    expect(screen.getByTestId("benefits-navigator-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(canonicalVoiceButtonMock).toHaveBeenCalledWith(expect.objectContaining({
      agentSlug: "ines",
      dynamicVariables: expect.objectContaining({ app_entrypoint: "benefits_navigator" }),
    }));
    expect(screen.getByTestId("button-benefits-voice")).toHaveAccessibleName("Talk to Inés");

    fireEvent.click(screen.getByTestId("button-benefits-chat"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms/experts/ines");
  });

  it("uses known profile facts and submits only the remaining confirmation", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{
          id: "program-1",
          country: "ES",
          region: null,
          name: "Minimum Living Income",
          description: "Household income support.",
          askInesStarter: "Can you explain Minimum Living Income?",
        }],
      }),
    });
    renderScreen();

    expect(screen.getByTestId("benefits-profile-summary")).toHaveTextContent("Madrid");
    expect(screen.getByTestId("benefits-profile-summary")).toHaveTextContent("I live alone");
    expect(screen.queryByLabelText("Country")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-benefits-check"));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/api/benefits/screenings?lang=en", expect.objectContaining({
        method: "POST",
      }));
    });
    const request = apiFetchMock.mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(request.body)).toMatchObject({
      country: "ES",
      region: "Madrid",
      livingSituation: "alone",
      currentBenefits: [],
    });
    expect(await screen.findByRole("heading", { name: "Minimum Living Income" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Read explanation" }));
    expect(screen.getByText("Household income support.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask Inés about this" }));
    expect(screen.getByTestId("current-route")).toHaveTextContent(
      "/social-rooms/experts/ines?starter=Can%20you%20explain%20Minimum%20Living%20Income%3F",
    );
  });

  it("shows the governed empty state when no reviewed programme is active", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] }),
    });
    renderScreen();

    fireEvent.click(screen.getByTestId("button-benefits-check"));

    expect(await screen.findByText("No reviewed matches yet")).toBeInTheDocument();
  });

  it("shows an honest service state when the local API is unavailable", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ code: "LOCAL_API_UNAVAILABLE" }),
    });
    renderScreen();

    fireEvent.click(screen.getByTestId("button-benefits-check"));

    expect(await screen.findByText("Benefits service unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Your details are still here/)).toBeInTheDocument();
  });
});
