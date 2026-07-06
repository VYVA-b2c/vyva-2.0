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

const defaultVitals = {
  summary: {
    hr: {
      latest_value: "72",
      latest_recorded_at: "2026-07-05T08:00:00.000Z",
      trend: ["72"],
      has_data: true,
    },
    rr: {
      latest_value: "16",
      latest_recorded_at: "2026-07-05T08:02:00.000Z",
      trend: ["16"],
      has_data: true,
    },
    bp: {
      latest_value: null,
      latest_recorded_at: null,
      trend: [],
      has_data: false,
    },
  },
  compliance_days: [false, false, false, false, false, false, false],
};

const defaultPrevention = {
  focus: "Heart",
  headline: "Complete your heart picture.",
  why: ["Blood pressure is the missing signal today."],
  todayAction: "Add a blood pressure reading.",
  helpSigns: ["Chest pain", "Shortness of breath", "New weakness"],
  primaryRoute: "/health/vitals",
  confidence: "moderate",
  signals: [
    {
      id: "medicine-routine",
      label: "Routine steady",
      detail: "Medication routine has enough context today.",
      category: "medicine",
      strength: "medium",
    },
    {
      id: "symptom-follow-up",
      label: "No active symptom flag",
      detail: "Latest symptom report does not add a new follow-up flag.",
      category: "symptom",
      strength: "low",
    },
  ],
  insights: [
    {
      id: "medication-adherence",
      label: "Medicine",
      value: "Routine steady",
      detail: "Dose routine is available for the plan.",
      tone: "steady",
    },
    {
      id: "symptom-follow-up",
      label: "Symptoms",
      value: "No active symptom flag",
      detail: "Latest symptom report does not add a new follow-up flag.",
      tone: "steady",
    },
  ],
  dailyActions: [
    {
      id: "low-salt-lunch",
      step: "Eat",
      title: "Lower-salt lunch",
      detail: "Choose a simple lower-salt meal.",
      why: "This fits your heart focus and blood pressure context.",
      evidenceLabel: "Heart",
      tone: "food",
      actionSheet: {
        title: "Lower-salt lunch",
        summary: "Choose a lower-salt meal.",
        primaryAction: {
          id: "food-help",
          label: "Food ideas",
          detail: "Open groceries",
          route: "/concierge/shopping",
          priority: "primary",
        },
        secondaryActions: [],
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
      ],
    },
    {
      id: "calm-walk",
      step: "Move",
      title: "Gentle walk",
      detail: "Keep an easy talk pace.",
      why: "A calm pace supports heart health without pushing hard.",
      evidenceLabel: "Mobility",
      tone: "movement",
      actionSheet: {
        title: "Gentle walk",
        summary: "Move gently.",
        primaryAction: {
          id: "walk-help",
          label: "Start easy",
          detail: "Open gentle movement",
          route: "/social-rooms/morning-movement/exercises/chair-yoga",
          priority: "primary",
        },
        secondaryActions: [],
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
      ],
    },
    {
      id: "check-bp",
      step: "Check",
      title: "Add blood pressure",
      detail: "One reading completes the picture.",
      why: "BP is the biggest missing signal in today's plan.",
      evidenceLabel: "Missing BP",
      tone: "check",
      actionSheet: {
        title: "Add blood pressure",
        summary: "Add one reading.",
        primaryAction: {
          id: "add-bp",
          label: "Add reading",
          detail: "Open vitals",
          route: "/health/vitals",
          priority: "primary",
        },
        secondaryActions: [],
      },
      feedbackOptions: [
        { id: "done", label: "Done" },
        { id: "too_hard", label: "Too hard" },
      ],
    },
  ],
  personalizationSummary: ["High blood pressure", "Lives alone"],
  profileSignals: ["Mobility level"],
  weeklySummary: {
    headline: "VYVA is learning what works.",
    detail: "Last week, simple food swaps were easiest.",
    bullets: ["Food swaps helped"],
    doctorSummary: "Weekly prevention summary.",
    caregiverSummary: "Caregiver prevention summary.",
  },
  generatedAt: "2026-07-05T08:05:00.000Z",
};

