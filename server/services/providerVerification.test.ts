import { describe, it, expect } from "vitest";
import { evaluateVerification, parseVerificationEvidence, type VerificationEvidence } from "./providerVerification.js";
import { HOME_SERVICE_SEARCH_TERMS } from "../../shared/homeServiceSearch.js";

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
  it.each(Object.entries(HOME_SERVICE_SEARCH_TERMS).flatMap(([language, terms]) =>
    Object.entries(terms).map(([service, term]) => ({ language, service, term }))))("accepts corroborated $language evidence for $service", ({ service, term }) => {
    const f = fixture();
    f.evidence.sources[0].serviceQuote = `Service: ${term}. Available services listed here.`;
    f.pages.set(f.evidence.sources[0].url, `${candidate.name} ${candidate.address} ${f.evidence.sources[0].serviceQuote}`);
    expect(evaluateVerification({ ...candidate, service }, f.evidence, f.pages, f.searched, now).status).toBe("verified");
  });
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
  it("keeps a single minor complaint as a caveat on an otherwise verified provider", () => {
    const f = fixture();
    f.evidence.reviews[0] = { ...f.evidence.reviews[0], concern: "Reviewer says the visit started late.", concernCategory: "reliability" };
    const result = evaluateVerification(candidate, f.evidence, f.pages, f.searched, now);
    expect(result.status).toBe("verified");
    expect(result.concernLevel).toBe("isolated");
    expect(result.concerns).toEqual(["Reviewer says the visit started late."]);
  });
  it("flags repeated complaints in one category as a pattern", () => {
    const f = fixture();
    for (const i of [0, 1]) f.evidence.reviews[i] = { ...f.evidence.reviews[i], concern: `Reviewer alleges the final bill exceeded the quote (${i}).`, concernCategory: "pricing" };
    const result = evaluateVerification(candidate, f.evidence, f.pages, f.searched, now);
    expect(result.status).toBe("concerns");
    expect(result.concernLevel).toBe("pattern");
  });
  it("treats one fraud or safety allegation as serious", () => {
    const f = fixture();
    f.evidence.reviews[0] = { ...f.evidence.reviews[0], concern: "Reviewer alleges an older customer was charged for work not done.", concernCategory: "fraud" };
    const result = evaluateVerification(candidate, f.evidence, f.pages, f.searched, now);
    expect(result.status).toBe("concerns");
    expect(result.concernLevel).toBe("serious");
    expect(result.concernDetails?.[0].category).toBe("fraud");
  });
  it("never lets an unknown category label soften a concern", () => {
    const parsed = parseVerificationEvidence(JSON.stringify({
      sources: [], complaintSearchCompleted: true, limitations: [],
      reviews: [{ url: "https://reviews.example.org/a", date: "2026-01-01", dateQuote: "2026-01-01", quote: "A review quote that is long enough to be kept here.", concern: "Reviewer reports a problem.", concernCategory: "minor" }],
    }));
    expect(parsed.reviews).toHaveLength(1);
    expect(parsed.reviews[0].concernCategory).toBeUndefined();
  });
  it("keeps only corroborated price and credential text, and counts review price signals", () => {
    const f = fixture();
    const priceQuote = "Call-out fee 35 EUR within the city.";
    const credentialQuote = "Registered installation company no. 12345.";
    f.evidence.sources[0] = { ...f.evidence.sources[0], priceQuote, credentialQuote };
    f.evidence.sources.push({ url: "https://reviews.example.org/business", serviceQuote: "", priceQuote: "Invented price 10 EUR here.", credentialQuote: "Invented registration claim text." });
    f.pages.set(f.evidence.sources[0].url, `${f.pages.get(f.evidence.sources[0].url)} ${priceQuote} ${credentialQuote}`);
    f.evidence.reviews[0].priceSignal = "as_quoted";
    f.evidence.reviews[1].priceSignal = "as_quoted";
    f.evidence.reviews[2].priceSignal = "expensive";
    const result = evaluateVerification(candidate, f.evidence, f.pages, f.searched, now);
    expect(result.pricing?.publishedPrices).toEqual([priceQuote]);
    expect(result.pricing?.signals).toEqual({ as_quoted: 2, above_quote: 0, good_value: 0, expensive: 1 });
    expect(result.credentials).toEqual([credentialQuote]);
  });
  it("ignores published prices from third-party pages and text without a figure", () => {
    const f = fixture();
    f.evidence.sources[0].priceQuote = "We always offer very fair prices.";
    f.pages.set(f.evidence.sources[0].url, `${f.pages.get(f.evidence.sources[0].url)} We always offer very fair prices.`);
    expect(evaluateVerification(candidate, f.evidence, f.pages, f.searched, now).pricing?.publishedPrices).toEqual([]);
  });
  it("keeps stated languages only from a corroborated quote on the provider's own site", () => {
    const f = fixture();
    const languageQuote = "We speak English, German and Spanish.";
    f.evidence.sources[0] = { ...f.evidence.sources[0], languageQuote, languageCodes: ["en", "DE", "es", "english"] };
    f.evidence.sources.push({ url: "https://reviews.example.org/business", serviceQuote: "", languageQuote: "The owner speaks perfect French.", languageCodes: ["fr"] });
    f.pages.set(f.evidence.sources[0].url, `${f.pages.get(f.evidence.sources[0].url)} ${languageQuote}`);
    expect(evaluateVerification(candidate, f.evidence, f.pages, f.searched, now).languages).toEqual(["en", "de", "es"]);
  });
});
