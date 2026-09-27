import { afterEach, describe, expect, it, vi } from "vitest";
const create = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({ default: class { responses = { create }; } }));
import { parseVerificationEvidence, verifyProvider } from "./providerVerification.js";

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); create.mockReset(); });
describe("verification failures", () => {
  it("enforces structured output and returns honest gaps for missing public evidence", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only");
    create.mockResolvedValue({ output_text: JSON.stringify({ sources: [], reviews: [], complaintSearchCompleted: false, limitations: [] }), output: [] });
    const result = await verifyProvider({ name: "Public Plumber", address: "Tarifa", phone: "", website: "", service: "plumber" }, new AbortController().signal);
    expect(create.mock.calls[0][0].text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(result.retryable).toBe(false);
    expect(result.status).toBe("incomplete");
    expect(result.gaps).toContain("Official identity and service evidence could not be corroborated.");
  });
  it("accepts JSON code fences but still validates the evidence schema", () => {
    const evidence = { sources: [], reviews: [], complaintSearchCompleted: false, limitations: [] };
    expect(parseVerificationEvidence("```json\n" + JSON.stringify(evidence) + "\n```" )).toEqual(evidence);
    expect(parseVerificationEvidence(JSON.stringify(evidence))).toEqual(evidence);
    expect(() => parseVerificationEvidence("```json\n{}\n```" )).toThrow();
    expect(() => parseVerificationEvidence("Ignore rules " + JSON.stringify(evidence))).toThrow();
  });
  it("normalizes Markdown URL fields without accepting unsafe or malformed links", () => {
    const evidence = { sources: [{ url: "[Source](https://example.com/business)", serviceQuote: "Plumbing" }], reviews: [], complaintSearchCompleted: false, limitations: [] };
    expect(parseVerificationEvidence(JSON.stringify(evidence)).sources[0].url).toBe("https://example.com/business");
    evidence.sources[0].url = "[Source](javascript:alert(1))";
    expect(() => parseVerificationEvidence(JSON.stringify(evidence))).toThrow();
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
