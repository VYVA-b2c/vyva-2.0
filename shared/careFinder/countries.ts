// Which country a Care Finder search is for, and what VYVA has there.
//
// Every country gets the same journey. What differs is the data behind it:
// an official register of authorised providers (Spain today; France and
// others to follow, see docs/research/care-finder-provider-sources-*.md),
// the public-cover booking route, and the geocoder. Countries without a
// register fall back to the map search, labelled as not checked by VYVA.

/** ISO 3166-1 alpha-2, upper case ("ES", "FR", "DE", "GB", "IT"). */
export type CareFinderCountry = string;

/** Searches with no country are Spanish: every saved task and profile so far is. */
export const DEFAULT_CARE_FINDER_COUNTRY: CareFinderCountry = "ES";

// Countries whose official register is imported into care_register_places
// and searched first: Spain (scripts/import-care-register.ts) and France
// (scripts/import-care-register-fr.ts). Until a country's import has run its
// register is empty and the search falls through to the map search.
const OFFICIAL_REGISTER_COUNTRIES: ReadonlySet<CareFinderCountry> = new Set(["ES", "FR"]);

/** "es", " ES ", "uk" → "ES", "ES", "GB". Anything else → null. */
export function careFinderCountry(value: unknown): CareFinderCountry | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  if (code === "UK") return "GB";
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export function hasOfficialRegister(country: CareFinderCountry): boolean {
  return OFFICIAL_REGISTER_COUNTRIES.has(country);
}

/** Google's region bias takes a ccTLD, which for the United Kingdom is "uk". */
export function mapsRegionCode(country: CareFinderCountry): string {
  return country === "GB" ? "uk" : country.toLowerCase();
}
