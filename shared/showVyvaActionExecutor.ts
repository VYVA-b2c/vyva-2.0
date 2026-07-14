import {
  CONCIERGE_FLOW_REFERENCES,
  type ConciergeFlowReference,
  type ConciergeToolRequirement,
} from "./conciergeFlowRegistry";
import type { ShowVyvaReviewContract, ShowVyvaReviewContext } from "./showVyvaReviewContract";
import type { ShowVyvaFollowUpAction, ShowVyvaFollowUpActionId } from "./showVyvaFollowUp";

export type ShowVyvaExecutorUseCase =
  | "book_ride"
  | "order_medicine"
  | "book_appointment"
  | "home_service"
  | "find_provider"
  | "find_offers"
  | "paperwork"
  | "admin_task"
  | "scam_check"
  | "shopping_request"
  | "insurance_admin"
  | "send_message";

export type ShowVyvaActionResumeSurface = "concierge" | "home";

export interface ShowVyvaActionTarget {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  bookingUrl?: string | null;
  relationship?: string | null;
}

export interface ShowVyvaActionExecutorInput {
  contract: ShowVyvaReviewContract;
  action: ShowVyvaFollowUpAction;
  language?: string | null;
  sourceRoute?: string | null;
  target?: ShowVyvaActionTarget | null;
}

export interface ShowVyvaConciergeTriggerRequest {
  use_case: ShowVyvaExecutorUseCase;
  provider_name: string | null;
  provider_phone: string | null;
  found_externally: boolean;
  action_summary: string;
  action_payload: Record<string, unknown>;
  language?: string;
  trigger_source: "user_request";
  auto_start: false;
}

export interface ShowVyvaActionExecutionPlan {
  version: 1;
  actionId: ShowVyvaFollowUpActionId;
  kind: "concierge_task";
  title: string;
  message: string;
  targetRoute: "/concierge" | "/concierge/shopping";
  resumeSurfaces: ShowVyvaActionResumeSurface[];
  finalConfirmationRequired: true;
  noExternalActionWithoutConfirmation: true;
  externalActionBlockedUntilConfirmed: boolean;
  triggerRequest: ShowVyvaConciergeTriggerRequest;
}

const EXTERNAL_ACTION_WORDING =
  "Do not send, call, book, buy, upload externally, submit, forward, or share anything until the user gives final confirmation.";

