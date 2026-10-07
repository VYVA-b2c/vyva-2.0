import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0103_benefits_finder_findings.sql", import.meta.url), "utf8");

describe("Benefits Finder findings migration", () => {
  it("creates a table separate from the orphaned benefits_programs schema", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS benefits_finder_findings");
    expect(migration).not.toContain("benefits_programs");
    expect(migration).not.toContain("benefits_screening_responses");
  });

  it("carries the fields needed to show a finding without the live search result", () => {
    for (const column of ["user_id", "country", "category", "finding_summary", "source_name", "source_url", "accessed_at", "created_at"]) {
      expect(migration).toContain(column);
    }
  });

  it("scopes findings to the owning user and cascades on profile deletion", () => {
    expect(migration).toMatch(/user_id text NOT NULL REFERENCES profiles\(id\) ON DELETE CASCADE/);
  });
});
