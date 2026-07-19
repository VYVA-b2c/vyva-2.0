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
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";

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
    expect(inbox.needs_you[0].continuation).toMatchObject({
      flow: "provider_reply",
      state: "needs_info",
      stateLabel: "Needs information",
      actionLabel: "Respond",
    });
    expect(inbox.waiting[0].continuation).toMatchObject({
      flow: "home_service",
      state: "waiting",
      stateLabel: "Waiting",
    });
  });

  it("normalizes Canvas continuation states across draft, waiting, blocked, and future flows", () => {
    const rideReady = draft({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      kind: "transport",
      entry_payload: { kind: "transport" },
      progress_payload: { canvasStep: "review" },
      stage: "review",
      updated_at: "2026-07-18T11:00:00.000Z",
    });
    const appointmentDraft = draft({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      kind: "appointment",
      entry_payload: { kind: "appointment", appointmentKind: "medical" },
      progress_payload: { canvasStep: "reason" },
      stage: "details",
      updated_at: "2026-07-18T10:00:00.000Z",
    });
    const shoppingWaiting = pending({
      id: "shopping-waiting",
      use_case: "shopping_request",
      provider_name: "Local Market",
      action_payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
        live_handoff_status: "sent_or_called",
      },
      status: "calling",
      updated_at: "2026-07-18T12:00:00.000Z",
    });
    const refillBlocked = pending({
      id: "refill-blocked",
      use_case: "order_medicine",
      provider_name: "Saved Pharmacy",
      action_payload: {
        flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
        live_handoff_status: "failed",
      },
      status: "failed",
      updated_at: "2026-07-18T13:00:00.000Z",
    });
    const futureCompleted: ConciergeTaskCompletedSession = {
      id: "future-session",
      pending_id: "future-pending",
      use_case: "future_concierge_flow",
      provider_name: null,
      outcome: "completed",
      outcome_summary: "Future task completed.",
      completed_at: "2026-07-18T14:00:00.000Z",
      outcome_payload: {},
    };

    const inbox = buildConciergeTaskInbox({
      drafts: [rideReady, appointmentDraft],
      pending: [shoppingWaiting, refillBlocked],
      completed: [futureCompleted],
      now: "2026-07-19T09:00:00.000Z",
    });

    expect(findConciergeTaskInboxItem(inbox, "draft", rideReady.id)?.continuation)
      .toMatchObject({ flow: "ride", state: "ready_to_confirm", sceneLabel: "Review", actionLabel: "Review and confirm" });
    expect(findConciergeTaskInboxItem(inbox, "draft", appointmentDraft.id)?.continuation)
      .toMatchObject({ flow: "appointment", state: "draft", sceneLabel: "Reason", actionLabel: "Continue" });
    expect(findConciergeTaskInboxItem(inbox, "pending", "shopping-waiting")?.continuation)
      .toMatchObject({ flow: "shopping", state: "waiting", sceneLabel: "Waiting", actionLabel: "View status" });
    expect(findConciergeTaskInboxItem(inbox, "pending", "refill-blocked")?.continuation)
      .toMatchObject({ flow: "refill", state: "blocked", sceneLabel: "Blocked", actionLabel: "Review task" });
    expect(findConciergeTaskInboxItem(inbox, "completed", "future-session")?.continuation)
      .toMatchObject({ flow: "future", state: "completed", sceneLabel: "Completed", actionLabel: "Use again" });
  });

  it("flags stale pending tasks as needs-you review without changing the safe resume path", () => {
    const inbox = buildConciergeTaskInbox({
      drafts: [],
      pending: [pending({
        id: "expired-ride",
        use_case: "book_ride",
        provider_name: "Radio Taxi",
        action_payload: {
          flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
          live_handoff_status: "sent_or_called",
        },
        status: "calling",
        expires_at: "2026-07-18T09:00:00.000Z",
        updated_at: "2026-07-18T09:00:00.000Z",
      })],
      completed: [],
      now: "2026-07-19T09:00:00.000Z",
    });

    const item = findConciergeTaskInboxItem(inbox, "pending", "expired-ride");
    expect(item?.group).toBe("needs_you");
    expect(item?.resumePath).toBe(conciergeTaskResumePath("expired-ride"));
    expect(item?.continuation).toMatchObject({
      flow: "ride",
      state: "blocked",
      stale: true,
      stateLabel: "Needs refresh",
      actionLabel: "Review safely",
    });
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
