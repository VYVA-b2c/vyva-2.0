import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import LearnSomethingNewPage from "./LearnSomethingNewPage";

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

const categories = [
  {
    id: "cat-science",
    slug: "science",
    label: "Science",
    description: "Short discoveries about the world.",
    color: "#2563EB",
    icon: "atom",
    sortOrder: 10,
    isActive: true,
  },
  {
    id: "cat-general",
    slug: "general_knowledge",
    label: "General Knowledge",
    description: "Useful everyday facts.",
    color: "#B45309",
    icon: "sparkles",
    sortOrder: 40,
    isActive: true,
  },
];

const lesson = {
  id: "lesson-1",
  categorySlug: "science",
  language: "en",
  title: "Why soap helps water clean",
  hook: "Soap has a tiny split personality.",
  body: "One end of a soap molecule likes water. The other end likes oil and grease.",
  reflectionPrompt: "Where else have you seen two different things work better together?",
  estimatedMinutes: 3,
  difficulty: "easy",
  tags: ["science"],
};

const program = {
  id: "program-1",
  status: "active",
  interests: ["science"],
  pace: "gentle",
  frequency: "daily",
  durationWeeks: 1,
  dailyTime: "09:00",
  lessonLengthMinutes: 3,
  language: "en",
  startDate: "2026-06-24",
  endDate: "2026-06-30",
  completedAt: null,
  items: Array.from({ length: 7 }, (_, index) => ({
    id: `item-${index + 1}`,
    programId: "program-1",
    lessonId: index === 0 ? "lesson-1" : `lesson-${index + 1}`,
    programDay: index + 1,
    scheduledDate: `2026-06-${24 + index}`,
    status: "recommended",
    completedAt: null,
    savedAt: null,
    skippedAt: null,
    lesson: index === 0 ? lesson : { ...lesson, id: `lesson-${index + 1}`, title: `Lesson ${index + 1}` },
  })),
  progress: {
    completedCount: 0,
    totalCount: 7,
    allComplete: false,
    currentDay: 1,
  },
};

function renderLearningPage(todayPayload: unknown) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: async ({ queryKey }) => {
          if (queryKey[0] === "/api/learning/today") return todayPayload;
          return {};
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <LearnSomethingNewPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("LearnSomethingNewPage", () => {
  it("starts a learning program with the recommended rhythm by default", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ program }),
    });

    renderLearningPage({
      onboardingRequired: true,
      categories,
      program: null,
      todayItem: null,
    });

    expect(await screen.findByTestId("learn-wizard")).toHaveTextContent("Choose what sparks your curiosity");
    fireEvent.click(screen.getByTestId("button-learn-interest-science"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByTestId("learn-rhythm-preview")).toHaveTextContent("12 lessons");
    expect(screen.getByTestId("learn-rhythm-preview")).toHaveTextContent("Mon/Wed/Fri");
    fireEvent.change(screen.getByTestId("input-learn-daily-time"), { target: { value: "10:30" } });
    fireEvent.click(screen.getByTestId("button-learn-start-program"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/learning/programs", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        interests: ["science"],
        pace: "gentle",
        frequency: "three_times_week",
        durationWeeks: 4,
        dailyTime: "10:30",
        lessonLengthMinutes: 3,
      }),
    })));
  });

  it("adapts the recommended rhythm for curious short lessons", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ program }),
    });

    renderLearningPage({
      onboardingRequired: true,
      categories,
      program: null,
      todayItem: null,
    });

    await screen.findByTestId("learn-wizard");
    fireEvent.click(screen.getByTestId("button-learn-interest-science"));
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByTestId("button-learn-pace-curious"));
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByTestId("learn-rhythm-preview")).toHaveTextContent("28 lessons");
    expect(screen.getByTestId("learn-rhythm-preview")).toHaveTextContent("Every day");
    fireEvent.click(screen.getByTestId("button-learn-start-program"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/learning/programs", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        interests: ["science"],
        pace: "curious",
        frequency: "daily",
        durationWeeks: 4,
        dailyTime: "09:00",
        lessonLengthMinutes: 3,
      }),
    })));
  });

  it("renders today's lesson and records completion without navigating to a game", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ program, todayItem: program.items[0] }),
    });

    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    expect(await screen.findByTestId("learn-hub")).toHaveTextContent("Learn Something New");
    expect(screen.getByTestId("learn-plan-glance")).toHaveTextContent("Next:");
    expect(screen.getByTestId("learn-plan-glance")).toHaveTextContent("Science");
    expect(screen.getByTestId("learn-today-lesson")).toHaveTextContent("Why soap helps water clean");
    expect(screen.getByTestId("learn-today-lesson")).toHaveTextContent("Reflection prompt");

    fireEvent.click(screen.getByTestId("button-learn-complete"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/learning/events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        programId: "program-1",
        programItemId: "item-1",
        eventType: "completed",
        source: "learn_hub",
      }),
    })));
    expect(screen.queryByText("Curious Minds")).not.toBeInTheDocument();
  });
});
