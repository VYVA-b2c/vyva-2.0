import { describe, expect, it } from "vitest";
import { buildShowVyvaDecisionHandoff } from "../shared/showVyvaDecisionHandoff";
import { buildShowVyvaReviewContract } from "../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";

describe("Show VYVA decision handoff", () => {
  it("turns scam reviews into three simple safe actions", () => {
    const contract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Please pay today",
      riskLevel: "high",
      concernSummary: "Payment pressure",
      safeNextSteps: ["Do not reply or pay yet."],
    });

    const handoff = buildShowVyvaDecisionHandoff(contract);

    expect(handoff).toMatchObject({
      title: "This looks risky",
      subtitle: "Do not reply or pay yet.",
      tone: "warn",
    });
    expect(handoff.actions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
    ]);
    expect(handoff.actions).toHaveLength(3);
  });

  it("uses the right concise handoff for documents, medicine, and provider deals", () => {
    const document = buildShowVyvaDecisionHandoff(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      source: "upload",
      fileName: "bill.pdf",
      concernSummary: "Bill question",
    }));
    expect(document.title).toBe("This needs checking");
    expect(document.actions.map((action) => action.id)).toEqual(["save_note", "ask_provider", "compare_options"]);

    const medicine = buildShowVyvaDecisionHandoff(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      source: "camera",
      concernSummary: "Medicine label",
    }));
    expect(medicine.title).toBe("Check before using");
    expect(medicine.actions.map((action) => action.id)).toEqual(["save_note", "pharmacist_questions", "call_gp"]);

    const deal = buildShowVyvaDecisionHandoff(buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_text",
      value: "Internet offer",
      concernSummary: "Service offer",
    }));
    expect(deal.title).toBe("Compare before deciding");
    expect(deal.actions.map((action) => action.id)).toEqual(["find_alternatives", "save_note", "continue_concierge"]);
  });
});
