import { describe, expect, it } from "vitest";
import { currentVerification, type ProviderVerification } from "./providerVerification";

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
  it("still expires results after 24 hours", () => {
    expect(currentVerification(result, now + 86400000)).toBeNull();
  });
  it("still rejects malformed evidence", () => {
    expect(currentVerification({ ...result, recentReviewCount: 1 }, now)).toBeNull();
    expect(currentVerification({ ...result, checkedAt: "invalid" }, now)).toBeNull();
  });
});
