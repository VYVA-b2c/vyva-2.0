// Care Finder domain model: everyday needs, Spanish coverage, and the care
// routes a person can take. Everything here is product-design rationale for
// navigating the Spanish health system (SNS). It is not clinical triage and
// must never be presented as a diagnosis.

export type CareFinderLang = "es" | "en";
export type Localized = { es: string; en: string };

export function careFinderLang(language?: string | null): CareFinderLang {
  return (language ?? "").toLowerCase().startsWith("es") ? "es" : "en";
}

export function pick(lang: CareFinderLang, text: Localized): string {
  return text[lang];
}

export function normalizeCareText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Who ──────────────────────────────────────────────────────────────────────

export const CARE_FINDER_WHO = ["self", "other"] as const;
export type CareFinderWho = typeof CARE_FINDER_WHO[number];

// ── Everyday needs ───────────────────────────────────────────────────────────

export const CARE_NEED_IDS = [
  "pain",
  "unwell",
  "eyes",
  "hearing",
  "memory",
  "mood",
  "teeth",
  "checkup",
  "not_sure",
  "something_else",
] as const;
export type CareNeedId = typeof CARE_NEED_IDS[number];

export const CARE_NEEDS: Record<CareNeedId, { label: Localized; detail: Localized }> = {
  pain: {
    label: { en: "Pain or stiffness", es: "Dolor o rigidez" },
    detail: { en: "Joints, back, muscles, walking", es: "Articulaciones, espalda, músculos, caminar" },
  },
  unwell: {
    label: { en: "Feeling unwell", es: "No me encuentro bien" },
    detail: { en: "A new symptom, dizziness, tiredness", es: "Un síntoma nuevo, mareo, cansancio" },
  },
  eyes: {
    label: { en: "Eyesight", es: "La vista" },
    detail: { en: "Seeing less well, glasses, cataracts", es: "Ver peor, gafas, cataratas" },
  },
  hearing: {
    label: { en: "Hearing", es: "El oído" },
    detail: { en: "Hearing less, ringing, ear trouble", es: "Oír peor, pitidos, molestias" },
  },
  memory: {
    label: { en: "Memory", es: "La memoria" },
    detail: { en: "Forgetting more, feeling muddled", es: "Olvidar más, sentirse confuso" },
  },
  mood: {
    label: { en: "Mood, worry or sleep", es: "Ánimo, nervios o sueño" },
    detail: { en: "Feeling low, anxious, sleeping badly", es: "Estar triste, nervioso, dormir mal" },
  },
  teeth: {
    label: { en: "Teeth or dentures", es: "Dientes o dentadura" },
    detail: { en: "Tooth pain, gums, dentures", es: "Dolor de muelas, encías, dentadura" },
  },
  checkup: {
    label: { en: "A check-up", es: "Una revisión" },
    detail: { en: "Ongoing condition, prescriptions, tests", es: "Enfermedad crónica, recetas, análisis" },
  },
  not_sure: {
    label: { en: "I'm not sure", es: "No estoy seguro" },
    detail: { en: "We'll work it out together", es: "Lo vemos juntos" },
  },
  something_else: {
    label: { en: "Something else", es: "Otra cosa" },
    detail: { en: "Tell us in your own words", es: "Cuéntenoslo con sus palabras" },
  },
};

// "I'm not sure" asks where the problem is, in plain words, then maps to a need.
export const CARE_AREA_IDS = [
  "joints",
  "chest_breathing",
  "stomach",
  "head_dizzy",
  "skin",
  "eyes",
  "ears",
  "mind",
  "tired",
  "unsure",
] as const;
export type CareAreaId = typeof CARE_AREA_IDS[number];

export const CARE_AREAS: Record<CareAreaId, { label: Localized; need: CareNeedId }> = {
  joints: { label: { en: "Bones, joints or back", es: "Huesos, articulaciones o espalda" }, need: "pain" },
  chest_breathing: { label: { en: "Chest or breathing", es: "Pecho o respiración" }, need: "unwell" },
  stomach: { label: { en: "Stomach or bowels", es: "Estómago o intestino" }, need: "unwell" },
  head_dizzy: { label: { en: "Head, dizziness or balance", es: "Cabeza, mareo o equilibrio" }, need: "unwell" },
  skin: { label: { en: "Skin, a wound or a rash", es: "Piel, una herida o un sarpullido" }, need: "unwell" },
  eyes: { label: { en: "Eyes", es: "Ojos" }, need: "eyes" },
  ears: { label: { en: "Ears or hearing", es: "Oídos" }, need: "hearing" },
  mind: { label: { en: "Memory, mood or sleep", es: "Memoria, ánimo o sueño" }, need: "mood" },
  tired: { label: { en: "Tired or weak all over", es: "Cansancio o debilidad general" }, need: "unwell" },
  unsure: { label: { en: "Still not sure", es: "Sigo sin estar seguro" }, need: "not_sure" },
};

