import type { ShowVyvaReviewConfidenceLevel, ShowVyvaReviewContract } from "./showVyvaReviewContract";

export type ShowVyvaConfidenceEvidenceTone = "clear_risk" | "needs_checking" | "not_enough_information";

export interface ShowVyvaConfidenceEvidence {
  label: string;
  tone: ShowVyvaConfidenceEvidenceTone;
  evidencePoints: string[];
  factsFound: string[];
  uncertainPoints: string[];
}

const CONFIDENCE_LABELS: Record<ShowVyvaConfidenceEvidenceTone, string> = {
  clear_risk: "Clear risk",
  needs_checking: "Needs checking",
  not_enough_information: "Not enough information",
};

function uniqueClean(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = item?.replace(/\s+/g, " ").trim() ?? "";
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function confidenceToneFor(contract: ShowVyvaReviewContract): ShowVyvaConfidenceEvidenceTone {
  if (contract.riskLevel === "high" && contract.warningSigns.length > 0) return "clear_risk";
  if (contract.confidenceLevel === "low" || contract.riskLevel === "unknown") return "not_enough_information";
  return "needs_checking";
}

function fallbackUncertainty(contract: ShowVyvaReviewContract): string {
  if (contract.followUpContext === "scam") return "Sender identity and intent are not fully confirmed.";
  if (contract.followUpContext === "medicine" || contract.followUpContext === "health_visual") {
    return "Dose, history, and clinical context still need a qualified check.";
  }
  if (contract.followUpContext === "document") return "Missing pages, terms, or provider context may change the meaning.";
  if (contract.followUpContext === "provider_deal") return "Price, reputation, availability, or coverage may still be unverified.";
  return "Details outside the item are still unknown.";
}

function confidenceBoost(confidence: ShowVyvaReviewConfidenceLevel): string | null {
  if (confidence === "high") return "Several visible details support this review.";
  if (confidence === "medium") return "Some visible details support this review.";
  return null;
}

export function buildShowVyvaConfidenceEvidence(contract: ShowVyvaReviewContract): ShowVyvaConfidenceEvidence {
  const tone = confidenceToneFor(contract);
  const factsFound = uniqueClean([
    ...contract.verifiedObservations,
    ...(contract.warningSigns.length ? contract.warningSigns.slice(0, 1) : []),
  ]).slice(0, 3);
  const uncertainPoints = uniqueClean([
    ...contract.unknowns,
    fallbackUncertainty(contract),
  ]).slice(0, 3);
  const evidencePoints = uniqueClean([
    ...contract.warningSigns,
    ...contract.verifiedObservations,
    confidenceBoost(contract.confidenceLevel),
    ...(factsFound.length ? [] : [contract.concernSummary]),
    ...(uncertainPoints.length ? [`Still uncertain: ${uncertainPoints[0]}`] : []),
  ]).slice(0, 3);

  return {
    label: CONFIDENCE_LABELS[tone],
    tone,
    evidencePoints,
    factsFound,
    uncertainPoints,
  };
}
