import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import type { ParticipationEventRecommendation, ParticipationPulse } from "@/social/types";
import ActivitiesScreen from "./ActivitiesScreen";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    language: "en",
    t: (key: string, fallback?: string, vars?: Record<string, unknown>) => {
      if (key === "brain.progressStreak") return `${vars?.count ?? 0} day streak`;
      return fallback ?? key;
    },
  }),
}));

function eventFixture(input: Partial<ParticipationEventRecommendation> & { id: string; title: string }): ParticipationEventRecommendation {
  return {
    id: input.id,
    eventKey: input.id,
    title: input.title,
    summary: input.summary ?? "A gentle curated event chosen for this profile.",
    description: input.description ?? "VYVA checks details before anyone commits.",
    format: input.format ?? "nearby",
    locationLabel: input.locationLabel ?? "Nearby or online",
    city: input.city ?? null,
    countryCode: input.countryCode ?? "ES",
    timeLabel: input.timeLabel ?? "This week, time to be checked",
    startsAt: null,
    endsAt: null,
    costLabel: input.costLabel ?? "Free or low cost",
    languageCodes: input.languageCodes ?? ["en", "es", "de"],
    tags: input.tags ?? ["music", "social"],
    interestTags: input.interestTags ?? ["music", "choir"],
    accessibilityTags: input.accessibilityTags ?? ["seating", "easy_access"],
    helperActions: input.helperActions ?? ["check_details", "transport", "reminder"],
    source: input.source ?? "curated",
    sourceUrl: null,
    status: input.status ?? "active",
    isCurated: input.isCurated ?? true,
    needsLiveCheck: input.needsLiveCheck ?? true,
    safetyStatus: input.safetyStatus ?? "approved",
    responseCounts: input.responseCounts ?? { interested: 2, maybe: 1, not_for_me: 0 },
    myResponse: input.myResponse ?? null,
    fitReasons: input.fitReasons ?? [
      { id: "interest", kind: "interest", label: "Matches music" },
      { id: "access", kind: "access", label: "Comfort and access included" },
      { id: "safety", kind: "safety", label: "VYVA checks details before you commit" },
    ],
    checkStatus: input.checkStatus ?? "none",
    score: input.score ?? 90,
  };
}

function pulseFixture(overrides: Partial<ParticipationPulse> = {}): ParticipationPulse {
  const featuredEvent = eventFixture({
    id: "gentle-choir-table",
    title: "Familiar songs table",
    summary: "A small gathering to listen, hum along, or share a song you love.",
  });
  const recommendations = [
    eventFixture({
      id: "book-club-taster",
      title: "Book club taster",
      summary: "A light session to hear recommendations and share a favourite read.",
      tags: ["reading"],
      interestTags: ["reading"],
      score: 70,
    }),
    eventFixture({
      id: "garden-walk",
      title: "Garden walk with pauses",
      summary: "A short outing to enjoy plants, sit when needed, and return without rushing.",
      tags: ["nature", "walking"],
      interestTags: ["nature", "walking"],
      score: 65,
    }),
  ];

  return {
    generatedAt: "2026-06-24T10:00:00.000Z",
    language: "en",
    headline: "Events chosen for you",
    reassurance: "VYVA checks details before you commit.",
    safetyCopy: "No booking, payment, or outside contact happens without your confirmation.",
    profileSignals: {
      interests: ["music", "reading"],
      locationLabel: "Near you or online",
      preferredTimes: ["afternoon"],
      languageLabel: "English",
      needsProfileNudge: false,
    },
    featuredEvent,
    recommendations,
    savedEvents: [],
    notifications: [],
    ...overrides,
  };
}

const progressPayload = {
  summary: {
    streakDays: 2,
    lastPlayedAt: "2026-06-01T09:00:00.000Z",
  },
  today: {
    completedCount: 0,
    activityTypes: [],
  },
};

const dailyPlanPayload = {
  planId: "plan-1",
  status: "active" as const,
  estimatedDurationMinutes: 8,
  recommendedDomains: ["attention"],
  activities: [{
    planItemId: "item-1",
    activityType: "sequence_memory",
    title: "Rhythm Tap",
    domain: "attention",
    route: "/attention-boosters",
    estimatedDurationMinutes: 4,
    rationale: "A short attention warm-up",
    status: "recommended" as const,
    completedToday: false,
  }],
  rationale: ["Starts with one short activity."],
  completion: {
    completedCount: 0,
    totalCount: 1,
    allComplete: false,
  },
  caregiverNudge: {
    id: "nudge-1",
    messageType: "today_plan",
    title: "Your Brain Coach plan is ready",
    body: "Your caregiver suggested starting with one short recommended activity.",
    sentAt: "2026-06-01T10:00:00.000Z",
    sentBy: "caregiver-1",
    status: "unread" as const,
    isUnread: true,
    readAt: null,
    dismissedAt: null,
  },
};

