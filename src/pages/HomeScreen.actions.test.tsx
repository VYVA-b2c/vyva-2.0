import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "./HomeScreen";

const guardPathMock = vi.fn();
const canUseServiceMock = vi.fn(() => true);
const queryMock = vi.fn();
const voiceHeroMock = vi.hoisted(() => vi.fn());
const profileMock = vi.hoisted(() => ({ firstName: "Karim", withGpContact: true }));

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
    profile: profileMock.withGpContact
      ? {
          gpName: "Dr Garcia",
          gpPhone: "+34 612 345 678",
          gpEmail: "gp@example.com",
        }
      : {},
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  serviceForPath: () => undefined,
  useServiceGate: () => ({
    guardPath: guardPathMock,
    canUseService: canUseServiceMock,
    readiness: { services: {} },
  }),
}));

vi.mock("@/components/VoiceHero", () => ({
  default: (props: {
    autoStartListening?: boolean;
    autoStartVoice?: boolean | string;
    chatLabel?: string;
    canStartVoice?: () => boolean;
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
        <button type="button" data-testid="button-voice-hero-talk" onClick={() => props.canStartVoice?.()}>
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

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({
    label,
    testId,
    className,
    supportingLabel,
    visual,
  }: {
    label?: string;
    testId?: string;
    className?: string;
    supportingLabel?: string;
    visual?: string;
  }) => (
    <button type="button" data-testid={testId} className={className} aria-label={visual === "voiceRail" ? supportingLabel : label}>
      {visual === "voiceRail" ? null : label}
    </button>
  ),
}));

const labels: Record<string, string> = {
  "home.whatNow": "or explore a topic",
  "home.mode.label": "Choose how to talk with VYVA",
  "home.mode.type": "Type",
  "home.mode.voice": "Voice",
  "home.mode.voiceCta": "Talk to VYVA",
  "home.greeting.afternoon.withName.1": "Good afternoon, {{name}}",
  "home.greeting.afternoon.withoutName.1": "Good afternoon",
  "home.greeting.evening.withName.1": "Good evening, {{name}}",
  "home.fastHelp.kicker": "Fast help",
  "home.fastHelp.title": "What would you like VYVA to do?",
  "home.fastHelp.doctor.label": "Talk to a real doctor now",
  "home.fastHelp.doctor.sub": "Get live medical help.",
  "home.fastHelp.rotate": "More",
  "home.fastHelp.rotateAria": "Show different fast help choices",
  "home.fastHelp.appointment.label": "Schedule an appointment",
  "home.fastHelp.appointment.sub": "Let VYVA arrange it with you.",
  "home.fastHelp.ride.label": "Find transport",
  "home.fastHelp.ride.sub": "Compare safe ways to get there.",
  "home.fastHelp.doctorContext": "Home quick doctor help request. Ask what is happening and help prepare a safe next step.",
  "home.fastHelp.appointmentPrefill": "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation.",
  "home.fastHelp.ridePrefill": "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.",
  "home.nudge.text": "Not sure where to start?",
  "home.nudge.action": "Ask VYVA",
  "home.nudge.aria": "Ask VYVA where to start",
  "meds.callGpNamed": "Call {{name}}",
  "meds.callGp": "Call GP",
  "meds.callGpSub": "Speak to your practice now.",
  "meds.emailGp": "Email GP",
  "meds.emailGpSub": "Open an email with context filled in.",
  "health.symptomCheck.report.actions.emailSubject": "VYVA symptom report",
  "home.voiceCards.health.title": "My health",
  "home.voiceCards.health.subtitle": "Symptoms, meds and wellbeing",
  "home.voiceCards.health.micLabel": "Talk about my health",
  "home.voiceCards.cognitive.title": "My Brain",
  "home.voiceCards.cognitive.subtitle": "Memory, focus and calm",
  "home.voiceCards.cognitive.micLabel": "Open My Brain",
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
      i18n: { language: "en" },
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
    canUseServiceMock.mockReturnValue(true);
    voiceHeroMock.mockClear();
    profileMock.firstName = "Karim";
    profileMock.withGpContact = true;
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

  it("renders the four pillar launcher without the old movement routine card", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T22:00:00"));

    render(<HomeScreen />);

    expect(screen.getByTestId("home-master-layout")).toBeInTheDocument();
    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
    expect(screen.queryByTestId("home-gentle-routine-card")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-start-gentle-routine")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-browse-gentle-exercises")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-home-agent-health")).toHaveTextContent("My Health");
    expect(screen.getByTestId("card-home-agent-cognitive")).toHaveTextContent("My Mind");
    expect(screen.getByTestId("card-home-agent-social")).toHaveTextContent("My Community");
    expect(screen.getByTestId("card-home-agent-concierge")).toHaveTextContent("My Concierge");
    expect(screen.getByTestId("card-home-agent-health")).toHaveTextContent("Today");
    expect(screen.getByTestId("card-home-agent-cognitive")).toHaveTextContent("5 min");
    expect(screen.getByTestId("card-home-agent-social")).toHaveTextContent("Join");
    expect(screen.getByTestId("card-home-agent-concierge")).toHaveTextContent("Help");
    expect(screen.getByTestId("card-home-agent-health")).not.toHaveTextContent("Medication, vitals, symptoms");
    expect(screen.getByTestId("card-home-agent-cognitive")).not.toHaveTextContent("Memory, reflexes, thinking");
    expect(screen.getByTestId("card-home-agent-social")).not.toHaveTextContent("Rooms, matches, activities");
    expect(screen.getByTestId("card-home-agent-concierge")).not.toHaveTextContent("Help, rides, orders, schedules");
    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
  });

  it("uses live signals for concise pillar card nudges", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/meds/adherence-report") {
        return { data: { todaySummary: { scheduled: 4, remaining: 2 } }, isError: false, error: null };
      }
      if (key === "/api/games/progress") {
        return { data: { summary: { completedSessions: 8, streakDays: 4 }, today: { completedCount: 0 } }, isError: false, error: null };
      }
      if (typeof key === "string" && key.startsWith("/api/social/participate/pulse")) {
        return {
          data: {
            pulse: {
              featuredEvent: { format: "nearby" },
              notifications: [],
              savedEvents: [{ id: "one" }, { id: "two" }],
            },
          },
          isError: false,
          error: null,
        };
      }
      if (key === "/api/concierge/actions/pending") {
        return { data: { items: [{ id: "one" }, { id: "two" }] }, isError: false, error: null };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-agent-health")).toHaveTextContent("2 due");
    expect(screen.getByTestId("card-home-agent-cognitive")).toHaveTextContent("4 days");
    expect(screen.getByTestId("card-home-agent-social")).toHaveTextContent("2 saved");
    expect(screen.getByTestId("card-home-agent-concierge")).toHaveTextContent("2 tasks");
  });

  it("does not render the legacy Home chat nudge", () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Speak anytime");
    expect(guardPathMock).not.toHaveBeenCalledWith("/chat", undefined);
  });

  it("renders three visible rotating Fast help actions", () => {
    render(<HomeScreen />);

    const fastHelp = screen.getByTestId("home-fast-help");
    expect(fastHelp).toHaveTextContent("Fast help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.getByTestId("button-home-fast-feel-better")).toHaveTextContent("Feel Better");
    expect(screen.getByTestId("button-home-fast-stay-well")).toHaveTextContent("Stay Well");
    expect(screen.getByTestId("button-home-fast-find-care")).toHaveTextContent("Find Care");
  });

  it("renders the session-aware main hero CTA", () => {
    render(<HomeScreen />);

    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Speak anytime");
    expect(screen.getByTestId("button-home-hero-talk")).not.toHaveTextContent("Talk to VYVA");
  });

  it("keeps the Home hero greeting on the user's first name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");

    render(<HomeScreen />);

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good afternoon, Karim");
    expect(voiceHeroMock).not.toHaveBeenCalled();
  });

  it("uses concise evening copy instead of long late-night variants", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T22:00:00"));

    render(<HomeScreen />);

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good evening, Karim");
  });

  it("does not use an account email as the Home hero name", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-26T14:00:00"));
    window.sessionStorage.setItem("home.greetingVariant", "1");
    profileMock.firstName = "qm@4cksa.com";

    render(<HomeScreen />);

    expect(screen.getByTestId("home-master-hero")).toHaveTextContent("Good afternoon");
    expect(screen.getByTestId("home-master-hero")).not.toHaveTextContent("qm@4cksa.com");
  });

  it("opens each pillar from the master cards", () => {
    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId("card-home-agent-health"));
    fireEvent.click(screen.getByTestId("card-home-agent-cognitive"));
    fireEvent.click(screen.getByTestId("card-home-agent-social"));
    fireEvent.click(screen.getByTestId("card-home-agent-concierge"));

    expect(guardPathMock).toHaveBeenCalledWith("/health", undefined);
    expect(guardPathMock).toHaveBeenCalledWith("/mind-memory", undefined);
    expect(guardPathMock).toHaveBeenCalledWith("/social-rooms", undefined);
    expect(guardPathMock).toHaveBeenCalledWith("/concierge", undefined);
  });
});
