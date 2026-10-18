// CartoCiudad geocoder (Instituto Geográfico Nacional): free, no key, every
// Spanish address. Attribution: "CartoCiudad cedido por © Instituto
// Geográfico Nacional". Used for register addresses at import time and for
// the member's own location at search time.

export const CARTOCIUDAD_ATTRIBUTION = "CartoCiudad cedido por © Instituto Geográfico Nacional";
const FIND_URL = "https://www.cartociudad.es/geocoder/api/geocoder/find";
const CANDIDATES_URL = "https://www.cartociudad.es/geocoder/api/geocoder/candidates";

export interface GeocodedPoint {
  lat: number;
  lng: number;
  postcode: string | null;
  // INE autonomous community code ("07" Castilla y León), as REGCESS uses.
  regionCode: string | null;
  provinceCode: string | null;
  // INE municipality code, 5 digits (REGCESS uses 6: the same plus a check digit).
  municipalityCode: string | null;
  // "portal" when an exact door number was matched; others are less precise.
  precision: string | null;
}

type FindResponse = {
  lat?: unknown;
  lng?: unknown;
  postalCode?: unknown;
  comunidadAutonomaCode?: unknown;
  provinceCode?: unknown;
  muniCode?: unknown;
  type?: unknown;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function pointFrom(data: FindResponse | null | undefined): GeocodedPoint | null {
  if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") return null;
  if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null;
  return {
    lat: data.lat,
    lng: data.lng,
    postcode: text(data.postalCode),
    regionCode: text(data.comunidadAutonomaCode),
    provinceCode: text(data.provinceCode),
    municipalityCode: text(data.muniCode),
    precision: text(data.type),
  };
}

async function request(
  endpoint: string,
  params: Record<string, string>,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number },
): Promise<unknown> {
  const fetcher = dependencies.fetch ?? fetch;
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(dependencies.timeoutMs ?? 7000)
      : undefined;
    const response = await fetcher(url, { signal });
    if (!response.ok) return null;
    const body = await response.text();
    return body.trim() ? JSON.parse(body) : null;
  } catch {
    return null;
  }
}

/** The geocoder's single best match. */
export async function geocodeSpanishAddress(
  address: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  const query = address.trim();
  if (!query) return null;
  return pointFrom(await request(FIND_URL, { q: query }, dependencies) as FindResponse | null);
}

/**
 * Several matches, best first. The single best match is often a same-named
 * street in another town; the right one is usually further down the list.
 */
export async function geocodeCandidates(
  address: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number; limit?: number } = {},
): Promise<GeocodedPoint[]> {
  const query = address.trim();
  if (!query) return [];
  const data = await request(CANDIDATES_URL, { q: query, limit: String(dependencies.limit ?? 10) }, dependencies);
  if (!Array.isArray(data)) return [];
  return data.map((item) => pointFrom(item as FindResponse)).filter((point): point is GeocodedPoint => point !== null);
}

/**
 * The first match, across queries tried in order, that passes `fits` (the
 * right town). Stops at the first query that yields one.
 */
export async function geocodeFirstFitting(
  queries: readonly string[],
  fits: (point: GeocodedPoint) => boolean,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  for (const query of queries) {
    const match = (await geocodeCandidates(query, dependencies)).find(fits);
    if (match) return match;
  }
  return null;
}

/**
 * A member's own location as typed: "Calle Santa Clara 10, Zamora",
 * "49014 Zamora", "Benavente". CartoCiudad finds a bare postcode but not
 * "postcode town", so fall back to the postcode, then to the rest.
 */
export async function geocodeMemberLocation(
  location: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  const query = location.trim();
  const direct = await geocodeSpanishAddress(query, dependencies);
  if (direct) return direct;
  const postcode = /\b(\d{5})\b/.exec(query)?.[1];
  if (!postcode) return null;
  const byPostcode = await geocodeSpanishAddress(postcode, dependencies);
  if (byPostcode) return byPostcode;
  const rest = query.replace(postcode, " ").replace(/^[\s,]+|[\s,]+$/g, "").replace(/\s{2,}/g, " ");
  return rest ? geocodeSpanishAddress(rest, dependencies) : null;
}
