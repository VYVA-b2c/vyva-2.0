import { Router, type Response } from "express";
import { z } from "zod";
import {
  expertCareResearchRequestSchema,
  expertCareContactPreparationSchema,
  expertCareSpecialistRequestSchema,
  expertCareVerificationRequestSchema,
  expertCareVerificationResolutionSchema,
  type ExpertCareSpecialistResponse,
  type ExpertCareConsultationPackage,
  type SpecialistCandidate,
} from "../../shared/expertCare.js";
import { discoverAppointmentProviderOptions } from "../services/appointmentDiscovery.js";
import { researchExpertCareEvidence } from "../services/expertCareResearch.js";
import {
  createExpertCareCase,
  ExpertCareCaseConflictError,
  ExpertCareCaseNotFoundError,
  getExpertCareCase,
  importLegacyCareFinderCase,
  listExpertCareVerificationQueue,
  listExpertCareCoordinationQueue,
  LegacyCareFinderUnavailableError,
  saveExpertCareEvidence,
  saveExpertCareResearchAcknowledgement,
  saveExpertCareContactPreparation,
  saveExpertCareSpecialists,
  saveExpertCareSpecialistResponse,
  saveExpertCareVerification,
  updateExpertCareCase,
} from "../services/expertCareCases.js";
import { updateExpertCareCaseSchema } from "../../shared/expertCareState.js";
import { expertCareDocumentSharingSchema, expertCareDocumentUploadSchema } from "../../shared/expertCareVault.js";
import {
  deleteExpertCareDocument,
  downloadExpertCareDocument,
  ExpertCareDocumentDuplicateError,
  ExpertCareDocumentNotFoundError,
  ExpertCareDocumentRejectedError,
  ExpertCareMalwareScannerUnavailableError,
  ExpertCareVaultPermissionError,
  listExpertCareDocuments,
  listExpertCareVaultAudit,
  setExpertCareDocumentSharing,
  uploadExpertCareDocument,
} from "../services/expertCareVault.js";
import { hasTierEntitlement } from "../middleware/entitlements.js";
import { triggerConciergeAction } from "../services/conciergeActions.js";
import { resolveExpertCareFeatureFlag } from "../lib/expertCareFeatureFlag.js";
import {
  clearExpertCareSafetyRollback,
  expertCareMetricSummary,
  expertCareRuntimeControl,
  EXPERT_CARE_METRICS,
  recordExpertCareSafetyEvent,
} from "../services/expertCareSafety.js";
import {
  expertCareLaunchReadiness,
  recordExpertCareClinicalSafetyReview,
} from "../services/expertCareLaunchReadiness.js";

const router = Router();
const SUPER_ADMIN_EMAIL = (process.env.SUPER_ADMIN_EMAIL ?? "karim.assad@mokadigital.net").toLowerCase();
const uuidSchema = z.string().uuid();
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const specialistCursor = (offset: number) => Buffer.from(`expert-care-specialists:v1:${offset}`, "utf8").toString("base64url");
const specialistOffset = (cursor: string) => {
  try {
    const match = /^expert-care-specialists:v1:(\d+)$/.exec(Buffer.from(cursor, "base64url").toString("utf8"));
    return match ? Number(match[1]) : null;
  } catch { return null; }
};
const specialistPage = (candidates: SpecialistCandidate[], offset: number, limit: number, retrievedAt: string): ExpertCareSpecialistResponse => ({
  candidates: candidates.slice(offset, offset + limit),
  contactBlockedUntilVerified: true,
  retrievedAt,
  nextCursor: offset + limit < candidates.length ? specialistCursor(offset + limit) : null,
});

function caseError(res: Response, error: unknown) {
  if (error instanceof ExpertCareCaseNotFoundError) return res.status(404).json({ error: "expert_care_case_not_found" });
  if (error instanceof ExpertCareCaseConflictError) return res.status(409).json({ error: "expert_care_case_conflict", case: error.current });
  if (error instanceof LegacyCareFinderUnavailableError) return res.status(410).json({ error: "legacy_care_finder_unavailable" });
  console.error("[expert-care/cases]", error);
  return res.status(500).json({ error: "expert_care_case_unavailable" });
}

