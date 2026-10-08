// France's official registers for Care Finder. Pure helpers shared by the
// importer (scripts/import-care-register-fr.ts) and the search.
//
//   RPPS / Annuaire Santé (Agence du Numérique en Santé): every registered
//   health professional and where they practise. One place per practitioner
//   and practice site; opticians and hearing-aid shops are one place per shop.
//   FINESS (Ministère de la Santé): registered establishments. Only health
//   centres (124) and multi-professional practices (603) are kept.
//
// Both are Licence Ouverte 2.0: commercial reuse allowed, naming the source
// and the date of last update, which Care Finder shows on every result.
// Research and counts: docs/research/care-finder-provider-sources-france.md.
//
// French rows carry Care Finder care types as codes ("fr:dentist"), worked
// out here from the register's own profession, specialty and category, so
// the search needs no French code tables.

import { createHash } from "node:crypto";
import type { CareTypeId } from "./careRoutes.js";
import { normaliseHeader, type RegisterPlace } from "./register.js";

export const FR_RPPS_SOURCE_LABEL = "Annuaire Santé (RPPS), Agence du Numérique en Santé";
export const FR_RPPS_SOURCE_URL = "https://annuaire.esante.gouv.fr/";
export const FR_FINESS_SOURCE_LABEL = "FINESS, Ministère de la Santé";
export const FR_FINESS_SOURCE_URL = "https://finess.esante.gouv.fr/";

export const FR_RPPS_DATASET = "annuaire-sante-extractions-des-donnees-en-libre-acces-des-professionnels-intervenant-dans-le-systeme-de-sante-rpps";
export const FR_FINESS_DATASET = "finess-structures-1";

export function frCareCode(careType: CareTypeId): string {
  return `fr:${careType}`;
}

// ── RPPS ────────────────────────────────────────────────────────────────────

const RPPS_COLUMNS = {
  id: "identifiant pp",
  civility: "code civilite d'exercice",
  lastName: "nom d'exercice",
  firstName: "prenom d'exercice",
  profession: "code profession",
  professionName: "libelle profession",
  skillCode: "code savoir-faire",
  skillName: "libelle savoir-faire",
  mode: "code mode exercice",
  siret: "numero siret site",
  finess: "numero finess site",
  siteName: "raison sociale site",
  tradeName: "enseigne commerciale site",
  number: "numero voie (coord. structure)",
  repeat: "indice repetition voie (coord. structure)",
  streetType: "libelle type de voie (coord. structure)",
  streetName: "libelle voie (coord. structure)",
  locality: "mention distribution (coord. structure)",
  postcode: "code postal (coord. structure)",
  municipalityCode: "code commune (coord. structure)",
  municipalityName: "libelle commune (coord. structure)",
  phone: "telephone (coord. structure)",
  phone2: "telephone 2 (coord. structure)",
  email: "adresse e-mail (coord. structure)",
  departmentCode: "code departement (structure)",
  departmentName: "libelle departement (structure)",
} as const;

type RppsKey = keyof typeof RPPS_COLUMNS;
export type RppsColumnIndex = Record<RppsKey, number>;

const RPPS_REQUIRED: RppsKey[] = [
  "id", "lastName", "profession", "mode", "streetName", "postcode", "municipalityCode", "municipalityName", "phone",
];

/** Maps the RPPS header to column positions; throws if the file changed shape. */
export function rppsColumnIndex(header: readonly string[]): RppsColumnIndex {
  const positions = new Map(header.map((cell, index) => [normaliseHeader(cell.replace(/^\uFEFF/, "")), index] as const));
  const index = {} as RppsColumnIndex;
  for (const [key, label] of Object.entries(RPPS_COLUMNS) as Array<[RppsKey, string]>) index[key] = positions.get(label) ?? -1;
  const missing = RPPS_REQUIRED.filter((key) => index[key] < 0);
  if (missing.length) throw new Error(`RPPS file is missing columns: ${missing.map((key) => RPPS_COLUMNS[key]).join(", ")}`);
  return index;
}

const PROFESSION = {
  doctor: "10",
  dentist: "40",
  physiotherapist: "70",
  optician: "28",
  hearingAid: "26",
  psychologist: "93",
} as const;

