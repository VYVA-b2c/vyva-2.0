import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0112_care_register_france.sql", import.meta.url), "utf8");
const statements = sql.replace(/--.*$/gm, "");

describe("care register France migration", () => {
  it("only widens the listing and geocode-source checks, keeping every Spanish value", () => {
    expect(statements).not.toMatch(/truncate|delete|rename|drop (table|column)/i);
    expect(statements.match(/drop constraint if exists/g)).toHaveLength(2);
    expect(statements).toContain("check (listing in ('C1', 'C2', 'C3', 'E', 'RPPS', 'FINESS'))");
    expect(statements).toContain("check (geocode_source in ('regional_register', 'cartociudad', 'register', 'ban'))");
  });
  it("adds the same-town index repeatably and touches no member data", () => {
    expect(statements).toContain("create index if not exists care_register_places_country_town_idx");
    expect(statements).not.toMatch(/\buser_id\b|profiles\(|auth\.users/i);
  });
});
