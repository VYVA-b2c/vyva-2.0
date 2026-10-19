import { readFileSync } from "node:fs";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  expertCareDocuments,
  expertCareDocumentSharing,
  expertCareVaultAudit,
} from "../shared/schema.js";

const migration = readFileSync(new URL("./0105_expert_care_health_vault.sql", import.meta.url), "utf8");

describe("Expert Care encrypted record vault migration", () => {
  it("defines encrypted storage, per-item sharing, deletion, and audit history", () => {
    expect(migration).toContain("encrypted_payload jsonb");
    expect(migration).toContain("expert_care_document_sharing");
    expect(migration).toContain("expert_care_vault_audit");
    expect(migration).toContain("malware_status = 'clean'");
    expect(migration).toContain("deleted_at timestamptz");
  });

  it("keeps every permanent vault table registered in the deployment schema", () => {
    expect([
      getTableName(expertCareDocuments),
      getTableName(expertCareDocumentSharing),
      getTableName(expertCareVaultAudit),
    ]).toEqual([
      "expert_care_documents",
      "expert_care_document_sharing",
      "expert_care_vault_audit",
    ]);
  });
});
