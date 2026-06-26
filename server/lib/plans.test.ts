import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    select: dbMocks.select,
  },
}));

import { entitlementForTier } from "./plans.js";

function mockUnavailablePlanCatalog(message = 'relation "tier_entitlements" does not exist') {
  dbMocks.select.mockReturnValue({
    from: vi.fn().mockRejectedValue(new Error(message)),
  });
}

describe("plan entitlements", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dbMocks.select.mockReset();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("falls back to built-in free voice entitlement when the plan catalog is unavailable", async () => {
    mockUnavailablePlanCatalog();

    const entitlement = await entitlementForTier("free");

    expect(entitlement).toMatchObject({
      tier: "free",
      voice_assistant: true,
      medication_tracking: true,
      concierge: false,
      caregiver_dashboard: false,
      is_active: true,
    });
  });

  it("falls back to built-in premium voice entitlement when catalog writes are unavailable", async () => {
    mockUnavailablePlanCatalog("permission denied for table subscription_plans");

    const entitlement = await entitlementForTier("premium");

    expect(entitlement).toMatchObject({
      tier: "premium",
      voice_assistant: true,
      medication_tracking: true,
      symptom_check: true,
      concierge: true,
      caregiver_dashboard: true,
      is_active: true,
    });
  });

  it("returns null for unknown tiers when using the built-in fallback", async () => {
    mockUnavailablePlanCatalog();

    await expect(entitlementForTier("enterprise")).resolves.toBeNull();
  });
});