const NEED_PATTERNS: Array<{ need: CareNeedId; pattern: RegExp }> = [
  { need: "teeth", pattern: /\b(diente|dientes|muela|muelas|dental|dentadura|encia|encias|tooth|teeth|toothache|denture|dentures|gum|gums)\b/ },
  { need: "eyes", pattern: /\b(vista|ojo|ojos|gafas|catarata|cataratas|glaucoma|veo|eye|eyes|eyesight|sight|vision|glasses|cataract|cataracts)\b/ },
  { need: "hearing", pattern: /\b(oido|oidos|oigo|oir|sordera|sordo|audifono|audifonos|zumbido|pitido|pitidos|hearing|ear|ears|deaf|tinnitus|hear)\b/ },
  { need: "memory", pattern: /\b(memoria|olvido|olvida|olvidos|olvidadizo|demencia|alzheimer|memory|forget|forgetting|forgetful|dementia)\b/ },
  { need: "mood", pattern: /\b(triste|tristeza|ansiedad|ansioso|depresion|deprimido|animo|nervios|nervioso|insomnio|dormir|duermo|preocupado|soledad|sad|anxious|anxiety|depressed|depression|mood|sleep|sleeping|insomnia|worried|worry|lonely)\b/ },
  { need: "pain", pattern: /\b(rodilla|rodillas|cadera|caderas|hombro|hombros|espalda|cuello|articulacion|articulaciones|artrosis|artritis|lumbago|ciatica|tobillo|tobillos|pie|pies|mano|manos|muneca|musculo|musculos|knee|knees|hip|hips|shoulder|shoulders|back|neck|joint|joints|arthritis|stiff|stiffness|muscle|muscles|sciatica|ankle|ankles|foot|feet|hand|hands|wrist)\b/ },
  { need: "checkup", pattern: /\b(revision|chequeo|analitica|analisis|receta|recetas|tension|diabetes|colesterol|checkup|check-up|prescription|prescriptions|blood pressure|blood test|cholesterol)\b/ },
  { need: "unwell", pattern: /\b(fiebre|tos|mareo|mareos|mareado|cansado|cansada|cansancio|estomago|nauseas|vomito|vomitos|diarrea|piel|sarpullido|erupcion|herida|malestar|pecho|respirar|respiracion|fever|cough|dizzy|dizziness|tired|stomach|nausea|rash|wound|unwell|sick|ill|chest|breathing|breath)\b/ },
];

/** Best-effort mapping of a free-text description to an everyday need. */
export function classifyCareNeed(text: string): CareNeedId | null {
  const normalized = normalizeCareText(text);
  if (!normalized) return null;
  return NEED_PATTERNS.find((entry) => entry.pattern.test(normalized))?.need ?? null;
}

// ── Coverage (Spain) ─────────────────────────────────────────────────────────

// Values match the profile's coverage_type so saved answers can be reused.
export const CARE_COVERAGE_IDS = ["public", "private", "mixed", "self_pay", "unknown"] as const;
export type CareCoverageId = typeof CARE_COVERAGE_IDS[number];

export const CARE_COVERAGE: Record<CareCoverageId, { label: Localized; detail: Localized }> = {
  public: {
    label: { en: "Public health system", es: "Sanidad pública (Seguridad Social)" },
    detail: { en: "You have a health card (tarjeta sanitaria)", es: "Tiene tarjeta sanitaria" },
  },
  private: {
    label: { en: "Private health insurance", es: "Seguro médico privado" },
    detail: { en: "For example Sanitas, Adeslas, DKV or Asisa, including MUFACE through an insurer", es: "Por ejemplo Sanitas, Adeslas, DKV o Asisa, también MUFACE con aseguradora" },
  },
  mixed: {
    label: { en: "Both public and private", es: "Pública y privada" },
    detail: { en: "Health card plus private insurance", es: "Tarjeta sanitaria y seguro privado" },
  },
  self_pay: {
    label: { en: "I'll pay myself", es: "Pagaré yo" },
    detail: { en: "No insurance for this", es: "Sin seguro para esto" },
  },
  unknown: {
    label: { en: "I'm not sure", es: "No estoy seguro" },
    detail: { en: "We'll start with options that work with the public system", es: "Empezamos por opciones de la sanidad pública" },
  },
};

