import type { AdvisorSlug } from "../../shared/advisors.js";
import type { VoiceContextDomain } from "./voiceContext.js";

/**
 * Stable advisor slugs are deliberately decoupled from their present-day roles.
 * Keep their data access here so a renamed card cannot accidentally inherit the
 * generic social context.
 */
const ADVISOR_DOMAINS: Record<AdvisorSlug, VoiceContextDomain> = {
  amara: "wellness",
  nora: "health",
  tomas: "companion",
  elena: "companion",
  diego: "safety",
  ines: "companion",
  sabio: "concierge",
  marta: "concierge",
};

const LIVE_SEARCH_ADVISORS = new Set<AdvisorSlug>(["ines", "sabio", "marta"]);

export function isAdvisorSlug(value: string): value is AdvisorSlug {
  return value in ADVISOR_DOMAINS;
}

export function advisorVoiceDomain(slug: string): VoiceContextDomain | null {
  return isAdvisorSlug(slug) ? ADVISOR_DOMAINS[slug] : null;
}

export function advisorUsesLiveSearch(slug: string): boolean {
  return isAdvisorSlug(slug) && LIVE_SEARCH_ADVISORS.has(slug);
}
