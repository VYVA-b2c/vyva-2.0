import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignosScreen from "./SignosScreen";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | Record<string, unknown>) => {
      if (typeof fallback === "string") return fallback;
      if (fallback && typeof fallback.defaultValue === "string") return fallback.defaultValue;
      return _key;
    },
  }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "11111111-1111-4111-8111-111111111111" },
  }),
}));

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    profile: {
      country: "ES",
      gpName: "Dr Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    },
  }),
}));

vi.mock("@/hooks/useVoiceActionFulfillment", () => ({
  useVoiceActionFulfillment: () => ({ action: null, payloadValue: () => "" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="voice-hero">{children}</div>,
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/VitalsTracker", () => ({
  default: () => <div data-testid="vitals-tracker" />,
}));

vi.mock("@/components/VitalsScan", () => ({
  default: () => <div data-testid="vitals-scan" />,
}));

const apiFetchMock = vi.mocked(apiFetch);

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0];
          if (key === "/api/vitals") return { summary: {}, compliance_days: [false, false, false, false, false, false, false] };
          if (key === "/api/profile/personalisation") return { conditions: ["diabetes", "hypertension"], hobbies: [], hasMedications: true };
          if (key === "/api/vitals-engine/latest") return { analysis: null, recent_readings: [], latest_alert: null };
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SignosScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Vitals Hub", () => {
  afterEach(() => {
    apiFetchMock.mockReset();
  });

  it("lets the user type a reading, confirm parsed candidates, and save them", async () => {
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/vitals-engine/parse-text")) {
        return new Response(JSON.stringify({
          proposed_readings: [
            {
              signal_type: "glucose_mgdl",
              value: 142,
              unit: "mg/dL",
              context_tag: "general",
              recorded_at: "2026-06-18T10:00:00.000Z",
              source: "manual_entry",
              capture_method: "manual",
              confidence: "medium",
              explanation: "Glucose reading detected.",
            },
            {
              signal_type: "bp_systolic",
              value: 128,
              unit: "mmHg",
              context_tag: "general",
              recorded_at: "2026-06-18T10:00:00.000Z",
              source: "manual_entry",
              capture_method: "manual",
              confidence: "medium",
              explanation: "Blood pressure top number detected.",
            },
            {
              signal_type: "bp_diastolic",
              value: 76,
              unit: "mmHg",
              context_tag: "general",
              recorded_at: "2026-06-18T10:00:00.000Z",
              source: "manual_entry",
              capture_method: "manual",
              confidence: "medium",
              explanation: "Blood pressure bottom number detected.",
            },
          ],
          needs_confirmation: true,
          transcript: "sugar 142 and BP 128 over 76",
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).includes("/api/vitals-engine/readings")) {
        return new Response(JSON.stringify({ saved_count: 1, readings: [] }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    renderScreen();

    expect(await screen.findByTestId("vitals-guided-hub")).toHaveTextContent("Scan, say, snap, or type");
    expect(screen.getByTestId("button-vitals-say-reading")).toBeInTheDocument();
    expect(screen.getByTestId("button-vitals-snap-reading")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-log-reading"));
    fireEvent.change(screen.getByTestId("textarea-vitals-reading"), { target: { value: "sugar 142 and BP 128 over 76" } });
    fireEvent.click(screen.getByTestId("button-parse-vitals-text"));

    expect(await screen.findByText(/Glucose: 142 mg\/dL/i)).toBeInTheDocument();
    expect(screen.getByText(/Blood pressure: 128\/76 mmHg/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-confirm-vitals-readings"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/readings", expect.objectContaining({
      method: "POST",
    })));
  });
});
