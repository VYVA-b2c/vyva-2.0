import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActivitiesScreen from "./ActivitiesScreen";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey?: unknown[] }) => ({
      data: queryKey?.[0] === "/api/games/progress"
        ? {
            summary: { streakDays: 2 },
            today: { completedCount: 0, activityTypes: [] },
          }
        : undefined,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/hooks/useRouteVoiceAutoStart", () => ({
  useRouteVoiceAutoStart: () => false,
}));

vi.mock("@/components/VoiceHero", () => ({
  default: ({ children }: { children?: ReactNode }) => <div data-testid="voice-hero">{children}</div>,
}));

vi.mock("@/components/VoiceActionFulfillmentPanel", () => ({
  default: () => <div data-testid="voice-action-panel" />,
}));

const labels: Record<string, string> = {
  "brain.voiceSource": "Brain coach",
  "brain.headline": "Brain coach",
  "brain.subtitle": "Keep your mind sharp",
  "brain.streakThisWeek": "Streak this week",
  "activities.chooseActivity": "Choose an activity",
  "activities.trivia": "Focus & Attention",
  "activities.memory": "Memory Game",
  "activities.spatialNavigator": "Logic & Reasoning",
  "activities.scrabble": "Word & Language",
  "activities.logicPuzzle": "Brain Training",
  "activities.meditation": "Relax & Breathe",
  "activities.breathing": "Relax & Breathe",
  "activities.doneToday": "Done today",
  "activities.joinSocialRoom": "Join a room",
  "activities.joinSocialRoomSub": "Start a friendly conversation now.",
  "activities.findCompanions": "Find companions",
  "activities.findCompanionsSub": "Match around interests and routines.",
  "companions.activityTile": "Connect with others",
  "companions.activityTileSubtitle": "Meet others with shared interests",
  "voiceHero.endCall": "Pause listening",
};

vi.mock("@/i18n", () => ({
  useLanguage: () => ({
    t: (key: string) => labels[key] ?? key,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="current-route">{location.pathname}</div>
      <div data-testid="route-state">{JSON.stringify(location.state ?? {})}</div>
    </>
  );
}

function renderActivities() {
  return render(
    <MemoryRouter initialEntries={["/activities"]}>
      <Routes>
        <Route path="/activities" element={<ActivitiesScreen />} />
        <Route path="/activity" element={<LocationProbe />} />
        <Route path="/social-rooms" element={<LocationProbe />} />
        <Route path="/companions" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Activities service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes the calm activity card to movement logging with breathing preselected", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("activity-card-brain-activities-meditation"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activity"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"preselectActivity\":\"Breathing\"");
    expect(screen.getByTestId("route-state")).toHaveTextContent("\"duration\":10");
  });

  it("opens social rooms from the companionship tile", async () => {
    renderActivities();

    expect(screen.getByTestId("activities-companion-actions")).toHaveTextContent("Join a room");
    expect(screen.getByTestId("activities-companion-actions")).toHaveTextContent("Find companions");

    fireEvent.click(screen.getByTestId("button-activities-open-social-rooms"));
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/social-rooms"));
  });

  it("opens companion matching from the companionship tile", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-open-companions"));
    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/companions"));
  });
});
