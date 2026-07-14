import { CONCIERGE_FLOW_REFERENCES, type ConciergeFlowReference } from "./conciergeFlowRegistry";

export type ConciergeFlowCoverageStage =
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
  requiredStages: ConciergeFlowCoverageStage[];
  coveredStages: ConciergeFlowCoverageStage[];
  evidence: Partial<Record<ConciergeFlowCoverageStage, string>>;
}

const PROVIDER_FLOW_STAGES: ConciergeFlowCoverageStage[] = [
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
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
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
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
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
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
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
    requiredStages: PROVIDER_FLOW_STAGES,
    coveredStages: PROVIDER_FLOW_STAGES,
    evidence: {
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
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      start_action: "routes Order In and shopping helper requests into the Shopping assistant",
      detail_collection: "collects need, category, priorities, constraints, saved shortlist, or product/seller check details",
      final_user_confirmation: "turns shopping results into a prepared Concierge task with no checkout, payment, contact, or data sharing before confirmation",
      action_handoff: "sends shopping review requests through the existing Concierge task trigger with FLOW_SHOPPING_SUPPORT",
      outcome_capture: "uses the existing Concierge task completion endpoint for shopping support outcomes",
      completed_history: "labels completed shopping support sessions in Concierge history",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      start_action: "opens a scam check router and prepares a safe review request",
      detail_collection: "opens a scam check router and prepares a safe review request",
      final_user_confirmation: "opens a scam check router and prepares a safe review request",
      action_handoff: "runs a safe web search from a pending Concierge task before closing it",
      outcome_capture: "runs a safe web search from a pending Concierge task before closing it",
      completed_history: "runs a safe web search from a pending Concierge task before closing it",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      start_action: "opens an insurance admin router and prepares a claim review request",
      detail_collection: "opens an insurance admin router and prepares a claim review request",
      final_user_confirmation: "opens an insurance admin router and prepares a claim review request",
      action_handoff: "records a user phone call outcome through the existing completion endpoint",
      outcome_capture: "records a user phone call outcome through the existing completion endpoint",
      completed_history: "records a user phone call outcome through the existing completion endpoint",
    },
  },
  {
    reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    requiredStages: REVIEW_FLOW_STAGES,
    coveredStages: REVIEW_FLOW_STAGES,
    evidence: {
      start_action: "turns Home Find Care prefills into structured provider-search tasks",
      detail_collection: "shows readiness fallback for email-style tool-gated task handoffs",
      final_user_confirmation: "turns Home Find Care prefills into structured provider-search tasks",
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
