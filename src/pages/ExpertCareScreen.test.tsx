import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import ExpertCareScreen from "./ExpertCareScreen";
import { applyExpertCarePatch, attachExpertCareEvidence, attachExpertCareSpecialists, createExpertCareState } from "../../shared/expertCareState";

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), language: "en" }));
const caseRecordId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
vi.mock("@/lib/queryClient", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/i18n", () => ({ useLanguage: () => ({ language: mocks.language }) }));
vi.mock("@/hooks/useHomeMasterTheme", () => ({ useHomeMasterTheme: () => ({ isDark: true }) }));

const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("Expert Care", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.language = "en";
    let caseRecord = { id: caseRecordId, state: createExpertCareState("en"), status: "active" as const, createdAt: "2026-10-19T10:00:00.000Z", updatedAt: "2026-10-19T10:00:00.000Z" };
    mocks.apiFetch.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/expert-care/cases" && init?.method === "POST") return jsonResponse({ case: caseRecord });
      if (url.startsWith("/api/expert-care/cases/") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        caseRecord = { ...caseRecord, state: applyExpertCarePatch(caseRecord.state, body.patch) };
        return jsonResponse({ case: caseRecord });
      }
      if (url.endsWith("/documents") && !init?.method) return jsonResponse({ documents: [] });
      if (url.startsWith("/api/expert-care/cases/")) return jsonResponse({ case: caseRecord });
      if (url.endsWith("/research")) return jsonResponse({
        items: [{ id: "e1", evidenceType: "peer_reviewed_clinical_evidence", title: "Recent evidence", whatChanged: "New study", whyItMayMatter: "Discuss context", askTheSpecialist: "Does this apply?", jurisdiction: "International", publishedAt: "2026-01-10", limitations: "Not individual advice", experimental: false, retrievedAt: "2026-10-18T00:00:00Z", citations: [{ id: "123", label: "PubMed 123", url: "https://pubmed.ncbi.nlm.nih.gov/123/", source: "Europe PMC" }] }],
        retrievedAt: "2026-10-18T00:00:00Z", educationalOnly: true, unavailableSources: [],
      });
      return jsonResponse({ candidates: [1, 2, 3, 4].map((value) => ({ id: `s${value}`, name: `Specialist ${value}`, specialty: "oncology", institution: null, country: null, address: "Madrid", languages: [], remoteCareRegions: [], websiteUrl: null, mapsUrl: null, rating: null, reviewCount: null, verificationStatus: "unverified", verificationDetails: [], sourceLabel: "Open directory" })), contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    });
  });

  it("runs the safety-first journey and limits the first specialist shortlist to three", async () => {
    render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);
    expect(screen.getByText("Find a specialist")).toBeVisible();
    expect(screen.getByText("Get a second opinion")).toBeVisible();
    expect(screen.getByText("Review recent treatments")).toBeVisible();
    expect(screen.getByText("Explore trials and advances")).toBeVisible();
    fireEvent.click(screen.getByText("Find a specialist"));
    fireEvent.click(screen.getByText("For me"));
    fireEvent.click(screen.getByText("Oncology"));
    expect(screen.getByText("First, a safety check")).toBeVisible();
    fireEvent.click(screen.getByText("No, I can continue"));
    fireEvent.change(screen.getByPlaceholderText("For example: I have been advised…"), { target: { value: "Review my proposed treatment" } });
    fireEvent.click(screen.getByText("Continue"));
    expect(screen.getByText("Your private health vault")).toBeVisible();
    fireEvent.click(screen.getByText("Continue without records"));
    fireEvent.change(screen.getByPlaceholderText("For example: understand alternatives, side effects, or treatment timing"), { target: { value: "Understand alternatives and side effects" } });
    fireEvent.click(screen.getByText("Continue"));
    fireEvent.change(screen.getByPlaceholderText("City, country"), { target: { value: "Madrid, Spain" } });
    fireEvent.click(screen.getByText("Prepare my case"));
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Recent evidence", level: 2 }),
      ).toBeVisible(),
    );
    expect(screen.getByText("Specialist 1")).toBeVisible();
    expect(screen.getByText("Specialist 3")).toBeVisible();
    expect(screen.queryByText("Specialist 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Show more"));
    expect(screen.getByText("Specialist 4")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Request verification" })[0]).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "I understand" }));
    await waitFor(() => expect(screen.getByText("Understood")).toBeVisible());
    expect(screen.getAllByRole("button", { name: "Request verification" })[0]).toBeEnabled();
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/expert-care/cases", expect.objectContaining({ method: "POST" }));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/expert-care/research", expect.objectContaining({ body: expect.stringContaining(caseRecordId) }));
    expect(mocks.apiFetch).toHaveBeenCalledWith("/api/expert-care/specialists", expect.objectContaining({ body: expect.stringContaining('"limit":3') }));
  });

  it("stops before research when urgent symptoms are reported", () => {
    render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);

    fireEvent.click(screen.getByText("Find a specialist"));
    fireEvent.click(screen.getByText("For me"));
    fireEvent.click(screen.getByText("Cardiology"));
    fireEvent.click(screen.getByText("Yes, I may need urgent help"));

    expect(screen.getByRole("alert")).toHaveTextContent(/call your local emergency number/i);
    expect(mocks.apiFetch).not.toHaveBeenCalledWith("/api/expert-care/research", expect.anything());
    expect(mocks.apiFetch).not.toHaveBeenCalledWith("/api/expert-care/specialists", expect.anything());
  });

  it("resumes a server-backed case at the first unanswered question", async () => {
    let state = createExpertCareState("en");
    state = applyExpertCarePatch(state, { goal: "second_opinion", person: "self", stage: "specialty" });
    const resumed = { id: caseRecordId, state, status: "active", createdAt: state.createdAt, updatedAt: state.updatedAt };
    mocks.apiFetch.mockImplementation(async (url: string) => {
      if (url === `/api/expert-care/cases/${caseRecordId}`) return jsonResponse({ case: resumed });
      if (url.endsWith("/documents")) return jsonResponse({ documents: [] });
      return jsonResponse({ case: resumed });
    });

    render(<MemoryRouter initialEntries={[`/expert-care/${caseRecordId}`]}><Routes><Route path="/expert-care/:caseId" element={<ExpertCareScreen />} /></Routes></MemoryRouter>);

    expect(await screen.findByText("Which medical area?")).toBeVisible();
    expect(screen.getByText("Saved")).toBeVisible();
  });

  it("requires a trusted helper to confirm permission before medical context", () => {
    render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);

    fireEvent.click(screen.getByText("Get a second opinion"));
    fireEvent.click(screen.getByText("For someone I help"));
    expect(screen.getByText("Do you have permission to help?")).toBeVisible();
    expect(screen.queryByText("Which medical area?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Yes, I have their permission"));
    expect(screen.getByText("Which medical area?")).toBeVisible();
  });

  it("resumes a local draft without network-dependent clinical results", () => {
    localStorage.setItem("vyva:expert-care:draft:v1", JSON.stringify({ step: "context", goal: "second_opinion", who: "self", authorityConfirmedAt: null, specialty: "neurology", question: "Review this diagnosis", location: "", safetyCleared: true }));
    render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);
    expect(screen.getByText("What would you like reviewed?")).toBeVisible();
    expect(screen.getByDisplayValue("Review this diagnosis")).toBeVisible();
  });

  it("supports the trusted-helper opening journey in Spanish", () => {
    mocks.language = "es";
    render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);
    fireEvent.click(screen.getByText("Obtener una segunda opinión"));
    fireEvent.click(screen.getByText("Para alguien a quien ayudo"));
    expect(screen.getByText("¿Tienes permiso para ayudar?")).toBeVisible();
    fireEvent.click(screen.getByText("Sí, tengo su permiso"));
    expect(screen.getByText("¿Qué área médica?")).toBeVisible();
  });

  it("turns failed verification into a safe alternative path instead of retrying contact", async () => {
    const candidate = (id: string, status: "failed" | "unverified") => ({
      id, name: id === "failed" ? "Unavailable specialist" : "Alternative specialist", specialty: "oncology",
      institution: "Verified-source hospital", country: "ES", address: "Madrid", distanceMeters: null,
      openingStatus: null, todayOpeningHours: null, languages: [], remoteCareRegions: [], websiteUrl: null,
      mapsUrl: null, rating: null, reviewCount: null, ratingProvenance: null, expertiseEvidence: [],
      directorySources: [{ label: "Open directory", url: null }], contactData: { website: null, phone: null, email: null },
      availability: null, timezone: null, estimatedCost: null, verificationStatus: status,
      verificationDetails: status === "failed" ? ["License could not be confirmed"] : [], sourceLabel: "Open directory",
    });
    let state = applyExpertCarePatch(createExpertCareState("en"), { goal: "second_opinion", person: "self", specialty: "oncology", emergencyResult: "clear", diagnosisOrRecommendation: "Review treatment", concerns: "Understand options", location: "Madrid", stage: "specialists" });
    state = attachExpertCareEvidence(state, { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [] });
    state = attachExpertCareSpecialists(state, { candidates: [candidate("failed", "failed"), candidate("alternative", "unverified")] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    const resumed = { id: caseRecordId, state, status: "active", createdAt: state.createdAt, updatedAt: state.updatedAt };
    mocks.apiFetch.mockImplementation(async (url: string) => {
      if (url === `/api/expert-care/cases/${caseRecordId}`) return jsonResponse({ case: resumed });
      if (url.endsWith("/documents")) return jsonResponse({ documents: [] });
      return jsonResponse({ enabled: true });
    });

    render(<MemoryRouter initialEntries={[`/expert-care/${caseRecordId}`]}><Routes><Route path="/expert-care/:caseId" element={<ExpertCareScreen />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("Verification could not be completed")).toBeVisible();
    expect(screen.getByText(/No contact will be started/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Review another option" }));
    expect(screen.getByText("Alternative specialist")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "I understand" }));
    await waitFor(() => expect(screen.getByText("Understood")).toBeVisible());
    expect(screen.queryByRole("button", { name: "Request verification" })).toBeEnabled();
  });

  it("shows the persisted consultation-ready package and attributable specialist response", async () => {
    const verified = {
      id: "verified-1", name: "Dr Verified", specialty: "oncology", institution: "Reference Hospital", country: "Spain", address: "Madrid", distanceMeters: null,
      openingStatus: null, todayOpeningHours: null, languages: ["English"], remoteCareRegions: ["Spain"], websiteUrl: "https://hospital.example.test", mapsUrl: null,
      rating: null, reviewCount: null, ratingProvenance: null, expertiseEvidence: ["Registered oncology specialist"], directorySources: [{ label: "Medical register", url: "https://register.example.test" }],
      contactData: { website: "https://hospital.example.test", phone: null, email: "clinic@example.test" }, availability: "Remote consultations available", timezone: "Europe/Madrid", estimatedCost: "€250",
      verificationStatus: "verified", verificationDetails: ["Identity and active license confirmed"], sourceLabel: "Medical register",
    } as const;
    let state = applyExpertCarePatch(createExpertCareState("en"), { goal: "second_opinion", person: "self", specialty: "oncology", emergencyResult: "clear", diagnosisOrRecommendation: "Review treatment", concerns: "Understand options", location: "Madrid", stage: "ready" });
    state = attachExpertCareEvidence(state, { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [] });
    state = attachExpertCareSpecialists(state, { candidates: [verified] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    state = { ...state, consent: { ...state.consent, research: true, sharing: true }, stage: "ready", coordinationStatus: "complete", contactPreparation: { pendingActionId: "task-1", candidateId: verified.id, recipient: "clinic@example.test", documentIds: [], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please review this consultation request.", confirmedAt: "2026-10-19T11:00:00.000Z" }, specialistResponse: { candidateId: verified.id, outcome: "accepted", notes: "Remote consultation offered next week.", receivedAt: "2026-10-19T12:00:00.000Z" } };
    const resumed = { id: caseRecordId, state, status: "active", createdAt: state.createdAt, updatedAt: state.updatedAt };
    mocks.apiFetch.mockImplementation(async (url: string) => {
      if (url.endsWith("/consultation-package")) return jsonResponse({ caseId: caseRecordId, generatedAt: "2026-10-19T12:01:00.000Z", consultationReady: true, blockers: [], context: state.context, evidence: state.evidence?.result, verifiedSpecialists: [verified], preparedQuestions: ["What are the options?"], records: [], contactPreparation: state.contactPreparation, specialistResponse: state.specialistResponse, boundaries: ["Educational information only"] });
      if (url === `/api/expert-care/cases/${caseRecordId}`) return jsonResponse({ case: resumed });
      if (url.endsWith("/documents")) return jsonResponse({ documents: [] });
      return jsonResponse({ enabled: true });
    });

    render(<MemoryRouter initialEntries={[`/expert-care/${caseRecordId}`]}><Routes><Route path="/expert-care/:caseId" element={<ExpertCareScreen />} /></Routes></MemoryRouter>);

    expect(await screen.findByRole("heading", { name: "Your consultation package is organized" })).toBeVisible();
    expect(screen.getByText(/specialist has responded/i)).toBeVisible();
    expect(screen.getByText(/Dr Verified · Reference Hospital/)).toBeVisible();
    expect(screen.getByText(/Remote consultation offered next week/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Review request in Concierge/ })).toBeVisible();
  });

  it("has no automated accessibility violations on the opening screen", async () => {
    const { container } = render(<MemoryRouter><ExpertCareScreen /></MemoryRouter>);
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
