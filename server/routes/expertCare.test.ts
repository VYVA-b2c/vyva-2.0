import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cases = vi.hoisted(() => ({
  createExpertCareCase: vi.fn(),
  getExpertCareCase: vi.fn(),
  updateExpertCareCase: vi.fn(),
  importLegacyCareFinderCase: vi.fn(),
  listExpertCareVerificationQueue: vi.fn(),
  listExpertCareCoordinationQueue: vi.fn(),
  saveExpertCareEvidence: vi.fn(),
  saveExpertCareResearchAcknowledgement: vi.fn(),
  saveExpertCareContactPreparation: vi.fn(),
  saveExpertCareSpecialists: vi.fn(),
  saveExpertCareSpecialistResponse: vi.fn(),
  saveExpertCareVerification: vi.fn(),
}));
const vault = vi.hoisted(() => ({
  uploadExpertCareDocument: vi.fn(),
  listExpertCareDocuments: vi.fn(),
  downloadExpertCareDocument: vi.fn(),
  setExpertCareDocumentSharing: vi.fn(),
  deleteExpertCareDocument: vi.fn(),
  listExpertCareVaultAudit: vi.fn(),
  ScannerUnavailableError: class ScannerUnavailableError extends Error {},
}));

vi.mock("../services/expertCareCases.js", () => ({
  ...cases,
  ExpertCareCaseNotFoundError: class ExpertCareCaseNotFoundError extends Error {},
  ExpertCareCaseConflictError: class ExpertCareCaseConflictError extends Error { constructor(public current: unknown) { super("conflict"); } },
  LegacyCareFinderUnavailableError: class LegacyCareFinderUnavailableError extends Error {},
}));
const research = vi.hoisted(() => ({ researchExpertCareEvidence: vi.fn() }));
vi.mock("../services/expertCareResearch.js", () => research);
vi.mock("../services/appointmentDiscovery.js", () => ({
  discoverAppointmentProviderOptions: vi.fn().mockResolvedValue({ options: [] }),
}));
const paid = vi.hoisted(() => ({ hasTierEntitlement: vi.fn(), triggerConciergeAction: vi.fn() }));
vi.mock("../middleware/entitlements.js", () => ({ hasTierEntitlement: paid.hasTierEntitlement }));
vi.mock("../services/conciergeActions.js", () => ({ triggerConciergeAction: paid.triggerConciergeAction }));
const safety = vi.hoisted(() => ({
  expertCareRuntimeControl: vi.fn(),
  recordExpertCareSafetyEvent: vi.fn(),
  expertCareMetricSummary: vi.fn(),
  clearExpertCareSafetyRollback: vi.fn(),
}));
vi.mock("../services/expertCareSafety.js", () => ({
  EXPERT_CARE_METRICS: ["research_generated", "unsupported_claim_detected", "citation_coverage", "source_freshness", "emergency_handoff", "verification_failed", "sharing_consent", "consultation_ready", "specialist_response", "user_comprehension", "privacy_failure", "security_incident"],
  ...safety,
}));
const readiness = vi.hoisted(() => ({
  expertCareLaunchReadiness: vi.fn(),
  recordExpertCareClinicalSafetyReview: vi.fn(),
}));
vi.mock("../services/expertCareLaunchReadiness.js", () => readiness);
vi.mock("../services/expertCareVault.js", () => ({
  uploadExpertCareDocument: vault.uploadExpertCareDocument,
  listExpertCareDocuments: vault.listExpertCareDocuments,
  downloadExpertCareDocument: vault.downloadExpertCareDocument,
  setExpertCareDocumentSharing: vault.setExpertCareDocumentSharing,
  deleteExpertCareDocument: vault.deleteExpertCareDocument,
  listExpertCareVaultAudit: vault.listExpertCareVaultAudit,
  ExpertCareDocumentDuplicateError: class ExpertCareDocumentDuplicateError extends Error {},
  ExpertCareDocumentNotFoundError: class ExpertCareDocumentNotFoundError extends Error {},
  ExpertCareDocumentRejectedError: class ExpertCareDocumentRejectedError extends Error {},
  ExpertCareMalwareScannerUnavailableError: vault.ScannerUnavailableError,
  ExpertCareVaultPermissionError: class ExpertCareVaultPermissionError extends Error {},
}));

