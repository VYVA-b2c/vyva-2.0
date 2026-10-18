import { describe, expect, it } from "vitest";
import { dedupeOsmPlaces, osmCareTypes, osmPlaceFromElement, overpassQuery, type OsmElement } from "./registerDe";
import { registerDisplayAddress, registerDisplayName, registerPlaceOffers } from "./register";

const gp: OsmElement = {
  type: "node",
  id: 123456,
  lat: 53.3167,
  lon: 13.8601,
  tags: {
    amenity: "doctors",
    healthcare: "doctor",
    "healthcare:speciality": "general",
    name: "Hausarztpraxis Dr. Schulz",
    "addr:street": "Friedrichstraße",
    "addr:housenumber": "12",
    "addr:postcode": "17291",
    "addr:city": "Prenzlau",
    phone: "+49 3984 123456",
    website: "praxis-schulz.de",
  },
};

describe("OpenStreetMap places", () => {
  it("keeps a family doctor with its address, contact and the map's position", () => {
    const place = osmPlaceFromElement(gp, "DE-BB")!;
    expect(place).toMatchObject({
      country: "DE", ccn: "DE-OSM:node/123456", listing: "OSM", regionCode: "DE-BB", name: "Hausarztpraxis Dr. Schulz",
      street: "Friedrichstraße 12", postcode: "17291", municipalityName: "Prenzlau", phone: "+49 3984 123456",
      website: "https://praxis-schulz.de/", careCodes: ["de:primary_care", "de:same_day"],
      registerPosition: { lat: 53.3167, lng: 13.8601 },
    });
    expect(registerDisplayName(place)).toBe("Hausarztpraxis Dr. Schulz");
    expect(registerDisplayAddress(place)).toBe("Friedrichstraße 12, 17291 Prenzlau");
    expect(registerPlaceOffers(place, "primary_care", "public")).toBe(true);
    expect(registerPlaceOffers(place, "dentist", "private")).toBe(false);
  });

  it("takes a building's centre as its position", () => {
    const way: OsmElement = { type: "way", id: 9, center: { lat: 52.52, lon: 13.40 }, tags: { shop: "optician", name: "Fielmann" } };
    expect(osmPlaceFromElement(way, "DE-BE")).toMatchObject({ ccn: "DE-OSM:way/9", careCodes: ["de:optician"], registerPosition: { lat: 52.52, lng: 13.4 } });
  });

  it("never guesses: no specialty, no name or no position means no place", () => {
    expect(osmPlaceFromElement({ ...gp, tags: { ...gp.tags, "healthcare:speciality": undefined } }, "DE-BB")).toBeNull();
    expect(osmPlaceFromElement({ ...gp, tags: { ...gp.tags, name: undefined } }, "DE-BB")).toBeNull();
    expect(osmPlaceFromElement({ type: "way", id: 1, tags: gp.tags }, "DE-BB")).toBeNull();
    expect(osmPlaceFromElement({ ...gp, lat: 48.85, lon: 2.35 }, "DE-BB")).toBeNull();
  });

  it("maps OSM tags to Care Finder's care types", () => {
    expect(osmCareTypes({ amenity: "dentist" })).toEqual(["dentist", "urgent_dentist"]);
    expect(osmCareTypes({ healthcare: "physiotherapist" })).toEqual(["physiotherapy"]);
    expect(osmCareTypes({ healthcare: "psychotherapist" })).toEqual(["psychology"]);
    expect(osmCareTypes({ shop: "hearing_aids" })).toEqual(["hearing_centre"]);
    expect(osmCareTypes({ amenity: "doctors", "healthcare:speciality": "ophthalmology" })).toEqual(["ophthalmology"]);
    expect(osmCareTypes({ amenity: "doctors", "healthcare:speciality": "otolaryngology;neurology" })).toEqual(["ent", "neurology"]);
    expect(osmCareTypes({ healthcare: "centre", "healthcare:speciality": "orthopaedics" })).toEqual(["orthopaedics"]);
    expect(osmCareTypes({ amenity: "doctors", "healthcare:speciality": "psychiatry" })).toEqual([]);
    expect(osmCareTypes({ amenity: "pharmacy" })).toEqual([]);
  });

  it("merges a practice mapped twice, keeping the fuller entry", () => {
    const node = osmPlaceFromElement(gp, "DE-BB")!;
    const building = osmPlaceFromElement({ type: "way", id: 7, center: { lat: 53.31672, lon: 13.86012 }, tags: { amenity: "doctors", "healthcare:speciality": "general;neurology", name: "Hausarztpraxis Dr. Schulz" } }, "DE-BB")!;
    const [merged, ...rest] = dedupeOsmPlaces([building, node]);
    expect(rest).toEqual([]);
    expect(merged.ccn).toBe("DE-OSM:node/123456");
    expect(merged.careCodes).toEqual(expect.arrayContaining(["de:primary_care", "de:neurology"]));
  });

  it("queries one Land by its ISO code, with centres for buildings", () => {
    const query = overpassQuery("DE-BE");
    expect(query).toContain('area["ISO3166-2"="DE-BE"]["admin_level"="4"]');
    expect(query).toContain("out center tags;");
  });
});
