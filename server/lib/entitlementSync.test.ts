import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    select: dbMocks.select,
  },
}));

import { syncProfileEntitlement } from "./entitlementSync.js";
import type { Profile } from "../../shared/schema.js";

function queryRejects(message: string) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockRejectedValue(new Error(message)),
        })),
      })),
    })),
  };
}

function queryResolves(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(rows),
        })),
      })),
    })),
  };
}

function profile(overrides: Partial<Profile> = {}): Profile {
  return ({
    id: "profile-1",
    email: null,
    phone_number: null,
    whatsapp_number: null,
    subscription_tier: "free",
    subscription_status: "active",
    stripe_subscription_id: null,
    trial_ends_at: null,
    ...overrides,
  } as Partial<Profile>) as Profile;
}

describe("syncProfileEntitlement", () => {
  beforeEach(() => {
    dbMocks.select.mockReset();
  });

  it("uses profile entitlement when lifecycle evidence tables are unavailable", async () => {
    dbMocks.select
      .mockReturnValueOnce(queryRejects('relation "user_intakes" does not exist'))
      .mockReturnValueOnce(queryResolves([]));

    const result = await syncProfileEntitlement({
      profile: profile(),
      profileId: "profile-1",
      accountUserId: "user-1",
    });

    expect(result.effectiveTier).toBe("free");
    expect(result.evidenceSource).toBe("profile");
  });

  it("keeps Stripe-backed premium evidence when billing event tables are unavailable", async () => {
    dbMocks.select
      .mockReturnValueOnce(queryResolves([]))
      .mockReturnValueOnce(queryRejects('relation "billing_events" does not exist'))
      .mockReturnValueOnce(queryResolves([]));

    const result = await syncProfileEntitlement({
      profile: profile({
        stripe_subscription_id: "sub_123",
        subscription_status: "active",
      }),
      profileId: "profile-1",
      accountUserId: "user-1",
    });

    expect(result.effectiveTier).toBe("premium");
    expect(result.evidenceSource).toBe("billing");
  });
});
