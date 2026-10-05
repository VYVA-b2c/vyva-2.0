export type ProviderConcernCategory = "safety" | "fraud" | "pricing" | "reliability" | "quality" | "unclassified";
export type ProviderConcernLevel = "none" | "isolated" | "pattern" | "serious";

export const PROVIDER_CONCERN_CATEGORIES: readonly ProviderConcernCategory[] = ["safety", "fraud", "pricing", "reliability", "quality", "unclassified"];

export interface ProviderConcernDetail {
  category: ProviderConcernCategory;
  summary: string;
  date: string;
}

export interface ProviderVerification {
  version: 1;
  status: "verified" | "incomplete" | "concerns";
  checkedAt: string;
  reviewCount: number;
  recentReviewCount: number;
  sources: string[];
  gaps: string[];
  concerns: string[];
  retryable: boolean;
  // Absent on results produced before concern severity existed.
  concernDetails?: ProviderConcernDetail[];
  concernLevel?: ProviderConcernLevel;
}

// Business reputation moves slowly; results are shared between members for this long.
export const PROVIDER_VERIFICATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Product-design rationale, not a validated threshold: a safety or fraud
// allegation is serious enough to withhold a provider from older members; any
// other category counts against a provider once two customers report it.
// Unclassified concerns are treated as a pattern so a missing label never
// softens the outcome.
export function classifyConcernLevel(details: ProviderConcernDetail[]): ProviderConcernLevel {
  if (details.length === 0) return "none";
  if (details.some(d => d.category === "safety" || d.category === "fraud")) return "serious";
  const counts = new Map<ProviderConcernCategory, number>();
  for (const detail of details) counts.set(detail.category, (counts.get(detail.category) ?? 0) + 1);
  if (counts.has("unclassified") || [...counts.values()].some(count => count >= 2)) return "pattern";
  return "isolated";
}

export function patternConcernCategories(details: ProviderConcernDetail[]): ProviderConcernCategory[] {
  const counts = new Map<ProviderConcernCategory, number>();
  for (const detail of details) counts.set(detail.category, (counts.get(detail.category) ?? 0) + 1);
  return [...counts].filter(([category, count]) => count >= 2 || category === "unclassified").map(([category]) => category);
}

function validConcernDetails(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every(d => d && typeof d === "object"
    && PROVIDER_CONCERN_CATEGORIES.includes((d as ProviderConcernDetail).category)
    && typeof (d as ProviderConcernDetail).summary === "string" && typeof (d as ProviderConcernDetail).date === "string"));
}

export function currentVerification(value: unknown, now = Date.now(), maxAgeMs = PROVIDER_VERIFICATION_MAX_AGE_MS): ProviderVerification | null {
  if (!value || typeof value !== "object") return null;
  const item = value as ProviderVerification;
  const age = now - Date.parse(item.checkedAt);
  return item.version === 1 && ["verified", "incomplete", "concerns"].includes(item.status)
    && Number.isInteger(item.reviewCount) && item.reviewCount >= 0
    && Number.isInteger(item.recentReviewCount) && item.recentReviewCount >= 0 && item.recentReviewCount <= item.reviewCount
    && typeof item.retryable === "boolean"
    && Array.isArray(item.sources) && item.sources.every(url => typeof url === "string" && /^https?:\/\//.test(url))
    && Array.isArray(item.gaps) && item.gaps.every(g => typeof g === "string")
    && Array.isArray(item.concerns) && item.concerns.every(g => typeof g === "string")
    && validConcernDetails(item.concernDetails)
    && (item.concernLevel === undefined || ["none", "isolated", "pattern", "serious"].includes(item.concernLevel))
    // Client and server clocks can differ slightly, even for a fresh response.
    && Number.isFinite(age) && age >= -5 * 60 * 1000 && age < maxAgeMs ? item : null;
}

// Results from before severity existed: any concern keeps its old weight.
export function verificationConcernLevel(verification: ProviderVerification): ProviderConcernLevel {
  if (verification.concernLevel) return verification.concernLevel;
  return verification.concerns.length ? "pattern" : "none";
}
