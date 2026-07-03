import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdminUsersPage from "./AdminUsersPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "owner@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

const apiFetchMock = vi.mocked(apiFetch);

const admins = [
  { id: "admin-1", email: "owner@example.com", role: "admin", last_seen_at: null, created_at: "2026-01-01T00:00:00.000Z" },
  { id: "admin-2", email: "ops@example.com", role: "admin", last_seen_at: null, created_at: "2026-01-02T00:00:00.000Z" },
] as const;

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage() {
  apiFetchMock.mockImplementation((path, init) => {
    const method = init?.method ?? "GET";
    if (path === "/api/admin/lifecycle/admin-users?" && method === "GET") {
      return Promise.resolve(jsonResponse({ admins, matches: [] }));
    }
    if (path === "/api/admin/lifecycle/admin-users/admin-2/role" && method === "PATCH") {
      return Promise.resolve(jsonResponse({ user: { ...admins[1], role: "user" } }));
    }
    return Promise.resolve(new Response(JSON.stringify({ error: `Unexpected call ${method} ${path}` }), { status: 500 }));
  });

  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/users"]}>
      <AdminUsersPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  apiFetchMock.mockReset();
});

describe("AdminUsersPage", () => {
  it("confirms before removing admin access", async () => {
    renderPage();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Remove admin/i })[1]);

    const dialog = screen.getByRole("dialog", { name: /Remove admin access/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Their login, user profile, app access, and care-team data stay unchanged/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Remove admin" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/admin/lifecycle/admin-users/admin-2/role",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ role: "user" }),
        }),
      );
    });
  });

  it("blocks removing the current user's own admin access", async () => {
    renderPage();

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    const selfRemoveButton = screen.getAllByRole("button", { name: /Remove admin/i })[0];
    expect(selfRemoveButton).toBeDisabled();
    expect(screen.getByText(/Use another super-admin session/i)).toBeInTheDocument();
  });
});
