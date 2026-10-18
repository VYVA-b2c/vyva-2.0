import { describe, expect, it } from "vitest";
import { EMPTY_PERSONAL_PROFILE, effectivePriorities, parsePersonalProfile } from "./personalProviderProfile.js";
import { decideProviderCandidates, type ProviderCandidate } from "./providerDecision.js";
import { isLocalLanguage } from "./homeServiceSearch.js";

const profile = (overrides = {}) => ({ ...EMPTY_PERSONAL_PROFILE, ...overrides });

describe("personal provider profile", () => {
  it("never overrides priorities the member chose", () => {
    const p = profile({ inferredPriorities: ["lowest_cost"] });
    expect(effectivePriorities(["fastest"], p)).toEqual({ criteria: ["fastest"], notes: [] });
  });

  it("fills in from what the member said when they chose none, and says why", () => {
    const p = profile({ inferredPriorities: ["lowest_cost"] });
    for (const chosen of [[], ["not_sure"], undefined]) {
      const result = effectivePriorities(chosen, p);
      expect(result.criteria).toEqual(["lowest_cost"]);
      expect(result.notes[0]).toContain("keeping costs down");
    }
  });

  it("rejects malformed stored profiles and trims unknown priorities", () => {
    expect(parsePersonalProfile({ version: 2 })).toBeNull();
    expect(parsePersonalProfile({ ...EMPTY_PERSONAL_PROFILE, likedPlaceIds: [1] })).toBeNull();
    expect(parsePersonalProfile({ ...EMPTY_PERSONAL_PROFILE, inferredPriorities: ["cheap", "trusted"] })?.inferredPriorities).toEqual(["trusted"]);
  });

  it("treats a language as local only where the country commonly uses it", () => {
    expect(isLocalLanguage("ES", "es")).toBe(true);
    expect(isLocalLanguage("ES", "de")).toBe(false);
    expect(isLocalLanguage("CH", "fr-CH")).toBe(true);
    expect(isLocalLanguage("ZZ", "en")).toBe(false);
  });
});

describe("personal ranking", () => {
  const listing = (id: string, overrides: Partial<ProviderCandidate> = {}): ProviderCandidate => ({
    id, placeId: `place-${id}`, name: `Plumber ${id}`, source: "external", category: "home_service", address: "1 Calle Mayor",
    contactable: true, active: true, rating: 4.9, reviewCount: 300, raw: {}, ...overrides,
  });
  const request = (personal: ReturnType<typeof profile>) => ({ appointmentType: "home-service", serviceType: "plumber", maxResults: 12, personal });

  it("leaves out a provider the member said they would not use again", () => {
    const result = decideProviderCandidates([listing("a"), listing("b")], request(profile({ declinedPlaceIds: ["place-a"] })));
    expect(result.ranked.map(r => r.candidate.id)).toEqual(["b"]);
    expect(result.excluded[0].code).toBe("excluded_member_declined");
  });

  it("lifts a provider the member liked above a better-rated stranger", () => {
    const result = decideProviderCandidates([listing("stranger", { rating: 5, reviewCount: 2000 }), listing("liked", { rating: 4.2, reviewCount: 30 })], request(profile({ likedPlaceIds: ["place-liked"] })));
    expect(result.ranked[0].candidate.id).toBe("liked");
    expect(result.ranked[0].priorityNotes?.[0]).toBe("You said you'd use them again.");
  });

  it("favours providers whose site says they speak the member's language", () => {
    const result = decideProviderCandidates([listing("local"), listing("german", { languagesStated: ["es", "de"] })], request(profile({ memberLanguage: "de" })));
    expect(result.ranked[0].candidate.id).toBe("german");
    expect(result.ranked[0].reasons).toContain("Website says they speak your language");
  });

  it("applies inferred priorities and reports them as the criteria used", () => {
    const result = decideProviderCandidates([listing("a", { priceLevel: 1 })], request(profile({ inferredPriorities: ["lowest_cost"] })));
    expect(result.criteriaUsed).toEqual(["lowest_cost"]);
    expect(result.ranked[0].priorityBonus).toBeGreaterThan(0);
  });
});
