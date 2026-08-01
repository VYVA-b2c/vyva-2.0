import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  conciergeInboundEmailRoutingConfigured,
  conciergeReplyAddressForPendingTask,
  pendingIdFromConciergeReplyRecipient,
} from "./conciergeInboundEmailRouting";

const originalEnv = { ...process.env };
const pendingId = "0f83cc56-6226-4ca4-a7e2-aa2967addd4a";

describe("Concierge inbound email routing", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CONCIERGE_EMAIL_INBOUND_ADDRESS = "concierge@replies.vyva.life";
    process.env.CONCIERGE_EMAIL_REPLY_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("builds and verifies a task-specific reply address", () => {
    const address = conciergeReplyAddressForPendingTask(pendingId);
    expect(address).toMatch(/^concierge\+vyva\./);
    expect(pendingIdFromConciergeReplyRecipient(address)).toBe(pendingId);
    expect(conciergeInboundEmailRoutingConfigured()).toBe(true);
  });

  it("rejects a tampered task route", () => {
    const address = conciergeReplyAddressForPendingTask(pendingId)!;
    expect(pendingIdFromConciergeReplyRecipient(address.replace(/\.[0-9a-f]{24}@/, ".000000000000000000000000@")))
      .toBeNull();
  });

  it("does not create routing addresses without explicit configuration", () => {
    delete process.env.CONCIERGE_EMAIL_INBOUND_ADDRESS;
    delete process.env.CONCIERGE_EMAIL_REPLY_ADDRESS;
    delete process.env.NOTIFY_REPLY_TO_EMAIL;
    expect(conciergeReplyAddressForPendingTask(pendingId)).toBeNull();
  });
});
