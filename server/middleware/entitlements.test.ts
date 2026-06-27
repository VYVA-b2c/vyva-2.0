import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  entitlementForTier: vi.fn(),
  getActiveProfileContext: vi.fn(),
  normalizeSubscriptionTier: vi.fn((tier: string | null | undefined) => tier ?? "free"),
  syncProfileEntitlement: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    select: mocks.dbSelect,
  },
}));

vi.mock("../lib/profileAccess.js", () => ({
  getActiveProfileContext: mocks.getActiveProfileContext,
}));

vi.mock("../lib/entitlementSync.js", () => ({
  syncProfileEntitlement: mocks.syncProfileEntitlement,
}));

vi.mock("../lib/plans.js", () => ({
  entitlementForTier: mocks.entitlementForTier,
  normalizeSubscriptionTier: mocks.normalizeSubscriptionTier,
}));

import { requireEntitlement } from "./entitlements.js";

function selectRows(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  };
}

function selectRejects(error: Error) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockRejectedValue(error),
      })),
    })),
  };
}

function buildApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: "user-1" } as Express.User;
    next();
  });
  app.get("/voice", requireEntitlement("voice_assistant"), (req, res) => {
    res.json({ ok: true, entitlement: req.entitlement });
  });
  return app;
}

describe("requireEntitlement", () => {
  beforeEach(() => {
    mocks.dbSelect.mockReset();
    mocks.entitlementForTier.mockReset();
    mocks.getActiveProfileContext.mockReset();
    mocks.normalizeSubscriptionTier.mockClear();
    mocks.syncProfileEntitlement.mockReset();

    mocks.getActiveProfileContext.mockResolvedValue({
      accountUserId: "user-1",
      profileId: "profile-1",
      role: "elder",
      profileCount: 1,
      needsProfileSetup: false,
      needsProfileSelection: false,
    });
    mocks.syncProfileEntitlement.mockResolvedValue({
      effectiveTier: "free",
      effectiveStatus: "active",
    });
    mocks.entitlementForTier.mockResolvedValue({
      tier: "free",
      is_active: true,
      voice_assistant: true,
    });
  });

  it("uses defaults when optional profile columns are unavailable", async () => {
    mocks.dbSelect
      .mockReturnValueOnce(selectRejects(new Error('column "account_status" does not exist')))
      .mockReturnValueOnce(selectRows([{
        id: "profile-1",
        subscription_tier: "free",
        subscription_status: "active",
      }]));

    await request(buildApp())
      .get("/voice")
      .expect(200, {
        ok: true,
        entitlement: {
          profileId: "profile-1",
          tier: "free",
          feature: "voice_assistant",
        },
      });

    expect(mocks.syncProfileEntitlement).toHaveBeenCalledWith(expect.objectContaining({
      profile: expect.objectContaining({
        id: "profile-1",
        account_status: "enabled",
        subscription_tier: "free",
      }),
    }));
  });
});
