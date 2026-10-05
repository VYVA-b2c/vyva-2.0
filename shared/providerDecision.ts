import {
  normalizeConciergeProviderCategory,
  type ConciergeProviderCategoryId,
} from "./conciergeFlowRegistry.js";
import { homeServiceSearchTerms, normalizeHomeServiceType } from "./serviceIntake.js";
import type { ProviderConcernCategory, ProviderConcernLevel, ProviderPriceEvidence } from "./providerVerification.js";
import { homeServicePlaybook, type HomeServicePlaybook } from "./homeServicePlaybooks.js";
import { listingRiskSignals, type ListingRiskSignal } from "./providerListingRisk.js";

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
  | "excluded_serious_concern"
  | "excluded_listing_risk"
  | "excluded_duplicate";

export interface ProviderDecisionRequest {
  appointmentType: string;
  serviceType?: string | null;
  detail?: string | null;
  urgency?: string | null;
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
  openToday?: boolean | null;
  priceLevel?: number | null;
  evidenceStatus?: ProviderEvidenceStatus | null;
  checkedAt?: string | null;
  contactable?: boolean | null;
  concernLevel?: ProviderConcernLevel | null;
  patternConcerns?: ProviderConcernCategory[] | null;
  countryCode?: string | null;
  // False when the listing shows only a service area, not a business premises.
  hasBusinessAddress?: boolean | null;
  priceEvidence?: ProviderPriceEvidence | null;
  // Null until checked; false when a check ran and found no stated credential.
  credentialStated?: boolean | null;
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
  advice?: string[];
  listingRisk?: ListingRiskSignal[];
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
  if (["plumber", "electrician", "locksmith", "cleaner", "handyman", "other"].some(service =>
    homeServiceSearchTerms(service).some(term => text.includes(normalized(term))))) return "home_service";
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
      if (candidate.patternConcerns?.includes("pricing")) {
        notes.push("Several customers report bills above the quote; agree a fixed price first.");
      } else if (typeof level === "number" && Number.isInteger(level) && level >= 0 && level <= 4) {
        bonus += weight * (4 - level) / 4;
        notes.push("Comparing published price bands only; your job still needs a quote.");
      } else {
        const evidence = priceEvidenceBonus(candidate.priceEvidence);
        bonus += weight * evidence.share;
        if (evidence.notes.length) notes.push(...evidence.notes);
        else notes.push("Price information is unavailable; your job needs a quote.");
      }
    }
  }
  return { bonus: Math.round(bonus * 100) / 100, notes };
}

// Product-design weighting: review price mentions carry up to three quarters of
// the lower-cost budget, published prices the rest. Two mentions minimum, so a
// single review cannot decide the comparison.
function priceEvidenceBonus(evidence?: ProviderPriceEvidence | null): { share: number; notes: string[] } {
  if (!evidence) return { share: 0, notes: [] };
  const notes: string[] = [];
  let share = 0;
  const positive = evidence.signals.as_quoted + evidence.signals.good_value;
  const negative = evidence.signals.above_quote + evidence.signals.expensive;
  if (positive + negative >= 2) {
    share += 0.75 * positive / (positive + negative);
    notes.push(positive > negative
      ? "Reviews mostly describe fair prices or prices matching the quote; your job still needs a quote."
      : "Reviews mention prices above expectations; ask for a written quote.");
  }
  if (evidence.publishedPrices.length > 0) {
    share += 0.25;
    notes.push("Prices are published on the provider's website.");
  }
  return { share, notes };
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
  if (candidate.concernLevel === "pattern") {
    // Product-design weighting: outweighs distance and open-now, not a match.
    score -= 25;
    uncertainties.push("Several customers reported similar concerns");
  } else if (candidate.concernLevel === "isolated") {
    uncertainties.push("One customer reported a concern");
  }

  return { score, reasons, uncertainties };
}

