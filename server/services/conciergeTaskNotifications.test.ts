import { describe, expect, it, vi } from "vitest";
import { createConciergeTaskNotificationWithClient } from "./conciergeTaskNotifications";

const input = {
  userId: "user-1",
  pendingId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  inboundMessageId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  providerName: "Harbour Clinic",
  summary: "Please confirm your insurance plan.",
  actionNeeded: true,
};

describe("Concierge task notification delivery", () => {
  it("creates one visible alert and relies on a unique dedupe key for retries", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ concierge_task_notifications_enabled: true }] })
      .mockResolvedValueOnce({ rows: [{ id: "notification-1" }] })
      .mockResolvedValueOnce({ rows: [{ concierge_task_notifications_enabled: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query } as never;

    await expect(createConciergeTaskNotificationWithClient(client, input)).resolves.toEqual({
      created: true,
      deliveryStatus: "ready",
    });
    await expect(createConciergeTaskNotificationWithClient(client, input)).resolves.toEqual({
      created: false,
      deliveryStatus: "ready",
    });

    const insertSql = String(query.mock.calls[1][0]);
    const insertValues = query.mock.calls[1][1] as unknown[];
    expect(insertSql).toContain("on conflict (dedupe_key) do nothing");
    expect(insertValues).toContain("provider-reply:email:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(insertValues).toContain("/concierge/tasks/pending%3Aaaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

  it("records but suppresses an alert when the user turned task updates off", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ concierge_task_notifications_enabled: false }] })
      .mockResolvedValueOnce({ rows: [{ id: "notification-1" }] });

    await expect(createConciergeTaskNotificationWithClient({ query } as never, input)).resolves.toEqual({
      created: true,
      deliveryStatus: "suppressed",
    });
    expect(query.mock.calls[1][1]).toContain("suppressed");
  });
});
