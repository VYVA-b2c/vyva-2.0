import { CONCIERGE_FLOW_REFERENCES } from "./conciergeFlowRegistry";
import {
  APP_WORKFLOW_REFERENCES,
  getWorkflowDefinition,
  workflowFlowMatrixRows,
  workflowReadinessChecklist,
  type WorkflowDomain,
  type WorkflowFlowMatrixRow,
  type WorkflowReadinessChecklistRow,
  type WorkflowReference,
} from "./workflowRegistry";

export type CrossPillarManualQaStatus = "not_tested" | "pass" | "fail" | "needs_review";
export type CrossPillarManualQaFlowStatus = "not_tested" | "in_progress" | "passed" | "blocked" | "needs_review";

export const CROSS_PILLAR_MANUAL_QA_STATUS_OPTIONS: Array<{
  id: CrossPillarManualQaStatus;
  label: string;
}> = [
  { id: "not_tested", label: "Not tested" },
  { id: "pass", label: "Pass" },
  { id: "fail", label: "Fail" },
  { id: "needs_review", label: "Needs review" },
];

export type CrossPillarManualQaRunnerState = Record<string, CrossPillarManualQaStatus>;

export type CrossPillarManualQaCheckKind =
  | "missing_setup"
  | "provider_tool_readiness"
  | "final_confirmation"
  | "receipt_moment"
  | "resume_behavior"
  | "language_tone";

export interface CrossPillarManualQaCheck {
  id: string;
  kind: CrossPillarManualQaCheckKind;
  title: string;
  instruction: string;
  expectedResult: string;
}

export interface CrossPillarManualQaFlow {
  reference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  priority: "high" | "standard";
  route?: string;
  checks: CrossPillarManualQaCheck[];
}

export interface CrossPillarManualQaCheckResult {
  check: CrossPillarManualQaCheck;
  status: CrossPillarManualQaStatus;
}

export interface CrossPillarManualQaFlowResult {
  reference: WorkflowReference;
  domain: WorkflowDomain;
  title: string;
  priority: CrossPillarManualQaFlow["priority"];
  status: CrossPillarManualQaFlowStatus;
  totalChecks: number;
  counts: Record<CrossPillarManualQaStatus, number>;
  failedOrReviewChecks: CrossPillarManualQaCheckResult[];
}

export interface CrossPillarManualQaSummary {
  totalFlows: number;
  totalChecks: number;
  fullyPassedFlows: number;
  blockedFlows: number;
  needsReviewFlows: number;
  inProgressFlows: number;
  notStartedFlows: number;
  failedCheckpoints: number;
  needsReviewCheckpoints: number;
  passedCheckpoints: number;
  notTestedCheckpoints: number;
  highPriorityFlows: number;
  highPriorityPassedFlows: number;
  highPriorityBlockedFlows: number;
  flowResults: CrossPillarManualQaFlowResult[];
}

export const CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES: WorkflowReference[] = [
  APP_WORKFLOW_REFERENCES.symptomCheck,
  APP_WORKFLOW_REFERENCES.visualScan,
  APP_WORKFLOW_REFERENCES.medicationPlan,
  APP_WORKFLOW_REFERENCES.medicationSafety,
  APP_WORKFLOW_REFERENCES.doctorNextStep,
  CONCIERGE_FLOW_REFERENCES.safeHomeSupport,
  CONCIERGE_FLOW_REFERENCES.transportBooking,
  CONCIERGE_FLOW_REFERENCES.otcPharmacy,
  CONCIERGE_FLOW_REFERENCES.homeService,
];

export const CROSS_PILLAR_MANUAL_QA_MAJOR_PILLAR_REFERENCES: WorkflowReference[] = [
  APP_WORKFLOW_REFERENCES.healthHub,
  APP_WORKFLOW_REFERENCES.vitalsTracking,
  APP_WORKFLOW_REFERENCES.healthPrevention,
  APP_WORKFLOW_REFERENCES.medicationAdherence,
  APP_WORKFLOW_REFERENCES.learningTodayLesson,
  APP_WORKFLOW_REFERENCES.memoryGames,
  APP_WORKFLOW_REFERENCES.socialRoomList,
  APP_WORKFLOW_REFERENCES.togetherSharePlan,
  CONCIERGE_FLOW_REFERENCES.medicalAppointment,
  CONCIERGE_FLOW_REFERENCES.scamCheck,
  CONCIERGE_FLOW_REFERENCES.shoppingSupport,
];

function emptyCounts(): Record<CrossPillarManualQaStatus, number> {
  return {
    not_tested: 0,
    pass: 0,
    fail: 0,
    needs_review: 0,
  };
}

