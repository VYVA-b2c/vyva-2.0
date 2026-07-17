import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/queryClient";
import { setAccountLanguage } from "@/i18n";
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
  imageUrl: "https://cdn.example.com/learning/soap-water.png",
  imageAlt: "Soap molecules helping water lift oil away.",
  imagePrompt: "A custom image showing soap molecules between water and oil.",
  estimatedMinutes: 3,
  difficulty: "easy",
  tags: ["science"],
};

class MockSpeechSynthesisUtterance {
  text: string;
  lang = "";
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const spoken: MockSpeechSynthesisUtterance[] = [];
const speechSynthesis = {
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
    spoken.push(utterance);
    utterance.onstart?.();
  }),
  getVoices: vi.fn(() => [
    { default: true, lang: "en-US", localService: true, name: "English", voiceURI: "english" },
    { default: false, lang: "fr-FR", localService: true, name: "French", voiceURI: "french" },
    { default: false, lang: "de-DE", localService: true, name: "German", voiceURI: "german" },
  ] as SpeechSynthesisVoice[]),
};

function installSpeechPlayback() {
  spoken.length = 0;
  speechSynthesis.cancel.mockClear();
  speechSynthesis.pause.mockClear();
  speechSynthesis.resume.mockClear();
  speechSynthesis.speak.mockClear();
  speechSynthesis.getVoices.mockClear();
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
    configurable: true,
    value: MockSpeechSynthesisUtterance,
  });
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    value: speechSynthesis,
  });
}

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

beforeEach(() => {
  setAccountLanguage("en");
});

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  Reflect.deleteProperty(window, "speechSynthesis");
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

    expect(await screen.findByTestId("learn-wizard")).toHaveTextContent("How do you want to learn?");
    expect(screen.getByTestId("button-learn-mode-both")).toHaveTextContent("Recommended");
    fireEvent.click(screen.getByText("Next"));
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
        learningMode: "both",
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
    fireEvent.click(screen.getByTestId("button-learn-mode-touch"));
    fireEvent.click(screen.getByText("Next"));
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
        learningMode: "touch",
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
    expect(screen.getByTestId("learn-plan-glance")).toHaveTextContent("Voice + Touch");
    expect(screen.getByTestId("learn-plan-glance")).toHaveTextContent("Science");
    expect(screen.getByTestId("learn-today-lesson")).toHaveTextContent("Why soap helps water clean");
    expect(screen.getByTestId("learn-today-lesson")).toHaveTextContent("Reflection prompt");
    expect(screen.getByTestId("learn-lesson-image")).toHaveAttribute("src", "https://cdn.example.com/learning/soap-water.png");
    expect(screen.getByTestId("learn-lesson-image")).toHaveAttribute("alt", "Soap molecules helping water lift oil away.");

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

  it("lets the learner move to the next lesson without navigating to a game", async () => {
    mocks.apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ program, todayItem: program.items[1] }),
    });

    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    expect(await screen.findByTestId("learn-today-lesson")).toHaveTextContent("Why soap helps water clean");
    fireEvent.click(screen.getByTestId("button-learn-next"));

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/learning/events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        programId: "program-1",
        programItemId: "item-1",
        eventType: "skipped",
        source: "learn_hub",
      }),
    })));
    expect(screen.queryByText("Curious Minds")).not.toBeInTheDocument();
  });

  it("makes voice consumption primary when the user chose voice", async () => {
    window.localStorage.setItem("vyva.learning.mode", "voice");

    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    expect(await screen.findByTestId("learn-hub")).toHaveTextContent("Learn Something New");
    expect(screen.getByTestId("learn-plan-glance")).toHaveTextContent("Voice");
    expect(screen.getByTestId("button-learn-read-aloud")).toHaveTextContent("Listen aloud");
  });

  it("uses the selected app language and offers pause, resume, replay, and stop", async () => {
    setAccountLanguage("fr");
    installSpeechPlayback();
    mocks.apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    const playButton = await screen.findByTestId("button-learn-read-aloud");
    expect(playButton).toHaveTextContent("Lire a voix haute");
    fireEvent.click(playButton);

    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]).toMatchObject({ text: lesson.title, lang: "fr-FR" });
    expect(spoken[0].voice?.name).toBe("French");
    expect(playButton).toHaveTextContent("Pause");
    expect(window.sessionStorage.getItem("vyva.learning.read-aloud.v1:lesson-1:fr")).toBe("0");

    fireEvent.click(playButton);
    expect(speechSynthesis.pause).toHaveBeenCalledTimes(1);
    expect(playButton).toHaveTextContent("Reprendre");

    fireEvent.click(playButton);
    expect(speechSynthesis.resume).toHaveBeenCalledTimes(1);
    expect(playButton).toHaveTextContent("Pause");

    fireEvent.click(screen.getByTestId("button-learn-read-aloud-replay"));
    expect(spoken.at(-1)?.text).toBe(lesson.title);

    fireEvent.click(screen.getByTestId("button-learn-read-aloud-stop"));
    expect(window.sessionStorage.getItem("vyva.learning.read-aloud.v1:lesson-1:fr")).toBeNull();
    expect(screen.getByTestId("learn-read-aloud-status")).toHaveTextContent("langue de l'application");
  });

  it("resumes an interrupted lesson from the saved section", async () => {
    setAccountLanguage("de");
    installSpeechPlayback();
    window.sessionStorage.setItem("vyva.learning.read-aloud.v1:lesson-1:de", "2");
    mocks.apiFetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    const playButton = await screen.findByTestId("button-learn-read-aloud");
    await waitFor(() => expect(playButton).toHaveTextContent("Fortsetzen"));
    expect(screen.getByTestId("learn-read-aloud-status")).toHaveTextContent("weiter");
    fireEvent.click(playButton);

    await waitFor(() => expect(spoken).toHaveLength(1));
    expect(spoken[0]).toMatchObject({ text: lesson.body, lang: "de-DE" });
  });

  it("keeps the lesson readable when voice playback is unavailable", async () => {
    renderLearningPage({
      onboardingRequired: false,
      categories,
      program,
      todayItem: program.items[0],
    });

    expect(await screen.findByTestId("learn-today-lesson")).toHaveTextContent("One end of a soap molecule likes water.");
    expect(screen.getByTestId("button-learn-read-aloud")).toBeDisabled();
    expect(screen.getByTestId("learn-read-aloud-status")).toHaveTextContent("unavailable on this device");
  });
});
