import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0074_concierge_task_notifications.sql", import.meta.url), "utf8");

describe("Concierge task notifications migration", () => {
  it("adds preference-aware durable notifications with database deduplication", () => {
    expect(sql).toContain("add column if not exists concierge_task_notifications_enabled boolean not null default true");
    expect(sql).toContain("create table if not exists public.concierge_task_notifications");
    expect(sql).toContain("constraint concierge_task_notifications_dedupe_key_unique unique (dedupe_key)");
    expect(sql).toContain("constraint concierge_task_notifications_inbound_message_unique unique (inbound_message_id)");
    expect(sql).toContain("check (delivery_status in ('ready', 'suppressed'))");
    expect(sql).toContain("where delivery_status = 'ready' and read_at is null");
  });
});
