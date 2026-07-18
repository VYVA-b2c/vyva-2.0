import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  classifyConciergeInboundReply,
  type ConciergeInboundReplyClassification,
} from "../../shared/conciergeInboundReplies";
import { conciergeReplyAddressForPendingTask } from "./conciergeInboundEmailRouting";
import {
  ingestConciergeInboundReply,
  PostgresConciergeInboundReplyRepository,
  type ConciergeInboundPendingMatch,
  type ConciergeInboundProviderEmail,
  type ConciergeInboundReplyRepository,
  type StoredConciergeInboundReply,
} from "./conciergeInboundReplies";

const originalEnv = { ...process.env };
const pendingId = "0f83cc56-6226-4ca4-a7e2-aa2967addd4a";

function pending(overrides: Partial<ConciergeInboundPendingMatch> = {}): ConciergeInboundPendingMatch {
  return {
    id: pendingId,
    userId: "user-1",
    providerName: "City Clinic",
    providerEmail: "frontdesk@clinic.example",
    actionPayload: {
      provider_task_status: "waiting",
      waiting_for_provider: true,
      execution_adapter: {
        version: 1,
        channel: "email",
        mode: "live",
        status: "sent",
      },
      email_outcome: "sent",
      execution_task: {
        version: 1,
        lifecycle_status: "confirmed",
        user_confirmed: true,
        external_action_allowed: true,
        execution_mode: "live",
        confirmed_at: "2026-07-18T10:00:00.000Z",
        approval_fingerprint: { version: 1, fingerprint: "old-approval" },
        adapter_result: { status: "sent" },
        updated_at: "2026-07-18T10:00:00.000Z",
      },
    },
    ...overrides,
  };
}

function message(overrides: Partial<ConciergeInboundProviderEmail> = {}): ConciergeInboundProviderEmail {
  return {
    channel: "email",
    providerEventId: "received-email-1",
    webhookEventId: "webhook-1",
    senderEmail: "frontdesk@clinic.example",
    recipientEmails: [conciergeReplyAddressForPendingTask(pendingId)!],
    subject: "Re: Appointment request",
    text: "Could you confirm the preferred appointment time?",
    html: null,
    receivedAt: "2026-07-18T11:00:00.000Z",
    providerMetadata: {},
    ...overrides,
  };
}

class MemoryRepository implements ConciergeInboundReplyRepository {
  duplicate = false;
  pendingById: ConciergeInboundPendingMatch | null = pending();
  senderMatches: ConciergeInboundPendingMatch[] = [];
  attached: Parameters<ConciergeInboundReplyRepository["attach"]>[0] | null = null;
  unmatchedReason: string | null = null;
  failedReason: string | null = null;

  async reserve(_message: ConciergeInboundProviderEmail, _classification: ConciergeInboundReplyClassification) {
    return { id: "inbound-1", duplicate: this.duplicate };
  }
  async findOpenPendingById() { return this.pendingById; }
  async findOpenPendingBySender() { return this.senderMatches; }
  async attach(input: Parameters<ConciergeInboundReplyRepository["attach"]>[0]) {
    this.attached = input;
    return true;
  }
  async markUnmatched(_messageId: string, reason: string) { this.unmatchedReason = reason; }
  async markFailed(_messageId: string, reason: string) { this.failedReason = reason; }
  async getMessage(): Promise<StoredConciergeInboundReply | null> { return null; }
  async ignore() { return true; }
  async listReviewItems() { return []; }
}

