import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./0085_unified_vitals_acquisition.sql", import.meta.url), "utf8").toLowerCase();

describe("unified vitals acquisition migration", () => {
  it("extends the canonical device registry additively", () => {
    expect(sql).toContain("alter table public.user_device_connections");
    expect(sql).toContain("add column if not exists device_kind text");
    expect(sql).toContain("add column if not exists capabilities text[]");
    expect(sql).toContain("add column if not exists assessment_session_id text");
    expect(sql).toContain("user_device_connections_user_provider_kind_unique");
  });

  it("does not delete device or reading data", () => {
    expect(sql).not.toMatch(/\bdrop\s+(table|column)\b/);
    expect(sql).not.toMatch(/\bdelete\s+from\b/);
  });
});
