import { sql } from "drizzle-orm";
import type { CareAccessRoute, CareTypeId } from "../../shared/careFinder/careRoutes.js";
import {
  distanceKm,
  registerCandidateFilter,
  registerPlaceOffers,
  type RegisterListing,
  type RegisterPlaceWithPosition,
} from "../../shared/careFinder/register.js";

// How far to look. Rural Zamora needs the wider radius; cities fill up first.
const SEARCH_RADIUS_KM = 40;
const CANDIDATE_LIMIT = 400;

export interface RegisterMatch {
  place: RegisterPlaceWithPosition;
  // Straight-line distance; null for a place in the member's own town that
  // has no position yet (the town is known from the register, the street
  // is not on the map).
  km: number | null;
}

type Row = Record<string, unknown>;
function rows(result: unknown): Row[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) return (result as { rows: Row[] }).rows;
  return Array.isArray(result) ? result as Row[] : [];
}
const str = (value: unknown) => (typeof value === "string" && value ? value : null);
const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));
const day = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10));

export function registerPlaceFromDb(row: Row): RegisterPlaceWithPosition {
  return {
    ccn: String(row.ccn),
    regionalCode: str(row.regional_code),
    listing: String(row.listing) as RegisterListing,
    centreClass: str(row.centre_class),
    centreClassName: str(row.centre_class_name),
    name: String(row.name),
    regionCode: str(row.region_code),
    regionName: str(row.region_name),
    provinceCode: str(row.province_code),
    provinceName: str(row.province_name),
    municipalityCode: str(row.municipality_code),
    municipalityName: str(row.municipality_name),
    street: str(row.street),
    postcode: str(row.postcode),
    phone: str(row.phone),
    email: str(row.email),
    website: str(row.website),
    ownership: row.ownership === "public" || row.ownership === "private" ? row.ownership : null,
    dependency: str(row.dependency),
    careCodes: Array.isArray(row.care_codes) ? (row.care_codes as string[]) : [],
    lat: num(row.lat),
    lng: num(row.lng),
    sourceUpdatedOn: day(row.source_updated_on),
  };
}

/**
 * Authorised places for this care near a point, closest first, then places
 * in the member's own town that have no position yet. The register gives
 * every place's town, so a town match needs no geocoding; it just can't be
 * ranked by distance.
 */
export async function findRegisterPlaces(params: {
  // ISO country whose register to read; rows are never mixed across countries.
  country: string;
  careType: CareTypeId;
  access: CareAccessRoute;
  // municipalityCode: the member's INE town code (5 digits), from geocoding.
  origin: { lat: number; lng: number; municipalityCode?: string | null };
  limit: number;
}): Promise<RegisterMatch[]> {
  const { db } = await import("../db.js");
  const { codes, classes } = registerCandidateFilter(params.careType, params.access);
  if (codes.length === 0 && classes.length === 0) return [];
  const offersCare = sql`(
    care_codes && array(select jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb))
    OR centre_class IN (select jsonb_array_elements_text(${JSON.stringify(classes)}::jsonb))
  )`;
  const latDelta = SEARCH_RADIUS_KM / 111;
  const lngDelta = SEARCH_RADIUS_KM / (111 * Math.max(0.2, Math.cos((params.origin.lat * Math.PI) / 180)));
  const nearby = await db.execute(sql`
    SELECT * FROM care_register_places
    WHERE withdrawn_at IS NULL
      AND country = ${params.country}
      AND lat BETWEEN ${params.origin.lat - latDelta} AND ${params.origin.lat + latDelta}
      AND lng BETWEEN ${params.origin.lng - lngDelta} AND ${params.origin.lng + lngDelta}
      AND ${offersCare}
    LIMIT ${CANDIDATE_LIMIT}`);
  const placed = rankRegisterPlaces(rows(nearby).map(registerPlaceFromDb), params);
  const town = params.origin.municipalityCode?.slice(0, 5);
  if (placed.length >= params.limit || !town || !/^\d{5}$/.test(town)) return placed;
  // REGCESS town codes are the INE code plus a check digit.
  const inTown = await db.execute(sql`
    SELECT * FROM care_register_places
    WHERE withdrawn_at IS NULL
      AND country = ${params.country}
      AND lat IS NULL
      AND left(municipality_code, 5) = ${town}
      AND ${offersCare}
    LIMIT ${CANDIDATE_LIMIT}`);
  return [...placed, ...townRegisterPlaces(rows(inTown).map(registerPlaceFromDb), params, params.limit - placed.length)];
}

/** Places in the member's town without a position, authorised for the care, in register order. */
export function townRegisterPlaces(
  places: RegisterPlaceWithPosition[],
  params: { careType: CareTypeId; access: CareAccessRoute },
  limit: number,
): RegisterMatch[] {
  return places
    .filter((place) => place.lat === null || place.lng === null)
    .filter((place) => registerPlaceOffers(place, params.careType, params.access))
    .sort((left, right) => left.ccn.localeCompare(right.ccn))
    .slice(0, Math.max(0, limit))
    .map((place) => ({ place, km: null }));
}

/** Filters to places authorised for the care, within range, closest first. */
export function rankRegisterPlaces(
  places: RegisterPlaceWithPosition[],
  params: { careType: CareTypeId; access: CareAccessRoute; origin: { lat: number; lng: number }; limit: number },
): Array<RegisterMatch & { km: number }> {
  return places
    .filter((place) => place.lat !== null && place.lng !== null)
    .filter((place) => registerPlaceOffers(place, params.careType, params.access))
    .map((place) => ({ place, km: distanceKm(params.origin, { lat: place.lat!, lng: place.lng! }) }))
    .filter((match) => match.km <= SEARCH_RADIUS_KM)
    // Ties go to the register code so the order never depends on the database.
    .sort((left, right) => left.km - right.km || left.place.ccn.localeCompare(right.place.ccn))
    .slice(0, params.limit);
}

export interface HealthMapCentres {
  centres: string[];
  source: string;
  updatedOn: string | null;
}

/**
 * The health centre a region's published health map gives for a
 * municipality (5-digit INE code). Null when the map has no entry, or when
 * the municipality is split between zones (cities): the address decides
 * there, and we don't have zone boundaries.
 */
export async function findHealthMapCentres(municipalityCode: string, country = "ES"): Promise<HealthMapCentres | null> {
  const { db } = await import("../db.js");
  const result = await db.execute(sql`
    SELECT zone_name, centre_name, source, source_updated_on
    FROM care_health_zone_municipalities
    WHERE country = ${country} AND municipality_code = ${municipalityCode.slice(0, 5)}`);
  const found = rows(result);
  const zones = new Set(found.map((row) => String(row.zone_name)));
  if (found.length === 0 || zones.size !== 1) return null;
  return {
    // The register often names a rural centre after its zone ("Centro de
    // Salud de Aliste" for "C.S. Alcañices"), so both names may match.
    centres: Array.from(new Set(found.flatMap((row) => [String(row.centre_name), String(row.zone_name)]))),
    source: String(found[0].source),
    updatedOn: found[0].source_updated_on ? day(found[0].source_updated_on) : null,
  };
}
