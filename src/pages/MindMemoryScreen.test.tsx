import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MindMemoryScreen from "./MindMemoryScreen";
import type { CognitiveAssessmentProgramStatusResponse } from "../../shared/cognitiveAssessmentProgram";

const guardPathMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/hooks/useServiceGate", () => ({
  useServiceGate: () => ({
    guardPath: guardPathMock,
  }),
}));

vi.mock("@/components/VyvaSessionCta", () => ({
  default: ({ label, testId, className }: { label?: string; testId?: string; className?: string }) => (
    <button type="button" data-testid={testId} className={className}>
      {label}
    </button>
  ),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="current-route">{location.pathname}</div>;
}

const unjoinedProgram: CognitiveAssessmentProgramStatusResponse = {
  joined: false,
  enrollment: null,
  latestUnfinishedSession: null,
  latestReport: null,
  completedReportCount: 0,
  totalTasks: 12,
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }: { queryKey: readonly unknown[] }) => {
          const response = await fetch(String(queryKey[0]));
          if (!response.ok) throw new Error(response.statusText);
          return response.json();
        },
      },
    },
  });
}

function renderMindMemory(program: CognitiveAssessmentProgramStatusResponse = unjoinedProgram) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(program), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
  const queryClient = createTestQueryClient();

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("renders the approved pillar layout", () => {
    renderMindMemory();

    expect(screen.getByTestId("mind-memory-master-hero")).toHaveAttribute("data-hero-layout", "canonical-menu");
    expect(screen.getByTestId("mind-memory-master-hero")).toHaveTextContent("Brain Coach");
    expect(screen.getByTestId("mind-memory-master-hero")).toHaveTextContent("Memory, focus, thinking, and senses.");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-flow-id", "brain_coach.activity_session");
    expect(screen.getByTestId("mind-memory-master-layout")).toHaveAttribute("data-registry-scene", "brain_coach.activity_session.main");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveTextContent("Strengthen Memory");
    expect(screen.getByTestId("card-mind-memory-train-reflexes")).toHaveTextContent("Train Reflexes");
    expect(screen.getByTestId("card-mind-memory-boost-focus")).toHaveTextContent("Improve Thinking");
    expect(screen.getByTestId("card-mind-memory-sharpen-senses")).toHaveTextContent("Sharpen Senses");
    expect(screen.queryByTestId("card-mind-memory-sleep")).not.toBeInTheDocument();
    expect(screen.getByTestId("mind-memory-cards").querySelector('[data-card-layout="canonical-action-grid"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveAttribute("data-vyva-card-layout", "canonical-action");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory-detail")).toHaveTextContent("Recall and remembering");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory")).toHaveAccessibleName("Strengthen Memory. Remember information now, later, or after distraction.");
    expect(screen.getByTestId("card-mind-memory-strengthen-memory").querySelector('[data-vyva-icon-tile="bridge"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-mind-memory-train-reflexes").querySelector('[data-vyva-accent="pulse"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-mind-memory-boost-focus").querySelector('[data-vyva-accent="knobs"]')).toBeInTheDocument();
    expect(screen.getByTestId("card-mind-memory-sharpen-senses").querySelector('[data-vyva-accent="signal"]')).toBeInTheDocument();

    const fastHelp = screen.getByTestId("mind-memory-fast-help");
    expect(fastHelp).toHaveAttribute("data-fast-help-layout", "canonical-action-grid");
    expect(within(fastHelp).getAllByRole("button")).toHaveLength(1);
    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment")).toHaveTextContent("Cognitive Assessment");
    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment").querySelector('[data-vyva-accent="check"]')).toBeInTheDocument();
  });

  it("uses existing cognitive routes", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-strengthen-memory"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/memory-games");
  });

  it("routes the reflexes card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-train-reflexes"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/attention-boosters");
  });

  it("routes the thinking card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-boost-focus"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/executive-function");
  });

  it("routes the senses card", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("card-mind-memory-sharpen-senses"));
    expect(screen.getByTestId("current-route")).toHaveTextContent("/senses");
  });

  it("routes calm breathing from fast help", () => {
    vi.useFakeTimers();
    renderMindMemory();

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    fireEvent.click(screen.getByTestId("button-mind-memory-fast-relax-breathe"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/activities/relax-breathe");
  });

  it("routes cognitive assessment from fast help", () => {
    renderMindMemory();

    fireEvent.click(screen.getByTestId("button-mind-memory-fast-cognitive-assessment"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/mind-memory/cognitive-assessment");
  });

  it("shows the active cognitive assessment badge after joining", async () => {
    renderMindMemory({
      ...unjoinedProgram,
      joined: true,
      enrollment: {
        status: "active",
        startDate: "2026-07-07",
        frequency: "monthly",
        reminderTime: "10:00",
        timezone: "Europe/Madrid",
        joinedAt: "2026-07-07T08:00:00.000Z",
        updatedAt: "2026-07-07T08:00:00.000Z",
        nextRunAt: "2026-08-07T08:00:00.000Z",
        scheduledInteractionId: "00000000-0000-4000-8000-000000000001",
      },
    });

    expect(await screen.findByText("Joined")).toBeInTheDocument();
    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment")).toHaveTextContent("Monthly check");
  });

  it("rotates through the full final Fast help set", () => {
    vi.useFakeTimers();
    renderMindMemory();

    expect(screen.getByTestId("button-mind-memory-fast-cognitive-assessment")).toHaveTextContent("Cognitive Assessment");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-relax-breathe")).toHaveTextContent("Relax Breathe");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-learn-words")).toHaveTextContent("Learn Words");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-play-game")).toHaveTextContent("Play Game");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-listen-closely")).toHaveTextContent("Listen Closely");

    act(() => {
      vi.advanceTimersByTime(9000);
    });

    expect(screen.getByTestId("button-mind-memory-fast-calm-focus")).toHaveTextContent("Calm Focus");
  });
});
