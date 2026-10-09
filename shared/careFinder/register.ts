// Spain's national register of authorised health centres (REGCESS,
// Ministerio de Sanidad). Pure helpers shared by the monthly importer
// (scripts/import-care-register.ts) and the Care Finder search.
//
// A place is shown as a health provider only if it is authorised for the
// kind of care asked for. The register says nothing about prices, opening
// hours, step-free access or languages; those stay "ask when you call".

import type { CareAccessRoute, CareTypeId } from "./careRoutes.js";

export const REGISTER_LISTINGS = ["C1", "C2", "C3", "E"] as const;
export type RegisterListing = typeof REGISTER_LISTINGS[number];

export const REGISTER_DOWNLOAD_URL = "https://regcesslm.sanidad.gob.es/recesAdminWeb/lm/GetExcelListadoMensual?tipoListado=";
export const REGISTER_SEARCH_URL = "https://regcess.mscbs.es/regcessWeb/inicioBuscarCentrosAction.do";
export const REGISTER_SOURCE_LABEL = "REGCESS, Ministerio de Sanidad";

// Not imported: pharmacies (often listed under the pharmacist's own name)
// and first-aid kits.
export const REGISTER_SKIPPED_CLASSES: ReadonlySet<string> = new Set(["E1", "E2"]);

// Never offered to members: services inside care homes, prisons and
// companies (C3), mobile units (C257) and driving-licence medical centres
// (C2510) are not places the public can go to.
const NOT_OPEN_TO_PUBLIC: ReadonlySet<string> = new Set(["C3", "C257", "C2510"]);

const PRIMARY_CARE_CENTRES = ["C231", "C232"];

/** Home health care (atención sanitaria domiciliaria). */
export const HOME_CARE_CODE = "U.66";

export interface RegisterCareRule {
  // Any of these care-offered codes qualifies.
  codes?: string[];
  // Or any of these centre classes (establishments carry no codes).
  classes?: string[];
  // Only for the public route: restrict to these classes, public ownership.
  publicClasses?: string[];
  // Only for the private route: the code must be held by one of these classes.
  privateClasses?: string[];
  // Extra condition on top of a weak code (U.900 "other units").
  nameHint?: RegExp;
}

// Codes read from the REGCESS files on 7 Oct 2026. The list is being revised
// by royal decree; the importer stores codes verbatim, so a renamed code only
// needs this table updated.
export const REGISTER_CARE_RULES: Record<CareTypeId, RegisterCareRule> = {
  // Privately, a family doctor is a medical practice or a multi-specialty
  // centre; hospitals and specialist clinics also hold U.1 but aren't one.
  primary_care: { codes: ["U.1"], publicClasses: PRIMARY_CARE_CENTRES, privateClasses: ["C21", "C24"] },
  same_day: { codes: ["U.68"], publicClasses: PRIMARY_CARE_CENTRES },
  physiotherapy: { codes: ["U.59"] },
  orthopaedics: { codes: ["U.55"] },
  optician: { classes: ["E3"] },
  ophthalmology: { codes: ["U.50"] },
  hearing_centre: { classes: ["E5"] },
  ent: { codes: ["U.52"] },
  neurology: { codes: ["U.17"] },
  // General health psychologists have no code of their own: they are filed
  // under U.900 "other units", so the name has to say psychology too.
  psychology: { codes: ["U.70", "U.900"], nameHint: /psic[oó]log/i },
  dentist: { codes: ["U.44"] },
  urgent_dentist: { codes: ["U.44"] },
};

// French rows (registerFr.ts): a practitioner or shop from RPPS, a centre from FINESS.
// German rows (registerDe.ts): a provider mapped on OpenStreetMap.
export type RegisterSourceListing = RegisterListing | "RPPS" | "FINESS" | "OSM";

export interface RegisterPlace {
  // ISO country; absent means Spain (REGCESS).
  country?: string;
  ccn: string;
  regionalCode: string | null;
  listing: RegisterSourceListing;
  centreClass: string | null;
  centreClassName: string | null;
  name: string;
  regionCode: string | null;
  regionName: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  municipalityCode: string | null;
  municipalityName: string | null;
  street: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ownership: "public" | "private" | null;
  dependency: string | null;
  careCodes: string[];
}

export interface RegisterPlaceWithPosition extends RegisterPlace {
  lat: number | null;
  lng: number | null;
  sourceUpdatedOn: string;
}

