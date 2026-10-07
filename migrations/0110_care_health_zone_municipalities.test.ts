import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0110_care_health_zone_municipalities.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("care health zone municipalities migration", () => {
  it("is repeatable and additive", () => {
    expect(statements).toContain("create table if not exists public.care_health_zone_municipalities");
    expect(statements).not.toMatch(/drop|truncate|alter table/i);
  });
  it("keys rows by 5-digit INE municipality code and names its source", () => {
    expect(statements).toContain("check (municipality_code ~ '^[0-9]{5}$')");
    expect(statements).toContain("source text not null");
  });
  it("holds no member data", () => {
    expect(statements).not.toMatch(/\buser_id\b|profiles\(|auth\.users/i);
  });
});
