import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import VettedPartnersAdminPage from "./VettedPartnersAdminPage";
import { apiFetch } from "@/lib/queryClient";

vi.mock("@/lib/queryClient", () => ({ apiFetch: vi.fn() }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1", email: "admin@example.com", role: "admin" }, logout: vi.fn() }),
}));
afterEach(() => vi.resetAllMocks());

const directory = {
  organisations: [{ id: "o1", name: "Cruz Roja Tarifa", deploymentKeys: [], website: null, isActive: true }],
  providers: [{
    id: "p1", organisationId: "o1", name: "Fontanería Ruiz", trades: ["plumber"], phone: "+34 956 000 111", email: null, website: null,
    address: null, languages: ["es"], coverageCountry: "ES", coverageRegion: null, coverageLat: 36.0143, coverageLng: -5.6044, coverageRadiusKm: 30,
    isActive: false, reviewedAt: null, reviewedBy: null,
  }],
};
const ok = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe("partner providers admin", () => {
  it("lists providers waiting for approval and approves one", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (init?.method === "POST") return ok({ provider: { ...directory.providers[0], isActive: true } });
      return ok(directory);
    });
    render(<MemoryRouter><VettedPartnersAdminPage /></MemoryRouter>);
    const list = await screen.findByTestId("list-vetted-providers");
    expect(within(list).getByText("Waiting for approval")).toBeInTheDocument();
    expect(within(list).getByText(/30 km around/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-approve-p1"));
    await waitFor(() => expect(vi.mocked(apiFetch).mock.calls.some(([url, init]) => String(url).endsWith("/providers/p1/review") && init?.body === JSON.stringify({ active: true }))).toBe(true));
  });

  it("previews CSV rows before importing", async () => {
    vi.mocked(apiFetch).mockImplementation(async (url, init) => {
      if (String(url).endsWith("/import")) return ok({ valid: 1, errors: [{ row: 3, errors: ["phone: Add at least a phone, email or website"] }] });
      return ok(directory);
    });
    render(<MemoryRouter><VettedPartnersAdminPage /></MemoryRouter>);
    fireEvent.change(await screen.findByLabelText("CSV to import"), { target: { value: "name,trades,phone,country\nRuiz,plumber,1,ES" } });
    fireEvent.click(screen.getByText("Check rows"));
    expect(await screen.findByTestId("csv-preview")).toHaveTextContent("1 rows ready, 1 with problems");
    expect(screen.getByText(/Row 3/)).toBeInTheDocument();
  });
});