function clean(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function flowForAction(actionId: ShowVyvaFollowUpActionId, context: ShowVyvaReviewContext, fallback?: ConciergeFlowReference): ConciergeFlowReference {
  switch (actionId) {
    case "book_ride":
      return CONCIERGE_FLOW_REFERENCES.transportBooking;
    case "pharmacist_questions":
    case "medicine_safety":
      return CONCIERGE_FLOW_REFERENCES.otcPharmacy;
    case "call_gp":
    case "email_gp":
    case "doctor_help":
    case "schedule_appointment":
      return CONCIERGE_FLOW_REFERENCES.medicalAppointment;
    case "buy_safety_aid":
    case "compare_price":
    case "compare_proximity":
    case "check_reputation":
    case "check_terms":
      return CONCIERGE_FLOW_REFERENCES.shoppingSupport;
    case "request_quote":
      return CONCIERGE_FLOW_REFERENCES.homeService;
    case "call_care_team":
    case "mark_safe_now":
      return CONCIERGE_FLOW_REFERENCES.safeHomeSupport;
    case "summarize_document":
    case "draft_reply":
    case "prepare_call":
      return CONCIERGE_FLOW_REFERENCES.insuranceAdmin;
    case "check_company":
    case "call_trusted_contact":
    case "save_report":
    case "scam_concierge":
      return CONCIERGE_FLOW_REFERENCES.scamCheck;
    case "save_note":
      return context === "health_medication"
        ? CONCIERGE_FLOW_REFERENCES.medicalAppointment
        : fallback ?? CONCIERGE_FLOW_REFERENCES.toolGatedTask;
    case "continue_concierge":
      return fallback ?? CONCIERGE_FLOW_REFERENCES.toolGatedTask;
    default:
      return fallback ?? CONCIERGE_FLOW_REFERENCES.toolGatedTask;
  }
}

function useCaseForFlow(actionId: ShowVyvaFollowUpActionId, flow: ConciergeFlowReference): ShowVyvaExecutorUseCase {
  if (actionId === "check_company" || actionId === "save_report" || actionId === "scam_concierge" || actionId === "call_trusted_contact") return "scam_check";
  if (actionId === "request_quote" || actionId === "call_care_team" || flow === CONCIERGE_FLOW_REFERENCES.homeService) return "home_service";
  if (flow === CONCIERGE_FLOW_REFERENCES.transportBooking) return "book_ride";
  if (flow === CONCIERGE_FLOW_REFERENCES.otcPharmacy) return "order_medicine";
  if (flow === CONCIERGE_FLOW_REFERENCES.medicalAppointment) return "book_appointment";
  if (flow === CONCIERGE_FLOW_REFERENCES.shoppingSupport) return actionId === "buy_safety_aid" ? "shopping_request" : "find_offers";
  if (flow === CONCIERGE_FLOW_REFERENCES.insuranceAdmin) return "paperwork";
  if (actionId === "draft_reply" || actionId === "prepare_call") return "send_message";
  return "admin_task";
}

function toolForAction(actionId: ShowVyvaFollowUpActionId): ConciergeToolRequirement {
  switch (actionId) {
    case "call_trusted_contact":
    case "call_gp":
    case "call_care_team":
    case "prepare_call":
      return "phone_call";
    case "email_gp":
    case "draft_reply":
      return "email";
    case "schedule_appointment":
      return "booking_link";
    case "check_company":
    case "check_reputation":
      return "web_search";
    default:
      return "operator_review";
  }
}

function routeForAction(actionId: ShowVyvaFollowUpActionId): "/concierge" | "/concierge/shopping" {
  return actionId === "buy_safety_aid" || actionId === "compare_price" || actionId === "compare_proximity" || actionId === "check_reputation" || actionId === "check_terms"
    ? "/concierge/shopping"
    : "/concierge";
}

function providerNameForAction(actionId: ShowVyvaFollowUpActionId, target: ShowVyvaActionTarget | null | undefined): string | null {
  const targetName = clean(target?.name);
  if (targetName) return targetName;
  switch (actionId) {
    case "call_trusted_contact":
      return "Trusted contact";
    case "call_care_team":
      return "Care team";
    case "call_gp":
    case "email_gp":
    case "doctor_help":
    case "schedule_appointment":
      return "Doctor or clinic";
    case "request_quote":
      return "Home service provider";
    case "pharmacist_questions":
    case "medicine_safety":
      return "Pharmacist";
    default:
      return "VYVA review";
  }
}

function summaryForAction(action: ShowVyvaFollowUpAction, contract: ShowVyvaReviewContract): string {
  const concern = clean(contract.concernSummary) || "VYVA review";
  switch (action.id) {
    case "call_trusted_contact":
      return `Ask a trusted contact about: ${concern}.`;
    case "request_quote":
      return `Prepare a home-service quote request for: ${concern}.`;
    case "doctor_help":
      return `Prepare a doctor question from: ${concern}.`;
    case "continue_concierge":
    case "scam_concierge":
      return `Continue with Concierge from Show VYVA review: ${concern}.`;
    case "save_note":
      return `Save review note: ${concern}.`;
    case "mark_safe_now":
      return `Save safe-home review as handled: ${concern}.`;
    default:
      return `${action.label}: ${concern}.`;
  }
}

function draftMessageForAction(action: ShowVyvaFollowUpAction, contract: ShowVyvaReviewContract): string {
  return [
    `Action: ${action.label}.`,
    `Review: ${contract.concernSummary}.`,
    `Risk: ${contract.riskLevel}. Confidence: ${contract.confidenceLevel}.`,
    contract.noticed.length ? `What VYVA noticed: ${contract.noticed.join(" ")}` : "",
    contract.safeNextSteps.length ? `Safe next steps: ${contract.safeNextSteps.join(" ")}` : "",
    EXTERNAL_ACTION_WORDING,
  ].filter(Boolean).join("\n\n");
}

export function buildShowVyvaActionExecutionPlan(input: ShowVyvaActionExecutorInput): ShowVyvaActionExecutionPlan {
  const flowReference = flowForAction(input.action.id, input.contract.context, input.contract.conciergeFlow);
  const useCase = useCaseForFlow(input.action.id, flowReference);
  const requestedTool = toolForAction(input.action.id);
  const providerName = providerNameForAction(input.action.id, input.target);
  const providerPhone = clean(input.target?.phone) || null;
  const language = clean(input.language);
  const summary = summaryForAction(input.action, input.contract).slice(0, 500);
  const draftMessage = draftMessageForAction(input.action, input.contract);

  const actionPayload: Record<string, unknown> = {
    flow_reference: flowReference,
    show_vyva_action_id: input.action.id,
    show_vyva_context: input.contract.context,
    show_vyva_follow_up_context: input.contract.followUpContext,
    show_vyva_input_type: input.contract.inputType,
    show_vyva_source: input.contract.source,
    source_route: clean(input.sourceRoute) || null,
    review_summary: input.contract.concernSummary,
    risk_level: input.contract.riskLevel,
    confidence_level: input.contract.confidenceLevel,
    noticed: input.contract.noticed,
    safe_next_steps: input.contract.safeNextSteps,
    requested_tool: requestedTool,
    active_tool: requestedTool,
    execution_channel: requestedTool,
    preferred_channel: requestedTool,
    provider_email: clean(input.target?.email) || null,
    provider_whatsapp: clean(input.target?.whatsapp) || null,
    booking_url: clean(input.target?.bookingUrl) || null,
    target_relationship: clean(input.target?.relationship) || null,
    draft_message: draftMessage,
    confirmation_required_before_action: true,
    no_external_action_without_confirmation: true,
    final_confirmation_rule: input.contract.finalConfirmationRule,
    executor_version: 1,
    executor_status: "draft_saved",
    user_confirmed: false,
  };

  return {
    version: 1,
    actionId: input.action.id,
    kind: "concierge_task",
    title: input.action.label,
    message: summary,
    targetRoute: routeForAction(input.action.id),
    resumeSurfaces: ["concierge", "home"],
    finalConfirmationRequired: true,
    noExternalActionWithoutConfirmation: true,
    externalActionBlockedUntilConfirmed: input.action.externalAction,
    triggerRequest: {
      use_case: useCase,
      provider_name: providerName,
      provider_phone: providerPhone,
      found_externally: false,
      action_summary: summary,
      action_payload: actionPayload,
      ...(language ? { language } : {}),
      trigger_source: "user_request",
      auto_start: false,
    },
  };
}

export function showVyvaActionPlanBlocksExternalAction(plan: ShowVyvaActionExecutionPlan): boolean {
  return plan.triggerRequest.auto_start === false
    && plan.finalConfirmationRequired
    && plan.noExternalActionWithoutConfirmation
    && plan.triggerRequest.action_payload.confirmation_required_before_action === true
    && plan.triggerRequest.action_payload.no_external_action_without_confirmation === true
    && plan.triggerRequest.action_payload.user_confirmed === false;
}
