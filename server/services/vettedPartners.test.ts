import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ select: vi.fn(), execute: vi.fn() }));
vi.mock("../db.js", () => ({ db: { select: mocks.select, execute: mocks.execute } }));

import { findPartnersForSearch } from "./vettedPartners.js";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "p1", organisation_id: "o1", name: "Fontanería Ruiz", trades: ["plumber"], phone: "+34 956 000 111", email: null, website: null,
  address: null, languages: ["es"], notes: null, coverage_country: "ES", coverage_region: null, coverage_lat: 36.0143, coverage_lng: -5.6044,
  coverage_radius_km: "30", is_active: true, reviewed_at: new Date(), reviewed_by: "admin",
  org_id: "o1", org_name: "Cruz Roja Tarifa", org_deployment_keys: [], org_website: null, org_is_active: true,
  ...overrides,
});

function member(deployment: string | null) {
  mocks.select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => deployment === null ? [] : [{ deployment }] }) }) });
}

describe("partner lookup for a search", () => {
  beforeEach(() => vi.resetAllMocks());
  const algeciras = { countryCode: "ES", lat: 36.1408, lng: -5.4562, addressText: "Algeciras" };

  it("returns providers whose coverage includes the search point", async () => {
    member("standard");
    mocks.execute.mockResolvedValue({ rows: [row(), row({ id: "far", coverage_lat: 40.4, coverage_lng: -3.7 })] });
    const matches = await findPartnersForSearch({ userId: "u", serviceType: "plumber", point: algeciras });
    expect(matches.map(m => m.provider.id)).toEqual(["p1"]);
    expect(matches[0].organisation.name).toBe("Cruz Roja Tarifa");
    expect(matches[0].provider.coverageRadiusKm).toBe(30);
  });

  it("hides organisations limited to other deployments", async () => {
    member("standard");
    mocks.execute.mockResolvedValue({ rows: [row({ org_deployment_keys: ["drk"] })] });
    expect(await findPartnersForSearch({ userId: "u", serviceType: "plumber", point: algeciras })).toEqual([]);
    member("drk");
    expect(await findPartnersForSearch({ userId: "u", serviceType: "plumber", point: algeciras })).toHaveLength(1);
  });

  it("never breaks a search when the tables are missing", async () => {
    member("standard");
    mocks.execute.mockRejectedValue(Object.assign(new Error("missing"), { code: "42P01" }));
    expect(await findPartnersForSearch({ userId: "u", serviceType: "plumber", point: algeciras })).toEqual([]);
  });
});
