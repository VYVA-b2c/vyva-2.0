import { describe, expect, it } from "vitest";
import type { EvidenceItem } from "./expertCare";
import { filterSafeExpertCareEvidence, validateExpertCareEvidenceItem } from "./expertCareEvidenceSafety";

const safe: EvidenceItem = {
  id: "safe-1", evidenceType: "peer_reviewed_clinical_evidence", title: "Study", whatChanged: "A study was published.", whyItMayMatter: "A specialist can assess relevance.", askTheSpecialist: "Does this apply?", jurisdiction: "International", publishedAt: "2026-01-01", limitations: "Not individual advice.", experimental: false, evidenceStatus: "published", freshnessStatus: "current", retrievedAt: "2026-10-19T00:00:00Z", citations: [{ id: "1", label: "PubMed 1", url: "https://pubmed.ncbi.nlm.nih.gov/1/", source: "Europe PMC" }],
};

describe("Expert Care evidence safety", () => {
  it("accepts attributable educational evidence", () => {
    expect(validateExpertCareEvidenceItem(safe)).toEqual([]);
  });

  it("rejects personalized treatment and trial eligibility claims", () => {
    const personalized = { ...safe, id: "bad-1", whyItMayMatter: "You should stop taking this medicine and you qualify for the trial." };
    expect(validateExpertCareEvidenceItem(personalized)).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "personalized_clinical_claim" })]));
    expect(validateExpertCareEvidenceItem({ ...safe, id: "bad-es", whyItMayMatter: "Debes suspender este medicamento porque eres elegible para el ensayo." })).toEqual(expect.arrayContaining([expect.objectContaining({ reason: "personalized_clinical_claim" })]));
  });

  it("rejects unofficial citations and experimental evidence disguised as standard care", () => {
    const bad = { ...safe, id: "bad-2", evidenceType: "early_phase_trial" as const, experimental: false, citations: [{ ...safe.citations[0], url: "https://example.com/claim" }] };
    const result = filterSafeExpertCareEvidence([safe, bad]);
    expect(result.items).toEqual([safe]);
    expect(result.violations.map((violation) => violation.reason)).toEqual(expect.arrayContaining(["unofficial_citation", "experimental_misclassified"]));
  });
});
