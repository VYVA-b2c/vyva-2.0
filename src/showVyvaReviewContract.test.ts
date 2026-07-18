import { describe, expect, it } from "vitest";
import { CONCIERGE_FLOW_REFERENCES } from "../shared/conciergeFlowRegistry";
import { translate } from "./i18n";
import { LANGUAGES } from "./i18n/languages";
import {
  SHOW_VYVA_FINAL_CONFIRMATION_RULE,
  SHOW_VYVA_REVIEW_INPUT_TYPES,
  buildShowVyvaReviewContract,
  inferShowVyvaReviewInputType,
  showVyvaReviewContractFromHealthResult,
  showVyvaReviewContractFromPastePayload,
  showVyvaReviewContractFromSafeHomeResult,
  showVyvaReviewContractFromScamResult,
} from "../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";

describe("Show VYVA review contract", () => {
  it("supports every requested input type through inference or an explicit hint", () => {
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "camera",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.cameraPhoto);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "upload",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.uploadedImage);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      source: "upload",
      fileName: "claim.pdf",
      mimeType: "application/pdf",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.uploadedDocument);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Call +34 600 111 222 now",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.phoneNumber);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Example Energy SL",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.companyName);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      source: "paste_text",
      value: "Insurance claim text",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.documentText);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_link",
      value: "https://example.com/quote",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink);
    expect(inferShowVyvaReviewInputType({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_text",
      value: "Quote looks expensive",
    })).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.pastedText);
  });

  it("returns one consistent result shape with the global confirmation rule", () => {
    const contract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_link",
      value: "https://example.com/deal",
      concernSummary: "Compare this offer",
      riskLevel: "medium",
      confidenceLevel: "medium",
      noticed: ["Price is not clear.", "Provider reputation should be checked."],
      verifiedObservations: ["A price is shown."],
      warningSigns: ["The total cost is not explained."],
      unknowns: ["Provider reputation is not established by the offer."],
      safeNextSteps: ["Compare price.", "Check reputation.", "Ask before contacting."],
    });

    expect(contract).toMatchObject({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      context: "shopping_admin",
      followUpContext: "provider_deal",
      inputType: SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink,
      riskLevel: "medium",
      confidenceLevel: "medium",
      finalConfirmationRequired: true,
      finalConfirmationRule: SHOW_VYVA_FINAL_CONFIRMATION_RULE,
    });
    expect(contract.concernSummary).toBe("Compare this offer");
    expect(contract.reviewedValue).toBe("https://example.com/deal");
    expect(contract.verifiedObservations).toEqual(["A price is shown."]);
    expect(contract.warningSigns).toEqual(["The total cost is not explained."]);
    expect(contract.unknowns).toEqual(["Provider reputation is not established by the offer."]);
    expect(contract.noticed).toHaveLength(2);
    expect(contract.safeNextSteps).toHaveLength(3);
    expect(contract.followUpActions.map((action) => action.id)).toEqual([
      "find_alternatives",
      "save_note",
      "compare_price",
      "compare_proximity",
      "check_reputation",
      "check_terms",
      "continue_concierge",
    ]);
  });

  it("builds pasted review contracts for links, phone numbers, company names, and document text", () => {
    const link = showVyvaReviewContractFromPastePayload({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.providerOrDeal,
      source: "paste_link",
      value: "https://example.com/quote",
    });
    expect(link.inputType).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink);
    expect(link.followUpContext).toBe("provider_deal");
    expect(link.reviewedValue).toBe("https://example.com/quote");

    const phone = showVyvaReviewContractFromPastePayload({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "+34 600 111 222",
    });
    expect(phone.inputType).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.phoneNumber);
    expect(phone.followUpContext).toBe("scam");
    expect(phone.followUpActions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
      "check_number",
      "call_trusted_contact",
      "save_report",
      "scam_concierge",
    ]);

    const scamLink = showVyvaReviewContractFromPastePayload({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "https://suspicious.example/pay",
    });
    expect(scamLink.inputType).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.pastedLink);
    expect(scamLink.followUpActions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
      "check_link",
      "call_trusted_contact",
      "save_report",
      "scam_concierge",
    ]);

    const company = showVyvaReviewContractFromPastePayload({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Example Energy SL",
    });
    expect(company.inputType).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.companyName);
    expect(company.followUpActions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
      "check_company",
      "call_trusted_contact",
      "save_report",
      "scam_concierge",
    ]);

    const document = showVyvaReviewContractFromPastePayload({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.documentHelp,
      source: "paste_text",
      value: "Insurance claim deadline: Friday",
    });
    expect(document.inputType).toBe(SHOW_VYVA_REVIEW_INPUT_TYPES.documentText);
    expect(document.followUpActions.map((action) => action.id)).toContain("summarize_document");
  });

  it("normalizes existing scam, safe-home, and health results to the same contract", () => {
    const scam = showVyvaReviewContractFromScamResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "Example Energy SL",
    }, {
      riskLevel: "Scam",
      resultTitle: "Likely scam",
      explanation: "Pressure language.",
      steps: ["Do not reply.", "Check the company."],
    });
    expect(scam.context).toBe("scam");
    expect(scam.riskLevel).toBe("high");
    expect(scam.followUpActions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
      "check_company",
      "call_trusted_contact",
      "save_report",
      "scam_concierge",
    ]);

    const scamMessage = showVyvaReviewContractFromScamResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
      source: "paste_text",
      value: "This message asks me to forward bank details urgently.",
    }, {
      riskLevel: "Suspicious",
      resultTitle: "Suspicious message",
      explanation: "Pressure language.",
      steps: ["Do not reply."],
    });
    expect(scamMessage.followUpActions.map((action) => action.id)).toEqual([
      "do_not_reply",
      "block_or_report",
      "ask_someone",
      "forward_email",
      "check_company",
      "call_trusted_contact",
      "save_report",
      "scam_concierge",
    ]);

    const home = showVyvaReviewContractFromSafeHomeResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
      source: "camera",
    }, {
      riskLevel: "Low Risk",
      resultTitle: "Loose rug",
      hazards: ["Loose rug near doorway"],
      advice: "Move it or secure it.",
    });
    expect(home.context).toBe("safe_home");
    expect(home.followUpActions.map((action) => action.id)).toEqual([
      "buy_safety_aid",
      "request_quote",
      "call_care_team",
      "save_note",
      "mark_safe_now",
    ]);

    const health = showVyvaReviewContractFromHealthResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      source: "upload",
      fileName: "medicine-label.jpg",
    }, {
      severity: "Moderate",
      resultTitle: "Label question",
      visibleObservations: ["Dose timing text is visible."],
      potentialConcerns: ["Ask before mixing with other medicine."],
      recommendedNextStep: "Prepare a pharmacist question.",
    });
    expect(health.context).toBe("health_medication");
    expect(health.conciergeFlow).toBe(CONCIERGE_FLOW_REFERENCES.otcPharmacy);
    expect(health.followUpActions.map((action) => action.id)).toEqual([
      "save_note",
      "pharmacist_questions",
      "call_gp",
      "medicine_safety",
      "continue_concierge",
    ]);

    const healthPhoto = showVyvaReviewContractFromHealthResult({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
      source: "camera",
      followUpContext: "health_visual",
    }, {
      severity: "Moderate",
      resultTitle: "Photo needs review",
      potentialConcerns: ["A clinician may need to review this."],
      recommendedNextStep: "Prepare a doctor question.",
    });
    expect(healthPhoto.context).toBe("health_medication");
    expect(healthPhoto.followUpContext).toBe("health_visual");
    expect(healthPhoto.followUpActions.map((action) => action.id)).toEqual([
      "doctor_help",
      "save_note",
      "call_gp",
      "email_gp",
      "schedule_appointment",
      "book_ride",
    ]);
  });

  it("keeps every external follow-up action behind confirmation", () => {
    for (const useCaseId of Object.values(SHOW_VYVA_USE_CASE_IDS)) {
      const contract = buildShowVyvaReviewContract({
        useCaseId,
        source: "paste_text",
        value: "Review this",
      });

      expect(contract.finalConfirmationRequired).toBe(true);
      expect(contract.finalConfirmationRule).toContain("must confirm");
      for (const action of contract.followUpActions) {
        if (action.externalAction) {
          expect(action.requiresConfirmation).toBe(true);
        }
      }
    }
  });

  it("keeps contract copy localized in every supported app language", () => {
    for (const { code } of LANGUAGES) {
      expect(translate(code, "showVyva.contract.finalConfirmation")).not.toBe("showVyva.contract.finalConfirmation");
      expect(translate(code, "showVyva.contract.sections.noticed")).not.toBe("showVyva.contract.sections.noticed");
      expect(translate(code, "showVyva.contract.sections.visible")).not.toBe("showVyva.contract.sections.visible");
      expect(translate(code, "showVyva.contract.sections.warningSigns")).not.toBe("showVyva.contract.sections.warningSigns");
      expect(translate(code, "showVyva.contract.sections.unknowns")).not.toBe("showVyva.contract.sections.unknowns");
      expect(translate(code, "showVyva.contract.unknownFallback")).not.toBe("showVyva.contract.unknownFallback");
      expect(translate(code, "showVyva.questionLabel")).not.toBe("showVyva.questionLabel");
      expect(translate(code, "showVyva.questionPlaceholder")).not.toBe("showVyva.questionPlaceholder");
      expect(translate(code, "showVyva.contract.input.phone_number")).not.toBe("showVyva.contract.input.phone_number");
      expect(translate(code, "showVyva.contract.input.company_name")).not.toBe("showVyva.contract.input.company_name");
      expect(translate(code, "showVyva.contract.risk.high")).not.toBe("showVyva.contract.risk.high");
      expect(translate(code, "showVyva.handoff.kicker")).not.toBe("showVyva.handoff.kicker");
      expect(translate(code, "showVyva.handoff.title.scam")).not.toBe("showVyva.handoff.title.scam");
      expect(translate(code, "showVyva.followUp.action.save_note.label")).not.toBe("showVyva.followUp.action.save_note.label");
      expect(translate(code, "showVyva.followUp.action.do_not_reply.label")).not.toBe("showVyva.followUp.action.do_not_reply.label");
      expect(translate(code, "showVyva.followUp.action.find_alternatives.label")).not.toBe("showVyva.followUp.action.find_alternatives.label");
      expect(translate(code, "showVyva.closeReview")).not.toBe("showVyva.closeReview");
    }
  });
});
