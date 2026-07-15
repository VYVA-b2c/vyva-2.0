import type {
  ConciergeManualQaScript,
  ConciergeManualQaStep,
} from "./conciergeManualQaScripts";
import type { ConciergeFlowReference } from "./conciergeFlowRegistry";

export type ConciergeManualQaStatus = "not_tested" | "pass" | "fail" | "needs_review";
export type ConciergeManualQaFlowStatus = "not_tested" | "in_progress" | "passed" | "blocked" | "needs_review";

export const CONCIERGE_MANUAL_QA_STATUS_OPTIONS: Array<{
  id: ConciergeManualQaStatus;
  label: string;
}> = [
  { id: "not_tested", label: "Not tested" },
  { id: "pass", label: "Pass" },
  { id: "fail", label: "Fail" },
  { id: "needs_review", label: "Needs review" },
];

export type ConciergeManualQaRunnerState = Record<string, ConciergeManualQaStatus>;

export interface ConciergeManualQaStepResult {
  step: ConciergeManualQaStep;
  status: ConciergeManualQaStatus;
}

export interface ConciergeManualQaFlowResult {
  reference: ConciergeFlowReference;
  actionName: string;
  status: ConciergeManualQaFlowStatus;
  totalSteps: number;
  counts: Record<ConciergeManualQaStatus, number>;
  failedOrReviewSteps: ConciergeManualQaStepResult[];
}

export interface ConciergeManualQaRunnerSummary {
  totalFlows: number;
  totalSteps: number;
  fullyPassedFlows: number;
  blockedFlows: number;
  needsReviewFlows: number;
  inProgressFlows: number;
  notStartedFlows: number;
  failedCheckpoints: number;
  needsReviewCheckpoints: number;
  passedCheckpoints: number;
  notTestedCheckpoints: number;
  flowResults: ConciergeManualQaFlowResult[];
}

function emptyCounts(): Record<ConciergeManualQaStatus, number> {
  return {
    not_tested: 0,
    pass: 0,
    fail: 0,
    needs_review: 0,
  };
}

function isValidStatus(status: unknown): status is ConciergeManualQaStatus {
  return CONCIERGE_MANUAL_QA_STATUS_OPTIONS.some((option) => option.id === status);
}

export function buildInitialConciergeManualQaRunnerState(
  scripts: ConciergeManualQaScript[],
): ConciergeManualQaRunnerState {
  return Object.fromEntries(
    scripts.flatMap((script) => script.steps.map((step) => [step.id, "not_tested" as const])),
  );
}

export function normalizeConciergeManualQaRunnerState(
  scripts: ConciergeManualQaScript[],
  state: Partial<Record<string, unknown>> | null | undefined,
): ConciergeManualQaRunnerState {
  const initial = buildInitialConciergeManualQaRunnerState(scripts);
  if (!state) return initial;

  for (const stepId of Object.keys(initial)) {
    if (isValidStatus(state[stepId])) {
      initial[stepId] = state[stepId];
    }
  }
  return initial;
}

export function updateConciergeManualQaRunnerStatus(
  state: ConciergeManualQaRunnerState,
  stepId: string,
  status: ConciergeManualQaStatus,
): ConciergeManualQaRunnerState {
  return {
    ...state,
    [stepId]: status,
  };
}

function flowStatus(totalSteps: number, counts: Record<ConciergeManualQaStatus, number>): ConciergeManualQaFlowStatus {
  if (counts.fail > 0) return "blocked";
  if (counts.needs_review > 0) return "needs_review";
  if (counts.pass === totalSteps && totalSteps > 0) return "passed";
  if (counts.not_tested === totalSteps) return "not_tested";
  return "in_progress";
}

export function summarizeConciergeManualQaRunner(
  scripts: ConciergeManualQaScript[],
  state: Partial<Record<string, unknown>> | null | undefined,
): ConciergeManualQaRunnerSummary {
  const normalized = normalizeConciergeManualQaRunnerState(scripts, state);
  const flowResults = scripts.map((script): ConciergeManualQaFlowResult => {
    const counts = emptyCounts();
    const stepResults = script.steps.map((step) => {
      const status = normalized[step.id] ?? "not_tested";
      counts[status] += 1;
      return { step, status };
    });

    return {
      reference: script.reference,
      actionName: script.actionName,
      status: flowStatus(script.steps.length, counts),
      totalSteps: script.steps.length,
      counts,
      failedOrReviewSteps: stepResults.filter((result) => (
        result.status === "fail" || result.status === "needs_review"
      )),
    };
  });

  return {
    totalFlows: flowResults.length,
    totalSteps: flowResults.reduce((total, flow) => total + flow.totalSteps, 0),
    fullyPassedFlows: flowResults.filter((flow) => flow.status === "passed").length,
    blockedFlows: flowResults.filter((flow) => flow.status === "blocked").length,
    needsReviewFlows: flowResults.filter((flow) => flow.status === "needs_review").length,
    inProgressFlows: flowResults.filter((flow) => flow.status === "in_progress").length,
    notStartedFlows: flowResults.filter((flow) => flow.status === "not_tested").length,
    failedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.fail, 0),
    needsReviewCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.needs_review, 0),
    passedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.pass, 0),
    notTestedCheckpoints: flowResults.reduce((total, flow) => total + flow.counts.not_tested, 0),
    flowResults,
  };
}

export function buildConciergeManualQaNotes(
  scripts: ConciergeManualQaScript[],
  state: Partial<Record<string, unknown>> | null | undefined,
): string {
  const summary = summarizeConciergeManualQaRunner(scripts, state);
  const flowsWithNotes = summary.flowResults.filter((flow) => flow.failedOrReviewSteps.length > 0);

  if (flowsWithNotes.length === 0) {
    return "Concierge manual QA notes\n\nNo failed or needs-review checkpoints.";
  }

  const lines = [
    "Concierge manual QA notes",
    "",
    `Blocked flows: ${summary.blockedFlows}`,
    `Needs-review flows: ${summary.needsReviewFlows}`,
    `Failed checkpoints: ${summary.failedCheckpoints}`,
    `Needs-review checkpoints: ${summary.needsReviewCheckpoints}`,
    "",
  ];

  for (const flow of flowsWithNotes) {
    lines.push(`${flow.actionName} (${flow.reference})`);
    for (const result of flow.failedOrReviewSteps) {
      const label = result.status === "fail" ? "Fail" : "Needs review";
      lines.push(`- ${label}: ${result.step.title}`);
      lines.push(`  Expected: ${result.step.expectedResult}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
