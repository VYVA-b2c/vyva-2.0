import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    status: "unread",
    isUnread: true,
    readAt: null,
    dismissedAt: null,
  },
};

function renderActivitiesScreen({
  dailyPlan = dailyPlanPayload,
  progress = progressPayload,
}: {
  dailyPlan?: typeof dailyPlanPayload;
  progress?: typeof progressPayload;
} = {}) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          const path = String(queryKey[0]);
          if (path === "/api/games/progress") return progress;
          if (path === "/api/games/daily-plan") return dailyPlan;
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
  vi.clearAllMocks();
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
