import { z } from "zod";

export const EXPERT_CARE_DOCUMENT_MEDIA_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export const expertCareDocumentUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mediaType: z.enum(EXPERT_CARE_DOCUMENT_MEDIA_TYPES),
  dataBase64: z.string().min(4).max(14_000_000),
  ownershipConfirmed: z.literal(true),
  retentionConsent: z.literal(true),
}).strict();

export const expertCareDocumentSharingSchema = z.object({
  approved: z.boolean(),
}).strict();

export type ExpertCareVaultDocument = {
  id: string;
  caseId: string;
  fileName: string;
  mediaType: typeof EXPERT_CARE_DOCUMENT_MEDIA_TYPES[number];
  byteSize: number;
  sha256: string;
  malwareStatus: "clean";
  ocrStatus: "complete" | "needs_review" | "failed";
  ocrConfidence: number | null;
  retentionConsentAt: string;
  sharingApproved: boolean;
  createdAt: string;
};

export type ExpertCareVaultAuditEvent = {
  id: string;
  documentId: string | null;
  eventType: "uploaded" | "listed" | "viewed" | "sharing_approved" | "sharing_revoked" | "deleted";
  createdAt: string;
};
