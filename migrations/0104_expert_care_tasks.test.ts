import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0104_expert_care_tasks.sql", import.meta.url), "utf8");

describe("Expert Care Concierge task migration", () => {
  it("allows the dedicated task kind and indexes legacy imports", () => {
    expect(migration).toContain("'expert_care'");
    expect(migration).toContain("legacySourceTaskId");
    expect(migration).toContain("where kind = 'expert_care' and status = 'active'");
  });
});