function isValidStatus(status: unknown): status is CrossPillarManualQaStatus {
  return CROSS_PILLAR_MANUAL_QA_STATUS_OPTIONS.some((option) => option.id === status);
}

function uniqueReferences(references: WorkflowReference[]): WorkflowReference[] {
  return [...new Set(references)];
}

function flowStatus(totalChecks: number, counts: Record<CrossPillarManualQaStatus, number>): CrossPillarManualQaFlowStatus {
  if (counts.fail > 0) return "blocked";
  if (counts.needs_review > 0) return "needs_review";
  if (counts.pass === totalChecks && totalChecks > 0) return "passed";
  if (counts.not_tested === totalChecks) return "not_tested";
  return "in_progress";
}

function matrixByReference(): Map<WorkflowReference, WorkflowFlowMatrixRow> {
  return new Map(workflowFlowMatrixRows().map((row) => [row.reference, row]));
}

function checkId(reference: WorkflowReference, kind: CrossPillarManualQaCheckKind): string {
  return `${reference}:${kind}`;
}

function languageToneExpectation(row: WorkflowFlowMatrixRow): string {
  if (row.domain === "health" || row.domain === "medication") {
    return "Copy is short, calm, localized, avoids diagnosis or medication promises, and clearly points to urgent help when needed.";
  }
  if (row.domain === "concierge") {
    return "Copy is short, calm, localized, explains what VYVA will prepare, and never implies an external action already happened.";
  }
  if (row.domain === "community" || row.domain === "room") {
    return "Copy is short, warm, localized, and keeps participation pressure-free.";
  }
  return "Copy is short, senior-friendly, localized, and makes the next user action visually clear.";
}

function buildChecks(row: WorkflowFlowMatrixRow, readiness: WorkflowReadinessChecklistRow): CrossPillarManualQaCheck[] {
  const toolGate = readiness.gates.find((gate) => gate.kind === "tool_readiness");
  const profileGate = readiness.gates.find((gate) => gate.kind === "profile_data");
  const setupGate = readiness.gates.find((gate) => gate.kind === "setup_fallback");

  return [
    {
      id: checkId(row.reference, "missing_setup"),
      kind: "missing_setup",
      title: "Missing setup path",
      instruction: "Start the flow without the saved setup it expects.",
      expectedResult: row.missingSetupFallback || setupGate?.detail || "The flow does not dead-end and gives a clear next step.",
    },
    {
      id: checkId(row.reference, "provider_tool_readiness"),
      kind: "provider_tool_readiness",
      title: "Provider or tool readiness",
      instruction: "Check whether the flow needs a provider, contact channel, device, upload, search, call, email, booking link, or operator review.",
      expectedResult: toolGate
        ? `${toolGate.detail} Profile/source check: ${profileGate?.detail ?? row.profileDataSourceLabels}.`
        : `No external tool should be required unless the flow explicitly routes to Concierge. Profile/source check: ${profileGate?.detail ?? row.profileDataSourceLabels}.`,
    },
    {
      id: checkId(row.reference, "final_confirmation"),
      kind: "final_confirmation",
      title: "Final confirmation",
      instruction: "Reach the moment before saving, sending, calling, uploading, booking, sharing, or changing anything important.",
      expectedResult: row.confirmationRule,
    },
    {
      id: checkId(row.reference, "receipt_moment"),
      kind: "receipt_moment",
      title: "Receipt or confirmation moment",
      instruction: "Complete or prepare the flow and check what the user sees immediately after.",
      expectedResult: row.receiptMoment,
    },
    {
      id: checkId(row.reference, "resume_behavior"),
      kind: "resume_behavior",
      title: "Resume behavior",
      instruction: "Leave the flow and return from Home or the original screen.",
      expectedResult: row.resumeBehavior,
    },
    {
      id: checkId(row.reference, "language_tone"),
      kind: "language_tone",
      title: "Language and tone",
      instruction: "Review English plus localized strings for clarity, brevity, and safety.",
      expectedResult: languageToneExpectation(row),
    },
  ];
}

export function buildCrossPillarManualQaFlows(
  references: WorkflowReference[] = uniqueReferences([
    ...CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES,
    ...CROSS_PILLAR_MANUAL_QA_MAJOR_PILLAR_REFERENCES,
  ]),
): CrossPillarManualQaFlow[] {
  const matrix = matrixByReference();
  return references.map((reference) => {
    const row = matrix.get(reference);
    if (!row) throw new Error(`No workflow matrix row found for ${reference}`);
    const definition = getWorkflowDefinition(reference);
    const readiness = workflowReadinessChecklist(reference);
    return {
      reference,
      domain: row.domain,
      title: row.title,
      priority: CROSS_PILLAR_MANUAL_QA_HIGH_RISK_REFERENCES.includes(reference) ? "high" : "standard",
      route: definition.primaryRoute,
      checks: buildChecks(row, readiness),
    };
  });
}

