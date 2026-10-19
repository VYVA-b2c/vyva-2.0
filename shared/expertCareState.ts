import { z } from "zod";
import {
  EXPERT_CARE_GOALS,
  EXPERT_CARE_SPECIALTIES,
  type ExpertCareGoal,
  type ExpertCareContactPreparation,
  type ExpertCareResearchResponse,
  type ExpertCareSpecialistResponse,
  type ExpertCareSpecialty,
  type ExpertCareVerifiedProfile,
} from "./expertCare.js";

export const EXPERT_CARE_PROGRESS_VERSION = "expert_care_v1" as const;

export const expertCareCasePatchSchema = z.object({
  goal: z.enum(EXPERT_CARE_GOALS).nullable().optional(),
  specialty: z.enum(EXPERT_CARE_SPECIALTIES).nullable().optional(),
  person: z.enum(["self", "trusted_helper"]).nullable().optional(),
  authorityConfirmedAt: z.string().datetime().nullable().optional(),
  diagnosisOrRecommendation: z.string().trim().max(4000).nullable().optional(),
  currentTreatment: z.string().trim().max(4000).nullable().optional(),
  concerns: z.string().trim().max(4000).nullable().optional(),
  location: z.string().trim().max(300).nullable().optional(),
  languages: z.array(z.enum(["en", "es"])).min(1).max(2).optional(),
  emergencyResult: z.enum(["not_checked", "clear", "urgent_stop"]).optional(),
  stage: z.enum(["goal", "person", "permission", "specialty", "safety", "context", "records", "concerns", "research", "specialists", "verification", "consent", "coordination", "ready"]).optional(),
}).strict();

export const updateExpertCareCaseSchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  patch: expertCareCasePatchSchema,
}).strict();

export type ExpertCareCasePatch = z.infer<typeof expertCareCasePatchSchema>;

export type ExpertCareCaseState = {
  version: typeof EXPERT_CARE_PROGRESS_VERSION;
  revision: number;
  legacySourceTaskId: string | null;
  context: {
    goal: ExpertCareGoal | null;
    specialty: ExpertCareSpecialty | null;
    person: "self" | "trusted_helper" | null;
    authorityConfirmedAt: string | null;
    diagnosisOrRecommendation: string | null;
    currentTreatment: string | null;
    concerns: string | null;
    location: string | null;
    languages: Array<"en" | "es">;
    emergencyResult: "not_checked" | "clear" | "urgent_stop";
  };
  records: {
    documentIds: string[];
  };
  evidence: {
    result: ExpertCareResearchResponse;
    contextRevision: number;
  } | null;
  specialists: {
    result: ExpertCareSpecialistResponse;
    contextRevision: number;
  } | null;
  verification: Array<{
    candidateId: string;
    status: "unverified" | "verification_pending" | "verified" | "failed";
    details: string[];
    updatedAt: string;
  }>;
  consent: {
    records: boolean;
    research: boolean;
    sharing: boolean;
  };
  entitlement: "free" | "coordination_paid";
  coordinationStatus: "not_started" | "preparing" | "awaiting_confirmation" | "requested" | "complete";
  contactPreparation: ExpertCareContactPreparation | null;
  specialistResponse: {
    candidateId: string;
    outcome: "accepted" | "declined" | "no_response";
    notes: string | null;
    receivedAt: string;
  } | null;
  stage: "goal" | "person" | "permission" | "specialty" | "safety" | "context" | "records" | "concerns" | "research" | "specialists" | "verification" | "consent" | "coordination" | "ready";
  createdAt: string;
  updatedAt: string;
};