function vaultError(res: Response, error: unknown) {
  if (error instanceof ExpertCareVaultPermissionError) return res.status(403).json({ error: "expert_care_document_permission_required" });
  if (error instanceof ExpertCareDocumentNotFoundError) return res.status(404).json({ error: "expert_care_document_not_found" });
  if (error instanceof ExpertCareDocumentDuplicateError) return res.status(409).json({ error: "expert_care_document_duplicate" });
  if (error instanceof ExpertCareDocumentRejectedError) return res.status(422).json({ error: "expert_care_document_rejected" });
  if (error instanceof ExpertCareMalwareScannerUnavailableError) return res.status(503).json({ error: "expert_care_malware_scan_unavailable" });
  if (error instanceof ExpertCareCaseNotFoundError) return caseError(res, error);
  console.error("[expert-care/vault]", error);
  return res.status(500).json({ error: "expert_care_vault_unavailable" });
}

async function requireExpertCarePaidService(userId: string, res: Response) {
  const entitlement = await hasTierEntitlement(userId, "concierge");
  if (entitlement.allowed) return true;
  res.status(403).json({ error: "expert_care_paid_service_required", code: "ENTITLEMENT_REQUIRED", nextRoute: "/settings/subscription" });
  return false;
}

const safetyEventSchema = z.object({
  metric: z.enum(EXPERT_CARE_METRICS),
  severity: z.enum(["info", "warning", "critical"]),
  caseId: z.string().uuid().nullable().optional(),
  value: z.number().finite().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

const clinicalSafetyReviewSchema = z.object({
  reviewerName: z.string().trim().min(3).max(160),
  policyVersion: z.string().trim().min(1).max(100),
  verdict: z.enum(["approved", "rejected"]),
  sourcePolicyReviewed: z.boolean(),
  emergencyBoundariesReviewed: z.boolean(),
  promptsReviewed: z.boolean(),
  sampledOutputsReviewed: z.boolean(),
  notes: z.string().trim().min(20).max(4000),
  validUntil: z.string().datetime().nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.verdict === "approved" && !(
    value.sourcePolicyReviewed && value.emergencyBoundariesReviewed
    && value.promptsReviewed && value.sampledOutputsReviewed
  )) context.addIssue({ code: "custom", message: "approved_review_requires_complete_scope" });
});

const researchAcknowledgementSchema = z.object({
  educationalOnlyAcknowledged: z.literal(true),
  uncertaintyAcknowledged: z.literal(true),
}).strict();

const specialistResponseSchema = z.object({
  ownerUserId: z.string().trim().min(1).max(200),
  candidateId: z.string().trim().min(1).max(240),
  outcome: z.enum(["accepted", "declined", "no_response"]),
  notes: z.string().trim().max(1000).nullable().optional(),
  receivedAt: z.string().datetime(),
}).strict();

const isExpertCareAdmin = (email: string | null | undefined) => (email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;

router.get("/availability", async (req, res) => {
  const flag = resolveExpertCareFeatureFlag({ userId: req.user!.id, email: req.user!.email });
  try {
    const [circuit, readiness] = await Promise.all([expertCareRuntimeControl(), expertCareLaunchReadiness(flag.mode)]);
    return res.json({
      ...flag,
      enabled: flag.enabled && !circuit.forceDisabled && readiness.ready,
      runtimeDisabled: circuit.forceDisabled,
      launchReady: readiness.ready,
      launchBlockers: readiness.blockers,
      reason: circuit.reason ?? (!readiness.ready ? "launch_readiness_required" : flag.reason),
    });
  } catch (error) {
    console.error("[expert-care/readiness]", error);
    return res.status(503).json({ enabled: false, mode: flag.mode, reason: "launch_readiness_unavailable" });
  }
});

router.get("/launch-readiness", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const flag = resolveExpertCareFeatureFlag({ userId: req.user!.id, email: req.user!.email });
  try { return res.json(await expertCareLaunchReadiness(flag.mode)); }
  catch (error) { console.error("[expert-care/readiness]", error); return res.status(503).json({ error: "launch_readiness_unavailable" }); }
});

router.post("/clinical-safety-reviews", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const body = clinicalSafetyReviewSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_clinical_safety_review" });
  try {
    return res.status(201).json({ review: await recordExpertCareClinicalSafetyReview({ reviewerUserId: req.user!.id, ...body.data }) });
  } catch (error) {
    console.error("[expert-care/clinical-safety-review]", error);
    return res.status(503).json({ error: "clinical_safety_review_unavailable" });
  }
});

