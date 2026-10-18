import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0107_provider_job_outcomes.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("provider job outcomes migration", () => {
  it("is repeatable and additive", () => {
    expect(statements).toContain("create table if not exists public.provider_job_outcomes");
    expect(statements).not.toMatch(/drop|truncate|alter table/i);
  });
  it("keeps one answer per request and is deleted with it", () => {
    expect(statements).toContain("request_id uuid primary key references public.appointment_requests(id) on delete cascade");
  });
  it("has no direct user reference, so neither user-id convention is bypassed", () => {
    expect(statements).not.toMatch(/\buser_id\b|profiles|auth\.users/i);
  });
});
