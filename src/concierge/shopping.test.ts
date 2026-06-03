import { describe, expect, it } from "vitest";
import { buildShoppingRecommendations, STATIC_SHOPPING_CATALOG, type ShoppingCatalogProduct } from "../../shared/shopping";

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

  it("returns catalog-backed hydration support choices", () => {
    const result = buildShoppingRecommendations({
      needText: "Hydration support: water, oral rehydration salts, or electrolyte drinks",
      category: "groceries",
      priorities: ["delivery", "simplicity"],
      constraints: ["no heavy lifting"],
      locale: "en",
    });

    const ids = result.recommendations.map((item) => item.product.id);
    expect(ids).toContain("small-water-bottle-multipack");
    expect(ids).toContain("low-sugar-electrolyte-drinks");
    expect(result.recommendations.some((item) => item.product.tags.includes("hydration"))).toBe(true);
  });

  it("uses a supplied curated catalog instead of the static fallback", () => {
    const curatedCatalog: ShoppingCatalogProduct[] = [{
      id: "admin-curated-night-light",
      category: "household",
      name: { en: "Admin curated night light", es: "Luz nocturna aprobada por admin" },
      priceLabel: { en: "Low cost", es: "Precio bajo" },
      description: { en: "A VYVA-approved light for night bathroom trips.", es: "Luz aprobada por VYVA para ir al bano de noche." },
      benefits: { en: ["Lights the hallway"], es: ["Ilumina el pasillo"] },
      tags: ["household", "safety", "night_trip", "lighting", "bathroom", "home_safety", "simple"],
      suitability: { en: ["Good for night trips"], es: ["Buena para ir de noche"] },
      cautions: { en: ["Check socket placement."], es: ["Revise el enchufe."] },
      accessibilityNotes: { en: ["No app required."], es: ["No requiere app."] },
      availabilityLabel: { en: "VYVA curated item", es: "Articulo curado por VYVA" },
      priceTier: "low",
    }];

    const result = buildShoppingRecommendations({
      needText: "Safer bathroom at night",
      category: "safe_home",
      priorities: ["safety", "accessibility"],
      locale: "en",
    }, { catalog: curatedCatalog });

    expect(result.recommendations.map((item) => item.product.id)).toEqual(["admin-curated-night-light"]);
  });

  it("prefers package-linked products when package context is supplied", () => {
    const result = buildShoppingRecommendations({
      needText: "Simple support kit after a health recommendation",
      category: "groceries",
      priorities: ["simplicity", "delivery"],
      locale: "en",
      packageId: "hydration_support",
    }, {
      catalog: STATIC_SHOPPING_CATALOG,
      packageProductIds: ["small-water-bottle-multipack", "low-sugar-electrolyte-drinks"],
    });

    expect(result.recommendations.slice(0, 2).map((item) => item.product.id)).toEqual(expect.arrayContaining([
      "small-water-bottle-multipack",
      "low-sugar-electrolyte-drinks",
    ]));
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
