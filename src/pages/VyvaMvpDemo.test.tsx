import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  VyvaCaregiverSeniorDetail,
  VyvaSeniorHome,
  VyvaSeniorMyWeek,
  VyvaSeniorWeeklyCheckIn,
  vyvaUiHasBannedTerms,
} from "./VyvaMvpDemo";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const weeklyQuestions = {
  weekNumber: 1,
  questions: [
    {
      id: "CORE-01",
      domain: "global_wellbeing",
      questionText: "Compared with your usual self, how has this week felt overall?",
      answerType: "SCALE_CHANGE",
      options: ["Better than usual", "About the same"],
      reason: "Part of rotating week 1 form.",
    },
    {
      id: "CORE-02",
      domain: "mood",
      questionText: "What was the best part of your week, even if it was small?",
      answerType: "FREE_TEXT",
      options: null,
      reason: "Part of rotating week 1 form.",
    },
  ],
};

const seniorHome = {
  senior: {
    id: "maria-profile",
    key: "maria",
    name: "Maria Lopez",
    firstName: "Maria",
    caregiverName: "Ana",
    consentCaregiverAlerts: true,
    consentShareDetails: true,
  },
  today: "Wednesday, June 24",
  overview: {
    lastCheckIn: "Jun 24",
    latestInsight: {
      id: "insight-1",
      type: "stable_week",
      domain: "global_wellbeing",
      title: "Things look steady this week",
      summary: "Recent check-ins look close to the usual pattern.",
      severity: "POSITIVE",
      confidence: 0.8,
    },
    latestRecommendation: {
      id: "rec-1",
      domain: "global_wellbeing",
      title: "Keep the steady routine going",
      body: "Keep what worked this week.",
      actionType: "check_in_tomorrow",
    },
    openAlertCount: 0,
    moodStatus: "Steady",
    socialStatus: "Steady",
    routineStatus: "Steady",
    medicationStatus: "Confirmations steady",
    routineSummary: "4 routine confirmations this week",
  },
};

const caregiverDetail = {
  senior: {
    id: "john-profile",
    name: "John Miller",
    firstName: "John",
    consentCaregiverAlerts: true,
    consentShareDetails: false,
    canViewPrivateDetails: false,
  },
  overview: {
    ...seniorHome.overview,
    latestInsight: null,
    latestRecommendation: null,
    openAlertCount: 1,
    socialStatus: "Attention recommended",
  },
  insights: [
    {
      id: "insight-2",
      type: "lower_social_contact",
      domain: "social",
      title: "This week was quieter than usual",
      summary: "Sharing consent is not enabled.",
      severity: "ATTENTION",
      confidence: 0.9,
      evidenceSummary: null,
    },
  ],
  recommendations: [],
  checkIns: [],
  medications: [
    {
      id: "med-1",
      name: "Evening tablet",
      doseLabel: "1 tablet",
      scheduledTime: "20:00",
      events: [{ id: "med-event-1", status: "REMIND_LATER", scheduledFor: "2026-06-24T20:00:00.000Z" }],
    },
  ],
  routineEvents: [
    {
      id: "routine-event-1",
      status: "MISSED",
      routine: { id: "routine-1", label: "Morning walk" },
    },
  ],
  alerts: [
    {
      id: "alert-1",
      type: "lower_social_contact",
      severity: "ATTENTION",
      message: "John Miller: This week was quieter than usual. Follow-up may help. This is a wellbeing signal only.",
      status: "OPEN",
      createdAt: "2026-06-24T10:00:00.000Z",
    },
  ],
  notes: [],
  consentMessage: "Sharing consent is not enabled.",
};

