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

export const CONCIERGE_DOCUMENT_KINDS = ["insurance-letter", "claim", "government-form", "call-email", "not-sure"] as const;

export const conciergeTaskKindSchema = z.enum(CONCIERGE_TASK_KINDS);
const conciergeDocumentKindSchema = z.enum(CONCIERGE_DOCUMENT_KINDS);
export const conciergeTaskStageSchema = z.enum(["details", "review"]);
export const conciergeTaskStatusSchema = z.enum(["active", "completed", "deleted"]);

export const conciergeTaskEntryPayloadSchema = z.object({
  kind: conciergeTaskKindSchema,
  documentKind: conciergeDocumentKindSchema.optional(),
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
const documentConfidenceSchema = z.enum(["high", "medium", "low"]);

// Facts the Document Help reader found. The photo or file itself is never stored.
const documentReadingSchema = z.object({
  status: z.enum(["read", "unreadable", "unavailable"]),
  document_type_label: z.string().max(200).nullable(),
  organization: z.string().max(200).nullable(),
  summary: z.string().max(1000).nullable(),
  dates: z.array(z.object({
    label: z.string().max(200),
    date: z.string().max(10).nullable(),
    text: z.string().max(200),
    is_deadline: z.boolean(),
    confidence: documentConfidenceSchema,
  }).strict()).max(6),
  amounts: z.array(z.object({
    label: z.string().max(200),
    amount: z.number().finite(),
    currency: z.string().max(8).nullable(),
    kind: z.enum(["due", "reimbursable", "paid", "other"]),
    confidence: documentConfidenceSchema,
  }).strict()).max(6),
  requested_actions: z.array(z.string().max(300)).max(5),
  terms: z.array(z.object({
    term: z.string().max(100),
    explanation: z.string().max(300),
  }).strict()).max(5),
  unclear: z.array(z.string().max(300)).max(5),
  has_reference_number: z.boolean(),
  confidence: documentConfidenceSchema,
}).strict();

// This is intentionally a whitelist. Confirmation state is never accepted here.
export const conciergeTaskProgressPayloadSchema = z.object({
  documentKind: conciergeDocumentKindSchema.nullable().optional(),
  documentDetails: z.object({
    subject: z.string().max(1000),
    recipient: z.string().max(1000),
    deadline: z.string().max(200),
    notes: z.string().max(8000),
  }).strict().optional(),
  documentStep: z.enum(["choose", "details", "review"]).optional(),
  documentReading: documentReadingSchema.nullable().optional(),
  documentFileName: z.string().max(300).nullable().optional(),
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
  selectedContactChannel: z.enum(["booking_url", "phone", "whatsapp", "email", "manual"]).nullable().optional(),
  crossPillarIdempotencyKey: z.string().max(300).optional(),
}).strict();

export const createConciergeTaskDraftSchema = z.object({
  entry: conciergeTaskEntryPayloadSchema,
  language: z.string().trim().min(2).max(12).optional(),
  idempotencyKey: z.string().trim().min(1).max(300).optional(),
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
