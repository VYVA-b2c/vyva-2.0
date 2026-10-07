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
  km: number;
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
 * Authorised places for this care near a point, closest first. Reads only
 * places with coordinates; the importer geocodes the rest.
 */
export async function findRegisterPlaces(params: {
  careType: CareTypeId;
  access: CareAccessRoute;
  origin: { lat: number; lng: number };
  limit: number;
}): Promise<RegisterMatch[]> {
  const { db } = await import("../db.js");
  const { codes, classes } = registerCandidateFilter(params.careType, params.access);
  if (codes.length === 0 && classes.length === 0) return [];
  const latDelta = SEARCH_RADIUS_KM / 111;
  const lngDelta = SEARCH_RADIUS_KM / (111 * Math.max(0.2, Math.cos((params.origin.lat * Math.PI) / 180)));
  const result = await db.execute(sql`
    SELECT * FROM care_register_places
    WHERE withdrawn_at IS NULL
      AND lat BETWEEN ${params.origin.lat - latDelta} AND ${params.origin.lat + latDelta}
      AND lng BETWEEN ${params.origin.lng - lngDelta} AND ${params.origin.lng + lngDelta}
      AND (
        care_codes && array(select jsonb_array_elements_text(${JSON.stringify(codes)}::jsonb))
        OR centre_class IN (select jsonb_array_elements_text(${JSON.stringify(classes)}::jsonb))
      )
    LIMIT ${CANDIDATE_LIMIT}`);
  return rankRegisterPlaces(rows(result).map(registerPlaceFromDb), params);
}

/** Filters to places authorised for the care, within range, closest first. */
export function rankRegisterPlaces(
  places: RegisterPlaceWithPosition[],
  params: { careType: CareTypeId; access: CareAccessRoute; origin: { lat: number; lng: number }; limit: number },
): RegisterMatch[] {
  return places
    .filter((place) => place.lat !== null && place.lng !== null)
    .filter((place) => registerPlaceOffers(place, params.careType, params.access))
    .map((place) => ({ place, km: distanceKm(params.origin, { lat: place.lat!, lng: place.lng! }) }))
    .filter((match) => match.km <= SEARCH_RADIUS_KM)
    // Ties go to the register code so the order never depends on the database.
    .sort((left, right) => left.km - right.km || left.place.ccn.localeCompare(right.place.ccn))
    .slice(0, params.limit);
}
