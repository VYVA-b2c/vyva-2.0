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

function renderPrivacySettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PrivacySettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function mockPermissionsApi(initialPermissions: BrainCoachCaregiverPermissions) {
  let currentPermissions = { ...initialPermissions };

  vi.mocked(apiFetch).mockImplementation(async (input: string, init?: RequestInit) => {
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
      expect(screen.getByText("No Brain Coach access")).toBeInTheDocument();
    });
  });
});
