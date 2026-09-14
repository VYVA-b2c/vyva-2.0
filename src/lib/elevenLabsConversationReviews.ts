import { apiFetch } from "@/lib/queryClient";

export const ELEVENLABS_REVIEW_STATUSES = [
  "unreviewed",
  "reviewed",
  "needs_follow_up",
  "quality_issue",
] as const;

export type ElevenLabsReviewStatus = typeof ELEVENLABS_REVIEW_STATUSES[number];

export type ElevenLabsConversationSummary = {
  id: string;
  providerConversationId: string;
  vyvaSessionId: string | null;
  userId: string | null;
  agentId: string | null;
  agentName: string | null;
  status: string;
  locale: string | null;
  callSuccessful: string | null;
  hasAudio: boolean;
  hasTranscript: boolean;
  consentStatus: string;
  consentVersion: string | null;
  consentRecordedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  durationSeconds: number | null;
  retentionDeleteAt: number;
  reviewStatus: ElevenLabsReviewStatus;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: number | null;
  availability: {
    details: boolean;
    audio: boolean;
    reason: "retention_expired" | "provider_deleted" | null;
  };
};

export type ElevenLabsConversationDetails = {
  providerConversationId: string;
  status: string;
  summary: string;
  callSuccessful: string | null;
  transcript: Array<{
    role: string;
    message: string;
    timeInCallSeconds: number | null;
    interrupted: boolean;
  }>;
};

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchElevenLabsConversations() {
  const response = await apiFetch("/api/admin/voice/conversations?limit=150");
  if (!response.ok) throw new Error(await responseError(response, "Could not load conversations"));
  const body = await response.json() as { conversations?: ElevenLabsConversationSummary[] };
  return body.conversations ?? [];
}

export async function fetchElevenLabsConversationDetails(conversationId: string, reason: string) {
  const response = await apiFetch(`/api/admin/voice/conversations/${encodeURIComponent(conversationId)}/details?reason=${encodeURIComponent(reason)}`);
  if (!response.ok) throw new Error(await responseError(response, "Could not load conversation details"));
  const body = await response.json() as { details: ElevenLabsConversationDetails };
  return body.details;
}

export async function fetchElevenLabsConversationAudio(conversationId: string, reason: string) {
  const response = await apiFetch(`/api/admin/voice/conversations/${encodeURIComponent(conversationId)}/audio?reason=${encodeURIComponent(reason)}`);
  if (!response.ok) throw new Error(await responseError(response, "Could not load recording"));
  return response.blob();
}

export async function saveElevenLabsConversationReview(input: {
  conversationId: string;
  status: ElevenLabsReviewStatus;
  note: string;
  reason: string;
}) {
  const response = await apiFetch(`/api/admin/voice/conversations/${encodeURIComponent(input.conversationId)}/review`, {
    method: "PATCH",
    body: JSON.stringify({ status: input.status, note: input.note, reason: input.reason }),
  });
  if (!response.ok) throw new Error(await responseError(response, "Could not save review"));
  const body = await response.json() as { conversation: ElevenLabsConversationSummary };
  return body.conversation;
}
