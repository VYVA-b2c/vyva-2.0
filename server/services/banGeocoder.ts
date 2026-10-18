// France's national address geocoder: Base Adresse Nationale on the IGN
// Géoplateforme. Free, no key; BAN data is Licence Ouverte 2.0. Used for a
// member's own location at search time, and in bulk (its CSV endpoint) for
// register addresses at import time.
//
// Docs: https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage

import type { GeocodedPoint } from "./cartoCiudad.js";
import { splitDelimitedLine } from "../../shared/careFinder/register.js";

const SEARCH_URL = "https://data.geopf.fr/geocodage/search";
const CSV_URL = "https://data.geopf.fr/geocodage/search/csv";

type Feature = {
  geometry?: { coordinates?: unknown };
  properties?: { type?: unknown; score?: unknown; citycode?: unknown; postcode?: unknown; context?: unknown; depcode?: unknown };
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function department(citycode: string | null, context: string | null): string | null {
  // context: "75, Paris, Île-de-France"
  return text(context?.split(",")[0]) ?? (citycode ? citycode.slice(0, citycode.startsWith("97") ? 3 : 2) : null);
}

/**
 * A member's own location as typed: "12 rue de la Paix, Paris", "69003",
 * "Lyon". Precision is BAN's match type: housenumber, street, locality or
 * municipality.
 */
export async function geocodeFrenchLocation(
  location: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  const query = location.trim();
  if (query.length < 3) return null;
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("index", "address");
  try {
    const response = await (dependencies.fetch ?? fetch)(url, { signal: AbortSignal.timeout(dependencies.timeoutMs ?? 7000) });
    if (!response.ok) return null;
    const data = await response.json() as { features?: Feature[] };
    const feature = data.features?.[0];
    const [lng, lat] = Array.isArray(feature?.geometry?.coordinates) ? feature.geometry.coordinates as unknown[] : [];
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const properties = feature?.properties ?? {};
    // A weak match is a guess about where the member lives: better none.
    if (typeof properties.score === "number" && properties.score < 0.4) return null;
    const citycode = text(properties.citycode);
    return {
      lat,
      lng,
      postcode: text(properties.postcode),
      regionCode: null,
      provinceCode: text(properties.depcode) ?? department(citycode, text(properties.context)),
      municipalityCode: citycode,
      precision: text(properties.type),
    };
  } catch {
    return null;
  }
}

export interface BanCsvResult {
  id: string;
  lat: number | null;
  lng: number | null;
  score: number | null;
  type: string | null;
  citycode: string | null;
  oldcitycode: string | null;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
}

/**
 * Geocodes many addresses in one request with BAN's CSV endpoint. Rows the
 * service can't place come back with no coordinates. Keep batches to a few
 * thousand rows: the endpoint takes files up to 50 MB.
 */
export async function geocodeFrenchAddresses(
  rows: ReadonlyArray<{ id: string; address: string }>,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<BanCsvResult[]> {
  if (rows.length === 0) return [];
  const body = ["id,adresse", ...rows.map((row) => `${csvCell(row.id)},${csvCell(row.address)}`)].join("\n");
  const form = new FormData();
  form.append("data", new Blob([body], { type: "text/csv" }), "addresses.csv");
  form.append("columns", "adresse");
  form.append("indexes", "address");
  const response = await (dependencies.fetch ?? fetch)(CSV_URL, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(dependencies.timeoutMs ?? 300_000),
  });
  if (!response.ok) throw new Error(`BAN CSV geocoder returned ${response.status}`);
  return parseBanCsv(await response.text());
}

/** The geocoder's CSV answer: our columns plus latitude, longitude and result_*. */
export function parseBanCsv(csv: string): BanCsvResult[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
  const header = splitDelimitedLine(lines[0], delimiter);
  const at = (name: string) => header.indexOf(name);
  const columns = {
    id: at("id"), lat: at("latitude"), lng: at("longitude"), score: at("result_score"), type: at("result_type"),
    citycode: at("result_citycode"), oldcitycode: at("result_oldcitycode"),
  };
  if (columns.id < 0 || columns.lat < 0 || columns.lng < 0) throw new Error(`BAN CSV answer has unexpected columns: ${header.join(", ")}`);
  const number = (value: string | undefined) => (value && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null);
  const cell = (cells: string[], position: number) => (position >= 0 ? text(cells[position]) : null);
  return lines.slice(1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return {
      id: cells[columns.id] ?? "",
      lat: number(cells[columns.lat]),
      lng: number(cells[columns.lng]),
      score: columns.score >= 0 ? number(cells[columns.score]) : null,
      type: cell(cells, columns.type),
      citycode: cell(cells, columns.citycode),
      oldcitycode: cell(cells, columns.oldcitycode),
    };
  });
}
