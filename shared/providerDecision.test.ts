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
