import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PreventionPlan, { type PreventionPlanData } from "./PreventionPlan";

const apiFetchMock = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

const plan: PreventionPlanData = {
  id: "22222222-2222-4222-8222-222222222222",
  generated_at: "2026-08-01T09:00:00.000Z",
  pillar_heart: "steady",
  pillar_brain: "priority_focus",
  pillar_strength: "steady",
  pillar_nourishment: "thriving",
  pillar_calm: "needs_attention",
  priority_pillar: "brain",
  priority_intervention: "Try one short memory challenge",
  priority_why: "A short daily practice supports continuity.",
  plan_narrative_senior: "Karim, this month we are keeping your plan simple and practical.",
  plan_narrative_caregiver: "Monthly wellness plan generated from available signals.",
  recommendations: {
    heart: [{ action: "Keep your daily walk going", why: "Consistency supports your heart." }],
    brain: [{ action: "Try one short memory challenge", why: "A named challenge gives the day a clear finish." }],
    strength: [{ action: "Keep moving every day", why: "Any comfortable movement counts." }],
    nourishment: [{ action: "Keep water within easy reach", why: "Hydration supports energy." }],
    calm: [{ action: "Open the Breath Garden for two minutes", why: "Slow breathing can help." }],
  },
  source_signals: { vitals: true, medications: true, cognitive: true, mood: true, symptoms: false },
  trajectory: "first",
};

const pillarActions = {
  heart: {
    action_key: "heart:tai-chi",
    content_id: "daily-heart",
    title: "Tai chi",
    detail: "A slow balance-friendly VYVA exercise for light movement, posture, and rhythm.",
    pillar: "heart",
    route: "/social-rooms/morning-movement/exercises/tai-chi",
    prompt: "Help me make today's heart step easy.",
    source: "daily_content",
  },
  brain: {
    action_key: "brain:word-recall-challenge",
    content_id: "daily-brain",
    title: "Word recall challenge",
    detail: "Study a few words, hide them, then see what you remember.",
    pillar: "brain",
    route: "/memory-games/word_recall",
    prompt: "Help me choose a short word recall challenge today.",
    source: "daily_content",
  },
  strength: {
    action_key: "strength:clear-one-walking-path",
    content_id: "daily-strength",
    title: "Clear one walking path",
    detail: "One clear route at home makes movement easier and steadier.",
    pillar: "strength",
    route: "/social-rooms/walking-route?source=longevity&intent=clear-walking-path",
    prompt: "Help me make today's movement step easy.",
    source: "daily_content",
  },
  nourishment: {
    action_key: "nourishment:protein-with-the-next-meal",
    content_id: "daily-nourishment",
    title: "Protein with the next meal",
    detail: "Choose one familiar protein food so nourishment does not become complicated.",
    pillar: "nourishment",
    route: null,
    prompt: "Help me make today's nourishment step easy.",
    source: "daily_content",
  },
  calm: {
    action_key: "calm:same-bedtime-tonight",
    content_id: "daily-calm",
    title: "Same bedtime tonight",
    detail: "A familiar evening time supports tomorrow's energy and attention.",
    pillar: "calm",
    route: "/games/breath-garden",
    prompt: "Help me make today's calm step easy.",
    source: "daily_content",
  },
} as const;

const activeProgram = {
  id: "program-1",
  programKey: "starter_video_longevity_v1",
  title: "14-day VYVA longevity starter",
  status: "active",
  focusPillars: ["brain", "heart", "strength", "nourishment", "calm"],
  startDate: "2026-08-01",
  currentDay: 1,
  totalDays: 14,
  language: "en",
  cadence: "daily",
} as const;

const todayProgramStep = {
  id: "program-day-1",
  programId: activeProgram.id,
  dayIndex: 1,
  pillar: "brain",
  theme: "Memory starter",
  objective: "Watch one short visual guide, then keep memory practice familiar.",
  actionTitle: "3-2-1 memory lane",
  actionDetail: "Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.",
  videoQuery: "MIND diet brain health short Mayo Clinic video",
  scheduledDate: "2026-08-01",
  status: "scheduled",
} as const;

const todayVideo = {
  id: "video-resource-1",
  provider: "youtube",
  videoId: "hoPg4bkKemQ",
  url: "https://www.youtube.com/watch?v=hoPg4bkKemQ",
  title: "Mayo Clinic Minute: Can the MIND diet improve brain health?",
  channel: "Mayo Clinic",
  durationSeconds: 70,
  thumbnailUrl: "https://i.ytimg.com/vi/hoPg4bkKemQ/hqdefault.jpg",
  language: "en",
  summary: "A short visual guide connecting food choices with brain health.",
  selectedReason: "It is short, calm, and directly connected to today's memory-support program step.",
  safetyNotes: "General wellness education only.",
} as const;

