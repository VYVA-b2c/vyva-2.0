import {
  buildConciergeExecutionTask,
  planConciergeConfirmedExecution,
  type ConciergeConfirmedExecutionPlan,
  type ConciergeExecutionBuildInput,
  type ConciergeExecutionTask,
} from "./conciergeActionExecution";
import {
  evaluateConciergeChannelReadiness,
  type ConciergeChannelReadinessFlags,
} from "./conciergeChannelReadiness";
import {
  conciergeFlowCoverageEntryPoints,
  getConciergeFlowCoverage,
  missingConciergeFlowCoverage,
  missingConciergeFlowEntryCoverage,
  type ConciergeFlowCoverageStage,
} from "./conciergeFlowCoverage";
import {
  conciergeFlowNeedsSavedProvider,
  CONCIERGE_FLOW_REFERENCES,
  CONCIERGE_FLOW_REGISTRY,
  getConciergeFlowDefinition,
  providerSetupFocusForFlow,
  type ConciergeFlowReference,
  type ConciergeProviderCategoryId,
} from "./conciergeFlowRegistry";
import { workflowEntryPointsFor, type WorkflowEntryPoint } from "./workflowRegistry";

export type ConciergeLaunchSmokeCheckId =
  | "entry_points_open_correct_flow"
  | "missing_provider_setup_routes"
  | "saved_provider_path_collects_details"
  | "final_confirmation_gate"
  | "handoff_and_completed_history";

export type ConciergeLaunchSmokeScenario = ConciergeExecutionBuildInput & {
  reference: ConciergeFlowReference;
  expectedSetupFocus?: ConciergeProviderCategoryId;
};

const LAUNCH_SMOKE_READY_CHANNEL_FLAGS: ConciergeChannelReadinessFlags = {
  phone_call: { adminEnabled: true, configured: true, verified: true },
  email: { adminEnabled: true, configured: true, verified: true },
  whatsapp: { adminEnabled: true, configured: true, verified: true },
  form_application: { adminEnabled: true, configured: true, verified: true },
  document_upload: { adminEnabled: true, configured: true, verified: true },
};

export interface ConciergeLaunchSmokeCheck {
  id: ConciergeLaunchSmokeCheckId;
  passed: boolean;
  details: string[];
}

export interface ConciergeLaunchSmokeFlowAudit {
  reference: ConciergeFlowReference;
  actionName: string;
  scenario: ConciergeLaunchSmokeScenario;
  entryPoints: WorkflowEntryPoint[];
  task: ConciergeExecutionTask;
  confirmedPlan: ConciergeConfirmedExecutionPlan;
  checks: ConciergeLaunchSmokeCheck[];
  failures: string[];
}

export interface ConciergeLaunchSmokeFailure {
  reference: ConciergeFlowReference;
  actionName: string;
  check: ConciergeLaunchSmokeCheckId;
  details: string[];
}

const SMOKE_NOW = "2026-07-15T10:00:00.000Z";

export const CONCIERGE_LAUNCH_SMOKE_PROVIDER_FOCUS: Partial<Record<ConciergeFlowReference, ConciergeProviderCategoryId>> = {
  [CONCIERGE_FLOW_REFERENCES.transportBooking]: "transport",
  [CONCIERGE_FLOW_REFERENCES.otcPharmacy]: "pharmacy",
  [CONCIERGE_FLOW_REFERENCES.medicalAppointment]: "doctor_clinic",
  [CONCIERGE_FLOW_REFERENCES.homeService]: "home_service",
};

