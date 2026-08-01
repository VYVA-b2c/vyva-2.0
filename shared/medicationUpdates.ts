import { normalizeAppLanguage, type AppLanguage } from "./language";

export const MEDICATION_UPDATE_KINDS = [
  "recall",
  "safety_warning",
  "availability_change",
  "general_information",
] as const;

export type MedicationUpdateKind = typeof MEDICATION_UPDATE_KINDS[number];
export type MedicationUpdateFreshness = "current" | "older" | "stale" | "unknown";
export type MedicationMatchConfidence = "exact" | "ingredient" | "possible";
export type MedicationEvidenceVerification = "verified" | "not_verified";
export type MedicationUpdateSourceStatus = "available" | "no_match" | "unavailable";
export type MedicationVerificationReason =
  | "possible_match"
  | "jurisdiction_mismatch"
  | "jurisdiction_unconfirmed"
  | "formulation_mismatch"
  | "formulation_unconfirmed"
  | "stale_source"
  | "undated_source"
  | "conflicting_evidence";

export type MedicationEvidenceRequest = {
  medicationName: string;
  activeIngredient?: string | null;
  formulation?: string | null;
  doseText?: string | null;
  countryCode?: string | null;
};

export type MedicationUpdateSource = {
  authority: "AEMPS" | "FDA" | "PubMed";
  authorityLabel: string;
  title: string;
  publisher: string;
  url: string;
  publishedAt: string | null;
  retrievedAt: string;
  originalLanguage: string;
  jurisdiction: string;
  recordId: string;
};

export type MedicationEvidenceMatch = {
  requestedName: string;
  requestedIngredient: string | null;
  requestedFormulation: string | null;
  matchedName: string;
  matchedIngredient: string | null;
  matchedFormulation: string | null;
  confidence: MedicationMatchConfidence;
};

export type MedicationUpdate = {
  id: string;
  medicationName: string;
  kind: MedicationUpdateKind;
  summary: string;
  sourceExcerpt: string | null;
  discussionQuestions: string[];
  freshness: MedicationUpdateFreshness;
  verification: MedicationEvidenceVerification;
  verificationReasons: MedicationVerificationReason[];
  match: MedicationEvidenceMatch;
  source: MedicationUpdateSource;
};

export type MedicationUpdateSourceCheck = {
  authority: MedicationUpdateSource["authority"];
  authorityLabel: string;
  status: MedicationUpdateSourceStatus;
  checkedAt: string;
  message: string;
};

export type MedicationUpdatesResponse = {
  generatedAt: string;
  language: AppLanguage;
  countryCode: string | null;
  medications: MedicationEvidenceRequest[];
  updates: MedicationUpdate[];
  sources: MedicationUpdateSourceCheck[];
  notice: string;
};

export function medicationUpdateFreshness(
  publishedAt: string | null | undefined,
  now = new Date(),
): MedicationUpdateFreshness {
  if (!publishedAt) return "unknown";
  const published = new Date(publishedAt);
  if (!Number.isFinite(published.getTime()) || published.getTime() > now.getTime()) return "unknown";
  const ageDays = Math.floor((now.getTime() - published.getTime()) / 86_400_000);
  if (ageDays <= 365) return "current";
  if (ageDays <= 730) return "older";
  return "stale";
}

