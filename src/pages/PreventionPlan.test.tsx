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
  priority_intervention: "Try ten minutes of Brain Coach daily",
  priority_why: "A short daily practice supports continuity.",
  plan_narrative_senior: "Karim, this month we are keeping your plan simple and practical.",
  plan_narrative_caregiver: "Monthly wellness plan generated from available signals.",
  recommendations: {
    heart: [{ action: "Keep your daily walk going", why: "Consistency supports your heart." }],
    brain: [{ action: "Try ten minutes of Brain Coach daily", why: "Regularity matters." }],
    strength: [{ action: "Keep moving every day", why: "Any comfortable movement counts." }],
    nourishment: [{ action: "Keep water within easy reach", why: "Hydration supports energy." }],
    calm: [{ action: "Open the Breath Garden for two minutes", why: "Slow breathing can help." }],
  },
  source_signals: { vitals: true, medications: true, cognitive: true, mood: true, symptoms: false },
  trajectory: "first",
};

const pillarActions = {
  heart: {
    action_key: "heart:find-a-nearby-walk-or-activity",
    content_id: "daily-heart",
    title: "Find a nearby walk or activity",
    detail: "After lunch, VYVA can suggest nearby places, gentle groups, or daytime programs.",
    pillar: "heart",
    route: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning",
    resource_label: "Nearby walking ideas",
    resource_url: "/social-rooms/activities?source=longevity&intent=nearby-walk&format=nearby&interests=walking,nature,community,learning",
    prompt: "Help me find a nearby walk or activity today.",
    source: "daily_content",
  },
  brain: {
    action_key: "brain:one-familiar-brain-coach-round",
    content_id: "daily-brain",
    title: "One familiar Brain Coach round",
    detail: "A familiar activity keeps today's brain step low effort.",
    pillar: "brain",
    route: "/mind",
    prompt: "Help me choose an easy Brain Coach round today.",
    source: "daily_content",
  },
  strength: {
    action_key: "strength:clear-one-walking-path",
    content_id: "daily-strength",
    title: "Clear one walking path",
    detail: "One clear route at home makes movement easier and steadier.",
    pillar: "strength",
    route: "/health/exercises/gentle-walk",
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

const companion = {
  plan,
  todayFocus: {
    pillar: "brain",
    label: "Brain and memory",
    headline: "Karim, restart Brain Coach gently today",
    summary: "No recent Brain Coach sessions are logged.",
  },
  whyToday: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  primaryAction: pillarActions.brain,
  supportAction: pillarActions.calm,
  pillarActions,
  careSummary: {
    title: "Longevity summary for Karim",
    bullets: [
      "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      "Heart and circulation: Find a nearby walk or activity.",
      "Brain and memory: One familiar Brain Coach round.",
      "Strength and stability: Clear one walking path.",
      "Nourishment: Protein with the next meal.",
      "Calm and recovery: Same bedtime tonight.",
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
          <Route path="/mind" element={<div>Brain destination</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PreventionPlan", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation((url: string) => {
      if (url === "/api/prevention/feedback") return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
      return Promise.resolve({ ok: true, json: async () => companion });
    });
  });

  it("renders a five-pillar daily companion deck", async () => {
    renderPlan();
    expect(await screen.findByRole("heading", { name: "Karim, restart Brain Coach gently today" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByRole("button", { name: /One familiar Brain Coach round/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Find a nearby walk or activity/ })).toBeVisible();
    expect(screen.getByText("Nearby walking ideas")).toBeVisible();
    expect(screen.getByRole("button", { name: /Clear one walking path/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Protein with the next meal/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Same bedtime tonight/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Pillars" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Too hard" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Not relevant" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark Heart done" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Mark Strength done" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Ask VYVA" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ask VYVA about my plan" })).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/companion/11111111-1111-4111-8111-111111111111");
  });

  it("routes Brain Coach actions to the canonical brain destination alias", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: /One familiar Brain Coach round/ }));
    await waitFor(() => expect(screen.getByText("Brain destination")).toBeVisible());
  });

  it("posts feedback for the primary longevity action", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"eventType\":\"done\""),
    })));
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      body: expect.stringContaining("\"actionKey\":\"brain:one-familiar-brain-coach-round\""),
    }));
    expect(screen.getByText("Saved as done")).toBeVisible();
  });

  it("posts compact Done feedback for a non-priority pillar", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Mark Heart done" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"actionKey\":\"heart:find-a-nearby-walk-or-activity\""),
    })));
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

    expect(screen.getByRole("heading", { name: "Karim, restart Brain Coach gently today" })).toBeVisible();
    expect(screen.getByRole("button", { name: /One familiar Brain Coach round/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Find a nearby walk or activity/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Clear one walking path/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Protein with the next meal/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Same bedtime tonight/ })).toBeVisible();
    expect(screen.getByTestId("prevention-plan-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
