import { describe, expect, it } from "vitest";
import { buildShowVyvaConfidenceEvidence } from "../shared/showVyvaConfidenceEvidence";
import { buildShowVyvaReviewContract } from "../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";

describe("Show VYVA confidence and evidence", () => {
  it("shows clear risk when scam warning signs are present", () => {
    const summary = buildShowVyvaConfidenceEvidence(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Pay today or your account closes",
      riskLevel: "high",
      confidenceLevel: "medium",
      verifiedObservations: ["The message asks for payment."],
      warningSigns: ["The message uses urgent pressure."],
      unknowns: ["The sender identity is not confirmed."],
    }));

    expect(summary.label).toBe("Clear risk");
    expect(summary.tone).toBe("clear_risk");
    expect(summary.evidencePoints).toEqual([
      "The message uses urgent pressure.",
      "The message asks for payment.",
      "Some visible details support this review.",
    ]);
    expect(summary.factsFound).toEqual([
      "The message asks for payment.",
      "The message uses urgent pressure.",
    ]);
    expect(summary.uncertainPoints).toContain("The sender identity is not confirmed.");
  });

  it("keeps medicine reviews cautious when context is missing", () => {
    const summary = buildShowVyvaConfidenceEvidence(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      source: "camera",
      riskLevel: "medium",
      confidenceLevel: "low",
      concernSummary: "Medicine label",
      verifiedObservations: ["The dose text is partly visible."],
      unknowns: ["Other medicines and allergies are not known."],
    }));

    expect(summary.label).toBe("Not enough information");
    expect(summary.tone).toBe("not_enough_information");
    expect(summary.factsFound).toEqual(["The dose text is partly visible."]);
    expect(summary.uncertainPoints).toEqual([
      "Other medicines and allergies are not known.",
      "Dose, history, and clinical context still need a qualified check.",
    ]);
  });

  it("shows provider and deal gaps instead of inventing certainty", () => {
    const summary = buildShowVyvaConfidenceEvidence(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_link",
      value: "https://example.com/offer",
      riskLevel: "unknown",
      confidenceLevel: "low",
      concernSummary: "Service offer",
      verifiedObservations: ["A monthly price is shown."],
      unknowns: ["Reviews and cancellation terms are not visible."],
    }));

    expect(summary.label).toBe("Not enough information");
    expect(summary.evidencePoints).toContain("Still uncertain: Reviews and cancellation terms are not visible.");
    expect(summary.uncertainPoints).toContain("Price, reputation, availability, or coverage may still be unverified.");
  });
});
