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
  "activities.quick.kicker": "Brain Coach",
  "activities.quick.relax": "Relax & Breathe",
  "activities.quick.relaxSub": "Take a calm guided pause.",
  "activities.quick.learn": "Learn Something New",
  "activities.quick.learnSub": "Try words, language, and recall.",
  "activities.quick.play": "Play a Brain Game",
  "activities.quick.playSub": "Practice memory and focus.",
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
        <Route path="/language" element={<LocationProbe />} />
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

    const streakCard = screen.getByTestId("brain-coach-weekly-streak");
    const primarySection = screen.getByTestId("section-activities-primary-actions");
    expect(streakCard).toHaveTextContent("Streak this week");
    expect(screen.queryByText("Start with one short activity")).not.toBeInTheDocument();
    expect(streakCard.compareDocumentPosition(primarySection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    expect(screen.getByText("Choose your focus")).toBeInTheDocument();
    expect(screen.getByTestId("button-activities-primary-memory")).toHaveTextContent("Strengthen Memory");
    expect(screen.getByTestId("button-activities-primary-reflexes")).toHaveTextContent("Train Reflexes");
    expect(screen.getByTestId("button-activities-primary-intelligence")).toHaveTextContent("Boost Intelligence");
    expect(screen.getByTestId("button-activities-primary-senses")).toHaveTextContent("Sharpen Senses");

    const quickActions = screen.getByTestId("activities-quick-actions");
    expect(quickActions).toHaveTextContent("Brain Coach");
    expect(quickActions).toHaveTextContent("Choose an activity");
    expect(screen.queryByTestId(/^activity-card-/)).not.toBeInTheDocument();
    expect(screen.getByTestId("button-activities-quick-relax")).toHaveTextContent("Relax & Breathe");
    expect(screen.getByTestId("button-activities-quick-relax")).toHaveTextContent("Take a calm guided pause.");
    expect(screen.getByTestId("button-activities-quick-learn")).toHaveTextContent("Learn Something New");
    expect(screen.getByTestId("button-activities-quick-play")).toHaveTextContent("Play a Brain Game");
  });

  it("routes the Strengthen Memory primary card to memory games", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-primary-memory"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games"));
  });

  it("routes the Relax & Breathe quick action to the dedicated page", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-relax"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe"));
    expect(screen.getByTestId("route-state")).toHaveTextContent("{}");
  });

  it("routes the Learn Something New quick action to language activities", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-learn"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/language"));
  });

  it("routes the brain game quick action to memory games", async () => {
    renderActivities();

    fireEvent.click(screen.getByTestId("button-activities-quick-play"));

    await waitFor(() => expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games"));
  });

  it("does not render the old companionship tile on Activities", () => {
    renderActivities();

    expect(screen.queryByTestId("activities-companion-actions")).not.toBeInTheDocument();
    expect(screen.queryByText("Connect with others")).not.toBeInTheDocument();
  });
});
