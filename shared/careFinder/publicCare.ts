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

/**
 * Official booking entry pages, by INE community code. Each was opened on
 * 7 Oct 2026, except two opened on 8 Oct 2026: the Basque Country's, from the
 * link on Osakidetza's own booking FAQ page, and Valencia's patient-portal page
 * that carries the Conselleria's primary-care booking button (the button's own
 * address needs a session, so it isn't linked directly). The Asturias and
 * Navarra sites can't be reached from our build machines; their addresses were
 * opened and confirmed by hand on 8 Oct 2026. For a region missing from this
 * list, Care Finder suggests calling the centre. No region offers a link to
 * a specific centre: every service asks for the health card first.
 */
export const REGION_BOOKING: Record<string, RegionBooking> = {
  "01": {
    name: { en: "Andalusian Health Service", es: "Servicio Andaluz de Salud", fr: "Service andalou de santé", de: "Andalusischer Gesundheitsdienst" },
    url: "https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/clicsalud/pages/anonimo/agenda/pedirCita.jsf?opcionSeleccionada=MUPEDIRCITA",
    app: "ClicSalud+",
    needs: {
      en: "You'll need your health card number (NUHSA) or ID card, and your date of birth.",
      es: "Necesitará su número de tarjeta sanitaria (NUHSA) o su DNI, y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé (NUHSA) ou de votre pièce d'identité, et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (NUHSA) oder Ihren Ausweis und Ihr Geburtsdatum.",
    },
  },
  "02": {
    name: { en: "Aragon Health Service", es: "Salud Aragón", fr: "Service de santé d'Aragon", de: "Gesundheitsdienst Aragonien" },
    url: "https://www.saludinforma.es/portalsi/web/salud/tramites-gestiones/cita-previa",
    app: "Salud Informa",
    needs: {
      en: "You'll need your health card code (it starts with AR).",
      es: "Necesitará el código de su tarjeta sanitaria (empieza por AR).",
      fr: "Vous aurez besoin du code de votre carte de santé (il commence par AR).",
      de: "Sie brauchen den Code Ihrer Gesundheitskarte (beginnt mit AR).",
    },
  },
  "03": {
    name: { en: "Asturias Health Service", es: "Servicio de Salud del Principado de Asturias (SESPA)", fr: "Service de santé des Asturies", de: "Gesundheitsdienst Asturien" },
    url: "https://www.astursalud.es/astursalud",
    app: "Mi AsturSalud",
  },
  "04": {
    name: { en: "Balearic Health Service", es: "IB-Salut", fr: "Service de santé des Baléares", de: "Gesundheitsdienst der Balearen" },
    url: "https://www.ibsalut.es/es/info-ciudadania/cita-previa-ibsalut",
    app: "EspaiSalut",
  },
  "05": {
    name: { en: "Canary Islands Health Service", es: "Servicio Canario de la Salud", fr: "Service de santé des Canaries", de: "Gesundheitsdienst der Kanaren" },
    url: "https://www.gobiernodecanarias.org/citasalud",
    app: "miSCS",
    needs: {
      en: "You'll need your health card number (CIP) and the code on the back of the card.",
      es: "Necesitará el número de su tarjeta sanitaria (CIP) y el código del reverso de la tarjeta.",
      fr: "Vous aurez besoin du numéro de votre carte de santé (CIP) et du code au dos de la carte.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (CIP) und den Code auf der Rückseite.",
    },
  },
  "06": {
    name: { en: "Cantabria Health Service", es: "Servicio Cántabro de Salud", fr: "Service de santé de Cantabrie", de: "Gesundheitsdienst Kantabrien" },
    url: "https://www.scsalud.es/pedir-cita",
    app: "MiSalud@SCS",
  },
  "07": {
    name: { en: "Castile and León Health Service", es: "Sacyl, Junta de Castilla y León", fr: "Service de santé de Castille-et-León", de: "Gesundheitsdienst Kastilien und León" },
    url: "https://citaweb.saludcastillayleon.es/CitaPreviaWeb/#/start",
    app: "Sacyl Conecta",
    needs: {
      en: "You'll need your first surname and your health card number (CIP), or your ID number.",
      es: "Necesitará su primer apellido y el número de su tarjeta sanitaria (CIP) o su DNI.",
      fr: "Vous aurez besoin de votre premier nom de famille et du numéro de votre carte de santé (CIP) ou de votre numéro d'identité.",
      de: "Sie brauchen Ihren ersten Nachnamen und die Nummer Ihrer Gesundheitskarte (CIP) oder Ihre Ausweisnummer.",
    },
  },
  "08": {
    name: { en: "Castilla-La Mancha Health Service", es: "SESCAM", fr: "Service de santé de Castille-La Manche", de: "Gesundheitsdienst Kastilien-La Mancha" },
    url: "https://sanidad.castillalamancha.es/ciudadanos/citaprevia",
    app: "Mi Salud Digital",
  },
  "09": {
    name: { en: "Catalan Health Service", es: "CatSalut", fr: "Service catalan de santé", de: "Katalanischer Gesundheitsdienst" },
    url: "https://citasalut.gencat.cat/",
    app: "La Meva Salut",
  },
  "10": {
    name: { en: "Valencian Health Service", es: "Conselleria de Sanidad, Generalitat Valenciana", fr: "Service de santé valencien", de: "Valencianischer Gesundheitsdienst" },
    url: "https://www.san.gva.es/es/web/portal-del-paciente/informacion-centros",
    app: "GVA +Salut",
  },
  "11": {
    name: { en: "Extremadura Health Service", es: "Servicio Extremeño de Salud", fr: "Service de santé d'Estrémadure", de: "Gesundheitsdienst Extremadura" },
    url: "https://saludextremadura.ses.es/csonline/login/login.xhtml?accion=backToCitaPrevia",
    app: null,
    needs: {
      en: "You'll need your health card number (CIP) and your date of birth.",
      es: "Necesitará el número de su tarjeta sanitaria (CIP) y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé (CIP) et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (CIP) und Ihr Geburtsdatum.",
    },
  },
  "12": {
    name: { en: "Galician Health Service", es: "Sergas", fr: "Service galicien de santé", de: "Galicischer Gesundheitsdienst" },
    url: "https://cita.sergas.gal/",
    app: "Sergas Móbil",
    needs: {
      en: "You'll need your health card number and your date of birth.",
      es: "Necesitará el número de su tarjeta sanitaria y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte und Ihr Geburtsdatum.",
    },
  },
  "13": {
    name: { en: "Madrid Health Service", es: "SERMAS, Comunidad de Madrid", fr: "Service de santé de Madrid", de: "Gesundheitsdienst Madrid" },
    url: "https://www.comunidad.madrid/salud/cita-sanitaria",
    app: "Tarjeta Sanitaria Virtual",
    needs: {
      en: "You'll need your health card number, your ID card and your date of birth.",
      es: "Necesitará el número de su tarjeta sanitaria, su DNI o NIE y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé, de votre pièce d'identité et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte, Ihren Ausweis und Ihr Geburtsdatum.",
    },
  },
  "14": {
    name: { en: "Murcia Health Service", es: "Servicio Murciano de Salud", fr: "Service de santé de Murcie", de: "Gesundheitsdienst Murcia" },
    url: "https://sede.carm.es/sms/citainternet/login.xhtml",
    app: null,
    needs: {
      en: "You'll need your health card number (CIP) and your date of birth.",
      es: "Necesitará el número de su tarjeta sanitaria (CIP) y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé (CIP) et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (CIP) und Ihr Geburtsdatum.",
    },
  },
  "15": {
    name: { en: "Navarre Health Service", es: "Servicio Navarro de Salud-Osasunbidea", fr: "Service de santé de Navarre", de: "Gesundheitsdienst Navarra" },
    url: "https://www.navarra.es/es/tramites/on/-/line/Cita-previa-en-el-centro-de-salud",
    app: "Carpeta Personal de Salud",
  },
  "16": {
    name: { en: "Basque Health Service", es: "Osakidetza", fr: "Service basque de santé", de: "Baskischer Gesundheitsdienst" },
    url: "https://zitaberria.osakidetza.eus/o22PlamWar/iniciologin.do?idioma=es",
    app: "Osakidetza",
    needs: {
      en: "You'll need your health card number, your first surname and your date of birth.",
      es: "Necesitará el número de su tarjeta sanitaria, su primer apellido y su fecha de nacimiento.",
      fr: "Vous aurez besoin du numéro de votre carte de santé, de votre premier nom de famille et de votre date de naissance.",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte, Ihren ersten Nachnamen und Ihr Geburtsdatum.",
    },
  },
  "17": {
    name: { en: "La Rioja Health Service", es: "Rioja Salud", fr: "Service de santé de La Rioja", de: "Gesundheitsdienst La Rioja" },
    url: "https://cita-previa.riojasalud.es/",
    app: "Rioja Salud",
    needs: {
      en: "You'll need your health card number (CIP) and your ID number (DNI or NIE).",
      es: "Necesitará el número de su tarjeta sanitaria (CIP) y su DNI o NIE.",
      fr: "Vous aurez besoin du numéro de votre carte de santé (CIP) et de votre numéro d'identité (DNI ou NIE).",
      de: "Sie brauchen die Nummer Ihrer Gesundheitskarte (CIP) und Ihre Ausweisnummer (DNI oder NIE).",
    },
  },
  "18": {
    name: { en: "National health management (INGESA)", es: "INGESA, Ministerio de Sanidad", fr: "Gestion sanitaire nationale (INGESA)", de: "Nationale Gesundheitsverwaltung (INGESA)" },
    url: "https://citaweb-ingesa.sanidad.gob.es//IngesaCitaWeb/citaprevia/inicio",
    app: null,
    needs: {
      en: "Choose your city first. Then you'll need your health card number (CIP).",
      es: "Elija primero su ciudad. Después necesitará el número de su tarjeta sanitaria (CIP).",
      fr: "Choisissez d'abord votre ville. Ensuite, vous aurez besoin du numéro de votre carte de santé (CIP).",
      de: "Wählen Sie zuerst Ihre Stadt. Dann brauchen Sie die Nummer Ihrer Gesundheitskarte (CIP).",
    },
  },
  "19": {
    name: { en: "National health management (INGESA)", es: "INGESA, Ministerio de Sanidad", fr: "Gestion sanitaire nationale (INGESA)", de: "Nationale Gesundheitsverwaltung (INGESA)" },
    url: "https://citaweb-ingesa.sanidad.gob.es//IngesaCitaWeb/citaprevia/inicio",
    app: null,
    needs: {
      en: "Choose your city first. Then you'll need your health card number (CIP).",
      es: "Elija primero su ciudad. Después necesitará el número de su tarjeta sanitaria (CIP).",
      fr: "Choisissez d'abord votre ville. Ensuite, vous aurez besoin du numéro de votre carte de santé (CIP).",
      de: "Wählen Sie zuerst Ihre Stadt. Dann brauchen Sie die Nummer Ihrer Gesundheitskarte (CIP).",
    },
  },
};

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
  // null: in the member's town but not yet placed on the map.
  km: number | null;
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
  // "Nearest" is a claim about distance; never make it for an unplaced centre.
  return candidates[0].km === null ? null : { id: candidates[0].id, basis: "nearest" };
}

