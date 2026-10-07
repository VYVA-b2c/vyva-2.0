import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0109_care_register_places.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("care register places migration", () => {
  it("is repeatable and additive", () => {
    expect(statements).toContain("create table if not exists public.care_register_places");
    expect(statements.match(/create index if not exists/g)).toHaveLength(3);
    expect(statements).not.toMatch(/drop|truncate|alter table/i);
  });
  it("keys places by the permanent REGCESS code and records the file date", () => {
    expect(statements).toContain("ccn text primary key");
    expect(statements).toContain("source_updated_on date not null");
  });
  it("holds no member data", () => {
    expect(statements).not.toMatch(/\buser_id\b|profiles\(|auth\.users/i);
  });
});
