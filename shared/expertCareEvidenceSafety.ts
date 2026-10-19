import type { EvidenceCitation, EvidenceItem } from "./expertCare.js";

const SOURCE_HOSTS: Record<EvidenceCitation["source"], string[]> = {
  "Europe PMC": ["pubmed.ncbi.nlm.nih.gov", "doi.org", "europepmc.org", "www.ebi.ac.uk"],
  "ClinicalTrials.gov": ["clinicaltrials.gov", "www.clinicaltrials.gov"],
  "EU CTIS": ["euclinicaltrials.eu", "www.euclinicaltrials.eu", "europa.eu"],
  FDA: ["fda.gov", "www.fda.gov", "api.fda.gov", "accessdata.fda.gov", "www.accessdata.fda.gov"],
  EMA: ["ema.europa.eu", "www.ema.europa.eu", "api.pms.ema.europa.eu"],
  WHO: ["who.int", "www.who.int", "trialsearch.who.int"],
  NICE: ["nice.org.uk", "www.nice.org.uk"],
  "Professional society": ["asco.org", "www.asco.org", "escardio.org", "www.escardio.org", "aan.com", "www.aan.com"],
};

const PROHIBITED_PERSONALIZED_CLAIMS = [
  /\byou (?:should|must|need to) (?:take|start|stop|change|switch)\b/i,
  /\byou (?:are|would be) eligible\b/i,
  /\byou qualify\b/i,
  /\b(?:right|best|recommended|suitable) (?:treatment|therapy|medicine|trial) for you\b/i,
  /\bstop taking\b/i,
  /\bdebes (?:tomar|iniciar|suspender|parar|cambiar)\b/i,
  /\b(?:eres|serías) elegible\b/i,
  /\bcalificas para\b/i,
  /\b(?:tratamiento|terapia|medicamento|ensayo) (?:adecuado|mejor|recomendado) para ti\b/i,
];

function citationIsOfficial(citation: EvidenceCitation) {
  try {
    const host = new URL(citation.url).hostname.toLowerCase();
    return SOURCE_HOSTS[citation.source].some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

export type ExpertCareEvidenceViolation = { itemId: string; reason: "missing_citation" | "unofficial_citation" | "experimental_misclassified" | "personalized_clinical_claim" | "missing_safety_context" };

export function validateExpertCareEvidenceItem(item: EvidenceItem): ExpertCareEvidenceViolation[] {
  const violations: ExpertCareEvidenceViolation[] = [];
  if (item.citations.length === 0) violations.push({ itemId: item.id, reason: "missing_citation" });
  else if (item.citations.some((citation) => !citationIsOfficial(citation))) violations.push({ itemId: item.id, reason: "unofficial_citation" });
  const trialOrPreclinical = ["late_phase_trial", "early_phase_trial", "preclinical_research"].includes(item.evidenceType);
  if (trialOrPreclinical && !item.experimental) violations.push({ itemId: item.id, reason: "experimental_misclassified" });
  const displayText = [item.whatChanged, item.whyItMayMatter, item.askTheSpecialist].join(" ");
  if (PROHIBITED_PERSONALIZED_CLAIMS.some((pattern) => pattern.test(displayText))) violations.push({ itemId: item.id, reason: "personalized_clinical_claim" });
  if (!item.limitations.trim() || !item.jurisdiction.trim() || !item.retrievedAt.trim()) violations.push({ itemId: item.id, reason: "missing_safety_context" });
  return violations;
}

export function filterSafeExpertCareEvidence(items: EvidenceItem[]) {
  const violations = items.flatMap(validateExpertCareEvidenceItem);
  const rejected = new Set(violations.map((violation) => violation.itemId));
  return { items: items.filter((item) => !rejected.has(item.id)), violations };
}
