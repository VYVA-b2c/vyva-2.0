import {
  CONCIERGE_FLOW_REFERENCES,
  getConciergeFlowDefinition,
  type ConciergeFlowReference,
} from "./conciergeFlowRegistry";
import { getWorkflowEntryPoint, type WorkflowEntryPoint } from "./workflowRegistry";

export type ConciergeFlowCoverageStage =
  | "entry_points"
  | "start_action"
  | "detail_collection"
  | "missing_provider_setup"
  | "saved_provider_path"
  | "provider_unavailable_recovery"
  | "final_user_confirmation"
  | "action_handoff"
  | "outcome_capture"
  | "completed_history";

export const CONCIERGE_FLOW_COVERAGE_STAGE_LABELS: Record<ConciergeFlowCoverageStage, string> = {
  entry_points: "Home, Concierge, or voice entry points",
  start_action: "Start action",
  detail_collection: "Collect required details",
  missing_provider_setup: "Missing provider setup",
  saved_provider_path: "Saved provider path",
  provider_unavailable_recovery: "Provider unavailable recovery",
  final_user_confirmation: "Final user confirmation",
  action_handoff: "Action handoff",
  outcome_capture: "Outcome capture",
  completed_history: "Completed history",
};

export interface ConciergeFlowCoverageDefinition {
  reference: ConciergeFlowReference;
  entryPointIds: string[];
  requiredStages: ConciergeFlowCoverageStage[];
  coveredStages: ConciergeFlowCoverageStage[];
  evidence: Partial<Record<ConciergeFlowCoverageStage, string>>;
}

const PROVIDER_FLOW_STAGES: ConciergeFlowCoverageStage[] = [
  "entry_points",
  "start_action",
  "detail_collection",
  "missing_provider_setup",
  "saved_provider_path",
  "provider_unavailable_recovery",
  "final_user_confirmation",
  "action_handoff",
  "outcome_capture",
  "completed_history",
];

const REVIEW_FLOW_STAGES: ConciergeFlowCoverageStage[] = [
  "entry_points",
  "start_action",
  "detail_collection",
  "final_user_confirmation",
  "action_handoff",
  "outcome_capture",
  "completed_history",
];

