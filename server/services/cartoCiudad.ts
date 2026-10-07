// CartoCiudad geocoder (Instituto Geográfico Nacional): free, no key, every
// Spanish address. Attribution: "CartoCiudad cedido por © Instituto
// Geográfico Nacional". Used for register addresses at import time and for
// the member's own location at search time.

export const CARTOCIUDAD_ATTRIBUTION = "CartoCiudad cedido por © Instituto Geográfico Nacional";
const FIND_URL = "https://www.cartociudad.es/geocoder/api/geocoder/find";

export interface GeocodedPoint {
  lat: number;
  lng: number;
  postcode: string | null;
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
  provinceCode?: unknown;
  muniCode?: unknown;
  type?: unknown;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

export async function geocodeSpanishAddress(
  address: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  const query = address.trim();
  if (!query) return null;
  const fetcher = dependencies.fetch ?? fetch;
  const url = new URL(FIND_URL);
  url.searchParams.set("q", query);
  try {
    const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(dependencies.timeoutMs ?? 7000)
      : undefined;
    const response = await fetcher(url, { signal });
    if (!response.ok) return null;
    const body = await response.text();
    if (!body.trim()) return null;
    const data = JSON.parse(body) as FindResponse | null;
    if (!data || typeof data.lat !== "number" || typeof data.lng !== "number") return null;
    if (!Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return null;
    return {
      lat: data.lat,
      lng: data.lng,
      postcode: text(data.postalCode),
      provinceCode: text(data.provinceCode),
      municipalityCode: text(data.muniCode),
      precision: text(data.type),
    };
  } catch {
    return null;
  }
}
