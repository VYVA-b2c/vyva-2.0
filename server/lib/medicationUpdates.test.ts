import { describe, expect, it, vi } from "vitest";
import {
  containsUnsafeMedicationInstruction,
  medicationEvidenceVerification,
  medicationMatchConfidence,
  medicationUpdateFreshness,
  normalizeMedicationFormulation,
} from "../../shared/medicationUpdates";
import {
  buildMedicationUpdates,
  clearMedicationUpdatesCache,
  medicationUpdateSourceHosts,
} from "./medicationUpdates";

type MockSourceOptions = {
  stale?: boolean;
  aempsDocumentUrl?: string;
  mismatched?: boolean;
  brandOnly?: boolean;
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function officialSourceFetcher(options: MockSourceOptions = {}): typeof fetch {
  const productName = options.mismatched ? "Ibuprofen 400 mg" : "Metformin 850 mg EFG";
  const fdaName = options.mismatched ? "Ibuprofen" : "Metformin hydrochloride";
  const compactDate = options.stale ? "20200115" : "20260315";
  const isoDate = options.stale ? "2020-01-20" : "2026-03-20";
  const epochDate = Date.parse(options.stale ? "2020-01-10T00:00:00.000Z" : "2026-03-10T00:00:00.000Z");

  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));

    if (url.hostname === "cima.aemps.es" && url.pathname.endsWith("/medicamentos")) {
      return json({
        resultados: [{
          nregistro: "12345",
          nombre: productName,
          notas: !options.mismatched,
          psum: !options.mismatched,
          pactivos: options.mismatched ? "Ibuprofeno" : "Metformina",
          principiosActivos: [{ nombre: options.mismatched ? "Ibuprofeno" : "Metformina" }],
          formaFarmaceuticaSimplificada: { nombre: "Comprimido" },
          presentaciones: options.mismatched ? [] : [{ cn: "700001", nombre: "Metformin 850 mg 30 comprimidos", psum: true }],
          docs: [{
            tipo: 1,
            fecha: epochDate,
            urlHtml: options.aempsDocumentUrl
              ?? "https://cima.aemps.es/cima/dochtml/ft/12345/FT_12345.html",
          }],
        }],
      });
    }

    if (url.hostname === "cima.aemps.es" && url.pathname.includes("/notas/")) {
      return json([{
        num: "AEMPS-2026-01",
        ref: "Original Spanish safety wording for the exact product.",
        asunto: "Nota de seguridad de metformina",
        fecha: epochDate,
        url: "https://www.aemps.gob.es/informa/notasInformativas/medicamentosUsoHumano/seguridad/2026/nota-metformina.pdf",
      }]);
    }

    if (url.hostname === "cima.aemps.es" && url.pathname.includes("/psuministro/")) {
      return json([{
        cn: "700001",
        nombre: "Metformin 850 mg 30 comprimidos",
        fini: epochDate,
        observ: "Original AEMPS supply wording.",
        activo: true,
      }]);
    }

    if (url.hostname === "api.fda.gov" && url.pathname === "/drug/label.json") {
      if (options.brandOnly && url.searchParams.get("search")?.includes("generic_name")) {
        return json({ error: { message: "No matches found" } }, 404);
      }
      return json({
        results: [{
          id: "fda-label-1",
          set_id: "set-123",
          effective_time: compactDate,
          recent_major_changes: ["Original FDA label wording."],
          openfda: {
            generic_name: [fdaName],
            brand_name: options.mismatched ? ["Advil"] : ["Glucophage"],
            substance_name: [fdaName],
            dosage_form: ["TABLET"],
            manufacturer_name: ["Example manufacturer"],
          },
        }],
      });
    }

    if (url.hostname === "api.fda.gov" && url.pathname === "/drug/enforcement.json") {
      return json({
        results: [{
          recall_number: "D-123-2026",
          reason_for_recall: "Original FDA recall reason.",
          report_date: compactDate,
          status: "Ongoing",
          product_description: `${fdaName} tablets`,
        }],
      });
    }

    if (url.hostname === "eutils.ncbi.nlm.nih.gov" && url.pathname.endsWith("/esearch.fcgi")) {
      return options.mismatched
        ? json({ esearchresult: { idlist: [] } })
        : json({ esearchresult: { idlist: ["999001"] } });
    }

    if (url.hostname === "eutils.ncbi.nlm.nih.gov" && url.pathname.endsWith("/esummary.fcgi")) {
      return json({
        result: {
          uids: ["999001"],
          "999001": {
            uid: "999001",
            title: "Metformin and long-term outcomes: a systematic review",
            pubdate: isoDate,
            sortpubdate: `${isoDate} 00:00`,
            fulljournalname: "Journal of Evidence Reviews",
            pubtype: ["Systematic Review", "Meta-Analysis"],
          },
        },
      });
    }

    return json({ message: "not found" }, 404);
  }) as unknown as typeof fetch;
}

