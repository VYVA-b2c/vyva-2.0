// Germany for Care Finder: health providers mapped on OpenStreetMap. Pure
// helpers shared by the importer (scripts/import-care-register-de.ts) and the
// search.
//
// Germany has no open national register of doctors or practices (see
// docs/research/care-finder-provider-sources-germany.md §13). OpenStreetMap is
// the free, commercially reusable option: volunteer-mapped, reasonably full in
// cities, thin in rural areas, and never proof of a licence or of statutory
// insurance (Kassenzulassung). So German results are "reported", not
// "verified", and every one carries the ODbL credit.
//
// Licence: ODbL 1.0. Show "© OpenStreetMap contributors" with a link to
// openstreetmap.org/copyright wherever OSM data appears. A database derived
// from OSM that VYVA offers publicly must itself be offered under ODbL; these
// rows live in their own country partition, apart from member data.

import type { CareTypeId } from "./careRoutes.js";
import type { RegisterPlace } from "./register.js";

export const OSM_SOURCE_LABEL = "© OpenStreetMap contributors";
export const OSM_SOURCE_URL = "https://www.openstreetmap.org/copyright";

/** The 16 Länder, queried one at a time to stay within Overpass limits. */
export const DE_STATES = [
  "DE-BW", "DE-BY", "DE-BE", "DE-BB", "DE-HB", "DE-HH", "DE-HE", "DE-MV",
  "DE-NI", "DE-NW", "DE-RP", "DE-SL", "DE-SN", "DE-ST", "DE-SH", "DE-TH",
] as const;

/** Overpass query for one Land: every health element Care Finder could show, with its centre. */
export function overpassQuery(state: string): string {
  return `[out:json][timeout:900][maxsize:1073741824];
area["ISO3166-2"="${state}"]["admin_level"="4"]->.state;
(
  nwr(area.state)["amenity"~"^(doctors|dentist|clinic)$"];
  nwr(area.state)["healthcare"~"^(doctor|dentist|physiotherapist|psychotherapist|optometrist|audiologist|centre|clinic)$"];
  nwr(area.state)["shop"~"^(optician|hearing_aids)$"];
);
out center tags;`;
}

export function deCareCode(careType: CareTypeId): string {
  return `de:${careType}`;
}

type Tags = Record<string, string | undefined>;

function list(value: string | undefined): string[] {
  return (value ?? "").toLowerCase().split(";").map((item) => item.trim()).filter(Boolean);
}

// healthcare:speciality values (OSM wiki "Key:healthcare:speciality").
const DOCTOR_SPECIALITIES: Array<[string[], CareTypeId[]]> = [
  [["general", "family_medicine", "general_practice"], ["primary_care", "same_day"]],
  [["ophthalmology"], ["ophthalmology"]],
  [["otolaryngology"], ["ent"]],
  [["neurology"], ["neurology"]],
  [["orthopaedics", "orthopedics"], ["orthopaedics"]],
  [["physiotherapy"], ["physiotherapy"]],
  [["psychotherapy", "psychology", "behavioural", "psychotherapist"], ["psychology"]],
];

/**
 * The care types an OSM element offers. Doctors count only with a specialty
 * tag: an untagged "Arztpraxis" could be anything, so it isn't guessed.
 */
export function osmCareTypes(tags: Tags): CareTypeId[] {
  const types = new Set<CareTypeId>();
  const healthcare = tags.healthcare?.toLowerCase();
  const amenity = tags.amenity?.toLowerCase();
  const shop = tags.shop?.toLowerCase();
  if (amenity === "dentist" || healthcare === "dentist") types.add("dentist").add("urgent_dentist");
  if (healthcare === "physiotherapist") types.add("physiotherapy");
  if (healthcare === "psychotherapist") types.add("psychology");
  if (shop === "optician" || healthcare === "optometrist") types.add("optician");
  if (shop === "hearing_aids" || healthcare === "audiologist") types.add("hearing_centre");
  const doctorLike = amenity === "doctors" || amenity === "clinic" || healthcare === "doctor" || healthcare === "centre" || healthcare === "clinic";
  if (doctorLike || healthcare === "physiotherapist" || healthcare === "psychotherapist") {
    const specialities = list(tags["healthcare:speciality"]);
    for (const [values, careTypes] of DOCTOR_SPECIALITIES) {
      if (values.some((value) => specialities.includes(value))) careTypes.forEach((careType) => types.add(careType));
    }
  }
  return Array.from(types);
}

function first(value: string | undefined): string | null {
  const text = value?.split(";")[0]?.replace(/\s+/g, " ").trim();
  return text ? text : null;
}

function website(value: string | undefined): string | null {
  const text = first(value);
  if (!text) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes(".") ? url.toString() : null;
  } catch {
    return null;
  }
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Tags;
}

export interface DeRegisterPlace extends RegisterPlace {
  country: "DE";
  // OSM always has a position: a node's own, a building's centre.
  registerPosition: { lat: number; lng: number };
}

/** One OSM element to a place, or null when it has no name, position or care type we search for. */
export function osmPlaceFromElement(element: OsmElement, state: string): DeRegisterPlace | null {
  const tags = element.tags ?? {};
  const name = first(tags.name) ?? first(tags.official_name);
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!name || typeof lat !== "number" || typeof lng !== "number") return null;
  // Germany, with a margin for border towns.
  if (lat < 47 || lat > 55.2 || lng < 5.8 || lng > 15.1) return null;
  const careTypes = osmCareTypes(tags);
  if (careTypes.length === 0) return null;
  const street = [first(tags["addr:street"]) ?? first(tags["addr:place"]), first(tags["addr:housenumber"])].filter(Boolean).join(" ") || null;
  return {
    country: "DE",
    ccn: `DE-OSM:${element.type}/${element.id}`,
    regionalCode: `${element.type}/${element.id}`,
    listing: "OSM",
    centreClass: tags.healthcare ?? tags.amenity ?? tags.shop ?? null,
    centreClassName: first(tags["healthcare:speciality"]),
    name,
    regionCode: state,
    regionName: null,
    provinceCode: null,
    provinceName: null,
    municipalityCode: null,
    municipalityName: first(tags["addr:city"]) ?? first(tags["addr:suburb"]),
    street,
    postcode: first(tags["addr:postcode"]),
    phone: first(tags.phone) ?? first(tags["contact:phone"]),
    email: (first(tags.email) ?? first(tags["contact:email"]))?.toLowerCase() ?? null,
    website: website(tags.website) ?? website(tags["contact:website"]),
    ownership: null,
    dependency: null,
    careCodes: careTypes.map(deCareCode),
    registerPosition: { lat, lng },
  };
}

/** A place mapped twice (a node inside its building) keeps the entry with more contact detail. */
export function dedupeOsmPlaces(places: Iterable<DeRegisterPlace>): DeRegisterPlace[] {
  const byKey = new Map<string, DeRegisterPlace>();
  const detail = (place: DeRegisterPlace) => [place.phone, place.website, place.street, place.postcode].filter(Boolean).length;
  for (const place of places) {
    const key = `${place.name.toLowerCase()}|${place.registerPosition.lat.toFixed(3)}|${place.registerPosition.lng.toFixed(3)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, place);
      continue;
    }
    const keep = detail(place) > detail(existing) ? place : existing;
    keep.careCodes = Array.from(new Set([...existing.careCodes, ...place.careCodes]));
    byKey.set(key, keep);
  }
  return Array.from(byKey.values());
}
