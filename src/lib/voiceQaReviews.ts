import { getToken } from "./auth";

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

export type VoiceQaSessionReview = {
  id: string;
  sessionId: string;
  status: VoiceQaReviewStatus;
  note: string;
  reviewedBy: string;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
};

export type VoiceQaReviewDraft = {
  status: VoiceQaReviewStatus;
  note: string;
};

const STATUS_LABELS: Record<VoiceQaReviewStatus, string> = {
  unreviewed: "Unreviewed",
  good: "Good",
  needs_review: "Needs review",
  reviewed: "Reviewed",
  prompt_fix_needed: "Prompt fix",
  app_fix_needed: "App fix",
  elevenlabs_config_needed: "ElevenLabs config",
};

export function voiceQaReviewStatusLabel(status: VoiceQaReviewStatus) {
  return STATUS_LABELS[status];
}

export function isVoiceQaReviewStatus(value: unknown): value is VoiceQaReviewStatus {
  return typeof value === "string" && VOICE_QA_REVIEW_STATUSES.includes(value as VoiceQaReviewStatus);
}

function parseReview(raw: Record<string, unknown>): VoiceQaSessionReview | null {
  if (typeof raw.id !== "string" || typeof raw.sessionId !== "string" || !isVoiceQaReviewStatus(raw.status)) {
    return null;
  }

  return {
    id: raw.id,
    sessionId: raw.sessionId,
    status: raw.status,
    note: typeof raw.note === "string" ? raw.note : "",
    reviewedBy: typeof raw.reviewedBy === "string" ? raw.reviewedBy : "",
    reviewedAt: typeof raw.reviewedAt === "number" ? raw.reviewedAt : null,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

export async function fetchVoiceQaSessionReviews(limit = 500) {
  const token = getToken();
  if (!token) return [];

  const response = await fetch(`/api/admin/voice/qa-reviews?limit=${Math.max(1, Math.min(limit, 1000))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json().catch(() => null) as { reviews?: Array<Record<string, unknown>> } | null;
  return (data?.reviews ?? [])
    .map(parseReview)
    .filter((review): review is VoiceQaSessionReview => Boolean(review));
}

export async function saveVoiceQaSessionReview(input: {
  sessionId: string;
  status: VoiceQaReviewStatus;
  note: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch("/api/admin/voice/qa-reviews", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session_id: input.sessionId,
      status: input.status,
      note: input.note,
    }),
  });

  if (!response.ok) throw new Error("Failed to save QA review");

  const data = await response.json().catch(() => null) as { review?: Record<string, unknown> | null } | null;
  return data?.review ? parseReview(data.review) : null;
}
