import {
  normalizeConciergeProviderCategory,
  type ConciergeProviderCategoryId,
} from "./conciergeFlowRegistry.js";
import { homeServiceSearchTerms, normalizeHomeServiceType } from "./serviceIntake.js";

export type ProviderCandidateSource = "saved" | "partner" | "external" | "manual";
export type ProviderEvidenceStatus = "verified" | "reported" | "unknown";
export type ProviderAvailability = "available" | "unavailable" | "unknown";
export type ProviderDecisionCode =
  | "eligible_exact_match"
  | "eligible_broad_category"
  | "excluded_category_mismatch"
  | "excluded_subservice_mismatch"
  | "excluded_inactive"
  | "excluded_insufficient_evidence"
  | "excluded_duplicate";

export interface ProviderDecisionRequest {
  appointmentType: string;
  serviceType?: string | null;
  detail?: string | null;
  criteria?: string[];
  maxResults?: number;
}

export interface ProviderCandidate {
  id: string;
  source: ProviderCandidateSource;
  name: string;
  category?: string | null;
  specialtyText?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  placeId?: string | null;
  active?: boolean | null;
  trusted?: boolean | null;
  preferred?: boolean | null;
  rating?: number | null;
  reviewCount?: number | null;
  distanceMeters?: number | null;
  availability?: ProviderAvailability | null;
  openNow?: boolean | null;
  priceLevel?: number | null;
  evidenceStatus?: ProviderEvidenceStatus | null;
  checkedAt?: string | null;
  contactable?: boolean | null;
  raw: unknown;
}

export interface ProviderDecisionResult {
  candidate: ProviderCandidate;
  code: ProviderDecisionCode;
  eligible: boolean;
  score: number;
  reasons: string[];
  uncertainties: string[];
  canonicalCategory: ConciergeProviderCategoryId;
  exactSubserviceMatch: boolean;
  priorityNotes?: string[];
  priorityBonus?: number;
}

export interface ProviderDecisionSummary {
  ranked: ProviderDecisionResult[];
  excluded: ProviderDecisionResult[];
  exclusionSummary: Partial<Record<ProviderDecisionCode, number>>;
  criteriaUsed: string[];
  confidence: "high" | "medium" | "low";
}

const APPOINTMENT_CATEGORY: Record<string, ConciergeProviderCategoryId> = {
  medical: "doctor_clinic",
  "personal-care": "personal_care",
  government: "other",
  "home-service": "home_service",
  social: "food",
  transport: "transport",
  pharmacy: "pharmacy",
  care: "personal_care",
};

