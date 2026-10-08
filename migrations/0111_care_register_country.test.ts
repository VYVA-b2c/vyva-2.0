import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0111_care_register_country.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("care register country migration", () => {
  it("only adds columns and an index, repeatably", () => {
    expect(statements).not.toMatch(/drop|truncate|delete|rename/i);
    expect(statements.match(/add column if not exists country text not null default 'ES'/g)).toHaveLength(2);
    expect(statements).toContain("create index if not exists care_register_places_country_position_idx");
  });
  it("holds ISO country codes and no member data", () => {
    expect(statements.match(/check \(country ~ '\^\[A-Z\]\{2\}\$'\)/g)).toHaveLength(2);
    expect(statements).not.toMatch(/\buser_id\b|profiles\(|auth\.users/i);
  });
});
