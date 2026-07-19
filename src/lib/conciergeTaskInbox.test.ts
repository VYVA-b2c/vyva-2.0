import { describe, expect, it } from "vitest";
import type { ConciergeTaskDraft } from "../../shared/conciergeTaskDrafts";
import { buildConciergeProviderActionNeededPatch } from "../../shared/conciergeProviderReplies";
import {
  buildConciergeTaskInbox,
  findConciergeTaskInboxItem,
  type ConciergeTaskCompletedSession,
  type ConciergeTaskPendingItem,
} from "./conciergeTaskInbox";
import {
  conciergeTaskInboxItemPath,
  conciergeTaskNotificationPath,
  conciergeTaskResumePath,
  parseConciergeTaskInboxKey,
} from "../../shared/conciergeTaskLinks";

function draft(overrides: Partial<ConciergeTaskDraft> = {}): ConciergeTaskDraft {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    user_id: "user-1",
    kind: "appointment",
    entry_payload: { kind: "appointment", appointmentKind: "medical" },
    progress_payload: {},
    stage: "review",
    status: "active",
    linked_pending_id: null,
    language: "en",
    created_at: "2026-07-18T08:00:00.000Z",
    updated_at: "2026-07-18T09:00:00.000Z",
    completed_at: null,
    deleted_at: null,
    ...overrides,
  };
}

function pending(overrides: Partial<ConciergeTaskPendingItem> = {}): ConciergeTaskPendingItem {
  return {
    id: "pending-1",
    use_case: "book_appointment",
    provider_name: "Harbour Clinic",
    action_summary: "Ask Harbour Clinic for an appointment.",
    action_payload: {},
    status: "pending",
    confirmed_at: "2026-07-18T09:30:00.000Z",
    updated_at: "2026-07-18T09:30:00.000Z",
    ...overrides,
  };
}

describe("Concierge task inbox", () => {
  it("groups tasks and de-duplicates a pending action linked to a saved draft", () => {
    const linkedDraft = draft({ linked_pending_id: "reply-1" });
    const replyPayload = buildConciergeProviderActionNeededPatch({
      payload: { email_subject: "Appointment request" },
      question: "Please confirm your insurance plan.",
      source: "live",
      receivedAt: "2026-07-18T10:00:00.000Z",
    });
    const inbox = buildConciergeTaskInbox({
      drafts: [linkedDraft],
      pending: [
        pending({ id: "reply-1", action_payload: replyPayload, updated_at: "2026-07-18T10:00:00.000Z" }),
        pending({
          id: "waiting-1",
          provider_name: "Saved Plumber",
          use_case: "home_service",
          action_payload: { waiting_for_provider: true, mission_status: "awaiting_provider_reply" },
          status: "calling",
        }),
      ],
      completed: [],
    });

    expect(inbox.needs_you).toHaveLength(1);
    expect(inbox.waiting).toHaveLength(1);
    expect(inbox.needs_you[0]).toMatchObject({
      id: "reply-1",
      draftId: linkedDraft.id,
      pendingId: "reply-1",
      statusLabel: "Needs your reply",
      primaryActionLabel: "Respond",
      reply: "Please confirm your insurance plan.",
      resumePath: `/concierge/task/${linkedDraft.id}`,
    });
    expect(inbox.waiting[0]).toMatchObject({ statusLabel: "Waiting for reply", primaryActionLabel: "View status" });
  });

  it("preserves provider replies, decisions, and outcomes in completed task details", () => {
    const completed: ConciergeTaskCompletedSession = {
      id: "session-1",
      pending_id: "pending-1",
      use_case: "book_appointment",
      provider_name: "Harbour Clinic",
      outcome: "completed",
      outcome_summary: "Appointment confirmed for Tuesday.",
      completed_at: "2026-07-18T12:00:00.000Z",
      outcome_payload: {
        provider_task_status: "done",
        provider_reply: "Tuesday at 10:00 is confirmed. Reference AP-77.",
        provider_response_summary: "Tuesday at 10:00 is confirmed.",
        provider_reply_decisions: [{
          action: "confirm",
          status: "completed",
          recordedAt: "2026-07-18T11:50:00.000Z",
          channel: "email",
          summary: "Confirmed Tuesday at 10:00.",
          requiresFreshConfirmation: true,
        }],
      },
    };

    const inbox = buildConciergeTaskInbox({ drafts: [], pending: [], completed: [completed] });
    expect(inbox.completed[0]).toMatchObject({
      reply: "Tuesday at 10:00 is confirmed. Reference AP-77.",
      decisionSummary: "Confirmed Tuesday at 10:00.",
      outcomeSummary: "Appointment confirmed for Tuesday.",
      primaryActionLabel: "Use again",
      completedTemplate: completed,
    });
  });

  it("resolves notification keys to the linked saved task and uses canonical exact-task paths", () => {
    const linkedDraft = draft({ linked_pending_id: "pending-1" });
    const inbox = buildConciergeTaskInbox({
      drafts: [linkedDraft],
      pending: [pending()],
      completed: [],
    });

    expect(findConciergeTaskInboxItem(inbox, "pending", "pending-1")?.resumePath)
      .toBe(conciergeTaskResumePath(linkedDraft.id));
    expect(conciergeTaskInboxItemPath("pending", "pending-1"))
      .toBe("/concierge/tasks/pending%3Apending-1");
    expect(conciergeTaskNotificationPath("pending-1"))
      .toBe("/concierge/task/pending-1");
    expect(parseConciergeTaskInboxKey("pending:pending-1"))
      .toEqual({ source: "pending", id: "pending-1" });
  });
});
