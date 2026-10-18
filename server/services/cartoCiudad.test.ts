import { describe, expect, it, vi } from "vitest";
import { geocodeCandidates, geocodeFirstFitting, geocodeMemberLocation, geocodeSpanishAddress } from "./cartoCiudad.js";

const respond = (body: string, status = 200) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe("geocodeSpanishAddress", () => {
  it("reads the plain JSON /find response", async () => {
    // Recorded from CartoCiudad on 7 Oct 2026.
    const fetcher = respond(JSON.stringify({
      id: "07.49.G49_492750014493", province: "Zamora", comunidadAutonomaCode: "07", provinceCode: "49", muni: "Zamora", muniCode: "49275", type: "portal",
      address: "SANTA CLARA", postalCode: "49003", lat: 41.505226193220395, lng: -5.743797960946443, portalNumber: 12, state: 0,
    }));
    const point = await geocodeSpanishAddress("calle Santa Clara 10, 49014 Zamora", { fetch: fetcher });
    expect(point).toEqual({ lat: 41.505226193220395, lng: -5.743797960946443, postcode: "49003", regionCode: "07", provinceCode: "49", municipalityCode: "49275", precision: "portal" });
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

describe("geocodeCandidates and geocodeFirstFitting", () => {
  // Recorded from CartoCiudad /candidates on 7 Oct 2026: the best match for a
  // Mutxamel street is in València; the Mutxamel one comes second.
  const valencia = { provinceCode: "46", comunidadAutonomaCode: "10", muniCode: "46250", type: "portal", postalCode: "46017", lat: 39.4535, lng: -0.3893 };
  const mutxamel = { provinceCode: "03", comunidadAutonomaCode: "10", muniCode: "03090", type: "portal", postalCode: "03110", lat: 38.4206, lng: -0.4699 };
  const inMutxamel = (point: { municipalityCode: string | null }) => point.municipalityCode === "03090";

  it("reads every candidate and skips ones without a position", async () => {
    const fetcher = respond(JSON.stringify([valencia, { ...mutxamel, lat: null }, mutxamel]));
    const points = await geocodeCandidates("CALLE PONENT 15, Mutxamel", { fetch: fetcher });
    expect(points.map((point) => point.municipalityCode)).toEqual(["46250", "03090"]);
    const url = new URL(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]));
    expect(url.pathname).toBe("/geocoder/api/geocoder/candidates");
    expect(url.searchParams.get("limit")).toBe("10");
  });

  it("returns no candidates for no match or errors", async () => {
    expect(await geocodeCandidates("x", { fetch: respond("") })).toEqual([]);
    expect(await geocodeCandidates("x", { fetch: respond("{}") })).toEqual([]);
    expect(await geocodeCandidates("x", { fetch: respond("oops", 500) })).toEqual([]);
  });

  it("takes the first candidate in the right town, trying queries in order", async () => {
    const fetcher = vi.fn(async (input: string | URL) => {
      const query = new URL(String(input)).searchParams.get("q");
      const body = query === "CALLE PONENT 15 2º, Mutxamel" ? [valencia] : [valencia, mutxamel];
      return new Response(JSON.stringify(body), { status: 200 });
    }) as unknown as typeof fetch;
    const point = await geocodeFirstFitting(["CALLE PONENT 15 2º, Mutxamel", "CALLE PONENT 15, Mutxamel", "CALLE PONENT, Mutxamel"], inMutxamel, { fetch: fetcher });
    expect(point).toMatchObject({ lat: 38.4206, municipalityCode: "03090" });
    expect((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(await geocodeFirstFitting(["x"], inMutxamel, { fetch: respond(JSON.stringify([valencia])) })).toBeNull();
  });
});
