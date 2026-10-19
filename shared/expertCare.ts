import { z } from "zod";

export const EXPERT_CARE_GOALS = ["find_specialist", "second_opinion", "recent_treatments", "trials_advances"] as const;
export const EXPERT_CARE_SPECIALTIES = ["oncology", "cardiology", "neurology"] as const;
export const EXPERT_CARE_EVIDENCE_TYPES = [
  "guideline_supported_care",
  "regulatory_approval",
  "guideline_update",
  "peer_reviewed_clinical_evidence",
  "late_phase_trial",
  "early_phase_trial",
  "preclinical_research",
] as const;
export const EXPERT_CARE_STAGES = ["goal", "person", "permission", "specialty", "safety", "context", "records", "concerns", "research", "specialists", "verification", "consent", "coordination", "ready"] as const;

export type ExpertCareGoal = typeof EXPERT_CARE_GOALS[number];
export type ExpertCareSpecialty = typeof EXPERT_CARE_SPECIALTIES[number];
export type ExpertCareEvidenceType = typeof EXPERT_CARE_EVIDENCE_TYPES[number];
export type ExpertCareStage = typeof EXPERT_CARE_STAGES[number];

export type ExpertCareDocument = {
  id: string;
  name: string;
  mediaType: string;
  uploadedAt: string;
  ocrStatus: "pending" | "complete" | "needs_review" | "failed";
  ocrConfidence: number | null;
  retentionConsentAt: string;
  sharingApproved: boolean;
};

export type ExpertCareCase = {
  id: string;
  version: "expert_care_v1";
  goal: ExpertCareGoal | null;
  specialty: ExpertCareSpecialty | null;
  person: "self" | "trusted_helper" | null;
  authorityConfirmedAt: string | null;
  diagnosisOrRecommendation: string | null;
  currentTreatment: string | null;
  concerns: string | null;
  location: string | null;
  languages: Array<"en" | "es">;
  documents: ExpertCareDocument[];
  emergencyResult: "not_checked" | "clear" | "urgent_stop";
  consent: { records: boolean; research: boolean; sharing: boolean };
  entitlement: "free" | "coordination_paid";
  stage: ExpertCareStage;
  createdAt: string;
  updatedAt: string;
};

export const expertCareResearchRequestSchema = z.object({
  caseId: z.string().uuid().optional(),
  specialty: z.enum(EXPERT_CARE_SPECIALTIES),
  question: z.string().trim().min(3).max(600),
  language: z.enum(["en", "es"]).default("en"),
}).strict();

export const expertCareSpecialistRequestSchema = z.object({
  caseId: z.string().uuid().optional(),
  specialty: z.enum(EXPERT_CARE_SPECIALTIES),
  question: z.string().trim().min(3).max(600),
  location: z.string().trim().min(2).max(200),
  language: z.enum(["en", "es"]).default("en"),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(6).default(3),
}).strict();

export const expertCareVerificationRequestSchema = z.object({
  candidateId: z.string().trim().min(1).max(240),
}).strict();

export const expertCareVerifiedProfileSchema = z.object({
  institution: z.string().trim().min(2).max(240),
  country: z.string().trim().min(2).max(120),
  address: z.string().trim().min(2).max(300).nullable(),
  languages: z.array(z.string().trim().min(2).max(80)).min(1).max(20),
  remoteCareRegions: z.array(z.string().trim().min(2).max(120)).max(40),
  expertiseEvidence: z.array(z.string().trim().min(3).max(300)).min(1).max(20),
  contactData: z.object({
    website: z.string().url().max(500).nullable(),
    phone: z.string().trim().min(5).max(80).nullable(),
    email: z.string().email().max(240).nullable(),
  }).strict(),
  availability: z.string().trim().min(2).max(240).nullable(),
  timezone: z.string().trim().min(2).max(100).nullable(),
  estimatedCost: z.string().trim().min(2).max(160).nullable(),
}).strict().superRefine((value, context) => {
  if (!value.contactData.email && !value.contactData.phone && !value.contactData.website) {
    context.addIssue({ code: "custom", path: ["contactData"], message: "verified_contact_route_required" });
  }
});

const expertCareVerificationChecksSchema = z.object({
  details: z.array(z.string().trim().min(1).max(300)).min(1).max(12),
  identityConfirmed: z.boolean(),
  licenseConfirmed: z.boolean(),
  subspecialtyConfirmed: z.boolean(),
  institutionConfirmed: z.boolean(),
  languagesConfirmed: z.boolean(),
  remoteRegionsConfirmed: z.boolean(),
  contactRouteConfirmed: z.boolean(),
});

