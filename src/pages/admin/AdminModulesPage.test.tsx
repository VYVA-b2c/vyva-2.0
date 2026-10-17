import { fireEvent, render, screen, within } from "@testing-library/react";
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
    expect(screen.getByRole("link", { name: "Hero messages" })).toHaveAttribute("href", "/admin/hero-messages");
    expect(screen.getByRole("link", { name: "Task queue" })).toHaveAttribute("href", "/admin/concierge-queue");
    expect(screen.queryByRole("link", { name: /welcome module/i })).not.toBeInTheDocument();
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

  it("opens Console with all six verticals and preserves the hospital review link", () => {
    renderPage();
    expect(screen.queryByRole("heading", { name: "Hospital applications" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Open console", exact: true }));

    expect(screen.getByRole("heading", { name: "Console", level: 1 })).toBeInTheDocument();
    for (const name of ["Home Care", "Hospital Discharge", "Senior Living", "Community Support", "Safety Support", "Emergency Response"]) {
      expect(screen.getByRole("heading", { name, level: 2 })).toBeInTheDocument();
    }
    const hospital = screen.getByRole("heading", { name: "Hospital Discharge" }).closest("article")!;
    const applications = within(hospital).getByRole("link", { name: "Applications" });
    expect(applications).toHaveAttribute("href", "https://console.vyva.life/sign-in?return_to=%2Fplatform%2Fself-service");
    expect(applications).toHaveAttribute("target", "_blank");
    expect(applications).toHaveAttribute("rel", "noopener noreferrer");

    const setupLinks = screen.getAllByRole("link", { name: "Set Up", exact: true });
    expect(setupLinks).toHaveLength(6);
    const products = setupLinks.map((link) => {
      const returnTo = new URL(link.getAttribute("href")!).searchParams.get("return_to")!;
      expect(link).toHaveAttribute("target", "_blank");
      expect(new URL(returnTo, "https://console.vyva.life").pathname).toBe("/platform/accounts/new");
      return new URL(returnTo, "https://console.vyva.life").searchParams.get("product");
    });
    expect(new Set(products).size).toBe(6);
    expect(screen.getByRole("link", { name: "Admin home" })).toHaveAttribute("href", "/admin");
  });
});