router.get("/verification-queue", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
  try { return res.json({ items: await listExpertCareVerificationQueue(limit) }); }
  catch (error) { console.error("[expert-care/verification-queue]", error); return res.status(503).json({ error: "verification_queue_unavailable" }); }
});

router.get("/coordination-queue", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const limit = z.coerce.number().int().min(1).max(200).catch(50).parse(req.query.limit);
  try { return res.json({ items: await listExpertCareCoordinationQueue(limit) }); }
  catch (error) { console.error("[expert-care/coordination-queue]", error); return res.status(503).json({ error: "coordination_queue_unavailable" }); }
});

router.post("/cases/:caseId/specialist-response", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = specialistResponseSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_specialist_response" });
  try {
    const current = await getExpertCareCase(caseId.data, body.data.ownerUserId);
    if (!current.state.contactPreparation || current.state.contactPreparation.candidateId !== body.data.candidateId) return res.status(409).json({ error: "contact_preparation_required" });
    const updated = await saveExpertCareSpecialistResponse(caseId.data, body.data.ownerUserId, { candidateId: body.data.candidateId, outcome: body.data.outcome, notes: body.data.notes ?? null, receivedAt: body.data.receivedAt });
    void recordExpertCareSafetyEvent({ metric: "specialist_response", caseId: caseId.data, userId: body.data.ownerUserId, value: body.data.outcome === "accepted" ? 1 : 0, metadata: { candidateId: body.data.candidateId, outcome: body.data.outcome } }).catch((error) => console.error("[expert-care/metrics]", error));
    return res.json({ case: updated });
  } catch (error) { return caseError(res, error); }
});

router.post("/safety-events", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const body = safetyEventSchema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "invalid_safety_event" });
  try {
    return res.status(201).json(await recordExpertCareSafetyEvent({ ...body.data, userId: req.user!.id }));
  } catch (error) {
    console.error("[expert-care/safety-events]", error);
    return res.status(503).json({ error: "safety_event_unavailable" });
  }
});

router.get("/safety-metrics", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const hours = z.coerce.number().int().min(1).max(8760).catch(168).parse(req.query.hours);
  try { return res.json({ metrics: await expertCareMetricSummary(hours), runtime: await expertCareRuntimeControl() }); }
  catch (error) { console.error("[expert-care/safety-metrics]", error); return res.status(503).json({ error: "safety_metrics_unavailable" }); }
});

router.post("/safety-rollback/clear", async (req, res) => {
  if (!isExpertCareAdmin(req.user?.email)) return res.status(403).json({ error: "admin_required" });
  const body = z.object({ reason: z.string().trim().min(10).max(500) }).strict().safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "review_reason_required" });
  try { return res.json({ runtime: await clearExpertCareSafetyRollback({ adminUserId: req.user!.id, reason: body.data.reason }) }); }
  catch (error) { console.error("[expert-care/safety-rollback]", error); return res.status(503).json({ error: "safety_rollback_unavailable" }); }
});

router.use(async (req, res, next) => {
  const flag = resolveExpertCareFeatureFlag({ userId: req.user!.id, email: req.user!.email });
  if (!flag.enabled) return res.status(404).json({ error: "expert_care_unavailable", releaseMode: flag.mode });
  try {
    const [circuit, readiness] = await Promise.all([expertCareRuntimeControl(), expertCareLaunchReadiness(flag.mode)]);
    if (circuit.forceDisabled) return res.status(503).json({ error: "expert_care_safety_pause", reason: circuit.reason });
    if (!readiness.ready) return res.status(503).json({ error: "expert_care_launch_gate_blocked", blockers: readiness.blockers });
    next();
  } catch (error) {
    console.error("[expert-care/readiness]", error);
    return res.status(503).json({ error: "expert_care_launch_readiness_unavailable" });
  }
});

router.post("/cases", async (req, res) => {
  const language = req.body?.language === "es" ? "es" : "en";
  try {
    return res.status(201).json({ case: await createExpertCareCase({ userId: req.user!.id, language }) });
  } catch (error) {
    return caseError(res, error);
  }
});