export function normalizeMedicationMatchName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|g|ml|iu|ui|%)\b/g, " ")
    .replace(/\b(?:tablet|tablets|capsule|capsules|comprimido|comprimidos|capsula|capsulas|solution|solucion|extended release|release|retard|efg)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeMedicationFormulation(value: string | null | undefined): string | null {
  const normalized = (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const forms: Array<[RegExp, string]> = [
    [/\b(?:tablet|tablets|comprimido|comprimidos|comprime|compresse|tablette|tabletten)\b/, "tablet"],
    [/\b(?:capsule|capsules|capsula|capsulas|kapsel|kapseln)\b/, "capsule"],
    [/\b(?:solution|solucion|solucao|losung|syrup|jarabe|xarope|sirop)\b/, "liquid"],
    [/\b(?:injection|inyectable|injecao|iniettabile|injektion)\b/, "injection"],
    [/\b(?:inhaler|inhalador|inhalation|inhalateur)\b/, "inhaled"],
    [/\b(?:cream|crema|creme|ointment|pomada|salbe)\b/, "topical"],
    [/\b(?:patch|parche|adesivo|pflaster)\b/, "patch"],
    [/\b(?:drops|gotas|gocce|tropfen)\b/, "drops"],
  ];
  return forms.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function meaningfulTokens(value: string): string[] {
  return normalizeMedicationMatchName(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

export function medicationMatchConfidence(
  requestedName: string,
  candidateNames: Array<string | null | undefined>,
  requestedIngredient?: string | null,
  candidateIngredients: Array<string | null | undefined> = [],
): MedicationMatchConfidence | null {
  const requested = normalizeMedicationMatchName(requestedName);
  const requestedActive = normalizeMedicationMatchName(requestedIngredient ?? "");
  if (!requested || requested.length < 3) return null;

  for (const rawCandidate of candidateNames) {
    const candidate = normalizeMedicationMatchName(rawCandidate ?? "");
    if (candidate && candidate === requested) return "exact";
  }

  const requestedIngredients = [requested, requestedActive].filter(Boolean);
  for (const rawIngredient of candidateIngredients) {
    const ingredient = normalizeMedicationMatchName(rawIngredient ?? "");
    if (ingredient && requestedIngredients.includes(ingredient)) return "ingredient";
  }

  const requestedTokens = meaningfulTokens(requestedName);
  for (const rawCandidate of [...candidateNames, ...candidateIngredients]) {
    const candidate = normalizeMedicationMatchName(rawCandidate ?? "");
    if (!candidate) continue;
    if (requested.length >= 5 && (candidate.startsWith(requested) || requested.startsWith(candidate))) {
      return "possible";
    }
    const candidateTokens = new Set(meaningfulTokens(candidate));
    if (requestedTokens.some((token) => candidateTokens.has(token))) return "possible";
  }
  return null;
}

export function medicationEvidenceVerification(input: {
  matchConfidence: MedicationMatchConfidence;
  freshness: MedicationUpdateFreshness;
  countryMatches: boolean;
  countryKnown?: boolean;
  requestedFormulation: string | null;
  matchedFormulation: string | null;
  conflicting?: boolean;
}): { verification: MedicationEvidenceVerification; reasons: MedicationVerificationReason[] } {
  const reasons: MedicationVerificationReason[] = [];
  if (input.matchConfidence === "possible") reasons.push("possible_match");
  if (!input.countryKnown) reasons.push("jurisdiction_unconfirmed");
  else if (!input.countryMatches) reasons.push("jurisdiction_mismatch");
  if (input.freshness === "stale") reasons.push("stale_source");
  if (input.freshness === "unknown") reasons.push("undated_source");
  if (input.requestedFormulation) {
    if (!input.matchedFormulation) reasons.push("formulation_unconfirmed");
    else if (input.requestedFormulation !== input.matchedFormulation) reasons.push("formulation_mismatch");
  }
  if (input.conflicting) reasons.push("conflicting_evidence");
  return {
    verification: reasons.length === 0 ? "verified" : "not_verified",
    reasons,
  };
}

export function containsUnsafeMedicationInstruction(value: string): boolean {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return [
    /\b(?:stop|start|increase|decrease|double|skip|change|adjust|reduce|replace|switch)\b.{0,36}\b(?:dose|dosage|taking|medicine|medication|drug)\b/,
    /\b(?:deja|empieza|aumenta|reduce|duplica|omite|cambia|ajusta|sustituye)\b.{0,36}\b(?:dosis|medicamento|medicacion)\b/,
    /\b(?:arretez|commencez|augmentez|reduisez|doublez|modifiez|ajustez|remplacez)\b.{0,36}\b(?:dose|medicament|traitement)\b/,
    /\b(?:absetzen|beginnen|erhohen|reduzieren|verdoppeln|andern|anpassen|ersetzen)\b.{0,36}\b(?:dosis|medikament|einnahme)\b/,
    /\b(?:smetti|inizia|aumenta|riduci|raddoppia|cambia|regola|sostituisci)\b.{0,36}\b(?:dose|farmaco|medicinale)\b/,
    /\b(?:pare|comece|aumente|reduza|duplique|mude|ajuste|substitua)\b.{0,36}\b(?:dose|medicamento)\b/,
  ].some((pattern) => pattern.test(normalized));
}

export function medicationUpdatesLanguage(value: string | null | undefined): AppLanguage {
  return normalizeAppLanguage(value, "en");
}
