import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActivitiesScreen from "./ActivitiesScreen";

vi.mock("@/components/VoiceHero", () => ({
  default: () => <div data-testid="voice-hero" />,
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  useRouteVoiceAutoStart: () => false,
}));

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

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
  status: "active",
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
    status: "recommended",
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
  },
};

function renderActivitiesScreen() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          if (path === "/api/games/progress") return progressPayload;
          if (path === "/api/games/daily-plan") return dailyPlanPayload;
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ActivitiesScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ActivitiesScreen Brain Coach nudges", () => {
  it("shows caregiver-triggered Brain Coach nudges from the daily plan", async () => {
    renderActivitiesScreen();

    const nudge = await screen.findByTestId("brain-coach-caregiver-nudge");
    expect(nudge).toHaveTextContent("Your Brain Coach plan is ready");
    expect(nudge).toHaveTextContent("Your caregiver suggested starting with one short recommended activity.");
  });
});
