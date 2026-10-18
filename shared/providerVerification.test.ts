import { describe, expect, it } from "vitest";
import { classifyConcernLevel, currentVerification, type ProviderConcernDetail, type ProviderVerification } from "./providerVerification";

describe("currentVerification", () => {
  const now = Date.parse("2026-09-27T09:00:00Z");
  const result: ProviderVerification = {
    version: 1, status: "incomplete", checkedAt: new Date(now).toISOString(),
    reviewCount: 0, recentReviewCount: 0, sources: [], gaps: ["Insufficient evidence"],
    concerns: [], retryable: true,
  };
  it("accepts a fresh server response when the browser clock is slightly behind", () => {
    expect(currentVerification(result, now - 2000)).toEqual(result);
  });
  it("rejects timestamps beyond the clock-skew allowance", () => {
    expect(currentVerification(result, now - 300001)).toBeNull();
  });
  it("keeps shared results for 30 days, then expires them", () => {
    expect(currentVerification(result, now + 29 * 86400000)).toEqual(result);
    expect(currentVerification(result, now + 30 * 86400000)).toBeNull();
  });
  it("rejects unknown concern categories", () => {
    expect(currentVerification({ ...result, concernDetails: [{ category: "rumour", summary: "x", date: "2026-01-01" }] }, now)).toBeNull();
    expect(currentVerification({ ...result, concernDetails: [{ category: "pricing", summary: "x", date: "2026-01-01" }], concernLevel: "isolated" }, now)).not.toBeNull();
  });
  it("still rejects malformed evidence", () => {
    expect(currentVerification({ ...result, recentReviewCount: 1 }, now)).toBeNull();
    expect(currentVerification({ ...result, checkedAt: "invalid" }, now)).toBeNull();
  });
});

describe("classifyConcernLevel", () => {
  const detail = (category: ProviderConcernDetail["category"]): ProviderConcernDetail => ({ category, summary: "Reviewer reports an issue.", date: "2026-03-01" });
  it("separates one-off issues from patterns and serious allegations", () => {
    expect(classifyConcernLevel([])).toBe("none");
    expect(classifyConcernLevel([detail("reliability")])).toBe("isolated");
    expect(classifyConcernLevel([detail("reliability"), detail("pricing")])).toBe("isolated");
    expect(classifyConcernLevel([detail("pricing"), detail("pricing")])).toBe("pattern");
    expect(classifyConcernLevel([detail("unclassified")])).toBe("pattern");
    expect(classifyConcernLevel([detail("quality"), detail("fraud")])).toBe("serious");
    expect(classifyConcernLevel([detail("safety")])).toBe("serious");
  });
});
