import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  TRUSTED_HELP_PARTNERS_STORAGE_KEY,
  type TrustedHelpPartner,
} from "@/data/trustedHelpPartners";
import TrustedHelpPartnersAdminPage from "./TrustedHelpPartnersAdminPage";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { email: "admin@example.com", role: "admin" },
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiFetch: vi.fn(() => new Promise(() => {})),
}));

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/trusted-help-partners"]}>
      <TrustedHelpPartnersAdminPage />
    </MemoryRouter>,
  );
}

function savedPartners() {
  return JSON.parse(window.localStorage.getItem(TRUSTED_HELP_PARTNERS_STORAGE_KEY) ?? "[]") as TrustedHelpPartner[];
}

describe("TrustedHelpPartnersAdminPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lists the managed default partner catalog without Waterdrop Home", () => {
    renderPage();

    expect(screen.getByTestId("trusted-help-partners-admin")).toHaveTextContent("Trusted Help Partners");
    expect(screen.getByTestId("admin-partners-list")).toHaveTextContent("Aquaservice");
    expect(screen.getByTestId("admin-partners-list")).toHaveTextContent("Mercadona");
    expect(screen.getByTestId("admin-partners-list")).not.toHaveTextContent("Waterdrop Home");
    expect(screen.getByTestId("button-admin-partners-filter-groceries")).toHaveTextContent("4");
    expect(screen.getByTestId("button-admin-partners-filter-home-care")).toHaveTextContent("2");
  });

  it("adds and edits partners from admin-managed storage", async () => {
    renderPage();

    fireEvent.click(screen.getByTestId("button-admin-partner-add"));
    fireEvent.change(screen.getByTestId("input-admin-partner-name"), { target: { value: "Casa Market" } });
    fireEvent.change(screen.getByTestId("input-admin-partner-label"), { target: { value: "Groceries and essentials" } });
    fireEvent.change(screen.getByTestId("input-admin-partner-method"), { target: { value: "Phone order" } });
    fireEvent.change(screen.getByTestId("input-admin-partner-payment"), { target: { value: "Family approves" } });
    fireEvent.click(screen.getByTestId("button-admin-partner-coverage-water"));
    fireEvent.click(screen.getByTestId("button-admin-partner-save"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-partners-list")).toHaveTextContent("Casa Market");
      expect(savedPartners().find((partner) => partner.name === "Casa Market")).toMatchObject({
        service: "groceries",
        label: "Groceries and essentials",
        method: "Phone order",
        coverage: expect.arrayContaining(["Food", "Water"]),
      });
    });

    const casaPartnerId = savedPartners().find((partner) => partner.name === "Casa Market")?.id;
    expect(casaPartnerId).toBeTruthy();
    const casaCard = screen.getByTestId(`card-admin-partner-${casaPartnerId}`);
    fireEvent.click(within(casaCard).getByText("Edit"));
    fireEvent.change(screen.getByTestId("input-admin-partner-name"), { target: { value: "Casa Market Plus" } });
    fireEvent.click(screen.getByTestId("button-admin-partner-save"));

    await waitFor(() => {
      expect(screen.getByTestId("admin-partners-list")).toHaveTextContent("Casa Market Plus");
      expect(savedPartners().some((partner) => partner.name === "Casa Market Plus")).toBe(true);
    });
  });

  it("can hide partners so they stop appearing to users", async () => {
    renderPage();

    fireEvent.click(screen.getByTestId("button-admin-partner-toggle-partner-aquaservice"));

    await waitFor(() => {
      const aquaservice = savedPartners().find((partner) => partner.id === "partner-aquaservice");
      expect(aquaservice?.enabled).toBe(false);
      expect(screen.getByTestId("card-admin-partner-partner-aquaservice")).toHaveTextContent("Hidden");
    });
  });
});