export function normalizeCareCoverage(value: string | null | undefined): CareCoverageId | null {
  const normalized = normalizeCareText(value ?? "").replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if ((CARE_COVERAGE_IDS as readonly string[]).includes(normalized)) return normalized as CareCoverageId;
  if (["not_sure", "unsure"].includes(normalized)) return "unknown";
  if (["selfpay", "self", "pay"].includes(normalized)) return "self_pay";
  return null;
}

function usesPublicFirst(coverage: CareCoverageId | null): boolean {
  return coverage === null || coverage === "public" || coverage === "mixed" || coverage === "unknown";
}

// ── How soon ─────────────────────────────────────────────────────────────────

export const CARE_URGENCY_IDS = ["today", "this_week", "few_weeks", "not_sure"] as const;
export type CareUrgencyId = typeof CARE_URGENCY_IDS[number];

export const CARE_URGENCY: Record<CareUrgencyId, { label: Localized; detail: Localized }> = {
  today: { label: { en: "Today", es: "Hoy" }, detail: { en: "It shouldn't wait", es: "No debería esperar" } },
  this_week: { label: { en: "This week", es: "Esta semana" }, detail: { en: "Soon, but not today", es: "Pronto, pero no hoy" } },
  few_weeks: { label: { en: "In the next few weeks", es: "En las próximas semanas" }, detail: { en: "There's no rush", es: "No hay prisa" } },
  not_sure: { label: { en: "I'm not sure", es: "No estoy seguro" }, detail: { en: "We'll keep the usual timing", es: "Mantenemos los plazos normales" } },
};

// ── Getting there ────────────────────────────────────────────────────────────

export const CARE_ACCESS_NEED_IDS = ["step_free", "home_visit", "transport", "companion", "english"] as const;
export type CareAccessNeedId = typeof CARE_ACCESS_NEED_IDS[number];

export const CARE_ACCESS_NEEDS: Record<CareAccessNeedId, { label: Localized; detail: Localized }> = {
  step_free: { label: { en: "No stairs", es: "Sin escaleras" }, detail: { en: "Step-free entrance or a lift", es: "Entrada sin escalones o ascensor" } },
  home_visit: { label: { en: "A home visit", es: "Visita a domicilio" }, detail: { en: "Someone comes to the house", es: "Que vengan a casa" } },
  transport: { label: { en: "Help getting there", es: "Ayuda para llegar" }, detail: { en: "We can arrange a ride afterwards", es: "Podemos organizar el transporte después" } },
  companion: { label: { en: "Someone will come with me", es: "Iré acompañado" }, detail: { en: "We'll mention it when you call", es: "Lo mencionamos al llamar" } },
  english: { label: { en: "English-speaking staff", es: "Personal que hable inglés" }, detail: { en: "We'll look for it and suggest you ask", es: "Lo buscamos y le sugerimos preguntarlo" } },
};

