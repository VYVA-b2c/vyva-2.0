import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  careTeamInviteTokenFromReturnPath,
  clearCareTeamInviteReturnPath,
  currentCareTeamInviteReturnPath,
  isCareTeamInviteReturnPath,
  normalizeCareTeamInviteReturnPath,
  rememberCareTeamInviteReturnPath,
} from "./careTeamInviteReturn";

describe("careTeamInviteReturn", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  it("accepts only care-team invite return paths with a token", () => {
    expect(normalizeCareTeamInviteReturnPath("/care-team/invite/token-123")).toBe("/care-team/invite/token-123");
    expect(isCareTeamInviteReturnPath("/care-team/invite/token-123?lang=es")).toBe(true);
    expect(normalizeCareTeamInviteReturnPath("/care-team/invite/")).toBeNull();
    expect(normalizeCareTeamInviteReturnPath("/onboarding/who-for")).toBeNull();
    expect(normalizeCareTeamInviteReturnPath("//evil.example/care-team/invite/token-123")).toBeNull();
  });

  it("stores, reads, and clears the pending care-team invite return path", () => {
    rememberCareTeamInviteReturnPath("/care-team/invite/token-123");

    expect(currentCareTeamInviteReturnPath()).toBe("/care-team/invite/token-123");

    clearCareTeamInviteReturnPath();

    expect(currentCareTeamInviteReturnPath()).toBeNull();
  });

  it("extracts encoded invite tokens for auth payloads", () => {
    expect(careTeamInviteTokenFromReturnPath("/care-team/invite/token%20123")).toBe("token 123");
    expect(careTeamInviteTokenFromReturnPath("/login")).toBeNull();
  });
});