const LISTING_RISK_NOTES: Record<ListingRiskSignal, string> = {
  shared_phone: "This phone number is also listed under other business names",
  premium_number: "Uses a paid or national service number, not a local line",
  no_business_address: "No business address is listed",
};

function applyPlaybook(candidate: ProviderCandidate, playbook: HomeServicePlaybook, listingRisk: ListingRiskSignal[], scored: { score: number; reasons: string[]; uncertainties: string[] }) {
  for (const signal of listingRisk) {
    // Product-design weighting: a call-centre signal outweighs being open now.
    if (signal !== "no_business_address") scored.score -= 15;
    scored.uncertainties.push(LISTING_RISK_NOTES[signal]);
  }
  if (playbook.credential && candidate.credentialStated === true) {
    scored.score += 8;
    scored.reasons.push(playbook.credential.kind === "registration" ? "Website states trade registration" : "Website states liability insurance");
  } else if (playbook.credential && candidate.credentialStated === false) {
    scored.uncertainties.push(playbook.credential.kind === "registration" ? "Trade registration not confirmed" : "Liability insurance not confirmed");
  }
}

function evaluateCandidate(candidate: ProviderCandidate, request: ProviderDecisionRequest, listingRisk: ListingRiskSignal[] = []): ProviderDecisionResult {
  const playbook = request.appointmentType === "home-service" ? homeServicePlaybook(request.serviceType) : null;
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
  if (candidate.concernLevel === "serious") {
    return { candidate, code: "excluded_serious_concern", eligible: false, score: 0, reasons: ["Public reviews include a safety or fraud allegation"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }
  if (playbook?.excludeListingRisk && listingRisk.some(signal => signal === "shared_phone" || signal === "premium_number")) {
    return { candidate, code: "excluded_listing_risk", eligible: false, score: 0, reasons: ["Listing shows signs of a call centre rather than a local business"], uncertainties: [], canonicalCategory, exactSubserviceMatch, listingRisk };
  }
  if (!clean(candidate.name) || (!clean(candidate.address) && !candidate.contactable && candidate.source !== "saved")) {
    return { candidate, code: "excluded_insufficient_evidence", eligible: false, score: 0, reasons: ["Not enough provider information to present safely"], uncertainties: [], canonicalCategory, exactSubserviceMatch };
  }

  const code: ProviderDecisionCode = exactSubserviceMatch ? "eligible_exact_match" : "eligible_broad_category";
  const scored = scoreEligible(candidate, exactSubserviceMatch, request.criteria ?? []);
  if (playbook) applyPlaybook(candidate, playbook, listingRisk, scored);
  if (["now", "today"].includes(clean(request.urgency).toLowerCase()) && candidate.openNow !== true) {
    if (candidate.openToday === true) {
      scored.score += 8;
      scored.reasons.push("Business is open today");
    } else if (candidate.openToday === false) {
      scored.uncertainties.push("Business is closed today");
    } else {
      scored.uncertainties.push("Today's opening hours are not confirmed");
    }
  }
  const preference = preferenceScore(candidate, request.appointmentType === "home-service" ? homeServiceRankingPriorities(request.criteria) : []);
  return { candidate, code, eligible: true, ...scored, score: scored.score + preference.bonus, priorityBonus: preference.bonus, priorityNotes: preference.notes, advice: playbook?.advice ?? [], listingRisk, canonicalCategory, exactSubserviceMatch };
}

export function decideProviderCandidates(candidates: ProviderCandidate[], request: ProviderDecisionRequest): ProviderDecisionSummary {
  // Only public listings are compared: a saved contact sharing a number with a
  // listing is usually the same business.
  const risk = listingRiskSignals(candidates.filter(c => c.source === "external").map(c => ({
    id: c.id, name: c.name, phone: c.phone, countryCode: c.countryCode, hasBusinessAddress: c.hasBusinessAddress,
  })));
  const evaluated = candidates.map((candidate) => evaluateCandidate(candidate, request, risk.get(candidate.id) ?? []));
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