describe("source-backed medication updates", () => {
  it("does not contact external sources when the user has no saved medicines", async () => {
    const fetcher = vi.fn();
    const result = await buildMedicationUpdates([], "en", {
      fetcher: fetcher as unknown as typeof fetch,
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.medications).toEqual([]);
    expect(result.updates).toEqual([]);
    expect(result.sources).toEqual([]);
  });

  it("returns dated, directly linked evidence for every update category", async () => {
    clearMedicationUpdatesCache();
    const result = await buildMedicationUpdates(["Metformin 850 mg"], "en", {
      fetcher: officialSourceFetcher(),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(new Set(result.updates.map((update) => update.kind))).toEqual(
      new Set(["recall", "safety_warning", "availability_change", "general_information"]),
    );
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ authority: "AEMPS", status: "available" }),
      expect.objectContaining({ authority: "FDA", status: "available" }),
      expect.objectContaining({ authority: "PubMed", status: "available" }),
    ]));

    for (const update of result.updates) {
      const sourceUrl = new URL(update.source.url);
      expect(sourceUrl.protocol).toBe("https:");
      expect(medicationUpdateSourceHosts).toContain(sourceUrl.hostname);
      expect(update.source.publishedAt).toMatch(/^2026-/);
      expect(update.source.title.length).toBeGreaterThan(3);
      expect(update.source.publisher.length).toBeGreaterThan(3);
      expect(update.source.jurisdiction.length).toBeGreaterThan(3);
      expect(update.discussionQuestions.length).toBeGreaterThan(0);
      expect(containsUnsafeMedicationInstruction(update.summary)).toBe(false);
      expect(update.discussionQuestions.some(containsUnsafeMedicationInstruction)).toBe(false);
    }

    expect(result.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceExcerpt: "Original Spanish safety wording for the exact product.",
        source: expect.objectContaining({ originalLanguage: "es" }),
      }),
      expect.objectContaining({
        sourceExcerpt: "Original FDA label wording.",
        source: expect.objectContaining({ originalLanguage: "en" }),
      }),
    ]));
  });

  it("verifies an exact Spanish product and formulation while excluding other jurisdictions", async () => {
    const result = await buildMedicationUpdates([{
      medicationName: "Metformin 850 mg",
      activeIngredient: "Metformina",
      doseText: "850 mg tablet",
      countryCode: "ES",
    }], "en", {
      fetcher: officialSourceFetcher(),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(result.countryCode).toBe("ES");
    expect(result.sources.map((source) => source.authority)).toEqual(["AEMPS", "PubMed"]);
    const regulatorUpdates = result.updates.filter((update) => update.source.authority === "AEMPS");
    expect(regulatorUpdates.length).toBeGreaterThanOrEqual(3);
    expect(regulatorUpdates.every((update) => update.verification === "verified")).toBe(true);
    expect(regulatorUpdates.some((update) => update.kind === "availability_change")).toBe(true);
    expect(regulatorUpdates.some((update) => update.sourceExcerpt === "Original AEMPS supply wording.")).toBe(true);
  });

  it("falls back to a brand-name label search when an ingredient label search has no result", async () => {
    const result = await buildMedicationUpdates([{
      medicationName: "Glucophage",
      countryCode: "US",
    }], "en", {
      fetcher: officialSourceFetcher({ brandOnly: true }),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(result.sources.map((source) => source.authority)).toEqual(["FDA", "PubMed"]);
    expect(result.updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        medicationName: "Glucophage",
        kind: "general_information",
        verification: "verified",
        match: expect.objectContaining({ confidence: "exact", matchedName: "Metformin hydrochloride" }),
        source: expect.objectContaining({ authority: "FDA" }),
      }),
    ]));
  });

  it("marks old records as stale instead of presenting them as current", async () => {
    const result = await buildMedicationUpdates(["Metformin"], "en", {
      fetcher: officialSourceFetcher({ stale: true }),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(result.updates.length).toBeGreaterThan(0);
    expect(result.updates.every((update) => update.freshness === "stale")).toBe(true);
    expect(result.updates.every((update) => update.verification === "not_verified")).toBe(true);
    expect(result.updates.every((update) => update.verificationReasons.includes("stale_source"))).toBe(true);
    expect(medicationUpdateFreshness(null)).toBe("unknown");
  });

  it("marks non-exact, mismatched-country, and unconfirmed-formulation evidence as not verified", () => {
    expect(medicationEvidenceVerification({
      matchConfidence: "possible",
      freshness: "current",
      countryMatches: false,
      countryKnown: true,
      requestedFormulation: "tablet",
      matchedFormulation: null,
    })).toEqual({
      verification: "not_verified",
      reasons: ["possible_match", "jurisdiction_mismatch", "formulation_unconfirmed"],
    });
    expect(normalizeMedicationFormulation("850 mg comprimido")).toBe("tablet");
  });

  it("rejects unrelated product records and untrusted source links", async () => {
    const mismatch = await buildMedicationUpdates(["Metformin"], "en", {
      fetcher: officialSourceFetcher({ mismatched: true }),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });
    expect(mismatch.updates).toEqual([]);
    expect(medicationMatchConfidence("Metformin", ["Ibuprofen tablets"])).toBeNull();

    const untrusted = await buildMedicationUpdates(["Metformin"], "en", {
      fetcher: officialSourceFetcher({ aempsDocumentUrl: "https://example.com/unverified-label" }),
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });
    expect(untrusted.updates.some((update) => update.source.url.includes("example.com"))).toBe(false);
  });

  it("reports source outages honestly without generating an update", async () => {
    const failingFetcher = vi.fn(async () => {
      throw new Error("network unavailable");
    }) as unknown as typeof fetch;

    const result = await buildMedicationUpdates(["Metformin"], "en", {
      fetcher: failingFetcher,
      now: new Date("2026-07-17T10:00:00.000Z"),
      useCache: false,
    });

    expect(result.updates).toEqual([]);
    expect(result.sources.every((source) => source.status === "unavailable")).toBe(true);
    expect(result.sources.every((source) => source.message.includes("could not be checked"))).toBe(true);
  });

  it("localizes summaries and clinician questions in every app language without dosing instructions", async () => {
    const languages = ["en", "es", "fr", "de", "it", "pt"] as const;
    const summaries = new Map<string, string>();
    const sourceTitles = new Set<string>();

    for (const language of languages) {
      const result = await buildMedicationUpdates(["Metformin"], language, {
        fetcher: officialSourceFetcher(),
        now: new Date("2026-07-17T10:00:00.000Z"),
        useCache: false,
      });
      expect(result.language).toBe(language);
      expect(result.updates.length).toBeGreaterThan(0);
      expect(result.updates.every((update) => update.source.originalLanguage === "en" || update.source.originalLanguage === "es")).toBe(true);
      expect(result.updates.every((update) => !containsUnsafeMedicationInstruction(update.summary))).toBe(true);
      expect(result.updates.flatMap((update) => update.discussionQuestions).every((question) => !containsUnsafeMedicationInstruction(question))).toBe(true);
      summaries.set(language, result.updates[0].summary);
      sourceTitles.add(result.updates[0].source.title);
    }

    expect(new Set(summaries.values()).size).toBe(languages.length);
    expect(sourceTitles.size).toBe(1);
  });
});
