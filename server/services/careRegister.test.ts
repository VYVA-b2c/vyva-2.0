import { describe, expect, it } from "vitest";
import { rankRegisterPlaces, registerPlaceFromDb } from "./careRegister.js";

const row = (ccn: string, lat: number | null, lng: number | null, extra: Record<string, unknown> = {}) => registerPlaceFromDb({
  ccn, regional_code: null, listing: "C2", centre_class: "C22", centre_class_name: null, name: `PLACE ${ccn}`,
  region_code: "07", region_name: null, province_code: "49", province_name: "Zamora", municipality_code: null, municipality_name: "Zamora",
  street: "CALLE A 1", postcode: "49001", phone: null, email: null, website: null, ownership: "private", dependency: null,
  care_codes: ["U.59"], lat, lng, source_updated_on: new Date("2026-10-01T00:00:00Z"), ...extra,
});

const origin = { lat: 41.5035, lng: -5.7446 };
const params = { careType: "physiotherapy" as const, access: "private" as const, origin, limit: 3 };

describe("rankRegisterPlaces", () => {
  it("keeps authorised places within range, closest first, with a stable tie-break", () => {
    const ranked = rankRegisterPlaces([
      row("3", 41.52, -5.74),
      row("1", 41.504, -5.745),
      row("2", 41.504, -5.745),
      row("far", 42.5, -5.7), // ~110 km
      row("nopos", null, null),
      row("dental", 41.504, -5.745, { care_codes: ["U.44"] }),
      row("carehome", 41.504, -5.745, { centre_class: "C3" }),
    ], params);
    expect(ranked.map((match) => match.place.ccn)).toEqual(["1", "2", "3"]);
    expect(ranked[0].km).toBeLessThan(0.1);
  });

  it("maps database rows, including the register date", () => {
    expect(row("1", 41.5, -5.7)).toMatchObject({ ccn: "1", careCodes: ["U.59"], lat: 41.5, sourceUpdatedOn: "2026-10-01", ownership: "private" });
  });

  it("respects the limit", () => {
    const places = Array.from({ length: 5 }, (_, index) => row(String(index), 41.5035 + index * 0.001, -5.7446));
    expect(rankRegisterPlaces(places, { ...params, limit: 2 })).toHaveLength(2);
  });
});
