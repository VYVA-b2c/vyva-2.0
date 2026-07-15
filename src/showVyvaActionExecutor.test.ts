import { describe, expect, it } from "vitest";
import {
  buildShowVyvaActionExecutionPlan,
  showVyvaActionPlanBlocksExternalAction,
} from "../shared/showVyvaActionExecutor";
import { buildShowVyvaReviewContract } from "../shared/showVyvaReviewContract";
import { SHOW_VYVA_USE_CASE_IDS } from "../shared/showVyvaFlow";
import { getShowVyvaFollowUpAction, showVyvaFollowUpActionsFor } from "../shared/showVyvaFollowUp";

const baseContract = buildShowVyvaReviewContract({
  useCaseId: SHOW_VYVA_USE_CASE_IDS.scamCheck,
  source: "paste_text",
  value: "Suspicious message asking for bank details",
  concernSummary: "Suspicious bank message",
  riskLevel: "high",
  confidenceLevel: "medium",
  noticed: ["It asks for bank details.", "The sender is unfamiliar."],
  safeNextSteps: ["Do not reply.", "Check before sharing anything."],
});

describe("Show VYVA action executor", () => {
  it("turns Ask trusted contact into a saved Concierge task instead of a direct call", () => {
    const plan = buildShowVyvaActionExecutionPlan({
      contract: baseContract,
      action: getShowVyvaFollowUpAction("call_trusted_contact"),
      language: "en",
      sourceRoute: "/scam-guard",
      target: { name: "Ana", phone: "+34123456789", relationship: "trusted_contact" },
    });

    expect(plan.targetRoute).toBe("/concierge");
    expect(plan.resumeSurfaces).toEqual(["concierge", "home"]);
    expect(plan.triggerRequest).toMatchObject({
      use_case: "scam_check",
      provider_name: "Ana",
      provider_phone: "+34123456789",
      auto_start: false,
      trigger_source: "user_request",
    });
    expect(plan.triggerRequest.action_payload).toMatchObject({
      flow_reference: "FLOW_SCAM_CHECK",
      show_vyva_action_id: "call_trusted_contact",
      requested_tool: "phone_call",
      execution_channel: "phone_call",
      user_confirmed: false,
      confirmation_required_before_action: true,
      no_external_action_without_confirmation: true,
    });
    expect(showVyvaActionPlanBlocksExternalAction(plan)).toBe(true);
  });

  it("turns Request quote into a home-service task that can resume from Home", () => {
    const homeContract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
      source: "camera",
      followUpContext: "home_safety",
      concernSummary: "Loose bathroom rail",
      riskLevel: "medium",
      confidenceLevel: "medium",
      noticed: ["The rail looks loose."],
      safeNextSteps: ["Avoid leaning on it until repaired."],
    });

    const plan = buildShowVyvaActionExecutionPlan({
      contract: homeContract,
      action: getShowVyvaFollowUpAction("request_quote"),
      language: "en",
      sourceRoute: "/safe-home",
    });

    expect(plan.triggerRequest.use_case).toBe("home_service");
    expect(plan.triggerRequest.action_payload).toMatchObject({
      flow_reference: "FLOW_HOME_SERVICE",
      show_vyva_action_id: "request_quote",
      requested_tool: "operator_review",
      review_summary: "Loose bathroom rail",
    });
    expect(plan.resumeSurfaces).toContain("home");
  });

  it("turns Prepare doctor question into a medical appointment draft task", () => {
    const healthContract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.healthOrHomePhoto,
      source: "camera",
      followUpContext: "health_visual",
      concernSummary: "Skin photo review",
      riskLevel: "medium",
      confidenceLevel: "low",
      noticed: ["The image is not enough for diagnosis."],
      safeNextSteps: ["Prepare a clinician question."],
    });

    const plan = buildShowVyvaActionExecutionPlan({
      contract: healthContract,
      action: getShowVyvaFollowUpAction("doctor_help"),
      language: "en",
      sourceRoute: "/health",
    });

    expect(plan.triggerRequest.use_case).toBe("book_appointment");
    expect(plan.triggerRequest.action_payload).toMatchObject({
      flow_reference: "FLOW_MEDICAL_APPOINTMENT",
      show_vyva_action_id: "doctor_help",
      requested_tool: "operator_review",
      no_external_action_without_confirmation: true,
    });
  });

  it("turns Continue with Concierge into a resumable pending task", () => {
    const medicineContract = buildShowVyvaReviewContract({
      useCaseId: SHOW_VYVA_USE_CASE_IDS.medicineOrOtc,
      source: "paste_text",
      value: "Can I take this OTC item?",
      concernSummary: "OTC medicine question",
      riskLevel: "unknown",
      confidenceLevel: "low",
      noticed: ["The item needs pharmacist review."],
      safeNextSteps: ["Prepare the pharmacist question."],
    });

    const plan = buildShowVyvaActionExecutionPlan({
      contract: medicineContract,
      action: getShowVyvaFollowUpAction("continue_concierge"),
      language: "en",
      sourceRoute: "/health",
    });

    expect(plan.targetRoute).toBe("/concierge");
    expect(plan.triggerRequest.auto_start).toBe(false);
    expect(plan.triggerRequest.action_payload).toMatchObject({
      flow_reference: "FLOW_OTC_PHARMACY",
      show_vyva_action_id: "continue_concierge",
      executor_status: "draft_saved",
    });
  });

  it("keeps every external follow-up action behind final confirmation", () => {
    const actions = [
      ...showVyvaFollowUpActionsFor("scam"),
      ...showVyvaFollowUpActionsFor("health_visual"),
      ...showVyvaFollowUpActionsFor("home_safety"),
      ...showVyvaFollowUpActionsFor("medicine"),
      ...showVyvaFollowUpActionsFor("document"),
      ...showVyvaFollowUpActionsFor("provider_deal"),
    ].filter((action) => action.externalAction);

    expect(actions.length).toBeGreaterThan(0);

    for (const action of actions) {
      const plan = buildShowVyvaActionExecutionPlan({
        contract: baseContract,
        action,
        language: "en",
        sourceRoute: "/scam-guard",
      });

      expect(plan.triggerRequest.auto_start, action.id).toBe(false);
      expect(plan.triggerRequest.action_payload.user_confirmed, action.id).toBe(false);
      expect(plan.triggerRequest.action_payload.confirmation_required_before_action, action.id).toBe(true);
      expect(plan.triggerRequest.action_payload.no_external_action_without_confirmation, action.id).toBe(true);
      expect(showVyvaActionPlanBlocksExternalAction(plan), action.id).toBe(true);
    }
  });
});
