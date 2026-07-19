import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomeScreen from "./HomeScreen";
import {
  homeFastHelpJourneyStorageKey,
  markHomeFastHelpJourney,
  mergeSyncedHomeFastHelpJourneys,
  startHomeFastHelpJourney,
} from "@/lib/homeFastHelpOutcome";
import { SHOW_VYVA_REVIEW_HISTORY_KEY } from "@/lib/showVyvaReviewHistory";

const guardPathMock = vi.fn();
const canUseServiceMock = vi.fn(() => true);
const queryMock = vi.fn();
const voiceHeroMock = vi.hoisted(() => vi.fn());
const profileMock = vi.hoisted(() => ({
  firstName: "Karim",
  profileId: "profile-home",
  serviceReadiness: {
    hasSavedDoctor: undefined as boolean | undefined,
    hasSavedTransportProvider: undefined as boolean | undefined,
    hasMobilityInfo: undefined as boolean | undefined,
    hasCoverageInfo: undefined as boolean | undefined,
  },
  withGpContact: true,
}));

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
          profileId: profileMock.profileId,
          gpName: "Dr Garcia",
          gpPhone: "+34 612 345 678",
          gpEmail: "gp@example.com",
          serviceReadiness: profileMock.serviceReadiness,
        }
      : {
          profileId: profileMock.profileId,
          serviceReadiness: profileMock.serviceReadiness,
        },
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
  "home.recoveryNudge.title": "Continue where you left off",
  "home.recoveryNudge.detail": "Continue {{action}} when you are ready.",
  "home.recoveryNudge.blockedTitle": "One quick step first",
  "home.recoveryNudge.blockedDetail": "Open {{action}} to see what is needed.",
  "home.recoveryNudge.transportSetupTitle": "One quick setup first",
  "home.recoveryNudge.transportSetupDetail": "Add a trusted transport provider to continue your ride.",
  "home.recoveryNudge.transportSetupNotice": "Save a trusted taxi or transport provider, then continue your ride.",
  "home.recoveryNudge.continue": "Continue",
  "home.recoveryNudge.later": "Later",
  "home.recoveryNudge.dismiss": "Dismiss",
  "home.conciergeResume.kicker": "Right now",
  "home.conciergeResume.kickerConfirm": "Needs your OK",
  "home.conciergeResume.kickerReview": "Needs review",
  "home.conciergeResume.kickerWaiting": "Waiting",
  "home.conciergeResume.titlePrefix": "VYVA is working on your",
  "home.conciergeResume.titleConfirmPrefix": "Confirm your",
  "home.conciergeResume.titleReviewPrefix": "Review your",
  "home.conciergeResume.task.ride": "ride",
  "home.conciergeResume.task.appointment": "appointment",
  "home.conciergeResume.task.pharmacy": "pharmacy request",
  "home.conciergeResume.task.homeService": "home service",
  "home.conciergeResume.task.provider": "provider search",
  "home.conciergeResume.task.providerShortlist": "saved options",
  "home.conciergeResume.task.admin": "admin task",
  "home.conciergeResume.task.safety": "safety check",
  "home.conciergeResume.task.default": "request",
  "home.conciergeResume.fastStatus.ride": "Check ride status",
  "home.conciergeResume.fastStatus.appointment": "Check appointment",
  "home.conciergeResume.fastStatus.pharmacy": "Check pharmacy request",
  "home.conciergeResume.fastStatus.homeService": "Check home service",
  "home.conciergeResume.fastStatus.provider": "Check provider search",
  "home.conciergeResume.fastStatus.providerShortlist": "Review shortlist",
  "home.conciergeResume.fastStatus.admin": "Check admin task",
  "home.conciergeResume.fastStatus.safety": "Check safety review",
  "home.conciergeResume.fastStatus.default": "Check request",
  "home.conciergeResume.step.contacting": "Contacting provider",
  "home.conciergeResume.step.waiting": "Waiting for reply",
  "home.conciergeResume.step.form": "Preparing form",
  "home.conciergeResume.step.save": "Ready to save",
  "home.conciergeResume.step.attention": "Needs your review",
  "home.conciergeResume.step.confirm": "Waiting for your confirmation",
  "home.conciergeResume.step.providerShortlist": "Review saved options",
  "home.conciergeResume.kickerProviderShortlist": "Saved shortlist",
  "home.conciergeResume.titleProviderShortlistPrefix": "Review your",
  "home.conciergeResume.open": "Open Right Now",
  "home.conciergeResume.openShort": "Open",
  "home.conciergeResume.followUp": "Follow up",
  "home.conciergeResume.gotReply": "I got a reply",
  "home.conciergeResume.waitingTitle": "Waiting for {{provider}}",
  "home.conciergeResume.providerFallback": "provider",
  "home.conciergeReuse.kicker": "Useful again",
  "home.conciergeReuse.title": "Use last {{task}} again",
  "home.conciergeReuse.action": "Use template",
  "home.conciergeReuse.providerFallback": "VYVA",
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
    guardPathMock.mockReturnValue(true);
    canUseServiceMock.mockReturnValue(true);
    voiceHeroMock.mockClear();
    profileMock.firstName = "Karim";
    profileMock.withGpContact = true;
    profileMock.serviceReadiness.hasSavedDoctor = undefined;
    profileMock.serviceReadiness.hasSavedTransportProvider = undefined;
    profileMock.serviceReadiness.hasMobilityInfo = undefined;
    profileMock.serviceReadiness.hasCoverageInfo = undefined;
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

  it("counts only active Concierge tasks on the Home badge", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [
              {
                id: "done-ride",
                use_case: "book_ride",
                status: "completed",
                provider_name: "Old Taxi",
                action_summary: "Completed ride.",
                action_payload: null,
              },
              {
                id: "cancelled-admin",
                use_case: "admin_task",
                status: "cancelled",
                provider_name: "VYVA review",
                action_summary: "Cancelled task.",
                action_payload: null,
              },
              {
                id: "active-service",
                use_case: "home_service",
                status: "calling",
                provider_name: "Saved Plumber",
                action_summary: "VYVA is contacting Saved Plumber.",
                action_payload: { mission_status: "awaiting_provider_reply" },
              },
            ],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-agent-concierge")).toHaveTextContent("1 task");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Waiting for Saved Plumber");
    expect(screen.queryByText("Old Taxi")).not.toBeInTheDocument();
  });

  it("surfaces a pending Concierge task until the user confirms it", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "ride-1",
              use_case: "book_ride",
              status: "pending",
              provider_name: "Radio Taxi",
              action_summary: "Ready to confirm.",
              action_payload: null,
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Ready to review");
    expect(nudge).toHaveTextContent("Review your ride");
    expect(nudge).toHaveTextContent("Nothing happens before you confirm.");
    expect(screen.getByTestId("button-home-concierge-open")).toHaveTextContent("Open");
    expect(screen.queryByTestId("button-home-concierge-follow-up")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-concierge-got-reply")).not.toBeInTheDocument();

    const fastHelp = screen.getByTestId("home-fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", { state: { focusRightNow: true, conciergePendingId: "ride-1" } });
  });

  it("selects the actionable form instead of the first passive provider wait", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "waiting-ride",
              use_case: "book_ride",
              status: "calling",
              provider_name: "Radio Taxi",
              confirmed_at: "2026-07-17T13:00:00.000Z",
              action_payload: { mission_status: "awaiting_provider_reply" },
            }, {
              id: "insurance-form",
              use_case: "admin_task",
              status: "pending",
              provider_name: "VYVA review",
              confirmed_at: "2026-07-17T10:00:00.000Z",
              action_payload: { mission_status: "preparing_form" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const card = screen.getByTestId("card-home-concierge-resume");
    expect(card).toHaveAttribute("data-resume-kind", "form");
    expect(card).toHaveTextContent("Review your admin task");
    expect(card).toHaveTextContent("Nothing happens before you confirm.");
    expect(card).not.toHaveTextContent("Radio Taxi");
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/insurance-form", {
      state: { focusRightNow: true, conciergePendingId: "insurance-form" },
    });
  });

  it("selects a provider setup blocker before a newer booking", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "newer-booking",
              use_case: "book_appointment",
              status: "pending",
              confirmed_at: "2026-07-17T13:00:00.000Z",
              action_payload: {},
            }, {
              id: "provider-setup",
              use_case: "find_provider",
              status: "pending",
              confirmed_at: "2026-07-16T13:00:00.000Z",
              action_payload: {
                retry_blocker: "adapter_payload_missing_provider_contact",
                setup_focus: "doctor_clinic",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "provider_setup");
    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/provider-setup", {
      state: { focusRightNow: true, conciergePendingId: "provider-setup" },
    });
  });

  it("surfaces saved Show VYVA tasks as prepared work from Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "show-vyva-scam-1",
              use_case: "scam_check",
              status: "pending",
              provider_name: "Trusted contact",
              action_summary: "Ask before replying to this bank message.",
              action_payload: {
                show_vyva_action_id: "call_trusted_contact",
                show_vyva_follow_up_context: "scam",
                show_vyva_source: "paste_text",
                source_route: "/scam-guard",
                review_summary: "Suspicious bank message",
                requested_tool: "phone_call",
                confirmation_required_before_action: true,
                no_external_action_without_confirmation: true,
                executor_version: 1,
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("VYVA prepared this");
    expect(nudge).toHaveTextContent("Scam Guard");
    expect(nudge).toHaveTextContent("Call");
    expect(nudge).toHaveTextContent("Suspicious bank message");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/show-vyva-scam-1", { state: { focusRightNow: true, conciergePendingId: "show-vyva-scam-1" } });
  });

  it("surfaces the latest unresolved Show VYVA review from Home without exposing raw reviewed content", () => {
    window.localStorage.setItem(SHOW_VYVA_REVIEW_HISTORY_KEY, JSON.stringify([
      {
        id: "review-unresolved",
        reviewedAt: "2026-07-19T10:00:00.000Z",
        useCaseId: "provider_or_deal",
        followUpContext: "provider_deal",
        inputType: "company_name",
        source: "paste_text",
        summary: "Possible overcharging in a service quote.",
        decision: "Check before agreeing",
        confidenceLabel: "Needs review",
        actionSaved: false,
        savedActionLabel: null,
        resumeRoute: "/scam-guard",
      },
      {
        id: "review-saved",
        reviewedAt: "2026-07-18T10:00:00.000Z",
        useCaseId: "scam_check",
        followUpContext: "scam",
        inputType: "phone_number",
        source: "paste_text",
        summary: "Suspicious phone number.",
        decision: "Do not call back yet",
        confidenceLabel: "Clear risk",
        actionSaved: true,
        savedActionLabel: "Block or report",
        resumeRoute: "/scam-guard",
      },
    ]));

    render(<HomeScreen />);

    const nudge = screen.getByTestId("card-home-show-vyva-review-resume");
    expect(nudge).toHaveTextContent("Recent Show VYVA");
    expect(nudge).toHaveTextContent("Continue this review");
    expect(nudge).toHaveTextContent("Check before agreeing");
    expect(nudge).toHaveTextContent("Possible overcharging in a service quote.");
    expect(nudge).not.toHaveTextContent("+34 600 111 222");

    fireEvent.click(nudge);

    expect(guardPathMock).toHaveBeenCalledWith("/scam-guard", {
      state: {
        showVyvaReviewHistoryId: "review-unresolved",
        showVyvaResume: true,
      },
    });
  });

  it("surfaces a saved provider shortlist and opens the exact Concierge task", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "shortlist-7",
              use_case: "find_provider",
              status: "pending",
              provider_name: "Harbour Clinic",
              action_summary: "Two provider options saved.",
              action_payload: {
                task_type: "provider_shortlist",
                selected_provider_names: ["Harbour Clinic", "Garden Care"],
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Saved shortlist");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review your saved options");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review saved options");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "provider_shortlist");

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/shortlist-7", {
      state: { focusRightNow: true, conciergePendingId: "shortlist-7" },
    });
  });

  it("labels home-service appointment tasks as home service on Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "service-1",
              use_case: "book_appointment",
              status: "pending",
              provider_name: "Saved Plumber",
              action_summary: "VYVA is preparing a plumber visit.",
              action_payload: {
                appointment_type: "home-service",
                mission_status: "awaiting_user_save",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Review your home service");
    expect(nudge).toHaveTextContent("Ready to review");
    expect(nudge).toHaveAttribute("data-resume-kind", "booking");
  });

  it("labels admin and safety concierge tasks instead of generic requests", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "admin-1",
              use_case: "admin_task",
              status: "pending",
              provider_name: "VYVA review",
              action_summary: "Paperwork task prepared.",
              action_payload: { flow_reference: "FLOW_INSURANCE_ADMIN", execution_channel: "manual" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      if (key === "/api/concierge/actions/sessions") {
        return {
          data: {
            items: [{
              id: "scam-session-1",
              pending_id: "scam-1",
              use_case: "scam_check",
              provider_name: "VYVA review",
              outcome: "completed",
              outcome_summary: "Safety review completed.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: { flow_reference: "FLOW_SCAM_CHECK" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Review your admin task");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveTextContent("Nothing happens before you confirm.");
    expect(screen.getByTestId("card-home-concierge-resume")).toHaveAttribute("data-resume-kind", "form");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-reuse")).not.toBeInTheDocument();
  });

  it("surfaces completed Concierge tasks as reusable templates from Home", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/sessions") {
        return {
          data: {
            items: [{
              id: "session-ride",
              pending_id: "old-ride",
              use_case: "book_ride",
              provider_name: "Radio Taxi",
              outcome: "completed",
              outcome_summary: "Ride saved with Radio Taxi.",
              completed_at: "2026-08-04T09:30:00.000Z",
              outcome_payload: {
                provider_phone: "+34 612 345 678",
                pickup_address: "Saved home",
                destination_address: "City Clinic",
                requested_time: "tomorrow 09:00",
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const card = screen.getByTestId("card-home-concierge-reuse");
    expect(card).toHaveTextContent("Useful again");
    expect(screen.getByTestId("badge-home-concierge-completed-state")).toHaveTextContent("Completed");
    expect(card).toHaveTextContent("Use last ride again");
    expect(card).toHaveTextContent("Radio Taxi");

    fireEvent.click(card);

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: {
        conciergeCompletedTemplate: expect.objectContaining({
          id: "session-ride",
          use_case: "book_ride",
          provider_name: "Radio Taxi",
          outcome_payload: expect.objectContaining({
            destination_address: "City Clinic",
            requested_time: "tomorrow 09:00",
          }),
        }),
      },
    });
  });

  it("surfaces an in-progress Concierge task and opens Right Now", () => {
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "ride-1",
              use_case: "book_ride",
              status: "calling",
              provider_name: "Radio Taxi",
              action_summary: "VYVA is contacting Radio Taxi.",
              action_payload: {
                mission_status: "awaiting_provider_reply",
                live_handoff_status: "waiting",
                provider_waiting_since: new Date(Date.now() - (30 * 60_000) - 1_000).toISOString(),
              },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const nudge = screen.getByTestId("card-home-concierge-resume");
    expect(nudge).toHaveTextContent("Waiting");
    expect(nudge).toHaveTextContent("Waiting for Radio Taxi");
    expect(nudge).toHaveTextContent("30 min waiting");
    expect(screen.getByTestId("button-home-concierge-open")).toHaveTextContent("Open");
    expect(screen.getByTestId("button-home-concierge-follow-up")).toHaveTextContent("Follow up");
    expect(screen.getByTestId("button-home-concierge-got-reply")).toHaveTextContent("I got a reply");
    expect(screen.queryByTestId("button-home-fast-concierge-status")).not.toBeInTheDocument();
    const fastHelp = screen.getByTestId("home-fast-help");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(3);
    expect(screen.queryByTestId("button-home-fast-book-ride")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("button-home-fast-feel-better")
      || screen.queryByTestId("button-home-fast-safe-home"),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId("button-home-concierge-open"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", { state: { focusRightNow: true, conciergePendingId: "ride-1" } });

    fireEvent.click(screen.getByTestId("button-home-concierge-follow-up"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", {
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "ride-1",
          mode: "follow_up",
        },
      },
    });

    fireEvent.click(screen.getByTestId("button-home-concierge-got-reply"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge/task/ride-1", {
      state: {
        focusRightNow: true,
        conciergeProviderAction: {
          pendingId: "ride-1",
          mode: "reply",
        },
      },
    });
  });

  it("does not render the legacy Home chat nudge", () => {
    render(<HomeScreen />);

    expect(screen.queryByTestId("home-start-nudge")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-hero-talk")).toHaveAccessibleName("Speak anytime");
    expect(guardPathMock).not.toHaveBeenCalledWith("/chat", undefined);
  });

  it("renders three contextual Fast help actions that stay stable throughout the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T08:00:00.000Z"));
    render(<HomeScreen />);

    const fastHelp = screen.getByTestId("home-fast-help");
    expect(fastHelp).toHaveTextContent("Fast help");
    const initialActions = within(fastHelp).getAllByRole("button").map((button) => button.dataset.testid);
    expect(initialActions).toHaveLength(3);
    expect(screen.getByTestId("button-home-fast-feel-better")).toHaveTextContent("Symptoms Check");
    expect(screen.getByTestId("button-home-fast-stay-well")).toHaveTextContent("Age Well");
    expect(screen.getByTestId("button-home-fast-find-care")).toHaveTextContent("Find Care");
    const initialImpressions = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    );
    expect(initialImpressions).toHaveLength(1);
    expect(initialImpressions[0]).toMatchObject({
      actionIds: initialActions.map((testId) => testId?.replace("button-home-fast-", "")),
      rankingVersion: "personalized-v1",
    });
    expect(Object.keys(initialImpressions[0]).sort()).toEqual(["actionIds", "id", "rankingVersion", "shownAt"]);

    act(() => {
      vi.setSystemTime(new Date("2026-07-17T20:00:00.000Z"));
      vi.advanceTimersByTime(60_000);
    });

    expect(within(fastHelp).getAllByRole("button").map((button) => button.dataset.testid)).toEqual(initialActions);
    expect(JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    )).toHaveLength(1);
  });

  it("opens Find Care as a structured Concierge provider search", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId("button-home-fast-find-care"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", expect.objectContaining({
      state: expect.objectContaining({
        conciergePrefill: expect.objectContaining({
          kind: "task",
          flowReference: "FLOW_CARE_NAVIGATION",
          requestedTool: "operator_review",
          actionLabel: "Prepare care search",
          useCase: "find_provider",
          source: "home_quick_action",
        }),
        homeFastHelpContext: expect.objectContaining({
          actionId: "find-care",
          destinationPath: "/concierge",
        }),
      }),
    }));
    expect(JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-history:v1:profile-home") ?? "[]",
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ actionId: "find-care", status: "used" }),
    ]));
    const impressions = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-impressions:v1:profile-home") ?? "[]",
    );
    const journeys = JSON.parse(
      window.localStorage.getItem("vyva:home-fast-help-journeys:v1:profile-home") ?? "[]",
    );
    expect(journeys[0]).toMatchObject({ actionId: "find-care" });
    const attributedImpression = impressions.find((impression: { id: string }) => (
      impression.id === journeys[0].impressionId
    ));
    expect(attributedImpression).toBeDefined();
    expect(attributedImpression.actionIds).toContain("find-care");
  });

  it("shows one calm recovery nudge after the cooldown and resumes the exact journey", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "find_provider" } },
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000 + 30_000,
      reason: "returned_home",
    });

    render(<HomeScreen />);

    const recovery = screen.getByTestId("card-home-fast-help-recovery");
    expect(recovery).toHaveTextContent("Continue where you left off");
    expect(recovery).toHaveTextContent("Continue Find Care when you are ready.");
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: { useCase: "find_provider" },
        homeFastHelpContext: expect.objectContaining({
          journeyId: started.journey.id,
          actionId: "find-care",
        }),
      }),
    });
  });

  it("shows one actionable Fast Help recovery instead of a passive Concierge wait", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "paperwork-help",
      destinationPath: "/concierge",
      destinationState: { conciergePrefill: { useCase: "admin_task" } },
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: Date.now() - 13 * 60 * 60 * 1000 + 30_000,
      reason: "returned_home",
    });
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/concierge/actions/pending") {
        return {
          data: {
            items: [{
              id: "waiting-provider",
              use_case: "home_service",
              status: "calling",
              provider_name: "Saved Plumber",
              action_payload: { mission_status: "awaiting_provider_reply" },
            }],
          },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveAttribute("data-resume-kind", "fast_help");
    expect(screen.queryByTestId("card-home-concierge-resume")).not.toBeInTheDocument();
    expect(screen.queryByTestId("card-home-concierge-reuse")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-home-fast-paperwork-help")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));
    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: { useCase: "admin_task" },
        homeFastHelpContext: expect.objectContaining({ journeyId: started.journey.id }),
      }),
    });
  });

  it("resumes a journey opened on another device with locally derived safe instructions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const storageKey = homeFastHelpJourneyStorageKey(profileMock.profileId);
    mergeSyncedHomeFastHelpJourneys(storageKey, [{
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      actionId: "book-ride",
      status: "abandoned",
      startedAt: "2026-07-16T23:00:00.000Z",
      updatedAt: "2026-07-16T23:01:00.000Z",
      referenceId: null,
      events: [{
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        status: "opened",
        occurredAt: "2026-07-16T23:00:00.000Z",
        referenceId: null,
      }, {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        status: "abandoned",
        occurredAt: "2026-07-16T23:01:00.000Z",
        referenceId: null,
      }],
    }]);

    render(<HomeScreen />);
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/concierge", {
      state: expect.objectContaining({
        conciergePrefill: expect.objectContaining({
          kind: "ride",
          flowReference: "FLOW_TRANSPORT_BOOKING",
          source: "home_quick_action",
        }),
        homeFastHelpContext: expect.objectContaining({
          journeyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          actionId: "book-ride",
        }),
      }),
    });
  });

  it("suppresses a blocked choice and explains the useful alternative", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    const started = startHomeFastHelpJourney({
      actionId: "find-care",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: Date.now() - 60_000,
    });
    markHomeFastHelpJourney(started.context, "blocked", {
      occurredAtMs: Date.now() - 30_000,
      reason: "service_not_ready",
    });

    render(<HomeScreen />);

    expect(screen.queryByTestId("button-home-fast-find-care")).not.toBeInTheDocument();
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("One quick step first");
    expect(screen.getByTestId("home-fast-help")).toHaveTextContent("Try this useful next step instead");
  });

  it("defers a recovery nudge and respects the cooldown", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    const started = startHomeFastHelpJourney({
      actionId: "paperwork-help",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    const first = render(<HomeScreen />);
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-later"));
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date(now.getTime() + 11 * 60 * 60 * 1000));
    const beforeCooldown = render(<HomeScreen />);
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    beforeCooldown.unmount();

    vi.setSystemTime(new Date(now.getTime() + 13 * 60 * 60 * 1000));
    render(<HomeScreen />);
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("Continue where you left off");
  });

  it("dismisses a recovery nudge permanently", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    const started = startHomeFastHelpJourney({
      actionId: "stay-well",
      destinationPath: "/health/prevention",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    const first = render(<HomeScreen />);
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-dismiss"));
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
    first.unmount();

    vi.setSystemTime(new Date("2026-07-25T14:00:00.000Z"));
    render(<HomeScreen />);
    expect(screen.queryByTestId("card-home-fast-help-recovery")).not.toBeInTheDocument();
  });

  it("routes a blocked ride to focused transport setup and preserves its return context", () => {
    vi.useFakeTimers();
    const now = new Date("2026-07-17T14:00:00.000Z");
    vi.setSystemTime(now);
    profileMock.serviceReadiness.hasSavedTransportProvider = false;
    const started = startHomeFastHelpJourney({
      actionId: "book-ride",
      destinationPath: "/concierge",
      profileId: profileMock.profileId,
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000,
    });
    markHomeFastHelpJourney(started.context, "abandoned", {
      occurredAtMs: now.getTime() - 13 * 60 * 60 * 1000 + 30_000,
    });

    render(<HomeScreen />);
    expect(screen.getByTestId("card-home-fast-help-recovery")).toHaveTextContent("Add a trusted transport provider");
    fireEvent.click(screen.getByTestId("button-home-fast-help-recovery-continue"));

    expect(guardPathMock).toHaveBeenCalledWith("/onboarding/profile/providers", {
      state: expect.objectContaining({
        returnTo: "/concierge",
        setupFocus: "transport",
        setupFlow: "FLOW_TRANSPORT_BOOKING",
        conciergeResume: expect.objectContaining({ kind: "transport" }),
        returnState: expect.objectContaining({
          homeFastHelpContext: expect.objectContaining({
            journeyId: started.journey.id,
            actionId: "book-ride",
          }),
        }),
      }),
    });
  });

  it("puts an urgent health signal first with a reassuring reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    queryMock.mockImplementation((queryKey: unknown[]) => {
      const [key] = queryKey;
      if (key === "/api/weather") {
        return { data: { city: "Madrid", temperature: 22, description: "Clear" }, isError: false, error: null };
      }
      if (key === "/api/vitals-engine/latest") {
        return {
          data: { analysis: { safety_status: "attention", recommended_action: "Seek care today" } },
          isError: false,
          error: null,
        };
      }
      return { data: null, isError: false, error: null };
    });

    render(<HomeScreen />);

    const actions = within(screen.getByTestId("home-fast-help")).getAllByRole("button");
    expect(actions[0]).toHaveAttribute("data-testid", "button-home-fast-feel-better");
    expect(actions[0]).toHaveTextContent("A recent health signal may need attention");
  });

  it("uses saved transport readiness and avoids a recently used action", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-17T14:00:00.000Z"));
    profileMock.serviceReadiness.hasSavedTransportProvider = true;
    window.localStorage.setItem("vyva:home-fast-help-history:v1:profile-home", JSON.stringify([{
      actionId: "feel-better",
      status: "used",
      occurredAt: "2026-07-17T13:30:00.000Z",
    }]));

    render(<HomeScreen />);

    expect(screen.getByTestId("button-home-fast-book-ride")).toHaveTextContent("Your transport setup is ready");
    expect(screen.queryByTestId("button-home-fast-feel-better")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-home-fast-safe-home")).toBeInTheDocument();
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
