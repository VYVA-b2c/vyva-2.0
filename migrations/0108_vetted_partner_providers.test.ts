import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0108_vetted_partner_providers.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("vetted partner providers migration", () => {
  it("is repeatable and additive", () => {
    expect(statements).toContain("create table if not exists public.vetted_partner_organisations");
    expect(statements).toContain("create table if not exists public.vetted_partner_providers");
    expect(statements).not.toMatch(/drop|truncate|alter table/i);
  });
  it("starts providers inactive and only allows activation after review", () => {
    expect(statements).toContain("is_active boolean not null default false");
    expect(statements).toContain("check (not is_active or reviewed_at is not null)");
  });
  it("holds no member data", () => {
    expect(statements).not.toMatch(/\buser_id\b|profiles\(|auth\.users/i);
  });
});
