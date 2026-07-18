import { describe, expect, it } from "vitest";
import {
  buildConciergeProviderActionNeededPatch,
  buildConciergeProviderReplyPatch,
  conciergeProviderReplySnapshot,
} from "./conciergeProviderReplies";

describe("Concierge provider replies", () => {
  it("normalizes simulated and live replies through the same contract", () => {
    for (const source of ["simulated", "live"] as const) {
      const payload = buildConciergeProviderReplyPatch({
        payload: { request_id: "request-1" },
        reply: "Tuesday at 10 works.",
        summary: "Provider confirmed Tuesday at 10.",
        source,
        receivedAt: "2026-07-18T10:00:00.000Z",
      });

      expect(conciergeProviderReplySnapshot(payload)).toMatchObject({
        status: "reply_received",
        source,
        reply: "Tuesday at 10 works.",
        followUpRequiresConfirmation: true,
      });
      expect(payload).toMatchObject({
        request_id: "request-1",
        provider_follow_up_confirmed: false,
        no_external_action_without_confirmation: true,
      });
    }
  });

  it("marks missing information as the next user action", () => {
    const payload = buildConciergeProviderActionNeededPatch({
      payload: {},
      question: "Which insurance plan do you use?",
      source: "live",
      receivedAt: "2026-07-18T10:00:00.000Z",
    });

    expect(conciergeProviderReplySnapshot(payload)).toMatchObject({
      status: "action_needed",
      summary: "Which insurance plan do you use?",
      followUpRequiresConfirmation: true,
    });
  });

  it("clears the previous send result when a new provider reply arrives", () => {
    const payload = buildConciergeProviderReplyPatch({
      payload: {
        execution_adapter: { version: 1, status: "sent", channel: "email", mode: "live" },
        email_outcome: "sent",
        provider_message_id: "old-message",
        execution_task: {
          version: 1,
          lifecycle_status: "confirmed",
          user_confirmed: true,
          external_action_allowed: true,
          execution_mode: "live",
          confirmed_at: "2026-07-18T09:00:00.000Z",
          approval_fingerprint: { version: 1, fingerprint: "old-approval" },
        },
      },
      reply: "Could you confirm your policy number?",
      summary: "Provider needs the policy number.",
      source: "live",
      receivedAt: "2026-07-18T10:00:00.000Z",
    });

    expect(payload).toMatchObject({
      execution_adapter: null,
      email_outcome: null,
      provider_message_id: null,
      provider_follow_up_confirmed: false,
      execution_task: expect.objectContaining({
        lifecycle_status: "ready",
        user_confirmed: false,
        external_action_allowed: false,
        execution_mode: "blocked",
      }),
    });
    expect(payload.execution_task).not.toHaveProperty("confirmed_at");
    expect(payload.execution_task).not.toHaveProperty("approval_fingerprint");
  });

  it("keeps no-answer tasks waiting and treats completed history as done", () => {
    const waiting = conciergeProviderReplySnapshot({
      provider_task_status: "waiting",
      waiting_for_provider: true,
      provider_last_contact_summary: "No answer from the clinic.",
    });
    expect(waiting?.status).toBe("waiting");
    expect(conciergeProviderReplySnapshot({ provider_reply: "Confirmed" }, { completed: true })?.status).toBe("done");
  });
});
