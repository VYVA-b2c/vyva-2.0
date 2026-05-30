import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import conciergeShoppingRouter from "../routes/conciergeShopping.js";
import { getShoppingCatalog } from "../../shared/shopping.js";

function app() {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/concierge/shopping", conciergeShoppingRouter);
  return testApp;
}

const originalEnv = { ...process.env };

describe("concierge shopping recommendations API", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns catalog-bounded recommendations without requiring AI", async () => {
    const catalogIds = new Set(getShoppingCatalog("en").map((item) => item.id));

    const res = await request(app())
      .post("/api/concierge/shopping/recommendations")
      .send({
        needText: "I need something to make the shower safer",
        category: "mobility_aids",
        priorities: ["safety", "accessibility"],
        locale: "en",
      })
      .expect(200);

    expect(res.body.recommendations.length).toBeGreaterThan(0);
    expect(res.body.recommendations.length).toBeLessThanOrEqual(3);
    expect(catalogIds.has(res.body.recommendations[0].product.id)).toBe(true);
    expect(res.body.comparison.summary).toContain(res.body.recommendations[0].product.name);
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain("checkout");
  });

  it("validates that the user supplied a shopping need", async () => {
    const res = await request(app())
      .post("/api/concierge/shopping/recommendations")
      .send({})
      .expect(400);

    expect(res.body.error).toContain("Tell VYVA");
  });
});

