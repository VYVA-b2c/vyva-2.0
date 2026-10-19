import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { conciergeTaskDrafts } from "../shared/schema.js";

const migration = readFileSync(new URL("./0104_expert_care_tasks.sql", import.meta.url), "utf8");

describe("Expert Care Concierge task migration", () => {
  it("allows the dedicated task kind and indexes legacy imports", () => {
    expect(migration).toContain("'expert_care'");
    expect(migration).toContain("legacySourceTaskId");
    expect(migration).toContain("where kind = 'expert_care' and status = 'active'");
  });

  it("keeps the legacy resume index registered in the deployment schema", () => {
    const config = getTableConfig(conciergeTaskDrafts);
    expect(config.indexes.map((item) => item.config.name)).toContain(
      "concierge_task_drafts_expert_care_legacy_idx",
    );
  });
});
