import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import CaregiverDashboardPage, { caregiverAlertContext, caregiverAlertServiceActionKindsFor, caregiverAlertServiceActionsFor } from "./CaregiverDashboardPage";
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

const profilePayload = {
  profileId: "profile-1",
  firstName: "Maria",
  lastName: "Lopez",
  preferredName: "Maria",
  phone: "+34 600 111 222",
  gpName: "Dr Garcia",
  gpPhone: "+34 612 345 678",
  gpEmail: "gp@example.com",
};

const dashboardPayload = {
  activeProfile: {
    profileId: "profile-1",
    role: "caregiver",
    profileCount: 1,
    needsProfileSelection: false,
    relationship: "daughter",
    displayName: "Karim",
  },
  profile: {
    ...profilePayload,
    fullName: "Maria Lopez",
    avatarUrl: null,
    whatsapp: "+34 600 111 222",
    email: "maria@example.com",
    relationship: "daughter",
    caregiverName: "Karim",
    caregiverContact: "+34 600 555 121",
  },
  contacts: {
    primaryPhone: "+34 600 111 222",
    whatsapp: "+34 600 111 222",
    caregiver: {
      name: "Karim",
      contact: "+34 600 555 121",
    },
    gp: {
      name: "Dr Garcia",
      phone: "+34 612 345 678",
      email: "gp@example.com",
    },
  },
  notes: [{
    id: "note-1",
    note: "Evening call went well. Maria sounded calm and had dinner.",
    concernTag: "caregiver_note",
    caregiverName: "Karim",
    createdAt: "2026-05-29T11:00:00.000Z",
    updatedAt: "2026-05-29T11:00:00.000Z",
  }],
  latestNote: {
    id: "note-1",
    note: "Evening call went well. Maria sounded calm and had dinner.",
    concernTag: "caregiver_note",
    caregiverName: "Karim",
    createdAt: "2026-05-29T11:00:00.000Z",
    updatedAt: "2026-05-29T11:00:00.000Z",
  },
};

const medsPayload = {
  today: {
    medications: [{
      id: "med-1",
      medication_name: "Metformin",
      dosage: "500mg",
      frequency: "Morning and evening",
      scheduled_times: ["08:00", "20:00"],
      takenCountToday: 2,
      scheduledCountToday: 2,
      takenToday: true,
    }, {
      id: "med-2",
      medication_name: "Atorvastatin",
      dosage: "20mg",
      frequency: "Night",
      scheduled_times: ["21:00"],
      takenCountToday: 0,
      scheduledCountToday: 1,
      takenToday: false,
    }],
  },
  sevenDayAdherence: {
    totalScheduled: 21,
    totalTaken: 18,
    missedDoses: [{
      medication_name: "Atorvastatin",
      scheduled_time: "21:00",
      date: "2026-06-28",
    }],
  },
};