router.get("/cases/:caseId", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  if (!caseId.success) return res.status(400).json({ error: "invalid_case_id" });
  try {
    return res.json({ case: await getExpertCareCase(caseId.data, req.user!.id) });
  } catch (error) {
    return caseError(res, error);
  }
});

router.patch("/cases/:caseId", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = updateExpertCareCaseSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_case_update" });
  try {
    const updated = await updateExpertCareCase({ id: caseId.data, userId: req.user!.id, ...body.data });
    if (body.data.patch.emergencyResult === "urgent_stop") void recordExpertCareSafetyEvent({ metric: "emergency_handoff", caseId: caseId.data, userId: req.user!.id, value: 1 }).catch((error) => console.error("[expert-care/metrics]", error));
    return res.json({ case: updated });
  } catch (error) {
    return caseError(res, error);
  }
});

router.post("/cases/:caseId/research-acknowledgement", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = researchAcknowledgementSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_research_acknowledgement" });
  try {
    const record = await getExpertCareCase(caseId.data, req.user!.id);
    if (!record.state.evidence) return res.status(409).json({ error: "evidence_brief_required" });
    const updated = await saveExpertCareResearchAcknowledgement(caseId.data, req.user!.id);
    void recordExpertCareSafetyEvent({ metric: "user_comprehension", caseId: caseId.data, userId: req.user!.id, value: 1, metadata: body.data }).catch((error) => console.error("[expert-care/metrics]", error));
    return res.json({ case: updated });
  } catch (error) {
    return caseError(res, error);
  }
});

router.post("/cases/import/:legacyTaskId", async (req, res) => {
  const legacyTaskId = uuidSchema.safeParse(req.params.legacyTaskId);
  if (!legacyTaskId.success) return res.status(400).json({ error: "invalid_legacy_task_id" });
  const language = req.body?.language === "es" ? "es" : "en";
  try {
    return res.status(201).json({ case: await importLegacyCareFinderCase(legacyTaskId.data, req.user!.id, language) });
  } catch (error) {
    return caseError(res, error);
  }
});

router.get("/cases/:caseId/documents", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  if (!caseId.success) return res.status(400).json({ error: "invalid_case_id" });
  try {
    return res.json({ documents: await listExpertCareDocuments(caseId.data, req.user!.id) });
  } catch (error) {
    return vaultError(res, error);
  }
});

router.post("/cases/:caseId/documents", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = expertCareDocumentUploadSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_document_upload" });
  try {
    if (!await requireExpertCarePaidService(req.user!.id, res)) return;
    const document = await uploadExpertCareDocument({ userId: req.user!.id, caseId: caseId.data, fileName: body.data.fileName, mediaType: body.data.mediaType, dataBase64: body.data.dataBase64 });
    return res.status(201).json({ document });
  } catch (error) {
    return vaultError(res, error);
  }
});

router.get("/cases/:caseId/documents/:documentId/content", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const documentId = uuidSchema.safeParse(req.params.documentId);
  if (!caseId.success || !documentId.success) return res.status(400).json({ error: "invalid_document_id" });
  try {
    return res.json(await downloadExpertCareDocument(documentId.data, caseId.data, req.user!.id));
  } catch (error) {
    return vaultError(res, error);
  }
});

router.patch("/cases/:caseId/documents/:documentId/sharing", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const documentId = uuidSchema.safeParse(req.params.documentId);
  const body = expertCareDocumentSharingSchema.safeParse(req.body);
  if (!caseId.success || !documentId.success || !body.success) return res.status(400).json({ error: "invalid_document_sharing_update" });
  try {
    return res.json({ document: await setExpertCareDocumentSharing({ caseId: caseId.data, documentId: documentId.data, userId: req.user!.id, approved: body.data.approved }) });
  } catch (error) {
    return vaultError(res, error);
  }
});

router.delete("/cases/:caseId/documents/:documentId", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const documentId = uuidSchema.safeParse(req.params.documentId);
  if (!caseId.success || !documentId.success) return res.status(400).json({ error: "invalid_document_id" });
  try {
    await deleteExpertCareDocument(documentId.data, caseId.data, req.user!.id);
    return res.json({ deleted: true });
  } catch (error) {
    return vaultError(res, error);
  }
});