export const CONCIERGE_FLOW_COVERAGE: ConciergeFlowCoverageDefinition[] = [
  {
    reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    entryPointIds: ["home.fast.book-ride", "concierge.fast.book-ride", "concierge.action.transport"],
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
      entry_points: "Home Fast help, Concierge Fast help, and Concierge voice/action handoff all map to transport booking",
      start_action: "opens voice ride handoffs on the transport card with known details",
      detail_collection: "uses saved transport details and only asks for mobility when missing",
      missing_provider_setup: "routes missing transport provider setup to trusted providers",
      saved_provider_path: "finds transport options and prepares a provider without starting a booking",
      provider_unavailable_recovery: "opens a replacement transport search when a provider is unavailable",
      final_user_confirmation: "finds transport options and prepares a provider without starting a booking",
      action_handoff: "renders prepared provider phone actions as direct call links",
      outcome_capture: "records a confirmed provider reply through the existing completion endpoint",
      completed_history: "shows recent completed concierge sessions without replacing the active task",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    entryPointIds: ["meds.card.refills", "meds.fast.refill-help", "concierge.fast.otc-pharmacy", "concierge.action.otc-pharmacy"],
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
      entry_points: "Medication refill surfaces, Concierge Fast help, and Concierge voice/action handoff all map to OTC pharmacy",
      start_action: "requires pharmacy setup before OTC pharmacy help can start",
      detail_collection: "prepares OTC pharmacy requests only through a saved pharmacy",
      missing_provider_setup: "requires pharmacy setup before OTC pharmacy help can start",
      saved_provider_path: "prepares OTC pharmacy requests only through a saved pharmacy",
      provider_unavailable_recovery: "opens a replacement pharmacy search when an OTC provider is unavailable",
      final_user_confirmation: "prepares OTC pharmacy requests only through a saved pharmacy",
      action_handoff: "records a sent WhatsApp draft through the existing completion endpoint",
      outcome_capture: "records a sent WhatsApp draft through the existing completion endpoint",
      completed_history: "shows recent completed concierge sessions without replacing the active task",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    entryPointIds: ["health.fast.book-medical", "concierge.fast.book-medical", "concierge.action.medical-appointment"],
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
      entry_points: "Health Fast help, Concierge Fast help, and Concierge voice/action handoff all map to medical appointment",
      start_action: "turns a symptom appointment handoff into a one-tap concierge request",
      detail_collection: "creates an appointment request and asks VYVA to handle the saved provider before booking",
      missing_provider_setup: "routes missing medical provider setup to trusted providers",
      saved_provider_path: "creates an appointment request and asks VYVA to handle the saved provider before booking",
      provider_unavailable_recovery: "opens a replacement appointment search when a provider is unavailable",
      final_user_confirmation: "creates an appointment request and asks VYVA to handle the saved provider before booking",
      action_handoff: "sends appointment email through VYVA before booking is saved",
      outcome_capture: "saves a confirmed medical appointment reply into Scheduled Support before closing the task",
      completed_history: "shows completed appointment history as a reusable appointment template",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.homeService,
    entryPointIds: ["concierge.fast.find-plumber", "concierge.action.home-service"],
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
      entry_points: "Concierge Fast help and Concierge voice/action handoff both map to home service",
      start_action: "collects plumber intake, stores app origin, and automatically searches when no saved provider exists",
      detail_collection: "collects plumber intake, stores app origin, and automatically searches when no saved provider exists",
      missing_provider_setup: "collects plumber intake, stores app origin, and automatically searches when no saved provider exists",
      saved_provider_path: "turns a voice plumber payload into the same structured service intake",
      provider_unavailable_recovery: "opens a replacement home-service search when a provider is unavailable",
      final_user_confirmation: "turns a voice plumber payload into the same structured service intake",
      action_handoff: "prepares a provider follow-up while keeping the final send under user control",
      outcome_capture: "saves a confirmed home-service reply into Scheduled Support before closing the task",
      completed_history: "shows recent completed concierge sessions without replacing the active task",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    entryPointIds: ["concierge.fast.order-groceries", "concierge.fast.prepared-meals", "concierge.action.shopping"],
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      entry_points: "Concierge grocery, prepared meal, and voice/action shopping entries all map to shopping support",
      start_action: "routes Order In and shopping helper requests into the Shopping assistant",
      detail_collection: "collects need, category, priorities, constraints, saved shortlist, product/seller check details, and deal comparison context",
      final_user_confirmation: "turns shopping, deal-watch, and offer-review results into prepared Concierge tasks with no checkout, payment, contact, or data sharing before confirmation",
      action_handoff: "sends shopping and find_offers review requests through the existing Concierge task trigger with FLOW_SHOPPING_SUPPORT",
      outcome_capture: "uses the existing Concierge task completion endpoint for shopping support outcomes",
      completed_history: "labels completed shopping support sessions in Concierge history",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    entryPointIds: [
      "home.fast.find-care",
      "health.fast.find-specialist",
      "concierge.fast.find-specialist",
      "concierge.fast.find-residence",
      "concierge.action.care-navigation",
    ],
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
      entry_points: "Home, Health, Concierge Fast help, and Concierge voice/action handoffs all map to care navigation",
      start_action: "opens Home Find Care, Personal Care, Find Specialist, and Find Residence as care-navigation searches",
      detail_collection: "collects provider search mode, query, proximity, reputation, accessibility, price, availability, and coverage criteria",
      missing_provider_setup: "routes saving a care provider to focused trusted-provider setup without blocking the search",
      saved_provider_path: "resumes care-provider setup back into Concierge with the saved provider context",
      provider_unavailable_recovery: "opens another care-provider search when a shortlisted option is unavailable",
      final_user_confirmation: "prepares care provider contact without calling, booking, messaging, or sharing details until the user confirms",
      action_handoff: "renders provider follow-through actions for replies, saving, and trying another option",
      outcome_capture: "records provider replies through the existing completion endpoint",
      completed_history: "labels completed care-navigation sessions separately from generic provider search tasks",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
    entryPointIds: ["concierge.fast.check-scam", "scam.action.show-vyva", "concierge.action.scam-check"],
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      entry_points: "Concierge Fast help, Scam Guard Show VYVA, and Concierge voice/action handoff all map to scam check",
      start_action: "opens a scam check router and prepares a safe review request",
      detail_collection: "captures the scam review source separately from source_type so VYVA asks for the missing company, document, phone, email, or link before proceeding",
      final_user_confirmation: "safe review tasks keep web search, upload, forwarding, contact, and data sharing behind explicit user confirmation",
      action_handoff: "runs a safe web search from a pending Concierge task only after the user chooses the safe-search action",
      outcome_capture: "runs a safe web search from a pending Concierge task before closing it",
      completed_history: "runs a safe web search from a pending Concierge task before closing it",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    entryPointIds: ["home.fast.safe-home", "concierge.fast.safe-home", "safe-home.action.show-vyva", "concierge.action.safe-home"],
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      entry_points: "Home Fast help, Concierge Fast help, Safe Home Show VYVA, and Concierge voice/action handoff all map to safe home support",
      start_action: "opens Safe Home from Concierge fast help and voice safety handoffs",
      detail_collection: "Safe Home and safety specialist flows collect immediate risk context before next steps",
      final_user_confirmation: "safety routes keep alerting, calling, uploading, or contacting behind explicit confirmation",
      action_handoff: "Safe Home quote requests create a home-service Concierge handoff tagged with FLOW_SAFE_HOME_SUPPORT",
      outcome_capture: "provider replies and scheduled visit saves preserve the Safe Home flow reference",
      completed_history: "completed Concierge history labels Safe Home outcomes from the preserved flow reference",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    entryPointIds: ["home.fast.paperwork-help", "concierge.fast.paperwork-help", "concierge.fast.government-help", "concierge.action.insurance-admin"],
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      entry_points: "Home paperwork, Concierge paperwork/government Fast help, and Concierge voice/action handoff all map to insurance/admin support",
      start_action: "opens an insurance admin router and prepares a claim review request",
      detail_collection: "captures task type, subject, recipient, deadline, and notes separately so only missing admin details are requested",
      final_user_confirmation: "admin tasks remain prepared-only until the user confirms before sending, calling, uploading, or submitting",
      action_handoff: "records user phone, email, form, and manual-review outcomes through the existing completion endpoint",
      outcome_capture: "records a user phone call outcome through the existing completion endpoint",
      completed_history: "records a user phone call outcome through the existing completion endpoint",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    entryPointIds: ["home.card.concierge", "concierge.action.tool-gated-task"],
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      entry_points: "Home Concierge card and Concierge voice/action handoff both map to the generic tool-gated task flow",
      start_action: "shows readiness fallback for call, email, form, application, and message handoffs",
      detail_collection: "tracks goal, action type, and website/contact separately so call, email, form, application, and upload tasks ask only for missing details",
      final_user_confirmation: "checks tool readiness and requires confirmation before any call, send, upload, booking link, or submission",
      action_handoff: "records a sent tool-gated email draft through the existing completion endpoint",
      outcome_capture: "records a sent tool-gated email draft through the existing completion endpoint",
      completed_history: "records a sent tool-gated email draft through the existing completion endpoint",
    },
  },
];