export const expertCareVerificationResolutionSchema = z.discriminatedUnion("status", [
  expertCareVerificationChecksSchema.extend({
    status: z.literal("verified"),
    verifiedProfile: expertCareVerifiedProfileSchema,
  }).strict(),
  expertCareVerificationChecksSchema.extend({
    status: z.literal("failed"),
    verifiedProfile: z.never().optional(),
  }).strict(),
]);

export type ExpertCareVerifiedProfile = z.infer<typeof expertCareVerifiedProfileSchema>;

export const expertCareContactPreparationSchema = z.object({
  candidateId: z.string().trim().min(1).max(240),
  documentIds: z.array(z.string().uuid()).max(24),
  healthFields: z.array(z.enum(["diagnosis_or_recommendation", "current_treatment", "concerns", "location", "languages"])).min(1).max(5),
  channel: z.enum(["email", "phone", "website", "manual"]),
  message: z.string().trim().min(20).max(3000),
  confirmExactSharing: z.literal(true),
}).strict();

export type EvidenceCitation = {
  id: string;
  label: string;
  url: string;
  source: "Europe PMC" | "ClinicalTrials.gov" | "EU CTIS" | "FDA" | "EMA" | "WHO" | "NICE" | "Professional society";
};

export type EvidenceItem = {
  id: string;
  evidenceType: ExpertCareEvidenceType;
  title: string;
  whatChanged: string;
  whyItMayMatter: string;
  askTheSpecialist: string;
  jurisdiction: string;
  publishedAt: string | null;
  limitations: string;
  experimental: boolean;
  evidenceStatus: "published" | "registered" | "approved" | "guideline" | "unknown";
  freshnessStatus: "current" | "stale" | "unknown";
  retrievedAt: string;
  citations: EvidenceCitation[];
};

export type SpecialistCandidate = {
  id: string;
  name: string;
  specialty: ExpertCareSpecialty;
  institution: string | null;
  country: string | null;
  address: string | null;
  distanceMeters: number | null;
  openingStatus: string | null;
  todayOpeningHours: string | null;
  languages: string[];
  remoteCareRegions: string[];
  websiteUrl: string | null;
  mapsUrl: string | null;
  rating: number | null;
  reviewCount: number | null;
  ratingProvenance: string | null;
  expertiseEvidence: string[];
  directorySources: Array<{ label: string; url: string | null }>;
  contactData: { website: string | null; phone: string | null; email: string | null };
  availability: string | null;
  timezone: string | null;
  estimatedCost: string | null;
  verificationStatus: "unverified" | "verification_pending" | "verified" | "failed";
  verificationDetails: string[];
  sourceLabel: string;
};

export type ExpertCareResearchResponse = {
  items: EvidenceItem[];
  retrievedAt: string;
  educationalOnly: true;
  unavailableSources: string[];
  sourceStatuses?: Array<{
    source: EvidenceCitation["source"];
    status: "available" | "unavailable" | "configuration_required";
    retrievedAt: string;
    detail: string | null;
  }>;
  safetyRejectedCount?: number;
  safetyRejectionReasons?: string[];
  safetyNotices?: string[];
};

export type ExpertCareSpecialistResponse = {
  candidates: SpecialistCandidate[];
  contactBlockedUntilVerified: true;
  retrievedAt: string;
  nextCursor?: string | null;
};

export type ExpertCareContactPreparation = {
  pendingActionId: string;
  candidateId: string;
  recipient: string;
  documentIds: string[];
  healthFields: Array<"diagnosis_or_recommendation" | "current_treatment" | "concerns" | "location" | "languages">;
  channel: "email" | "phone" | "website" | "manual";
  message: string;
  confirmedAt: string;
};

export type ExpertCareConsultationPackage = {
  caseId: string;
  generatedAt: string;
  consultationReady: boolean;
  blockers: Array<"emergency_check" | "permission" | "clinical_context" | "evidence_brief" | "educational_boundary_acknowledgement" | "verified_specialist" | "sharing_confirmation">;
  context: {
    goal: ExpertCareGoal | null;
    specialty: ExpertCareSpecialty | null;
    diagnosisOrRecommendation: string | null;
    currentTreatment: string | null;
    concerns: string | null;
    location: string | null;
    languages: Array<"en" | "es">;
  };
  evidence: ExpertCareResearchResponse | null;
  verifiedSpecialists: SpecialistCandidate[];
  preparedQuestions: string[];
  records: Array<{ id: string; fileName: string; sharingApproved: boolean; ocrStatus: "complete" | "needs_review" | "failed" }>;
  contactPreparation: ExpertCareContactPreparation | null;
  specialistResponse: { candidateId: string; outcome: "accepted" | "declined" | "no_response"; notes: string | null; receivedAt: string } | null;
  boundaries: string[];
};