export const CONCIERGE_LAUNCH_SMOKE_SCENARIOS: Record<ConciergeFlowReference, ConciergeLaunchSmokeScenario> = {
  [CONCIERGE_FLOW_REFERENCES.transportBooking]: {
    reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
    useCase: "book_ride",
    providerName: "Radio Taxi",
    providerPhone: "+34 600 111 222",
    expectedSetupFocus: "transport",
    summary: "Book a ride to the clinic.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.transportBooking,
      pickup_address: "Home",
      destination_address: "Clinic",
      requested_time: "tomorrow 09:00",
      execution_channel: "phone",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.otcPharmacy]: {
    reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
    useCase: "order_medicine",
    providerName: "Farmacia Central",
    expectedSetupFocus: "pharmacy",
    summary: "Ask the saved pharmacy for non-prescription vitamins.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.otcPharmacy,
      item_text: "vitamin D",
      fulfillment_preference: "pickup",
      requested_time: "today afternoon",
      execution_channel: "whatsapp",
      provider_whatsapp: "+34 600 222 333",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.medicalAppointment]: {
    reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
    useCase: "book_appointment",
    providerName: "Marbella Clinic",
    expectedSetupFocus: "doctor_clinic",
    summary: "Ask the clinic for a follow-up appointment.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.medicalAppointment,
      reason: "Follow-up",
      requested_time: "Friday morning",
      execution_channel: "email",
      provider_email: "appointments@example.com",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.homeService]: {
    reference: CONCIERGE_FLOW_REFERENCES.homeService,
    useCase: "home_service",
    providerName: "Trusted Plumber",
    providerPhone: "+34 600 333 444",
    expectedSetupFocus: "home_service",
    summary: "Ask the plumber about a leaking tap.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.homeService,
      service_type: "plumber",
      urgency: "today",
      home_address: "Home",
      execution_channel: "phone",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.shoppingSupport]: {
    reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
    useCase: "shopping_request",
    summary: "Prepare grocery options for the weekend.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.shoppingSupport,
      shopping_need: "groceries for the weekend",
      category: "groceries",
      priority: "delivery tomorrow",
      execution_channel: "manual",
      requested_tool: "operator_review",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.careNavigation]: {
    reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
    useCase: "find_provider",
    summary: "Compare nearby day care options.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.careNavigation,
      provider_search_query: "senior day care",
      provider_search_mode: "day_care",
      location: "Malaga",
      execution_channel: "manual",
      requested_tool: "operator_review",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.scamCheck]: {
    reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
    useCase: "scam_check",
    summary: "Check whether this energy company message is safe.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.scamCheck,
      company_name: "Example Energy",
      concern: "unexpected bill",
      execution_channel: "web_search",
      requested_tool: "web_search",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.safeHomeSupport]: {
    reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
    useCase: "safe_home",
    summary: "Review a loose stair rail.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
      risk_type: "loose stair rail",
      location: "front stairs",
      urgency: "soon",
      execution_channel: "manual",
      requested_tool: "operator_review",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.insuranceAdmin]: {
    reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
    useCase: "insurance_admin",
    summary: "Prepare an insurance claim email.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
      document_type: "insurance claim",
      recipient_email: "claims@example.com",
      deadline: "Friday",
      execution_channel: "email",
    },
  },
  [CONCIERGE_FLOW_REFERENCES.toolGatedTask]: {
    reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
    useCase: "send_message",
    summary: "Send a completed application form.",
    pendingStatus: "pending",
    now: SMOKE_NOW,
    payload: {
      flow_reference: CONCIERGE_FLOW_REFERENCES.toolGatedTask,
      task_goal: "send a completed application form",
      action_type: "email",
      recipient: "Town hall",
      recipient_email: "office@example.com",
      execution_channel: "email",
    },
  },
};

function coverageHasStage(reference: ConciergeFlowReference, stage: ConciergeFlowCoverageStage): boolean {
  const coverage = getConciergeFlowCoverage(reference);
  return coverage.coveredStages.includes(stage) && Boolean(coverage.evidence[stage]?.trim());
}

function check(
  id: ConciergeLaunchSmokeCheckId,
  details: string[],
): ConciergeLaunchSmokeCheck {
  return {
    id,
    details,
    passed: details.length === 0,
  };
}