router.get("/cases/:caseId/vault-audit", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  if (!caseId.success) return res.status(400).json({ error: "invalid_case_id" });
  try {
    return res.json({ events: await listExpertCareVaultAudit(caseId.data, req.user!.id) });
  } catch (error) {
    return vaultError(res, error);
  }
});

router.get("/cases/:caseId/consultation-package", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  if (!caseId.success) return res.status(400).json({ error: "invalid_case_id" });
  try {
    const record = await getExpertCareCase(caseId.data, req.user!.id);
    const documents = await listExpertCareDocuments(caseId.data, req.user!.id);
    const verifiedSpecialists = record.state.specialists?.result.candidates.filter((candidate) => candidate.verificationStatus === "verified") ?? [];
    const blockers: ExpertCareConsultationPackage["blockers"] = [];
    if (record.state.context.emergencyResult !== "clear") blockers.push("emergency_check");
    if (!record.state.context.person || (record.state.context.person === "trusted_helper" && !record.state.context.authorityConfirmedAt)) blockers.push("permission");
    if (!record.state.context.specialty || !record.state.context.diagnosisOrRecommendation) blockers.push("clinical_context");
    if (!record.state.evidence) blockers.push("evidence_brief");
    if (!record.state.consent.research) blockers.push("educational_boundary_acknowledgement");
    if (verifiedSpecialists.length === 0) blockers.push("verified_specialist");
    if (!record.state.contactPreparation || !record.state.consent.sharing) blockers.push("sharing_confirmation");
    const result: ExpertCareConsultationPackage = {
      caseId: record.id,
      generatedAt: new Date().toISOString(),
      consultationReady: blockers.length === 0,
      blockers,
      context: {
        goal: record.state.context.goal,
        specialty: record.state.context.specialty,
        diagnosisOrRecommendation: record.state.context.diagnosisOrRecommendation,
        currentTreatment: record.state.context.currentTreatment,
        concerns: record.state.context.concerns,
        location: record.state.context.location,
        languages: record.state.context.languages,
      },
      evidence: record.state.evidence?.result ?? null,
      verifiedSpecialists,
      preparedQuestions: [...new Set(record.state.evidence?.result.items.map((item) => item.askTheSpecialist).filter(Boolean) ?? [])],
      records: documents.map((document) => ({ id: document.id, fileName: document.fileName, sharingApproved: document.sharingApproved, ocrStatus: document.ocrStatus })),
      contactPreparation: record.state.contactPreparation,
      specialistResponse: record.state.specialistResponse,
      boundaries: [
        "Educational information only; this package is not a diagnosis or treatment recommendation.",
        "Do not stop or change medication without the treating clinician.",
        "Trial relevance does not establish eligibility.",
        "No external contact occurs until the Concierge action receives final confirmation.",
      ],
    };
    if (result.consultationReady) {
      const startedAt = new Date(record.createdAt).getTime();
      const hours = Number.isFinite(startedAt) ? (Date.now() - startedAt) / 3_600_000 : null;
      void recordExpertCareSafetyEvent({ metric: "consultation_ready", caseId: caseId.data, userId: req.user!.id, value: hours, metadata: { verifiedSpecialists: verifiedSpecialists.length } }).catch((error) => console.error("[expert-care/metrics]", error));
    }
    return res.json(result);
  } catch (error) {
    if (error instanceof ExpertCareCaseNotFoundError || error instanceof ExpertCareCaseConflictError) return caseError(res, error);
    return vaultError(res, error);
  }
});

