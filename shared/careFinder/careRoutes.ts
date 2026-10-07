// Care Finder domain model: everyday needs, Spanish coverage, and the care
// routes a person can take. Everything here is product-design rationale for
// navigating the Spanish health system (SNS). It is not clinical triage and
// must never be presented as a diagnosis.

export const CARE_FINDER_LANGS = ["es", "en", "fr", "de"] as const;
export type CareFinderLang = typeof CARE_FINDER_LANGS[number];
export type Localized = Record<CareFinderLang, string>;

export function careFinderLang(language?: string | null): CareFinderLang {
  const code = (language ?? "").toLowerCase().slice(0, 2);
  return (CARE_FINDER_LANGS as readonly string[]).includes(code) ? code as CareFinderLang : "en";
}

export const CARE_FINDER_LOCALE: Record<CareFinderLang, string> = {
  es: "es-ES",
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
};

export function pick(lang: CareFinderLang, text: Localized): string {
  return text[lang];
}

export function normalizeCareText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`´]/g, "'")
    .replace(/ß/g, "ss")
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
    label: { en: "Pain or stiffness", es: "Dolor o rigidez", fr: "Douleur ou raideur", de: "Schmerzen oder Steifheit" },
    detail: { en: "Joints, back, muscles, walking", es: "Articulaciones, espalda, músculos, caminar", fr: "Articulations, dos, muscles, marche", de: "Gelenke, Rücken, Muskeln, Gehen" },
  },
  unwell: {
    label: { en: "Feeling unwell", es: "No me encuentro bien", fr: "Je ne me sens pas bien", de: "Ich fühle mich nicht wohl" },
    detail: { en: "A new symptom, dizziness, tiredness", es: "Un síntoma nuevo, mareo, cansancio", fr: "Un nouveau symptôme, des vertiges, de la fatigue", de: "Ein neues Symptom, Schwindel, Müdigkeit" },
  },
  eyes: {
    label: { en: "Eyesight", es: "La vista", fr: "La vue", de: "Das Sehen" },
    detail: { en: "Seeing less well, glasses, cataracts", es: "Ver peor, gafas, cataratas", fr: "Moins bien voir, lunettes, cataracte", de: "Schlechter sehen, Brille, grauer Star" },
  },
  hearing: {
    label: { en: "Hearing", es: "El oído", fr: "L'audition", de: "Das Hören" },
    detail: { en: "Hearing less, ringing, ear trouble", es: "Oír peor, pitidos, molestias", fr: "Moins bien entendre, sifflements, gêne à l'oreille", de: "Schlechter hören, Ohrgeräusche, Ohrenbeschwerden" },
  },
  memory: {
    label: { en: "Memory", es: "La memoria", fr: "La mémoire", de: "Das Gedächtnis" },
    detail: { en: "Forgetting more, feeling muddled", es: "Olvidar más, sentirse confuso", fr: "Oublier davantage, se sentir confus", de: "Mehr vergessen, sich durcheinander fühlen" },
  },
  mood: {
    label: { en: "Mood, worry or sleep", es: "Ánimo, nervios o sueño", fr: "Moral, inquiétude ou sommeil", de: "Stimmung, Sorgen oder Schlaf" },
    detail: { en: "Feeling low, anxious, sleeping badly", es: "Estar triste, nervioso, dormir mal", fr: "Se sentir triste, anxieux, mal dormir", de: "Niedergeschlagen, ängstlich, schlecht schlafen" },
  },
  teeth: {
    label: { en: "Teeth or dentures", es: "Dientes o dentadura", fr: "Dents ou dentier", de: "Zähne oder Zahnprothese" },
    detail: { en: "Tooth pain, gums, dentures", es: "Dolor de muelas, encías, dentadura", fr: "Mal aux dents, gencives, dentier", de: "Zahnschmerzen, Zahnfleisch, Prothese" },
  },
  checkup: {
    label: { en: "A check-up", es: "Una revisión", fr: "Un contrôle", de: "Eine Kontrolle" },
    detail: { en: "Ongoing condition, prescriptions, tests", es: "Enfermedad crónica, recetas, análisis", fr: "Maladie chronique, ordonnances, analyses", de: "Chronische Erkrankung, Rezepte, Untersuchungen" },
  },
  not_sure: {
    label: { en: "I'm not sure", es: "No estoy seguro", fr: "Je ne suis pas sûr", de: "Ich bin nicht sicher" },
    detail: { en: "We'll work it out together", es: "Lo vemos juntos", fr: "Nous verrons ensemble", de: "Wir finden es gemeinsam heraus" },
  },
  something_else: {
    label: { en: "Something else", es: "Otra cosa", fr: "Autre chose", de: "Etwas anderes" },
    detail: { en: "Tell us in your own words", es: "Cuéntenoslo con sus palabras", fr: "Dites-le avec vos mots", de: "Erzählen Sie es mit eigenen Worten" },
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
  joints: { label: { en: "Bones, joints or back", es: "Huesos, articulaciones o espalda", fr: "Os, articulations ou dos", de: "Knochen, Gelenke oder Rücken" }, need: "pain" },
  chest_breathing: { label: { en: "Chest or breathing", es: "Pecho o respiración", fr: "Poitrine ou respiration", de: "Brust oder Atmung" }, need: "unwell" },
  stomach: { label: { en: "Stomach or bowels", es: "Estómago o intestino", fr: "Estomac ou intestins", de: "Magen oder Darm" }, need: "unwell" },
  head_dizzy: { label: { en: "Head, dizziness or balance", es: "Cabeza, mareo o equilibrio", fr: "Tête, vertiges ou équilibre", de: "Kopf, Schwindel oder Gleichgewicht" }, need: "unwell" },
  skin: { label: { en: "Skin, a wound or a rash", es: "Piel, una herida o un sarpullido", fr: "Peau, une plaie ou une éruption", de: "Haut, eine Wunde oder ein Ausschlag" }, need: "unwell" },
  eyes: { label: { en: "Eyes", es: "Ojos", fr: "Yeux", de: "Augen" }, need: "eyes" },
  ears: { label: { en: "Ears or hearing", es: "Oídos", fr: "Oreilles ou audition", de: "Ohren oder Hören" }, need: "hearing" },
  mind: { label: { en: "Memory, mood or sleep", es: "Memoria, ánimo o sueño", fr: "Mémoire, moral ou sommeil", de: "Gedächtnis, Stimmung oder Schlaf" }, need: "mood" },
  tired: { label: { en: "Tired or weak all over", es: "Cansancio o debilidad general", fr: "Fatigue ou faiblesse générale", de: "Allgemein müde oder schwach" }, need: "unwell" },
  unsure: { label: { en: "Still not sure", es: "Sigo sin estar seguro", fr: "Toujours pas sûr", de: "Immer noch unsicher" }, need: "not_sure" },
};

const NEED_PATTERNS: Array<{ need: CareNeedId; pattern: RegExp }> = [
  { need: "teeth", pattern: /\b(dent|dents|dentier|gencive|gencives|zahn|zahne|zahnschmerzen|gebiss|zahnfleisch|diente|dientes|muela|muelas|dental|dentadura|encia|encias|tooth|teeth|toothache|denture|dentures|gum|gums)\b/ },
  { need: "eyes", pattern: /\b(vue|oeil|yeux|lunettes|cataracte|glaucome|vois|auge|augen|brille|sehen|sehe|sehkraft|vista|ojo|ojos|gafas|catarata|cataratas|glaucoma|veo|eye|eyes|eyesight|sight|vision|glasses|cataract|cataracts)\b/ },
  { need: "hearing", pattern: /\b(oreille|oreilles|entends|entendre|audition|sourd|sourde|acouphene|acouphenes|ohr|ohren|hore|horen|gehor|horgerat|schwerhorig|oido|oidos|oigo|oir|sordera|sordo|audifono|audifonos|zumbido|pitido|pitidos|hearing|ear|ears|deaf|tinnitus|hear)\b/ },
  { need: "memory", pattern: /\b(memoire|oublie|oublis|demence|gedachtnis|vergesse|vergesslich|demenz|memoria|olvido|olvida|olvidos|olvidadizo|demencia|alzheimer|memory|forget|forgetting|forgetful|dementia)\b/ },
  { need: "mood", pattern: /\b(tristesse|anxiete|anxieux|anxieuse|angoisse|deprime|deprimee|moral|sommeil|insomnie|inquiet|inquiete|solitude|traurig|angst|depressiv|schlafen|schlaf|schlaflos|sorgen|einsam|niedergeschlagen|triste|tristeza|ansiedad|ansioso|depresion|deprimido|animo|nervios|nervioso|insomnio|dormir|duermo|preocupado|soledad|sad|anxious|anxiety|depressed|depression|mood|sleep|sleeping|insomnia|worried|worry|lonely)\b/ },
  { need: "pain", pattern: /\b(genou|genoux|hanche|hanches|epaule|epaules|mal au dos|mal de dos|le dos|cou|articulation|arthrose|arthrite|sciatique|cheville|chevilles|pied|pieds|la main|les mains|ma main|poignet|raideur|knie|hufte|schulter|rucken|nacken|gelenk|gelenke|ischias|knochel|fuss|fusse|hande|handgelenk|muskel|muskeln|steif|rodilla|rodillas|cadera|caderas|hombro|hombros|espalda|cuello|articulacion|articulaciones|artrosis|artritis|lumbago|ciatica|tobillo|tobillos|pie|pies|mano|manos|muneca|musculo|musculos|knee|knees|hip|hips|shoulder|shoulders|back|neck|joint|joints|arthritis|stiff|stiffness|muscle|muscles|sciatica|ankle|ankles|foot|feet|hand|hands|wrist)\b/ },
  { need: "checkup", pattern: /\b(bilan|ordonnance|diabete|prise de sang|kontrolle|rezept|blutdruck|cholesterin|blutuntersuchung|vorsorge|revision|chequeo|analitica|analisis|receta|recetas|tension|diabetes|colesterol|checkup|check-up|prescription|prescriptions|blood pressure|blood test|cholesterol)\b/ },
  { need: "unwell", pattern: /\b(fievre|toux|vertige|vertiges|fatigue|fatiguee|estomac|nausee|nausees|vomi|diarrhee|peau|eruption|plaie|malaise|poitrine|respiration|fieber|husten|schwindel|mude|magen|ubelkeit|erbrechen|durchfall|haut|ausschlag|wunde|krank|brust|atmen|atemnot|fiebre|tos|mareo|mareos|mareado|cansado|cansada|cansancio|estomago|nauseas|vomito|vomitos|diarrea|piel|sarpullido|erupcion|herida|malestar|pecho|respirar|respiracion|fever|cough|dizzy|dizziness|tired|stomach|nausea|rash|wound|unwell|sick|ill|chest|breathing|breath)\b/ },
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
    label: { en: "Public health system", es: "Sanidad pública (Seguridad Social)", fr: "Système de santé public espagnol (Seguridad Social)", de: "Spanisches öffentliches Gesundheitssystem (Seguridad Social)" },
    detail: { en: "You have a health card (tarjeta sanitaria)", es: "Tiene tarjeta sanitaria", fr: "Vous avez une carte de santé (tarjeta sanitaria)", de: "Sie haben eine Gesundheitskarte (tarjeta sanitaria)" },
  },
  private: {
    label: { en: "Private health insurance", es: "Seguro médico privado", fr: "Assurance santé privée", de: "Private Krankenversicherung" },
    detail: { en: "For example Sanitas, Adeslas, DKV or Asisa, including MUFACE through an insurer", es: "Por ejemplo Sanitas, Adeslas, DKV o Asisa, también MUFACE con aseguradora", fr: "Par exemple Sanitas, Adeslas, DKV ou Asisa, y compris MUFACE via un assureur", de: "Zum Beispiel Sanitas, Adeslas, DKV oder Asisa, auch MUFACE über einen Versicherer" },
  },
  mixed: {
    label: { en: "Both public and private", es: "Pública y privada", fr: "Public et privé", de: "Öffentlich und privat" },
    detail: { en: "Health card plus private insurance", es: "Tarjeta sanitaria y seguro privado", fr: "Carte de santé et assurance privée", de: "Gesundheitskarte und private Versicherung" },
  },
  self_pay: {
    label: { en: "I'll pay myself", es: "Pagaré yo", fr: "Je paierai moi-même", de: "Ich zahle selbst" },
    detail: { en: "No insurance for this", es: "Sin seguro para esto", fr: "Pas d'assurance pour cela", de: "Keine Versicherung dafür" },
  },
  unknown: {
    label: { en: "I'm not sure", es: "No estoy seguro", fr: "Je ne suis pas sûr", de: "Ich bin nicht sicher" },
    detail: { en: "We'll start with options that work with the public system", es: "Empezamos por opciones de la sanidad pública", fr: "Nous commencerons par des options du système public", de: "Wir beginnen mit Möglichkeiten im öffentlichen System" },
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
  today: { label: { en: "Today", es: "Hoy", fr: "Aujourd'hui", de: "Heute" }, detail: { en: "It shouldn't wait", es: "No debería esperar", fr: "Cela ne devrait pas attendre", de: "Es sollte nicht warten" } },
  this_week: { label: { en: "This week", es: "Esta semana", fr: "Cette semaine", de: "Diese Woche" }, detail: { en: "Soon, but not today", es: "Pronto, pero no hoy", fr: "Bientôt, mais pas aujourd'hui", de: "Bald, aber nicht heute" } },
  few_weeks: { label: { en: "In the next few weeks", es: "En las próximas semanas", fr: "Dans les prochaines semaines", de: "In den nächsten Wochen" }, detail: { en: "There's no rush", es: "No hay prisa", fr: "Rien ne presse", de: "Es eilt nicht" } },
  not_sure: { label: { en: "I'm not sure", es: "No estoy seguro", fr: "Je ne suis pas sûr", de: "Ich bin nicht sicher" }, detail: { en: "We'll keep the usual timing", es: "Mantenemos los plazos normales", fr: "Nous gardons les délais habituels", de: "Wir bleiben bei den üblichen Fristen" } },
};

// ── Getting there ────────────────────────────────────────────────────────────

export const CARE_ACCESS_NEED_IDS = ["step_free", "home_visit", "transport", "companion", "english"] as const;
export type CareAccessNeedId = typeof CARE_ACCESS_NEED_IDS[number];

export const CARE_ACCESS_NEEDS: Record<CareAccessNeedId, { label: Localized; detail: Localized }> = {
  step_free: { label: { en: "No stairs", es: "Sin escaleras", fr: "Sans escaliers", de: "Ohne Treppen" }, detail: { en: "Step-free entrance or a lift", es: "Entrada sin escalones o ascensor", fr: "Entrée sans marches ou ascenseur", de: "Stufenloser Eingang oder Aufzug" } },
  home_visit: { label: { en: "A home visit", es: "Visita a domicilio", fr: "Une visite à domicile", de: "Ein Hausbesuch" }, detail: { en: "Someone comes to the house", es: "Que vengan a casa", fr: "Quelqu'un vient à la maison", de: "Jemand kommt nach Hause" } },
  transport: { label: { en: "Help getting there", es: "Ayuda para llegar", fr: "De l'aide pour y aller", de: "Hilfe, um hinzukommen" }, detail: { en: "We can arrange a ride afterwards", es: "Podemos organizar el transporte después", fr: "Nous pouvons organiser un trajet ensuite", de: "Wir können danach eine Fahrt organisieren" } },
  companion: { label: { en: "Someone will come with me", es: "Iré acompañado", fr: "Quelqu'un m'accompagnera", de: "Jemand begleitet mich" }, detail: { en: "We'll mention it when you call", es: "Lo mencionamos al llamar", fr: "Nous le mentionnerons lors de l'appel", de: "Wir erwähnen es beim Anruf" } },
  // Stored as "english" for saved-task compatibility; it means "staff who
  // speak my language" and is offered to anyone not using Spanish.
  english: { label: { en: "English-speaking staff", es: "Personal que hable inglés", fr: "Personnel parlant français", de: "Deutschsprachiges Personal" }, detail: { en: "We'll look for it and suggest you ask", es: "Lo buscamos y le sugerimos preguntarlo", fr: "Nous le recherchons et vous suggérons de le demander", de: "Wir suchen danach und empfehlen Ihnen nachzufragen" } },
};

export function inferCareAccessNeeds(text: string): CareAccessNeedId[] {
  const normalized = normalizeCareText(text);
  const needs: CareAccessNeedId[] = [];
  if (/\b(escalier|escaliers|fauteuil roulant|deambulateur|canne|du mal a marcher|difficile de marcher|treppe|treppen|rollstuhl|rollator|gehstock|kann kaum gehen|schwer zu gehen|escalera|escaleras|stairs|steps|silla de ruedas|wheelchair|andador|walker|baston|cane|cuesta andar|cuesta caminar|no puedo andar|hard to walk|difficult to walk|walking is hard|struggle to walk)\b/.test(normalized)) {
    needs.push("step_free");
  }
  if (/\b(ne peux pas sortir|ne sors plus|kann das haus nicht verlassen|komme nicht aus dem haus|no puedo salir de casa|no salgo de casa|housebound|can'?t leave (the )?(house|home)|cannot leave (the )?(house|home))\b/.test(normalized)) {
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
    label: { en: "Family doctor (GP)", es: "Médico de familia", fr: "Médecin de famille (généraliste)", de: "Hausarzt" },
    whatTheyDo: {
      en: "Your first stop for most health worries. They can examine you, arrange tests, and refer you to a specialist if needed.",
      es: "El primer paso para casi cualquier problema de salud. Le examina, pide pruebas y le deriva a un especialista si hace falta.",
      fr: "Le premier interlocuteur pour la plupart des problèmes de santé. Il vous examine, prescrit des examens et vous oriente vers un spécialiste si besoin.",
      de: "Die erste Anlaufstelle bei den meisten Gesundheitsfragen. Untersucht Sie, veranlasst Tests und überweist Sie bei Bedarf an Fachärzte.",
    },
    searchTerms: { public: ["centro de salud"], private: ["médico de familia consulta privada", "centro médico medicina general"], homeVisit: ["médico a domicilio"] },
  },
  same_day: {
    label: { en: "Same-day care", es: "Atención el mismo día", fr: "Soins le jour même", de: "Versorgung am selben Tag" },
    whatTheyDo: {
      en: "For problems that shouldn't wait but aren't an emergency. Health centres usually keep same-day appointments, and there is an urgent care service when they are closed.",
      es: "Para problemas que no deben esperar pero no son una emergencia. Los centros de salud suelen tener citas en el día y hay un servicio de urgencias cuando están cerrados.",
      fr: "Pour les problèmes qui ne doivent pas attendre mais ne sont pas une urgence vitale. Les centres de santé gardent généralement des rendez-vous le jour même, et un service d'urgences prend le relais quand ils sont fermés.",
      de: "Für Beschwerden, die nicht warten sollten, aber kein Notfall sind. Gesundheitszentren haben meist Termine am selben Tag, und wenn sie geschlossen sind, gibt es einen Bereitschaftsdienst.",
    },
    searchTerms: { public: ["centro de salud", "punto de atención continuada urgencias"], private: ["urgencias clínica privada", "centro médico urgencias"], homeVisit: ["médico a domicilio urgente"] },
  },
  physiotherapy: {
    label: { en: "Physiotherapist", es: "Fisioterapeuta", fr: "Kinésithérapeute", de: "Physiotherapeut" },
    whatTheyDo: {
      en: "Treats pain and stiffness in joints, back and muscles with exercises and hands-on treatment, to help you move more easily.",
      es: "Trata el dolor y la rigidez de articulaciones, espalda y músculos con ejercicios y tratamiento manual, para moverse con más facilidad.",
      fr: "Traite la douleur et la raideur des articulations, du dos et des muscles par des exercices et des soins manuels, pour bouger plus facilement.",
      de: "Behandelt Schmerzen und Steifheit in Gelenken, Rücken und Muskeln mit Übungen und manueller Therapie, damit Sie sich leichter bewegen.",
    },
    searchTerms: { private: ["fisioterapia", "clínica de fisioterapia"], homeVisit: ["fisioterapia a domicilio"] },
  },
  orthopaedics: {
    label: { en: "Bone and joint doctor", es: "Traumatólogo", fr: "Médecin des os et des articulations", de: "Arzt für Knochen und Gelenke" },
    whatTheyDo: {
      en: "A doctor for bones, joints and muscles (traumatólogo). They examine the joint, can order scans, and talk you through treatment.",
      es: "Médico de huesos, articulaciones y músculos. Examina la articulación, puede pedir pruebas de imagen y le explica el tratamiento.",
      fr: "Un médecin des os, des articulations et des muscles (traumatólogo). Il examine l'articulation, peut prescrire une imagerie et vous explique le traitement.",
      de: "Ein Arzt für Knochen, Gelenke und Muskeln (traumatólogo). Untersucht das Gelenk, kann Bildgebung veranlassen und erklärt die Behandlung.",
    },
    searchTerms: { private: ["traumatólogo", "clínica de traumatología"] },
  },
  optician: {
    label: { en: "Optician", es: "Óptica", fr: "Opticien", de: "Optiker" },
    whatTheyDo: {
      en: "Checks your eyesight, often free of charge, updates glasses, and tells you if you should see an eye doctor.",
      es: "Revisa la vista, a menudo sin coste, actualiza las gafas y le dice si conviene ver a un oftalmólogo.",
      fr: "Contrôle votre vue, souvent gratuitement, ajuste vos lunettes et vous dit s'il faut voir un ophtalmologiste.",
      de: "Prüft Ihre Sehkraft, oft kostenlos, passt die Brille an und sagt Ihnen, ob Sie zum Augenarzt sollten.",
    },
    searchTerms: { private: ["óptica revisión de la vista"] },
  },
  ophthalmology: {
    label: { en: "Eye doctor", es: "Oftalmólogo", fr: "Ophtalmologiste", de: "Augenarzt" },
    whatTheyDo: {
      en: "A doctor for eye health (oftalmólogo): cataracts, glaucoma and changes in your sight.",
      es: "Médico de los ojos: cataratas, glaucoma y cambios en la vista.",
      fr: "Un médecin des yeux (oftalmólogo) : cataracte, glaucome et changements de la vue.",
      de: "Ein Arzt für die Augengesundheit (oftalmólogo): grauer Star, grüner Star und Veränderungen der Sehkraft.",
    },
    searchTerms: { private: ["oftalmólogo", "clínica oftalmológica"] },
  },
  hearing_centre: {
    label: { en: "Hearing centre", es: "Centro auditivo", fr: "Centre auditif", de: "Hörakustiker" },
    whatTheyDo: {
      en: "Checks your hearing, often free of charge, and advises on hearing aids.",
      es: "Revisa la audición, a menudo sin coste, y asesora sobre audífonos.",
      fr: "Contrôle votre audition, souvent gratuitement, et conseille sur les appareils auditifs.",
      de: "Prüft Ihr Gehör, oft kostenlos, und berät zu Hörgeräten.",
    },
    searchTerms: { private: ["centro auditivo"], homeVisit: ["revisión auditiva a domicilio"] },
  },
  ent: {
    label: { en: "Ear, nose and throat doctor", es: "Otorrino", fr: "Médecin ORL", de: "HNO-Arzt" },
    whatTheyDo: {
      en: "A doctor for hearing loss, ear problems, and dizziness that comes from the ear (otorrino).",
      es: "Médico para la pérdida de audición, problemas de oído y mareos de origen en el oído.",
      fr: "Un médecin pour la perte d'audition, les problèmes d'oreille et les vertiges d'origine auditive (otorrino).",
      de: "Ein Arzt für Hörverlust, Ohrenprobleme und Schwindel, der vom Ohr ausgeht (otorrino).",
    },
    searchTerms: { private: ["otorrinolaringólogo"] },
  },
  neurology: {
    label: { en: "Brain and nerve doctor", es: "Neurólogo", fr: "Neurologue", de: "Neurologe" },
    whatTheyDo: {
      en: "A doctor who looks into memory changes and other brain and nerve concerns (neurólogo). Usually seen after your family doctor.",
      es: "Médico que estudia los cambios de memoria y otros problemas del cerebro y los nervios. Normalmente después del médico de familia.",
      fr: "Un médecin qui étudie les troubles de la mémoire et d'autres problèmes du cerveau et des nerfs (neurólogo). Généralement consulté après le médecin de famille.",
      de: "Ein Arzt, der Gedächtnisveränderungen und andere Probleme von Gehirn und Nerven untersucht (neurólogo). Meist nach dem Hausarzt.",
    },
    searchTerms: { private: ["neurólogo", "unidad de memoria"] },
  },
  psychology: {
    label: { en: "Psychologist", es: "Psicólogo", fr: "Psychologue", de: "Psychologe" },
    whatTheyDo: {
      en: "Someone to talk to about worry, low mood, grief or sleep, using talking therapy.",
      es: "Alguien con quien hablar de preocupaciones, tristeza, duelo o sueño, con terapia conversacional.",
      fr: "Quelqu'un à qui parler de vos inquiétudes, de votre moral, d'un deuil ou du sommeil, par la thérapie par la parole.",
      de: "Jemand zum Reden über Sorgen, Niedergeschlagenheit, Trauer oder Schlaf, mit Gesprächstherapie.",
    },
    searchTerms: { private: ["psicólogo", "gabinete de psicología"], homeVisit: ["psicólogo a domicilio"] },
  },
  dentist: {
    label: { en: "Dentist", es: "Dentista", fr: "Dentiste", de: "Zahnarzt" },
    whatTheyDo: {
      en: "For teeth, gums, mouth pain and dentures.",
      es: "Para dientes, encías, dolor de boca y dentaduras.",
      fr: "Pour les dents, les gencives, les douleurs de la bouche et les dentiers.",
      de: "Für Zähne, Zahnfleisch, Schmerzen im Mund und Zahnprothesen.",
    },
    searchTerms: { private: ["dentista", "clínica dental"] },
  },
  urgent_dentist: {
    label: { en: "Emergency dentist", es: "Dentista de urgencia", fr: "Dentiste d'urgence", de: "Zahnärztlicher Notdienst" },
    whatTheyDo: {
      en: "For bad tooth pain or swelling that can't wait.",
      es: "Para un dolor de muelas fuerte o una inflamación que no puede esperar.",
      fr: "Pour une forte douleur dentaire ou un gonflement qui ne peut pas attendre.",
      de: "Bei starken Zahnschmerzen oder einer Schwellung, die nicht warten kann.",
    },
    searchTerms: { private: ["dentista urgencias"] },
  },
};

const SPOKEN_LANGUAGE_ES: Record<CareFinderLang, string> = {
  es: "español",
  en: "inglés",
  fr: "francés",
  de: "alemán",
};

export function spokenLanguageInSpanish(lang: CareFinderLang): string {
  return SPOKEN_LANGUAGE_ES[lang];
}

export function careTypeSearchTerms(
  careType: CareTypeId,
  access: CareAccessRoute,
  accessNeeds: readonly CareAccessNeedId[] = [],
  lang: CareFinderLang = "en",
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
    terms.push(`${base[0]} habla ${spokenLanguageInSpanish(lang)}`);
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
    fr: "Avec votre carte de santé, vous allez au centre de santé où vous êtes inscrit. Si besoin, votre médecin vous oriente vers un spécialiste ou la kinésithérapie. Les orientations publiques sont gratuites, mais l'attente peut être longue.",
    de: "Mit Ihrer Gesundheitskarte gehen Sie zu dem Gesundheitszentrum, bei dem Sie angemeldet sind. Bei Bedarf überweist Ihr Arzt Sie an Fachärzte oder zur Physiotherapie. Öffentliche Überweisungen sind kostenlos, die Wartezeiten können aber lang sein.",
  },
  privateGp: {
    en: "A private family doctor can usually see you sooner. Check the price or whether your insurer covers it when you call.",
    es: "Un médico de familia privado suele atender antes. Pregunte el precio o si su seguro lo cubre al llamar.",
    fr: "Un médecin de famille privé peut généralement vous recevoir plus tôt. Demandez le prix ou si votre assurance le couvre lors de l'appel.",
    de: "Ein privater Hausarzt hat meist früher Zeit. Fragen Sie beim Anruf nach dem Preis oder ob Ihre Versicherung zahlt.",
  },
  privateDirect: {
    en: "You can book directly, without a referral. It is usually paid, or covered by private insurance. Ask about the price when you call.",
    es: "Puede pedir cita directamente, sin derivación. Normalmente es de pago o lo cubre un seguro privado. Pregunte el precio al llamar.",
    fr: "Vous pouvez prendre rendez-vous directement, sans orientation. C'est généralement payant ou couvert par une assurance privée. Demandez le prix lors de l'appel.",
    de: "Sie können direkt einen Termin vereinbaren, ohne Überweisung. Das ist meist kostenpflichtig oder wird von einer privaten Versicherung übernommen. Fragen Sie beim Anruf nach dem Preis.",
  },
  insurerDirect: {
    en: "With private insurance you can usually book directly. Check that they work with your insurer when you call.",
    es: "Con seguro privado normalmente puede pedir cita directamente. Confirme que trabajan con su aseguradora al llamar.",
    fr: "Avec une assurance privée, vous pouvez généralement prendre rendez-vous directement. Vérifiez lors de l'appel qu'ils travaillent avec votre assureur.",
    de: "Mit privater Versicherung können Sie meist direkt einen Termin vereinbaren. Fragen Sie beim Anruf, ob sie mit Ihrer Versicherung zusammenarbeiten.",
  },
  sameDayPublic: {
    en: "Ask your health centre for a same-day appointment. When it is closed, its urgent care service (urgencias de atención primaria) can help.",
    es: "Pida cita para hoy en su centro de salud. Cuando esté cerrado, puede acudir a urgencias de atención primaria.",
    fr: "Demandez un rendez-vous le jour même à votre centre de santé. Quand il est fermé, son service d'urgences (urgencias de atención primaria) peut vous aider.",
    de: "Fragen Sie in Ihrem Gesundheitszentrum nach einem Termin am selben Tag. Wenn es geschlossen ist, hilft der Bereitschaftsdienst (urgencias de atención primaria).",
  },
  sameDayPrivate: {
    en: "Private clinics with urgent care can usually see you today. Check whether your insurer covers it.",
    es: "Las clínicas privadas con urgencias suelen atender hoy. Confirme si su seguro lo cubre.",
    fr: "Les cliniques privées avec service d'urgences peuvent généralement vous recevoir aujourd'hui. Vérifiez si votre assurance le couvre.",
    de: "Private Kliniken mit Notaufnahme können Sie meist heute sehen. Fragen Sie, ob Ihre Versicherung zahlt.",
  },
  optician: {
    en: "Many opticians check your eyesight free of charge and tell you whether you need an eye doctor. No referral needed.",
    es: "Muchas ópticas revisan la vista sin coste y le dicen si necesita un oftalmólogo. No necesita derivación.",
    fr: "Beaucoup d'opticiens contrôlent la vue gratuitement et vous disent s'il faut voir un ophtalmologiste. Pas besoin d'orientation.",
    de: "Viele Optiker prüfen Ihre Sehkraft kostenlos und sagen Ihnen, ob Sie zum Augenarzt sollten. Keine Überweisung nötig.",
  },
  hearingCentre: {
    en: "Hearing centres usually offer a free hearing check. No referral needed. Hearing aids are paid.",
    es: "Los centros auditivos suelen ofrecer una revisión gratuita. No necesita derivación. Los audífonos son de pago.",
    fr: "Les centres auditifs proposent généralement un test auditif gratuit. Pas besoin d'orientation. Les appareils auditifs sont payants.",
    de: "Hörakustiker bieten meist einen kostenlosen Hörtest an. Keine Überweisung nötig. Hörgeräte sind kostenpflichtig.",
  },
  dentist: {
    en: "In most regions, public dental care covers extractions and urgent pain. Check-ups, fillings and dentures are usually private.",
    es: "En la mayoría de comunidades, la sanidad pública cubre extracciones y dolor urgente. Revisiones, empastes y dentaduras suelen ser privados.",
    fr: "Dans la plupart des régions, les soins dentaires publics couvrent les extractions et les douleurs urgentes. Contrôles, plombages et dentiers sont généralement privés.",
    de: "In den meisten Regionen deckt die öffentliche Zahnversorgung Zahnziehen und akute Schmerzen ab. Kontrollen, Füllungen und Prothesen sind meist privat.",
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