function renderScreen(options: {
  vitals?: typeof defaultVitals;
  prevention?: typeof defaultPrevention;
  preventionError?: boolean;
} = {}) {
  const existingApiFetch = apiFetchMock.getMockImplementation();
  apiFetchMock.mockImplementation(async (...args) => {
    const [input] = args;
    const url = String(input);
    if (url.startsWith("/api/health/prevention")) {
      if (options.preventionError) {
        return new Response(JSON.stringify({ error: "Could not load prevention" }), { status: 500 });
      }
      return new Response(JSON.stringify(options.prevention ?? defaultPrevention), { status: 200 });
    }
    if (existingApiFetch) return existingApiFetch(...args);
    return new Response(JSON.stringify({}), { status: 200 });
  });

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const key = queryKey[0];
          if (key === "/api/vitals") return options.vitals ?? defaultVitals;
          if (key === "/api/profile/personalisation") return { conditions: ["diabetes", "hypertension"], hobbies: [], hasMedications: true };
          if (key === "/api/vitals-engine/latest") return { analysis: null, recent_readings: [], latest_alert: null };
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/health/vitals"]}>
        <Routes>
          <Route path="/health/vitals" element={<SignosScreen />} />
          <Route path="/settings/health-devices" element={<div data-testid="health-devices-route">Health devices settings</div>} />
          <Route path="/health/doctor" element={<div data-testid="doctor-route">Doctor route</div>} />
          <Route path="/health/prevention" element={<div data-testid="prevention-route">Prevention route</div>} />
          <Route path="/health/symptom-check" element={<div data-testid="symptom-route">Symptoms route</div>} />
          <Route path="/meds" element={<div data-testid="meds-route">Meds route</div>} />
          <Route path="/concierge/shopping" element={<div data-testid="shopping-route">Shopping route</div>} />
          <Route path="/social-rooms/morning-movement/exercises/chair-yoga" element={<div data-testid="movement-route">Movement route</div>} />
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
    window.localStorage.clear();
    Object.defineProperty(navigator, "bluetooth", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
    delete (window as Window & { __VYVA_FACE_SCAN_TEST_DURATION_MS?: number }).__VYVA_FACE_SCAN_TEST_DURATION_MS;
  });

  it("renders a mobile-first hub with capture methods hidden by default", async () => {
    renderScreen();

    expect(await screen.findByText("My Health Plan")).toBeInTheDocument();
    expect(screen.getByTestId("vitals-guided-hub")).toHaveTextContent("AgeWell Score");
    expect(screen.getByTestId("vitals-guided-hub")).toHaveTextContent("Your biggest opportunity today: complete your heart picture.");
    expect(screen.getByTestId("vitals-guided-hub")).toHaveTextContent("Add blood pressure");
    expect(screen.getByTestId("agewell-score-value")).toHaveTextContent("90");
    expect(screen.getByTestId("button-open-add-reading-sheet")).toHaveTextContent("Add blood pressure");
    expect(screen.getByTestId("button-agewell-ask-vyva")).toHaveTextContent("Ask VYVA");
    expect(screen.queryByText("Good afternoon.")).not.toBeInTheDocument();
    expect(screen.queryByText("Your plan gets clearer with every health signal.")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Health Plan")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan confidence")).not.toBeInTheDocument();
    expect(screen.queryByText("5 of 8 signals ready")).not.toBeInTheDocument();
    expect(screen.getByTestId("agewell-signals-section")).toHaveTextContent("What VYVA is using");
    expect(screen.getByTestId("agewell-signal-vitals")).toHaveTextContent("Pulse 72");
    expect(screen.getByTestId("agewell-signal-vitals")).toHaveTextContent("Breathing 16");
    expect(screen.getByTestId("agewell-signal-vitals")).toHaveTextContent("Missing: BP");
    expect(screen.getByTestId("agewell-signal-medicine")).toHaveTextContent("Routine steady");
    expect(screen.getByTestId("agewell-signal-symptoms")).toHaveTextContent("No active symptom flag");
    expect(screen.getByTestId("agewell-signal-prevention")).toHaveTextContent("Heart");
    expect(screen.getByTestId("agewell-signal-prevention")).toHaveTextContent("High blood pressure");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Today's 3 longevity moves");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Lower-salt lunch");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Gentle walk");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Add blood pressure");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Done");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Too hard");
    expect(screen.getByTestId("agewell-loop-insight")).toHaveTextContent("Tap Done or Too hard");
    expect(screen.queryByText("Overall status")).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly rhythm")).not.toBeInTheDocument();
    expect(screen.queryByText("Key metrics")).not.toBeInTheDocument();
    expect(screen.queryByText("Latest readings")).not.toBeInTheDocument();
    expect(screen.queryByText("Silver Scout Report")).not.toBeInTheDocument();
    expect(screen.queryByText("Gold Confidence")).not.toBeInTheDocument();
    expect(screen.queryByText("VYVA's Watchlist")).not.toBeInTheDocument();
    expect(screen.queryByTestId("vitals-snapshot-grid")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-manage-health-devices")).not.toBeInTheDocument();
    expect(screen.getByTestId("compact-vitals-help")).toHaveTextContent("Need help completing your plan?");
    expect(screen.getByTestId("compact-vitals-help")).toHaveTextContent("Ask VYVA to guide me");
    expect(screen.queryByTestId("button-vitals-say-reading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-vitals-snap-reading")).not.toBeInTheDocument();
    expect(screen.queryByTestId("connect-health-devices")).not.toBeInTheDocument();
  });

  it("updates feedback controls on longevity moves", async () => {
    renderScreen();

    expect(await screen.findByTestId("agewell-longevity-moves")).toHaveTextContent("Lower-salt lunch");
    fireEvent.click(screen.getByTestId("button-agewell-feedback-low-salt-lunch-done"));
    expect(screen.getByTestId("agewell-feedback-low-salt-lunch")).toHaveTextContent("Done");
    expect(screen.getByTestId("agewell-loop-insight")).toHaveTextContent("what worked today");
    expect(JSON.parse(window.localStorage.getItem("vyva-prevention-feedback:Heart:2026-07-05") || "{}")).toMatchObject({
      "low-salt-lunch": "done",
    });

    fireEvent.click(screen.getByTestId("button-agewell-feedback-calm-walk-too_hard"));
    expect(screen.getByTestId("agewell-feedback-calm-walk")).toHaveTextContent("Too hard");
    expect(screen.getByTestId("agewell-move-calm-walk")).toHaveTextContent("Easier version");
    expect(screen.getByTestId("agewell-loop-insight")).toHaveTextContent("made this easier");
  });

  it("passes recent feedback to the prevention engine", async () => {
    window.localStorage.setItem("vyva-prevention-loop:history", JSON.stringify([
      {
        actionId: "calm-walk",
        title: "Gentle walk",
        step: "Move",
        tone: "movement",
        focus: "Heart",
        feedback: "too_hard",
        date: "2026-07-04",
        savedAt: "2026-07-04T12:00:00.000Z",
      },
    ]));

    renderScreen();
    await screen.findByTestId("agewell-longevity-moves");

    const preventionCall = apiFetchMock.mock.calls.find(([url]) => String(url).startsWith("/api/health/prevention?learning="));
    expect(preventionCall).toBeTruthy();
    expect(decodeURIComponent(String(preventionCall?.[0]))).toContain("calm-walk");
    expect(decodeURIComponent(String(preventionCall?.[0]))).toContain("too_hard");
  });

  it("starts easier after previous too-hard feedback", async () => {
    window.localStorage.setItem("vyva-prevention-loop:last-feedback", JSON.stringify({
      focus: "Heart",
      date: "2026-07-04",
      actionId: "calm-walk",
      step: "Move",
      tone: "movement",
      feedback: "too_hard",
      title: "Gentle walk",
      savedAt: "2026-07-04T12:00:00.000Z",
    }));

    renderScreen();

    await waitFor(() => expect(screen.getByTestId("agewell-move-calm-walk")).toHaveTextContent("Easier version"));
    expect(screen.getByTestId("agewell-loop-insight")).toHaveTextContent("started easier");
  });

  it("opens the first prevention action from a completed vitals hero", async () => {
    renderScreen({
      vitals: {
        ...defaultVitals,
        summary: {
          ...defaultVitals.summary,
          bp: {
            latest_value: "128/76",
            latest_recorded_at: "2026-07-05T08:04:00.000Z",
            trend: ["128/76"],
            has_data: true,
          },
        },
      },
    });

    expect(await screen.findByTestId("vitals-guided-hub")).toHaveTextContent("Complete your heart picture.");
    expect(screen.getByTestId("button-open-add-reading-sheet")).toHaveTextContent("Food ideas");
    fireEvent.click(screen.getByTestId("button-open-add-reading-sheet"));
    expect(await screen.findByTestId("shopping-route")).toBeInTheDocument();
  });

  it("falls back to a building AgeWell plan when prevention does not load", async () => {
    renderScreen({ preventionError: true });

    expect(await screen.findByTestId("agewell-score-ring")).toHaveTextContent("Building");
    expect(screen.getByTestId("vitals-guided-hub")).toHaveTextContent("Your biggest opportunity today: complete your heart picture.");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Steady meal");
    expect(screen.getByTestId("agewell-longevity-moves")).toHaveTextContent("Using a simple AgeWell plan");
  });

  it("opens the add-reading sheet from the primary blood pressure action", async () => {
    renderScreen();

    fireEvent.click(await screen.findByTestId("button-open-add-reading-sheet"));
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

    expect(await screen.findByTestId("vitals-guided-hub")).toHaveTextContent("complete your heart picture");
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