// ── Regional health maps ────────────────────────────────────────────────────

export const CASTILLA_LEON_HEALTH_MAP_URL = "https://datosabiertos.jcyl.es/web/jcyl/risp/es/salud/centros-salud-municipios/1285017220711.csv";
export const CASTILLA_LEON_HEALTH_MAP_SOURCE = "Junta de Castilla y León";

/**
 * Municipality names as the different sources spell them, made comparable:
 * "BAÑEZA (LA)", "Bañeza, La" and "La Bañeza" all become "la baneza".
 */
export function normaliseMunicipalityName(name: string): string {
  let text = normalizeCareText(name).replace(/ñ/g, "n").replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
  const bracketed = /^(.+?)\s*\((el|la|los|las|l'|o|a|os|as)\)$/.exec(text);
  if (bracketed) text = `${bracketed[2]} ${bracketed[1]}`;
  const trailing = /^(.+?),\s*(el|la|los|las|l'|o|a|os|as)$/.exec(text);
  if (trailing) text = `${trailing[2]} ${trailing[1]}`;
  return text.replace(/^l' /, "l'").trim();
}

// The CSV names a health management area ("G.A.S. ZAMORA"), not a province.
const CASTILLA_LEON_PROVINCES: Array<[RegExp, string]> = [
  [/avila/, "05"], [/burgos/, "09"], [/bierzo|leon/, "24"], [/palencia/, "34"], [/salamanca/, "37"],
  [/segovia/, "40"], [/soria/, "42"], [/valladolid/, "47"], [/zamora/, "49"],
];

export function castillaLeonProvinceCode(area: string): string | null {
  const text = normalizeCareText(area);
  return CASTILLA_LEON_PROVINCES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export interface HealthMapRow {
  municipalityCode: string;
  municipalityName: string;
  regionCode: string;
  zoneName: string;
  centreName: string;
}

/**
 * Reads the Castilla y León "centres by municipality" file (CC BY 4.0).
 * It names municipalities without codes, so each is matched by name to the
 * INE code the register uses in that province; unmatched names are reported,
 * never guessed.
 */
export function castillaLeonHealthMapRows(
  lines: readonly string[][],
  municipalities: ReadonlyMap<string, ReadonlyMap<string, string>>,
): { rows: HealthMapRow[]; unmatched: string[] } {
  const [header, ...data] = lines;
  const at = (label: string) => header?.findIndex((cell) => normalizeCareText(cell) === normalizeCareText(label)) ?? -1;
  const area = at("NOMBRE GERENCIA");
  const zone = at("NOMBRE ZONA");
  const centre = at("NOMBRE CENTRO SALUD");
  const municipality = at("MUNICIPIO");
  if ([area, zone, centre, municipality].some((index) => index < 0)) {
    throw new Error(`Castilla y León health map has an unexpected header: ${header?.join(" | ")}`);
  }
  const rows: HealthMapRow[] = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();
  for (const cells of data) {
    const province = castillaLeonProvinceCode(cells[area] ?? "");
    const name = cells[municipality] ?? "";
    const code = province ? municipalities.get(province)?.get(normaliseMunicipalityName(name)) : undefined;
    if (!code) {
      if (name) unmatched.push(`${cells[area]}: ${name}`);
      continue;
    }
    const row = { municipalityCode: code.slice(0, 5), municipalityName: name, regionCode: "07", zoneName: cells[zone] ?? "", centreName: cells[centre] ?? "" };
    const key = `${row.municipalityCode}|${row.zoneName}|${row.centreName}`;
    if (!row.zoneName || !row.centreName || seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return { rows, unmatched };
}
