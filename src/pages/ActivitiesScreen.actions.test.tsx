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
  "activities.primaryTitle": "Choose your focus",
  "activities.libraryTitle": "Choose an activity",
  "activities.primary.memory": "Strengthen Memory",
  "activities.primary.memorySub": "Practice recall, matching, and daily routines.",
  "activities.primary.reflexes": "Train Reflexes",
  "activities.primary.reflexesSub": "Build faster focus and response.",
  "activities.primary.intelligence": "Boost Intelligence",
  "activities.primary.intelligenceSub": "Challenge logic, planning, and problem solving.",
  "activities.primary.senses": "Sharpen Senses",
  "activities.primary.sensesSub": "Reset with sound, breath, and calm attention.",
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
        <Route path="/memory-games" element={<LocationProbe />} />
        <Route path="/attention-boosters" element={<LocationProbe />} />
        <Route path="/executive-function" element={<LocationProbe />} />
        <Route path="/activities/relax-breathe" element={<LocationProbe />} />
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

  it("renders the health-style primary cards and reordered activity library", () => {
    renderActivities();

    expect(screen.getByText("Choose your focus")).toBeInTheDocument();
    expect(screen.getByTestId("button-activities-primary-memory")).toHaveTextContent("Strengthen Memory");
    expect(screen.getByTestId("button-activities-primary-reflexes")).toHaveTextContent("Train Reflexes");
    expect(screen.getByTestId("button-activities-primary-intelligence")).toHaveTextContent("Boost Intelligence");
    expect(screen.getByTestId("button-activities-primary-senses")).toHaveTextContent("Sharpen Senses");

    const activityCards = screen.getAllByTestId(/^activity-card-/);
    expect(activityCards.map((card) => card.textContent)).toEqual([
      expect.stringContaining("Memory Game"),
      expect.stringContaining("Focus & Attention"),
      expect.stringContaining("Brain Training"),
      expect.stringContaining("Logic & Reasoning"),
      expect.stringContaining("Word & Language"),
      expect.stringContaining("Relax & Breathe"),
    ]);
  });

  it("routes the Strengthen Memory primary card to memory games", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-primary-memory"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games"));
  });

  it("routes the calm activity card to the dedicated Relax & Breathe page", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("activity-card-brain-activities-meditation"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("{}");
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
