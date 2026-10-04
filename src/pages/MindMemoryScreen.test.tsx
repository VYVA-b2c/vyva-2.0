import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MindMemoryScreen from "./MindMemoryScreen";
import { HOME_MASTER_THEME_STORAGE_KEY } from "@/hooks/useHomeMasterTheme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BrainCoachProgress } from "@/lib/brainCoachReport";

const guardPathMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({ guardPath: guardPathMock }),
}));

vi.mock("@/components/CanonicalDetailFlowShell", () => ({
  CanonicalVoiceButton: ({ label, testId }: { label?: string; testId?: string }) => (
    <button type="button" data-testid={testId}>
      {label}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

function renderMindMemory(progress?: BrainCoachProgress) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => progress ?? {},
      },
    },
  });
  if (progress) queryClient.setQueryData(["/api/games/progress"], progress);
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/mind-memory"]}>
        <Routes>
          <Route path="/mind-memory" element={<MindMemoryScreen />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MindMemoryScreen", () => {
  beforeEach(() => {
    guardPathMock.mockClear();
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "light");
  });

  it("uses the canonical health-hub structure for Brain Coach", () => {
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-canonical-topbar")).toHaveTextContent("Brain Power");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.main");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-home-master-theme", "light");
    expect(screen.getByTestId("mind-memory-cards")).toHaveAttribute("data-card-layout", "canonical-health-hub-grid");
    expect(screen.queryByText("Choose a skill")).not.toBeInTheDocument();
    expect(screen.queryByText("Cognitive Assessment")).not.toBeInTheDocument();

    const expectedCards = [
      ["card-mind-memory-strengthen-memory", "Boost Memory", "8 activities", "bridge"],
      ["card-mind-memory-train-reflexes", "Sharpen Focus", "3 activities", "pulse"],
      ["card-mind-memory-boost-focus", "Think & Plan", "3 activities", "knobs"],
      ["card-mind-memory-sharpen-senses", "Find Calm", "2 activities", "signal"],
    ] as const;

    for (const [testId, title, count, iconAccent] of expectedCards) {
      expect(screen.getByTestId(testId)).toHaveAttribute("data-vyva-card-layout", "canonical-health-hub-action");
      expect(screen.getByTestId(testId)).toHaveTextContent(title);
      expect(screen.getByTestId(`${testId}-status`)).toHaveTextContent(count);
      expect(screen.getByTestId(testId).querySelector(`[data-vyva-icon-tile="${iconAccent}"]`)).toBeInTheDocument();
      expect(screen.getByText(title)).toHaveClass("font-display", "text-[20px]", "font-semibold", "md:text-[24px]");
    }

    expect(screen.queryByText("Memory and recall")).not.toBeInTheDocument();
    expect(screen.queryByText("Attention and response")).not.toBeInTheDocument();
    expect(screen.queryByText("Planning and rules")).not.toBeInTheDocument();
    expect(screen.queryByText("Calm and sensory awareness")).not.toBeInTheDocument();
  });

  it("uses the canonical dark surfaces when the saved theme is dark", () => {
    window.localStorage.setItem(HOME_MASTER_THEME_STORAGE_KEY, "dark");
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-home-master-theme", "dark");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveClass("bg-white/[0.08]");
  });

  it("replaces activity counts with the latest score and achieved level after play", () => {
    renderMindMemory({
      history: [
        { activityType: "word_recall", domain: "memory", completed: true, score: 840, difficulty: 6, playedAt: "2026-09-24T10:00:00.000Z" },
        { activityType: "sequence_memory", domain: "attention", completed: true, score: 610, difficulty: 3, playedAt: "2026-09-24T09:00:00.000Z" },
      ],
    });

    expect(screen.getByTestId("card-mind-memory-strengthen-memory-status")).toHaveTextContent("Score 840 · L6");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory-status")).toHaveAccessibleName("Last score 840. Level 6 achieved.");
    expect(screen.getByTestId("card-mind-memory-train-reflexes-status")).toHaveTextContent("Score 610 · L3");
    expect(screen.getByTestId("card-mind-memory-boost-focus-status")).toHaveTextContent("3 activities");
    expect(screen.getByTestId("card-mind-memory-sharpen-senses-status")).toHaveTextContent("2 activities");
  });

  it.each([
    ["card-mind-memory-strengthen-memory", "/brain-coach/remember"],
    ["card-mind-memory-train-reflexes", "/brain-coach/focus"],
    ["card-mind-memory-boost-focus", "/brain-coach/think"],
    ["card-mind-memory-sharpen-senses", "/brain-coach/calm"],
  ])("routes %s to its existing module", (testId, route) => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId(testId));
    expect(screen.getByTestId("current-route")).toHaveTextContent(route);
  });
});
