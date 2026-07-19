import { beforeEach, describe, expect, it } from "vitest";
import {
  markShowVyvaReviewHistoryActionSaved,
  readShowVyvaReviewHistory,
  SHOW_VYVA_REVIEW_HISTORY_KEY,
  upsertShowVyvaReviewHistory,
} from "@/lib/showVyvaReviewHistory";
import { buildShowVyvaReviewContract } from "../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";
import { getShowVyvaFollowUpAction } from "../shared/showVyvaFollowUp";

describe("Show VYVA review history", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores only written summary and action state, not raw images or full pasted text", () => {
    const contract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "FULL PRIVATE MESSAGE WITH BANK CODE 123456 AND A LONG LINK",
      concernSummary: "Payment pressure",
      riskLevel: "high",
      confidenceLevel: "medium",
      warningSigns: ["Urgent payment request."],
      verifiedObservations: ["A payment request is visible."],
    });

    const item = upsertShowVyvaReviewHistory(contract);

    expect(item).toMatchObject({
      summary: "Payment pressure",
      decision: "This looks risky",
      confidenceLabel: "Clear risk",
      actionSaved: false,
      resumeRoute: "/scam-guard",
    });
    const raw = window.localStorage.getItem(SHOW_VYVA_REVIEW_HISTORY_KEY) ?? "";
    expect(raw).not.toContain("BANK CODE 123456");
    expect(raw).not.toContain("image_data");
  });

  it("marks a review as action-saved after the existing safe action is saved", () => {
    const contract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_link",
      value: "https://example.com/quote",
      concernSummary: "Service quote",
    });

    markShowVyvaReviewHistoryActionSaved(
      contract,
      getShowVyvaFollowUpAction("find_alternatives"),
      "/concierge",
    );

    expect(readShowVyvaReviewHistory()[0]).toMatchObject({
      summary: "Service quote",
      actionSaved: true,
      savedActionLabel: "Find alternatives",
      resumeRoute: "/concierge",
    });
  });
});
