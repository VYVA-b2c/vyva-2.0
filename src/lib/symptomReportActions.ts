export type SymptomRecommendationActionKind =
  | "call_emergency"
  | "call_gp"
  | "email_gp"
  | "doctor_help"
  | "book_ride"
  | "schedule_appointment"
  | "online_order"
  | "request_quote";

export type SymptomRecommendationActionAvailability = {
  hasEmergencyContact?: boolean;
  hasGpPhone?: boolean;
  hasGpEmail?: boolean;
};

const EMERGENCY_PATTERNS = [
  /\b(emergency|emergencies|emergency services|call 112|call 911|call 999|call 000|do not wait|urgent help now)\b/,
  /\b(emergencia|emergencias|llama a emergencias|llamar a emergencias|urgencia vital|no esperes)\b/,
  /\b(urgence|urgences|appelez les urgences|n'attendez pas)\b/,
  /\b(notfall|notdienst|notruf|rufen sie den notdienst|warten sie nicht)\b/,
  /\b(emergenza|emergenze|chiama i servizi di emergenza|non aspettare)\b/,
  /\b(emergencia|emergencias|ligue para os servicos de emergencia|nao espere)\b/,
];

const DOCTOR_PATTERNS = [
  /\b(contact|call|phone|email|speak|talk|doctor|gp|physician|clinician|primary care|general practitioner)\b/,
  /\b(medico|medica|doctor|doctora|cabecera|medecin|arzt|hausarzt|dottore|dottoressa)\b/,
  /\b(llamar|contactar|hablar|appeler|contacter|parler|rufen|kontakt|sprechen|chiamare|contattare|parlare|ligar|contactar|falar)\b/,
];

const URGENT_CARE_PATTERNS = [
  /\b(urgent care|care center|care centre|clinic|walk in|walk-in|same day clinic|hospital)\b/,
  /\b(urgencias|centro de salud|clinica|clinica urgente|centro medico)\b/,
  /\b(soins urgents|centre de soins|clinique|hopital)\b/,
  /\b(notfallpraxis|klinik|ambulanz|notaufnahme)\b/,
  /\b(pronto soccorso|clinica|centro medico|ospedale)\b/,
  /\b(urgencia|clinica|centro de saude|hospital)\b/,
];

const HYDRATION_PATTERNS = [
  /\b(hydrat|drink fluids|fluids|water|electrolyte|rehydration)\b/,
  /\b(agua|liquidos|hidrata|hidratacion|electrolitos)\b/,
  /\b(eau|liquides|hydrater|hydratation|electrolytes)\b/,
  /\b(wasser|flussigkeit|trinken|elektrolyt)\b/,
  /\b(acqua|liquidi|idrata|idratazione|elettroliti)\b/,
  /\b(agua|liquidos|hidratar|hidratacao|eletrolitos)\b/,
];

const CARE_SUPPORT_PATTERNS = [
  /\b(someone stay|stay with you|not be alone|do not stay alone|caregiver|carer|companion|home care|home support|support at home)\b/,
  /\b(cuidador|cuidadora|acompan|acompanar|acompanarte|no estar solo|no estes solo|ayuda en casa)\b/,
  /\b(aidant|aidante|accompagner|ne restez pas seul|aide a domicile)\b/,
  /\b(betreuung|betreuer|begleitung|nicht allein|hilfe zu hause)\b/,
  /\b(badante|assistente|compagnia|non restare solo|aiuto a casa)\b/,
  /\b(cuidador|acompanh|nao fique sozinho|apoio em casa)\b/,
];

export function normalizeRecommendationText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function uniqueActions(actions: SymptomRecommendationActionKind[]) {
  return Array.from(new Set(actions));
}

export function getSymptomRecommendationActionKinds(
  recommendation: string,
  availability: SymptomRecommendationActionAvailability = {},
): SymptomRecommendationActionKind[] {
  const normalized = normalizeRecommendationText(recommendation);
  const actions: SymptomRecommendationActionKind[] = [];
  const isEmergencyRecommendation = matchesAny(normalized, EMERGENCY_PATTERNS);

  if (isEmergencyRecommendation) {
    if (availability.hasEmergencyContact) actions.push("call_emergency");
    return uniqueActions(actions);
  }

  if (matchesAny(normalized, DOCTOR_PATTERNS)) {
    if (availability.hasGpPhone) actions.push("call_gp");
    if (availability.hasGpEmail) actions.push("email_gp");
    actions.push("doctor_help");
  }

  if (matchesAny(normalized, URGENT_CARE_PATTERNS)) {
    actions.push("book_ride", "schedule_appointment");
  }

  if (matchesAny(normalized, HYDRATION_PATTERNS)) {
    actions.push("online_order");
  }

  if (matchesAny(normalized, CARE_SUPPORT_PATTERNS)) {
    actions.push("request_quote");
  }

  return uniqueActions(actions);
}
