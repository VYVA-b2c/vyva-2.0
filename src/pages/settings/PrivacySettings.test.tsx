import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import PrivacySettings from "./PrivacySettings";
import { apiFetch } from "@/lib/queryClient";
import type { BrainCoachCaregiverPermissions } from "@/lib/brainCoachCaregiverPermissions";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

const emptyPermissions: BrainCoachCaregiverPermissions = {
  view_summary: false,
  manage_plan_preferences: false,
  manage_schedule: false,
  send_nudges: false,
  preview_plan: false,
};

const fullPermissions: BrainCoachCaregiverPermissions = {
  view_summary: true,
  manage_plan_preferences: true,
  manage_schedule: true,
  send_nudges: true,
  preview_plan: true,
};

const realCareTeamMember = {
  id: "invite-1",
  invitee_name: "Hassan Assad",
  invitee_phone: "+34600111222",
  invitee_email: "hassan@example.com",
  role: "family",
  relationship: "son",
  status: "accepted",
  created_at: "2026-06-03T08:00:00.000Z",
  expires_at: "2026-06-10T08:00:00.000Z",
  accepted_at: "2026-06-03T08:05:00.000Z",
  latest_delivery_status: "sent",
  latest_delivery_channel: "sms",
  latest_delivery_at: "2026-06-03T08:00:00.000Z",
  can_receive_daily_digest: true,
  can_receive_safety_alerts: true,
  can_receive_health_alerts: false,
  can_receive_mood_alerts: false,
  can_receive_medication_alerts: false,
  can_view_dashboard: true,
  can_view_health_reports: false,
  can_view_vital_signs: false,
  can_view_journal_summaries: true,
};

function renderPrivacySettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <PrivacySettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockPermissionsApi(initialPermissions: BrainCoachCaregiverPermissions, careTeamMembers = [realCareTeamMember]) {
  let currentPermissions = { ...initialPermissions };

  vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
    if (input === "/api/onboarding/careteam" && !init?.method) {
      return new Response(JSON.stringify({ members: careTeamMembers }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (input === "/api/caregiver/brain-coach/permissions" && !init?.method) {
      return new Response(JSON.stringify({
        permissionKeys: Object.keys(emptyPermissions),
        members: [{
          id: "member-1",
          userId: "caregiver-1",
          profileId: "senior-1",
          role: "caregiver",
          status: "active",
          relationship: "Daughter",
          displayName: "Ana Caregiver",
          brainCoachPermissions: currentPermissions,
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if (input === "/api/caregiver/brain-coach/permissions/member-1" && init?.method === "PATCH") {
      const patch = JSON.parse(String(init.body)) as Partial<BrainCoachCaregiverPermissions>;
      currentPermissions = { ...currentPermissions, ...patch };
      return new Response(JSON.stringify({
        member: {
          id: "member-1",
          userId: "caregiver-1",
          profileId: "senior-1",
          role: "caregiver",
          status: "active",
          relationship: "Daughter",
          displayName: "Ana Caregiver",
          brainCoachPermissions: currentPermissions,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unexpected request" }), { status: 500 });
  });
}

function lastPatchBody() {
  const call = vi.mocked(apiFetch).mock.calls.find(([input, init]) => (
    input === "/api/caregiver/brain-coach/permissions/member-1" &&
    init?.method === "PATCH"
  ));
  return JSON.parse(String(call?.[1]?.body)) as Partial<BrainCoachCaregiverPermissions>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrivacySettings Brain Coach caregiver consent", () => {
  it("lets the senior grant plan preference control and keeps summary access on", async () => {
    mockPermissionsApi(emptyPermissions);

    renderPrivacySettings();

    await waitFor(() => {
      expect(screen.getByText("Ana Caregiver")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("toggle-brain-coach-member-1-manage_plan_preferences"));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/caregiver/brain-coach/permissions/member-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    expect(lastPatchBody()).toEqual({
      view_summary: true,
      manage_plan_preferences: true,
    });
    await waitFor(() => {
      expect(screen.getByText("Controls enabled")).toBeInTheDocument();
    });
  });

  it("lets the senior revoke summary access and clears all Brain Coach controls", async () => {
    mockPermissionsApi(fullPermissions);

    renderPrivacySettings();

    await waitFor(() => {
      expect(screen.getByText("Controls enabled")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("toggle-brain-coach-member-1-view_summary"));

    await waitFor(() => {
      expect(lastPatchBody()).toEqual(emptyPermissions);
    });
    await waitFor(() => {
      expect(screen.getByText("No access")).toBeInTheDocument();
    });
  });
});

describe("PrivacySettings care-team sharing roster", () => {
  it("uses real care-team members instead of sample people", async () => {
    mockPermissionsApi(emptyPermissions, [realCareTeamMember]);

    renderPrivacySettings();

    expect(await screen.findByText("Hassan Assad")).toBeInTheDocument();
    expect(screen.getByText("Son")).toBeInTheDocument();
    expect(screen.getByText("Daily wellbeing summary")).toBeInTheDocument();
    expect(screen.getByText("Caregiver dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Sarah Collins")).not.toBeInTheDocument();
    expect(screen.queryByText("James Collins")).not.toBeInTheDocument();
    expect(screen.queryByText("Linda Hughes")).not.toBeInTheDocument();
    expect(screen.queryByText("Dr. Anita Patel")).not.toBeInTheDocument();
  });

  it("shows an empty state when the senior has no care-team members", async () => {
    mockPermissionsApi(emptyPermissions, []);

    renderPrivacySettings();

    expect(await screen.findByText("No care-team members yet.")).toBeInTheDocument();
    expect(screen.getByTestId("button-privacy-add-careteam")).toBeInTheDocument();
    expect(screen.queryByText("Sarah Collins")).not.toBeInTheDocument();
  });
});