router.post("/cases/:caseId/specialists/verification", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = expertCareVerificationRequestSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_verification_request" });
  try {
    if (!await requireExpertCarePaidService(req.user!.id, res)) return;
    const record = await getExpertCareCase(caseId.data, req.user!.id);
    if (!record.state.consent.research) return res.status(409).json({ error: "educational_boundary_acknowledgement_required" });
    const candidate = record.state.specialists?.result.candidates.find((item) => item.id === body.data.candidateId);
    if (!candidate) return res.status(404).json({ error: "specialist_candidate_not_found" });
    if (candidate.verificationStatus === "verified") return res.json({ case: record, alreadyVerified: true });
    const task = await triggerConciergeAction({
      userId: req.user!.id,
      useCase: "find_provider",
      providerName: candidate.name,
      foundExternally: true,
      actionSummary: `Verify specialist identity and consultation logistics for ${candidate.name}`,
      actionPayload: {
        expert_care_case_id: caseId.data,
        specialist_candidate_id: candidate.id,
        directory_sources: candidate.directorySources,
        verification_checklist: ["identity", "license", "subspecialty", "institution", "languages", "remote_care_countries", "contact_route"],
        external_contact_blocked: true,
      },
      language: record.state.context.languages[0] ?? "en",
      triggerSource: "user_request",
      autoStart: false,
    });
    const updated = await saveExpertCareVerification(caseId.data, req.user!.id, candidate.id, "verification_pending", ["VYVA verification requested", `Task ${task.pendingId}`]);
    return res.status(202).json({ case: updated, verificationTaskId: task.pendingId });
  } catch (error) {
    if (error instanceof ExpertCareCaseNotFoundError || error instanceof ExpertCareCaseConflictError) return caseError(res, error);
    console.error("[expert-care/verification]", error);
    return res.status(503).json({ error: "specialist_verification_unavailable" });
  }
});

router.patch("/cases/:caseId/specialists/:candidateId/verification", async (req, res) => {
  if ((req.user?.email ?? "").toLowerCase() !== SUPER_ADMIN_EMAIL) return res.status(403).json({ error: "admin_required" });
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const ownerUserId = z.string().trim().min(1).max(200).safeParse(req.body?.ownerUserId);
  const { ownerUserId: _ownerUserId, ...resolution } = req.body && typeof req.body === "object" ? req.body : {};
  const body = expertCareVerificationResolutionSchema.safeParse(resolution);
  if (!caseId.success || !ownerUserId.success || !body.success) return res.status(400).json({ error: "invalid_verification_resolution" });
  const allChecksPassed = body.data.identityConfirmed && body.data.licenseConfirmed && body.data.subspecialtyConfirmed
    && body.data.institutionConfirmed && body.data.languagesConfirmed && body.data.remoteRegionsConfirmed && body.data.contactRouteConfirmed;
  if (body.data.status === "verified" && !allChecksPassed) return res.status(409).json({ error: "verification_checklist_incomplete" });
  try {
    const updated = await saveExpertCareVerification(
      caseId.data,
      ownerUserId.data,
      req.params.candidateId,
      body.data.status,
      body.data.details,
      body.data.status === "verified" ? body.data.verifiedProfile : undefined,
    );
    if (body.data.status === "failed") void recordExpertCareSafetyEvent({ metric: "verification_failed", caseId: caseId.data, userId: ownerUserId.data, value: 1, metadata: { candidateId: req.params.candidateId, details: body.data.details } }).catch((error) => console.error("[expert-care/metrics]", error));
    const safeAlternatives = body.data.status === "failed"
      ? updated.state.specialists?.result.candidates.filter((candidate) => candidate.id !== req.params.candidateId && candidate.verificationStatus !== "failed").slice(0, 3) ?? []
      : [];
    return res.json({ case: updated, safeAlternatives, externalContactStarted: false });
  } catch (error) {
    return caseError(res, error);
  }
});

