import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const PRODUCTION_USE_CASES = [
  "book_ride",
  "order_medicine",
  "book_appointment",
  "home_service",
  "find_provider",
  "find_offers",
  "paperwork",
  "admin_task",
  "scam_check",
  "shopping_request",
  "insurance_admin",
  "travel",
  "send_message",
  "order_food",
] as const;

const PRODUCTION_PROVIDER_CATEGORIES = [
  "pharmacy",
  "doctor_clinic",
  "transport",
  "home_service",
  "personal_care",
  "food",
  "other",
] as const;

const PRODUCTION_OUTCOMES = [
  "pending",
  "completed",
  "confirmed",
  "no_answer",
  "unavailable",
  "cant_fulfil",
  "needs_more_info",
  "user_cancelled",
  "cancelled",
  "error",
] as const;

describe("concierge action use cases", () => {
  it("accepts every production use case created by the Concierge UI", async () => {
    process.env.DATABASE_URL ??= "postgres://postgres:postgres@localhost:5432/postgres";
    const { CONCIERGE_USE_CASES } = await import("./conciergeActions.js");

    expect(CONCIERGE_USE_CASES).toEqual(expect.arrayContaining([...PRODUCTION_USE_CASES]));
  });

  it("keeps schema and migration constraints aligned with production flows", async () => {
    const files = await Promise.all([
      readFile("schema/concierge_layer1.sql", "utf8"),
      readFile("migrations/0065_concierge_use_case_readiness.sql", "utf8"),
    ]);

    for (const content of files) {
      for (const useCase of PRODUCTION_USE_CASES) {
        expect(content).toContain(`'${useCase}'`);
      }
      for (const category of PRODUCTION_PROVIDER_CATEGORIES) {
        expect(content).toContain(`'${category}'`);
      }
    }
  });

  it("keeps completed Concierge outcomes aligned with the follow-up loop", async () => {
    const files = await Promise.all([
      readFile("schema/concierge_layer1.sql", "utf8"),
      readFile("migrations/0066_concierge_outcome_readiness.sql", "utf8"),
    ]);

    for (const content of files) {
      for (const outcome of PRODUCTION_OUTCOMES) {
        expect(content).toContain(`'${outcome}'`);
      }
    }
  });
});