function launchRelevantEntries(reference: ConciergeFlowReference): WorkflowEntryPoint[] {
  const coverageEntries = conciergeFlowCoverageEntryPoints(reference);
  const registryEntries = workflowEntryPointsFor(reference);
  const byId = new Map<string, WorkflowEntryPoint>();
  [...coverageEntries, ...registryEntries]
    .filter((entry) => (
      entry.source === "HomeScreen"
      || entry.source === "ConciergeScreen"
      || entry.surface === "voice_action"
    ))
    .forEach((entry) => byId.set(entry.id, entry));
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function entryPointCheck(reference: ConciergeFlowReference): ConciergeLaunchSmokeCheck {
  const flow = getConciergeFlowDefinition(reference);
  const coverageEntries = conciergeFlowCoverageEntryPoints(reference);
  const launchEntries = launchRelevantEntries(reference);
  const expectedVisible = flow.levels.some((level) => level === "main_category" || level === "sub_action" || level === "fast_help");
  const details: string[] = [];

  const wrongCoverageEntries = coverageEntries.filter((entry) => entry.workflow !== reference);
  const wrongLaunchEntries = launchEntries.filter((entry) => entry.workflow !== reference);
  if (coverageEntries.length === 0) details.push("Coverage has no entry point IDs.");
  if (launchEntries.length === 0) details.push("No Home, Concierge, or voice launch entry points found.");
  wrongCoverageEntries.forEach((entry) => details.push(`${entry.id} points to ${entry.workflow} instead of ${reference}.`));
  wrongLaunchEntries.forEach((entry) => details.push(`${entry.id} launches ${entry.workflow} instead of ${reference}.`));

  if (expectedVisible && !coverageEntries.some((entry) => entry.surface !== "voice_action")) {
    details.push("No visible entry point is covered for this user-facing flow.");
  }
  if (flow.levels.includes("voice_handoff") && !coverageEntries.some((entry) => entry.surface === "voice_action")) {
    details.push("No voice handoff entry point is covered.");
  }
  launchEntries
    .filter((entry) => !entry.route)
    .forEach((entry) => details.push(`${entry.id} has no route.`));

  missingConciergeFlowEntryCoverage(reference).forEach((gap) => details.push(`Entry coverage gap: ${gap}.`));
  if (!coverageHasStage(reference, "entry_points")) details.push("Entry-point stage has no coverage evidence.");
  if (!coverageHasStage(reference, "start_action")) details.push("Start-action stage has no coverage evidence.");

  return check("entry_points_open_correct_flow", details);
}

function providerSetupCheck(reference: ConciergeFlowReference): ConciergeLaunchSmokeCheck {
  const needsProvider = conciergeFlowNeedsSavedProvider(reference);
  const expectedFocus = CONCIERGE_LAUNCH_SMOKE_PROVIDER_FOCUS[reference];
  const actualFocus = providerSetupFocusForFlow(reference);
  const details: string[] = [];

  if (needsProvider) {
    if (!expectedFocus) details.push("Provider-required flow has no launch smoke expected setup focus.");
    if (actualFocus !== expectedFocus) details.push(`Expected setup focus ${expectedFocus}, found ${actualFocus ?? "none"}.`);
    if (!coverageHasStage(reference, "missing_provider_setup")) details.push("Missing-provider setup stage is not covered with evidence.");
    if (!coverageHasStage(reference, "provider_unavailable_recovery")) details.push("Provider-unavailable recovery stage is not covered with evidence.");
  } else if (expectedFocus) {
    details.push(`Flow is not provider-required but has launch smoke setup focus ${expectedFocus}.`);
  }

  return check("missing_provider_setup_routes", details);
}

function savedProviderPathCheck(reference: ConciergeFlowReference, task: ConciergeExecutionTask): ConciergeLaunchSmokeCheck {
  const needsProvider = conciergeFlowNeedsSavedProvider(reference);
  const details: string[] = [];

  if (needsProvider) {
    if (!task.provider_ready) details.push("Saved-provider smoke scenario did not mark the provider ready.");
    if (task.missing_requirements.some((requirement) => requirement.key === "provider")) {
      details.push("Saved-provider smoke scenario still asks for a provider.");
    }
    if (!coverageHasStage(reference, "saved_provider_path")) details.push("Saved-provider path stage is not covered with evidence.");
  }
  if (!coverageHasStage(reference, "detail_collection")) details.push("Detail-collection stage is not covered with evidence.");
  if (task.missing_requirements.length > 0) {
    details.push(`Smoke scenario is missing details: ${task.missing_requirements.map((item) => item.key).join(", ")}.`);
  }

  return check("saved_provider_path_collects_details", details);
}

function finalConfirmationCheck(
  reference: ConciergeFlowReference,
  task: ConciergeExecutionTask,
  plan: ConciergeConfirmedExecutionPlan,
): ConciergeLaunchSmokeCheck {
  const flow = getConciergeFlowDefinition(reference);
  const confirmationRule = flow.confirmationRule.toLowerCase();
  const details: string[] = [];

  if (task.confirmation_required !== true) details.push("Execution task does not require confirmation.");
  if (task.user_confirmed) details.push("Pre-confirmation execution task is already marked confirmed.");
  if (!["ready", "needs_info"].includes(task.lifecycle_status)) {
    details.push(`Pre-confirmation task has unexpected lifecycle status ${task.lifecycle_status}.`);
  }
  if (plan.mode === "needs_info") details.push("Confirmed execution plan still needs information.");
  if (!coverageHasStage(reference, "final_user_confirmation")) details.push("Final-confirmation stage is not covered with evidence.");
  if (!/(confirm|before|without|never|ask)/i.test(confirmationRule)) {
    details.push("Confirmation rule does not clearly require user confirmation before action.");
  }

  return check("final_confirmation_gate", details);
}

function handoffAndHistoryCheck(
  reference: ConciergeFlowReference,
  plan: ConciergeConfirmedExecutionPlan,
): ConciergeLaunchSmokeCheck {
  const details: string[] = [];

  (["action_handoff", "outcome_capture", "completed_history"] as const).forEach((stage) => {
    if (!coverageHasStage(reference, stage)) details.push(`${stage} stage is not covered with evidence.`);
  });
  if (plan.mode === "needs_info") details.push("Confirmed plan cannot hand off because it still needs information.");
  if (plan.active_tool === "phone_call" && plan.mode !== "direct_phone_call") {
    details.push("Phone-call flow does not produce a direct-call handoff after confirmation.");
  }
  if (plan.active_tool !== "phone_call" && plan.external_action_allowed) {
    details.push("Non-phone handoff allows an external action instead of using the review queue.");
  }

  return check("handoff_and_completed_history", details);
}

export function buildConciergeLaunchSmokeAudit(): ConciergeLaunchSmokeFlowAudit[] {
  return CONCIERGE_FLOW_REGISTRY.map((flow) => {
    const scenario = CONCIERGE_LAUNCH_SMOKE_SCENARIOS[flow.reference];
    const preliminaryTask = buildConciergeExecutionTask(scenario);
    const channelReadiness = evaluateConciergeChannelReadiness({
      tool: preliminaryTask.active_tool,
      flags: LAUNCH_SMOKE_READY_CHANNEL_FLAGS,
    });
    const scenarioWithReadyChannels = { ...scenario, channelReadiness };
    const task = buildConciergeExecutionTask(scenarioWithReadyChannels);
    const confirmedPlan = planConciergeConfirmedExecution(scenarioWithReadyChannels);
    const checks = [
      entryPointCheck(flow.reference),
      providerSetupCheck(flow.reference),
      savedProviderPathCheck(flow.reference, task),
      finalConfirmationCheck(flow.reference, task, confirmedPlan),
      handoffAndHistoryCheck(flow.reference, confirmedPlan),
    ];

    return {
      reference: flow.reference,
      actionName: flow.actionName,
      scenario,
      entryPoints: launchRelevantEntries(flow.reference),
      task,
      confirmedPlan,
      checks,
      failures: [
        ...missingConciergeFlowCoverage(flow.reference).map((stage) => `Missing coverage stage: ${stage}.`),
        ...checks.flatMap((item) => item.details),
      ],
    };
  });
}

export function validateConciergeLaunchSmokeAudit(
  audit: ConciergeLaunchSmokeFlowAudit[] = buildConciergeLaunchSmokeAudit(),
): ConciergeLaunchSmokeFailure[] {
  return audit.flatMap((flow) => (
    flow.checks
      .filter((checkItem) => !checkItem.passed)
      .map((checkItem) => ({
        reference: flow.reference,
        actionName: flow.actionName,
        check: checkItem.id,
        details: checkItem.details,
      }))
  ));
}