const programAction = {
  action_key: "program:program-1:1:brain:3-2-1-memory-lane",
  content_id: todayProgramStep.id,
  title: "3-2-1 memory lane",
  detail: "This uses personal memory and storytelling, not a score.",
  pillar: "brain",
  route: null,
  prompt: "Help me with today's Longevity program step.",
  source: "program",
  challenge: {
    kind: "memory_prompt",
    prompt: todayProgramStep.actionDetail,
    hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
    answer: null,
    followUp: "This uses personal memory and storytelling, not a score.",
  },
  gameOptions: [
    {
      id: "memory_lane",
      label: "Memory",
      title: "3-2-1 memory lane",
      kind: "memory_prompt",
      prompt: todayProgramStep.actionDetail,
      hint: "Use a place you know well, such as your kitchen, a favorite street, or a holiday spot.",
      answer: null,
      followUp: "This uses personal memory and storytelling, not a score.",
    },
    {
      id: "word_chain",
      label: "Words",
      title: "Word chain",
      kind: "word_chain",
      prompt: "Start with garden. Say five connected words without stopping.",
      hint: "Try: garden, flower, colour, painting, gallery. Your chain can be different.",
      answer: null,
      followUp: "Word chains train flexible thinking without needing a long session.",
    },
    {
      id: "riddle",
      label: "Riddle",
      title: "Quick riddle",
      kind: "riddle",
      prompt: "I hold stories without a shelf and open when someone asks the right question. What am I?",
      hint: "It is something your brain uses every day.",
      answer: "memory",
      followUp: "A tiny riddle gives the day a clear start and finish.",
    },
    {
      id: "chess_scan",
      label: "Chess",
      title: "Chess scan",
      kind: "chess_puzzle",
      prompt: "Before a move, name one piece that is protected and one piece that is open.",
      hint: "A protected piece has another piece that could respond if it is taken.",
      answer: null,
      followUp: "This is a gentle planning puzzle, not a timed match.",
    },
  ],
} as const;

