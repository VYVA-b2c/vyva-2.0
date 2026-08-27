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
    apiFetchMock.mockResolvedValue({ ok: true, json: async () => plan });
  });

  it("renders five pillars and exactly one priority explanation", async () => {
    renderPlan();
    expect(await screen.findByText("Your five pillars")).toBeVisible();
    expect(screen.getByText("Heart & circulation")).toBeVisible();
    expect(screen.getByText("Brain & memory")).toBeVisible();
    expect(screen.getByText("Strength & stability")).toBeVisible();
    expect(screen.getByText("Nourishment")).toBeVisible();
    expect(screen.getByText("Calm & recovery")).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent("Brain & memory");
    expect(screen.getAllByText(/A short daily practice supports continuity/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Ask VYVA about my plan" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Ask VYVA about this plan" })).not.toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/prevention/plan/11111111-1111-4111-8111-111111111111");
  });

  it("routes Brain Coach actions to the canonical brain destination alias", async () => {
    renderPlan();
    const action = await screen.findAllByRole("button", { name: /Try ten minutes of Brain Coach daily/ });
    fireEvent.click(action[0]);
    await waitFor(() => expect(screen.getByText("Brain destination")).toBeVisible());
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

    expect(screen.getByRole("heading", { name: "Karim, try ten minutes of Brain Coach daily" })).toBeVisible();
    expect(screen.getByTestId("prevention-plan-screen")).toHaveAttribute("data-home-master-theme", "light");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
