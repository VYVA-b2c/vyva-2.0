import { beforeEach, describe, expect, it, vi } from "vitest";

const dbSelectMock = vi.hoisted(() => vi.fn());
const dbUpdateMock = vi.hoisted(() => vi.fn());
const dbInsertMock = vi.hoisted(() => vi.fn());

vi.mock("../db.js", () => ({
  db: {
    select: dbSelectMock,
    update: dbUpdateMock,
    insert: dbInsertMock,
  },
}));

import { syncProfileEntitlement } from "../lib/entitlementSync.js";
import { entitlementForTier } from "../lib/plans.js";

function missingRelationError() {
  return Object.assign(new Error('relation "user_intakes" does not exist'), { code: "42P01" });
}

function missingPlanCatalogError() {
  return Object.assign(new Error('relation "subscription_plans" does not exist'), { code: "42P01" });
}

function databaseConnectionError() {
  return Object.assign(new Error("database connection lost"), { code: "08006" });
}

function rejectingSelectChain(error: unknown) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => Promise.reject(error)),
        })),
      })),
    })),
  };
}

function rejectingPlanSelectChain(error: unknown) {
  return {
    from: vi.fn(() => Promise.reject(error)),
  };
}

const premiumProfile = {
  id: "profile-1",
  email: "karim@example.com",
  phone_number: "+34600000000",
  whatsapp_number: null,
  subscription_tier: "premium",
  subscription_status: "active",
  stripe_subscription_id: "sub_123",
  trial_ends_at: null,
};

describe("syncProfileEntitlement", () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbUpdateMock.mockReset();
    dbInsertMock.mockReset();
  });

  it("uses profile tier when lifecycle and billing evidence tables are unavailable", async () => {
    dbSelectMock.mockImplementation(() => rejectingSelectChain(missingRelationError()));

    const result = await syncProfileEntitlement({
      profile: premiumProfile as never,
      profileId: premiumProfile.id,
      accountUserId: "account-1",
      repairProfile: true,
      repairChannel: "system",
      repairTrigger: "test",
    });

    expect(result.effectiveTier).toBe("premium");
    expect(result.effectiveStatus).toBe("active");
    expect(result.evidenceSource).toBe("profile");
    expect(result.repaired).toBe(false);
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it("still surfaces unexpected database errors", async () => {
    dbSelectMock.mockImplementation(() => rejectingSelectChain(databaseConnectionError()));

    await expect(syncProfileEntitlement({
      profile: premiumProfile as never,
      profileId: premiumProfile.id,
      accountUserId: "account-1",
    })).rejects.toThrow("database connection lost");
  });

  it("uses the default plan catalog when entitlement tables are unavailable", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    dbSelectMock.mockImplementation(() => rejectingPlanSelectChain(missingPlanCatalogError()));

    try {
      const entitlement = await entitlementForTier("premium");

      expect(entitlement).toMatchObject({
        tier: "premium",
        concierge: true,
        voice_assistant: true,
        medication_tracking: true,
        is_active: true,
      });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("subscription plan catalog unavailable"),
        expect.any(Error),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it("does not hide unexpected plan lookup errors", async () => {
    dbSelectMock.mockImplementation(() => rejectingPlanSelectChain(databaseConnectionError()));

    await expect(entitlementForTier("premium")).rejects.toThrow("database connection lost");
  });
});
