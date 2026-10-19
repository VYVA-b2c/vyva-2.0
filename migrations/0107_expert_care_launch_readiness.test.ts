import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("0107 Expert Care launch readiness migration", () => {
  it("keeps append-only, fully scoped clinical safety review evidence", async () => {
    const sql = await readFile(new URL("./0107_expert_care_launch_readiness.sql", import.meta.url), "utf8");
    expect(sql).toContain("expert_care_clinical_safety_reviews");
    expect(sql).toContain("source_policy_reviewed");
    expect(sql).toContain("emergency_boundaries_reviewed");
    expect(sql).toContain("sampled_outputs_reviewed");
    expect(sql).toContain("verdict <> 'approved'");
  });
});