// Header cells carry embedded newlines and stray double spaces.
export function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const COLUMNS = {
  centreType: "tipo centro",
  ccn: "codigo de centro normalizado regcess (ccn)",
  regionalCode: "codigo autonomico del centro",
  name: "nombre centro",
  regionCode: "codigo comunidad autonoma",
  regionName: "comunidad autonoma",
  provinceCode: "codigo provincia",
  provinceName: "provincia",
  municipalityCode: "codigo municipio",
  municipalityName: "municipio",
  streetType: "codigo tipo via",
  streetName: "nombre de la via",
  streetNumber: "numero via",
  postcode: "codigo postal",
  email: "correo electronico",
  phone: "telefono",
  website: "url",
  dependency: "dependencia funcional",
  ownershipGroup: "grupo de dependencia funcional",
  careOffered: "oferta asistencial",
} as const;

type ColumnKey = keyof typeof COLUMNS;
export type RegisterColumnIndex = Record<ColumnKey, number>;

const REQUIRED_COLUMNS: ColumnKey[] = ["centreType", "ccn", "name", "provinceCode", "municipalityName", "streetName", "postcode", "phone", "ownershipGroup"];

/** Maps the header row to column positions; throws if the file changed shape. */
export function registerColumnIndex(header: readonly unknown[]): RegisterColumnIndex {
  const positions = new Map(header.map((cell, index) => [normaliseHeader(cell), index] as const));
  const index = {} as RegisterColumnIndex;
  for (const [key, label] of Object.entries(COLUMNS) as Array<[ColumnKey, string]>) {
    index[key] = positions.get(label) ?? -1;
  }
  const missing = REQUIRED_COLUMNS.filter((key) => index[key] < 0);
  if (missing.length > 0) throw new Error(`REGCESS file is missing columns: ${missing.map((key) => COLUMNS[key]).join(", ")}`);
  return index;
}

function cell(row: readonly unknown[], position: number): string | null {
  if (position < 0) return null;
  const value = row[position];
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text ? text : null;
}

/** "U.1 Medicina general/de familia,U.100 Transporte sanitario (carretera, aéreo, marítimo)," */
export function parseCareOffered(value: string | null | undefined): string[] {
  if (!value) return [];
  // Names can contain commas, so read the codes rather than splitting.
  return Array.from(new Set(Array.from(value.matchAll(/(?:^|,)\s*(U\.\d+)\s/g), (match) => match[1])));
}

/** "C251 - Clínicas Dentales" → ["C251", "Clínicas Dentales"] */
export function parseCentreClass(value: string | null): [string | null, string | null] {
  if (!value) return [null, null];
  const match = /^([CE]\d+)\s*-\s*(.+)$/.exec(value);
  return match ? [match[1], match[2].replace(/\s+/g, " ").trim()] : [null, value];
}

// Placeholders the register uses for "no phone".
function realPhone(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && !/^0+$/.test(digits) ? value : null;
}

