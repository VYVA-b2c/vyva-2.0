import { describe, expect, it, vi } from "vitest";
import { geocodeMemberLocation, geocodeSpanishAddress } from "./cartoCiudad.js";

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

  describe("geocodeMemberLocation", () => {
    // CartoCiudad answers 204 for "49014 Zamora" but finds "49014" (checked 7 Oct 2026).
    const byQuery = (answers: Record<string, unknown>) => vi.fn(async (input: string | URL) => {
      const q = new URL(String(input)).searchParams.get("q") ?? "";
      return q in answers ? new Response(JSON.stringify(answers[q]), { status: 200 }) : new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    it("falls back to the postcode alone", async () => {
      const fetcher = byQuery({ "49014": { lat: 41.51, lng: -5.74, postalCode: "49014", type: "Codpost", provinceCode: null, muniCode: null } });
      expect(await geocodeMemberLocation("49014 Zamora", { fetch: fetcher })).toMatchObject({ lat: 41.51, precision: "Codpost" });
    });

    it("then to the town without the postcode", async () => {
      const fetcher = byQuery({ Zamora: { lat: 41.5099, lng: -5.7453, type: "poblacion", provinceCode: "49", muniCode: "49275" } });
      expect(await geocodeMemberLocation("49999, Zamora", { fetch: fetcher })).toMatchObject({ lat: 41.5099, precision: "poblacion" });
    });

    it("uses the direct match when there is one", async () => {
      const fetcher = byQuery({ Benavente: { lat: 42.002, lng: -5.672, type: "poblacion", provinceCode: "49", muniCode: "49021" } });
      expect(await geocodeMemberLocation("Benavente", { fetch: fetcher })).toMatchObject({ municipalityCode: "49021" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });
});