const companion = {
  plan,
  activeProgram,
  todayProgramStep,
  todayVideo,
  videoCurationStatus: "fallback",
  todayFocus: {
    pillar: "brain",
    label: "Brain and memory",
    headline: "Karim, today's memory starter",
    summary: todayProgramStep.objective,
  },
  whyToday: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  dailySession: {
    sessionFocus: "Karim, keep memory active with one short challenge today.",
    primaryExperience: {
      kind: "video",
      title: todayVideo.title,
      detail: todayVideo.selectedReason,
      pillar: "brain",
      ctaLabel: "Watch",
      action: programAction,
      video: todayVideo,
    },
    companionAction: programAction,
    optionalChoices: [pillarActions.heart, pillarActions.calm],
    coveredPillars: [
      {
        pillar: "heart",
        label: "Heart & circulation",
        status: "steady",
        actionTitle: pillarActions.heart.title,
        reason: pillarActions.heart.detail,
        evidence: "Heart and circulation is part of this monthly plan.",
      },
      {
        pillar: "brain",
        label: "Brain & memory",
        status: "priority_focus",
        actionTitle: pillarActions.brain.title,
        reason: pillarActions.brain.detail,
        evidence: "No recent Brain Coach sessions are logged.",
      },
      {
        pillar: "strength",
        label: "Strength & stability",
        status: "steady",
        actionTitle: pillarActions.strength.title,
        reason: pillarActions.strength.detail,
        evidence: "Strength and stability is part of this monthly plan.",
      },
      {
        pillar: "nourishment",
        label: "Nourishment",
        status: "thriving",
        actionTitle: pillarActions.nourishment.title,
        reason: pillarActions.nourishment.detail,
        evidence: "Nourishment is part of this monthly plan.",
      },
      {
        pillar: "calm",
        label: "Calm & recovery",
        status: "needs_attention",
        actionTitle: pillarActions.calm.title,
        reason: pillarActions.calm.detail,
        evidence: "Recent sleep check-ins are part of the plan.",
      },
    ],
    whyThis: {
      summary: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      evidence: [
        "Program day 1: Memory starter.",
        "Curated video: Mayo Clinic Minute: Can the MIND diet improve brain health?.",
        "Brain Coach: No recent Brain Coach sessions are logged.",
      ],
    },
  },
  primaryAction: programAction,
  supportAction: pillarActions.calm,
  pillarActions,
  careSummary: {
    title: "Longevity summary for Karim",
    bullets: [
      "Program day 1: Memory starter.",
      "Video: Mayo Clinic Minute: Can the MIND diet improve brain health? (Mayo Clinic).",
      "Companion step: 3-2-1 memory lane.",
      "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      "Health areas considered: Heart and circulation; Brain and memory; Strength and stability; Nourishment; Calm and recovery.",
    ],
    share_text: "Longevity summary for Karim\n- Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  },
  signalsUsed: [{
    id: "brain-no-sessions",
    label: "Brain Coach",
    detail: "No recent Brain Coach sessions are logged.",
    source: "brain",
    pillar: "brain",
    tone: "attention",
  }],
  dailyContent: {
    exercise: null,
    meal: null,
    tip: null,
    articles: [],
    byPillar: {
      heart: [],
      brain: [],
      strength: [],
      nourishment: [],
      calm: [],
    },
  },
  feedbackHistory: [],
};

function renderPlan() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/health/prevention-plan"]}>
        <Routes>
          <Route path="/health/prevention-plan" element={<PreventionPlan />} />
          <Route path="/chat" element={<div>VYVA chat destination</div>} />
          <Route path="/social-rooms/morning-movement/exercises/:exerciseId" element={<div data-testid="movement-exercise-route">Movement exercise route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PreventionPlan", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    vi.stubGlobal("open", vi.fn());
    apiFetchMock.mockImplementation((url: string) => {
      if (url === "/api/prevention/feedback") return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      return Promise.resolve({ ok: true, json: async () => companion });
    });
  });

  it("renders a guided daily companion session", async () => {
    renderPlan();
    expect(await screen.findByRole("heading", { name: "Karim, keep memory active with one short challenge today." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByText("Today's video")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).toBeVisible();
    expect(screen.getByText("Mayo Clinic")).toBeVisible();
    expect(screen.getByText("Companion step")).toBeVisible();
    expect(screen.getByRole("heading", { name: "3-2-1 memory lane" })).toBeVisible();
    expect(screen.getByText("Pick a real place. Name 3 things you see there, 2 sounds, and 1 person connected to it.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show hint" })).toBeVisible();
    expect(screen.getByText("Pick a game")).toBeVisible();
    expect(screen.getByRole("button", { name: "Memory" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Words" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Riddle" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Chess" })).toBeVisible();
    expect(screen.queryByText("Also useful today")).not.toBeInTheDocument();
    expect(screen.queryByText("Health areas checked")).not.toBeInTheDocument();
    expect(screen.queryByText("Walk after lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear one walking path")).not.toBeInTheDocument();
    expect(screen.queryByText("Protein with the next meal")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Pillars" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Too hard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Not relevant" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Ask VYVA" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ask VYVA about my plan" })).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/companion/11111111-1111-4111-8111-111111111111");
  });

  it("opens the exact curated YouTube video and records the open event", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Watch" }));

    expect(window.open).toHaveBeenCalledWith("https://www.youtube.com/watch?v=hoPg4bkKemQ", "_blank", "noopener,noreferrer");
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"eventType\":\"opened\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"videoId\":\"hoPg4bkKemQ\""),
    }));
  });

  it("reveals a useful hint for the brain spark", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Show hint" }));
    expect(screen.getByText(/Use a place you know well/)).toBeVisible();
  });

  it("switches the brain spark game and records the choice", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Riddle" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"eventType\":\"opened\""),
    })));
    expect(screen.getByRole("heading", { name: "Quick riddle" })).toBeVisible();
    expect(screen.getByText("I hold stories without a shelf and open when someone asks the right question. What am I?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Riddle" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Reveal answer" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(screen.getByText("memory")).toBeVisible();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"actionKey\":\"program:program-1:1:brain:3-2-1-memory-lane\""),
    }));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"gameOptionId\":\"riddle\""),
    }));
  });

  it("renders representative preview data without replacing the production query path", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dev/home-master/health-plan"]}>
          <PreventionPlan previewPlan={plan} firstNameOverride="Karim" backPath="/dev/home-master/health" themeOverride="light" />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Karim, keep memory active with one short challenge today." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Mayo Clinic Minute: Can the MIND diet improve brain health?" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "3-2-1 memory lane" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Memory" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Riddle" })).toBeVisible();
    expect(screen.queryByText("Walk after lunch")).not.toBeInTheDocument();
    expect(screen.queryByText("Clear one walking path")).not.toBeInTheDocument();
    expect(screen.queryByText("Protein with the next meal")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tai chi/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Same bedtime tonight/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("prevention-plan-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