router.post("/cases/:caseId/contact-preparations", async (req, res) => {
  const caseId = uuidSchema.safeParse(req.params.caseId);
  const body = expertCareContactPreparationSchema.safeParse(req.body);
  if (!caseId.success || !body.success) return res.status(400).json({ error: "invalid_contact_preparation" });
  try {
    if (!await requireExpertCarePaidService(req.user!.id, res)) return;
    const record = await getExpertCareCase(caseId.data, req.user!.id);
    if (record.state.context.emergencyResult !== "clear") return res.status(409).json({ error: "emergency_check_required" });
    if (!record.state.consent.research) return res.status(409).json({ error: "educational_boundary_acknowledgement_required" });
    const candidate = record.state.specialists?.result.candidates.find((item) => item.id === body.data.candidateId);
    if (!candidate) return res.status(404).json({ error: "specialist_candidate_not_found" });
    if (candidate.verificationStatus !== "verified") return res.status(409).json({ error: "specialist_verification_required" });
    const documents = await listExpertCareDocuments(caseId.data, req.user!.id);
    const selected = body.data.documentIds.map((id) => documents.find((document) => document.id === id));
    if (selected.some((document) => !document || !document.sharingApproved)) return res.status(409).json({ error: "document_sharing_approval_required" });
    const recipient = body.data.channel === "email" ? candidate.contactData.email
      : body.data.channel === "phone" ? candidate.contactData.phone
        : body.data.channel === "website" ? candidate.contactData.website
          : "VYVA operations";
    if (!recipient) return res.status(409).json({ error: "verified_contact_route_unavailable" });
    const task = await triggerConciergeAction({
      userId: req.user!.id,
      useCase: "book_appointment",
      providerName: candidate.name,
      providerPhone: body.data.channel === "phone" ? recipient : null,
      foundExternally: true,
      actionSummary: `Prepare an Expert Care consultation request for ${candidate.name}`,
      actionPayload: {
        expert_care_case_id: caseId.data,
        specialist_candidate_id: candidate.id,
        recipient,
        channel: body.data.channel,
        document_ids: body.data.documentIds,
        health_fields: body.data.healthFields,
        message: body.data.message,
        itemized_sharing_confirmed_at: new Date().toISOString(),
        external_contact_blocked_until_final_confirmation: true,
      },
      language: record.state.context.languages[0] ?? "en",
      triggerSource: "user_request",
      autoStart: false,
    });
    const confirmedAt = new Date().toISOString();
    const updated = await saveExpertCareContactPreparation(caseId.data, req.user!.id, {
      pendingActionId: task.pendingId,
      candidateId: candidate.id,
      recipient,
      documentIds: body.data.documentIds,
      healthFields: body.data.healthFields,
      channel: body.data.channel,
      message: body.data.message,
      confirmedAt,
    });
    void recordExpertCareSafetyEvent({ metric: "sharing_consent", caseId: caseId.data, userId: req.user!.id, value: 1, metadata: { candidateId: candidate.id, documentCount: body.data.documentIds.length, healthFields: body.data.healthFields, channel: body.data.channel } }).catch((error) => console.error("[expert-care/metrics]", error));
    return res.status(201).json({ case: updated, pendingActionId: task.pendingId, externalContactStarted: false });
  } catch (error) {
    if (error instanceof ExpertCareCaseNotFoundError || error instanceof ExpertCareCaseConflictError) return caseError(res, error);
    console.error("[expert-care/contact-preparation]", error);
    return res.status(503).json({ error: "contact_preparation_unavailable" });
  }
});

router.post("/research", async (req, res) => {
  const parsed = expertCareResearchRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  try {
    let additionalContext = "";
    if (parsed.data.caseId) {
      const record = await getExpertCareCase(parsed.data.caseId, req.user!.id);
      if (record.state.context.emergencyResult !== "clear") return res.status(409).json({ error: "emergency_check_required" });
      if (record.state.context.specialty !== parsed.data.specialty
        || record.state.context.diagnosisOrRecommendation !== parsed.data.question.trim()) {
        return res.status(409).json({ error: "expert_care_context_mismatch" });
      }
      additionalContext = [record.state.context.currentTreatment, record.state.context.concerns].filter(Boolean).join(" ");
    }
    const query = `${parsed.data.specialty} ${parsed.data.question} ${additionalContext}`.trim();
    const result = await researchExpertCareEvidence(query, parsed.data.language);
    if ((result.safetyRejectedCount ?? 0) > 0) {
      await recordExpertCareSafetyEvent({
        metric: "unsupported_claim_detected",
        severity: "critical",
        caseId: parsed.data.caseId ?? null,
        userId: req.user!.id,
        value: result.safetyRejectedCount,
        metadata: { reasons: result.safetyRejectionReasons ?? [] },
      });
    }
    const citationCoverage = result.items.length === 0 ? 1 : result.items.filter((item) => item.citations.length > 0).length / result.items.length;
    const freshCoverage = result.items.length === 0 ? 1 : result.items.filter((item) => item.freshnessStatus === "current").length / result.items.length;
    void Promise.all([
      recordExpertCareSafetyEvent({ metric: "research_generated", caseId: parsed.data.caseId ?? null, userId: req.user!.id, value: result.items.length, metadata: { unavailableSources: result.unavailableSources } }),
      recordExpertCareSafetyEvent({ metric: "citation_coverage", caseId: parsed.data.caseId ?? null, userId: req.user!.id, value: citationCoverage }),
      recordExpertCareSafetyEvent({ metric: "source_freshness", caseId: parsed.data.caseId ?? null, userId: req.user!.id, value: freshCoverage }),
    ]).catch((error) => console.error("[expert-care/metrics]", error));
    if (parsed.data.caseId) await saveExpertCareEvidence(parsed.data.caseId, req.user!.id, result);
    return res.json(result);
  } catch (error) {
    if (error instanceof ExpertCareCaseNotFoundError || error instanceof ExpertCareCaseConflictError) return caseError(res, error);
    console.error("[expert-care/research]", error);
    return res.status(503).json({ error: "research_unavailable" });
  }
});

