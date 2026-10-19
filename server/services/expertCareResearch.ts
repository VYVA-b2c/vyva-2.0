import { createHash } from "node:crypto";
import { z } from "zod";
import type { EvidenceItem, ExpertCareResearchResponse } from "../../shared/expertCare.js";
import { filterSafeExpertCareEvidence } from "../../shared/expertCareEvidenceSafety.js";

const safeText = (value: unknown) => typeof value === "string" ? value.trim() : "";
const safeArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const safeRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const stripMarkup = (value: string) => value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const stableId = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 18);
const freshness = (date: string | null): EvidenceItem["freshnessStatus"] => {
  if (!date) return "unknown";
  const year = Number(date.slice(0, 4));
  if (!Number.isFinite(year)) return "unknown";
  return new Date().getUTCFullYear() - year <= 5 ? "current" : "stale";
};

class ConnectorConfigurationRequiredError extends Error {}

const configuredEvidenceSchema = z.object({
  sourceId: z.string().trim().min(1).max(300),
  title: z.string().trim().min(3).max(600),
  evidenceType: z.enum(["guideline_supported_care", "regulatory_approval", "guideline_update", "peer_reviewed_clinical_evidence", "late_phase_trial", "early_phase_trial", "preclinical_research"]),
  whatChanged: z.string().trim().min(3).max(2000),
  whyItMayMatter: z.string().trim().min(3).max(2000),
  askTheSpecialist: z.string().trim().min(3).max(1000),
  jurisdiction: z.string().trim().min(2).max(200),
  publishedAt: z.string().trim().max(40).nullable(),
  limitations: z.string().trim().min(3).max(2000),
  evidenceStatus: z.enum(["published", "registered", "approved", "guideline", "unknown"]),
  citationLabel: z.string().trim().min(1).max(300),
  citationUrl: z.string().url().max(2000),
}).strict();

const configuredResponseSchema = z.object({ items: z.array(configuredEvidenceSchema).max(20) }).strict();
type ConfiguredSource = "EU CTIS" | "EMA" | "NICE" | "Professional society";
const CONNECTOR_ENV: Record<ConfiguredSource, { url: string; token: string; types: EvidenceItem["evidenceType"][] }> = {
  "EU CTIS": { url: "EXPERT_CARE_CTIS_CONNECTOR_URL", token: "EXPERT_CARE_CTIS_CONNECTOR_TOKEN", types: ["late_phase_trial", "early_phase_trial"] },
  EMA: { url: "EXPERT_CARE_EMA_CONNECTOR_URL", token: "EXPERT_CARE_EMA_CONNECTOR_TOKEN", types: ["regulatory_approval"] },
  NICE: { url: "EXPERT_CARE_NICE_CONNECTOR_URL", token: "EXPERT_CARE_NICE_CONNECTOR_TOKEN", types: ["guideline_supported_care", "guideline_update"] },
  "Professional society": { url: "EXPERT_CARE_PROFESSIONAL_SOCIETY_CONNECTOR_URL", token: "EXPERT_CARE_PROFESSIONAL_SOCIETY_CONNECTOR_TOKEN", types: ["guideline_supported_care", "guideline_update", "peer_reviewed_clinical_evidence"] },
};

async function configuredSourceItems(source: ConfiguredSource, query: string, language: "en" | "es", retrievedAt: string): Promise<EvidenceItem[]> {
  const spec = CONNECTOR_ENV[source];
  const url = process.env[spec.url]?.trim();
  const token = process.env[spec.token]?.trim();
  if (!url || !token) throw new ConnectorConfigurationRequiredError(`${source}_configuration_required`);
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== "https:") throw new Error(`${source}_connector_must_use_https`);
  const response = await fetch(parsedUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, language, limit: 4 }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`${source}_connector_unavailable`);
  const body = configuredResponseSchema.parse(await response.json());
  return body.items.flatMap((item) => {
    if (!spec.types.includes(item.evidenceType)) return [];
    const experimental = ["late_phase_trial", "early_phase_trial", "preclinical_research"].includes(item.evidenceType);
    return [{
      id: `evidence-${stableId(`${source}:${item.sourceId}`)}`,
      evidenceType: item.evidenceType,
      title: item.title,
      whatChanged: item.whatChanged,
      whyItMayMatter: item.whyItMayMatter,
      askTheSpecialist: item.askTheSpecialist,
      jurisdiction: item.jurisdiction,
      publishedAt: item.publishedAt,
      limitations: item.limitations,
      experimental,
      evidenceStatus: item.evidenceStatus,
      freshnessStatus: freshness(item.publishedAt),
      retrievedAt,
      citations: [{ id: item.sourceId, label: item.citationLabel, url: item.citationUrl, source }],
    }];
  });
}