export function inferCareAccessNeeds(text: string): CareAccessNeedId[] {
  const normalized = normalizeCareText(text);
  const needs: CareAccessNeedId[] = [];
  if (/\b(escalera|escaleras|stairs|steps|silla de ruedas|wheelchair|andador|walker|baston|cane|cuesta andar|cuesta caminar|no puedo andar|hard to walk|difficult to walk|walking is hard|struggle to walk)\b/.test(normalized)) {
    needs.push("step_free");
  }
  if (/\b(no puedo salir de casa|no salgo de casa|housebound|can'?t leave (the )?(house|home)|cannot leave (the )?(house|home))\b/.test(normalized)) {
    needs.push("home_visit");
  }
  return needs;
}

// ── Care types ───────────────────────────────────────────────────────────────

export const CARE_TYPE_IDS = [
  "primary_care",
  "same_day",
  "physiotherapy",
  "orthopaedics",
  "optician",
  "ophthalmology",
  "hearing_centre",
  "ent",
  "neurology",
  "psychology",
  "dentist",
  "urgent_dentist",
] as const;
export type CareTypeId = typeof CARE_TYPE_IDS[number];
export type CareAccessRoute = "public" | "private";

export interface CareTypeDefinition {
  label: Localized;
  whatTheyDo: Localized;
  // Google Places text-search terms for Spain, by access route.
  searchTerms: { public?: string[]; private: string[]; homeVisit?: string[] };
}

export const CARE_TYPES: Record<CareTypeId, CareTypeDefinition> = {
  primary_care: {
    label: { en: "Family doctor (GP)", es: "Médico de familia" },
    whatTheyDo: {
      en: "Your first stop for most health worries. They can examine you, arrange tests, and refer you to a specialist if needed.",
      es: "El primer paso para casi cualquier problema de salud. Le examina, pide pruebas y le deriva a un especialista si hace falta.",
    },
    searchTerms: { public: ["centro de salud"], private: ["médico de familia consulta privada", "centro médico medicina general"], homeVisit: ["médico a domicilio"] },
  },
  same_day: {
    label: { en: "Same-day care", es: "Atención el mismo día" },
    whatTheyDo: {
      en: "For problems that shouldn't wait but aren't an emergency. Health centres usually keep same-day appointments, and there is an urgent care service when they are closed.",
      es: "Para problemas que no deben esperar pero no son una emergencia. Los centros de salud suelen tener citas en el día y hay un servicio de urgencias cuando están cerrados.",
    },
    searchTerms: { public: ["centro de salud", "punto de atención continuada urgencias"], private: ["urgencias clínica privada", "centro médico urgencias"], homeVisit: ["médico a domicilio urgente"] },
  },
  physiotherapy: {
    label: { en: "Physiotherapist", es: "Fisioterapeuta" },
    whatTheyDo: {
      en: "Treats pain and stiffness in joints, back and muscles with exercises and hands-on treatment, to help you move more easily.",
      es: "Trata el dolor y la rigidez de articulaciones, espalda y músculos con ejercicios y tratamiento manual, para moverse con más facilidad.",
    },
    searchTerms: { private: ["fisioterapia", "clínica de fisioterapia"], homeVisit: ["fisioterapia a domicilio"] },
  },
  orthopaedics: {
    label: { en: "Bone and joint doctor", es: "Traumatólogo" },
    whatTheyDo: {
      en: "A doctor for bones, joints and muscles (traumatólogo). They examine the joint, can order scans, and talk you through treatment.",
      es: "Médico de huesos, articulaciones y músculos. Examina la articulación, puede pedir pruebas de imagen y le explica el tratamiento.",
    },
    searchTerms: { private: ["traumatólogo", "clínica de traumatología"] },
  },
  optician: {
    label: { en: "Optician", es: "Óptica" },
    whatTheyDo: {
      en: "Checks your eyesight, often free of charge, updates glasses, and tells you if you should see an eye doctor.",
      es: "Revisa la vista, a menudo sin coste, actualiza las gafas y le dice si conviene ver a un oftalmólogo.",
    },
    searchTerms: { private: ["óptica revisión de la vista"] },
  },
  ophthalmology: {
    label: { en: "Eye doctor", es: "Oftalmólogo" },
    whatTheyDo: {
      en: "A doctor for eye health (oftalmólogo): cataracts, glaucoma and changes in your sight.",
      es: "Médico de los ojos: cataratas, glaucoma y cambios en la vista.",
    },
    searchTerms: { private: ["oftalmólogo", "clínica oftalmológica"] },
  },
  hearing_centre: {
    label: { en: "Hearing centre", es: "Centro auditivo" },
    whatTheyDo: {
      en: "Checks your hearing, often free of charge, and advises on hearing aids.",
      es: "Revisa la audición, a menudo sin coste, y asesora sobre audífonos.",
    },
    searchTerms: { private: ["centro auditivo"], homeVisit: ["revisión auditiva a domicilio"] },
  },
  ent: {
    label: { en: "Ear, nose and throat doctor", es: "Otorrino" },
    whatTheyDo: {
      en: "A doctor for hearing loss, ear problems, and dizziness that comes from the ear (otorrino).",
      es: "Médico para la pérdida de audición, problemas de oído y mareos de origen en el oído.",
    },
    searchTerms: { private: ["otorrinolaringólogo"] },
  },
  neurology: {
    label: { en: "Brain and nerve doctor", es: "Neurólogo" },
    whatTheyDo: {
      en: "A doctor who looks into memory changes and other brain and nerve concerns (neurólogo). Usually seen after your family doctor.",
      es: "Médico que estudia los cambios de memoria y otros problemas del cerebro y los nervios. Normalmente después del médico de familia.",
    },
    searchTerms: { private: ["neurólogo", "unidad de memoria"] },
  },
  psychology: {
    label: { en: "Psychologist", es: "Psicólogo" },
    whatTheyDo: {
      en: "Someone to talk to about worry, low mood, grief or sleep, using talking therapy.",
      es: "Alguien con quien hablar de preocupaciones, tristeza, duelo o sueño, con terapia conversacional.",
    },
    searchTerms: { private: ["psicólogo", "gabinete de psicología"], homeVisit: ["psicólogo a domicilio"] },
  },
  dentist: {
    label: { en: "Dentist", es: "Dentista" },
    whatTheyDo: {
      en: "For teeth, gums, mouth pain and dentures.",
      es: "Para dientes, encías, dolor de boca y dentaduras.",
    },
    searchTerms: { private: ["dentista", "clínica dental"] },
  },
  urgent_dentist: {
    label: { en: "Emergency dentist", es: "Dentista de urgencia" },
    whatTheyDo: {
      en: "For bad tooth pain or swelling that can't wait.",
      es: "Para un dolor de muelas fuerte o una inflamación que no puede esperar.",
    },
    searchTerms: { private: ["dentista urgencias"] },
  },
};

export function careTypeSearchTerms(
  careType: CareTypeId,
  access: CareAccessRoute,
  accessNeeds: readonly CareAccessNeedId[] = [],
): string[] {
  const definition = CARE_TYPES[careType];
  const base = access === "public" && definition.searchTerms.public?.length
    ? definition.searchTerms.public
    : definition.searchTerms.private;
  const terms = [...base];
  if (accessNeeds.includes("home_visit") && definition.searchTerms.homeVisit?.length) {
    terms.unshift(...definition.searchTerms.homeVisit);
  }
  if (accessNeeds.includes("english")) {
    terms.push(`${base[0]} English speaking`);
  }
  return Array.from(new Set(terms)).slice(0, 3);
}

// ── Care routes ──────────────────────────────────────────────────────────────

export interface CareRouteOption {
  careType: CareTypeId;
  access: CareAccessRoute;
  suggested: boolean;
  howItWorks: Localized;
}

const HOW = {
  publicGp: {
    en: "With your health card you go to the health centre you're registered with. If needed, your doctor refers you to a specialist or physiotherapy. Public referrals are free, though waits can be long.",
    es: "Con su tarjeta sanitaria acude a su centro de salud. Si hace falta, su médico le deriva al especialista o a fisioterapia. Las derivaciones públicas son gratuitas, aunque la espera puede ser larga.",
  },
  privateGp: {
    en: "A private family doctor can usually see you sooner. Check the price or whether your insurer covers it when you call.",
    es: "Un médico de familia privado suele atender antes. Pregunte el precio o si su seguro lo cubre al llamar.",
  },
  privateDirect: {
    en: "You can book directly, without a referral. It is usually paid, or covered by private insurance. Ask about the price when you call.",
    es: "Puede pedir cita directamente, sin derivación. Normalmente es de pago o lo cubre un seguro privado. Pregunte el precio al llamar.",
  },
  insurerDirect: {
    en: "With private insurance you can usually book directly. Check that they work with your insurer when you call.",
    es: "Con seguro privado normalmente puede pedir cita directamente. Confirme que trabajan con su aseguradora al llamar.",
  },
  sameDayPublic: {
    en: "Ask your health centre for a same-day appointment. When it is closed, its urgent care service (urgencias de atención primaria) can help.",
    es: "Pida cita para hoy en su centro de salud. Cuando esté cerrado, puede acudir a urgencias de atención primaria.",
  },
  sameDayPrivate: {
    en: "Private clinics with urgent care can usually see you today. Check whether your insurer covers it.",
    es: "Las clínicas privadas con urgencias suelen atender hoy. Confirme si su seguro lo cubre.",
  },
  optician: {
    en: "Many opticians check your eyesight free of charge and tell you whether you need an eye doctor. No referral needed.",
    es: "Muchas ópticas revisan la vista sin coste y le dicen si necesita un oftalmólogo. No necesita derivación.",
  },
  hearingCentre: {
    en: "Hearing centres usually offer a free hearing check. No referral needed. Hearing aids are paid.",
    es: "Los centros auditivos suelen ofrecer una revisión gratuita. No necesita derivación. Los audífonos son de pago.",
  },
  dentist: {
    en: "In most regions, public dental care covers extractions and urgent pain. Check-ups, fillings and dentures are usually private.",
    es: "En la mayoría de comunidades, la sanidad pública cubre extracciones y dolor urgente. Revisiones, empastes y dentaduras suelen ser privados.",
  },
} satisfies Record<string, Localized>;

function route(careType: CareTypeId, access: CareAccessRoute, howItWorks: Localized): Omit<CareRouteOption, "suggested"> {
  return { careType, access, howItWorks };
}

function withSuggestion(options: Array<Omit<CareRouteOption, "suggested">>): CareRouteOption[] {
  const seen = new Set<string>();
  return options
    .filter((option) => {
      const key = `${option.careType}:${option.access}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((option, index) => ({ ...option, suggested: index === 0 }));
}

/**
 * The care routes worth offering for a need. The first one is the suggested
 * starting point; the rest are genuine alternatives. Product-design rationale:
 * in the SNS a family doctor is the gateway to publicly funded specialists,
 * while private routes allow direct access.
 */
export function careRouteOptions(params: {
  need: CareNeedId | null;
  coverage: CareCoverageId | null;
  urgency: CareUrgencyId | null;
}): CareRouteOption[] {
  const need = params.need ?? "not_sure";
  const publicFirst = usesPublicFirst(params.coverage);
  const gpAccess: CareAccessRoute = publicFirst ? "public" : "private";
  const gp = route("primary_care", gpAccess, publicFirst ? HOW.publicGp : HOW.privateGp);
  const direct = params.coverage === "private" || params.coverage === "mixed" ? HOW.insurerDirect : HOW.privateDirect;
  const options: Array<Omit<CareRouteOption, "suggested">> = [];

  if (params.urgency === "today") {
    if (need === "teeth") {
      options.push(route("urgent_dentist", "private", HOW.dentist));
    } else if (need !== "checkup") {
      options.push(route("same_day", gpAccess, publicFirst ? HOW.sameDayPublic : HOW.sameDayPrivate));
    }
  }

  switch (need) {
    case "pain":
      if (publicFirst) {
        options.push(gp, route("physiotherapy", "private", direct), route("orthopaedics", "private", direct));
      } else {
        options.push(route("orthopaedics", "private", direct), route("physiotherapy", "private", direct), gp);
      }
      break;
    case "eyes":
      if (publicFirst) {
        options.push(route("optician", "private", HOW.optician), gp, route("ophthalmology", "private", direct));
      } else {
        options.push(route("ophthalmology", "private", direct), route("optician", "private", HOW.optician));
      }
      break;
    case "hearing":
      if (publicFirst) {
        options.push(gp, route("hearing_centre", "private", HOW.hearingCentre));
      } else {
        options.push(route("ent", "private", direct), route("hearing_centre", "private", HOW.hearingCentre));
      }
      break;
    case "memory":
      options.push(gp, route("neurology", "private", direct));
      break;
    case "mood":
      if (publicFirst) {
        options.push(gp, route("psychology", "private", direct));
      } else {
        options.push(route("psychology", "private", direct), gp);
      }
      break;
    case "teeth":
      options.push(route("dentist", "private", HOW.dentist));
      break;
    default:
      options.push(gp);
      if (params.coverage === "mixed") options.push(route("primary_care", "private", HOW.privateGp));
      break;
  }

  return withSuggestion(options);
}

export function isCareTypeId(value: unknown): value is CareTypeId {
  return typeof value === "string" && (CARE_TYPE_IDS as readonly string[]).includes(value);
}

export function isCareNeedId(value: unknown): value is CareNeedId {
  return typeof value === "string" && (CARE_NEED_IDS as readonly string[]).includes(value);
}
