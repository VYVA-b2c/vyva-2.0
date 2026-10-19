import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpertCareAdminPage from "./ExpertCareAdminPage";

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/queryClient", () => ({ apiFetch: apiFetchMock }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "admin-1", email: "karim.assad@mokadigital.net", role: "admin" }, logout: vi.fn() }) }));
const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(body) });

const candidate = {
  id: "candidate-1", name: "Dr Example", specialty: "oncology", institution: "Reference Hospital", country: "ES", address: "Madrid", distanceMeters: null,
  openingStatus: null, todayOpeningHours: null, languages: ["English"], remoteCareRegions: ["EU"], websiteUrl: null, mapsUrl: null,
  rating: null, reviewCount: null, ratingProvenance: null, expertiseEvidence: [], directorySources: [{ label: "Medical register", url: "https://example.test/register" }],
  contactData: { website: null, phone: null, email: null }, availability: null, timezone: null, estimatedCost: null,
  verificationStatus: "verification_pending", verificationDetails: ["Requested"], sourceLabel: "Medical register",
};

function installResponses() {
  apiFetchMock.mockImplementation((url: string) => {
    if (url.includes("launch-readiness")) return response({ ready: false, mode: "limited_pilot", blockers: ["clinical_safety_review"], gates: [{ id: "clinical_safety_review", required: true, passed: false, detail: "A current independent review is required." }], clinicalReview: null });
    if (url.includes("verification-queue")) return response({ items: [{ caseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", ownerUserId: "user-1", candidate, requestedAt: "2026-10-19T10:00:00Z", caseContext: { specialty: "oncology", location: "Madrid", languages: ["en"] } }] });
    if (url.includes("coordination-queue")) return response({ items: [] });
    if (url.includes("safety-metrics")) return response({ metrics: [{ metric: "research_generated", severity: "info", count: 8, averageValue: 2, latestAt: "2026-10-19T10:00:00Z" }] });
    if (url.includes("/verification")) return response({ case: {}, safeAlternatives: [], externalContactStarted: false });
    return response({ review: { id: "review-1" } });
  });
}

describe("ExpertCareAdminPage", () => {
  beforeEach(() => { vi.clearAllMocks(); installResponses(); });

  it("shows launch blockers and makes all seven checks explicit", async () => {
    render(<MemoryRouter initialEntries={["/admin/expert-care"]}><ExpertCareAdminPage /></MemoryRouter>);
    expect((await screen.findAllByText("Dr Example"))[0]).toBeVisible();
    expect(screen.getByText("Release blocked safely")).toBeVisible();
    for (const label of ["Identity", "Active license", "Subspecialty", "Institution", "Languages", "Remote-care countries", "Contact route"]) expect(screen.getByRole("checkbox", { name: label })).toBeVisible();
    expect(screen.getByText("8")).toBeVisible();
  });

  it("will not verify a specialist until all checks and an audit note are complete", async () => {
    render(<MemoryRouter initialEntries={["/admin/expert-care"]}><ExpertCareAdminPage /></MemoryRouter>);
    await screen.findAllByText("Dr Example");
    fireEvent.click(screen.getByRole("button", { name: "Verify specialist" }));
    expect(screen.getByRole("status")).toHaveTextContent("Add a verification note");
    expect(apiFetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/verification"), expect.anything());

    fireEvent.change(screen.getByLabelText("Audit note"), { target: { value: "License and institutional profile independently confirmed." } });
    for (const label of ["Identity", "Active license", "Subspecialty", "Institution", "Languages", "Remote-care countries", "Contact route"]) fireEvent.click(screen.getByRole("checkbox", { name: label }));
    fireEvent.click(screen.getByRole("button", { name: "Verify specialist" }));
    expect(screen.getByRole("status")).toHaveTextContent("expertise evidence");
    fireEvent.change(screen.getByLabelText("Expertise evidence"), { target: { value: "Registered oncology subspecialist" } });
    fireEvent.change(screen.getByLabelText("Verified email"), { target: { value: "clinic@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify specialist" }));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith(expect.stringContaining("/specialists/candidate-1/verification"), expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"licenseConfirmed":true') })));
    const verificationCall = apiFetchMock.mock.calls.find(([url]) => String(url).includes("/specialists/candidate-1/verification"));
    expect(JSON.parse(verificationCall?.[1]?.body)).toMatchObject({ verifiedProfile: { institution: "Reference Hospital", languages: ["English"], contactData: { email: "clinic@example.test" } } });
  });
});
