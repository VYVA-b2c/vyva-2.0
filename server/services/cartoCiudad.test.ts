import { describe, expect, it, vi } from "vitest";
import { geocodeSpanishAddress } from "./cartoCiudad.js";

const respond = (body: string, status = 200) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe("geocodeSpanishAddress", () => {
  it("reads the plain JSON /find response", async () => {
    // Recorded from CartoCiudad on 7 Oct 2026.
    const fetcher = respond(JSON.stringify({
      id: "07.49.G49_492750014493", province: "Zamora", provinceCode: "49", muni: "Zamora", muniCode: "49275", type: "portal",
      address: "SANTA CLARA", postalCode: "49003", lat: 41.505226193220395, lng: -5.743797960946443, portalNumber: 12, state: 0,
    }));
    const point = await geocodeSpanishAddress("calle Santa Clara 10, 49014 Zamora", { fetch: fetcher });
    expect(point).toEqual({ lat: 41.505226193220395, lng: -5.743797960946443, postcode: "49003", provinceCode: "49", municipalityCode: "49275", precision: "portal" });
    const url = new URL(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.pathname).toBe("/geocoder/api/geocoder/find");
    expect(url.searchParams.get("q")).toBe("calle Santa Clara 10, 49014 Zamora");
  });

  it("returns null for no match, errors and blank input", async () => {
    expect(await geocodeSpanishAddress("nowhere", { fetch: respond("") })).toBeNull();
    expect(await geocodeSpanishAddress("nowhere", { fetch: respond("{}") })).toBeNull();
    expect(await geocodeSpanishAddress("x", { fetch: respond("oops", 500) })).toBeNull();
    expect(await geocodeSpanishAddress("x", { fetch: vi.fn(async () => { throw new Error("offline"); }) as unknown as typeof fetch })).toBeNull();
    expect(await geocodeSpanishAddress("  ")).toBeNull();
  });
});
