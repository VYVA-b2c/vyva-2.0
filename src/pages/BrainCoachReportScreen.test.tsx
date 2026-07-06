import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import BrainCoachReportScreen from "./BrainCoachReportScreen";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (_key: string, fallbackOrValues?: string | Record<string, unknown>, values?: Record<string, unknown>) => {
        const fallback = typeof fallbackOrValues === "string" ? fallbackOrValues : _key;
        const interpolation = typeof fallbackOrValues === "object" ? fallbackOrValues : values;
        return fallback.replace(/\{\{(\w+)\}\}/g, (_match, key) => String(interpolation?.[key] ?? `{{${key}}}`));
      },
    }),
  };
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
}

const progress = {
  summary: {
    totalSessions: 5,
    completedSessions: 4,
    streakDays: 3,
    bestStreakDays: 3,
    lastPlayedAt: "2026-06-02T09:00:00.000Z",
    totalDurationSeconds: 720,
  },
  today: {
    completedCount: 1,
    activityTypes: ["word_recall"],
    domains: ["memory"],
  },
  domains: [
    {
      domain: "memory",
      totalSessions: 4,
      completedSessions: 4,
      bestScore: 900,
      totalDurationSeconds: 720,
      lastPlayedAt: "2026-06-02T09:00:00.000Z",
    },
  ],
  activities: [
    {
      activityType: "word_recall",
      totalSessions: 4,
      completedSessions: 4,
      bestScore: 900,
      totalDurationSeconds: 720,
      lastPlayedAt: "2026-06-02T09:00:00.000Z",
    },
  ],
  history: [
    {
      id: "session-1",
      activityType: "word_recall",
      domain: "memory",
      difficulty: 1,
      completed: true,
      score: 900,
      accuracyPct: 100,
      durationSeconds: 180,
      playedAt: "2026-06-02T09:00:00.000Z",
    },
  ],
};

function renderReport(data: unknown = progress) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: async () => data,
      },
    },
  });
  queryClient.setQueryData(["/api/games/progress"], data);

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/informes/brain-coach"]}>
        <LocationProbe />
        <BrainCoachReportScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BrainCoachReportScreen", () => {
  it("turns saved game progress into a readable report", async () => {
    renderReport();

    expect(await screen.findByTestId("brain-coach-report-shell")).toHaveTextContent("Brain Coach report");
    expect(screen.getByTestId("brain-coach-stat-completed")).toHaveTextContent("4");
    expect(screen.getByTestId("brain-coach-stat-streak")).toHaveTextContent("3");
    expect(screen.getByTestId("brain-coach-domain-memory")).toHaveTextContent("Memory");
    expect(screen.getByTestId("brain-coach-domain-memory")).toHaveTextContent("900");
    expect(screen.getByTestId("brain-coach-recent-sessions")).toHaveTextContent("Word recall");
    expect(screen.getByTestId("brain-coach-next-steps")).toHaveTextContent("streak");
  });

  it("offers a clear start state when no games are recorded", async () => {
    renderReport(null);

    expect(await screen.findByText("Ready for your first game")).toBeInTheDocument();
    expect(screen.getByTestId("brain-coach-domain-empty")).toHaveTextContent("No practice areas yet");

    fireEvent.click(screen.getByTestId("button-start-brain-coach-games"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/mind-memory"));
  });
});
