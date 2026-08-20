import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./0083_replit_publish_runtime_schema.sql", import.meta.url),
  "utf8",
).toLowerCase();
const sqlStatements = sql.replace(/^--.*$/gm, "");

describe("Replit publish runtime schema migration", () => {
  it("repairs every relation reported missing by the publish logs", () => {
    expect(sql).toContain("add column if not exists is_trusted");
    expect(sql).toContain("create table if not exists public.home_fast_help_impressions");
    expect(sql).toContain("create table if not exists public.home_fast_help_journeys");
    expect(sql).toContain("create table if not exists public.home_fast_help_journey_events");
    expect(sql).toContain("create table if not exists public.cross_pillar_execution_attempts");
  });

  it("does not depend on Supabase auth objects in the Replit database", () => {
    expect(sqlStatements).not.toContain("auth.users");
    expect(sqlStatements).not.toContain("auth.uid()");
  });
});