import router from "./expertCare.js";
import { acknowledgeExpertCareResearchBoundary, applyExpertCarePatch, attachExpertCareContactPreparation, attachExpertCareEvidence, attachExpertCareSpecialists, createExpertCareState, updateExpertCareVerification } from "../../shared/expertCareState.js";

const caseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const legacyTaskId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const documentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const readyStateBase = applyExpertCarePatch(createExpertCareState("en"), {
  goal: "second_opinion",
  specialty: "oncology",
  person: "self",
  diagnosisOrRecommendation: "Review this treatment",
  location: "Madrid, Spain",
  emergencyResult: "clear",
  stage: "research",
});
const readyState = { ...readyStateBase, consent: { ...readyStateBase.consent, research: true } };
const record = { id: caseId, state: readyState, status: "active", createdAt: "2026-10-19T10:00:00.000Z", updatedAt: "2026-10-19T10:00:00.000Z" };

function app(user: { id: string; email?: string } = { id: "user-1" }) {
  const value = express();
  value.use(express.json());
  value.use((req, _res, next) => { req.user = user as Express.User; next(); });
  value.use("/api/expert-care", router);
  return value;
}

describe("Expert Care case routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cases.createExpertCareCase.mockResolvedValue(record);
    cases.getExpertCareCase.mockResolvedValue(record);
    cases.updateExpertCareCase.mockResolvedValue({ ...record, state: { revision: 1 } });
    cases.importLegacyCareFinderCase.mockResolvedValue(record);
    cases.listExpertCareVerificationQueue.mockResolvedValue([]);
    cases.listExpertCareCoordinationQueue.mockResolvedValue([]);
    cases.saveExpertCareEvidence.mockResolvedValue(record);
    cases.saveExpertCareResearchAcknowledgement.mockResolvedValue(record);
    cases.saveExpertCareContactPreparation.mockResolvedValue(record);
    cases.saveExpertCareSpecialists.mockResolvedValue(record);
    cases.saveExpertCareSpecialistResponse.mockResolvedValue(record);
    cases.saveExpertCareVerification.mockResolvedValue(record);
    paid.hasTierEntitlement.mockResolvedValue({ allowed: true, tier: "premium" });
    paid.triggerConciergeAction.mockResolvedValue({ pendingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "pending", conversationId: null, callSid: null, message: "Prepared" });
    safety.expertCareRuntimeControl.mockResolvedValue({ forceDisabled: false, reason: null, incidentEventId: null, updatedAt: null });
    readiness.expertCareLaunchReadiness.mockResolvedValue({ ready: true, mode: "general", blockers: [], gates: [], clinicalReview: null });
    readiness.recordExpertCareClinicalSafetyReview.mockResolvedValue({ id: "review-1", verdict: "approved" });
    safety.recordExpertCareSafetyEvent.mockResolvedValue({ eventId: "event-1", rollbackTriggered: false });
    research.researchExpertCareEvidence.mockResolvedValue({ items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [], safetyRejectedCount: 0, safetyRejectionReasons: [] });
    vault.listExpertCareDocuments.mockResolvedValue([]);
    vault.uploadExpertCareDocument.mockResolvedValue({ id: documentId, caseId, fileName: "report.pdf" });
    vault.setExpertCareDocumentSharing.mockResolvedValue({ id: documentId, sharingApproved: true });
    vault.deleteExpertCareDocument.mockResolvedValue(undefined);
    vault.listExpertCareVaultAudit.mockResolvedValue([]);
  });

  it("creates, resumes, and revision-saves a member-owned case", async () => {
    await request(app()).post("/api/expert-care/cases").send({ language: "en" }).expect(201);
    await request(app()).get(`/api/expert-care/cases/${caseId}`).expect(200);
    await request(app()).patch(`/api/expert-care/cases/${caseId}`).send({ expectedRevision: 0, patch: { goal: "second_opinion", stage: "person" } }).expect(200);
    expect(cases.createExpertCareCase).toHaveBeenCalledWith({ userId: "user-1", language: "en" });
    expect(cases.getExpertCareCase).toHaveBeenCalledWith(caseId, "user-1");
    expect(cases.updateExpertCareCase).toHaveBeenCalledWith({ id: caseId, userId: "user-1", expectedRevision: 0, patch: { goal: "second_opinion", stage: "person" } });
  });

  it("imports a readable Care Finder draft once through the dedicated migration route", async () => {
    await request(app()).post(`/api/expert-care/cases/import/${legacyTaskId}`).send({ language: "es" }).expect(201);
    expect(cases.importLegacyCareFinderCase).toHaveBeenCalledWith(legacyTaskId, "user-1", "es");
  });

  it("attaches generated evidence to the server case", async () => {
    await request(app()).post("/api/expert-care/research").send({ caseId, specialty: "oncology", question: "Review this treatment", language: "en" }).expect(200);
    expect(cases.saveExpertCareEvidence).toHaveBeenCalledWith(caseId, "user-1", expect.objectContaining({ educationalOnly: true }));
  });

  it("persists explicit understanding of educational scope before coordination", async () => {
    const state = attachExpertCareEvidence(readyStateBase, { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [] });
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state });
    cases.saveExpertCareResearchAcknowledgement.mockResolvedValueOnce({ ...record, state: { ...state, consent: { ...state.consent, research: true } } });
    await request(app()).post(`/api/expert-care/cases/${caseId}/research-acknowledgement`).send({ educationalOnlyAcknowledged: true, uncertaintyAcknowledged: true }).expect(200);
    expect(cases.saveExpertCareResearchAcknowledgement).toHaveBeenCalledWith(caseId, "user-1");
    expect(safety.recordExpertCareSafetyEvent).toHaveBeenCalledWith(expect.objectContaining({ metric: "user_comprehension", value: 1 }));
  });

  it("blocks research until the emergency check is clear", async () => {
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state: createExpertCareState("en") });
    const response = await request(app()).post("/api/expert-care/research").send({ caseId, specialty: "oncology", question: "Review this treatment", language: "en" }).expect(409);
    expect(response.body.error).toBe("emergency_check_required");
    expect(cases.saveExpertCareEvidence).not.toHaveBeenCalled();
  });

  it("keeps unverified specialist contact blocked", async () => {
    await request(app()).post("/api/expert-care/specialists/candidate-1/contact").send({}).expect(409);
  });

  it("returns stable specialist pages of three from the persisted shortlist", async () => {
    const candidates = Array.from({ length: 7 }, (_, index) => ({ id: `candidate-${index + 1}`, name: `Specialist ${index + 1}`, verificationStatus: "unverified", verificationDetails: [] }));
    const state = attachExpertCareSpecialists(readyState, { candidates: candidates as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    cases.getExpertCareCase.mockResolvedValue({ ...record, state });
    const cursor = Buffer.from("expert-care-specialists:v1:3", "utf8").toString("base64url");
    const response = await request(app()).post("/api/expert-care/specialists").send({ caseId, specialty: "oncology", question: "Review this treatment", location: "Madrid, Spain", language: "en", cursor, limit: 3 }).expect(200);
    expect(response.body.candidates.map((candidate: { id: string }) => candidate.id)).toEqual(["candidate-4", "candidate-5", "candidate-6"]);
    expect(response.body.nextCursor).toEqual(expect.any(String));
    await request(app()).post("/api/expert-care/specialists").send({ caseId, specialty: "oncology", question: "Review this treatment", location: "Madrid, Spain", language: "en", cursor: "invalid", limit: 3 }).expect(400);
  });

  it("requires explicit ownership and retention consent for every record upload", async () => {
    await request(app()).post(`/api/expert-care/cases/${caseId}/documents`).send({
      fileName: "report.pdf",
      mediaType: "application/pdf",
      dataBase64: "JVBERi0xLjQ=",
      ownershipConfirmed: true,
      retentionConsent: false,
    }).expect(400);
    expect(vault.uploadExpertCareDocument).not.toHaveBeenCalled();

    await request(app()).post(`/api/expert-care/cases/${caseId}/documents`).send({
      fileName: "report.pdf",
      mediaType: "application/pdf",
      dataBase64: "JVBERi0xLjQ=",
      ownershipConfirmed: true,
      retentionConsent: true,
    }).expect(201);
    expect(vault.uploadExpertCareDocument).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", caseId, fileName: "report.pdf" }));
  });

  it("fails closed when the malware scanner is unavailable", async () => {
    vault.uploadExpertCareDocument.mockRejectedValueOnce(new vault.ScannerUnavailableError());
    const response = await request(app()).post(`/api/expert-care/cases/${caseId}/documents`).send({
      fileName: "scan.png",
      mediaType: "image/png",
      dataBase64: "iVBORw0KGgo=",
      ownershipConfirmed: true,
      retentionConsent: true,
    }).expect(503);
    expect(response.body.error).toBe("expert_care_malware_scan_unavailable");
  });

  it("updates per-item sharing and supports member deletion", async () => {
    await request(app()).patch(`/api/expert-care/cases/${caseId}/documents/${documentId}/sharing`).send({ approved: true }).expect(200);
    expect(vault.setExpertCareDocumentSharing).toHaveBeenCalledWith({ caseId, documentId, userId: "user-1", approved: true });

    await request(app()).delete(`/api/expert-care/cases/${caseId}/documents/${documentId}`).expect(200);
    expect(vault.deleteExpertCareDocument).toHaveBeenCalledWith(documentId, caseId, "user-1");
  });

  it("applies the paid boundary only to operational verification and record storage", async () => {
    paid.hasTierEntitlement.mockResolvedValueOnce({ allowed: false, tier: "free" });
    const response = await request(app()).post(`/api/expert-care/cases/${caseId}/specialists/verification`).send({ candidateId: "candidate-1" }).expect(403);
    expect(response.body).toMatchObject({ code: "ENTITLEMENT_REQUIRED", nextRoute: "/settings/subscription" });
    await request(app()).get(`/api/expert-care/cases/${caseId}`).expect(200);
  });

  it("never prepares contact for an unverified specialist", async () => {
    const candidate = { id: "candidate-1", name: "Dr Example", verificationStatus: "unverified", verificationDetails: [], contactData: { email: "clinic@example.test", phone: null, website: null } };
    const state = attachExpertCareSpecialists(readyState, { candidates: [candidate as never], contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state });
    const response = await request(app()).post(`/api/expert-care/cases/${caseId}/contact-preparations`).send({ candidateId: "candidate-1", documentIds: [], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please prepare this consultation request for review.", confirmExactSharing: true }).expect(409);
    expect(response.body.error).toBe("specialist_verification_required");
    expect(paid.triggerConciergeAction).not.toHaveBeenCalled();
  });

  it("creates a non-sending Concierge task only after exact sharing consent", async () => {
    const candidate = { id: "candidate-1", name: "Dr Example", verificationStatus: "verified", verificationDetails: ["Verified"], contactData: { email: "clinic@example.test", phone: null, website: null } };
    const state = attachExpertCareSpecialists(readyState, { candidates: [candidate as never], contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state });
    vault.listExpertCareDocuments.mockResolvedValueOnce([{ id: documentId, sharingApproved: true }]);
    const response = await request(app()).post(`/api/expert-care/cases/${caseId}/contact-preparations`).send({ candidateId: "candidate-1", documentIds: [documentId], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please prepare this consultation request for review.", confirmExactSharing: true }).expect(201);
    expect(response.body.externalContactStarted).toBe(false);
    expect(paid.triggerConciergeAction).toHaveBeenCalledWith(expect.objectContaining({ autoStart: false, useCase: "book_appointment", actionPayload: expect.objectContaining({ recipient: "clinic@example.test", document_ids: [documentId] }) }));
  });

  it("does not label an incomplete case consultation-ready", async () => {
    const response = await request(app()).get(`/api/expert-care/cases/${caseId}/consultation-package`).expect(200);
    expect(response.body.consultationReady).toBe(false);
    expect(response.body.blockers).toEqual(expect.arrayContaining(["evidence_brief", "verified_specialist", "sharing_confirmation"]));
    expect(response.body.boundaries).toContain("Trial relevance does not establish eligibility.");
  });

  it("labels a case ready only after evidence understanding, verification, and exact sharing confirmation", async () => {
    let state = attachExpertCareEvidence(readyStateBase, { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [] });
    state = attachExpertCareSpecialists(state, { candidates: [{ id: "candidate-1", name: "Dr Example", verificationStatus: "unverified", verificationDetails: [] }] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    state = acknowledgeExpertCareResearchBoundary(state);
    state = updateExpertCareVerification(state, "candidate-1", "verified", ["All seven checks passed"]);
    state = attachExpertCareContactPreparation(state, { pendingActionId: "pending-1", candidateId: "candidate-1", recipient: "clinic@example.test", documentIds: [], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please prepare this consultation request for final review.", confirmedAt: "2026-10-19T11:00:00.000Z" });
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state });
    const response = await request(app()).get(`/api/expert-care/cases/${caseId}/consultation-package`).expect(200);
    expect(response.body).toMatchObject({ consultationReady: true, blockers: [] });
    expect(safety.recordExpertCareSafetyEvent).toHaveBeenCalledWith(expect.objectContaining({ metric: "consultation_ready" }));
  });

  it("persists an attributable specialist response and emits the response-rate metric", async () => {
    let state = attachExpertCareEvidence(readyStateBase, { items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [] });
    state = attachExpertCareSpecialists(state, { candidates: [{ id: "candidate-1", name: "Dr Example", verificationStatus: "verified", verificationDetails: ["Verified"] }] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    state = acknowledgeExpertCareResearchBoundary(state);
    state = attachExpertCareContactPreparation(state, { pendingActionId: "pending-1", candidateId: "candidate-1", recipient: "clinic@example.test", documentIds: [], healthFields: ["diagnosis_or_recommendation"], channel: "email", message: "Please prepare this consultation request for final review.", confirmedAt: "2026-10-19T11:00:00.000Z" });
    cases.getExpertCareCase.mockResolvedValueOnce({ ...record, state });
    cases.saveExpertCareSpecialistResponse.mockResolvedValueOnce({ ...record, state: { ...state, specialistResponse: { candidateId: "candidate-1", outcome: "accepted", notes: "Appointment offered", receivedAt: "2026-10-19T12:00:00.000Z" } } });
    await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" })).post(`/api/expert-care/cases/${caseId}/specialist-response`).send({ ownerUserId: "user-1", candidateId: "candidate-1", outcome: "accepted", notes: "Appointment offered", receivedAt: "2026-10-19T12:00:00.000Z" }).expect(200);
    expect(cases.saveExpertCareSpecialistResponse).toHaveBeenCalledWith(caseId, "user-1", expect.objectContaining({ outcome: "accepted" }));
    expect(safety.recordExpertCareSafetyEvent).toHaveBeenCalledWith(expect.objectContaining({ metric: "specialist_response", value: 1 }));
  });

  it("stops all case operations when the persistent safety circuit is open", async () => {
    safety.expertCareRuntimeControl.mockResolvedValueOnce({ forceDisabled: true, reason: "privacy_failure", incidentEventId: "event-1", updatedAt: "2026-10-19T12:00:00Z" });
    const response = await request(app()).get(`/api/expert-care/cases/${caseId}`).expect(503);
    expect(response.body).toEqual({ error: "expert_care_safety_pause", reason: "privacy_failure" });
    expect(cases.getExpertCareCase).not.toHaveBeenCalled();
  });

  it("fails closed when production launch evidence is incomplete", async () => {
    readiness.expertCareLaunchReadiness.mockResolvedValueOnce({ ready: false, mode: "limited_pilot", blockers: ["clinical_safety_review"], gates: [], clinicalReview: null });
    const response = await request(app()).get(`/api/expert-care/cases/${caseId}`).expect(503);
    expect(response.body).toEqual({ error: "expert_care_launch_gate_blocked", blockers: ["clinical_safety_review"] });
    expect(cases.getExpertCareCase).not.toHaveBeenCalled();
  });

  it("accepts only fully scoped, append-only clinical safety approvals from an admin", async () => {
    const admin = app({ id: "admin-1", email: "karim.assad@mokadigital.net" });
    const incomplete = { reviewerName: "Independent clinician", policyVersion: "2026-10", verdict: "approved", sourcePolicyReviewed: true, emergencyBoundariesReviewed: true, promptsReviewed: false, sampledOutputsReviewed: true, notes: "The review notes are long enough for the audit record." };
    await request(admin).post("/api/expert-care/clinical-safety-reviews").send(incomplete).expect(400);
    expect(readiness.recordExpertCareClinicalSafetyReview).not.toHaveBeenCalled();

    await request(admin).post("/api/expert-care/clinical-safety-reviews").send({ ...incomplete, promptsReviewed: true }).expect(201);
    expect(readiness.recordExpertCareClinicalSafetyReview).toHaveBeenCalledWith(expect.objectContaining({ reviewerUserId: "admin-1", verdict: "approved", promptsReviewed: true }));
  });

  it("exposes the verification queue only to Expert Care operations admins", async () => {
    await request(app()).get("/api/expert-care/verification-queue").expect(403);
    cases.listExpertCareVerificationQueue.mockResolvedValueOnce([{ caseId, ownerUserId: "user-1", candidate: { id: "candidate-1", name: "Dr Example" }, requestedAt: "2026-10-19T10:00:00Z", caseContext: { specialty: "oncology", location: "Madrid", languages: ["en"] } }]);
    const response = await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" })).get("/api/expert-care/verification-queue?limit=25").expect(200);
    expect(response.body.items[0]).toMatchObject({ caseId, candidate: { id: "candidate-1" } });
    expect(cases.listExpertCareVerificationQueue).toHaveBeenCalledWith(25);
  });

  it("exposes prepared coordination work only to Expert Care operations admins", async () => {
    await request(app()).get("/api/expert-care/coordination-queue").expect(403);
    cases.listExpertCareCoordinationQueue.mockResolvedValueOnce([{ caseId, ownerUserId: "user-1", candidate: { id: "candidate-1", name: "Dr Example" }, preparation: { pendingActionId: "pending-1" } }]);
    const response = await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" })).get("/api/expert-care/coordination-queue?limit=10").expect(200);
    expect(response.body.items[0]).toMatchObject({ preparation: { pendingActionId: "pending-1" } });
    expect(cases.listExpertCareCoordinationQueue).toHaveBeenCalledWith(10);
  });

  it("requires and persists authoritative profile facts when verification succeeds", async () => {
    const verifiedProfile = {
      institution: "Reference Hospital", country: "Spain", address: "Madrid", languages: ["English", "Spanish"], remoteCareRegions: ["Spain", "EU"],
      expertiseEvidence: ["Active specialist registration confirmed"], contactData: { website: "https://hospital.example.test", phone: null, email: "clinic@example.test" },
      availability: "Remote consultations available", timezone: "Europe/Madrid", estimatedCost: "€250",
    };
    const base = { ownerUserId: "user-1", status: "verified", details: ["All facts confirmed from the medical register"], identityConfirmed: true, licenseConfirmed: true, subspecialtyConfirmed: true, institutionConfirmed: true, languagesConfirmed: true, remoteRegionsConfirmed: true, contactRouteConfirmed: true };
    await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" }))
      .patch(`/api/expert-care/cases/${caseId}/specialists/candidate-1/verification`)
      .send(base)
      .expect(400);
    await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" }))
      .patch(`/api/expert-care/cases/${caseId}/specialists/candidate-1/verification`)
      .send({ ...base, verifiedProfile })
      .expect(200);
    expect(cases.saveExpertCareVerification).toHaveBeenCalledWith(caseId, "user-1", "candidate-1", "verified", base.details, verifiedProfile);
  });

  it("returns other non-failed candidates when verification cannot be completed", async () => {
    const failed = { id: "candidate-1", name: "Failed candidate", verificationStatus: "failed" };
    const alternative = { id: "candidate-2", name: "Alternative candidate", verificationStatus: "unverified" };
    const state = attachExpertCareSpecialists(readyState, { candidates: [failed, alternative] as never, contactBlockedUntilVerified: true, retrievedAt: "2026-10-19T10:00:00.000Z" });
    cases.saveExpertCareVerification.mockResolvedValueOnce({ ...record, state });
    const response = await request(app({ id: "admin-1", email: "karim.assad@mokadigital.net" }))
      .patch(`/api/expert-care/cases/${caseId}/specialists/candidate-1/verification`)
      .send({ ownerUserId: "user-1", status: "failed", details: ["License could not be confirmed"], identityConfirmed: true, licenseConfirmed: false, subspecialtyConfirmed: true, institutionConfirmed: true, languagesConfirmed: true, remoteRegionsConfirmed: true, contactRouteConfirmed: false })
      .expect(200);
    expect(response.body.externalContactStarted).toBe(false);
    expect(response.body.safeAlternatives).toEqual([alternative]);
  });

  it("records a critical rollback event when an unsupported generated claim is rejected", async () => {
    research.researchExpertCareEvidence.mockResolvedValueOnce({ items: [], retrievedAt: "2026-10-19T10:00:00.000Z", educationalOnly: true, unavailableSources: [], safetyRejectedCount: 1, safetyRejectionReasons: ["personalized_clinical_claim"] });
    await request(app()).post("/api/expert-care/research").send({ caseId, specialty: "oncology", question: "Review this treatment", language: "en" }).expect(200);
    expect(safety.recordExpertCareSafetyEvent).toHaveBeenCalledWith(expect.objectContaining({ metric: "unsupported_claim_detected", severity: "critical", value: 1 }));
  });
});