function renderActivitiesScreen({
  pulse = pulseFixture(),
  dailyPlan = dailyPlanPayload,
  progress = progressPayload,
}: {
  pulse?: ParticipationPulse;
  dailyPlan?: unknown;
  progress?: unknown;
} = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          if (path.startsWith("/api/social/participate/pulse")) return { pulse };
          if (path === "/api/games/progress") return progress;
          if (path === "/api/games/daily-plan") return dailyPlan;
          return {};
        },
      },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ActivitiesScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("ActivitiesScreen curated events", () => {
  it("renders events first and keeps Brain Coach compact below", async () => {
    renderActivitiesScreen();

    expect(await screen.findByRole("heading", { name: "Activities chosen for you" })).toBeInTheDocument();
    expect(screen.getByText("VYVA checks details before you commit.")).toBeInTheDocument();
    expect(screen.getByTestId("activities-profile-signals")).toHaveTextContent("music");
    expect(screen.getByTestId("activities-profile-signals")).toHaveTextContent("English");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Familiar songs table");
    expect(screen.getByTestId("activities-filters")).toHaveTextContent("For you");
    expect(screen.getByTestId("activities-filters")).toHaveTextContent("Nearby");
    expect(screen.getByTestId("activities-filters")).toHaveTextContent("Online");
    expect(screen.getByTestId("activities-filters")).toHaveTextContent("Saved");
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Book club taster");

    const featuredEvent = screen.getByTestId("activities-featured-event");
    const brainCoach = await screen.findByTestId("activities-brain-coach-strip");
    expect(featuredEvent.compareDocumentPosition(brainCoach) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(brainCoach).toHaveTextContent("Brain Coach");
    expect(brainCoach).toHaveTextContent("A short plan for today");
    expect(screen.queryByTestId("section-activities-primary-actions")).not.toBeInTheDocument();
  });
});

describe("ActivitiesScreen Brain Coach nudges", () => {
  it("shows unread caregiver Brain Coach nudges and records them as read", async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true });
    renderActivitiesScreen();

    const nudge = await screen.findByTestId("brain-coach-caregiver-nudge");
    expect(nudge).toHaveTextContent("Your Brain Coach plan is ready");
    expect(nudge).toHaveTextContent("Your caregiver suggested starting with one short recommended activity.");

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith({
        title: "Your Brain Coach plan is ready",
        description: "Your caregiver suggested starting with one short recommended activity.",
      });
    });
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const readCall = mocks.apiFetch.mock.calls.find(([, options]) => {
      const body = JSON.parse(String(options?.body ?? "{}"));
      return body.eventType === "caregiver_nudge_read";
    });
    expect(readCall).toBeTruthy();
    expect(JSON.parse(String(readCall?.[1]?.body))).toMatchObject({
      planId: "plan-1",
      nudgeEventId: "nudge-1",
      eventType: "caregiver_nudge_read",
      source: "activities_screen",
    });
  });

  it("records dismissals for caregiver Brain Coach nudges", async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true });
    renderActivitiesScreen();

    fireEvent.click(await screen.findByTestId("brain-coach-caregiver-nudge-dismiss"));

    await waitFor(() => {
      const dismissCall = mocks.apiFetch.mock.calls.find(([, options]) => {
        const body = JSON.parse(String(options?.body ?? "{}"));
        return body.eventType === "caregiver_nudge_dismissed";
      });
      expect(dismissCall).toBeTruthy();
      expect(JSON.parse(String(dismissCall?.[1]?.body))).toMatchObject({
        planId: "plan-1",
        nudgeEventId: "nudge-1",
        eventType: "caregiver_nudge_dismissed",
        source: "activities_screen",
      });
    });
  });

  it("does not nag again for already-read caregiver Brain Coach nudges", async () => {
    renderActivitiesScreen({
      dailyPlan: {
        ...dailyPlanPayload,
        caregiverNudge: {
          ...dailyPlanPayload.caregiverNudge,
          status: "read",
          isUnread: false,
          readAt: "2026-06-01T10:05:00.000Z",
        },
      },
    });

    expect(await screen.findByTestId("brain-coach-caregiver-nudge")).toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("hides dismissed caregiver Brain Coach nudges", async () => {
    renderActivitiesScreen({
      dailyPlan: {
        ...dailyPlanPayload,
        caregiverNudge: {
          ...dailyPlanPayload.caregiverNudge,
          status: "dismissed",
          isUnread: false,
          readAt: "2026-06-01T10:05:00.000Z",
          dismissedAt: "2026-06-01T10:06:00.000Z",
        },
      },
    });

    expect(await screen.findByText("A short plan for today")).toBeInTheDocument();
    expect(screen.queryByTestId("brain-coach-caregiver-nudge")).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("shows a newer caregiver Brain Coach nudge after an older one was dismissed", async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true });
    renderActivitiesScreen({
      dailyPlan: {
        ...dailyPlanPayload,
        caregiverNudge: {
          ...dailyPlanPayload.caregiverNudge,
          id: "nudge-2",
          title: "A fresh Brain Coach reminder",
          body: "Try today's short plan when you are ready.",
          status: "unread",
          isUnread: true,
          readAt: null,
          dismissedAt: null,
        },
      },
    });

    const nudge = await screen.findByTestId("brain-coach-caregiver-nudge");
    expect(nudge).toHaveTextContent("A fresh Brain Coach reminder");

    await waitFor(() => {
      const readCall = mocks.apiFetch.mock.calls.find(([, options]) => {
        const body = JSON.parse(String(options?.body ?? "{}"));
        return body.nudgeEventId === "nudge-2" && body.eventType === "caregiver_nudge_read";
      });
      expect(readCall).toBeTruthy();
    });
  });
});
