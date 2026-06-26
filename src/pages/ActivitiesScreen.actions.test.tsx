import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ParticipationEventRecommendation,
  ParticipationEventResponseAction,
  ParticipationPulse,
} from "@/social/types";
import { apiFetch } from "@/lib/queryClient";
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
    format: "nearby",
  });
  const recommendations = [
    eventFixture({
      id: "book-club-taster",
      title: "Book club taster",
      summary: "A light session to hear recommendations and share a favourite read.",
      format: "nearby",
      tags: ["reading"],
      interestTags: ["reading"],
      score: 70,
    }),
    eventFixture({
      id: "online-culture-chat",
      title: "Online culture chat",
      summary: "A quiet online group for language, culture, and stories.",
      format: "online",
      locationLabel: "Online from home",
      tags: ["language", "culture"],
      interestTags: ["language", "culture"],
      score: 65,
    }),
    eventFixture({
      id: "garden-walk",
      title: "Garden walk with pauses",
      summary: "A short outing to enjoy plants, sit when needed, and return without rushing.",
      format: "hybrid",
      tags: ["nature", "walking"],
      interestTags: ["nature", "walking"],
      score: 60,
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
  caregiverNudge: null,
};

function clonePulse(pulse: ParticipationPulse): ParticipationPulse {
  return JSON.parse(JSON.stringify(pulse)) as ParticipationPulse;
}

function updatePulseResponse(
  pulse: ParticipationPulse,
  eventId: string,
  response: ParticipationEventResponseAction,
): ParticipationPulse {
  const nextResponse = response === "clear" ? null : response;
  const updateEvent = <T extends ParticipationEventRecommendation>(event: T): T => (
    event.id === eventId ? { ...event, myResponse: nextResponse } : event
  );
  const featuredEvent = updateEvent(pulse.featuredEvent);
  const recommendations = pulse.recommendations.map(updateEvent);
  const savedEvents = [featuredEvent, ...recommendations].filter((event) => (
    event.myResponse === "interested" || event.myResponse === "maybe"
  ));
  return { ...pulse, featuredEvent, recommendations, savedEvents };
}

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </>
  );
}

function renderActivities({
  pulse = pulseFixture(),
  dailyPlan = dailyPlanPayload,
  progress = { summary: { streakDays: 2 }, today: { completedCount: 0, activityTypes: [] } },
}: {
  pulse?: ParticipationPulse;
  dailyPlan?: unknown;
  progress?: unknown;
} = {}) {
  const current = { pulse };
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          if (path.startsWith("/api/social/participate/pulse")) return { pulse: clonePulse(current.pulse) };
          if (path === "/api/games/progress") return progress;
          if (path === "/api/games/daily-plan") return dailyPlan;
          return {};
        },
      },
      mutations: { retry: false },
    },
  });

  mocks.apiFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/respond") && init?.method === "POST") {
      const eventId = url.split("/events/")[1]?.split("/")[0] ?? "";
      const body = JSON.parse(String(init.body ?? "{}")) as { response: ParticipationEventResponseAction };
      current.pulse = updatePulseResponse(current.pulse, eventId, body.response);
      return {
        ok: true,
        json: async () => ({
          eventId,
          response: body.response === "clear" ? null : body.response,
          responseCounts: { interested: 3, maybe: 1, not_for_me: 0 },
        }),
      };
    }
    if (url.includes("/ask-vyva") && init?.method === "POST") {
      const eventId = url.split("/events/")[1]?.split("/")[0] ?? "";
      return {
        ok: true,
        json: async () => ({
          eventId,
          checkStatus: "requested",
          conciergePrefill: {
            kind: "events",
            source: "activities",
            message: "Help me check this event. Do not book or contact anyone without my confirmation.",
            event: { id: eventId, title: "Familiar songs table" },
          },
        }),
      };
    }
    if (url === "/api/games/daily-plan/events" && init?.method === "POST") {
      return { ok: true, json: async () => ({ ok: true }) };
    }
    return { ok: false, json: async () => ({}) };
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/activities"]}>
        <Routes>
          <Route path="/activities" element={<ActivitiesScreen />} />
          <Route path="/concierge" element={<LocationProbe />} />
          <Route path="/onboarding/profile/hobbies" element={<LocationProbe />} />
          <Route path="/memory-games" element={<LocationProbe />} />
          <Route path="/attention-boosters" element={<LocationProbe />} />
          <Route path="/language" element={<LocationProbe />} />
          <Route path="/activities/relax-breathe" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...view, queryClient, current };
}

