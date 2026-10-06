// Urgent warning signs for the Care Finder. Deliberately simple and
// over-inclusive: a false alarm costs one tap ("It's not happening now"),
// a missed one can cost a life. This screens for emergencies only; it is
// not triage and never suggests a diagnosis.

import { normalizeCareText, type CareNeedId, type Localized } from "./careRoutes.js";

export const CARE_RED_FLAG_IDS = [
  "chest",
  "breathing",
  "stroke",
  "fall_head",
  "confusion",
  "bleeding",
  "allergic",
  "severe_headache",
  "sudden_vision",
  "self_harm",
] as const;
export type CareRedFlagId = typeof CARE_RED_FLAG_IDS[number];

export type CareEmergencyLine = "112" | "024";

export interface CareRedFlagDefinition {
  label: Localized;
  lines: CareEmergencyLine[];
}

export const CARE_RED_FLAGS: Record<CareRedFlagId, CareRedFlagDefinition> = {
  chest: { label: { en: "Chest pain, pressure or tightness", es: "Dolor, presión u opresión en el pecho" }, lines: ["112"] },
  breathing: { label: { en: "Struggling to breathe", es: "Dificultad para respirar" }, lines: ["112"] },
  stroke: { label: { en: "Face drooping, slurred speech, or weakness on one side", es: "Cara caída, habla rara o debilidad en un lado del cuerpo" }, lines: ["112"] },
  fall_head: { label: { en: "A fall with a knock to the head, or can't get up", es: "Una caída con golpe en la cabeza, o no poder levantarse" }, lines: ["112"] },
  confusion: { label: { en: "Sudden confusion, or very hard to wake", es: "Confusión repentina, o le cuesta mucho despertar" }, lines: ["112"] },
  bleeding: { label: { en: "Heavy bleeding, or vomiting or coughing blood", es: "Sangrado abundante, o vomitar o toser sangre" }, lines: ["112"] },
  allergic: { label: { en: "Swelling of the face, lips, tongue or throat", es: "Hinchazón de cara, labios, lengua o garganta" }, lines: ["112"] },
  severe_headache: { label: { en: "A sudden, very severe headache", es: "Un dolor de cabeza repentino y muy fuerte" }, lines: ["112"] },
  sudden_vision: { label: { en: "Suddenly losing sight, or seeing a curtain or flashes", es: "Perder vista de repente, o ver una cortina o destellos" }, lines: ["112"] },
  self_harm: { label: { en: "Thoughts of ending your life", es: "Pensamientos de quitarse la vida" }, lines: ["024", "112"] },
};

export const CARE_EMERGENCY_LINES: Record<CareEmergencyLine, { label: Localized; detail: Localized }> = {
  "112": {
    label: { en: "Call 112", es: "Llamar al 112" },
    detail: { en: "Emergency services. Free from any phone, 24 hours.", es: "Emergencias. Gratis desde cualquier teléfono, 24 horas." },
  },
  "024": {
    label: { en: "Call 024", es: "Llamar al 024" },
    detail: { en: "Suicide prevention line. Free, confidential, 24 hours.", es: "Línea de atención a la conducta suicida. Gratuita, confidencial, 24 horas." },
  },
};

const CORE_CHECKLIST: CareRedFlagId[] = ["chest", "breathing", "stroke", "fall_head", "confusion"];

const NEED_EXTRAS: Partial<Record<CareNeedId, CareRedFlagId[]>> = {
  unwell: ["bleeding", "severe_headache"],
  not_sure: ["bleeding", "severe_headache"],
  something_else: ["bleeding", "severe_headache"],
  eyes: ["sudden_vision"],
  mood: ["self_harm"],
};

/** Needs where a quick "is this happening now?" check is worth one tap. */
export function careSafetyCheckRequired(need: CareNeedId | null): boolean {
  return need !== null && need !== "checkup" && need !== "teeth";
}

export function careSafetyChecklist(need: CareNeedId | null): CareRedFlagId[] {
  if (!careSafetyCheckRequired(need)) return [];
  return [...CORE_CHECKLIST, ...(need ? NEED_EXTRAS[need] ?? [] : [])];
}

export function careEmergencyLines(flags: readonly CareRedFlagId[]): CareEmergencyLine[] {
  const lines = new Set<CareEmergencyLine>();
  flags.forEach((flag) => CARE_RED_FLAGS[flag].lines.forEach((line) => lines.add(line)));
  // 024 first when present: it is the specific help for that situation.
  return (["024", "112"] as const).filter((line) => lines.has(line));
}

