import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./0084_replit_publish_schema_parity.sql", import.meta.url),
  "utf8",
).toLowerCase();
const sqlStatements = sql.replace(/^--.*$/gm, "");

describe("Replit publish schema parity migration", () => {
  it("places preventive push preferences on user_channel_preferences", () => {
    expect(sql).toContain("alter table public.user_channel_preferences");
    expect(sql).toContain(
      "add column if not exists preventive_web_push_enabled boolean not null default false",
    );
    expect(sql).toContain(
      "add column if not exists preventive_web_push_consent_revision integer not null default 0",
    );
    expect(sql).toContain("preventive_web_push_consent_updated_at timestamptz");
    expect(sql).toContain("preventive_web_push_consent_granted_at timestamptz");
    expect(sql).toContain("preventive_web_push_consent_revoked_at timestamptz");
  });

  it("places preventive check-in result fields on checkin_sessions", () => {
    expect(sql).toContain("alter table public.checkin_sessions");
    expect(sql).toContain("add column if not exists why_today text");
    expect(sql).toContain("add column if not exists trend_note text");
    expect(sql).toContain("add column if not exists personal_plan text");
    expect(sql).toContain("add column if not exists app_suggestion text");
    expect(sql).toContain("add column if not exists suggested_app_action text");
    expect(sql).toContain("add column if not exists orchestration_flow_id text");
    expect(sql).toContain("checkin_sessions_task9_completion_unique_idx");
  });

  it("is additive and safe to run repeatedly", () => {
    expect(sqlStatements).not.toMatch(/\bdrop\s+(table|column|index|constraint)\b/i);
    expect(sqlStatements).not.toMatch(/\bdelete\s+from\b/i);
    expect(sqlStatements).not.toMatch(/\bupdate\s+/i);
    expect(sqlStatements).not.toMatch(/\binsert\s+into\b/i);
  });
});
