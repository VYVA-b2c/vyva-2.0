import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminModulesPage from "./AdminModulesPage";

let authEmail = "ops@example.com";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: authEmail, role: "admin" },
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AdminModulesPage />
    </MemoryRouter>,
  );
}

describe("AdminModulesPage", () => {
  it("groups admin tools into clear modules", () => {
    authEmail = "ops@example.com";
    renderPage();

    expect(screen.getByRole("heading", { name: "People & access" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Marketing & communications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Content & experiences" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Concierge operations" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Platform readiness" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Marketing" })).toHaveAttribute("href", "/admin/marketing");
    expect(screen.getByRole("link", { name: "Email replies" })).toHaveAttribute("href", "/admin/concierge-email-replies");
    expect(screen.getByRole("link", { name: "Task queue" })).toHaveAttribute("href", "/admin/concierge-queue");
  });

  it("keeps admin-user management restricted to the super admin", () => {
    authEmail = "ops@example.com";
    const regularAdmin = renderPage();
    expect(screen.queryByRole("link", { name: "Admin users" })).not.toBeInTheDocument();
    regularAdmin.unmount();

    authEmail = "karim.assad@mokadigital.net";
    renderPage();
    expect(screen.getByRole("link", { name: "Admin users" })).toHaveAttribute("href", "/admin/users");
  });
});