async function europePmcItems(query: string, retrievedAt: string): Promise<EvidenceItem[]> {
  const year = new Date().getUTCFullYear();
  const params = new URLSearchParams({
    query: `(${query}) AND FIRST_PDATE:[${year - 3} TO ${year}]`,
    format: "json",
    pageSize: "4",
    sort: "CITED desc",
  });
  const response = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("europe_pmc_unavailable");
  const body = await response.json() as { resultList?: { result?: Array<Record<string, unknown>> } };
  return (body.resultList?.result ?? []).flatMap((row) => {
    const title = safeText(row.title);
    const pmid = safeText(row.pmid);
    const doi = safeText(row.doi);
    const sourceId = pmid || doi;
    if (!title || !sourceId) return [];
    const date = safeText(row.firstPublicationDate) || safeText(row.journalInfo) || null;
    const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/` : `https://doi.org/${encodeURIComponent(doi)}`;
    const publishedAt = date;
    return [{
      id: `evidence-${stableId(`epmc:${sourceId}`)}`,
      evidenceType: "peer_reviewed_clinical_evidence" as const,
      title,
      whatChanged: "A recent peer-reviewed publication may add context to this topic.",
      whyItMayMatter: "It can help a specialist explain whether the finding changes established care or remains preliminary.",
      askTheSpecialist: "Does this evidence apply to my situation, and would it change any part of the current plan?",
      jurisdiction: "International literature",
      publishedAt,
      limitations: "A publication is not proof that a treatment is appropriate for an individual. Study design and applicability require clinical review.",
      experimental: false,
      evidenceStatus: "published" as const,
      freshnessStatus: freshness(publishedAt),
      retrievedAt,
      citations: [{ id: sourceId, label: pmid ? `PubMed ${pmid}` : `DOI ${doi}`, url, source: "Europe PMC" as const }],
    }];
  });
}

