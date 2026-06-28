export const HOME_SERVICE_INTAKE_VERSION = "home-service-intake-v1";

export type ServiceIntakeOrigin = "voice" | "app";
export type HomeServiceType = "plumber" | "electrician" | "locksmith" | "cleaner" | "handyman" | "other";
export type HomeServiceUrgency = "now" | "today" | "this_week" | "flexible" | "not_sure";

export interface HomeServiceIntake {
  version: typeof HOME_SERVICE_INTAKE_VERSION;
  origin: ServiceIntakeOrigin;
  service_type: HomeServiceType;
  urgency: HomeServiceUrgency;
  criteria: string[];
  answers: Record<string, string>;
  safety_flags: string[];
  research_brief: string;
}

export const HOME_SERVICE_TYPES: Array<{
  key: HomeServiceType;
  en: string;
  es: string;
  searchTerms: string[];
}> = [
  { key: "plumber", en: "Plumber", es: "Fontanero", searchTerms: ["plumber", "plumbing", "fontanero", "fontaneria"] },
  { key: "electrician", en: "Electrician", es: "Electricista", searchTerms: ["electrician", "electrical", "electricista"] },
  { key: "locksmith", en: "Locksmith", es: "Cerrajero", searchTerms: ["locksmith", "lock", "cerrajero", "cerradura"] },
  { key: "cleaner", en: "Cleaner", es: "Limpieza", searchTerms: ["cleaner", "cleaning", "limpieza", "limpiador"] },
  { key: "handyman", en: "Handyman / repair", es: "Manitas / reparacion", searchTerms: ["handyman", "repair", "maintenance", "reparacion", "mantenimiento"] },
  { key: "other", en: "Other service", es: "Otro servicio", searchTerms: ["home service", "servicio a domicilio"] },
];

export const HOME_SERVICE_COMMON_CRITERIA = [
  { key: "fastest", en: "Fastest help", es: "Mas rapido" },
  { key: "trusted", en: "Most trusted", es: "Mas fiable" },
  { key: "lowest_cost", en: "Lower cost", es: "Mejor precio" },
  { key: "highest_rated", en: "Highest rated", es: "Mejor valorado" },
  { key: "senior_safe", en: "Senior-safe", es: "Seguro para mayores" },
  { key: "not_sure", en: "Not sure", es: "No lo se" },
] as const;

export const HOME_SERVICE_URGENCY_OPTIONS: Array<{
  key: HomeServiceUrgency;
  en: string;
  es: string;
}> = [
  { key: "now", en: "Emergency now", es: "Urgente ahora" },
  { key: "today", en: "Today", es: "Hoy" },
  { key: "this_week", en: "This week", es: "Esta semana" },
  { key: "flexible", en: "Flexible", es: "Flexible" },
  { key: "not_sure", en: "Not sure", es: "No lo se" },
];

export type HomeServiceQuestionKind = "choice" | "text";

export interface HomeServiceQuestion {
  key: string;
  en: string;
  es: string;
  kind: HomeServiceQuestionKind;
  options?: Array<{ key: string; en: string; es: string }>;
  placeholderEn?: string;
  placeholderEs?: string;
}

const URGENCY_QUESTIONS: HomeServiceQuestion[] = [
  {
    key: "urgency",
    en: "How urgent is it?",
    es: "Que urgencia tiene?",
    kind: "choice",
    options: HOME_SERVICE_URGENCY_OPTIONS,
  },
];

const FINISHING_QUESTIONS: HomeServiceQuestion[] = [
  {
    key: "criteria",
    en: "What matters most?",
    es: "Que importa mas?",
    kind: "choice",
    options: HOME_SERVICE_COMMON_CRITERIA,
  },
];

