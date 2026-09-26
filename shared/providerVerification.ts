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
}

export function currentVerification(value: unknown, now = Date.now()): ProviderVerification | null {
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
    && Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000 ? item : null;
}
