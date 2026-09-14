import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "migrations/0076_orchestration_event_state_runtime.sql"),
  "utf8",
);

describe("Task 7 orchestration event/state migration", () => {
  it("creates only additive compatibility tables with replay and digest fields", () => {
    expect(migrationSql).toContain("create table if not exists public.orchestration_event_state_events");
    expect(migrationSql).toContain("create table if not exists public.orchestration_flow_state_projections");
    expect(migrationSql).toContain("normalized_event jsonb not null");
    expect(migrationSql).toContain("normalized_flow_state jsonb not null");
    expect(migrationSql).toContain("semantic_digest text not null");
    expect(migrationSql).not.toMatch(/\balter table public\.(session_state|session_exchanges|voice_timeline_events)\b/i);
  });

  it("declares durable idempotency, chain lookup and one-active-flow constraints", () => {
    expect(migrationSql).toContain("event_id text not null unique");
    expect(migrationSql).toContain("orchestration_event_state_events_correlation_idx");
    expect(migrationSql).toContain("orchestration_event_state_events_causation_idx");
    expect(migrationSql).toContain("orchestration_flow_state_projections_identity_unique");
    expect(migrationSql).toContain("orchestration_flow_state_projections_one_active_session_idx");
    expect(migrationSql).toContain("where is_active = true");
  });

  it("documents reviewed rollback without backfill or triggers", () => {
    expect(migrationSql).toContain("Rollback");
    expect(migrationSql).not.toMatch(/\bcreate trigger\b/i);
    expect(migrationSql).not.toMatch(/\binsert into public\.(?!orchestration_)/i);
  });
});