const CATEGORY_PATTERNS: Record<Exclude<ConciergeProviderCategoryId, "other">, RegExp> = {
  pharmacy: /\b(pharmacy|drugstore|chemist|farmacia)\b/i,
  doctor_clinic: /\b(doctor|clinic|medical|gp|hospital|dentist|health|salud|medic|clinica|hospital|quiron)\b/i,
  transport: /\b(transport|taxi|cab|ride|driver|chauffeur|transfer)\b/i,
  home_service: /\b(home service|repair|maintenance|handyman|manitas|plumber|plumbing|fontanero|electrician|electrical|electricista|locksmith|cerrajero|cleaner|cleaning|limpieza|roofing)\b/i,
  personal_care: /\b(personal care|care home|residence|beauty|hair|barber|nail|spa|podiatry|podologia)\b/i,
  food: /\b(restaurant|food|cafe|takeaway|meal|supermarket|grocery)\b/i,
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalized(value: unknown): string {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function requestedCategory(request: ProviderDecisionRequest): ConciergeProviderCategoryId {
  return APPOINTMENT_CATEGORY[request.appointmentType] ?? normalizeConciergeProviderCategory(request.appointmentType);
}

function candidateSearchText(candidate: ProviderCandidate): string {
  return normalized([candidate.category, candidate.specialtyText, candidate.name].filter(Boolean).join(" "));
}

function inferCategory(candidate: ProviderCandidate): ConciergeProviderCategoryId {
  const explicit = normalizeConciergeProviderCategory(candidate.category);
  if (explicit !== "other") return explicit;
  const text = candidateSearchText(candidate);
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS) as Array<[Exclude<ConciergeProviderCategoryId, "other">, RegExp]>) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

function exactHomeServiceMatch(candidate: ProviderCandidate, serviceType: string | null | undefined): boolean {
  const normalizedType = normalizeHomeServiceType(serviceType);
  if (!serviceType || normalizedType === "other") return true;
  const text = candidateSearchText(candidate);
  return homeServiceSearchTerms(normalizedType).some((term) => text.includes(normalized(term)));
}

function specificRequestMatch(candidate: ProviderCandidate, request: ProviderDecisionRequest): boolean {
  if (request.appointmentType === "home-service") return exactHomeServiceMatch(candidate, request.serviceType);
  const terms = normalized(request.detail).split(/[^a-z0-9]+/).filter((term) => term.length > 3);
  if (terms.length === 0) return false;
  const text = candidateSearchText(candidate);
  return terms.some((term) => text.includes(term));
}

function identity(candidate: ProviderCandidate): string {
  if (clean(candidate.placeId)) return `place:${normalized(candidate.placeId)}`;
  if (clean(candidate.phone)) return `phone:${normalized(candidate.phone).replace(/\D/g, "")}`;
  if (clean(candidate.website)) {
    try {
      return `web:${new URL(clean(candidate.website)).hostname.replace(/^www\./i, "").toLowerCase()}`;
    } catch {
      // Fall through to the name/address identity.
    }
  }
  return `provider:${normalized(candidate.name)}|${normalized(candidate.address)}`;
}

function reputationScore(rating?: number | null, reviewCount?: number | null): number {
  if (!rating || !Number.isFinite(rating) || rating < 1 || rating > 5 || (reviewCount != null && !Number.isFinite(reviewCount))) return 0;
  const confidence = Math.min(1, Math.log10(Math.max(1, reviewCount ?? 1)) / 2);
  return Math.round((rating / 5) * 18 * confidence);
}

export function homeServiceRankingPriorities(criteria: string[] = []): string[] {
  return [...new Set(criteria)].filter(key => ["fastest", "trusted", "lowest_cost", "highest_rated"].includes(key)).slice(0, 2);
}

function preferenceScore(candidate: ProviderCandidate, priorities: string[]) {
  let bonus = 0;
  const notes: string[] = [];
  // Each chosen priority receives the same share of the preference budget.
  // Unknown evidence earns no bonus, and never means cheap or available.
  const weight = 60 / Math.max(1, priorities.length);
  for (const priority of priorities) {
    if (priority === "fastest") {
      if (candidate.availability === "available") {
        bonus += weight;
        notes.push("Reported job availability supports your fastest-help priority.");
      } else if (candidate.availability !== "unavailable" && candidate.openNow === true) {
        bonus += weight * 0.35;
        notes.push("Open now may be easier to reach; job availability is unconfirmed.");
      } else notes.push("No confirmed timing evidence for your fastest-help priority.");
    }
    if (priority === "trusted") {
      const verified = candidate.evidenceStatus === "verified";
      if (verified || candidate.trusted) {
        bonus += weight * (verified ? 1 : 0.75);
        notes.push(verified ? "Evidence checks support your trust priority." : "Your saved trusted provider supports your trust priority.");
      } else notes.push("Trust checks are incomplete for this provider.");
    }
    if (priority === "highest_rated") {
      const reputation = reputationScore(candidate.rating, candidate.reviewCount);
      if (reputation > 0) {
        bonus += weight * reputation / 18;
        notes.push("Rating and review volume support your highest-rated priority.");
      } else notes.push("Rating evidence is missing or too limited to compare.");
    }
    if (priority === "lowest_cost") {
      const level = candidate.priceLevel;
      if (typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= 4) {
        bonus += weight * (4 - level) / 4;
        notes.push("Comparing published price bands only; your job still needs a quote.");
      } else notes.push("Price information is unavailable; your job needs a quote.");
    }
  }
  return { bonus: Math.round(bonus * 100) / 100, notes };
}

function scoreEligible(candidate: ProviderCandidate, exact: boolean, criteria: string[]): { score: number; reasons: string[]; uncertainties: string[] } {
  let score = exact ? 100 : 70;
  const reasons = [exact ? "Matches the requested service" : "Matches the requested provider category"];
  const uncertainties: string[] = [];

  if (candidate.evidenceStatus === "verified") {
    score += 18;
    reasons.push("Source details are verified");
  } else if (candidate.evidenceStatus === "reported") {
    score += 8;
  } else {
    uncertainties.push("Provider details have not been independently verified");
  }
  if (candidate.trusted) {
    score += 10;
    reasons.push("Saved as a trusted provider");
  }
  if (candidate.contactable) score += 8;
  else uncertainties.push("Direct contact route is not confirmed");
  if (candidate.openNow === true) {
    score += 12;
    reasons.push("Business is open now");
  }
  if (candidate.availability === "available") {
    score += 12;
    reasons.push("Reported available now");
  } else if (candidate.availability === "unavailable") {
    score -= 30;
    uncertainties.push("Currently reported unavailable");
  } else {
    uncertainties.push("Availability is not confirmed");
  }
  if (typeof candidate.distanceMeters === "number") {
    score += Math.max(0, 14 - Math.floor(candidate.distanceMeters / 2500));
    reasons.push("Location is known");
  } else if (criteria.includes("distance")) {
    uncertainties.push("Distance is not available");
  }
  const reputation = reputationScore(candidate.rating, candidate.reviewCount);
  score += reputation;
  if (reputation > 0) reasons.push("Reputation is supported by review volume");
  else if (criteria.includes("reputation")) uncertainties.push("Reputation evidence is limited");
  if (candidate.preferred) score += 2;

  return { score, reasons, uncertainties };
}

function evaluateCandidate(candidate: ProviderCandidate, request: ProviderDecisionRequest): ProviderDecisionResult {
  const canonicalCategory = inferCategory(candidate);
  const expectedCategory = requestedCategory(request);
  const exactSubserviceMatch = specificRequestMatch(candidate, request);

  if (candidate.active === false) {
    return { candidate, code: "excluded_inactive", eligible: false, score: 0, reasons: ["Provider is inactive"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }
  if (canonicalCategory !== expectedCategory) {
    return { candidate, code: "excluded_category_mismatch", eligible: false, score: 0, reasons: ["Provider category does not match the request"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }
  if (request.appointmentType === "home-service" && request.serviceType && normalizeHomeServiceType(request.serviceType) !== "other" && !exactSubserviceMatch) {
    return { candidate, code: "excluded_subservice_mismatch", eligible: false, score: 0, reasons: ["Provider does not match the requested service"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }
  if (!clean(candidate.name) || (!clean(candidate.address) && !candidate.contactable && candidate.source !== "saved")) {
    return { candidate, code: "excluded_insufficient_evidence", eligible: false, score: 0, reasons: ["Not enough provider information to present safely"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }

  const code: ProviderDecisionCode = exactSubserviceMatch ? "eligible_exact_match" : "eligible_broad_category";
  const scored = scoreEligible(candidate, exactSubserviceMatch, request.criteria ?? []);
  const preference = preferenceScore(candidate, request.appointmentType === "home-service" ? homeServiceRankingPriorities(request.criteria) : []);
  return { candidate, code, eligible: true, ...scored, score: scored.score + preference.bonus, priorityBonus: preference.bonus, priorityNotes: preference.notes, canonicalCategory, exactSubserviceMatch };
}

export function decideProviderCandidates(candidates: ProviderCandidate[], request: ProviderDecisionRequest): ProviderDecisionSummary {
  const evaluated = candidates.map((candidate) => evaluateCandidate(candidate, request));
  const seen = new Set<string>();
  const excluded = evaluated.filter((result) => !result.eligible);
  const eligible: ProviderDecisionResult[] = [];

  for (const result of evaluated.filter((item) => item.eligible).sort((a, b) => b.score - a.score)) {
    const key = identity(result.candidate);
    if (seen.has(key)) {
      excluded.push({ ...result, eligible: false, code: "excluded_duplicate", score: 0, reasons: ["Duplicate of a higher-ranked provider"] });
      continue;
    }
    seen.add(key);
    eligible.push(result);
  }

  const ranked = eligible.slice(0, Math.max(1, request.maxResults ?? 3));
  const exclusionSummary = excluded.reduce<Partial<Record<ProviderDecisionCode, number>>>((summary, result) => {
    summary[result.code] = (summary[result.code] ?? 0) + 1;
    return summary;
  }, {});
  const confidence = ranked.length === 0
    ? "low"
    : ranked[0].code === "eligible_exact_match" && ranked[0].score - (ranked[0].priorityBonus ?? 0) >= 125
      ? "high"
      : "medium";

  return {
    ranked,
    excluded,
    exclusionSummary,
    criteriaUsed: request.appointmentType === "home-service" ? homeServiceRankingPriorities(request.criteria) : request.criteria ?? [],
    confidence,
  };
}
