import { describe, it, expect } from "vitest";
import { evaluateVerification, type VerificationEvidence } from "./providerVerification.js";

const now = new Date("2026-09-26T12:00:00Z");
const candidate = { name: "Example Plumbing", address: "123 Example Street Madrid", phone: "", website: "https://example.com", service: "plumber" };
function fixture() {
  const evidence: VerificationEvidence = {
    sources: [{ url: "https://example.com/", serviceQuote: "We provide plumbing repairs in Madrid." }],
    reviews: Array.from({ length: 5 }, (_, i) => ({ url: "https://reviews.example.org/business", date: `2026-01-0${i + 1}`, dateQuote: `2026-01-0${i + 1}`, quote: `The plumbing repair was completed carefully on visit number ${i}.`, concern: "" })),
    complaintSearchCompleted: true, limitations: [],
  };
  const identity = `${candidate.name} ${candidate.address}`;
  const pages = new Map([
    [evidence.sources[0].url, `${identity} ${evidence.sources[0].serviceQuote}`],
    [evidence.reviews[0].url, `${identity} ${evidence.reviews.map(r => `${r.dateQuote} ${r.quote}`).join(" ")}`],
  ]);
  return { evidence, pages, searched: new Set(pages.keys()) };
}
describe("provider verification policy", () => {
  it("requires corroborated identity, service, five reviews and recent coverage", () => {
    const f = fixture();
    expect(evaluateVerification(candidate, f.evidence, f.pages, f.searched, now).status).toBe("verified");
  });
  it.each(["identity", "quotes", "sources", "recent", "duplicates", "complaints", "limitations"])("does not verify missing %s", missing => {
    const f = fixture();
    if (missing === "identity") f.pages.set(f.evidence.reviews[0].url, "Other business");
    if (missing === "quotes") f.evidence.reviews[0].quote = "This quote was invented and is not on the page.";
    if (missing === "sources") f.searched.clear();
    if (missing === "recent") f.evidence.reviews.forEach(r => { r.date = "2020-01-01"; r.dateQuote = "2020-01-01"; });
    if (missing === "duplicates") f.evidence.reviews[0] = f.evidence.reviews[1];
    if (missing === "complaints") f.evidence.complaintSearchCompleted = false;
    if (missing === "limitations") f.evidence.limitations = ["Identity ambiguity"];
    expect(evaluateVerification(candidate, f.evidence, f.pages, f.searched, now).status).toBe("incomplete");
  });
  it("surfaces a supported concern without awarding verification", () => {
    const f = fixture();
    f.evidence.reviews[0].concern = "Reviewer reports a concern requiring review.";
    expect(evaluateVerification(candidate, f.evidence, f.pages, f.searched, now).status).toBe("concerns");
  });
});
