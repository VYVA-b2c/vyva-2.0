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
    case "find_alternatives":
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
    case "ask_provider":
    case "compare_options":
      return CONCIERGE_FLOW_REFERENCES.insuranceAdmin;
    case "forward_email":
    case "check_company":
    case "check_number":
    case "check_link":
    case "call_trusted_contact":
    case "do_not_reply":
    case "block_or_report":
    case "ask_someone":
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

function executorUseCaseForFlow(actionId: ShowVyvaFollowUpActionId, flow: ConciergeFlowReference): ShowVyvaExecutorUseCase {
  if (
    actionId === "check_company" ||
    actionId === "check_number" ||
    actionId === "check_link" ||
    actionId === "forward_email" ||
    actionId === "do_not_reply" ||
    actionId === "block_or_report" ||
    actionId === "ask_someone" ||
    actionId === "save_report" ||
    actionId === "scam_concierge" ||
    actionId === "call_trusted_contact"
  ) return "scam_check";
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
    case "ask_someone":
    case "call_gp":
    case "call_care_team":
    case "prepare_call":
      return "phone_call";
    case "email_gp":
    case "draft_reply":
    case "forward_email":
    case "ask_provider":
      return "email";
    case "schedule_appointment":
      return "booking_link";
    case "check_company":
    case "check_number":
    case "check_link":
    case "check_reputation":
      return "web_search";
    default:
      return "operator_review";
  }
}

function routeForAction(actionId: ShowVyvaFollowUpActionId): "/concierge" | "/concierge/shopping" {
  return actionId === "buy_safety_aid" || actionId === "find_alternatives" || actionId === "compare_price" || actionId === "compare_proximity" || actionId === "check_reputation" || actionId === "check_terms"
    ? "/concierge/shopping"
    : "/concierge";
}

