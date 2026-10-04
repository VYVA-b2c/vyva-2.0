export type ConciergeActionListEnvelope<T> = {
  items: T[];
};

/**
 * The Concierge action endpoints are cached under keys also used by Home.
 * Accept the legacy array cache while preserving the API envelope as the
 * canonical query value. Invalid cached data must surface as an error rather
 * than making an empty inbox look legitimate.
 */
export function normalizeConciergeActionItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (!value || typeof value !== "object") {
    throw new Error("Concierge action list must be an items envelope or an array.");
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new Error("Concierge action list envelope must contain an items array.");
  }
  return items as T[];
}

export function normalizeConciergeActionEnvelope<T>(value: unknown): ConciergeActionListEnvelope<T> {
  return { items: normalizeConciergeActionItems<T>(value) };
}
