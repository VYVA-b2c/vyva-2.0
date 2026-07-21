import { z } from "zod";

export const CONCIERGE_TASK_KINDS = [
  "document",
  "appointment",
  "home_service",
  "provider_contact",
  "scam_review",
  "transport",
  "otc_pharmacy",
] as const;

export const conciergeTaskKindSchema = z.enum(CONCIERGE_TASK_KINDS);
export const conciergeTaskStageSchema = z.enum(["details", "review"]);
export const conciergeTaskStatusSchema = z.enum(["active", "completed", "deleted"]);

export const conciergeTaskEntryPayloadSchema = z.object({
  kind: conciergeTaskKindSchema,
  documentKind: z.enum(["insurance-letter", "claim", "government-form", "call-email"]).optional(),
  appointmentKind: z.enum(["medical", "personal-care", "government"]).optional(),
  providerSearchMode: z.enum([
    "personal-care",
    "specialist",
    "residence",
    "care",
    "transport",
    "pharmacy",
    "home-service",
    "shopping-seller",
  ]).optional(),
  query: z.string().trim().max(500).optional(),
}).strict();

const stringRecordSchema = z.record(z.string(), z.string().max(4000));

// This is intentionally a whitelist. Confirmation state is never accepted here.
export const conciergeTaskProgressPayloadSchema = z.object({
  documentKind: z.enum(["insurance-letter", "claim", "government-form", "call-email"]).nullable().optional(),
  documentDetails: z.object({
    subject: z.string().max(1000),
    recipient: z.string().max(1000),
    deadline: z.string().max(200),
    notes: z.string().max(8000),
  }).strict().optional(),
  appointmentType: z.string().max(120).nullable().optional(),
  note: z.string().max(8000).optional(),
  requestedTime: z.string().max(500).optional(),
  coverageLabel: z.string().max(1000).optional(),
  serviceType: z.string().max(120).nullable().optional(),
  origin: z.enum(["app", "voice"]).optional(),
  answers: stringRecordSchema.optional(),
  textDrafts: stringRecordSchema.optional(),
  canvasStep: z.string().max(120).nullable().optional(),
  photoName: z.string().max(500).optional(),
  providerSearchMode: z.string().max(120).nullable().optional(),
  query: z.string().max(2000).optional(),
  criteria: z.array(z.string().max(120)).max(20).optional(),
  providerResult: z.record(z.string(), z.unknown()).nullable().optional(),
  shortlistIds: z.array(z.string().max(200)).max(50).optional(),
  requestId: z.string().max(200).nullable().optional(),
  selectedProviderOptionId: z.string().max(200).nullable().optional(),
}).strict();

export const createConciergeTaskDraftSchema = z.object({
  entry: conciergeTaskEntryPayloadSchema,
  language: z.string().trim().min(2).max(12).optional(),
}).strict();

export const updateConciergeTaskDraftSchema = z.object({
  progress: conciergeTaskProgressPayloadSchema,
  stage: conciergeTaskStageSchema,
}).strict();

export type ConciergeTaskKind = z.infer<typeof conciergeTaskKindSchema>;
export type PersistedConciergeTaskStage = z.infer<typeof conciergeTaskStageSchema>;
export type ConciergeTaskStatus = z.infer<typeof conciergeTaskStatusSchema>;
export type ConciergeTaskEntryPayload = z.infer<typeof conciergeTaskEntryPayloadSchema>;
export type ConciergeTaskProgressPayload = z.infer<typeof conciergeTaskProgressPayloadSchema>;

export type ConciergeTaskDraft = {
  id: string;
  user_id: string;
  kind: ConciergeTaskKind;
  entry_payload: ConciergeTaskEntryPayload;
  progress_payload: ConciergeTaskProgressPayload;
  stage: PersistedConciergeTaskStage;
  status: ConciergeTaskStatus;
  linked_pending_id: string | null;
  language: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};
