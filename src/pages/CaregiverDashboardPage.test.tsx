import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const caregiverPayload = {
  latest_analysis: {
    recommended_action: "share_with_caregiver",
    caregiver_note: "Share with caregiver: A repeated baseline change is visible.",
    risk_score: 48,
    acknowledged_at: null,
    analysed_at: "2026-05-29T10:00:00.000Z",
  },
  alerts: [{
    id: "alert-1",
    alert_type: "triage_report",
    severity: "urgent_help",
    message: "Symptom report: chest discomfort\nNext: Seek urgent help now.",
    sent_to: ["+1 555 0100", "nurse@example.com"],
    created_at: "2026-05-29T10:01:00.000Z",
    resolved_at: null,
  }],
};

const checkinPayload = {
  status: "completed",
  latest_checkin: {
    completed_at: "2026-05-29T09:30:00.000Z",
    feeling_label: "Feeling okay today",
    highlight: null,
  },
  no_response: {
    overdue: false,
    alert_created: false,
    can_alert_caregiver: true,
    reason: null,
  },
  caregiver_alert: null,
  message: "Daily check-in complete",
};

const brainCoachPayload = {
  status: "active",
  currentStreakDays: 4,
  lastActivityAt: "2026-05-29T09:00:00.000Z",
  lapsedDays: 0,
  todayPlan: {
    planId: "plan-1",
    planDate: "2026-05-29",
    status: "active",
    completedItems: 1,
    totalItems: 2,
    completionPct: 50,
    estimatedDurationMinutes: 8,
    domains: ["visual_memory", "attention"],
  },
  adherence7d: {
    completedPlanDays: 3,
    plannedDays: 4,
    activeSessionDays: 4,
    completionPct: 75,
  },
  recentDomains: [{
    domain: "visual_memory",
    completedSessions: 3,
    totalSessions: 3,
    lastPlayedAt: "2026-05-29T09:00:00.000Z",
  }],
  recentActivities: [{
    id: "session-1",
    activityType: "memory_match",
    domain: "visual_memory",
    completed: true,
    score: 820,
    durationSeconds: 120,
    playedAt: "2026-05-29T09:00:00.000Z",
  }],
};

const fullBrainCoachPermissions = {
  view_summary: true,
  manage_plan_preferences: true,
  manage_schedule: true,
  send_nudges: true,
  preview_plan: true,
};

