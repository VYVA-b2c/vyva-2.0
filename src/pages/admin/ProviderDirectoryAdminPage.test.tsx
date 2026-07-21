import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProviderDirectoryAdminPage from "./ProviderDirectoryAdminPage";
import type { AdminProviderDirectoryResponse } from "../../../shared/adminProviderDirectory";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queryClient", () => ({ apiFetch: apiFetchMock }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "admin-1", email: "ops@vyva.life", role: "admin" },
    logout: vi.fn(),
  }),
}));

function response(body: unknown, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

const directory: AdminProviderDirectoryResponse = {
  providers: [
    {
      id: "profile-1:0",
      profileId: "profile-1",
      providerIndex: 0,
      userLabel: "Karim",
      userEmail: "karim@example.com",
      name: "City Clinic",
      category: "doctor_clinic",
      phone: "+34 911 111 111",
      email: "clinic@example.com",
      whatsapp: "",
      website: "",
      notes: "Ask for morning appointments.",
      trusted: true,
      defaultForCategory: true,
      canContactAfterConfirmation: true,
      readyForConcierge: true,
      readinessLabel: "Phone, Email",
      channels: ["phone", "email"],
    },
    {
      id: "profile-1:1",
      profileId: "profile-1",
      providerIndex: 1,
      userLabel: "Karim",
      userEmail: "karim@example.com",
      name: "Repair Help",
      category: "home_service",
      phone: "",
      email: "",
      whatsapp: "",
      website: "",
      notes: "",
      trusted: true,
      defaultForCategory: false,
      canContactAfterConfirmation: true,
      readyForConcierge: false,
      readinessLabel: "Add contact",
      channels: [],
    },
  ],
  totals: { providers: 2, ready: 1, needsAttention: 1 },
};

function renderPage() {
  return render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={["/admin/providers"]}>
      <ProviderDirectoryAdminPage />
    </MemoryRouter>,
  );
}

describe("ProviderDirectoryAdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockReturnValue(response(directory));
  });

  it("shows provider readiness without technical labels", async () => {
    renderPage();

    expect(await screen.findByText("City Clinic")).toBeInTheDocument();
    expect(screen.getByText("1 ready")).toBeInTheDocument();
    expect(screen.getByText("1 need attention")).toBeInTheDocument();
    expect(screen.getByText("Phone, Email")).toBeInTheDocument();
    expect(screen.getByText("No contact added")).toBeInTheDocument();
    expect(screen.queryByText("profile-1")).not.toBeInTheDocument();
  });

  it("saves edited contact details and default choice", async () => {
    renderPage();

    const repairCard = (await screen.findByText("Repair Help")).closest("article");
    expect(repairCard).not.toBeNull();

    fireEvent.change(within(repairCard!).getByLabelText("Email"), { target: { value: "repair@example.com" } });
    fireEvent.click(within(repairCard!).getByLabelText("Default"));

    apiFetchMock.mockReturnValueOnce(response({
      provider: {
        ...directory.providers[1],
        email: "repair@example.com",
        defaultForCategory: true,
        readyForConcierge: true,
        readinessLabel: "Email",
        channels: ["email"],
      },
    }));

    fireEvent.click(within(repairCard!).getByRole("button", { name: /save provider/i }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/api/admin/providers/profile-1/providers/1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("repair@example.com"),
      }),
    ));
    expect(await screen.findByText("Repair Help saved.")).toBeInTheDocument();
  });
});