async function trialItems(query: string, retrievedAt: string): Promise<EvidenceItem[]> {
  const params = new URLSearchParams({ "query.cond": query, pageSize: "4", format: "json" });
  const response = await fetch(`https://clinicaltrials.gov/api/v2/studies?${params}`, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("clinical_trials_unavailable");
  const body = await response.json() as { studies?: unknown[] };
  return (body.studies ?? []).flatMap((study) => {
    const protocol = safeRecord(safeRecord(study).protocolSection);
    const identification = safeRecord(protocol.identificationModule);
    const design = safeRecord(protocol.designModule);
    const status = safeRecord(protocol.statusModule);
    const id = safeText(identification.nctId);
    const title = safeText(identification.briefTitle);
    if (!id || !title) return [];
    const phases = safeArray(design.phases).map(String);
    const late = phases.some((phase: string) => /PHASE3|PHASE4/i.test(phase));
    const publishedAt = safeText(safeRecord(status.studyFirstPostDateStruct).date) || null;
    return [{
      id: `evidence-${stableId(`ctg:${id}`)}`,
      evidenceType: late ? "late_phase_trial" as const : "early_phase_trial" as const,
      title,
      whatChanged: `An ${late ? "later" : "early"}-phase registered study is investigating this area.`,
      whyItMayMatter: "It may be useful to discuss with a specialist when reviewing research options; registration does not mean the study is suitable or available.",
      askTheSpecialist: "Is this study relevant enough to discuss, and what eligibility or safety questions should we clarify?",
      jurisdiction: "Trial locations vary",
      publishedAt,
      limitations: "VYVA has not assessed eligibility. Trial status, locations, and criteria must be confirmed with the official registry and study team.",
      experimental: true,
      evidenceStatus: "registered" as const,
      freshnessStatus: freshness(publishedAt),
      retrievedAt,
      citations: [{ id, label: id, url: `https://clinicaltrials.gov/study/${encodeURIComponent(id)}`, source: "ClinicalTrials.gov" as const }],
    }];
  });
}

function queryTerms(query: string) {
  const stop = new Set(["about", "after", "before", "review", "second", "opinion", "specialist", "treatment", "therapy", "recent"]);
  return query.toLowerCase().match(/[a-z0-9-]{4,}/g)?.filter((term) => !stop.has(term)).slice(0, 6) ?? [];
}

function localizeEvidence(items: EvidenceItem[], language: "en" | "es") {
  if (language !== "es") return items;
  return items.map((item): EvidenceItem => {
    if (item.evidenceType === "peer_reviewed_clinical_evidence") return { ...item, whatChanged: "Se ha publicado evidencia clínica revisada por pares sobre este tema.", whyItMayMatter: "Puede ayudar al especialista a explicar si el hallazgo modifica la atención establecida o sigue siendo preliminar.", askTheSpecialist: "¿Esta evidencia se aplica a mi situación y cambiaría alguna parte del plan actual?", limitations: "Una publicación no demuestra que un tratamiento sea apropiado para una persona. El diseño y la aplicabilidad del estudio requieren revisión clínica." };
    if (["late_phase_trial", "early_phase_trial", "preclinical_research"].includes(item.evidenceType)) return { ...item, whatChanged: "Un estudio registrado está investigando esta área.", whyItMayMatter: "Puede ser útil comentarlo con un especialista; el registro no significa que el estudio sea adecuado o esté disponible.", askTheSpecialist: "¿Es suficientemente relevante para comentarlo y qué preguntas de elegibilidad o seguridad debemos aclarar?", limitations: "VYVA no ha evaluado la elegibilidad. El estado, los centros y los criterios deben confirmarse con el registro oficial y el equipo del estudio." };
    if (item.citations.some((citation) => citation.source === "FDA")) return { ...item, whatChanged: item.publishedAt ? `El registro oficial de la FDA tiene fecha efectiva ${item.publishedAt}.` : "La FDA publica información oficial de prescripción para este medicamento.", whyItMayMatter: "La información regulatoria puede ayudar al especialista a comprobar usos aprobados, advertencias y el contexto de prescripción en Estados Unidos.", askTheSpecialist: "¿La información actual de la FDA cambia cómo debemos entender esta opción en mi jurisdicción?", limitations: "Un registro regulatorio no demuestra que el medicamento sea adecuado para una persona, esté disponible localmente o sea una aprobación reciente." };
    if (item.citations.some((citation) => citation.source === "WHO")) return { ...item, whatChanged: "La OMS publica o actualiza una recomendación relacionada con este tema.", whyItMayMatter: "Puede aportar un punto de referencia internacional para la conversación con un especialista.", askTheSpecialist: "¿Cómo se compara esta recomendación de la OMS con la guía utilizada en mi país?", limitations: "Las recomendaciones de la OMS pueden abarcar poblaciones o sistemas más amplios que un caso individual. La guía local y el contexto clínico pueden diferir." };
    return item;
  });
}

async function fdaItems(query: string, retrievedAt: string): Promise<EvidenceItem[]> {
  const term = queryTerms(query)[0];
  if (!term) return [];
  const params = new URLSearchParams({ search: `indications_and_usage:"${term}"`, limit: "4" });
  if (process.env.OPENFDA_API_KEY) params.set("api_key", process.env.OPENFDA_API_KEY);
  const response = await fetch(`https://api.fda.gov/drug/label.json?${params}`, { signal: AbortSignal.timeout(8_000) });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("fda_unavailable");
  const body = await response.json() as { results?: Array<Record<string, unknown>> };
  return (body.results ?? []).flatMap((row) => {
    const openfda = row.openfda && typeof row.openfda === "object" ? row.openfda as Record<string, unknown> : {};
    const id = safeText(row.id);
    const application = safeArray(openfda.application_number).map(safeText).find(Boolean) ?? "";
    const title = safeArray(openfda.brand_name).map(safeText).find(Boolean)
      || safeArray(openfda.generic_name).map(safeText).find(Boolean)
      || application;
    if (!id || !title) return [];
    const effective = safeText(row.effective_time);
    const publishedAt = /^\d{8}$/.test(effective) ? `${effective.slice(0, 4)}-${effective.slice(4, 6)}-${effective.slice(6, 8)}` : null;
    const applicationNumber = application.replace(/\D/g, "");
    const url = applicationNumber
      ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${applicationNumber}`
      : `https://api.fda.gov/drug/label.json?search=id:${encodeURIComponent(id)}`;
    return [{
      id: `evidence-${stableId(`fda:${id}`)}`,
      evidenceType: "regulatory_approval" as const,
      title: `${title}: FDA-authoritative prescribing information`,
      whatChanged: publishedAt ? `The FDA label record has an effective date of ${publishedAt}.` : "FDA publishes an authoritative labeling record for this medicine.",
      whyItMayMatter: "Regulatory labeling can help a specialist verify approved uses, warnings, and the current US prescribing context.",
      askTheSpecialist: "Does the current FDA label change how we should understand this option in my jurisdiction?",
      jurisdiction: "United States",
      publishedAt,
      limitations: "A label record does not show that the medicine is suitable for an individual, available locally, or newly approved. The indication and effective date require specialist interpretation.",
      experimental: false,
      evidenceStatus: "approved" as const,
      freshnessStatus: freshness(publishedAt),
      retrievedAt,
      citations: [{ id: application || id, label: application ? `FDA ${application}` : "FDA label", url, source: "FDA" as const }],
    }];
  });
}

async function whoItems(query: string, retrievedAt: string): Promise<EvidenceItem[]> {
  const params = new URLSearchParams({ "$top": "80", "$orderby": "PublicationDate desc", "$select": "SystemSourceKey,PublicationDate,Title,Body,IRISID,ItemDefaultUrl" });
  const response = await fetch(`https://www.who.int/api/default/recommendations?${params}`, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("who_unavailable");
  const body = await response.json() as { value?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
  const rows = Array.isArray(body) ? body : body.value ?? [];
  const terms = queryTerms(query);
  return rows.filter((row) => {
    const searchable = `${safeText(row.Title)} ${stripMarkup(safeText(row.Body))}`.toLowerCase();
    return terms.length > 0 && terms.some((term) => searchable.includes(term));
  }).slice(0, 4).flatMap((row) => {
    const id = safeText(row.SystemSourceKey) || safeText(row.IRISID);
    const title = safeText(row.Title);
    if (!id || !title) return [];
    const publishedAt = safeText(row.PublicationDate).slice(0, 10) || null;
    const rawUrl = safeText(row.ItemDefaultUrl);
    const url = rawUrl.startsWith("https://www.who.int/") ? rawUrl : `https://www.who.int/publications/i/item/${encodeURIComponent(safeText(row.IRISID) || id)}`;
    return [{
      id: `evidence-${stableId(`who:${id}`)}`,
      evidenceType: "guideline_update" as const,
      title,
      whatChanged: "WHO publishes or updates a recommendation relevant to this topic.",
      whyItMayMatter: "It can provide an international public-health reference point for a specialist discussion.",
      askTheSpecialist: "How does this WHO recommendation compare with the guideline used in my country?",
      jurisdiction: "International",
      publishedAt,
      limitations: "WHO recommendations may address populations, systems, or jurisdictions broader than an individual case. Local guidance and clinical context may differ.",
      experimental: false,
      evidenceStatus: "guideline" as const,
      freshnessStatus: freshness(publishedAt),
      retrievedAt,
      citations: [{ id, label: "WHO recommendation", url, source: "WHO" as const }],
    }];
  });
}

export async function researchExpertCareEvidence(query: string, language: "en" | "es" = "en"): Promise<ExpertCareResearchResponse> {
  const retrievedAt = new Date().toISOString();
  const sources = [
    { name: "Europe PMC" as const, run: () => europePmcItems(query, retrievedAt) },
    { name: "ClinicalTrials.gov" as const, run: () => trialItems(query, retrievedAt) },
    { name: "FDA" as const, run: () => fdaItems(query, retrievedAt) },
    { name: "WHO" as const, run: () => whoItems(query, retrievedAt) },
    { name: "EU CTIS" as const, run: () => configuredSourceItems("EU CTIS", query, language, retrievedAt) },
    { name: "EMA" as const, run: () => configuredSourceItems("EMA", query, language, retrievedAt) },
    { name: "NICE" as const, run: () => configuredSourceItems("NICE", query, language, retrievedAt) },
    { name: "Professional society" as const, run: () => configuredSourceItems("Professional society", query, language, retrievedAt) },
  ];
  const settled = await Promise.allSettled(sources.map((source) => source.run()));
  const unavailableSources: string[] = [];
  const sourceStatuses: NonNullable<ExpertCareResearchResponse["sourceStatuses"]> = settled.map((result, index) => {
    const source = sources[index]!;
    if (result.status === "rejected") {
      unavailableSources.push(source.name);
      const configurationRequired = result.reason instanceof ConnectorConfigurationRequiredError;
      return { source: source.name, status: configurationRequired ? "configuration_required" as const : "unavailable" as const, retrievedAt, detail: configurationRequired ? "A licensed or authenticated authoritative connector is required before this source can contribute claims." : "Source request failed or returned an invalid contract; no claims from this source are displayed." };
    }
    return { source: source.name, status: "available", retrievedAt, detail: result.value.length ? null : "Source responded but returned no relevant records." };
  });
  const candidateItems = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const safe = filterSafeExpertCareEvidence(candidateItems);
  const localizedItems = localizeEvidence(safe.items, language);
  const safetyNotices: string[] = [];
  if (/\b(stop|pause|change|switch|reduce|increase|parar|suspender|cambiar|reducir|aumentar)\b.{0,35}\b(medication|medicine|drug|dose|treatment|therapy|medicamento|medicación|dosis|tratamiento|terapia)\b/i.test(query)
    || /\b(medication|medicine|drug|dose|treatment|therapy|medicamento|medicación|dosis|tratamiento|terapia)\b.{0,35}\b(stop|pause|change|switch|reduce|increase|parar|suspender|cambiar|reducir|aumentar)\b/i.test(query)) {
    safetyNotices.push(language === "es" ? "No suspendas, inicies ni cambies medicación o tratamiento basándote en este informe. Consulta al profesional que te atiende." : "Do not stop, start, or change medication or treatment based on this brief. Ask the treating clinician.");
  }
  if (/\b(eligible|eligibility|qualify|qualification|elegible|elegibilidad|califico|calificar)\b.{0,30}\b(trial|study|ensayo|estudio)\b/i.test(query)
    || /\b(trial|study|ensayo|estudio)\b.{0,30}\b(eligible|eligibility|qualify|qualification|elegible|elegibilidad|califico|calificar)\b/i.test(query)) {
    safetyNotices.push(language === "es" ? "Este informe no puede determinar la elegibilidad para un ensayo. Confirma los criterios y el estado con el registro oficial y el equipo del estudio." : "This brief cannot determine trial eligibility. Confirm current criteria and status with the official registry and study team.");
  }
  if (new Set(localizedItems.flatMap((item) => item.citations.map((citation) => citation.source))).size > 1) {
    safetyNotices.push(language === "es" ? "Las fuentes pueden diferir en población, jurisdicción, diseño o fecha. Un especialista debe conciliar los hallazgos que entren en conflicto." : "Sources may differ in population, jurisdiction, design, or timing. A specialist should reconcile any conflicting findings.");
  }
  return {
    items: localizedItems,
    retrievedAt,
    educationalOnly: true,
    unavailableSources,
    sourceStatuses,
    safetyRejectedCount: new Set(safe.violations.map((violation) => violation.itemId)).size,
    safetyRejectionReasons: [...new Set(safe.violations.map((violation) => violation.reason))],
    safetyNotices,
  };
}