const summaryOnlyBrainCoachPermissions = {
  view_summary: true,
  manage_plan_preferences: false,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

const planPreferenceOnlyBrainCoachPermissions = {
  view_summary: true,
  manage_plan_preferences: true,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

const brainCoachSettingsPayload = {
  preferredDomains: ["attention"],
  excludedActivityTypes: [],
  preferredTrainingTimes: ["09:30"],
  weeklyTargetDays: 3,
  sessionLengthMinutes: 7,
  paused: false,
};

const brainCoachPreviewPayload = {
  persisted: false,
  permissions: fullBrainCoachPermissions,
  plan: {
    estimatedDurationMinutes: 8,
    recommendedDomains: ["visual_memory", "attention"],
    rationale: ["Uses caregiver-approved focus domains: attention."],
    activities: [{
      activityType: "memory_match",
      title: "Memory Match",
      domain: "visual_memory",
      estimatedDurationMinutes: 4,
      rationale: "new area for variety",
    }, {
      activityType: "sequence_memory",
      title: "Rhythm Tap",
      domain: "attention",
      estimatedDurationMinutes: 4,
      rationale: "matches caregiver-approved focus domains",
    }],
  },
};

function mockApi(options: { brainCoachPermissions?: typeof fullBrainCoachPermissions } = {}) {
  const brainCoachPermissions = options.brainCoachPermissions ?? fullBrainCoachPermissions;
  let currentBrainCoachSettings = { ...brainCoachSettingsPayload };

  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.includes("/api/caregiver/brain-coach/me/summary")) {
      return new Response(JSON.stringify({ summary: brainCoachPayload, permissions: brainCoachPermissions }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (path.includes("/api/caregiver/brain-coach/me/settings")) {
      if (init?.method === "PATCH" && typeof init.body === "string") {
        currentBrainCoachSettings = {
          ...currentBrainCoachSettings,
          ...JSON.parse(init.body),
        };
      }
      return new Response(JSON.stringify({ settings: currentBrainCoachSettings, permissions: brainCoachPermissions }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (path.includes("/api/caregiver/brain-coach/me/nudges")) {
      return new Response(JSON.stringify({
        nudge: {
          id: "nudge-1",
          planId: "plan-1",
          messageType: "today_plan",
          title: "Your Brain Coach plan is ready",
          body: "Your caregiver suggested starting with one short recommended activity.",
          sentAt: "2026-05-29T10:00:00.000Z",
          sentBy: "caregiver-1",
        },
        permissions: brainCoachPermissions,
      }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (path.includes("/api/caregiver/brain-coach/me/plan-preview")) {
      return new Response(JSON.stringify({ ...brainCoachPreviewPayload, permissions: brainCoachPermissions }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const payload = path.includes("/api/checkins/today")
      ? checkinPayload
      : caregiverPayload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CaregiverDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("CaregiverDashboardPage", () => {
  it("shows the caregiver action center with the existing safety status and alert timeline", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Caregiver aware")).toBeInTheDocument();
    });
    expect(screen.getByText("Caregiver action center")).toBeInTheDocument();
    expect(screen.getByText("Unified safety summary")).toBeInTheDocument();
    expect(screen.getByText("Alert timeline")).toBeInTheDocument();
    expect(screen.getAllByText("1 open").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Symptom report: chest discomfort/i).length).toBeGreaterThan(0);
  });

  it("lets a caregiver acknowledge an alert without changing the alert message", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("New")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));

    expect(screen.getByText("Acknowledged")).toBeInTheDocument();
    expect(screen.getByText(/Seek urgent help now/i)).toBeInTheDocument();
    expect(window.localStorage.getItem("vyva_caregiver_alert_workflow_v1")).toContain("acknowledged");
  });

  it("shows that caregiver status tracking is local to this device", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Local caregiver workspace")).toBeInTheDocument();
    });

    expect(screen.getByText("These status updates are stored on this device only.")).toBeInTheDocument();
  });

  it("renders contact actions from existing alert recipients", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /call \+1 555 0100/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /call \+1 555 0100/i })).toHaveAttribute("href", "tel:+15550100");
    expect(screen.getByRole("link", { name: /email nurse@example.com/i })).toHaveAttribute("href", "mailto:nurse@example.com");
  });

  it("builds a weekly caregiver digest from the existing alert feed", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Weekly caregiver digest")).toBeInTheDocument();
    });

    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText(/Current safety status: Caregiver aware/i)).toBeInTheDocument();
    expect(screen.getByText(/Open alerts: 1/i)).toBeInTheDocument();
  });

  it("renders Brain Coach caregiver summary and authorized controls", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    expect(screen.getAllByText("4 days").length).toBeGreaterThan(0);
    expect(screen.getByText("1/2 complete")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("Visual Memory - 3")).toBeInTheDocument();
    expect(screen.getAllByText("Memory Match").length).toBeGreaterThan(0);
    expect(screen.getByText("Control enabled")).toBeInTheDocument();
    expect(screen.getByText("Preview enabled")).toBeInTheDocument();
  });

  it("saves caregiver Brain Coach plan preferences when consent allows editing", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Brain Coach changes" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/caregiver/brain-coach/me/settings",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const saveCall = vi.mocked(apiFetch).mock.calls.find(([path, init]) => (
      String(path).includes("/api/caregiver/brain-coach/me/settings") &&
      (init as RequestInit | undefined)?.method === "PATCH"
    ));
    expect(JSON.parse((saveCall?.[1] as RequestInit).body as string)).toEqual({
      preferredDomains: ["attention", "spatial_navigation"],
    });
  });

  it("shows disabled Brain Coach controls when senior consent is missing", async () => {
    mockApi({ brainCoachPermissions: summaryOnlyBrainCoachPermissions });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Read-only training view")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Needs senior consent").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save Brain Coach changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preview next plan" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send in-app nudge" })).toBeDisabled();
  });

  it("keeps Brain Coach schedule controls disabled without schedule consent", async () => {
    mockApi({ brainCoachPermissions: planPreferenceOnlyBrainCoachPermissions });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Navigation" })).not.toBeDisabled();
    expect(screen.getByLabelText("Training time")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Brain Coach active" })).toBeDisabled();
  });

  it("sends an in-app Brain Coach nudge when consent allows it", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Send in-app nudge" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/caregiver/brain-coach/me/nudges",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(screen.getByText("Nudge sent in-app.")).toBeInTheDocument();
  });

  it("shows a non-persisted Brain Coach plan preview", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Preview next plan" }));

    await waitFor(() => {
      expect(screen.getByText("8 minutes total")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Rhythm Tap").length).toBeGreaterThan(0);
    expect(screen.getByText("matches caregiver-approved focus domains")).toBeInTheDocument();
  });
});
