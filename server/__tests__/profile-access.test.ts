import { describe, expect, it } from "vitest";
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
});
