// A member's own location in Germany, placed with Nominatim (OpenStreetMap's
// geocoder). Free, no key. The public server's usage policy allows light,
// interactive use: one request at a time, an identifying User-Agent, no bulk
// geocoding. Care Finder sends one request per search. Data © OpenStreetMap
// contributors, ODbL. A self-hosted Nominatim or Photon is the step up if
// German volume grows (docs/research/care-finder-provider-sources-germany.md §13.7).

import type { GeocodedPoint } from "./cartoCiudad.js";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";

type Result = {
  lat?: unknown;
  lon?: unknown;
  addresstype?: unknown;
  address?: { postcode?: unknown; "ISO3166-2-lvl4"?: unknown };
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/** "Hauptstraße 5, 17291 Prenzlau", "10115 Berlin", "Prenzlau". */
export async function geocodeGermanLocation(
  location: string,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<GeocodedPoint | null> {
  const query = location.trim();
  if (query.length < 3) return null;
  const url = new URL(SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "de");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  try {
    const response = await (dependencies.fetch ?? fetch)(url, {
      headers: { "user-agent": "VYVA-CareFinder/1.0", "accept-language": "de" },
      signal: AbortSignal.timeout(dependencies.timeoutMs ?? 7000),
    });
    if (!response.ok) return null;
    const [result] = await response.json() as Result[];
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!result || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      postcode: text(result.address?.postcode),
      // "DE-BE": the Land, the same code German register rows carry.
      regionCode: text(result.address?.["ISO3166-2-lvl4"]),
      provinceCode: null,
      municipalityCode: null,
      precision: text(result.addresstype),
    };
  } catch {
    return null;
  }
}
