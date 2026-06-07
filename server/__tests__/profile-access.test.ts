import { describe, expect, it } from "vitest";
import { missingColumnName } from "../lib/dbCompatibility.js";
import { isMissingAccountProfileLinkColumnError } from "../lib/profileAccess.js";

describe("profile access schema compatibility", () => {
  it("recognizes missing account/profile link columns", () => {
    expect(isMissingAccountProfileLinkColumnError(
      new Error('column "active_profile_id" of relation "users" does not exist'),
    )).toBe(true);
    expect(isMissingAccountProfileLinkColumnError(
      new Error('column "users"."onboarding_intent" does not exist'),
    )).toBe(true);
    expect(isMissingAccountProfileLinkColumnError(
      new Error('column "profiles"."full_name" does not exist'),
    )).toBe(false);
  });

  it("extracts missing column names from common Postgres messages", () => {
    expect(missingColumnName(new Error('column "profiles"."trial_ends_at" does not exist'))).toBe("trial_ends_at");
    expect(missingColumnName(new Error("column profiles.subscription_tier does not exist"))).toBe("subscription_tier");
    expect(missingColumnName(new Error("duplicate key value violates unique constraint"))).toBeNull();
  });
});
