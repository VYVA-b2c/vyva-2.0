// The public-cover path. In Spain a person on public cover is assigned a
// health centre by where they live, and books with it through their
// region's online appointment service. Care Finder points to that centre
// and that service; it never books on the person's behalf.

import { normalizeCareText, type Localized } from "./careRoutes.js";

/**
 * How we know which centre is theirs:
 * - health_map: the region's published map of health zones lists this
 *   centre for the person's municipality.
 * - nearest: the closest public health centre or local clinic. Usually
 *   theirs, but the one on their health card is what counts.
 */
export type CareAssignedBasis = "health_map" | "nearest";

export interface CareFinderPublicCare {
  // INE autonomous community code, e.g. "07" Castilla y León.
  regionCode: string | null;
  assignedOptionId: string | null;
  basis: CareAssignedBasis | null;
  // Who publishes the health map, and when it was last updated.
  mapSource: string | null;
  mapUpdatedOn: string | null;
}

export interface RegionBooking {
  name: Localized;
  // Official page where a patient starts booking with their own centre.
  url: string;
  app: string | null;
  // What the booking service asks for, when it's more than the health card.
  needs?: Localized;
}

const HEALTH_CARD: Localized = {
  en: "You'll need your health card number (tarjeta sanitaria).",
  es: "Necesitará el número de su tarjeta sanitaria.",
  fr: "Vous aurez besoin du numéro de votre carte de santé (tarjeta sanitaria).",
  de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (tarjeta sanitaria).",
};

/** Official booking entry pages, by INE community code. Checked 7 Oct 2026. */
export const REGION_BOOKING: Record<string, RegionBooking> = {};

export function regionBooking(regionCode: string | null | undefined): RegionBooking | null {
  return regionCode ? REGION_BOOKING[regionCode] ?? null : null;
}

export { HEALTH_CARD as CARE_HEALTH_CARD_NEEDED };

const CENTRE_PREFIXES = [
  "centro de salud",
  "consultorio local de",
  "consultorio local",
  "consultorio de atencion primaria de",
  "consultorio de atencion primaria",
  "consultorio medico de",
  "consultorio medico",
  "consultorio de",
  "consultorio",
  "c s",
  "cs",
  "zbs",
];

/** "C.S. PUERTA NUEVA", "Centro de Salud Puerta Nueva" → "puerta nueva". */
export function normaliseCentreName(name: string): string {
  let text = normalizeCareText(name).replace(/[.,;:()"'´`-]/g, " ").replace(/\s+/g, " ").trim();
  for (const prefix of CENTRE_PREFIXES) {
    if (text === prefix) return text;
    if (text.startsWith(`${prefix} `)) {
      text = text.slice(prefix.length + 1);
      break;
    }
  }
  return text.replace(/^(de|del|la|el|los|las) /, "").trim();
}

export interface PublicCentreCandidate {
  id: string;
  name: string;
  km: number;
}

/**
 * Picks the person's centre among public candidates (closest first). A
 * health-map name wins when it matches a candidate; otherwise the closest.
 */
export function chooseAssignedCentre(
  candidates: readonly PublicCentreCandidate[],
  healthMapCentres: readonly string[] | null,
): { id: string; basis: CareAssignedBasis } | null {
  if (candidates.length === 0) return null;
  if (healthMapCentres?.length) {
    const wanted = new Set(healthMapCentres.map(normaliseCentreName).filter(Boolean));
    const match = candidates.find((candidate) => wanted.has(normaliseCentreName(candidate.name)));
    if (match) return { id: match.id, basis: "health_map" };
  }
  return { id: candidates[0].id, basis: "nearest" };
}
