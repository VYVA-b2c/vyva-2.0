import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CareTeamInvitePage from "./CareTeamInvitePage";

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as null | { id: string; email?: string | null; phone?: string | null; role?: string },
    isLoading: false,
  },
  apiFetch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/components/VyvaWordmark", () => ({
  VyvaWordmark: () => <div data-testid="vyva-wordmark" />,
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
  queryClient: {
    invalidateQueries: (...args: unknown[]) => mocks.invalidateQueries(...args),
  },
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validInvite(overrides: Record<string, unknown> = {}) {
  return {
    invite: {
      status: "pending",
      canAccept: true,
      seniorDisplayName: "Elena Senior",
      inviteeName: "Mary Caregiver",
      role: "caregiver",
      relationship: "daughter",
      expiresAt: "2026-06-08T00:00:00.000Z",
      acceptedAt: null,
      requestedPermissions: {
        dailyDigest: true,
        safetyAlerts: true,
        dashboardAccess: true,
        journalSummaries: false,
      },
      ...overrides,
    },
  };
}

function LocationSpy() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderInvitePage(initialEntry = "/care-team/invite/token-123") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/care-team/invite/:token" element={<CareTeamInvitePage />} />
        <Route path="/login" element={<LocationSpy />} />
        <Route path="/caregiver" element={<LocationSpy />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  mocks.auth.user = null;
  mocks.auth.isLoading = false;
  mocks.apiFetch.mockReset();
  mocks.invalidateQueries.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(validInvite())));
});

afterEach(() => {
  window.sessionStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("CareTeamInvitePage", () => {
  it("renders a valid logged-out invite with sign-in and account creation links", async () => {
    renderInvitePage();

    expect(await screen.findByText(/Elena Senior invited you/i)).toBeInTheDocument();
    expect(window.sessionStorage.getItem("vyva_care_team_invite_return")).toBe("/care-team/invite/token-123");
    expect(screen.getByText("Mary Caregiver")).toBeInTheDocument();
    expect(screen.getByText("Caregiver - daughter")).toBeInTheDocument();
    expect(screen.getByText("Daily wellbeing summary")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?mode=login&returnTo=%2Fcare-team%2Finvite%2Ftoken-123",
    );
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute(
      "href",
      "/login?mode=register&returnTo=%2Fcare-team%2Finvite%2Ftoken-123",
    );
  });

  it("shows an inactive state for an expired invite", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({
      ...validInvite({ status: "expired", canAccept: false }),
      error: "This invitation link is no longer active.",
    }, 410));

    renderInvitePage();

    expect(await screen.findByText("This invitation has expired")).toBeInTheDocument();
    expect(screen.getByText(/send a fresh care-team invitation/i)).toBeInTheDocument();
  });

  it("accepts a pending invite for a signed-in caregiver and routes to the caregiver dashboard", async () => {
    mocks.auth.user = { id: "caregiver-1", email: "mary@example.com", role: "user" };
    mocks.apiFetch.mockResolvedValue(jsonResponse({ ok: true, destination: "/caregiver" }));

    renderInvitePage();

    fireEvent.click(await screen.findByRole("button", { name: /accept invitation/i }));

    await waitFor(() => {
      expect(mocks.apiFetch).toHaveBeenCalledWith("/api/auth/careteam-invites/token-123/accept", { method: "POST" });
      expect(window.sessionStorage.getItem("vyva_care_team_invite_return")).toBeNull();
      expect(screen.getByTestId("location")).toHaveTextContent("/caregiver");
    });
  });
});