describe("Activities event actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("filters recommendations by For you, Nearby, Online, and Saved", async () => {
    const savedEvent = eventFixture({
      id: "saved-music-class",
      title: "Saved music class",
      myResponse: "interested",
    });
    renderActivities({
      pulse: pulseFixture({
        savedEvents: [savedEvent],
      }),
    });

    expect(await screen.findByRole("heading", { name: "Activities chosen for you" })).toBeInTheDocument();
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Book club taster");
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Online culture chat");

    fireEvent.click(screen.getByTestId("activities-filter-nearby"));
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Book club taster");
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Garden walk with pauses");
    expect(screen.getByTestId("activities-more-recommendations")).not.toHaveTextContent("Online culture chat");

    fireEvent.click(screen.getByTestId("activities-filter-online"));
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Online culture chat");
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Garden walk with pauses");
    expect(screen.getByTestId("activities-more-recommendations")).not.toHaveTextContent("Book club taster");

    fireEvent.click(screen.getByTestId("activities-filter-saved"));
    expect(screen.getByTestId("activities-more-recommendations")).toHaveTextContent("Saved music class");
    expect(screen.queryByTestId("activities-saved-events")).not.toBeInTheDocument();
  });

  it("saves interested, maybe, and not-for-me responses through the participation endpoint", async () => {
    renderActivities();

    fireEvent.click((await screen.findAllByRole("button", { name: /I'm interested/i }))[0]);

    await waitFor(() => {
      expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Interest saved");
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/social/participate/events/gentle-choir-table/respond",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"response":"interested"'),
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Maybe later/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Saved for later");
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/social/participate/events/gentle-choir-table/respond",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"response":"maybe"'),
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Not for me/i })[0]);
    await waitFor(() => {
      expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("This will not be shown first");
    });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/social/participate/events/gentle-choir-table/respond",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"response":"not_for_me"'),
      }),
    );
  });

  it("asks VYVA to check an event and carries event context to Concierge", async () => {
    renderActivities();

    fireEvent.click((await screen.findAllByRole("button", { name: /Ask VYVA to check/i }))[0]);

    await waitFor(() => {
      expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    });
    expect(screen.getByTestId("route-state")).toHaveTextContent("gentle-choir-table");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Do not book or contact anyone");
  });

  it("shows starter events and a profile nudge when profile signals are thin", async () => {
    renderActivities({
      pulse: pulseFixture({
        profileSignals: {
          interests: [],
          locationLabel: "Near you or online",
          preferredTimes: [],
          languageLabel: "English",
          needsProfileNudge: true,
        },
        emptyProfileNudge: {
          title: "Tell us your interests",
          body: "VYVA can then recommend events, classes, and outings that fit you.",
          actionLabel: "Add hobbies",
          path: "/onboarding/profile/hobbies",
        },
      }),
    });

    expect(await screen.findByTestId("activities-profile-nudge")).toHaveTextContent("Tell us your interests");
    expect(screen.getByTestId("activities-featured-event")).toHaveTextContent("Familiar songs table");

    fireEvent.click(screen.getByRole("button", { name: "Add hobbies" }));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/onboarding/profile/hobbies");
  });

  it("keeps compact Brain Coach links below the curated event experience", async () => {
    renderActivities();

    const brainCoach = await screen.findByTestId("activities-brain-coach-strip");
    expect(brainCoach).toHaveTextContent("A short plan for today");
    expect(screen.queryByTestId("section-activities-primary-actions")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-activities-quick-relax"));
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe"));

    cleanup();
    renderActivities();
    fireEvent.click(await screen.findByTestId("button-activities-quick-learn"));
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/language"));

    cleanup();
    renderActivities();
    fireEvent.click(await screen.findByTestId("button-activities-quick-play"));
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games"));
  });
});
