import { describe, expect, it } from "vitest";
import {
  isMissingOnConflictConstraintError,
  isMissingRelationError,
  isRelationSchemaUnavailableError,
  missingColumnName,
} from "../lib/dbCompatibility.js";
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
    expect(missingColumnName(new Error('column "trial_ends_at" of relation "profiles" does not exist'))).toBe("trial_ends_at");
    expect(missingColumnName(new Error("column profiles.subscription_tier does not exist"))).toBe("subscription_tier");
    expect(missingColumnName(new Error("duplicate key value violates unique constraint"))).toBeNull();
  });

  it("recognizes missing relation and conflict constraint messages", () => {
    expect(isMissingRelationError(new Error('relation "profile_memberships" does not exist'), "profile_memberships")).toBe(true);
    expect(isMissingRelationError(new Error('relation "profiles" does not exist'), "profile_memberships")).toBe(false);
    expect(isRelationSchemaUnavailableError(new Error('column "has_phone_number" of relation "onboarding_state" does not exist'), "onboarding_state")).toBe(true);
    expect(isMissingOnConflictConstraintError(new Error("there is no unique or exclusion constraint matching the ON CONFLICT specification"))).toBe(true);
  });
});
