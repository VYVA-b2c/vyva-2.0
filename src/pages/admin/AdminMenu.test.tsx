import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminMenu from "./AdminMenu";

let authEmail = "ops@example.com";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: authEmail, role: "admin" },
  }),
}));

function renderMenu(path = "/admin/lifecycle") {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[path]}>
      <AdminMenu />
    </MemoryRouter>,
  );
}

describe("AdminMenu", () => {
  beforeEach(() => {
    authEmail = "ops@example.com";
  });

  it("links admins to content review and cognitive assessment separately", () => {
    renderMenu("/admin/content-review");

    const contentReviewLink = screen.getByRole("link", { name: /content review.*curious minds and scent drafts/i });
    expect(contentReviewLink).toHaveAttribute("href", "/admin/content-review");
    expect(contentReviewLink).toHaveAttribute("aria-current", "page");

    expect(screen.getByRole("link", { name: /cognitive assessment.*cognitive compass upload/i }))
      .toHaveAttribute("href", "/admin/cognitive-assessment");
  });

  it("links admins to workflow coverage", () => {
    renderMenu("/admin/workflows");

    const workflowLink = screen.getByRole("link", { name: /workflows.*coverage and next steps/i });
    expect(workflowLink).toHaveAttribute("href", "/admin/workflows");
    expect(workflowLink).toHaveAttribute("aria-current", "page");
  });

  it("keeps the Admins tab super-admin only", () => {
    const regularAdmin = renderMenu();

    expect(screen.queryByRole("link", { name: /admins.*manage admin access/i })).not.toBeInTheDocument();
    regularAdmin.unmount();

    authEmail = "karim.assad@mokadigital.net";
    renderMenu();

    expect(screen.getByRole("link", { name: /admins.*manage admin access/i })).toHaveAttribute("href", "/admin/users");
  });
});
