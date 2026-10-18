import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0106_provider_reputation.sql", import.meta.url), "utf8");

describe("provider reputation migration", () => {
  it("is repeatable, additive and keyed per business, service and language", () => {
    expect(sql).toContain("create table if not exists public.provider_reputation");
    expect(sql).toContain("primary key (place_id, service_type, language)");
    expect(sql).not.toMatch(/drop|truncate|alter table/i);
  });
  it("holds no member data", () => {
    const statements = sql.replace(/--.*$/gm, "");
    expect(statements).not.toMatch(/\buser_id\b|\brequest_id\b|profiles|auth\.users/i);
  });
});
