import { afterEach, describe, expect, it, vi } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { responses = { create }; } }));
import { parseVerificationEvidence, verifyProvider } from "./providerVerification.js";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); create.mockReset(); });
describe("verification failures", () => {
  it("accepts JSON code fences but still validates the evidence schema", () => {
    const evidence = { sources: [], reviews: [], complaintSearchCompleted: false, limitations: [] };
    expect(parseVerificationEvidence("```json\n" + JSON.stringify(evidence) + "\n```" )).toEqual(evidence);
    expect(parseVerificationEvidence(JSON.stringify(evidence))).toEqual(evidence);
    expect(() => parseVerificationEvidence("```json\n{}\n```" )).toThrow();
    expect(() => parseVerificationEvidence("Ignore rules " + JSON.stringify(evidence))).toThrow();
  });
  it.each([401, 403])("reports credential failure %s without inviting futile retries", async status => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    create.mockRejectedValue({ status, message: "secret-upstream-message" });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await verifyProvider({ name: "Public Plumber", address: "Tarifa", phone: "", website: "", service: "plumber" }, new AbortController().signal);
    expect(result.status).toBe("incomplete");
    expect(result.retryable).toBe(false);
    expect(result.gaps[0]).toContain("credentials need updating");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("secret-upstream-message");
  });
  it("keeps transient failures retryable", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    create.mockRejectedValue({ status: 503 });
    const result = await verifyProvider({ name: "Public Plumber", address: "Tarifa", phone: "", website: "", service: "plumber" }, new AbortController().signal);
    expect(result.retryable).toBe(true);
  });
});