// Doctors by specialty, matched on the published label (codes are revised;
// the labels have been stable for years).
const DOCTOR_SPECIALTIES: Array<[RegExp, CareTypeId[]]> = [
  // "Spécialiste en Médecine Générale" (SM53), "Qualifié en …" (SM26), "Médecine Générale" (SM54).
  [/^((specialiste|qualifie) en )?medecine generale/, ["primary_care", "same_day"]],
  [/^ophtalmologie/, ["ophthalmology"]],
  [/^oto-rhino-laryngologie|^o\.?r\.?l\b/, ["ent"]],
  [/^neurologie/, ["neurology"]],
  [/^chirurgie orthopedique/, ["orthopaedics"]],
];

/** The care types a practitioner row offers, by profession and specialty. */
export function rppsCareTypes(profession: string | null, skillName: string | null): CareTypeId[] {
  switch (profession) {
    case PROFESSION.dentist: return ["dentist", "urgent_dentist"];
    case PROFESSION.physiotherapist: return ["physiotherapy"];
    case PROFESSION.optician: return ["optician"];
    case PROFESSION.hearingAid: return ["hearing_centre"];
    case PROFESSION.psychologist: return ["psychology"];
    case PROFESSION.doctor: {
      const skill = normaliseHeader(skillName);
      return DOCTOR_SPECIALTIES.find(([pattern]) => pattern.test(skill))?.[1] ?? [];
    }
    default: return [];
  }
}

// Shops: the shop is the place, not each person working in it.
const SITE_PROFESSIONS: ReadonlySet<string> = new Set([PROFESSION.optician, PROFESSION.hearingAid]);

function value(cells: readonly string[], position: number): string | null {
  if (position < 0) return null;
  const text = (cells[position] ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

const PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "sur", "sous", "en", "aux", "au", "et", "à", "d", "l"]);