export function createExpertCareState(language: "en" | "es" = "en", now = new Date().toISOString()): ExpertCareCaseState {
  return {
    version: EXPERT_CARE_PROGRESS_VERSION,
    revision: 0,
    legacySourceTaskId: null,
    context: {
      goal: null,
      specialty: null,
      person: null,
      authorityConfirmedAt: null,
      diagnosisOrRecommendation: null,
      currentTreatment: null,
      concerns: null,
      location: null,
      languages: [language],
      emergencyResult: "not_checked",
    },
    records: { documentIds: [] },
    evidence: null,
    specialists: null,
    verification: [],
    consent: { records: false, research: false, sharing: false },
    entitlement: "free",
    coordinationStatus: "not_started",
    contactPreparation: null,
    specialistResponse: null,
    stage: "goal",
    createdAt: now,
    updatedAt: now,
  };
}

const evidenceInputs: Array<keyof ExpertCareCasePatch> = ["goal", "specialty", "diagnosisOrRecommendation", "currentTreatment", "concerns", "languages"];
const specialistInputs: Array<keyof ExpertCareCasePatch> = [...evidenceInputs, "location"];
const authorityInputs: Array<keyof ExpertCareCasePatch> = ["person", "authorityConfirmedAt"];

function changed<T extends keyof ExpertCareCasePatch>(current: ExpertCareCaseState, patch: ExpertCareCasePatch, key: T): boolean {
  if (!(key in patch)) return false;
  const before = current.context[key as keyof ExpertCareCaseState["context"]];
  const after = patch[key];
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function applyExpertCarePatch(current: ExpertCareCaseState, patch: ExpertCareCasePatch, now = new Date().toISOString()): ExpertCareCaseState {
  const evidenceChanged = evidenceInputs.some((key) => changed(current, patch, key));
  const specialistsChanged = specialistInputs.some((key) => changed(current, patch, key));
  const authorityChanged = authorityInputs.some((key) => changed(current, patch, key));
  const safetyChanged = changed(current, patch, "emergencyResult");
  const urgentStop = patch.emergencyResult === "urgent_stop";
  const context = { ...current.context };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "stage" || value === undefined) continue;
    (context as Record<string, unknown>)[key] = value;
  }

  return {
    ...current,
    revision: current.revision + 1,
    context,
    evidence: evidenceChanged || safetyChanged ? null : current.evidence,
    specialists: specialistsChanged || safetyChanged ? null : current.specialists,
    verification: specialistsChanged || safetyChanged ? [] : current.verification,
    consent: specialistsChanged || authorityChanged || safetyChanged
      ? { ...current.consent, research: evidenceChanged || safetyChanged ? false : current.consent.research, sharing: false }
      : current.consent,
    coordinationStatus: specialistsChanged || authorityChanged || safetyChanged ? "not_started" : current.coordinationStatus,
    contactPreparation: specialistsChanged || authorityChanged || safetyChanged ? null : current.contactPreparation,
    specialistResponse: specialistsChanged || authorityChanged || safetyChanged ? null : current.specialistResponse,
    stage: urgentStop ? "safety" : patch.stage ?? current.stage,
    updatedAt: now,
  };
}

export function attachExpertCareEvidence(current: ExpertCareCaseState, result: ExpertCareResearchResponse, now = new Date().toISOString()): ExpertCareCaseState {
  return { ...current, revision: current.revision + 1, evidence: { result, contextRevision: current.revision }, consent: { ...current.consent, research: false }, updatedAt: now };
}

export function acknowledgeExpertCareResearchBoundary(current: ExpertCareCaseState, now = new Date().toISOString()): ExpertCareCaseState {
  if (!current.evidence || current.consent.research) return current;
  return { ...current, revision: current.revision + 1, consent: { ...current.consent, research: true }, updatedAt: now };
}

export function attachExpertCareSpecialists(current: ExpertCareCaseState, result: ExpertCareSpecialistResponse, now = new Date().toISOString()): ExpertCareCaseState {
  return {
    ...current,
    revision: current.revision + 1,
    specialists: { result, contextRevision: current.revision },
    verification: result.candidates.map((candidate) => ({ candidateId: candidate.id, status: candidate.verificationStatus, details: candidate.verificationDetails, updatedAt: now })),
    updatedAt: now,
  };
}