function realWebsite(value: string | null): string | null {
  if (!value) return null;
  const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes(".") ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function titleCase(value: string | null): string | null {
  if (!value) return null;
  // The register is in capitals; keep short particles lower case.
  return value.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`)
    .replace(/\s(De|Del|La|Las|Los|Y|E|El)\s/g, (word) => word.toLowerCase());
}

/** One spreadsheet row to a place, or null when it isn't one we keep. */
export function registerPlaceFromRow(row: readonly unknown[], index: RegisterColumnIndex, listing: RegisterListing): RegisterPlace | null {
  const ccn = cell(row, index.ccn);
  const name = cell(row, index.name);
  if (!ccn || !name) return null;
  const [centreClass, centreClassName] = parseCentreClass(cell(row, index.centreType));
  if (centreClass && REGISTER_SKIPPED_CLASSES.has(centreClass)) return null;
  const group = (cell(row, index.ownershipGroup) ?? "").toLowerCase();
  const streetParts = [cell(row, index.streetType), cell(row, index.streetName), cell(row, index.streetNumber)]
    .filter((part): part is string => Boolean(part) && part !== "0");
  return {
    ccn,
    regionalCode: cell(row, index.regionalCode),
    listing,
    centreClass,
    centreClassName,
    name,
    regionCode: cell(row, index.regionCode),
    regionName: cell(row, index.regionName),
    provinceCode: cell(row, index.provinceCode),
    provinceName: cell(row, index.provinceName),
    municipalityCode: cell(row, index.municipalityCode),
    municipalityName: cell(row, index.municipalityName),
    street: streetParts.length ? streetParts.join(" ") : null,
    postcode: cell(row, index.postcode),
    phone: realPhone(cell(row, index.phone)),
    email: cell(row, index.email)?.toLowerCase() ?? null,
    website: realWebsite(cell(row, index.website)),
    ownership: group.startsWith("public") ? "public" : group.startsWith("privad") ? "private" : null,
    dependency: cell(row, index.dependency),
    careCodes: parseCareOffered(cell(row, index.careOffered)),
  };
}

/** "Puerto de Santa María, El" → "El Puerto de Santa María". */
export function uninvertPlaceName(value: string | null): string | null {
  if (!value) return null;
  const match = /^(.+),\s*(El|La|Los|Las|L'|Els|Les|O|A|Os|As)$/i.exec(value.trim());
  if (!match) return value.trim();
  return match[2].endsWith("'") ? `${match[2]}${match[1]}` : `${match[2]} ${match[1]}`;
}

/**
 * The address sent to the geocoder; a change means the place moved.
 * "street, municipality" only: CartoCiudad finds far fewer register
 * addresses when the postcode and province are included (checked on
 * 7 Oct 2026: Barcelona 0/20 with them, 19/20 without).
 */
export function registerGeocodeAddress(place: Pick<RegisterPlace, "street" | "municipalityName">): string | null {
  const municipality = uninvertPlaceName(place.municipalityName);
  if (!place.street || !municipality) return null;
  return `${place.street}, ${municipality}`;
}

// Words after which a register street holds only floor, door or premises
// details ("4º A", "LOCAL 11-12", "ESC.1ª", "BAJO"), or a cross street.
const STREET_DETAIL = /[\s,.]+(?:ESC|ESCALERA|PTA|PUERTA|PISO|PLANTA|PL|LOCAL|LOCALES|BAJO|BAJOS|BAIXOS|BAIX|ENTLO|ENTRESUELO|ENT|ATICO|ÁTICO|IZDA|IZQ|IZQUIERDA|DCHA|DRCHA|DERECHA|EDIF|EDIFICIO|BLOQUE|BLQ|PORTAL|NAVE|OFICINA|OF|ESQ|ESQUINA|CV|C\.C|CENTRO COMERCIAL|C\/V)\b.*$/i;

/**
 * The street without what a geocoder trips over: brackets, "S/N", "Nº",
 * floors ("2º"), doors and premises. "CALLE JUAN DE HERRERA Nº 2 2º IZDA"
 * becomes "CALLE JUAN DE HERRERA 2".
 */
export function cleanRegisterStreet(street: string | null): string | null {
  if (!street) return null;
  const cleaned = street
    .replace(/\([^)]*\)/g, " ")
    .replace(STREET_DETAIL, "")
    .replace(/\bS\s*\/\s*N\b/gi, " ")
    .replace(/\bN[º°]\.?\s*/gi, " ")
    // A floor ("2º", "1ª") and everything after it.
    .replace(/\s+\d+\s*[º°ª].*$/, "")
    // "AVDA CIUDAD DE NARA, 2, C.C. …": the number, then nothing more.
    .replace(/^([^,]*?),\s*(\d+[A-Z]?)\b.*$/i, "$1 $2")
    .replace(/\s*,\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || null;
}

/** The street name alone, for when the number is not known to the geocoder. */
function streetNameOnly(street: string): string | null {
  const words = street.split(/\s+/);
  while (words.length > 2 && /^[\d/-]+[A-Z]?$|^[A-Z]$/i.test(words[words.length - 1])) words.pop();
  const name = words.join(" ");
  return name === street ? null : name;
}

/**
 * Geocoder queries for a place, best first: the address as registered,
 * then cleaned of floor and door details, then the street alone.
 */
export function registerGeocodeQueries(place: Pick<RegisterPlace, "street" | "municipalityName">): string[] {
  const exact = registerGeocodeAddress(place);
  const municipality = uninvertPlaceName(place.municipalityName);
  if (!exact || !municipality) return [];
  const cleaned = cleanRegisterStreet(place.street);
  const name = cleaned ? streetNameOnly(cleaned) : null;
  return Array.from(new Set([exact, cleaned && `${cleaned}, ${municipality}`, name && `${name}, ${municipality}`]
    .filter((query): query is string => Boolean(query))));
}

/**
 * Whether a geocoded point can belong to this place. The geocoder snaps to
 * the nearest match it has, sometimes in another province. CartoCiudad's
 * municipality code is the 6-digit REGCESS one without its check digit.
 */
const IMPRECISE_MATCHES: ReadonlySet<string> = new Set(["municipio", "poblacion", "provincia", "codpost", "comunidad autonoma"]);

export function geocodeFitsPlace(
  point: { provinceCode: string | null; municipalityCode: string | null; precision?: string | null },
  place: { province_code?: string | null; municipality_code?: string | null; provinceCode?: string | null; municipalityCode?: string | null },
): boolean {
  const province = place.provinceCode ?? place.province_code ?? null;
  const municipality = place.municipalityCode ?? place.municipality_code ?? null;
  if (province && point.provinceCode && point.provinceCode !== province) return false;
  if (municipality && point.municipalityCode && point.municipalityCode !== municipality.slice(0, 5)) return false;
  // A town or postcode centre is too rough to measure distance from.
  if (point.precision && IMPRECISE_MATCHES.has(point.precision.toLowerCase())) return false;
  return Boolean(point.provinceCode || point.municipalityCode);
}

// French rows are stored ready to show (registerFr.ts formats them on import).
const isSpanish = (place: Pick<RegisterPlace, "country">) => !place.country || place.country === "ES";

export function registerDisplayName(place: Pick<RegisterPlace, "name" | "country">): string {
  return isSpanish(place) ? titleCase(place.name) ?? place.name : place.name;
}

export function registerDisplayAddress(place: Pick<RegisterPlace, "street" | "postcode" | "municipalityName" | "country">): string | null {
  const town = isSpanish(place) ? titleCase(uninvertPlaceName(place.municipalityName)) : place.municipalityName;
  const parts = [isSpanish(place) ? titleCase(place.street) : place.street, [place.postcode, town].filter(Boolean).join(" ")].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** Whether a place is authorised for this care, by this access route. */
export function registerPlaceOffers(
  place: Pick<RegisterPlace, "centreClass" | "careCodes" | "ownership" | "name" | "country">,
  careType: CareTypeId,
  access: CareAccessRoute,
): boolean {
  // France: the importer already worked out the care types. Public cover
  // reaches the same practitioners, so the route doesn't narrow the list.
  if (!isSpanish(place)) return place.careCodes.includes(`${place.country!.toLowerCase()}:${careType}`);
  if (place.centreClass && NOT_OPEN_TO_PUBLIC.has(place.centreClass)) return false;
  const rule = REGISTER_CARE_RULES[careType];
  if (access === "public" && rule.publicClasses) {
    return place.ownership === "public" && Boolean(place.centreClass && rule.publicClasses.includes(place.centreClass));
  }
  // Private route, or care the public system reaches only by referral: show
  // places people can contact directly.
  if (place.ownership === "public") return false;
  if (rule.privateClasses && !(place.centreClass && rule.privateClasses.includes(place.centreClass))) return false;
  if (rule.classes?.length && place.centreClass && rule.classes.includes(place.centreClass)) return true;
  if (!rule.codes?.length) return false;
  const strong = rule.codes.filter((code) => code !== "U.900");
  if (place.careCodes.some((code) => strong.includes(code))) return true;
  return Boolean(rule.nameHint && rule.codes.includes("U.900") && place.careCodes.includes("U.900") && rule.nameHint.test(place.name));
}

/** Codes or classes to pre-filter in SQL before registerPlaceOffers decides. */
export function registerCandidateFilter(careType: CareTypeId, access: CareAccessRoute, country = "ES"): { codes: string[]; classes: string[] } {
  if (country !== "ES") return { codes: [`${country.toLowerCase()}:${careType}`], classes: [] };
  const rule = REGISTER_CARE_RULES[careType];
  if (access === "public" && rule.publicClasses) return { codes: [], classes: rule.publicClasses };
  return { codes: rule.codes ?? [], classes: rule.classes ?? [] };
}

/** Straight-line distance in km. Our own figure, so it may be stored. */
export function distanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Import helpers ──────────────────────────────────────────────────────────

/** Whether any Care Finder search could ever show this place. */
export function registerPlaceIsRelevant(place: Pick<RegisterPlace, "centreClass" | "careCodes" | "ownership" | "name">): boolean {
  return (Object.keys(REGISTER_CARE_RULES) as CareTypeId[]).some((careType) => (
    registerPlaceOffers(place, careType, "private") || registerPlaceOffers(place, careType, "public")
  ));
}

export interface StoredPosition {
  lat: number | null;
  lng: number | null;
  // register: published by the register itself (FINESS); ban: France's geocoder.
  geocodeSource: "regional_register" | "cartociudad" | "register" | "ban" | "osm" | null;
  geocodedAddress: string | null;
}

/**
 * Coordinates for a re-imported place. A regional register position always
 * wins; a geocoded one is kept only while the address is unchanged.
 */
export function positionForImport(
  previous: StoredPosition | undefined,
  address: string | null,
  regional: { lat: number; lng: number } | undefined,
): StoredPosition {
  if (regional) return { lat: regional.lat, lng: regional.lng, geocodeSource: "regional_register", geocodedAddress: address };
  const geocoded = previous?.geocodeSource === "cartociudad" || previous?.geocodeSource === "ban";
  if (previous?.lat != null && previous.lng != null && geocoded && previous.geocodedAddress === address) {
    return previous;
  }
  return { lat: null, lng: null, geocodeSource: null, geocodedAddress: address };
}

/** Castilla y León register "Posición": "41.510876, -5.734168". */
export function parseRegionalPosition(value: string | null | undefined): { lat: number; lng: number } | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(value ?? "");
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  // Spain, Canaries included.
  return lat >= 27 && lat <= 44.5 && lng >= -18.5 && lng <= 4.6 ? { lat, lng } : null;
}

/** Splits one line of a semicolon-separated file with optional quotes. */
export function splitDelimitedLine(line: string, delimiter = ";"): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((value) => value.trim());
}
