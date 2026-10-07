import { describe, expect, it } from "vitest";
import { decideProviderCandidates, type ProviderCandidate } from "./providerDecision.js";

function candidate(overrides: Partial<ProviderCandidate>): ProviderCandidate {
  return {
    id: overrides.id ?? "provider",
    source: overrides.source ?? "saved",
    name: overrides.name ?? "Provider",
    contactable: true,
    active: true,
    trusted: true,
    evidenceStatus: "reported",
    raw: {},
    ...overrides,
  };
}

describe("provider decision engine", () => {
  const homeRequest = { appointmentType: "home-service", serviceType: "plumber" };
  const tradeCandidate = (overrides: Partial<ProviderCandidate>) => candidate({ name: "Example Plumber", category: "home_service", trusted: false, ...overrides });
  it("keeps a larger eligible home-service shortlist when requested", () => {
    const candidates = Array.from({ length: 8 }, (_, i) => tradeCandidate({ id: `plumber-${i}`, name: `Plumber ${i}` }));
    expect(decideProviderCandidates(candidates, { ...homeRequest, maxResults: 12 }).ranked).toHaveLength(8);
    expect(decideProviderCandidates(candidates, homeRequest).ranked).toHaveLength(3);
  });

  it("changes ordering for different priorities on the same shortlist", () => {
    const candidates = [
      tradeCandidate({ id: "rated", name: "Rated Plumber", rating: 5, reviewCount: 100 }),
      tradeCandidate({ id: "saved", name: "Saved Plumber", trusted: true, rating: 3, reviewCount: 100 }),
    ];
    expect(decideProviderCandidates(candidates, { ...homeRequest, criteria: ["highest_rated"] }).ranked[0].candidate.id).toBe("rated");
    expect(decideProviderCandidates(candidates, { ...homeRequest, criteria: ["trusted"] }).ranked[0].candidate.id).toBe("saved");
  });

  it.each([
    ["fastest", "trusted"], ["fastest", "lowest_cost"], ["fastest", "highest_rated"],
    ["trusted", "lowest_cost"], ["trusted", "highest_rated"], ["lowest_cost", "highest_rated"],
  ])("equally combines %s and %s, independent of selection order", (a, b) => {
    const candidates = [tradeCandidate({ openNow: true, trusted: true, rating: 4.5, reviewCount: 100, priceLevel: 1 })];
    const score = (criteria: string[]) => decideProviderCandidates(candidates, { ...homeRequest, criteria }).ranked[0].score;
    expect(score([a, b])).toBeCloseTo((score([a]) + score([b])) / 2, 1);
    expect(score([a, b])).toBe(score([b, a]));
    expect(score([a, a])).toBe(score([a]));
  });

  it("uses known price bands without treating missing prices as cheap", () => {
    const options = [tradeCandidate({ id: "unknown", name: "Unknown Plumber" }), tradeCandidate({ id: "low", name: "Low Plumber", priceLevel: 1 }), tradeCandidate({ id: "high", name: "High Plumber", priceLevel: 3 })];
    const ranked = decideProviderCandidates(options, { ...homeRequest, criteria: ["lowest_cost"] }).ranked;
    expect(ranked.map(r => r.candidate.id)).toEqual(["low", "high", "unknown"]);
    expect(ranked[0].priorityNotes?.[0]).toContain("needs a quote");
    expect(ranked[2].priorityNotes?.[0]).toContain("unavailable");
    const invalid = decideProviderCandidates([tradeCandidate({ priceLevel: -1 })], { ...homeRequest, criteria: ["lowest_cost"] }).ranked[0];
    expect(invalid.priorityBonus).toBe(0);
  });

  it("never turns open hours into confirmed availability", () => {
    const result = decideProviderCandidates([tradeCandidate({ openNow: true, availability: "unknown" })], { ...homeRequest, criteria: ["fastest"] }).ranked[0];
    expect(result.priorityBonus).toBe(21);
    expect(result.priorityNotes?.[0]).toContain("unconfirmed");
    const unavailable = decideProviderCandidates([tradeCandidate({ openNow: true, availability: "unavailable" })], { ...homeRequest, criteria: ["fastest"] }).ranked[0];
    expect(unavailable.priorityBonus).toBe(0);
  });

  it("reranks when verification supplies new trust evidence", () => {
    const first = tradeCandidate({ id: "a", name: "First Plumber", rating: 5, reviewCount: 100 });
    const second = tradeCandidate({ id: "b", name: "Second Plumber", rating: 4, reviewCount: 100 });
    const request = { ...homeRequest, criteria: ["trusted", "highest_rated"] };
    expect(decideProviderCandidates([first, second], request).ranked[0].candidate.id).toBe("a");
    expect(decideProviderCandidates([first, { ...second, evidenceStatus: "verified" }], request).ranked[0].candidate.id).toBe("b");
  });

  it("keeps defaults for Not sure and does not boost confidence from preferences", () => {
    const options = [tradeCandidate({ priceLevel: 0, evidenceStatus: "unknown" })];
    const baseline = decideProviderCandidates(options, homeRequest);
    expect(decideProviderCandidates(options, { ...homeRequest, criteria: ["not_sure"] }).ranked[0].score).toBe(baseline.ranked[0].score);
    expect(decideProviderCandidates(options, { ...homeRequest, criteria: ["lowest_cost"] }).confidence).toBe(baseline.confidence);
  });

  it("ranks open businesses without claiming job availability", () => {
    const evaluate = (openNow: boolean | null) => decideProviderCandidates([
      candidate({ name: "Local Plumber", category: "home_service", openNow, availability: "unknown" }),
    ], { appointmentType: "home-service", serviceType: "plumber" }).ranked[0];
    const open = evaluate(true);
    expect(open.score).toBe(evaluate(false).score + 12);
    expect(open.reasons).toContain("Business is open now");
    expect(open.reasons).not.toContain("Reported available now");
    expect(open.uncertainties).toContain("Availability is not confirmed");
    expect(evaluate(null).score).toBe(evaluate(false).score);
  });

  it("ranks providers open today first for urgent work without excluding closed-today alternatives", () => {
    const options = [
      tradeCandidate({ id: "closed-today", name: "Closed Today Plumber", openToday: false }),
      tradeCandidate({ id: "open-today", name: "Open Today Plumber", openToday: true }),
      tradeCandidate({ id: "hours-unknown", name: "Unknown Hours Plumber", openToday: null }),
    ];
    const result = decideProviderCandidates(options, { ...homeRequest, urgency: "today", maxResults: 5 });

    expect(result.ranked.map(item => item.candidate.id)).toEqual(["open-today", "closed-today", "hours-unknown"]);
    expect(result.ranked).toHaveLength(3);
    expect(result.ranked[0].reasons).toContain("Business is open today");
    expect(result.ranked.find(item => item.candidate.id === "closed-today")?.uncertainties).toContain("Business is closed today");
  });

  it("does not apply today's hours preference to flexible work", () => {
    const options = [
      tradeCandidate({ id: "closed-today", name: "Closed Today Plumber", openToday: false }),
      tradeCandidate({ id: "open-today", name: "Open Today Plumber", openToday: true }),
    ];
    const result = decideProviderCandidates(options, { ...homeRequest, urgency: "flexible", maxResults: 5 });
    expect(result.ranked[0].score).toBe(result.ranked[1].score);
  });
  it("excludes a primary medical provider from an electrician search", () => {
    const result = decideProviderCandidates([
      candidate({ id: "quiron", name: "Quiron", category: "doctor_clinic", preferred: true }),
      candidate({ id: "electrician", name: "Marbella Electrician", category: "home_service", specialtyText: "electrician electrical" }),
    ], { appointmentType: "home-service", serviceType: "electrician" });

    expect(result.ranked.map((item) => item.candidate.id)).toEqual(["electrician"]);
    expect(result.excluded.find((item) => item.candidate.id === "quiron")?.code).toBe("excluded_category_mismatch");
  });

  it("does not let preferred status rescue the wrong home-service specialty", () => {
    const result = decideProviderCandidates([
      candidate({ id: "plumber", name: "Trusted Plumber", category: "home_service", specialtyText: "plumber plumbing", preferred: true }),
    ], { appointmentType: "home-service", serviceType: "electrician" });

    expect(result.ranked).toEqual([]);
    expect(result.excluded[0].code).toBe("excluded_subservice_mismatch");
  });

  it("deduplicates the saved and external version of the same provider", () => {
    const result = decideProviderCandidates([
      candidate({ id: "saved", source: "saved", name: "Electric Pro", category: "home_service", specialtyText: "electrician", placeId: "place-1", evidenceStatus: "verified" }),
      candidate({ id: "google", source: "external", name: "Electric Pro", category: "electrician", specialtyText: "electrician", placeId: "place-1", trusted: false }),
    ], { appointmentType: "home-service", serviceType: "electrician" });

    expect(result.ranked).toHaveLength(1);
    expect(result.exclusionSummary.excluded_duplicate).toBe(1);
  });

  it("caps the initial shortlist at three ranked options", () => {
    const options = Array.from({ length: 5 }, (_, index) => candidate({
      id: `electrician-${index}`,
      name: `Electrician ${index}`,
      category: "home_service",
      specialtyText: "electrician",
      rating: 4 + index / 10,
      reviewCount: 50,
    }));
    const result = decideProviderCandidates(options, { appointmentType: "home-service", serviceType: "electrician" });
    expect(result.ranked).toHaveLength(3);
  });

  it("treats a category-only medical match as broad rather than claiming an exact specialty match", () => {
    const result = decideProviderCandidates([
      candidate({ id: "clinic", name: "General Health Clinic", category: "doctor_clinic" }),
    ], { appointmentType: "medical", detail: "dermatology" });

    expect(result.ranked[0].code).toBe("eligible_broad_category");
    expect(result.confidence).toBe("medium");
  });

  it("uses review volume so one unsupported five-star rating does not dominate", () => {
    const result = decideProviderCandidates([
      candidate({ id: "thin", name: "Electrician Thin", category: "home_service", specialtyText: "electrician", rating: 5, reviewCount: 1 }),
      candidate({ id: "proven", name: "Electrician Proven", category: "home_service", specialtyText: "electrician", rating: 4.8, reviewCount: 200 }),
    ], { appointmentType: "home-service", serviceType: "electrician", criteria: ["reputation"] });

    expect(result.ranked[0].candidate.id).toBe("proven");
  });

  it("withholds providers with a safety or fraud allegation and demotes repeated concerns", () => {
    const clean = tradeCandidate({ id: "clean", name: "Clean Plumber", rating: 4.2, reviewCount: 40 });
    const pattern = tradeCandidate({ id: "pattern", name: "Pattern Plumber", rating: 4.9, reviewCount: 400, concernLevel: "pattern", patternConcerns: ["pricing"] });
    const serious = tradeCandidate({ id: "serious", name: "Serious Plumber", rating: 5, reviewCount: 900, concernLevel: "serious" });
    const result = decideProviderCandidates([clean, pattern, serious], { ...homeRequest, criteria: ["lowest_cost"] });
    expect(result.ranked.map(r => r.candidate.id)).toEqual(["clean", "pattern"]);
    expect(result.excluded.find(r => r.candidate.id === "serious")?.code).toBe("excluded_serious_concern");
    expect(result.ranked[1].uncertainties).toContain("Several customers reported similar concerns");
    expect(result.ranked[1].priorityNotes?.[0]).toContain("fixed price");
    expect(result.ranked[1].priorityBonus).toBe(0);
  });

  it("keeps a single minor concern as a caveat without a penalty", () => {
    const base = decideProviderCandidates([tradeCandidate({})], homeRequest).ranked[0];
    const isolated = decideProviderCandidates([tradeCandidate({ concernLevel: "isolated" })], homeRequest).ranked[0];
    expect(isolated.score).toBe(base.score);
    expect(isolated.uncertainties).toContain("One customer reported a concern");
  });

  describe("service playbooks", () => {
    const listing = (overrides: Partial<ProviderCandidate>) => candidate({ source: "external", trusted: false, category: "home_service", address: "1 Calle Mayor", ...overrides });
    const locksmiths = [
      listing({ id: "a", name: "Cerrajero Tarifa 24h", phone: "+34 611 223 344" }),
      listing({ id: "b", name: "Cerrajero Urgente", phone: "+34 611 223 344" }),
      listing({ id: "c", name: "Cerrajero Premium", phone: "+34 902 123 456" }),
      listing({ id: "d", name: "Cerrajero Ruiz", phone: "+34 956 000 111" }),
    ];

    it("withholds call-centre locksmith listings and advises a fixed price", () => {
      const result = decideProviderCandidates(locksmiths, { appointmentType: "home-service", serviceType: "locksmith", maxResults: 12 });
      expect(result.ranked.map(r => r.candidate.id)).toEqual(["d"]);
      expect(result.excluded.filter(r => r.code === "excluded_listing_risk").map(r => r.candidate.id).sort()).toEqual(["a", "b", "c"]);
      expect(result.ranked[0].advice).toEqual(["Agree the full price by phone before anyone comes out."]);
    });

    it("demotes the same signals for other trades instead of withholding", () => {
      const plumbers = locksmiths.map(c => ({ ...c, name: c.name.replace(/Cerrajer(o|ia)/g, "Fontaneria") }));
      const result = decideProviderCandidates(plumbers, { appointmentType: "home-service", serviceType: "plumber", maxResults: 12 });
      expect(result.ranked[0].candidate.id).toBe("d");
      expect(result.ranked.find(r => r.candidate.id === "c")?.uncertainties).toContain("Uses a paid or national service number, not a local line");
      expect(result.excluded.some(r => r.code === "excluded_listing_risk")).toBe(false);
    });

    it("never flags a saved contact that shares a listing's number", () => {
      const result = decideProviderCandidates([
        listing({ id: "public", name: "Fontaneria Ruiz", phone: "+34 956 000 111" }),
        candidate({ id: "saved", name: "Pepe fontanero", category: "home_service", phone: "+34 956 000 111" }),
      ], { appointmentType: "home-service", serviceType: "plumber", maxResults: 12 });
      expect(result.ranked.flatMap(r => r.listingRisk ?? [])).toEqual([]);
    });

    it("rewards a stated electrical registration and names its absence", () => {
      const request = { appointmentType: "home-service", serviceType: "electrician", maxResults: 12 };
      const stated = decideProviderCandidates([listing({ name: "Electricista Sol", credentialStated: true })], request).ranked[0];
      const missing = decideProviderCandidates([listing({ name: "Electricista Sol", credentialStated: false })], request).ranked[0];
      const unchecked = decideProviderCandidates([listing({ name: "Electricista Sol" })], request).ranked[0];
      expect(stated.score - unchecked.score).toBe(8);
      expect(stated.reasons).toContain("Website states trade registration");
      expect(missing.score).toBe(unchecked.score);
      expect(missing.uncertainties).toContain("Trade registration not confirmed");
      expect(unchecked.uncertainties).not.toContain("Trade registration not confirmed");
    });

    it("uses review price mentions and published prices when no price band exists", () => {
      const signals = (as_quoted: number, above_quote: number) => ({ as_quoted, above_quote, good_value: 0, expensive: 0 });
      const fair = listing({ id: "fair", name: "Fair Plumber", priceEvidence: { publishedPrices: ["Call-out 35 EUR"], signals: signals(3, 0) } });
      const steep = listing({ id: "steep", name: "Steep Plumber", priceEvidence: { publishedPrices: [], signals: signals(0, 2) } });
      const single = listing({ id: "single", name: "Single Plumber", priceEvidence: { publishedPrices: [], signals: signals(1, 0) } });
      const result = decideProviderCandidates([steep, single, fair], { ...homeRequest, criteria: ["lowest_cost"], maxResults: 12 });
      expect(result.ranked[0].candidate.id).toBe("fair");
      expect(result.ranked[0].priorityBonus).toBe(60);
      expect(result.ranked[0].priorityNotes).toContain("Prices are published on the provider's website.");
      expect(result.ranked.find(r => r.candidate.id === "steep")?.priorityNotes?.[0]).toContain("above expectations");
      expect(result.ranked.find(r => r.candidate.id === "single")?.priorityBonus).toBe(0);
    });
  });

  it("ranks on pooled member outcomes once two members have answered", () => {
    const listing = (id: string, memberOutcomes: ProviderCandidate["memberOutcomes"]) => candidate({ id, name: `Plumber ${id}`, source: "external", trusted: false, category: "home_service", address: "1 Calle Mayor", rating: 4.8, reviewCount: 200, memberOutcomes });
    const result = decideProviderCandidates([
      listing("starry", { jobs: 3, noShows: 2, aboveQuote: 0, wouldUseAgain: 0, wouldNotUseAgain: 3 }),
      listing("liked", { jobs: 3, noShows: 0, aboveQuote: 0, wouldUseAgain: 3, wouldNotUseAgain: 0 }),
    ], { ...homeRequest, maxResults: 12 });
    expect(result.ranked.map(r => r.candidate.id)).toEqual(["liked", "starry"]);
    expect(result.ranked[0].reasons).toContain("Other VYVA members would use this provider again");
    expect(result.ranked[1].uncertainties).toContain("Other VYVA members report missed visits");
  });

  it("ranks a partner-vetted provider above strong public listings", () => {
    const listing = candidate({ id: "public", source: "external", trusted: false, category: "home_service", name: "Fontaneria Centro", address: "1 Calle Mayor", rating: 4.9, reviewCount: 800, evidenceStatus: "verified", openNow: true });
    const partner = candidate({ id: "partner", source: "partner", trusted: false, category: "home_service", name: "Ruiz", specialtyText: "plumber fontanero", evidenceStatus: "reported" });
    const result = decideProviderCandidates([listing, partner], { ...homeRequest, criteria: ["trusted"], maxResults: 12 });
    expect(result.ranked[0].candidate.id).toBe("partner");
    expect(result.ranked[0].reasons).toContain("Vetted by a partner organisation");
    expect(result.ranked[0].priorityNotes?.[0]).toContain("partner organisation vetted");
  });
});