describe("Concierge inbound reply ingestion", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CONCIERGE_EMAIL_INBOUND_ADDRESS = "concierge@replies.vyva.life";
    process.env.CONCIERGE_EMAIL_REPLY_SECRET = "reply-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("matches a signed provider reply to the original task and clears the old approval", async () => {
    const repository = new MemoryRepository();
    const result = await ingestConciergeInboundReply(message(), repository);

    expect(result).toMatchObject({
      status: "matched",
      pendingId,
      providerTaskStatus: "action_needed",
    });
    expect(repository.attached?.matchMethod).toBe("signed_recipient");
    expect(repository.attached?.patch).toMatchObject({
      provider_task_status: "action_needed",
      provider_reply_source: "live",
      provider_follow_up_requires_confirmation: true,
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
      execution_adapter: null,
      email_outcome: null,
      execution_task: {
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
      },
    });
    expect(repository.attached?.patch.execution_task).not.toHaveProperty("confirmed_at");
    expect(repository.attached?.patch.execution_task).not.toHaveProperty("approval_fingerprint");
    expect(repository.attached?.patch.execution_task).not.toHaveProperty("adapter_result");
  });

  it("ignores a duplicate provider event", async () => {
    const repository = new MemoryRepository();
    repository.duplicate = true;
    await expect(ingestConciergeInboundReply(message(), repository)).resolves.toMatchObject({
      status: "duplicate",
      reason: "already_received",
    });
    expect(repository.attached).toBeNull();
  });

  it("uses an exact unique provider sender when no signed route is present", async () => {
    const repository = new MemoryRepository();
    repository.pendingById = null;
    repository.senderMatches = [pending()];
    const result = await ingestConciergeInboundReply(message({
      recipientEmails: ["concierge@replies.vyva.life"],
      text: "The appointment is confirmed for Tuesday.",
    }), repository);
    expect(result.providerTaskStatus).toBe("reply_received");
    expect(repository.attached?.matchMethod).toBe("unique_sender");
  });

  it("queues an ambiguous sender for admin review", async () => {
    const repository = new MemoryRepository();
    repository.pendingById = null;
    repository.senderMatches = [pending(), pending({ id: "68bc37fb-7471-486d-9198-c9c9cd4cc430" })];
    const result = await ingestConciergeInboundReply(message({
      recipientEmails: ["concierge@replies.vyva.life"],
    }), repository);
    expect(result).toMatchObject({ status: "unmatched", reason: "multiple_open_tasks_for_sender" });
    expect(repository.unmatchedReason).toBe("multiple_open_tasks_for_sender");
  });

  it("does not auto-attach a signed reply from a different sender", async () => {
    const repository = new MemoryRepository();
    const result = await ingestConciergeInboundReply(message({ senderEmail: "unknown@example.net" }), repository);
    expect(result).toMatchObject({ status: "unmatched", reason: "provider_sender_mismatch" });
    expect(repository.attached).toBeNull();
  });

  it("stores the reply on the task and its completion-history receipt", async () => {
    const query = vi.fn(async (sqlValue: unknown) => {
      const sql = String(sqlValue).replace(/\s+/g, " ").trim().toLowerCase();
      if (sql.includes("select match_status")) return { rows: [{ match_status: "processing" }], rowCount: 1 };
      if (sql.includes("select id::text") && sql.includes("from concierge_pending")) {
        return { rows: [{ id: pendingId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    });
    const client = { query, release: vi.fn() };
    const database = { connect: vi.fn().mockResolvedValue(client) };
    const repository = new PostgresConciergeInboundReplyRepository(database as never);
    const classification = classifyConciergeInboundReply({
      text: "The booking is confirmed for Tuesday at 10.",
    });
    const patch = {
      ...pending().actionPayload,
      provider_task_status: "reply_received",
      provider_reply: classification.reply,
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
    };

    await expect(repository.attach({
      messageId: "11111111-1111-4111-8111-111111111111",
      pending: pending(),
      patch,
      classification,
      matchMethod: "signed_recipient",
    })).resolves.toBe(true);

    const historyCall = query.mock.calls.find(([sqlValue]) => String(sqlValue).includes("update concierge_sessions"));
    expect(historyCall).toBeDefined();
    const historyParams = historyCall?.[1] as unknown[] | undefined;
    expect(JSON.parse(String(historyParams?.[2]))).toMatchObject({
      provider_task_status: "reply_received",
      provider_reply: "The booking is confirmed for Tuesday at 10.",
      provider_follow_up_requires_confirmation: true,
      provider_follow_up_confirmed: false,
      no_external_action_without_confirmation: true,
    });
    expect(query.mock.calls.some(([sqlValue]) => String(sqlValue).includes("update concierge_pending"))).toBe(true);
    expect(client.release).toHaveBeenCalledOnce();
  });
});
