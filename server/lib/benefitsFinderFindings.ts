import { db } from "../db.js";
import { benefitsFinderFindings } from "../../shared/schema.js";

const CATEGORY_PATTERNS: { category: string; pattern: RegExp }[] = [
  { category: "pension", pattern: /pension|retirement|jubilaci|rente\b/i },
  { category: "housing", pattern: /housing|rent\b|wohngeld|vivienda|alquiler|miete/i },
  { category: "care", pattern: /\bcare\b|carer|cuidad|pflege|dependenc/i },
  { category: "disability", pattern: /disab|discapacidad|behinderung/i },
  { category: "health", pattern: /health|medical|sanidad|gesundheit/i },
];

/** Best-effort classification from the user's own search query; falls back to "other". */
export function classifyBenefitsCategory(query: string): string {
  const match = CATEGORY_PATTERNS.find(({ pattern }) => pattern.test(query));
  return match?.category ?? "other";
}

/** Pulls the first URL out of a free-text search result, for source attribution. */
export function extractPrimarySource(text: string): { sourceName: string | null; sourceUrl: string | null } {
  const match = text.match(/https?:\/\/[^\s)\]]+/);
  if (!match) return { sourceName: null, sourceUrl: null };
  const url = match[0].replace(/[.,;:]+$/, "");
  try {
    return { sourceName: new URL(url).hostname.replace(/^www\./, ""), sourceUrl: url };
  } catch {
    return { sourceName: null, sourceUrl: url };
  }
}

export type BenefitsFinderFindingInput = {
  userId: string;
  country: string | null;
  category: string;
  findingSummary: string;
  sourceName: string | null;
  sourceUrl: string | null;
  accessedAt: string | null;
};

/**
 * Persists one finding the Benefits Finder actually surfaced to the user —
 * not every raw search hit. Best-effort: a failure here must never break the
 * advisor conversation, so callers should not await this for latency and
 * should swallow rejections.
 */
export async function recordBenefitsFinderFinding(input: BenefitsFinderFindingInput): Promise<void> {
  await db.insert(benefitsFinderFindings).values({
    user_id: input.userId,
    country: input.country,
    category: input.category,
    finding_summary: input.findingSummary,
    source_name: input.sourceName,
    source_url: input.sourceUrl,
    accessed_at: input.accessedAt ? new Date(input.accessedAt) : null,
  });
}
