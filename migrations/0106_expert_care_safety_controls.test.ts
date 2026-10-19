import { readFileSync } from "node:fs";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { expertCareRuntimeControl, expertCareSafetyEvents } from "../shared/schema.js";

const migration = readFileSync(new URL("./0106_expert_care_safety_controls.sql", import.meta.url), "utf8");

describe("Expert Care safety controls migration", () => {
  it("persists launch metrics and a reviewed circuit breaker", () => {
    expect(migration).toContain("expert_care_safety_events");
    expect(migration).toContain("expert_care_runtime_control");
    expect(migration).toContain("unsupported_claim_detected");
    expect(migration).toContain("privacy_failure");
    expect(migration).toContain("force_disabled boolean not null default false");
    expect(migration).toContain("Deleting an incident never re-enables");
  });

  it("keeps both safety tables registered in the deployment schema", () => {
    expect(getTableName(expertCareSafetyEvents)).toBe("expert_care_safety_events");
    expect(getTableName(expertCareRuntimeControl)).toBe("expert_care_runtime_control");
  });
});
