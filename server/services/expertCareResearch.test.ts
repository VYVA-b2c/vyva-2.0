import { afterEach, describe, expect, it, vi } from "vitest";
import { researchExpertCareEvidence } from "./expertCareResearch";

afterEach(() => {
  vi.restoreAllMocks();
  for (const source of ["EMA", "CTIS", "NICE", "PROFESSIONAL_SOCIETY"]) {
    delete process.env[`EXPERT_CARE_${source}_CONNECTOR_URL`];
    delete process.env[`EXPERT_CARE_${source}_CONNECTOR_TOKEN`];
  }
});

describe("Expert Care authoritative research", () => {
  it("separates peer-reviewed evidence from experimental trials and keeps citations", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("europepmc")) return new Response(JSON.stringify({ resultList: { result: [{ title: "Recent evidence", pmid: "12345", firstPublicationDate: "2026-01-10" }] } }), { status: 200 });
      return new Response(JSON.stringify({ studies: [{ protocolSection: { identificationModule: { nctId: "NCT00001", briefTitle: "Phase 2 study" }, designModule: { phases: ["PHASE2"] }, statusModule: { studyFirstPostDateStruct: { date: "2025-06-01" } } } }] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("neurology treatment");
    expect(result.educationalOnly).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items.find((item) => !item.experimental)?.citations[0].url).toContain("pubmed.ncbi.nlm.nih.gov");
    expect(result.items.find((item) => item.experimental)?.limitations).toContain("not assessed eligibility");
    expect(result.safetyNotices).toEqual(expect.arrayContaining([expect.stringContaining("Sources may differ")]));
  });

  it("fails partially when one authoritative source is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("europepmc")) throw new Error("offline");
      return new Response(JSON.stringify({ studies: [] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("oncology");
    expect(result.unavailableSources).toEqual(expect.arrayContaining(["Europe PMC", "EU CTIS", "EMA", "NICE", "Professional society"]));
    expect(result.items).toEqual([]);
  });

  it("adds only attributable FDA and WHO claims and reports gated sources explicitly", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("europepmc")) return new Response(JSON.stringify({ resultList: { result: [] } }), { status: 200 });
      if (url.includes("clinicaltrials.gov")) return new Response(JSON.stringify({ studies: [] }), { status: 200 });
      if (url.includes("api.fda.gov")) return new Response(JSON.stringify({ results: [{ id: "label-1", effective_time: "20260901", openfda: { brand_name: ["Neuro medicine"], application_number: ["NDA123456"] } }] }), { status: 200 });
      return new Response(JSON.stringify({ value: [{ SystemSourceKey: "who-1", PublicationDate: "2026-08-01T00:00:00Z", Title: "Neurology recommendation", Body: "Updated neurology care", IRISID: "who-1", ItemDefaultUrl: "https://www.who.int/publications/i/item/who-1" }] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("neurology");
    expect(result.items.map((item) => item.citations[0].source)).toEqual(["FDA", "WHO"]);
    expect(result.sourceStatuses).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "FDA", status: "available" }),
      expect.objectContaining({ source: "EMA", status: "configuration_required" }),
    ]));
  });

  it("preempts medication-change and trial-eligibility requests in both launch languages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ resultList: { result: [] }, studies: [], value: [] }), { status: 200 }));
    const english = await researchExpertCareEvidence("Should I stop my medication and do I qualify for this trial?", "en");
    expect(english.safetyNotices).toEqual(expect.arrayContaining([expect.stringContaining("Do not stop"), expect.stringContaining("cannot determine trial eligibility")]));

    const spanish = await researchExpertCareEvidence("¿Debo suspender mi medicación y soy elegible para este ensayo?", "es");
    expect(spanish.safetyNotices).toEqual(expect.arrayContaining([expect.stringContaining("No suspendas"), expect.stringContaining("no puede determinar la elegibilidad")]));
  });

  it("marks older evidence as stale instead of presenting it as current", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("europepmc")) return new Response(JSON.stringify({ resultList: { result: [{ title: "Older evidence", pmid: "999", firstPublicationDate: "2017-01-10" }] } }), { status: 200 });
      return new Response(JSON.stringify({ studies: [], value: [] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("neurology");
    expect(result.items[0]).toMatchObject({ freshnessStatus: "stale", publishedAt: "2017-01-10" });
  });

  it("uses a configured authoritative connector only through its strict normalized contract", async () => {
    process.env.EXPERT_CARE_EMA_CONNECTOR_URL = "https://connector.example.test/ema";
    process.env.EXPERT_CARE_EMA_CONNECTOR_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("connector.example.test/ema")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer test-token");
        return new Response(JSON.stringify({ items: [{ sourceId: "EMA-1", title: "Authorised medicine update", evidenceType: "regulatory_approval", whatChanged: "The authorised product information was updated.", whyItMayMatter: "A specialist can compare the European regulatory context with local care.", askTheSpecialist: "Does this regulatory update affect our discussion?", jurisdiction: "European Union", publishedAt: "2026-09-01", limitations: "Authorisation does not show individual suitability or local availability.", evidenceStatus: "approved", citationLabel: "EMA product information", citationUrl: "https://www.ema.europa.eu/en/medicines/human/EPAR/example" }] }), { status: 200 });
      }
      if (url.includes("europepmc")) return new Response(JSON.stringify({ resultList: { result: [] } }), { status: 200 });
      if (url.includes("clinicaltrials.gov")) return new Response(JSON.stringify({ studies: [] }), { status: 200 });
      if (url.includes("api.fda.gov")) return new Response(JSON.stringify({ results: [] }), { status: 200 });
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("oncology", "en");
    expect(result.items).toEqual([expect.objectContaining({ evidenceType: "regulatory_approval", experimental: false, citations: [expect.objectContaining({ source: "EMA" })] })]);
    expect(result.sourceStatuses).toEqual(expect.arrayContaining([expect.objectContaining({ source: "EMA", status: "available" })]));
  });

  it("rejects connector evidence with an unofficial citation before display", async () => {
    process.env.EXPERT_CARE_EMA_CONNECTOR_URL = "https://connector.example.test/ema";
    process.env.EXPERT_CARE_EMA_CONNECTOR_TOKEN = "test-token";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("connector.example.test/ema")) return new Response(JSON.stringify({ items: [{ sourceId: "bad-1", title: "Untrusted summary", evidenceType: "regulatory_approval", whatChanged: "A claim changed.", whyItMayMatter: "It may matter.", askTheSpecialist: "Does it apply?", jurisdiction: "EU", publishedAt: "2026-09-01", limitations: "This needs clinical interpretation.", evidenceStatus: "approved", citationLabel: "Blog", citationUrl: "https://example.com/blog" }] }), { status: 200 });
      if (url.includes("europepmc")) return new Response(JSON.stringify({ resultList: { result: [] } }), { status: 200 });
      if (url.includes("clinicaltrials.gov")) return new Response(JSON.stringify({ studies: [] }), { status: 200 });
      if (url.includes("api.fda.gov")) return new Response(JSON.stringify({ results: [] }), { status: 200 });
      return new Response(JSON.stringify({ value: [] }), { status: 200 });
    });
    const result = await researchExpertCareEvidence("oncology", "en");
    expect(result.items).toEqual([]);
    expect(result.safetyRejectedCount).toBe(1);
    expect(result.safetyRejectionReasons).toContain("unofficial_citation");
  });
});
