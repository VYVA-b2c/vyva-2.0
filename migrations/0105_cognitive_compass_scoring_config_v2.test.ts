import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0105_cognitive_compass_scoring_config_v2.sql", import.meta.url), "utf8");

describe("Cognitive Compass scoring config v2 migration", () => {
  it("is data-only and repeatable", () => {
    expect(sql).not.toMatch(/\b(drop|truncate|delete|alter|create)\b/i);
    expect(sql.match(/update public\.cc_task_definitions/g)?.length).toBe(6);
  });

  it("drops the Wechsler lineage label and cites the PHQ-2 cut-off", () => {
    expect(sql).toContain('"reference": "narrative_recall_idea_units"');
    expect(sql).toContain("Med Care. 2003;41(11):1284-1292");
    expect(sql).toContain("scoring_config - 'threshold_flag'");
  });
});
