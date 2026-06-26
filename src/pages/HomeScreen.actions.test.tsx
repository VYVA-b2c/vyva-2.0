import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "./HomeScreen";

const guardPathMock = vi.fn();
const queryMock = vi.fn();
const voiceHeroMock = vi.hoisted(() => vi.fn());
const profileMock = vi.hoisted(() => ({ firstName: "Karim" }));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown[] }) => queryMock(options.queryKey),
  };
});

vi.mock("@/contexts/ProfileContext", () => ({
  useProfile: () => ({
    firstName: profileMock.firstName,
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
  default: (props: {
    autoStartListening?: boolean;
    autoStartVoice?: boolean | string;
    chatLabel?: string;
    contextHint?: string;
    heroSurface?: string;
    onChatClick?: () => void;
    showVoiceOverlay?: boolean;
    talkLabel?: string;
    voiceAgentSlug?: string;
    voiceDynamicVariables?: Record<string, string | number | boolean>;
    headline?: ReactNode;
  }) => {
    voiceHeroMock(props);
    return (
      <div
        data-testid="voice-hero"
        data-overlay={String(Boolean(props.showVoiceOverlay))}
        data-auto-start={String(Boolean(props.autoStartVoice))}
        data-auto-listening={String(Boolean(props.autoStartListening))}
        data-context={props.contextHint ?? ""}
        data-agent-slug={props.voiceAgentSlug ?? ""}
        data-app-entrypoint={String(props.voiceDynamicVariables?.app_entrypoint ?? "")}
      >
        <div data-testid="voice-hero-headline">{props.headline}</div>
        <button type="button" data-testid="button-voice-hero-talk">
          {props.talkLabel}
        </button>
        {props.onChatClick && (
          <button type="button" data-testid="button-home-type-instead" onClick={props.onChatClick}>
            {props.chatLabel}
          </button>
        )}
      </div>
    );
  },
}));

const labels: Record<string, string> = {
  "home.whatNow": "or explore a topic",
  "home.mode.label": "Choose how to talk with VYVA",
  "home.mode.type": "Type",
  "home.mode.voice": "Voice",
  "home.mode.voiceCta": "Talk to VYVA",
  "home.greeting.afternoon.withName.1": "Good afternoon, {{name}}",
  "home.greeting.afternoon.withoutName.1": "Good afternoon",
  "home.fastHelp.kicker": "Fast help",
  "home.fastHelp.title": "What would you like VYVA to do?",
  "home.fastHelp.doctor.label": "Talk to a real doctor now",
  "home.fastHelp.doctor.sub": "Get live medical help.",
  "home.fastHelp.appointment.label": "Schedule an appointment",
  "home.fastHelp.appointment.sub": "Let VYVA arrange it with you.",
  "home.fastHelp.ride.label": "Find transport",
  "home.fastHelp.ride.sub": "Compare safe ways to get there.",
  "home.fastHelp.doctorContext": "Home quick doctor help request. Ask what is happening and help prepare a safe next step.",
  "home.fastHelp.appointmentPrefill": "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation.",
  "home.fastHelp.ridePrefill": "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.",
  "meds.callGpNamed": "Call {{name}}",
  "meds.callGp": "Call GP",
  "meds.callGpSub": "Speak to your practice now.",
  "meds.emailGp": "Email GP",
  "meds.emailGpSub": "Open an email with context filled in.",
  "health.symptomCheck.report.actions.emailSubject": "VYVA symptom report",
  "home.voiceCards.health.title": "My health",
  "home.voiceCards.health.subtitle": "Symptoms, meds and wellbeing",
  "home.voiceCards.health.micLabel": "Talk about my health",
  "home.voiceCards.cognitive.title": "Activities",
  "home.voiceCards.cognitive.subtitle": "Events, classes and gentle plans",
  "home.voiceCards.cognitive.micLabel": "Find activities",
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
    voiceHeroMock.mockClear();
    profileMock.firstName = "Karim";
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
    expect(screen.getByTestId("button-home-fast-doctor")).toHaveTextContent("Talk to a real doctor now");
    expect(screen.getByTestId("button-home-fast-appointment")).toHaveTextContent("Schedule an appointment");
    expect(screen.getByTestId("button-home-fast-ride")).toHaveTextContent("Find transport");
  });

  it("uses one Home voice CTA without the secondary type button", () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId("home-mode-toggle")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-mode-voice")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-voice-hero-talk")).toHaveTextContent("Talk to VYVA");
    expect(screen.queryByTestId("button-home-type-instead")).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-overlay", "true");
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-auto-start", "false");
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-auto-listening", "true");
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-context", "app_open");
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-agent-slug", "main-vyva");
    expect(screen.getByTestId("voice-hero")).toHaveAttribute("data-app-entrypoint", "home_open");
  });

  it("keeps the Home hero greeting on the user's first name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");

    render(<HomeScreen />);

    expect(screen.getByTestId("voice-hero-headline")).toHaveTextContent("Good afternoon, Karim");
    expect(voiceHeroMock.mock.calls[0]?.[0]).not.toHaveProperty("heroSurface");
  });

  it("does not use an account email as the Home hero name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");
    profileMock.firstName = "qm@4cksa.com";

    render(<HomeScreen />);

    expect(screen.getByTestId("voice-hero-headline")).toHaveTextContent("Good afternoon");
    expect(screen.getByTestId("voice-hero-headline")).not.toHaveTextContent("qm@4cksa.com");
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
          message: "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.",
          source: "home_quick_action",
        },
      },
    });
  });
});
