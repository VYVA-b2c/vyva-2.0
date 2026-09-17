import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0103_concierge_schema_additions.sql", import.meta.url), "utf8");

describe("Concierge schema additions migration", () => {
  it("creates a structured transport_requests table linked back to concierge_pending", () => {
    expect(migration).toContain("create table if not exists transport_requests");
    expect(migration).toContain("pickup_address text");
    expect(migration).toContain("destination_address text");
    expect(migration).toContain("references concierge_pending(id) on delete set null");
  });

  it("creates provider_search_requests and provider_shortlist_items", () => {
    expect(migration).toContain("create table if not exists provider_search_requests");
    expect(migration).toContain("create table if not exists provider_shortlist_items");
    expect(migration).toContain("references provider_search_requests(id) on delete cascade");
  });

  it("creates concierge_shopping_requests and concierge_shopping_request_items", () => {
    expect(migration).toContain("create table if not exists concierge_shopping_requests");
    expect(migration).toContain("create table if not exists concierge_shopping_request_items");
    expect(migration).toContain("references concierge_shopping_requests(id) on delete cascade");
  });

  it("adds structured scheduling columns to concierge_pending instead of relying on jsonb", () => {
    const alterBlock = migration.split("alter table concierge_pending")[1] ?? "";
    expect(alterBlock).toContain("add column if not exists scheduled_for timestamptz");
    expect(alterBlock).toContain("add column if not exists due_at timestamptz");
    expect(alterBlock).toContain("add column if not exists location text");
  });

  it("adds the missing hot-path indexes on concierge_pending and concierge_task_drafts", () => {
    expect(migration).toContain("create index if not exists concierge_pending_user_status_idx\n  on concierge_pending (user_id, status);");
    expect(migration).toContain("concierge_task_drafts_user_status_updated_idx");
  });

  it("links home_scans and scam_checks back to the concierge task that started them", () => {
    const homeScansBlock = migration.split("alter table home_scans")[1] ?? "";
    expect(homeScansBlock).toContain("add column if not exists linked_pending_id");
    expect(homeScansBlock).toContain("add column if not exists source text");

    const scamChecksBlock = migration.split("alter table scam_checks")[1] ?? "";
    expect(scamChecksBlock).toContain("add column if not exists linked_pending_id");
  });

  it("uses additive, non-destructive statements only (create ... if not exists / add column if not exists)", () => {
    expect(migration).not.toMatch(/drop table/i);
    expect(migration).not.toMatch(/drop column/i);
    expect(migration).not.toMatch(/\balter column\b/i);
  });
});
