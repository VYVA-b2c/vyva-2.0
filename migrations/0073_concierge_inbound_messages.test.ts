import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0073_concierge_inbound_messages.sql", import.meta.url), "utf8");

describe("Concierge inbound messages migration", () => {
  it("stores durable, deduplicated receipts and review state", () => {
    expect(sql).toContain("create table if not exists concierge_inbound_messages");
    expect(sql).toContain("constraint concierge_inbound_messages_channel_event_unique unique (channel, provider_event_id)");
    expect(sql).toContain("constraint concierge_inbound_messages_webhook_event_unique unique (webhook_event_id)");
    expect(sql).toContain("matched_pending_id uuid references concierge_pending(id) on delete set null");
    expect(sql).toContain("review_status text not null default 'pending'");
    expect(sql).toContain("create index if not exists concierge_inbound_messages_review_idx");
  });
});