/** "RUE DE LA PAIX" → "Rue de la Paix"; "SAINT-ETIENNE-DU-BOIS" → "Saint-Etienne-du-Bois". */
export function frenchTitleCase(text: string | null, options: { particles?: boolean } = {}): string | null {
  if (!text) return null;
  const particles = options.particles ?? true;
  let first = true;
  return text.toLowerCase().replace(/[\p{L}]+/gu, (word, offset: number, whole: string) => {
    const lead = first;
    first = false;
    // "16E Arrondissement" → "16e", "1ER" → "1er".
    if (offset > 0 && /\d/.test(whole[offset - 1])) return word;
    // "d'" / "l'" and short joining words stay lower case after the first word.
    if (particles && !lead && PARTICLES.has(word) && offset > 0 && /[\s'-]/.test(whole[offset - 1])) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/** "0145678901" → "01 45 67 89 01". Anything that isn't a French number stays as given. */
export function frenchPhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (/^0\d{9}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  if (/^33\d{9}$/.test(digits)) return `0${digits.slice(2)}`.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return digits.length >= 9 ? raw.trim() : null;
}

function shortHash(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

/** The département from a commune code: "75056" → "75", "2A004" → "2A", "97411" → "974". */
export function frDepartment(municipalityCode: string | null): string | null {
  if (!municipalityCode) return null;
  return municipalityCode.startsWith("97") || municipalityCode.startsWith("98") ? municipalityCode.slice(0, 3) : municipalityCode.slice(0, 2);
}

export interface FrRegisterPlace extends RegisterPlace {
  country: "FR";
  // Coordinates the register itself publishes (FINESS); RPPS has none.
  registerPosition: { lat: number; lng: number } | null;
}

/** "12 B Rue de la Paix" from the structured RPPS address. */
function rppsStreet(cells: readonly string[], index: RppsColumnIndex): string | null {
  const number = [value(cells, index.number), value(cells, index.repeat)].filter(Boolean).join(" ");
  const type = value(cells, index.streetType);
  let name = value(cells, index.streetName);
  // No type given, but the name starts with one: "R DENIS PAPIN".
  const lead = !type && name ? /^(\S+)\s+(.+)$/.exec(name) : null;
  if (lead && STREET_TYPES[lead[1].toUpperCase()]) name = `${STREET_TYPES[lead[1].toUpperCase()]} ${lead[2]}`;
  const street = [type ? STREET_TYPES[type.toUpperCase()] ?? type : null, name].filter(Boolean).join(" ");
  if (!street) return null;
  return frenchTitleCase([number, street].filter(Boolean).join(" "));
}

/**
 * One RPPS activity row to a place, or null when Care Finder can't offer it:
 * a care type we don't search for, a salaried post (hospital doctors can't
 * be contacted directly; centres come from FINESS), or no practice address.
 */
export function rppsPlaceFromRow(cells: readonly string[], index: RppsColumnIndex): FrRegisterPlace | null {
  const id = value(cells, index.id);
  const profession = value(cells, index.profession);
  const careTypes = rppsCareTypes(profession, value(cells, index.skillName));
  if (!id || !profession || careTypes.length === 0) return null;
  const mode = value(cells, index.mode);
  const isSite = SITE_PROFESSIONS.has(profession);
  // Liberal practice ("L"); shops employ their opticians ("S").
  if (mode !== "L" && !(isSite && mode === "S")) return null;
  const street = rppsStreet(cells, index);
  const postcode = value(cells, index.postcode);
  const municipalityCode = value(cells, index.municipalityCode);
  const municipalityName = frenchTitleCase(value(cells, index.municipalityName));
  if (!street || !postcode || !municipalityName) return null;

  const siteName = value(cells, index.tradeName) ?? value(cells, index.siteName);
  let ccn: string;
  let name: string;
  if (isSite) {
    if (!siteName) return null;
    const site = value(cells, index.siret) ?? shortHash(`${siteName}|${street}|${postcode}`);
    ccn = `FR-SITE:${profession}:${site}`;
    name = frenchTitleCase(siteName)!;
  } else {
    const lastName = frenchTitleCase(value(cells, index.lastName), { particles: false });
    if (!lastName) return null;
    const civility = value(cells, index.civility);
    const title = civility === "DR" ? "Dr" : civility === "PR" ? "Pr" : null;
    name = [title, frenchTitleCase(value(cells, index.firstName), { particles: false }), lastName].filter(Boolean).join(" ");
    ccn = `FR-RPPS:${id}:${shortHash(`${value(cells, index.siret) ?? ""}|${street}|${postcode}`)}`;
  }
  const departmentCode = value(cells, index.departmentCode) ?? frDepartment(municipalityCode);
  return {
    country: "FR",
    ccn,
    regionalCode: id,
    listing: "RPPS",
    centreClass: profession,
    centreClassName: value(cells, index.professionName),
    name,
    regionCode: null,
    regionName: null,
    provinceCode: departmentCode,
    provinceName: value(cells, index.departmentName),
    municipalityCode,
    municipalityName,
    street,
    postcode,
    phone: frenchPhone(value(cells, index.phone)) ?? frenchPhone(value(cells, index.phone2)),
    email: value(cells, index.email)?.toLowerCase() ?? null,
    website: null,
    ownership: null,
    dependency: null,
    careCodes: careTypes.map(frCareCode),
    registerPosition: null,
  };
}

/** Adds a place; rows for the same practitioner and site (one per specialty) become one place. */
export function addFrPlace(merged: Map<string, FrRegisterPlace>, place: FrRegisterPlace): void {
  const existing = merged.get(place.ccn);
  if (!existing) {
    merged.set(place.ccn, place);
    return;
  }
  existing.careCodes = Array.from(new Set([...existing.careCodes, ...place.careCodes]));
  existing.phone ??= place.phone;
  existing.email ??= place.email;
}

export function mergeFrPlaces(places: Iterable<FrRegisterPlace>): FrRegisterPlace[] {
  const merged = new Map<string, FrRegisterPlace>();
  for (const place of places) addFrPlace(merged, { ...place, careCodes: [...place.careCodes] });
  return Array.from(merged.values());
}

// ── FINESS ──────────────────────────────────────────────────────────────────

export const FINESS_HEALTH_CENTRE = "124";
export const FINESS_MULTI_PRACTICE = "603";

const FINESS_CATEGORY_NAMES: Record<string, string> = {
  [FINESS_HEALTH_CENTRE]: "Centre de santé",
  [FINESS_MULTI_PRACTICE]: "Maison de santé pluriprofessionnelle",
};

/**
 * What a FINESS centre offers. Multi-professional practices are family
 * doctors. Health centres (124) share one category whatever they do, so the
 * registered name decides: a dental or eye centre says so, a nursing centre
 * isn't a care type Care Finder searches for.
 */
export function finessCareTypes(category: string | null, name: string): CareTypeId[] {
  if (category === FINESS_MULTI_PRACTICE) return ["primary_care", "same_day"];
  if (category !== FINESS_HEALTH_CENTRE) return [];
  const text = normaliseHeader(name);
  const types = new Set<CareTypeId>();
  const dental = /dentaire|dentiste/.test(text);
  if (dental) types.add("dentist").add("urgent_dentist");
  if (/ophtalm|vision|\boeil\b|\byeux\b/.test(text)) types.add("ophthalmology");
  if (/kine/.test(text)) types.add("physiotherapy");
  const nursing = /infirmi|\bcsi\b|soins infirm/.test(text);
  // A general centre, or a "médico-dentaire" one, has doctors.
  if ((!dental && !nursing && types.size === 0) || /medic|polyvalent|pluri/.test(text)) types.add("primary_care").add("same_day");
  return Array.from(types);
}

type Json = Record<string, unknown>;
const obj = (input: unknown): Json => (input && typeof input === "object" && !Array.isArray(input) ? input as Json : {});
const list = (input: unknown): unknown[] => (Array.isArray(input) ? input : []);
const str = (input: unknown): string | null => (typeof input === "string" && input.trim() ? input.replace(/\s+/g, " ").trim() : null);

// FINESS street-type abbreviations seen in the files.
const STREET_TYPES: Record<string, string> = {
  R: "Rue", AV: "Avenue", BD: "Boulevard", PL: "Place", CHE: "Chemin", RTE: "Route", ALL: "Allée", IMP: "Impasse",
  QU: "Quai", QUAI: "Quai", CRS: "Cours", SQ: "Square", PASS: "Passage", RES: "Résidence", LOT: "Lotissement",
  ZA: "ZA", ZI: "ZI", ZAC: "ZAC", FG: "Faubourg", MTE: "Montée", PRO: "Promenade", ESP: "Esplanade", HAM: "Hameau",
  LD: "Lieu-dit", CTRE: "Centre", CC: "Centre commercial", RPT: "Rond-point", SEN: "Sente", VOIE: "Voie",
  // RPPS abbreviations.
  CHEM: "Chemin", TRA: "Traverse", RLE: "Ruelle", CAR: "Carrefour", CITE: "Cité", DOM: "Domaine", PARV: "Parvis",
};

function plausiblePosition(lat: number, lng: number): boolean {
  // Metropolitan France and the overseas departments.
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -22 && lat <= 52 && lng >= -63 && lng <= 56 && !(lat === 0 && lng === 0);
}

/**
 * The WGS84 position FINESS publishes for a site. Files disagree on where:
 * ANS's published sample has it in directionLatitude/Longitude with Lambert
 * in coordonneeX/Y; the September 2026 monthly file has them the other way
 * round. Whichever pair is a real latitude and longitude wins.
 */
export function finessPosition(address: Json): { lat: number; lng: number } | null {
  const geo = obj(address.coordonneesGeographique);
  const pairs: Array<[unknown, unknown]> = [[geo.directionLatitude, geo.directionLongitude], [geo.coordonneeY, geo.coordonneeX]];
  for (const [latText, lngText] of pairs) {
    if (!str(latText) || !str(lngText)) continue;
    const lat = Number(str(latText));
    const lng = Number(str(lngText));
    if (plausiblePosition(lat, lng)) return { lat, lng };
  }
  return null;
}

/**
 * One FINESS site (an "EGE" inside a legal entity) to a place, or null when
 * it is closed, not a health centre, or offers nothing Care Finder searches.
 */
export function finessPlaceFromSite(site: unknown): FrRegisterPlace | null {
  const ege = obj(site);
  if (str(ege.etatObjet) !== "A") return null;
  const category = str(ege.categorieentiteGeographiqueExercice);
  const info = obj(ege.informationsGeneralesEGE);
  const finess = str(info.numFinessEge);
  const rawName = str(info.nomEgeLong) ?? str(info.nomEgeCourt);
  if (!finess || !rawName || !category) return null;
  const careTypes = finessCareTypes(category, rawName);
  if (careTypes.length === 0) return null;
  // The site's own address ("03"); others are postal.
  const addresses = list(ege.adresse).map(obj);
  const address = addresses.find((item) => str(item.usageAdresse) === "03") ?? addresses[0] ?? {};
  const typeCode = str(address.typeVoie);
  const streetParts = [str(address.numeroVoie), str(address.complementNumeroVoie), typeCode ? STREET_TYPES[typeCode] ?? typeCode : null, str(address.libelleVoie)];
  const street = streetParts.some(Boolean) && str(address.libelleVoie) ? frenchTitleCase(streetParts.filter(Boolean).join(" ")) : null;
  const municipalityCode = str(address.cogCommune);
  const telecoms = list(ege.contact).map((contact) => obj(obj(contact).telecom));
  const phone = telecoms.map((telecom) => frenchPhone(str(telecom.telephone))).find(Boolean) ?? null;
  const email = telecoms.map((telecom) => str(telecom.email) ?? str(telecom.adresseMail)).find(Boolean)?.toLowerCase() ?? null;
  return {
    country: "FR",
    ccn: `FR-FINESS:${finess}`,
    regionalCode: finess,
    listing: "FINESS",
    centreClass: category,
    centreClassName: FINESS_CATEGORY_NAMES[category] ?? null,
    name: frenchTitleCase(rawName, { particles: true })!,
    regionCode: null,
    regionName: null,
    provinceCode: frDepartment(municipalityCode),
    provinceName: null,
    municipalityCode,
    // "BOURG EN BRESSE": the postal line, the closest FINESS has to a town name.
    municipalityName: frenchTitleCase(str(address.ligneAcheminement)?.replace(/\s+CEDEX\b.*$/i, "") ?? null),
    street,
    postcode: str(address.codePostal),
    phone,
    email,
    website: null,
    ownership: null,
    dependency: null,
    careCodes: careTypes.map(frCareCode),
    registerPosition: finessPosition(address),
  };
}

/** The address sent to the geocoder; a change means the place moved. */
export function frGeocodeAddress(place: Pick<RegisterPlace, "street" | "postcode" | "municipalityName">): string | null {
  if (!place.street || !place.postcode || !place.municipalityName) return null;
  return `${place.street}, ${place.postcode} ${place.municipalityName}`;
}

// ── BAN geocoding (Géoplateforme) ───────────────────────────────────────────

const PRECISE_BAN_TYPES: ReadonlySet<string> = new Set(["housenumber", "street", "locality"]);
// Paris, Lyon and Marseille: registers may use the city code, BAN the district's.
export const DISTRICT_CITIES: Readonly<Record<string, string>> = { "75056": "751", "69123": "6938", "13055": "132" };
export const BAN_MIN_SCORE = 0.5;

/** Whether a BAN match is precise enough, and in the right commune, to place this site. */
export function banResultFits(
  result: { score: number | null; type: string | null; citycode: string | null; oldcitycode?: string | null },
  municipalityCode: string | null,
): boolean {
  if (result.score === null || result.score < BAN_MIN_SCORE) return false;
  if (!result.type || !PRECISE_BAN_TYPES.has(result.type)) return false;
  if (!municipalityCode || !result.citycode) return Boolean(result.citycode);
  if (result.citycode === municipalityCode || result.oldcitycode === municipalityCode) return true;
  const districtPrefix = DISTRICT_CITIES[municipalityCode];
  if (districtPrefix && result.citycode.startsWith(districtPrefix)) return true;
  const cityOfDistrict = Object.entries(DISTRICT_CITIES).find(([, prefix]) => municipalityCode.startsWith(prefix))?.[0];
  return cityOfDistrict === result.citycode;
}
