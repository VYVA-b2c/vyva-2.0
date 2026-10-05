const PRIORITY_KEYS = ["fastest", "trusted", "lowest_cost", "highest_rated"];
// Mirrors providerDecision's rule (known keys, at most two) without importing it.
function homeServiceRankingPriorities(criteria: string[]): string[] {
  return [...new Set(criteria)].filter(key => PRIORITY_KEYS.includes(key)).slice(0, 2);
}

// What VYVA knows about one member that should shape a home-service search.
// Stored on the request so every re-rank of that search uses the same view.
export interface PersonalProviderProfile {
  version: 1;
  // The member's language when it is not a local language where they live.
  memberLanguage: string | null;
  // Priorities drawn from what the member has told VYVA; used only when the
  // member did not choose any for this search.
  inferredPriorities: string[];
  // Public businesses this member rated after a job, for this trade.
  likedPlaceIds: string[];
  declinedPlaceIds: string[];
}

export const EMPTY_PERSONAL_PROFILE: PersonalProviderProfile = { version: 1, memberLanguage: null, inferredPriorities: [], likedPlaceIds: [], declinedPlaceIds: [] };

const INFERRED_NOTE: Record<string, string> = {
  lowest_cost: "You've mentioned keeping costs down, so lower cost counts for more.",
  trusted: "You've said trust matters most to you, so checked providers count for more.",
  fastest: "You've said quick help matters to you, so faster options count for more.",
  highest_rated: "You've said reviews matter to you, so well-reviewed providers count for more.",
};

export function parsePersonalProfile(value: unknown): PersonalProviderProfile | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PersonalProviderProfile>;
  const strings = (x: unknown) => Array.isArray(x) && x.every(i => typeof i === "string");
  if (v.version !== 1 || !strings(v.inferredPriorities) || !strings(v.likedPlaceIds) || !strings(v.declinedPlaceIds)) return null;
  if (v.memberLanguage !== null && typeof v.memberLanguage !== "string") return null;
  return { version: 1, memberLanguage: v.memberLanguage ?? null, inferredPriorities: homeServiceRankingPriorities(v.inferredPriorities), likedPlaceIds: v.likedPlaceIds!, declinedPlaceIds: v.declinedPlaceIds! };
}

// The member's own choice always wins. "Not sure" or no choice lets what they
// have told VYVA fill in, and says so.
export function effectivePriorities(chosen: string[] | null | undefined, profile: PersonalProviderProfile | null | undefined): { criteria: string[]; notes: string[] } {
  const explicit = homeServiceRankingPriorities(chosen ?? []);
  if (explicit.length > 0 || !profile?.inferredPriorities.length) return { criteria: chosen ?? [], notes: [] };
  const inferred = homeServiceRankingPriorities(profile.inferredPriorities);
  return { criteria: inferred, notes: inferred.map(key => INFERRED_NOTE[key]).filter(Boolean) };
}