router.post("/specialists", async (req, res) => {
  const parsed = expertCareSpecialistRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "invalid_request" });
  try {
    const record = parsed.data.caseId ? await getExpertCareCase(parsed.data.caseId, req.user!.id) : null;
    if (record) {
      if (record.state.context.emergencyResult !== "clear") return res.status(409).json({ error: "emergency_check_required" });
      if (record.state.context.specialty !== parsed.data.specialty
        || record.state.context.diagnosisOrRecommendation !== parsed.data.question.trim()
        || record.state.context.location !== parsed.data.location.trim()) {
        return res.status(409).json({ error: "expert_care_context_mismatch" });
      }
    }
    if (parsed.data.cursor) {
      if (!record?.state.specialists) return res.status(409).json({ error: "specialist_search_required" });
      const offset = specialistOffset(parsed.data.cursor);
      if (offset === null || offset < 1 || offset >= record.state.specialists.result.candidates.length) return res.status(400).json({ error: "invalid_specialist_cursor" });
      return res.json(specialistPage(record.state.specialists.result.candidates, offset, parsed.data.limit, record.state.specialists.result.retrievedAt));
    }
    const result = await discoverAppointmentProviderOptions({
      appointmentType: "medical",
      detail: `${parsed.data.specialty} specialist second opinion ${parsed.data.question}`,
      location: { address: parsed.data.location },
      language: parsed.data.language,
      maxResults: 9,
    });
    const candidates: SpecialistCandidate[] = result.options.map((option, index) => {
      const snapshot = option.provider_snapshot;
      return {
        id: option.id || `candidate-${index + 1}`,
        name: text(snapshot.name) ?? "Specialist candidate",
        specialty: parsed.data.specialty,
        institution: text(snapshot.institution),
        country: text(snapshot.country_code),
        address: text(snapshot.address),
        distanceMeters: number(snapshot.distance_meters),
        openingStatus: text(snapshot.opening_status),
        todayOpeningHours: text(snapshot.today_opening_hours),
        languages: [],
        remoteCareRegions: [],
        websiteUrl: text(snapshot.website_url),
        mapsUrl: text(snapshot.maps_url),
        rating: number(snapshot.rating),
        reviewCount: number(snapshot.review_count),
        ratingProvenance: number(snapshot.rating) !== null ? text(snapshot.source_label) : null,
        expertiseEvidence: [],
        directorySources: [{
          label: text(snapshot.source_label) ?? "Open directory result",
          url: text(snapshot.website_url) ?? text(snapshot.maps_url),
        }],
        contactData: {
          website: text(snapshot.website_url),
          phone: null,
          email: null,
        },
        availability: null,
        timezone: null,
        estimatedCost: null,
        verificationStatus: "unverified",
        verificationDetails: [],
        sourceLabel: text(snapshot.source_label) ?? "Open directory result",
      };
    });
    const retrievedAt = new Date().toISOString();
    const completeResult: ExpertCareSpecialistResponse = { candidates, contactBlockedUntilVerified: true, retrievedAt, nextCursor: null };
    if (parsed.data.caseId) await saveExpertCareSpecialists(parsed.data.caseId, req.user!.id, completeResult);
    return res.json(specialistPage(candidates, 0, parsed.data.limit, retrievedAt));
  } catch (error) {
    if (error instanceof ExpertCareCaseNotFoundError || error instanceof ExpertCareCaseConflictError) return caseError(res, error);
    console.error("[expert-care/specialists]", error);
    return res.status(503).json({ error: "specialist_search_unavailable" });
  }
});

router.post("/specialists/:candidateId/contact", (_req, res) => {
  return res.status(409).json({ error: "specialist_verification_required" });
});

export default router;
