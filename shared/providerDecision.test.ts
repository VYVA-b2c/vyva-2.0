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
});