function providerNameForAction(actionId: ShowVyvaFollowUpActionId, target: ShowVyvaActionTarget | null | undefined): string | null {
  const targetName = clean(target?.name);
  if (targetName) return targetName;
  switch (actionId) {
    case "call_trusted_contact":
    case "ask_someone":
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
    case "ask_someone":
      return `Ask a trusted contact about: ${concern}.`;
    case "do_not_reply":
      return `Keep this paused and do not reply yet: ${concern}.`;
    case "block_or_report":
      return `Prepare a safe block or report step for: ${concern}.`;
    case "ask_provider":
      return `Prepare a provider question from: ${concern}.`;
    case "compare_options":
      return `Compare options before acting on: ${concern}.`;
    case "find_alternatives":
      return `Find safer alternatives for: ${concern}.`;
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

function reviewedText(contract: ShowVyvaReviewContract): string {
  return clean(contract.reviewedValue) || clean(contract.concernSummary) || "Show VYVA review";
}

function executionGuideForAction(
  action: ShowVyvaFollowUpAction,
  contract: ShowVyvaReviewContract,
): { flow: string; nextQuestion: string; requiredDetails: string[]; guideSteps: string[]; actionScope: string } {
  const reviewed = reviewedText(contract);
  switch (action.id) {
    case "pharmacist_questions":
    case "medicine_safety":
      return {
        flow: "health_medicine_review",
        nextQuestion: "Which medicine or OTC item should VYVA prepare help with?",
        requiredDetails: ["Item name or label", "What the user wants to ask", "Saved pharmacy if contact is needed"],
        guideSteps: ["Clarify the item.", "Prepare a pharmacist-safe question.", "Confirm before any pharmacy contact."],
        actionScope: reviewed,
      };
    case "summarize_document":
    case "draft_reply":
    case "forward_email":
    case "prepare_call":
      return {
        flow: action.id === "forward_email" ? "scam_email_forward_review" : "document_or_message_review",
        nextQuestion: action.id === "prepare_call"
          ? "Who is the call for, and what should VYVA prepare?"
          : "Who should receive the draft, if anything needs to be sent?",
        requiredDetails: ["Recipient or organization", "What needs to be said", "Final confirmation before sending or calling"],
        guideSteps: ["Summarize the important points.", "Prepare a draft or call notes.", "Wait for final user confirmation."],
        actionScope: reviewed,
      };
    case "buy_safety_aid":
      return {
        flow: "safe_home_safety_item",
        nextQuestion: "What safety item should VYVA help compare?",
        requiredDetails: ["Item needed", "Room or place at home", "Budget, access, and delivery preference"],
        guideSteps: ["Clarify the item.", "Compare safe options.", "Confirm before buying or sharing details."],
        actionScope: reviewed,
      };
    case "request_quote":
      return {
        flow: "safe_home_quote_request",
        nextQuestion: "What home help is needed, and where?",
        requiredDetails: ["Problem summary", "Home area or address", "Preferred time and contact method"],
        guideSteps: ["Prepare the quote request.", "Check provider readiness.", "Confirm before any provider contact."],
        actionScope: reviewed,
      };
    case "call_care_team":
    case "mark_safe_now":
      return {
        flow: "safe_home_care_team_note",
        nextQuestion: "Who should know about this, if anyone?",
        requiredDetails: ["Care contact", "Short concern summary", "Whether the issue is handled now"],
        guideSteps: ["Turn the scan into a simple note.", "Choose the contact.", "Confirm before calling or sharing."],
        actionScope: reviewed,
      };
    case "check_number":
      return {
        flow: "scam_phone_number_check",
        nextQuestion: "Should VYVA check this number for warning signs?",
        requiredDetails: ["Phone number", "Message or context", "Whether anyone has already replied"],
        guideSteps: ["Search for public warning signs.", "Summarize the safest next step.", "Do not call back without confirmation."],
        actionScope: reviewed,
      };
    case "check_link":
      return {
        flow: "scam_link_check",
        nextQuestion: "Should VYVA check this link before it is opened?",
        requiredDetails: ["Link", "Who sent it", "What it asks the user to do"],
        guideSteps: ["Check the link reputation.", "Look for pressure or payment requests.", "Do not open or submit details without confirmation."],
        actionScope: reviewed,
      };
    case "check_company":
    case "check_reputation":
      return {
        flow: "provider_or_company_reputation_check",
        nextQuestion: "Which company, seller, or service should VYVA check?",
        requiredDetails: ["Name or website", "Location if relevant", "Price, reputation, and access criteria"],
        guideSteps: ["Search public trust signals.", "Compare risk and fit.", "Confirm before contacting anyone."],
        actionScope: reviewed,
      };
    case "save_report":
      return {
        flow: "scam_evidence_save",
        nextQuestion: "What should VYVA keep as evidence?",
        requiredDetails: ["Suspicious message or document", "Date or sender if known", "Whether the user wants to report it later"],
        guideSteps: ["Save the evidence summary.", "Keep it private.", "Ask before sharing with anyone."],
        actionScope: reviewed,
      };
    case "compare_price":
    case "compare_proximity":
    case "check_terms":
      return {
        flow: "provider_deal_comparison",
        nextQuestion: "What matters most for this comparison?",
        requiredDetails: ["Offer or provider", "Price and location", "Reputation, access, and terms"],
        guideSteps: ["Compare the deal.", "Flag hidden terms.", "Confirm before contacting or buying."],
        actionScope: reviewed,
      };
    default:
      return {
        flow: "guided_show_vyva_follow_up",
        nextQuestion: "What would you like VYVA to do next?",
        requiredDetails: ["Goal", "Preferred contact method", "Final confirmation before action"],
        guideSteps: ["Clarify the next step.", "Prepare it safely.", "Wait for final user confirmation."],
        actionScope: reviewed,
      };
  }
}

function payloadDetailsForAction(
  action: ShowVyvaFollowUpAction,
  contract: ShowVyvaReviewContract,
  target: ShowVyvaActionTarget | null | undefined,
  draftMessage: string,
): Record<string, unknown> {
  const reviewed = reviewedText(contract);
  const targetEmail = clean(target?.email);
  const targetPhone = clean(target?.phone);
  const common = {
    reviewed_item: reviewed,
    user_detail: reviewed,
    notes: clean(contract.concernSummary) || reviewed,
  };

  switch (action.id) {
    case "pharmacist_questions":
    case "medicine_safety":
      return {
        ...common,
        item_text: reviewed,
        item_category: "otc_or_medicine_review",
        fulfillment_preference: "ask_first",
        requested_time: "when convenient",
        pharmacist_question: clean(contract.concernSummary) || reviewed,
      };
    case "summarize_document":
      return {
        ...common,
        document_type: contract.inputType,
        document_summary_request: reviewed,
      };
    case "draft_reply":
    case "forward_email":
    case "ask_provider":
      return {
        ...common,
        recipient_email: targetEmail || null,
        email_subject: action.id === "forward_email"
          ? "Please help me check this safely"
          : action.id === "ask_provider"
            ? `Question about ${reviewed.slice(0, 50)}`
            : `Draft reply: ${reviewed.slice(0, 60)}`,
        email_body: draftMessage,
        message_body: draftMessage,
      };
    case "prepare_call":
      return {
        ...common,
        contact_phone: targetPhone || null,
        call_script: draftMessage,
      };
    case "buy_safety_aid":
      return {
        ...common,
        item_text: reviewed,
        shopping_category: "safe_home_item",
        criteria: ["safety", "price", "delivery", "ease_of_use"],
      };
    case "request_quote":
      return {
        ...common,
        service_needed: reviewed,
        problem_summary: clean(contract.concernSummary) || reviewed,
        service_location: "home",
      };
    case "call_care_team":
      return {
        ...common,
        care_team_note: draftMessage,
        contact_phone: targetPhone || null,
      };
    case "check_number":
      return {
        ...common,
        phone_number: reviewed,
        search_query: `${reviewed} scam warning reputation`,
        scam_check_type: "phone_number",
      };
    case "check_link":
      return {
        ...common,
        url: reviewed,
        search_query: `${reviewed} scam warning link safety`,
        scam_check_type: "link",
      };
    case "check_company":
    case "check_reputation":
      return {
        ...common,
        company_name: reviewed,
        search_query: `${reviewed} reputation reviews complaints scam`,
        scam_check_type: "company_or_provider",
      };
    case "save_report":
    case "do_not_reply":
    case "block_or_report":
    case "ask_someone":
      return {
        ...common,
        evidence_summary: draftMessage,
        report_status: action.id === "do_not_reply" ? "paused_no_reply" : "saved_private",
      };
    case "compare_price":
    case "compare_proximity":
    case "check_terms":
    case "compare_options":
    case "find_alternatives":
      return {
        ...common,
        provider_search_query: reviewed,
        search_query: reviewed,
        criteria: ["price", "proximity", "reputation", "terms"],
      };
    default:
      return common;
  }
}

export function buildShowVyvaActionExecutionPlan(input: ShowVyvaActionExecutorInput): ShowVyvaActionExecutionPlan {
  const flowReference = flowForAction(input.action.id, input.contract.context, input.contract.conciergeFlow);
  const useCase = executorUseCaseForFlow(input.action.id, flowReference);
  const requestedTool = toolForAction(input.action.id);
  const providerName = providerNameForAction(input.action.id, input.target);
  const providerPhone = clean(input.target?.phone) || null;
  const language = clean(input.language);
  const summary = summaryForAction(input.action, input.contract).slice(0, 500);
  const draftMessage = draftMessageForAction(input.action, input.contract);
  const executionGuide = executionGuideForAction(input.action, input.contract);
  const actionDetails = payloadDetailsForAction(input.action, input.contract, input.target, draftMessage);

  const actionPayload: Record<string, unknown> = {
    ...actionDetails,
    flow_reference: flowReference,
    show_vyva_action_id: input.action.id,
    show_vyva_context: input.contract.context,
    show_vyva_follow_up_context: input.contract.followUpContext,
    show_vyva_input_type: input.contract.inputType,
    show_vyva_source: input.contract.source,
    show_vyva_reviewed_value: clean(input.contract.reviewedValue) || null,
    show_vyva_file_name: clean(input.contract.fileName) || null,
    show_vyva_mime_type: clean(input.contract.mimeType) || null,
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
    show_vyva_execution_flow: executionGuide.flow,
    show_vyva_next_question: executionGuide.nextQuestion,
    show_vyva_required_details: executionGuide.requiredDetails,
    show_vyva_guided_steps: executionGuide.guideSteps,
    show_vyva_action_scope: executionGuide.actionScope,
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
