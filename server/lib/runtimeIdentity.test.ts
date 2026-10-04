import { describe, expect, it } from "vitest";
import { runtimeIdentity } from "./runtimeIdentity.js";

describe("runtime identity", () => {
  it("uses the same configuration precedence as the database client", () => {
    expect(runtimeIdentity({ DATABASE_URL: "postgres://one/db", POSTGRES_URL: "postgres://two/db" }))
      .toEqual(runtimeIdentity({ DATABASE_URL: "postgres://one/db" }));
  });

  it("does not expose credentials or change identity after credential rotation", () => {
    const first = runtimeIdentity({ DATABASE_URL: "postgres://alice:secret@host/db?sslmode=require" });
    const second = runtimeIdentity({ DATABASE_URL: "postgres://bob:other@host:5432/db" });
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(/alice|secret|host|sslmode/);
  });

  it("distinguishes database targets", () => {
    expect(runtimeIdentity({ DATABASE_URL: "postgres://host/dev" }).databaseTargetFingerprint)
      .not.toBe(runtimeIdentity({ DATABASE_URL: "postgres://host/prod" }).databaseTargetFingerprint);
  });

  it("handles missing or invalid configuration without leaking it", () => {
    expect(runtimeIdentity({}).databaseTargetFingerprint).toBeNull();
    expect(runtimeIdentity({ DATABASE_URL: "secret-invalid" }).databaseTargetFingerprint).toBeNull();
  });
});
