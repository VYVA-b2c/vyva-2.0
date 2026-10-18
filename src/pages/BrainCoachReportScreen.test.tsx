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
        const fallback = typeof fallbackOrValues === "string"
          ? fallbackOrValues
          : _key === "reports.brainCoach.gamesCount"
            ? Number(fallbackOrValues?.count) === 1 ? "{{count}} game" : "{{count}} games"
            : _key;
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
  performance: {
    areas: [{
      area: "memory",
      status: "usual",
      sessionsInWindow: 3,
      weekly: Array.from({ length: 8 }, (_, index) => ({ weekStart: `2026-05-${10 + index}`, value: index < 5 ? null : 0 })),
    }],
    relaxationMinutes: 4,
    generatedAt: "2026-06-02T10:00:00.000Z",
  },
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
  Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
});

describe("BrainCoachReportScreen", () => {
  it("shows area status and counts without duplicate stats, sparklines, or scores when the flag is on", async () => {
    const { container } = renderReport();

    expect(await screen.findByTestId("brain-coach-report-shell")).toHaveTextContent("Brain Coach report");
    expect(screen.getByTestId("brain-coach-facts")).toHaveTextContent("4");
    expect(screen.getByTestId("brain-coach-performance-memory")).toHaveTextContent("Memory");
    expect(screen.getByTestId("brain-coach-performance-memory")).toHaveTextContent("4 games");
    expect(screen.getByTestId("brain-coach-performance-memory")).toHaveTextContent("Usual for you");
    expect(screen.getByText("Compared only with your own recent games.")).toBeInTheDocument();
    expect(screen.getByTestId("brain-coach-performance")).toHaveTextContent("Relaxation this week: 4 min");
    expect(screen.queryByTestId("brain-coach-report-stats")).not.toBeInTheDocument();
    expect(screen.queryByTestId("brain-coach-domain-grid")).not.toBeInTheDocument();
    expect(container.querySelector('svg[viewBox="0 0 104 28"]')).not.toBeInTheDocument();
    expect(screen.getByTestId("brain-coach-recent-sessions")).not.toHaveTextContent("900");
    expect(screen.getByTestId("brain-coach-recent-sessions")).not.toHaveTextContent("100%");
  });

  it("shows area game counts without performance language when the flag is off", async () => {
    renderReport({ ...progress, performance: undefined });

    expect(await screen.findByTestId("brain-coach-performance-memory")).toHaveTextContent("4 games");
    expect(screen.queryByText("Usual for you")).not.toBeInTheDocument();
    expect(screen.queryByText("Compared only with your own recent games.")).not.toBeInTheDocument();
  });

  it("offers a clear start state when no games are recorded", async () => {
    renderReport(null);

    expect(await screen.findByText("Ready for your first game")).toBeInTheDocument();
    expect(screen.queryByTestId("brain-coach-facts")).not.toBeInTheDocument();
    expect(screen.getByTestId("button-start-brain-coach-games")).toHaveTextContent("Start a game");

    fireEvent.click(screen.getByTestId("button-start-brain-coach-games"));

    await waitFor(() => expect(screen.getByTestId("location-path")).toHaveTextContent("/mind-memory"));
  });

  it("shares with the device share sheet when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    renderReport();

    fireEvent.click(await screen.findByTestId("button-copy-brain-coach-report"));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining("VYVA Brain Coach report") })));
  });

  it("falls back to copying the family summary when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderReport();

    fireEvent.click(await screen.findByTestId("button-copy-brain-coach-report"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("VYVA Brain Coach report")));
  });
});
