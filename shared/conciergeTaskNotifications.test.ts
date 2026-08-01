import { describe, expect, it } from "vitest";
import { buildConciergeTaskNotificationDraft } from "./conciergeTaskNotifications";

describe("Concierge task notification drafts", () => {
  it("deep-links provider replies to the exact pending task", () => {
    const draft = buildConciergeTaskNotificationDraft({
      pendingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      inboundMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      providerName: "Harbour Clinic",
      summary: "Your appointment is confirmed for Tuesday.",
      actionNeeded: false,
    });
    expect(draft).toEqual({
      eventType: "provider_reply",
      title: "Harbour Clinic replied",
      body: "Your appointment is confirmed for Tuesday.",
      taskPath: "/concierge/tasks/pending%3Aaaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      dedupeKey: "provider-reply:email:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
  });

  it("makes an information request clear without exposing technical details", () => {
    const draft = buildConciergeTaskNotificationDraft({
      pendingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      inboundMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      providerName: "Harbour Clinic",
      summary: "Please confirm your insurance plan.",
      actionNeeded: true,
    });
    expect(draft.eventType).toBe("information_needed");
    expect(draft.title).toBe("Harbour Clinic needs information");
    expect(draft.body).toBe("Please confirm your insurance plan.");
  });
});