export function getConciergeFlowCoverage(reference: ConciergeFlowReference): ConciergeFlowCoverageDefinition {
  const coverage = CONCIERGE_FLOW_COVERAGE.find((item) => item.reference === reference);
  if (!coverage) throw new Error(`Unknown Concierge coverage reference: ${reference}`);
  return coverage;
}

export function missingConciergeFlowCoverage(reference: ConciergeFlowReference): ConciergeFlowCoverageStage[] {
  const coverage = getConciergeFlowCoverage(reference);
  return coverage.requiredStages.filter((stage) => !coverage.coveredStages.includes(stage));
}

export type ConciergeFlowEntryCoverageGap =
  | "missing_entry_point"
  | "missing_visible_entry"
  | "missing_concierge_entry"
  | "missing_voice_handoff";

export function conciergeFlowCoverageEntryPoints(reference: ConciergeFlowReference): WorkflowEntryPoint[] {
  return getConciergeFlowCoverage(reference).entryPointIds.map((id) => getWorkflowEntryPoint(id));
}

export function missingConciergeFlowEntryCoverage(reference: ConciergeFlowReference): ConciergeFlowEntryCoverageGap[] {
  const definition = getConciergeFlowDefinition(reference);
  const entries = conciergeFlowCoverageEntryPoints(reference);
  const gaps: ConciergeFlowEntryCoverageGap[] = [];
  const hasVisibleEntry = entries.some((entry) => entry.surface !== "voice_action");
  const hasConciergeEntry = entries.some((entry) => entry.source === "ConciergeScreen" || entry.route === "/concierge");
  const hasVoiceEntry = entries.some((entry) => entry.surface === "voice_action");
  const expectsVisibleEntry = definition.levels.some((level) => (
    level === "main_category" || level === "sub_action" || level === "fast_help"
  ));

  if (entries.length === 0) gaps.push("missing_entry_point");
  if (expectsVisibleEntry && !hasVisibleEntry) gaps.push("missing_visible_entry");
  if (!hasConciergeEntry) gaps.push("missing_concierge_entry");
  if (definition.levels.includes("voice_handoff") && !hasVoiceEntry) gaps.push("missing_voice_handoff");

  return gaps;
}