export function buildInitialCrossPillarManualQaRunnerState(
  flows: CrossPillarManualQaFlow[],
): CrossPillarManualQaRunnerState {
  return Object.fromEntries(
    flows.flatMap((flow) => flow.checks.map((check) => [check.id, "not_tested" as const])),
  );
}

export function normalizeCrossPillarManualQaRunnerState(
  flows: CrossPillarManualQaFlow[],
  state: Partial<Record<string, unknown>> | null | undefined,
): CrossPillarManualQaRunnerState {
  const initial = buildInitialCrossPillarManualQaRunnerState(flows);
  if (!state) return initial;

  for (const checkIdValue of Object.keys(initial)) {
    if (isValidStatus(state[checkIdValue])) {
      initial[checkIdValue] = state[checkIdValue];
    }
  }
  return initial;
}

export function updateCrossPillarManualQaRunnerStatus(
  state: CrossPillarManualQaRunnerState,
  checkIdValue: string,
  status: CrossPillarManualQaStatus,
): CrossPillarManualQaRunnerState {
  return {
    ...state,
    [checkIdValue]: status,
  };
}

export function summarizeCrossPillarManualQaRunner(
  flows: CrossPillarManualQaFlow[],
  state: Partial<Record<string, unknown>> | null | undefined,
): CrossPillarManualQaSummary {
  const normalized = normalizeCrossPillarManualQaRunnerState(flows, state);
  const flowResults = flows.map((flow): CrossPillarManualQaFlowResult => {
    const counts = emptyCounts();
    const checkResults = flow.checks.map((check) => {
      const status = normalized[check.id] ?? "not_tested";
      counts[status] += 1;
      return { check, status };
    });

    return {
      reference: flow.reference,
      domain: flow.domain,
      title: flow.title,
      priority: flow.priority,
      status: flowStatus(flow.checks.length, counts),
      totalChecks: flow.checks.length,
      counts,
      failedOrReviewChecks: checkResults.filter((result) => (
        result.status === "fail" || result.status === "needs_review"
      )),
    };
  });
  const highPriorityResults = flowResults.filter((flow) => flow.priority === "high");

  return {
    totalFlows: flowResults.length,
    totalChecks: flowResults.reduce((total, flow) => total + flow.totalChecks, 0),
    fullyPassedFlows: flowResults.filter((flow) => flow.status === "passed").length,
    blockedFlows: flowResults.filter((flow) => flow.status === "blocked").length,
    needsReviewFlows: flowResults.filter((flow) => flow.status === "needs_review").length,
    inProgressFlows: flowResults.filter((flow) => flow.status === "in_progress").length,
    notStartedFlows: flowResults.filter((flow) => flow.status === "not_tested").length,
    failedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.fail, 0),
    needsReviewCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.needs_review, 0),
    passedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.pass, 0),
    notTestedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.not_tested, 0),
    highPriorityFlows: highPriorityResults.length,
    highPriorityPassedFlows: highPriorityResults.filter((flow) => flow.status === "passed").length,
    highPriorityBlockedFlows: highPriorityResults.filter((flow) => flow.status === "blocked").length,
    flowResults,
  };
}

export function buildCrossPillarManualQaNotes(
  flows: CrossPillarManualQaFlow[],
  state: Partial<Record<string, unknown>> | null | undefined,
): string {
  const summary = summarizeCrossPillarManualQaRunner(flows, state);
  const flowsWithNotes = summary.flowResults.filter((flow) => flow.failedOrReviewChecks.length > 0);

  if (flowsWithNotes.length === 0) {
    return "Cross-pillar manual QA notes\n\nNo failed or needs-review checkpoints.";
  }

  const lines = [
    "Cross-pillar manual QA notes",
    "",
    `Flows passed: ${summary.fullyPassedFlows}/${summary.totalFlows}`,
    `Blocked flows: ${summary.blockedFlows}`,
    `Needs-review flows: ${summary.needsReviewFlows}`,
    `Failed checkpoints: ${summary.failedCheckpoints}`,
    `Needs-review checkpoints: ${summary.needsReviewCheckpoints}`,
    "",
  ];

  for (const flow of flowsWithNotes) {
    lines.push(`${flow.title} (${flow.reference})`);
    for (const result of flow.failedOrReviewChecks) {
      const label = result.status === "fail" ? "Fail" : "Needs review";
      lines.push(`- ${label}: ${result.check.title}`);
      lines.push(`  Expected: ${result.check.expectedResult}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
