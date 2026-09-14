import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "migrations/0077_proactive_engagement_shadow_audit.sql"),
  "utf8",
);

describe("Task 8 proactive engagement audit-shadow migration", () => {
  it("creates only the additive Task 8 shadow-audit table", () => {
    expect(migrationSql).toContain("create table if not exists public.proactive_engagement_shadow_audits");
    expect(migrationSql).toContain("shadow_only boolean not null default true");
    expect(migrationSql).toContain("non_executable boolean not null default true");
    expect(migrationSql).not.toMatch(/\balter table public\.(scheduled_interactions|communications_log|consent_audit_logs|user_channel_preferences)\b/i);
    expect(migrationSql).not.toMatch(/\bdrop table\b/i);
    expect(migrationSql).not.toMatch(/\bcreate trigger\b/i);
  });

  it("declares deterministic idempotency and digest constraints", () => {
    expect(migrationSql).toContain("audit_id text not null unique");
    expect(migrationSql).toContain("idempotency_key text not null unique");
    expect(migrationSql).toContain("semantic_digest text not null");
    expect(migrationSql).toContain("proactive_engagement_shadow_audits_digest_shape");
    expect(migrationSql).toContain("proactive_engagement_shadow_audits_occurrence_idx");
  });

  it("documents disabling the audit-shadow flag before retention-reviewed rollback", () => {
    expect(migrationSql).toContain("disable VYVA_ENGAGEMENT_AUDIT_SHADOW_MODE");
    expect(migrationSql).toContain("reviewed retention approval");
    expect(migrationSql).not.toMatch(/\binsert into public\.(?!proactive_engagement_shadow_audits)/i);
  });
});
