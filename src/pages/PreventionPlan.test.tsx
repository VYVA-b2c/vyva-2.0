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

const companion = {
  plan,
  todayFocus: {
    pillar: "brain",
    label: "Brain and memory",
    headline: "Karim, restart Brain Coach gently today",
    summary: "No recent Brain Coach sessions are logged.",
  },
  whyToday: "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
  primaryAction: {
    action_key: "brain:try-ten-minutes-of-brain-coach-daily",
    title: "Try ten minutes of Brain Coach daily",
    detail: "A short daily practice supports continuity.",
    pillar: "brain",
    route: "/mind",
    prompt: "Help me with today's longevity step: Try ten minutes of Brain Coach daily.",
    source: "monthly_plan",
  },
  supportAction: {
    action_key: "brain:one-familiar-brain-coach-round",
    title: "One familiar Brain Coach round",
    detail: "A familiar activity keeps the effort low today.",
    pillar: "brain",
    route: "/mind",
    prompt: "Help me choose an easy Brain Coach round today.",
    source: "daily_content",
  },
  careSummary: {
    title: "Longevity summary for Karim",
    bullets: [
      "Brain and memory comes first today because no recent Brain Coach sessions are logged.",
      "Next step: Try ten minutes of Brain Coach daily.",
      "Support step: One familiar Brain Coach round.",
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
  dailyContent: { exercise: null, meal: null, tip: null, articles: [] },
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

  it("renders a specific companion focus with lightweight pillars", async () => {
    renderPlan();
    expect(await screen.findByRole("heading", { name: "Karim, restart Brain Coach gently today" })).toBeVisible();
    expect(screen.getByText(/Brain Coach: No recent Brain Coach sessions are logged/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try ten minutes of Brain Coach daily/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /One familiar Brain Coach round/ })).toBeVisible();
    expect(await screen.findByText("Pillars")).toBeVisible();
    expect(screen.getByText("Heart & circulation")).toBeVisible();
    expect(screen.getByText("Brain & memory")).toBeVisible();
    expect(screen.getByText("Strength & stability")).toBeVisible();
    expect(screen.getByText("Nourishment")).toBeVisible();
    expect(screen.getByText("Calm & recovery")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("Brain & memory");
    expect(screen.getAllByRole("button", { name: "Ask VYVA" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ask VYVA about my plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask VYVA about this plan" })).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/companion/11111111-1111-4111-8111-111111111111");
  });

  it("routes Brain Coach actions to the canonical brain destination alias", async () => {
    renderPlan();
    const action = await screen.findAllByRole("button", { name: /Try ten minutes of Brain Coach daily/ });
    fireEvent.click(action[0]);
    await waitFor(() => expect(screen.getByText("Brain destination")).toBeVisible());
  });

  it("posts feedback for the primary longevity action", async () => {
    renderPlan();
    fireEvent.click(await screen.findByRole("button", { name: "Done" }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/feedback", expect.objectContaining({
      method: "POST",
      body: expect.stringContaining("\"eventType\":\"done\""),
    })));
    expect(screen.getByText("Saved as done")).toBeVisible();
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
    expect(screen.getByTestId("prevention-plan-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
