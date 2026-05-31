import { describe, expect, it } from "vitest";
import { buildShoppingRecommendations } from "../../shared/shopping";

describe("senior shopping recommender", () => {
  it("prioritises low-cost grocery choices when budget matters", () => {
    const result = buildShoppingRecommendations({
      needText: "I need a cheap easy breakfast",
      category: "groceries",
      priorities: ["budget", "simplicity"],
      locale: "en",
    });

    expect(result.recommendations[0].product.category).toBe("groceries");
    expect(result.recommendations[0].product.priceTier).toBe("low");
    expect(result.recommendations[0].reasons.join(" ")).toContain("low-cost");
  });

  it("finds bathroom safety and mobility aids for shower fall concerns", () => {
    const result = buildShoppingRecommendations({
      needText: "I need bathroom safety because I am worried about slipping in the shower",
      category: "mobility_aids",
      priorities: ["safety", "accessibility"],
      locale: "en",
    });

    expect(result.recommendations[0].product.id).toBe("non-slip-shower-mat");
    expect(result.recommendations[0].reasons.join(" ")).toContain("risk");
  });

  it("compares safe-home night bathroom choices across categories", () => {
    const result = buildShoppingRecommendations({
      needText: "Safer bathroom at night",
      category: "safe_home",
      priorities: ["safety", "accessibility"],
      locale: "en",
    });

    const ids = result.recommendations.map((item) => item.product.id);
    expect(ids).toContain("motion-night-lights");
    expect(ids).toContain("non-slip-shower-mat");
    expect(result.recommendations[0].rankLabel).toBe("Best for night trips");
  });

  it("prioritises less-bending home safety choices", () => {
    const result = buildShoppingRecommendations({
      needText: "Less bending at home",
      category: "safe_home",
      priorities: ["accessibility", "delivery"],
      locale: "en",
    });

    expect(result.recommendations[0].rankLabel).toBe("Best for less bending");
    expect(["long-handle-dustpan", "grabber-reacher"]).toContain(result.recommendations[0].product.id);
  });

  it("excludes products that violate allergy or diet constraints", () => {
    const result = buildShoppingRecommendations({
      needText: "I need an easy protein breakfast",
      category: "groceries",
      priorities: ["diet", "simplicity"],
      constraints: ["no dairy"],
      locale: "en",
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((item) => item.product.tags.includes("dairy"))).toBe(false);
  });

  it("selects a simple pharmacy basic for medication confusion", () => {
    const result = buildShoppingRecommendations({
      needText: "I mix up medicine and need something simple",
      category: "pharmacy_basics",
      priorities: ["simplicity", "safety"],
      locale: "en",
    });

    expect(result.recommendations[0].product.id).toBe("large-print-pill-organizer");
    expect(result.recommendations[0].reasons.join(" ")).toContain("medicines separated");
    expect(result.uncertaintyNote).toContain("pharmacist");
  });

  it("asks follow-up questions when the need does not match the bounded catalog", () => {
    const result = buildShoppingRecommendations({
      needText: "purple headphones for an airplane",
      category: "safe_home",
      priorities: ["safety", "accessibility"],
      locale: "en",
    });

    expect(result.recommendations).toEqual([]);
    expect(result.nextQuestions.length).toBeGreaterThan(0);
  });
});
