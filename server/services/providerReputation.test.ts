import { describe, expect, it, vi } from "vitest";

vi.mock("../db.js", () => ({ db: { execute: vi.fn() } }));
import { isShareableVerification, sharedVerification } from "./providerReputation.js";
import type { ProviderVerification } from "../../shared/providerVerification.js";

const now = Date.parse("2026-10-01T00:00:00Z");
const day = 24 * 60 * 60 * 1000;
const result = (overrides: Partial<ProviderVerification> = {}): ProviderVerification => ({
  version: 1, status: "verified", checkedAt: new Date(now).toISOString(), reviewCount: 5, recentReviewCount: 2,
  sources: ["https://example.com/"], gaps: [], concerns: [], retryable: false, ...overrides,
});

describe("shared provider reputation", () => {
  it("never shares outages, configuration gaps or empty audits", () => {
    expect(isShareableVerification(result())).toBe(true);
    expect(isShareableVerification(result({ retryable: true }))).toBe(false);
    expect(isShareableVerification(result({ status: "incomplete", sources: [], reviewCount: 0, recentReviewCount: 0 }))).toBe(false);
  });
  it("keeps verified and concern results for 30 days but incomplete ones for 7", () => {
    expect(sharedVerification(result(), now + 29 * day)).not.toBeNull();
    expect(sharedVerification(result(), now + 30 * day)).toBeNull();
    expect(sharedVerification(result({ status: "concerns", concerns: ["x"] }), now + 20 * day)).not.toBeNull();
    expect(sharedVerification(result({ status: "incomplete" }), now + 6 * day)).not.toBeNull();
    expect(sharedVerification(result({ status: "incomplete" }), now + 7 * day)).toBeNull();
  });
});
