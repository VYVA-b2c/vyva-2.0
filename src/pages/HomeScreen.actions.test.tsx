import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "./HomeScreen";

const guardPathMock = vi.fn();
const queryMock = vi.fn();

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options.queryKey),
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: "Karim",
    profile: {
      gpName: "Dr Garcia",
      gpPhone: "+34 612 345 678",
      gpEmail: "gp@example.com",
    },
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  serviceForPath: () => undefined,
  useServiceGate: () => ({
    guardPath: guardPathMock,
    readiness: { services: {} },
  }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: () => <div data-testid="voice-hero" />,
}));

const labels: Record<string, string> = {
  "home.whatNow": "or explore a topic",
  "home.fastHelp.kicker": "Fast help",
  "home.fastHelp.title": "What do you need now?",
  "home.fastHelp.doctor.label": "Doctor help",
  "home.fastHelp.doctor.sub": "Talk through a health concern",
  "home.fastHelp.appointment.label": "Book appointment",
  "home.fastHelp.appointment.sub": "Prepare a request to confirm",
  "home.fastHelp.ride.label": "Book ride",
  "home.fastHelp.ride.sub": "Arrange safe transport",
  "home.fastHelp.doctorContext": "Home quick doctor help request. Ask what is happening and help prepare a safe next step.",
  "home.fastHelp.appointmentPrefill": "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation.",
  "home.fastHelp.ridePrefill": "Please help me arrange safe transport. Ask for destination and timing, and do not book anything without my confirmation.",
  "meds.callGpNamed": "Call {{name}}",
  "meds.callGp": "Call GP",
  "meds.callGpSub": "Speak to your practice now.",
  "meds.emailGp": "Email GP",
  "meds.emailGpSub": "Open an email with context filled in.",
  "health.symptomCheck.report.actions.emailSubject": "VYVA symptom report",
  "home.voiceCards.health.title": "My health",
  "home.voiceCards.health.subtitle": "Symptoms, meds and wellbeing",
  "home.voiceCards.health.micLabel": "Talk about my health",
  "home.voiceCards.cognitive.title": "My mind",
  "home.voiceCards.cognitive.subtitle": "Focus, memory and calm",
  "home.voiceCards.cognitive.micLabel": "Start a mental exercise",
  "home.voiceCards.social.title": "My Community",
  "home.voiceCards.social.subtitle": "Rooms, chats and shared moments",
  "home.voiceCards.social.micLabel": "Talk to VYVA",
  "home.voiceCards.concierge.title": "My Concierge",
  "home.voiceCards.concierge.subtitle": "Bookings, errands and support",
  "home.voiceCards.concierge.micLabel": "Ask for help by voice",
};

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const raw = labels[key] ?? (typeof fallbackOrValues === "string" ? fallbackOrValues : key);
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return raw.replace(/\{\{(\w+)\}\}/g, (_match, token) => String(interpolation?.[token] ?? `{{${token}}}`));
      },
    }),
  };
});

describe("Home fast service actions", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      return {
        data: null,
        isError: false,
        error: null,
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render the removed Home movement routine card", () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId("home-gentle-routine-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-start-gentle-routine")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-browse-gentle-exercises")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-health")).toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-social")).toBeInTheDocument();
  });

  it("renders direct fast-help buttons on Home", () => {
    render(<HomeScreen />);

    expect(screen.getByTestId("home-fast-help")).toHaveTextContent("Fast help");
    expect(screen.getByTestId("button-home-fast-callGp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-home-fast-callGp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-home-fast-emailGp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-home-fast-emailGp")).toHaveAttribute("href", expect.stringContaining("VYVA%20symptom%20report"));
    expect(screen.getByTestId("button-home-fast-doctor")).toHaveTextContent("Doctor help");
    expect(screen.getByTestId("button-home-fast-appointment")).toHaveTextContent("Book appointment");
    expect(screen.getByTestId("button-home-fast-ride")).toHaveTextContent("Book ride");
  });

  it("opens doctor help with voice context from Home", () => {
    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId("button-home-fast-doctor"));

    expect(guardPathMock).toHaveBeenCalledWith("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: "Home quick doctor help request. Ask what is happening and help prepare a safe next step.",
      },
    });
  });

  it("opens appointment and ride requests in Concierge with prepared confirmation-first context", () => {
    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId("button-home-fast-appointment"));
    fireEvent.click(screen.getByTestId("button-home-fast-ride"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: {
        conciergePrefill: {
          kind: "appointment",
          message: "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation.",
          source: "home_quick_action",
        },
      },
    });
    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: {
        conciergePrefill: {
          kind: "ride",
          message: "Please help me arrange safe transport. Ask for destination and timing, and do not book anything without my confirmation.",
          source: "home_quick_action",
        },
      },
    });
  });
});