export function attachExpertCareDocumentId(current: ExpertCareCaseState, documentId: string, now = new Date().toISOString()): ExpertCareCaseState {
  if (current.records.documentIds.includes(documentId)) return current;
  return { ...current, revision: current.revision + 1, records: { documentIds: [...current.records.documentIds, documentId] }, updatedAt: now };
}

export function removeExpertCareDocumentId(current: ExpertCareCaseState, documentId: string, now = new Date().toISOString()): ExpertCareCaseState {
  if (!current.records.documentIds.includes(documentId)) return current;
  return { ...current, revision: current.revision + 1, records: { documentIds: current.records.documentIds.filter((id) => id !== documentId) }, consent: { ...current.consent, sharing: false }, coordinationStatus: "not_started", contactPreparation: null, updatedAt: now };
}

export function updateExpertCareVerification(
  current: ExpertCareCaseState,
  candidateId: string,
  status: "verification_pending" | "verified" | "failed",
  details: string[],
  verifiedProfile?: ExpertCareVerifiedProfile,
  now = new Date().toISOString(),
): ExpertCareCaseState {
  const candidateExists = current.specialists?.result.candidates.some((candidate) => candidate.id === candidateId);
  if (!candidateExists) return current;
  const verification = current.verification.filter((entry) => entry.candidateId !== candidateId);
  verification.push({ candidateId, status, details, updatedAt: now });
  const specialists = current.specialists ? {
    ...current.specialists,
    result: {
      ...current.specialists.result,
      candidates: current.specialists.result.candidates.map((candidate) => candidate.id === candidateId
        ? {
          ...candidate,
          ...(status === "verified" && verifiedProfile ? {
            institution: verifiedProfile.institution,
            country: verifiedProfile.country,
            address: verifiedProfile.address,
            languages: verifiedProfile.languages,
            remoteCareRegions: verifiedProfile.remoteCareRegions,
            expertiseEvidence: verifiedProfile.expertiseEvidence,
            contactData: verifiedProfile.contactData,
            websiteUrl: verifiedProfile.contactData.website,
            availability: verifiedProfile.availability,
            timezone: verifiedProfile.timezone,
            estimatedCost: verifiedProfile.estimatedCost,
          } : {}),
          verificationStatus: status,
          verificationDetails: details,
        }
        : candidate),
    },
  } : null;
  return { ...current, revision: current.revision + 1, specialists, verification, coordinationStatus: "not_started", contactPreparation: null, updatedAt: now };
}

export function attachExpertCareContactPreparation(
  current: ExpertCareCaseState,
  preparation: ExpertCareContactPreparation,
  now = new Date().toISOString(),
): ExpertCareCaseState {
  return {
    ...current,
    revision: current.revision + 1,
    consent: { ...current.consent, sharing: true },
    coordinationStatus: "awaiting_confirmation",
    contactPreparation: preparation,
    specialistResponse: null,
    stage: "coordination",
    updatedAt: now,
  };
}

export function attachExpertCareSpecialistResponse(
  current: ExpertCareCaseState,
  response: NonNullable<ExpertCareCaseState["specialistResponse"]>,
  now = new Date().toISOString(),
): ExpertCareCaseState {
  if (!current.contactPreparation || current.contactPreparation.candidateId !== response.candidateId) return current;
  return { ...current, revision: current.revision + 1, specialistResponse: response, coordinationStatus: "complete", stage: "ready", updatedAt: now };
}

export function isExpertCareCaseState(value: unknown): value is ExpertCareCaseState {
  if (!value || typeof value !== "object") return false;
  const state = value as Partial<ExpertCareCaseState>;
  return state.version === EXPERT_CARE_PROGRESS_VERSION
    && typeof state.revision === "number"
    && !!state.context
    && Array.isArray(state.context.languages)
    && typeof state.stage === "string";
}
