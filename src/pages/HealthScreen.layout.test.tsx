import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HealthScreen from "./HealthScreen";

const mocks = vi.hoisted(() => ({
  guardPath: vi.fn(),
  navigate: vi.fn(),
  toast: vi.fn(),
  stopDoctorVoice: vi.fn(),
  sendDoctorUserMessage: vi.fn(),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: {
      country: "ES",
      postalCode: "11380",
      cityState: "Tarifa",
    },
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  serviceForPath: () => undefined,
  useServiceGate: () => ({
    guardPath: mocks.guardPath,
    canUseService: () => true,
    readiness: { services: {} },
  }),
}));

vi.mock("@/hooks/useDoctorVoice", () => ({
  useDoctorVoice: () => ({
    stopDoctorVoice: mocks.stopDoctorVoice,
    status: "idle",
    isVoiceLive: false,
    isSpeaking: false,
    isConnecting: false,
    transcript: "",
    sendUserMessage: mocks.sendDoctorUserMessage,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: ({ mobileTalkLabel }: { mobileTalkLabel?: string }) => (
    <div data-testid="voice-hero" data-mobile-talk-label={mobileTalkLabel ?? ""} />
  ),
}));

function renderHealthScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          if (path === "/api/profile/personalisation") {
            return { conditions: [], hobbies: [], hasMedications: false };
          }
          if (path === "/api/wound-scan/history") return [];
          if (path === "/api/reports/summary") {
            return {
              latestTriage: null,
              latestVitals: null,
              todayMeds: { taken: 0, total: 0, adherencePct: null },
            };
          }
          if (path === "/api/profile") return null;
          return null;
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HealthScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("HealthScreen home-style layout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the requested cards and fast-help actions without the daily check-in card", () => {
    renderHealthScreen();

    expect(screen.getByTestId("voice-hero")).toBeInTheDocument();
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-mobile-talk-label", "Talk to doctor");
    expect(screen.queryByTestId("daily-checkin-status-card")).not.toBeInTheDocument();

    expect(screen.getByTestId("health-primary-grid").className).toContain("grid-cols-2");
    expect(screen.getByTestId("health-primary-grid").className).toContain("max-[339px]:grid-cols-1");

    expect(screen.getByTestId("button-health-primary-symptoms")).toHaveTextContent("My Symptoms");
    expect(screen.getByTestId("button-health-primary-medication")).toHaveTextContent("My Medication");
    expect(screen.getByTestId("button-health-primary-vitals")).toHaveTextContent("My Vitals");
    expect(screen.getByTestId("button-health-primary-health-plan")).toHaveTextContent("My Health Plan");
    expect(screen.getByTestId("button-health-primary-symptoms-mobile-label")).toHaveTextContent("Symptoms");
    expect(screen.getByTestId("button-health-primary-medication-mobile-label")).toHaveTextContent("Medication");
    expect(screen.getByTestId("button-health-primary-vitals-mobile-label")).toHaveTextContent("Vitals");
    expect(screen.getByTestId("button-health-primary-health-plan-mobile-label")).toHaveTextContent("Health Plan");
    expect(screen.getByTestId("button-health-primary-medication-desktop-hint").className).toContain("hidden");
    expect(screen.getByTestId("button-health-primary-medication-desktop-hint").className).toContain("sm:block");

    expect(screen.getByTestId("health-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("health-fast-help")).toHaveTextContent("Need help now?");
    expect(screen.getByTestId("button-health-fast-reports")).toHaveTextContent("My Reports");
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveTextContent("Visual Health Scan");
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("section-health-visual-scan")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-health-fast-specialist")).toHaveTextContent("Find a Specialist");
  });

  it("keeps the primary card and fast-help actions wired", () => {
    renderHealthScreen();

    fireEvent.click(screen.getByTestId("button-health-primary-symptoms"));
    expect(mocks.guardPath).toHaveBeenCalledWith("/health/symptom-check");

    fireEvent.click(screen.getByTestId("button-health-primary-health-plan"));
    expect(mocks.navigate).toHaveBeenCalledWith("/health/check-ins");

    fireEvent.click(screen.getByTestId("button-health-fast-reports"));
    expect(mocks.navigate).toHaveBeenCalledWith("/informes");

    fireEvent.click(screen.getByTestId("button-health-fast-specialist"));
    expect(screen.getByTestId("section-health-specialist")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-health-fast-visual-scan"));
    expect(screen.getByTestId("button-health-fast-visual-scan")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("section-health-visual-scan")).toBeInTheDocument();
  });
});
