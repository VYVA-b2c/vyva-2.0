import { describe, expect, it, vi } from "vitest";
import { searchCareProviders } from "./careFinderSearch.js";
import type { RegisterMatch } from "./careRegister.js";
import { storableCareFinderResults } from "../../shared/careFinder/search.js";
import type { RegisterPlaceWithPosition } from "../../shared/careFinder/register.js";

type Handler = (url: URL) => unknown;

function mockFetch(handler: Handler) {
  return vi.fn(async (input: string | URL) => {
    const url = new URL(String(input));
    const body = handler(url);
    return new Response(JSON.stringify(body ?? {}), { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

const request = {
  careType: "physiotherapy" as const,
  access: "private" as const,
  coverage: "public" as const,
  location: "11380 Tarifa",
  accessNeeds: ["step_free" as const],
  language: "en",
};

describe("searchCareProviders", () => {
  it("reports unavailable instead of inventing options when Places is not configured", async () => {
    const result = await searchCareProviders(request, { apiKey: null, findRegisterPlaces: null });
    expect(result.status).toBe("unavailable");
    expect(result.options).toEqual([]);
    expect(result.mapsSearchUrl).toContain("fisioterapia");
  });

  it("returns no_results honestly", async () => {
    const fetcher = mockFetch(() => ({ status: "ZERO_RESULTS", results: [] }));
    const result = await searchCareProviders(request, { apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, findRegisterPlaces: null });
    expect(result).toMatchObject({ status: "no_results", options: [] });
  });

  it("drops non-health places, orders by travel time, and labels Google facts as reported", async () => {
    const queries: string[] = [];
    const fetcher = mockFetch((url) => {
      if (url.pathname.endsWith("/textsearch/json")) {
        queries.push(url.searchParams.get("query") ?? "");
        return {
          status: "OK",
          results: [
            { place_id: "far", name: "Fisio Lejos", formatted_address: "Algeciras", types: ["physiotherapist", "health"] },
            { place_id: "gym", name: "Gimnasio Fit", formatted_address: "Tarifa", types: ["gym"] },
            { place_id: "home", name: "Residencia Las Flores", formatted_address: "Tarifa", types: ["lodging"] },
            { place_id: "near", name: "Fisio Cerca", formatted_address: "Tarifa", rating: 4.8, user_ratings_total: 40, types: ["physiotherapist"] },
          ],
        };
      }
      if (url.pathname.endsWith("/distancematrix/json")) {
        return {
          status: "OK",
          rows: [{ elements: [
            { status: "OK", distance: { text: "21 km" }, duration: { text: "25 min", value: 1500 } },
            { status: "OK", distance: { text: "1.2 km" }, duration: { text: "4 min", value: 240 } },
          ] }],
        };
      }
      if (url.pathname.endsWith("/details/json")) {
        const near = url.searchParams.get("place_id") === "near";
        return {
          status: "OK",
          result: {
            international_phone_number: near ? "+34 956 000 000" : "+34 956 111 111",
            wheelchair_accessible_entrance: near ? true : undefined,
            opening_hours: { weekday_text: ["Monday: 9:00 AM – 2:00 PM", "Tuesday: 9:00 AM – 2:00 PM", "", "", "", "", ""] },
          },
        };
      }
      return {};
    });

    const result = await searchCareProviders(request, {
      apiKey: "key",
      fetch: fetcher,
      now: () => new Date("2026-10-05T10:00:00Z"), // a Monday
      refreshEvidence: async () => null,
      findRegisterPlaces: null,
    });

    expect(queries[0]).toBe("fisioterapia 11380 Tarifa");
    expect(queries.join(" ")).not.toMatch(/residencia|centro de dia/i);
    expect(result.status).toBe("ok");
    expect(result.orderedBy).toBe("travel_time");
    expect(result.options.map((option) => option.name)).toEqual(["Fisio Cerca", "Fisio Lejos"]);

    const first = result.options[0];
    expect(first.travel_minutes).toBe(4);
    expect(first.comparison?.distance).toMatchObject({ status: "reported", value: "1.2 km · 4 min by car" });
    expect(first.comparison?.accessibility).toMatchObject({ status: "reported", value: "Step-free entrance listed" });
    expect(first.comparison?.availability?.value).toContain("Monday");
    expect(first.comparison?.coverage?.status).toBe("unknown");
    expect(first.comparison?.price?.status).toBe("unknown");
    expect(first.matched).toEqual(expect.arrayContaining(["Google lists a step-free entrance", "The closest of the options found"]));
    expect(JSON.stringify(result)).not.toMatch(/recommended|verified google|best/i);
  });

  it("states the public health centre assumption explicitly", async () => {
    const fetcher = mockFetch((url) => {
      if (url.pathname.endsWith("/textsearch/json")) {
        return { status: "OK", results: [{ place_id: "cs", name: "Centro de Salud Tarifa", types: ["doctor", "health"] }] };
      }
      return { status: "OK", result: {} };
    });
    const result = await searchCareProviders(
      { ...request, careType: "primary_care", access: "public", accessNeeds: [] },
      { apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, findRegisterPlaces: null },
    );
    expect(result.options[0].assumptions[0]).toMatch(/health card/);
    expect(result.orderedBy).toBe("search_relevance");
  });

  describe("official register first", () => {
    const zamora = { lat: 41.5052, lng: -5.7438, postcode: "49003", regionCode: "07", provinceCode: "49", municipalityCode: "49275", precision: "portal" };
    const registerPlace = (ccn: string, name: string, extra: Partial<RegisterPlaceWithPosition> = {}): RegisterPlaceWithPosition => ({
      ccn, regionalCode: `49-C22-${ccn.slice(-4)}`, listing: "C2", centreClass: "C22", centreClassName: "Consultas de Otros Profesionales Sanitarios",
      name, regionCode: "07", regionName: "Castilla y León", provinceCode: "49", provinceName: "Zamora", municipalityCode: "492755",
      municipalityName: "ZAMORA", street: "CALLE SANTA CLARA 20", postcode: "49015", phone: "980000001", email: null, website: null,
      ownership: "private", dependency: "Privados", careCodes: ["U.59", "U.66"], lat: 41.506, lng: -5.744, sourceUpdatedOn: "2026-10-01",
      ...extra,
    });
    const matches: RegisterMatch[] = [
      { place: registerPlace("0749000001", "FISIOTERAPIA SANTA CLARA"), km: 0.3 },
      { place: registerPlace("0749000002", "CLINICA FISIO DUERO", { careCodes: ["U.59"], phone: null }), km: 2.4 },
    ];

    it("shows authorised places, closest first, without calling Google", async () => {
      const fetcher = vi.fn();
      const findRegisterPlaces = vi.fn(async () => matches);
      const result = await searchCareProviders(
        { ...request, location: "Calle Santa Clara 10, 49014 Zamora", accessNeeds: ["home_visit"] },
        { apiKey: "key", fetch: fetcher as unknown as typeof fetch, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces },
      );
      expect(fetcher).not.toHaveBeenCalled();
      expect(findRegisterPlaces).toHaveBeenCalledWith(expect.objectContaining({ careType: "physiotherapy", access: "private", origin: zamora, limit: 3 }));
      expect(result).toMatchObject({ status: "ok", orderedBy: "distance" });
      const [first, second] = result.options;
      expect(first).toMatchObject({
        id: "regcess:0749000001",
        origin: "official_register",
        name: "Fisioterapia Santa Clara",
        address: "Calle Santa Clara 20, 49015 Zamora",
        phone: "980000001",
        source_status: "verified",
        source_type: "official",
        source_label: "REGCESS, Ministerio de Sanidad",
        travel_text: "About 0.3 km away in a straight line",
        travel_minutes: null,
      });
      // The licence asks for the source and the date of last update.
      expect(first.matched[0]).toBe("Authorised for this care in Spain's official register of health centres (updated 1 October 2026)");
      expect(first.matched).toContain("Also authorised for home health care. Ask whether they visit for this");
      expect(second.matched).not.toContain("Also authorised for home health care. Ask whether they visit for this");
      expect(first.comparison?.distance).toMatchObject({ status: "reported", source: "VYVA" });
      expect(first.comparison?.availability?.status).toBe("unknown");
      expect(first.comparison?.reputation?.status).toBe("unknown");
      // Everything here may be saved with the task.
      expect(storableCareFinderResults(result)).toBe(result);
    });

    it("adds places in the member's town that are not on the map yet, after the placed ones", async () => {
      const unplaced = registerPlace("0749000003", "FISIO BENAVENTE", { lat: null, lng: null, municipalityName: "BENAVENTE" });
      const result = await searchCareProviders(request, {
        apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora,
        findRegisterPlaces: async () => [matches[0], { place: unplaced, km: null }],
      });
      expect(result).toMatchObject({ status: "ok", orderedBy: "distance_then_town" });
      expect(result.options[1]).toMatchObject({ id: "regcess:0749000003", travel_text: "In Benavente, your town. Distance not known yet" });
      expect(result.options[0].matched).toContain("The closest of the options found");
      expect(result.options[1].matched).not.toContain("The closest of the options found");
    });

    it("never calls a town-only place the closest", async () => {
      const unplaced = registerPlace("0749000003", "FISIO BENAVENTE", { lat: null, lng: null });
      const result = await searchCareProviders(request, {
        apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora,
        findRegisterPlaces: async () => [{ place: unplaced, km: null }],
      });
      expect(result).toMatchObject({ status: "ok", orderedBy: "search_relevance" });
      expect(result.options[0].matched).not.toContain("The closest of the options found");
    });

    it("falls back to Google when the register has nothing nearby", async () => {
      const fetcher = mockFetch((url) => (url.pathname.endsWith("/textsearch/json")
        ? { status: "OK", results: [{ place_id: "g1", name: "Fisio Google", types: ["physiotherapist"] }] }
        : { status: "OK", result: {} }));
      const result = await searchCareProviders(request, {
        apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces: async () => [],
      });
      expect(result.options[0]).toMatchObject({ origin: "google_places", id: "g1" });
      expect(storableCareFinderResults(result)).toBeNull();
    });

    it("falls back to Google when the address can't be placed or the register fails", async () => {
      const fetcher = mockFetch((url) => (url.pathname.endsWith("/textsearch/json")
        ? { status: "OK", results: [{ place_id: "g1", name: "Fisio Google", types: ["physiotherapist"] }] }
        : { status: "OK", result: {} }));
      const findRegisterPlaces = vi.fn(async () => matches);
      const unplaced = await searchCareProviders(request, {
        apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, geocode: async () => null, findRegisterPlaces,
      });
      expect(findRegisterPlaces).not.toHaveBeenCalled();
      expect(unplaced.options[0].origin).toBe("google_places");
      const failing = await searchCareProviders(request, {
        apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, geocode: async () => zamora,
        findRegisterPlaces: async () => { throw new Error("relation does not exist"); },
      });
      expect(failing.options[0].origin).toBe("google_places");
    });

    it("still answers from the register when Google isn't configured", async () => {
      const result = await searchCareProviders(request, {
        apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces: async () => matches,
      });
      expect(result.status).toBe("ok");
      expect(result.options).toHaveLength(2);
    });

    describe("public route to a family doctor", () => {
      const publicRequest = { ...request, careType: "primary_care" as const, access: "public" as const, accessNeeds: [] };
      const centre = (ccn: string, name: string, km: number, centreClass = "C231") => ({
        place: registerPlace(ccn, name, { centreClass, ownership: "public", careCodes: ["U.1", "U.2"], phone: "980100100" }),
        km,
      });
      const publicMatches: RegisterMatch[] = [
        centre("0749000101", "CONSULTORIO LOCAL DE VILLARALBO", 0.8, "C232"),
        centre("0749000102", "C.S. SANTA ELENA", 1.2),
        centre("0749000103", "C.S. TORO", 1.9),
        centre("0749000104", "CENTRO DE SALUD PUERTA NUEVA", 2.5),
      ];

      it("puts the health-map centre first and says where that comes from", async () => {
        const findRegisterPlaces = vi.fn(async () => publicMatches);
        const result = await searchCareProviders(publicRequest, {
          apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces,
          findHealthMapCentres: async (code) => (code === "49275" ? { centres: ["C.S. Puerta Nueva"], source: "Junta de Castilla y León", updatedOn: "2026-09-01" } : null),
        });
        // More candidates than shown, so the mapped centre is found even when it isn't among the closest three.
        expect(findRegisterPlaces).toHaveBeenCalledWith(expect.objectContaining({ limit: 80 }));
        expect(result.orderedBy).toBe("assigned_first");
        expect(result.options.map((option) => option.id)).toEqual(["regcess:0749000104", "regcess:0749000101", "regcess:0749000102"]);
        expect(result.publicCare).toEqual({
          regionCode: "07", assignedOptionId: "regcess:0749000104", basis: "health_map", mapSource: "Junta de Castilla y León", mapUpdatedOn: "2026-09-01",
        });
        expect(result.options[0].matched[0]).toBe("The health centre for Zamora on the health map published by Junta de Castilla y León");
        expect(result.options[1].matched).toContain("The closest of the options found");
        expect(result.options[0].comparison?.coverage).toMatchObject({ status: "verified", value: "Public health system" });
        expect(storableCareFinderResults(result)).toBe(result);
      });

      it("names the closest public centre, with the health-card caveat, when there is no map", async () => {
        const result = await searchCareProviders(publicRequest, {
          apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora,
          findRegisterPlaces: async () => publicMatches, findHealthMapCentres: async () => null,
        });
        expect(result.orderedBy).toBe("assigned_first");
        expect(result.publicCare).toMatchObject({ assignedOptionId: "regcess:0749000101", basis: "nearest", mapSource: null });
        expect(result.options[0].matched[0]).toMatch(/closest public health centre.*health card/);
        expect(result.options[0].matched).not.toContain("The closest of the options found");
      });

      it("keeps the region for the booking link when only Google answers", async () => {
        const fetcher = mockFetch((url) => (url.pathname.endsWith("/textsearch/json")
          ? { status: "OK", results: [{ place_id: "cs", name: "Centro de Salud", types: ["doctor"] }] }
          : { status: "OK", result: {} }));
        const result = await searchCareProviders(publicRequest, {
          apiKey: "key", fetch: fetcher, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces: async () => [],
        });
        expect(result.publicCare).toEqual({ regionCode: "07", assignedOptionId: null, basis: null, mapSource: null, mapUpdatedOn: null });
      });

      it("adds nothing for private care", async () => {
        const result = await searchCareProviders(request, {
          apiKey: null, refreshEvidence: async () => null, geocode: async () => zamora, findRegisterPlaces: async () => matches,
        });
        expect(result.publicCare ?? null).toBeNull();
        expect(result.orderedBy).toBe("distance");
      });
    });
  });
});
