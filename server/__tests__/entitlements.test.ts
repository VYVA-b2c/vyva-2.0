import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveProfileContext: vi.fn(),
  entitlementForTier: vi.fn(),
  normalizeSubscriptionTier: vi.fn((tier: string | null | undefined) => tier ?? "free"),
  syncProfileEntitlement: vi.fn(),
  db: {
    select: vi.fn(),
  },
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: mocks.getActiveProfileContext,
}));

vi.mock("../lib/plans.js", () => ({
  entitlementForTier: mocks.entitlementForTier,
  normalizeSubscriptionTier: mocks.normalizeSubscriptionTier,
}));

vi.mock("../lib/entitlementSync.js", () => ({
  syncProfileEntitlement: mocks.syncProfileEntitlement,
}));

vi.mock("../db.js", () => ({
  db: mocks.db,
}));

const { requireEntitlement } = await import("../middleware/entitlements.js");

type MockProfile = {
  id: string;
  account_status?: string | null;
};

function mockProfileLookup(profile: MockProfile | null) {
  const limit = vi.fn().mockResolvedValue(profile ? [profile] : []);
  const where = vi.fn(() => ({ limit }));
  const from = vi.fn(() => ({ where }));
  mocks.db.select.mockReturnValue({ from });
}

function buildApp() {
  const app = express();
  app.get(
    "/voice",
    (req, _res, next) => {
      req.user = { id: "account-user-1" } as Express.User;
      next();
    },
    requireEntitlement("voice_assistant"),
    (_req, res) => res.json({ ok: true }),
  );
  return app;
}

describe("requireEntitlement account/profile diagnostics", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "account-user-1",
      profileId: "profile-1",
      role: "elder",
      profileCount: 1,
      needsProfileSetup: false,
      needsProfileSelection: false,
    });
  });

  it("returns a distinct code when no active profile is selected", async () => {
    process.env.NODE_ENV = "production";
    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "account-user-1",
      profileId: null,
      role: null,
      profileCount: 0,
      needsProfileSetup: true,
      needsProfileSelection: false,
    });

    const res = await request(buildApp()).get("/voice").expect(409);

    expect(res.body).toMatchObject({
      code: "ACTIVE_PROFILE_REQUIRED",
      account_user_id: "account-user-1",
      active_profile_id: null,
      profile_id: null,
      needs_profile_setup: true,
      nextRoute: "/onboarding/who-for",
    });
  });

  it("returns a distinct code when the active profile row is missing", async () => {
    mockProfileLookup(null);

    const res = await request(buildApp()).get("/voice").expect(409);

    expect(res.body).toMatchObject({
      code: "ACTIVE_PROFILE_NOT_FOUND",
      account_user_id: "account-user-1",
      active_profile_id: "profile-1",
      profile_id: "profile-1",
      nextRoute: "/onboarding/who-for",
    });
  });

  it("returns a distinct code when the active profile is disabled", async () => {
    mockProfileLookup({ id: "profile-1", account_status: "disabled" });

    const res = await request(buildApp()).get("/voice").expect(403);

    expect(res.body).toMatchObject({
      code: "ACCOUNT_ACCESS_DISABLED",
      account_user_id: "account-user-1",
      active_profile_id: "profile-1",
      profile_id: "profile-1",
      account_status: "disabled",
      nextRoute: "/settings/subscription",
    });
  });
});
