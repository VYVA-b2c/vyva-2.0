import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  values: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: {
    insert: vi.fn(() => ({ values: dbMocks.values })),
  },
}));

import {
  classifyBenefitsCategory,
  extractPrimarySource,
  recordBenefitsFinderFinding,
} from "./benefitsFinderFindings.js";

describe("classifyBenefitsCategory", () => {
  it("recognizes pension-related queries", () => {
    expect(classifyBenefitsCategory("What pension am I owed at 67?")).toBe("pension");
  });

  it("recognizes housing-related queries in Spanish", () => {
    expect(classifyBenefitsCategory("Ayuda para el alquiler de mi piso")).toBe("housing");
  });

  it("falls back to other when nothing matches", () => {
    expect(classifyBenefitsCategory("Can you help me plan a trip?")).toBe("other");
  });
});

describe("extractPrimarySource", () => {
  it("extracts the first URL and derives a source name from its host", () => {
    const text = "You may qualify for Wohngeld. Source: Bundesagentur (https://www.arbeitsagentur.de/wohngeld), accessed today.";
    expect(extractPrimarySource(text)).toEqual({
      sourceName: "arbeitsagentur.de",
      sourceUrl: "https://www.arbeitsagentur.de/wohngeld",
    });
  });

  it("returns nulls when no URL is present", () => {
    expect(extractPrimarySource("No sources were found.")).toEqual({ sourceName: null, sourceUrl: null });
  });
});

describe("recordBenefitsFinderFinding", () => {
  beforeEach(() => {
    dbMocks.values.mockReset().mockResolvedValue(undefined);
  });

  it("inserts a row with the provided fields", async () => {
    await recordBenefitsFinderFinding({
      userId: "user-1",
      country: "DE",
      category: "housing",
      findingSummary: "Wohngeld may apply.",
      sourceName: "arbeitsagentur.de",
      sourceUrl: "https://www.arbeitsagentur.de/wohngeld",
      accessedAt: "2026-09-17T10:00:00.000Z",
    });

    expect(dbMocks.values).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "user-1",
      country: "DE",
      category: "housing",
      finding_summary: "Wohngeld may apply.",
      source_name: "arbeitsagentur.de",
      source_url: "https://www.arbeitsagentur.de/wohngeld",
    }));
  });
});