const PLUMBER_QUESTIONS: HomeServiceQuestion[] = [
  {
    key: "problem_type",
    en: "What kind of plumbing issue?",
    es: "Que tipo de problema de fontaneria?",
    kind: "choice",
    options: [
      { key: "leak", en: "Leak", es: "Fuga" },
      { key: "blocked_drain", en: "Blocked drain/toilet", es: "Atasco" },
      { key: "no_hot_water", en: "No hot water", es: "Sin agua caliente" },
      { key: "no_water", en: "No water", es: "Sin agua" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "active_flooding",
    en: "Is water actively flooding or damaging anything?",
    es: "Hay agua saliendo o causando danos ahora?",
    kind: "choice",
    options: [
      { key: "yes", en: "Yes", es: "Si" },
      { key: "no", en: "No", es: "No" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "affected_area",
    en: "Where is the problem?",
    es: "Donde esta el problema?",
    kind: "choice",
    options: [
      { key: "kitchen", en: "Kitchen", es: "Cocina" },
      { key: "bathroom", en: "Bathroom", es: "Bano" },
      { key: "whole_home", en: "Whole home", es: "Toda la casa" },
      { key: "outside", en: "Outside", es: "Exterior" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "shutoff_status",
    en: "Can the water be turned off?",
    es: "Se puede cerrar el agua?",
    kind: "choice",
    options: [
      { key: "can_shut_off", en: "Yes, it is off", es: "Si, esta cerrada" },
      { key: "cannot_find", en: "Cannot find it", es: "No encuentro la llave" },
      { key: "not_needed", en: "Not needed", es: "No hace falta" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
];

const ELECTRICIAN_QUESTIONS: HomeServiceQuestion[] = [
  {
    key: "problem_type",
    en: "What kind of electrical issue?",
    es: "Que tipo de problema electrico?",
    kind: "choice",
    options: [
      { key: "power_outage", en: "Power outage", es: "Sin luz" },
      { key: "breaker_trips", en: "Breaker trips", es: "Salta el automatico" },
      { key: "sparks_smell", en: "Sparks or burning smell", es: "Chispas u olor a quemado" },
      { key: "socket_light", en: "Socket or light", es: "Enchufe o luz" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "scope",
    en: "How much of the home is affected?",
    es: "Cuanta casa esta afectada?",
    kind: "choice",
    options: [
      { key: "whole_home", en: "Whole home", es: "Toda la casa" },
      { key: "one_room", en: "One room", es: "Una habitacion" },
      { key: "one_fixture", en: "One socket/light", es: "Un enchufe/luz" },
      { key: "outside", en: "Outside", es: "Exterior" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "safety_risk",
    en: "Is anyone in immediate danger?",
    es: "Alguien esta en peligro inmediato?",
    kind: "choice",
    options: [
      { key: "danger_now", en: "Yes", es: "Si" },
      { key: "safe_for_now", en: "No", es: "No" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
  {
    key: "medical_device",
    en: "Does anyone rely on powered medical equipment?",
    es: "Alguien depende de equipo medico electrico?",
    kind: "choice",
    options: [
      { key: "yes", en: "Yes", es: "Si" },
      { key: "no", en: "No", es: "No" },
      { key: "not_sure", en: "Not sure", es: "No lo se" },
    ],
  },
];

const FALLBACK_QUESTIONS: HomeServiceQuestion[] = [
  {
    key: "service_needed",
    en: "What service do you need?",
    es: "Que servicio necesitas?",
    kind: "text",
    placeholderEn: "Example: gardener, pest control, appliance repair",
    placeholderEs: "Ejemplo: jardinero, control de plagas, reparar electrodomestico",
  },
];

function shouldAskPoweredMedicalEquipment(answers: Record<string, string>) {
  if (answers.medical_device) return true;
  return answers.problem_type === "power_outage" || answers.scope === "whole_home" || answers.urgency === "now";
}

export function homeServiceQuestionsFor(
  serviceType: HomeServiceType | string | null | undefined,
  currentAnswers?: Record<string, unknown>,
): HomeServiceQuestion[] {
  const type = normalizeHomeServiceType(serviceType);
  const answers = compactRecord(currentAnswers);
  const specific = type === "plumber"
    ? PLUMBER_QUESTIONS
    : type === "electrician"
      ? ELECTRICIAN_QUESTIONS.filter((question) => question.key !== "medical_device" || shouldAskPoweredMedicalEquipment(answers))
      : FALLBACK_QUESTIONS;
  return type === "other"
    ? [...specific, ...URGENCY_QUESTIONS, ...FINISHING_QUESTIONS]
    : [...URGENCY_QUESTIONS, ...specific, ...FINISHING_QUESTIONS];
}

export function normalizeHomeServiceType(value: unknown): HomeServiceType {
  if (typeof value !== "string") return "other";
  const text = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/(plumb|fontaner|fontaneria|water|leak|fuga|atasco|drain|toilet|sink)/.test(text)) return "plumber";
  if (/(electric|electricista|electrical|breaker|power|socket|enchufe|luz|chisp|quemad)/.test(text)) return "electrician";
  if (/(lock|cerraj|key|llave|cerradura)/.test(text)) return "locksmith";
  if (/(clean|limpiez|limpiador)/.test(text)) return "cleaner";
  if (/(handyman|repair|maintenance|manitas|repar|mantenim)/.test(text)) return "handyman";
  return "other";
}

export function normalizeHomeServiceUrgency(value: unknown): HomeServiceUrgency {
  if (typeof value !== "string") return "not_sure";
  const text = value.toLowerCase().replace(/[\s-]+/g, "_");
  if (/(emergency|urgent|now|asap|ahora|urgente)/.test(text)) return "now";
  if (/(today|hoy)/.test(text)) return "today";
  if (/(week|semana)/.test(text)) return "this_week";
  if (/(flexible|cuando|anytime)/.test(text)) return "flexible";
  return "not_sure";
}

export function homeServiceTypeLabel(type: HomeServiceType | string | null | undefined, language = "en") {
  const normalized = normalizeHomeServiceType(type);
  const entry = HOME_SERVICE_TYPES.find((item) => item.key === normalized) ?? HOME_SERVICE_TYPES[HOME_SERVICE_TYPES.length - 1];
  return language.startsWith("es") ? entry.es : entry.en;
}

function optionLabel(question: HomeServiceQuestion, value: string, language: string) {
  const option = question.options?.find((item) => item.key === value);
  if (!option) return value;
  return language.startsWith("es") ? option.es : option.en;
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactRecord(record: Record<string, unknown> | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  Object.entries(record ?? {}).forEach(([key, value]) => {
    const text = clean(value);
    if (text) result[key] = text.slice(0, 300);
  });
  return result;
}

function compactCriteria(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean).slice(0, 4);
  }
  const text = clean(value);
  if (!text) return [];
  return text.split(/[,|;]/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
}

export function homeServiceSearchTerms(type: HomeServiceType | string | null | undefined): string[] {
  const normalized = normalizeHomeServiceType(type);
  return HOME_SERVICE_TYPES.find((item) => item.key === normalized)?.searchTerms ?? [];
}

export function detectHomeServiceSafetyFlags(input: {
  serviceType?: HomeServiceType | string | null;
  urgency?: HomeServiceUrgency | string | null;
  answers?: Record<string, unknown>;
}): string[] {
  const flags = new Set<string>();
  const type = normalizeHomeServiceType(input.serviceType);
  const urgency = normalizeHomeServiceUrgency(input.urgency);
  const answers = compactRecord(input.answers);
  if (urgency === "now") flags.add("urgent");
  if (type === "plumber" && answers.active_flooding === "yes") flags.add("active_water_damage");
  if (type === "electrician" && answers.problem_type === "sparks_smell") flags.add("electrical_hazard");
  if (type === "electrician" && (answers.safety_risk === "hazard" || answers.safety_risk === "danger_now")) {
    flags.add("electrical_hazard");
    flags.add("immediate_danger");
  }
  if (type === "electrician" && answers.medical_device === "yes") flags.add("powered_medical_equipment");
  return Array.from(flags);
}

export function buildHomeServiceResearchBrief(input: {
  serviceType?: HomeServiceType | string | null;
  urgency?: HomeServiceUrgency | string | null;
  criteria?: unknown;
  answers?: Record<string, unknown>;
  language?: string | null;
}) {
  const language = input.language ?? "en";
  const type = normalizeHomeServiceType(input.serviceType);
  const urgency = normalizeHomeServiceUrgency(input.urgency);
  const answers = compactRecord(input.answers);
  const criteria = compactCriteria(input.criteria);
  const questions = homeServiceQuestionsFor(type, answers);
  const customServiceLabel = type === "other" && answers.service_needed && answers.service_needed !== "skip"
    ? answers.service_needed
    : "";
  const facts = questions
    .map((question) => {
      if (question.key === "criteria") return "";
      if (question.key === "service_needed" && customServiceLabel) return "";
      const value = question.key === "urgency" ? urgency : answers[question.key];
      if (!value) return "";
      const label = language.startsWith("es") ? question.es : question.en;
      return `${label}: ${optionLabel(question, value, language)}`;
    })
    .filter(Boolean);
  const criteriaQuestion = FINISHING_QUESTIONS.find((question) => question.key === "criteria");
  const criteriaText = criteria.length
    ? `Criteria: ${criteria.map((value) => criteriaQuestion ? optionLabel(criteriaQuestion, value, language) : value).join(", ")}`
    : "";
  const brief = [
    `${customServiceLabel || homeServiceTypeLabel(type, language)} needed`,
    ...facts,
    criteriaText,
  ].filter(Boolean).join(". ");
  return brief.slice(0, 900);
}

export function buildHomeServiceIntake(input: {
  origin?: unknown;
  serviceType?: unknown;
  urgency?: unknown;
  criteria?: unknown;
  answers?: Record<string, unknown>;
  language?: string | null;
}): HomeServiceIntake {
  const origin = input.origin === "voice" ? "voice" : "app";
  const serviceType = normalizeHomeServiceType(input.serviceType);
  const answers = compactRecord(input.answers);
  const urgency = normalizeHomeServiceUrgency(input.urgency ?? answers.urgency);
  if (urgency) answers.urgency = urgency;
  const criteria = compactCriteria(input.criteria ?? answers.criteria);
  const safetyFlags = detectHomeServiceSafetyFlags({ serviceType, urgency, answers });
  const researchBrief = buildHomeServiceResearchBrief({
    serviceType,
    urgency,
    criteria,
    answers,
    language: input.language,
  });
  return {
    version: HOME_SERVICE_INTAKE_VERSION,
    origin,
    service_type: serviceType,
    urgency,
    criteria,
    answers,
    safety_flags: safetyFlags,
    research_brief: researchBrief,
  };
}

export function homeServiceIntakeFromPreferences(preferences: unknown): HomeServiceIntake | null {
  if (!preferences || typeof preferences !== "object" || Array.isArray(preferences)) return null;
  const raw = (preferences as Record<string, unknown>).service_intake;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const intake = buildHomeServiceIntake({
    origin: record.origin,
    serviceType: record.service_type,
    urgency: record.urgency,
    criteria: record.criteria,
    answers: record.answers && typeof record.answers === "object" && !Array.isArray(record.answers)
      ? record.answers as Record<string, unknown>
      : {},
    language: "en",
  });
  const researchBrief = clean(record.research_brief);
  return researchBrief ? { ...intake, research_brief: researchBrief.slice(0, 900) } : intake;
}