const vitalsPayload = {
  summary: {
    hr: {
      latest_value: "72",
      latest_recorded_at: "2026-05-29T08:00:00.000Z",
      trend: ["70", "71", null, "72", null, null, "72"],
      has_data: true,
    },
    bp: {
      latest_value: "120/80",
      latest_recorded_at: "2026-05-29T08:02:00.000Z",
      trend: [null, "118/78", null, null, "120/80", null, null],
      has_data: true,
    },
    rr: {
      latest_value: "16",
      latest_recorded_at: "2026-05-29T08:03:00.000Z",
      trend: [null, null, "16", null, null, null, "16"],
      has_data: true,
    },
  },
  compliance_days: [true, true, false, true, true, false, true],
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
  latestNudge: {
    id: "nudge-1",
    planId: "plan-1",
    messageType: "today_plan",
    title: "Your Brain Coach plan is ready",
    body: "Your caregiver suggested starting with one short recommended activity.",
    status: "seen",
    sentAt: "2026-05-29T10:00:00.000Z",
    sentBy: "caregiver-1",
    seenAt: "2026-05-29T10:05:00.000Z",
    dismissedAt: null,
    planCompletedAfterNudge: false,
    planCompletedAt: null,
  },
  weeklyInsights: {
    trendCopy: "Brain Coach activity increased to 4 active days this week.",
    changeSummary: "Compared with the previous 7 days: 2 more completed activities and 1 more completed plan day.",
    domainsPracticed: [{
      domain: "visual_memory",
      completedSessions: 2,
      totalSessions: 2,
      lastPlayedAt: "2026-05-29T09:00:00.000Z",
    }, {
      domain: "attention",
      completedSessions: 1,
      totalSessions: 1,
      lastPlayedAt: "2026-05-28T09:00:00.000Z",
    }],
    missedPlannedDays: 1,
    nudgeOutcomes: {
      sent: 3,
      seen: 1,
      dismissed: 1,
      completedAfterNudge: 1,
      completionAfterNudgePct: 33,
    },
    currentWeek: {
      plannedDays: 4,
      completedPlanDays: 3,
      activeSessionDays: 4,
      completedSessions: 5,
      completionPct: 75,
    },
    previousWeek: {
      plannedDays: 3,
      completedPlanDays: 2,
      activeSessionDays: 2,
      completedSessions: 3,
      completionPct: 67,
    },
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

function mockApi(options: {
  brainCoachPermissions?: typeof fullBrainCoachPermissions;
  brainCoachSummary?: unknown;
} = {}) {
  const brainCoachPermissions = options.brainCoachPermissions ?? fullBrainCoachPermissions;
  const brainCoachSummary = options.brainCoachSummary ?? brainCoachPayload;
  let currentBrainCoachSettings = { ...brainCoachSettingsPayload };
  let currentDashboard = {
    ...dashboardPayload,
    notes: [...dashboardPayload.notes],
    latestNote: dashboardPayload.latestNote,
  };

  vi.mocked(apiFetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path.includes("/api/caregiver/brain-coach/me/summary")) {
      return new Response(JSON.stringify({ summary: brainCoachSummary, permissions: brainCoachPermissions }), { status: 200, headers: { "Content-Type": "application/json" } });
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
    if (path.includes("/api/caregiver/dashboard/notes")) {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const note = {
        id: "note-2",
        note: body.note,
        concernTag: body.concernTag ?? "caregiver_note",
        caregiverName: "Karim",
        createdAt: "2026-05-29T12:00:00.000Z",
        updatedAt: "2026-05-29T12:00:00.000Z",
      };
      currentDashboard = {
        ...currentDashboard,
        notes: [note, ...currentDashboard.notes],
        latestNote: note,
      };
      return new Response(JSON.stringify({ note, notes: currentDashboard.notes }), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (path.includes("/api/caregiver/dashboard")) {
      return new Response(JSON.stringify(currentDashboard), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const payload = path.includes("/api/checkins/today")
      ? checkinPayload
      : path.includes("/api/profile")
        ? profilePayload
        : path.includes("/api/meds/caregiver")
          ? medsPayload
          : path.includes("/api/vitals/caregiver")
            ? vitalsPayload
            : caregiverPayload;
    return new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div>
      <div data-testid="current-route">{location.pathname}</div>
      <pre data-testid="route-state">{JSON.stringify(location.state ?? {})}</pre>
    </div>
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CaregiverDashboardPage />} />
          <Route path="/health/doctor" element={<LocationProbe />} />
          <Route path="/concierge" element={<LocationProbe />} />
          <Route path="/onboarding/profile/emergency" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("CaregiverDashboardPage", () => {
  it("keeps caregiver Welcome messaging paused", async () => {
    mockApi();

    renderPage();

    await screen.findByText("Caregiver action center");

    expect(screen.queryByTestId("caregiver-welcome-card")).not.toBeInTheDocument();
    expect(vi.mocked(apiFetch).mock.calls.some(([input]) => String(input).includes("/api/welcome-module"))).toBe(false);
  });

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

  it("renders loved-one contact details and saved caregiver notes from the dashboard model", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Selected profile Maria")).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: /call maria/i })).toHaveAttribute("href", "tel:+34600111222");
    expect(screen.getByTestId("caregiver-notes-card")).toHaveTextContent("Evening call went well");
    expect(screen.getByTestId("caregiver-notes-card")).toHaveTextContent("Karim");
  });

  it("saves new caregiver notes to the caregiver dashboard API", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("Add caregiver note")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Add caregiver note"), {
      target: { value: "Called after lunch. She confirmed both morning meds." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/caregiver/dashboard/notes",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const saveCall = vi.mocked(apiFetch).mock.calls.find(([path, init]) => (
      String(path).includes("/api/caregiver/dashboard/notes") &&
      (init as RequestInit | undefined)?.method === "POST"
    ));
    expect(JSON.parse((saveCall?.[1] as RequestInit).body as string)).toEqual({
      note: "Called after lunch. She confirmed both morning meds.",
      concernTag: "caregiver_note",
    });
  });

  it("renders medication adherence and raw vitals trends for the selected profile", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("caregiver-meds-card")).toHaveTextContent("Today's adherence: 2 of 3 doses today");
    });

    const medsCard = screen.getByTestId("caregiver-meds-card");
    expect(medsCard).toHaveTextContent("1 missed dose this week");
    fireEvent.click(within(medsCard).getByRole("button", { name: /details/i }));
    expect(medsCard).toHaveTextContent("Atorvastatin - 21:00");
    expect(medsCard).toHaveTextContent("Call Dr Garcia");

    const vitalsCard = screen.getByTestId("caregiver-vitals-card");
    expect(vitalsCard).toHaveTextContent("72 bpm");
    expect(vitalsCard).toHaveTextContent("120/80 mmHg");
    expect(vitalsCard).toHaveTextContent("16 breaths/min");
    fireEvent.click(within(vitalsCard).getByRole("button", { name: /details/i }));
    expect(vitalsCard).toHaveTextContent("70 bpm");
    expect(vitalsCard).toHaveTextContent("118/78 mmHg");
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

  it("maps urgent caregiver alerts to direct service actions", () => {
    expect(caregiverAlertServiceActionKindsFor(caregiverPayload.alerts[0], "urgent_help")).toEqual([
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(caregiverAlertContext(caregiverPayload.alerts[0], "Urgent help")).toContain("VYVA caregiver alert");
    expect(caregiverAlertContext(caregiverPayload.alerts[0], "Urgent help")).toContain("Symptom report");
  });

  it("adds saved GP call and email links to caregiver alert service actions", () => {
    const actions = caregiverAlertServiceActionsFor(caregiverPayload.alerts[0], "urgent_help", profilePayload);

    expect(actions.map((action) => action.kind)).toEqual([
      "call_gp",
      "email_gp",
      "doctor_help",
      "schedule_appointment",
      "book_ride",
    ]);
    expect(actions[0]).toMatchObject({
      label: "Call Dr Garcia",
      href: "tel:+34612345678",
    });
    expect(actions[1]).toMatchObject({
      label: "Email GP",
      href: expect.stringContaining("mailto:gp@example.com"),
    });
    expect(actions[1].href).toContain("VYVA%20caregiver%20alert");
  });

  it("renders saved GP call and email actions inside caregiver alert fast services", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toBeInTheDocument();
    });

    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toHaveAttribute("href", "tel:+34612345678");
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-call_gp")).toHaveTextContent("Call Dr Garcia");
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-email_gp")).toHaveAttribute("href", expect.stringContaining("mailto:gp@example.com"));
    expect(screen.getByTestId("button-caregiver-alert-service-alert-1-email_gp")).toHaveTextContent("Email GP");
  });

  it("opens doctor support with caregiver alert context", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-doctor_help")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-caregiver-alert-service-alert-1-doctor_help"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/health/doctor");
    expect(screen.getByTestId("route-state")).toHaveTextContent("caregiver_alert");
    expect(screen.getByTestId("route-state")).toHaveTextContent("Symptom report");
  });

  it("opens concierge with prepared appointment and ride requests", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("button-caregiver-alert-service-alert-1-schedule_appointment")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("button-caregiver-alert-service-alert-1-schedule_appointment"));

    expect(screen.getByTestId("current-route")).toHaveTextContent("/concierge");
    expect(screen.getByTestId("route-state")).toHaveTextContent("caregiver_alert");
    expect(screen.getByTestId("route-state")).toHaveTextContent("appointment");
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
    expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("Seen");
    expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("plan completion is still pending");
  });

  it("renders read-only Brain Coach weekly insights for caregivers", async () => {
    mockApi();

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("brain-coach-weekly-insights")).toHaveTextContent("Weekly insight");
    });

    const weekly = screen.getByTestId("brain-coach-weekly-insights");
    expect(weekly).toHaveTextContent("Brain Coach activity increased to 4 active days this week.");
    expect(weekly).toHaveTextContent("Compared with the previous 7 days: 2 more completed activities and 1 more completed plan day.");
    expect(weekly).toHaveTextContent("Missed planned days");
    expect(weekly).toHaveTextContent("Visual Memory - 2");
    expect(weekly).toHaveTextContent("Attention - 1");
    expect(weekly).toHaveTextContent("3 sent - 1 seen - 1 dismissed");
    expect(weekly).toHaveTextContent("Completion after nudge: 33%");
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

  it("allows a caregiver nudge before today's Brain Coach plan exists", async () => {
    mockApi({
      brainCoachSummary: {
        ...brainCoachPayload,
        todayPlan: {
          ...brainCoachPayload.todayPlan,
          planId: null,
          status: "not_planned",
          completedItems: 0,
          totalItems: 0,
          completionPct: 0,
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Training plan controls")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Send in-app nudge" })).not.toBeDisabled();
    expect(screen.getByText("VYVA will create today's Brain Coach plan before sending the in-app nudge.")).toBeInTheDocument();
  });

  it("shows no Brain Coach nudge outcome when no nudge has been sent", async () => {
    mockApi({
      brainCoachSummary: {
        ...brainCoachPayload,
        latestNudge: null,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("No nudge sent");
    });
    expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("No Brain Coach nudge has been sent yet.");
  });

  it("shows dismissed Brain Coach nudge outcome", async () => {
    mockApi({
      brainCoachSummary: {
        ...brainCoachPayload,
        latestNudge: {
          ...brainCoachPayload.latestNudge,
          status: "dismissed",
          seenAt: null,
          dismissedAt: "2026-05-29T10:06:00.000Z",
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("Dismissed");
    });
    expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("dismissed before the plan was completed");
  });

  it("shows when today's plan was completed after a Brain Coach nudge", async () => {
    mockApi({
      brainCoachSummary: {
        ...brainCoachPayload,
        latestNudge: {
          ...brainCoachPayload.latestNudge,
          status: "seen",
          planCompletedAfterNudge: true,
          planCompletedAt: "2026-05-29T10:20:00.000Z",
        },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("brain-coach-nudge-outcome")).toHaveTextContent("Plan completed after nudge");
    });
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
