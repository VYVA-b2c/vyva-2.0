import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
      <MemoryRouter initialEntries={["/health/vitals"]}>
        <Routes>
          <Route path="/health/vitals" element={<SignosScreen />} />
          <Route path="/settings/health-devices" element={<div data-testid="health-devices-route">Health devices settings</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAddReadingSheet() {
  fireEvent.click(await screen.findByTestId("button-open-add-reading-sheet"));
  return screen.findByTestId("add-reading-sheet");
}

describe("Vitals Hub", () => {
  afterEach(() => {
    apiFetchMock.mockReset();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    delete (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS;
  });

  it("renders a mobile-first hub with capture methods hidden by default", async () => {
    renderScreen();

    expect(await screen.findByTestId("vitals-guided-hub")).toHaveTextContent("Add a vital reading");
    expect(screen.getByTestId("button-open-add-reading-sheet")).toHaveTextContent("Add reading");
    expect(screen.getByTestId("latest-readings-section")).toHaveTextContent("Latest readings");
    expect(screen.getByTestId("latest-readings-summary")).toHaveTextContent("No readings yet");
    expect(screen.queryByText("Overall status")).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly rhythm")).not.toBeInTheDocument();
    expect(screen.queryByText("Key metrics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vitals-snapshot-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-manage-health-devices")).not.toBeInTheDocument();
    expect(screen.getByTestId("compact-vitals-help")).toHaveTextContent("Need help with readings?");
    expect(screen.queryByTestId("button-vitals-say-reading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-vitals-snap-reading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("connect-health-devices")).not.toBeInTheDocument();
  });

  it("opens the add-reading sheet from a suggested vital chip", async () => {
    renderScreen();

    fireEvent.click(await screen.findByTestId("button-suggested-vital-resting_hr_bpm"));
    expect(await screen.findByTestId("add-reading-sheet")).toBeInTheDocument();
  });

  it("opens capture methods and sends device setup to Settings", async () => {
    renderScreen();

    await openAddReadingSheet();
    expect(screen.getByTestId("button-vitals-say-reading")).toBeInTheDocument();
    expect(screen.getByTestId("button-vitals-snap-reading")).toBeInTheDocument();
    expect(screen.getByTestId("button-log-reading")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-open-bluetooth-device"));
    expect(await screen.findByTestId("health-devices-route")).toBeInTheDocument();
  });

  it("confirms a mocked VitalLens face-scan result before saving", async () => {
    (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS = 1;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: vi.fn() }],
        })),
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn(async () => undefined),
    });
    const data = new Uint8ClampedArray(40 * 40 * 4).fill(120);
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data })),
      })),
    });
    apiFetchMock.mockImplementation(async (url) => {
      if (String(url).includes("/api/vitals-engine/face-scan")) {
        return new Response(JSON.stringify({
          proposed_readings: [
            {
              signal_type: "resting_hr_bpm",
              value: 70,
              unit: "bpm",
              context_tag: "resting",
              recorded_at: "2026-06-20T10:00:00.000Z",
              source: "phone_estimate",
              capture_method: "phone_camera",
              confidence: "medium",
              explanation: "VitalLens face-scan heart-rate estimate.",
              source_ref: { provider: "rouast_vitallens" },
            },
            {
              signal_type: "respiratory_rate",
              value: 15,
              unit: "/min",
              context_tag: "resting",
              recorded_at: "2026-06-20T10:00:00.000Z",
              source: "phone_estimate",
              capture_method: "phone_camera",
              confidence: "medium",
              explanation: "VitalLens face-scan breathing estimate.",
              source_ref: { provider: "rouast_vitallens" },
            },
          ],
          needs_confirmation: true,
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (String(url).includes("/api/vitals-engine/readings")) {
        return new Response(JSON.stringify({ saved_count: 2, readings: [] }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    renderScreen();

    await openAddReadingSheet();
    fireEvent.click(screen.getByTestId("button-open-face-scan"));
    fireEvent.click(await screen.findByTestId("button-start-face-scan"));

    expect(await screen.findByText(/Pulse: 70 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/Breathing: 15 \/min/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-confirm-face-scan-readings"));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/vitals-engine/readings", expect.objectContaining({
      body: expect.stringContaining('"provider":"rouast_vitallens"'),
    })));
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

    expect(await screen.findByTestId("vitals-guided-hub")).toHaveTextContent("Add a vital reading");
    await openAddReadingSheet();
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
