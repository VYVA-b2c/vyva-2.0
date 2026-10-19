import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./0105_expert_care_health_vault.sql", import.meta.url), "utf8");

describe("Expert Care encrypted record vault migration", () => {
  it("defines encrypted storage, per-item sharing, deletion, and audit history", () => {
    expect(migration).toContain("encrypted_payload jsonb");
    expect(migration).toContain("expert_care_document_sharing");
    expect(migration).toContain("expert_care_vault_audit");
    expect(migration).toContain("malware_status = 'clean'");
    expect(migration).toContain("deleted_at timestamptz");
  });
});