const FREE_TEXT_PATTERNS: Array<{ flag: CareRedFlagId; pattern: RegExp }> = [
  { flag: "chest", pattern: /\b(dolor|presion|opresion|pinchazo)( fuerte)? (en el|de|del) pecho\b|\bme duele (mucho )?el pecho\b|\bchest (pain|pressure|tightness|hurts)\b|\bpain in (my|the|his|her|their) chest\b|\b(my|his|her|their) chest (hurts|is tight)\b|\bheart attack\b|\binfarto\b/ },
  { flag: "breathing", pattern: /\bno puedo respirar\b|\bno puede respirar\b|\bme ahogo\b|\bse ahoga\b|\bahogando\b|\bme falta (el )?aire\b|\b(me|le|nos) cuesta (mucho )?respirar\b|\b(trouble|difficulty) breathing\b|\bfalta de aire\b|\bcan'?t breathe\b|\bcannot breathe\b|\bstruggling to breathe\b|\bshort of breath\b|\bout of breath\b|\bbreathless\b/ },
  { flag: "stroke", pattern: /\bcara (torcida|caida)\b|\bboca torcida\b|\bhabla (rara|mal|torpe)\b|\bno puedo hablar\b|\bno puede hablar\b|\barrastra las palabras\b|\bun lado del cuerpo\b|\bparalis\w*\b|\bictus\b|\bderrame cerebral\b|\bface (is )?(droop|drooping|dropped)\b|\bslurred\b|\bslurring\b|\bstroke\b|\bone side of (my|his|her|their|the) (body|face)\b|\bcan'?t move (my|his|her|their) (arm|leg)\b/ },
  { flag: "fall_head", pattern: /\bgolpe (en|de) la cabeza\b|\bme he dado en la cabeza\b|\bno (me )?puedo levantar\b|\bno se puede levantar\b|\bhit (my|his|her|their) head\b|\bbanged (my|his|her|their) head\b|\bcan'?t get up\b|\bcannot get up\b/ },
  { flag: "confusion", pattern: /\bconfusion (repentina|subita)\b|\bde repente (esta |estoy )?(muy )?confus\w*\b|\bno (me |le )?reconoce\b|\bno despierta\b|\bsuddenly confused\b|\bsudden confusion\b|\bhard to wake\b|\bwon'?t wake\b/ },
  { flag: "bleeding", pattern: /\bsangr\w* (mucho|sin parar|que no para)\b|\bno (me )?para de sangrar\b|\bvomit\w* sangre\b|\btos con sangre\b|\btoso sangre\b|\bbleeding (heavily|a lot|badly)\b|\bwon'?t stop bleeding\b|\bvomit\w* blood\b|\bcough\w* (up )?blood\b/ },
  { flag: "allergic", pattern: /\bhinchazon (de|en) (la )?(cara|labios?|lengua|garganta)\b|\bse me hincha (la )?(cara|lengua|garganta|labios?)\b|\b(face|lips?|tongue|throat) (is )?(swelling|swollen)\b|\bswollen (face|lips?|tongue|throat)\b/ },
  { flag: "severe_headache", pattern: /\bpeor dolor de cabeza\b|\bdolor de cabeza (muy )?(fuerte|brutal|terrible) (y )?(repentino|de repente)\b|\bdolor de cabeza repentino\b|\bworst headache\b|\bsudden (and )?(severe|terrible) headache\b|\bthunderclap headache\b/ },
  { flag: "sudden_vision", pattern: /\bde repente no veo\b|\bperdido la vista de repente\b|\bperdi la vista\b|\bveo una cortina\b|\bsudden(ly)? (lost|losing|loss of) (my )?(sight|vision)\b|\bcurtain (over|across) (my )?(eye|vision)\b/ },
  { flag: "self_harm", pattern: /\bsuicid\w*\b|\bquitarme la vida\b|\bno quiero vivir\b|\bacabar con (mi vida|todo)\b|\bquiero morir\w*\b|\bkill (myself|himself|herself|themselves)\b|\bend (my|his|her|their) life\b|\bdon'?t want to (live|be here)\b|\bwant to die\b/ },
];

const NEGATION_BEFORE = /\b(no tengo|no tiene|sin|nada de|ni|not|no|without|never|nunca|don'?t have|doesn'?t have|do not have|does not have|no longer)\s+(\w+\s+){0,1}$/;

/**
 * Finds warning signs mentioned in free text (Spanish or English). Simple
 * negations directly before the phrase ("no tengo dolor en el pecho") are
 * ignored; anything else errs on the side of asking.
 */
export function detectCareRedFlags(text: string): CareRedFlagId[] {
  const normalized = normalizeCareText(text);
  if (!normalized) return [];
  const found: CareRedFlagId[] = [];
  for (const { flag, pattern } of FREE_TEXT_PATTERNS) {
    const global = new RegExp(pattern.source, "g");
    let match: RegExpExecArray | null;
    while ((match = global.exec(normalized)) !== null) {
      const before = normalized.slice(Math.max(0, match.index - 24), match.index);
      // Patterns that themselves start with a negation ("no puedo respirar")
      // must not be cancelled by it.
      const startsNegated = /^(no|can'?t|cannot|won'?t|don'?t)\b/.test(match[0]);
      if (startsNegated || !NEGATION_BEFORE.test(before)) {
        found.push(flag);
        break;
      }
      if (match[0].length === 0) global.lastIndex += 1;
    }
  }
  return found;
}

export function isCareRedFlagId(value: unknown): value is CareRedFlagId {
  return typeof value === "string" && (CARE_RED_FLAG_IDS as readonly string[]).includes(value);
}
