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
    expect(screen.getByRole("link", { name: /concierge readiness.*flow coverage and launch gates/i }))
      .toHaveAttribute("href", "/admin/concierge-readiness");
    expect(screen.getByRole("link", { name: /email replies.*replies needing review/i }))
      .toHaveAttribute("href", "/admin/concierge-email-replies");
    expect(screen.getByRole("link", { name: /providers.*trusted contacts/i }))
      .toHaveAttribute("href", "/admin/providers");
  });

  it("links admins to workflow coverage", () => {
    renderMenu("/admin/workflows");

    const workflowLink = screen.getByRole("link", { name: /workflows.*coverage and next steps/i });
    expect(workflowLink).toHaveAttribute("href", "/admin/workflows");
    expect(workflowLink).toHaveAttribute("aria-current", "page");
  });

  it("links every admin page back to the module hub", () => {
    renderMenu("/admin/marketing");

    expect(screen.getByRole("link", { name: /modules.*all admin areas/i })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: /welcome module/i })).not.toBeInTheDocument();
  });

  it("links admins to the unified content index and room prompts", () => {
    renderMenu("/admin/content-index");

    const contentIndex = screen.getByRole("link", { name: /content index.*readiness across content/i });
    expect(contentIndex).toHaveAttribute("href", "/admin/content-index");
    expect(contentIndex).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /room prompts.*daily room topics/i })).toHaveAttribute("href", "/admin/room-prompts");
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
