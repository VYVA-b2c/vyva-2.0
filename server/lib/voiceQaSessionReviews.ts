import { desc, eq, sql } from "drizzle-orm";
import { db, pool } from "../db.js";
import { voiceQaSessionReviews } from "../../shared/schema.js";

export const VOICE_QA_REVIEW_STATUSES = [
  "unreviewed",
  "good",
  "needs_review",
  "reviewed",
  "prompt_fix_needed",
  "app_fix_needed",
  "elevenlabs_config_needed",
] as const;

export type VoiceQaReviewStatus = typeof VOICE_QA_REVIEW_STATUSES[number];
export type VoiceQaSessionReviewRow = typeof voiceQaSessionReviews.$inferSelect;

let ensureReviewTablePromise: Promise<void> | null = null;

function trimTo(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isVoiceQaReviewStatus(value: unknown): value is VoiceQaReviewStatus {
  return typeof value === "string" && VOICE_QA_REVIEW_STATUSES.includes(value as VoiceQaReviewStatus);
}

export async function ensureVoiceQaSessionReviewsTable(): Promise<void> {
  ensureReviewTablePromise ??= (async () => {
    await pool.query(`
      create table if not exists voice_qa_session_reviews (
        id uuid primary key default gen_random_uuid(),
        session_id text not null unique,
        status text not null default 'unreviewed',
        note text,
        reviewed_by text,
        reviewed_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
    await pool.query(`
      create index if not exists voice_qa_session_reviews_status_idx
      on voice_qa_session_reviews (status, updated_at desc)
    `);
    await pool.query(`
      create index if not exists voice_qa_session_reviews_updated_idx
      on voice_qa_session_reviews (updated_at desc)
    `);
  })().catch((err) => {
    ensureReviewTablePromise = null;
    throw err;
  });

  return ensureReviewTablePromise;
}

export async function listVoiceQaSessionReviews(limit = 500) {
  await ensureVoiceQaSessionReviewsTable();
  return db
    .select()
    .from(voiceQaSessionReviews)
    .orderBy(desc(voiceQaSessionReviews.updated_at))
    .limit(Math.max(1, Math.min(limit, 1000)));
}

export async function upsertVoiceQaSessionReview(input: {
  sessionId: string;
  status: VoiceQaReviewStatus;
  note?: string | null;
  reviewedBy?: string | null;
}) {
  await ensureVoiceQaSessionReviewsTable();
  const sessionId = trimTo(input.sessionId, 220);
  if (!sessionId) return null;

  const note = trimTo(input.note ?? "", 2400) || null;
  const reviewedBy = trimTo(input.reviewedBy ?? "", 220) || null;
  const reviewedAt = input.status === "unreviewed" ? null : new Date();

  const [row] = await db
    .insert(voiceQaSessionReviews)
    .values({
      session_id: sessionId,
      status: input.status,
      note,
      reviewed_by: reviewedBy,
      reviewed_at: reviewedAt,
    })
    .onConflictDoUpdate({
      target: voiceQaSessionReviews.session_id,
      set: {
        status: input.status,
        note,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        updated_at: sql`now()`,
      },
    })
    .returning();

  return row;
}

export function voiceQaSessionReviewToApi(row: VoiceQaSessionReviewRow) {
  return {
    id: row.id,
    sessionId: row.session_id,
    status: row.status,
    note: row.note ?? "",
    reviewedBy: row.reviewed_by ?? "",
    reviewedAt: row.reviewed_at?.getTime() ?? null,
    createdAt: row.created_at.getTime(),
    updatedAt: row.updated_at.getTime(),
  };
}