function renderRoute(path: string, element: React.ReactNode, queryMap: Record<string, unknown | (() => unknown)>) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: ({ queryKey }) => {
          const url = String(queryKey[0]);
          if (!(url in queryMap)) throw new Error(`No mock response for ${url}`);
          const value = queryMap[url];
          return Promise.resolve(typeof value === "function" ? value() : value);
        },
      },
    },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
        <Routes>
          <Route path={path.replace("maria", ":seniorKey").replace("john-profile", ":seniorId").replace("ana", ":caregiverKey")} element={element} />
          <Route path="/vyva-demo/senior/:seniorKey/my-week" element={<VyvaSeniorMyWeek />} />
          <Route path="/vyva-demo/senior/:seniorKey" element={<div>Senior home route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VYVA MVP demo UI", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("submits weekly answers and shows returned insight step", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        myWeek: {
          steady: [],
          changed: [{
            id: "insight-new",
            type: "lower_social_contact",
            domain: "social",
            title: "This week was quieter than usual",
            summary: "A short call may help.",
            severity: "WATCH",
            confidence: 0.8,
          }],
          recommendations: [{
            id: "rec-new",
            domain: "social",
            title: "Plan one short call",
            body: "Choose one person and one simple time.",
            actionType: "plan_call",
          }],
          shareEnabled: true,
        },
      }),
    } as Response);

    renderRoute("/vyva-demo/senior/maria/weekly", <VyvaSeniorWeeklyCheckIn />, {
      "/api/vyva-demo/senior/maria/weekly/start": weeklyQuestions,
    });

    fireEvent.click(await screen.findByRole("button", { name: /start weekly check-in/i }));
    fireEvent.click(screen.getByRole("button", { name: /about the same/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/voice note/i), { target: { value: "I spoke with Ana and watered the plants." } });
    fireEvent.click(screen.getByRole("button", { name: /complete/i }));

    expect(await screen.findByText("Plan one short call")).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/vyva-demo/senior/maria/weekly/submit",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("refreshes My Week after weekly check-in submission", async () => {
    const updatedMyWeek = {
      steady: [{
        id: "insight-steady",
        type: "stable_week",
        domain: "global_wellbeing",
        title: "Steady morning routine",
        summary: "Morning routine looked close to Maria's usual pattern.",
        severity: "POSITIVE",
        confidence: 0.8,
      }],
      changed: [],
      recommendations: [{
        id: "rec-updated",
        domain: "routine",
        title: "Keep the morning routine",
        body: "Repeat the same simple morning rhythm tomorrow.",
        actionType: "repeat_routine",
      }],
      shareEnabled: true,
    };
    let myWeek = {
      steady: [],
      changed: [],
      recommendations: [],
      shareEnabled: true,
    };

    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        myWeek = updatedMyWeek;
        return { myWeek: updatedMyWeek };
      },
    } as Response);

    renderRoute("/vyva-demo/senior/maria/weekly", <VyvaSeniorWeeklyCheckIn />, {
      "/api/vyva-demo/senior/maria/weekly/start": weeklyQuestions,
      "/api/vyva-demo/senior/maria/my-week": () => myWeek,
    });

    fireEvent.click(await screen.findByRole("button", { name: /start weekly check-in/i }));
    fireEvent.click(screen.getByRole("button", { name: /about the same/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.change(screen.getByPlaceholderText(/voice note/i), { target: { value: "The mornings felt steady." } });
    fireEvent.click(screen.getByRole("button", { name: /complete/i }));

    fireEvent.click(await screen.findByRole("button", { name: /view my week/i }));

    expect(await screen.findByText("Steady morning routine")).toBeInTheDocument();
    expect(screen.getByText("Keep the morning routine")).toBeInTheDocument();
    expect(screen.queryByText(/0\.8|80%/i)).not.toBeInTheDocument();
  });

  it("hides private caregiver details when sharing consent is off", async () => {
    renderRoute("/vyva-demo/caregiver/ana/senior/john-profile", <VyvaCaregiverSeniorDetail />, {
      "/api/vyva-demo/caregiver/ana/seniors/john-profile": caregiverDetail,
    });

    expect(await screen.findByText("John Miller")).toBeInTheDocument();
    expect(screen.getAllByText("Sharing consent is not enabled.").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Check-ins" }));
    expect(screen.getAllByText("Sharing consent is not enabled.").length).toBeGreaterThan(1);
    expect(screen.queryByText(/What was the best part/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Medication / Routine" }));
    expect(screen.getAllByText("Sharing consent is not enabled.").length).toBeGreaterThan(1);
    expect(screen.queryByText("Evening tablet")).not.toBeInTheDocument();
    expect(screen.queryByText("Morning walk")).not.toBeInTheDocument();
  });

  it("lets caregiver review an alert", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ alert: { ...caregiverDetail.alerts[0], status: "REVIEWED" } }),
    } as Response);

    renderRoute("/vyva-demo/caregiver/ana/senior/john-profile", <VyvaCaregiverSeniorDetail />, {
      "/api/vyva-demo/caregiver/ana/seniors/john-profile": caregiverDetail,
    });

    fireEvent.click(await screen.findByRole("button", { name: "Alerts" }));
    fireEvent.click(screen.getByRole("button", { name: /mark as reviewed/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/vyva-demo/caregiver/ana/alerts/alert-1/review",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("creates a minimal help alert from Senior Home", async () => {
    vi.mocked(apiFetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ alert: { id: "help-1" } }),
    } as Response);

    renderRoute("/vyva-demo/senior/maria", <VyvaSeniorHome />, {
      "/api/vyva-demo/senior/maria/home": seniorHome,
    });

    const section = await screen.findByText("Ask for Help");
    fireEvent.click(within(section.closest("button") ?? document.body).getByText("Ask for Help"));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/vyva-demo/senior/maria/ask-help",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(await screen.findByText("Ana can now see a minimal help alert.")).toBeInTheDocument();
  });

  it("does not include banned clinical words in UI copy constants", () => {
    expect(vyvaUiHasBannedTerms()).toBe(false);
  });
});
