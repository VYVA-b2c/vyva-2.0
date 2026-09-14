import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  fileURLToPath(new URL("./0092_voice_consultation_summaries.sql", import.meta.url)),
  "utf8",
);

describe("voice consultation summaries migration", () => {
  it("stores structured continuity with idempotent conversation identity", () => {
    expect(sql).toContain("create table if not exists public.voice_consultation_summaries");
    expect(sql).toContain("conversation_id text not null unique");
    expect(sql).toContain("normalized_answers jsonb");
    expect(sql).toContain("reported_vitals jsonb");
    expect(sql).toContain("check (status in ('complete', 'emergency'))");
    expect(sql).toContain("from public.voice_triage_sessions session");
    expect(sql).toContain("on conflict (conversation_id) do nothing");
  });

  it("does not define raw transcript or audio storage", () => {
    const definition = sql.slice(
      sql.indexOf("create table if not exists public.voice_consultation_summaries"),
      sql.indexOf("create index if not exists voice_consultation_summaries_user_completed_idx"),
    );
    expect(definition).not.toMatch(/\btranscript\b/i);
    expect(definition).not.toMatch(/\baudio\b/i);
  });
});
