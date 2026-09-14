import {
  CONCIERGE_FLOW_REGISTRY,
  CONCIERGE_PROVIDER_CATEGORIES,
  conciergeFlowNeedsSavedProvider,
  providerSetupFocusForFlow,
  type ConciergeFlowReference,
  type ConciergeProviderCategoryId,
} from "./conciergeFlowRegistry";
import {
  CONCIERGE_FLOW_COVERAGE_STAGE_LABELS,
  conciergeFlowCoverageEntryPoints,
  getConciergeFlowCoverage,
} from "./conciergeFlowCoverage";
import {
  buildConciergeLaunchSmokeAudit,
  type ConciergeLaunchSmokeFlowAudit,
} from "./conciergeLaunchSmokeAudit";
import {
  getConciergeDryRunFixture,
  type ConciergeDryRunFixture,
} from "./conciergeDryRun";
import type { WorkflowEntryPoint } from "./workflowRegistry";
import {
  getConciergeLiveHandoffQaJourney,
  type ConciergeLiveHandoffQaJourney,
} from "./conciergeLiveHandoffQa";

export type ConciergeManualQaStepKind =
  | "start_entry_point"
  | "missing_provider_path"
  | "saved_provider_path"
  | "detail_collection"
  | "final_confirmation"
  | "handoff_history"
  | "waiting_persistence"
  | "follow_up_confirmation"
  | "dry_run_fixture";

export type ConciergeManualQaStepSource = "registry" | "coverage" | "smoke_audit" | "live_handoff_contract" | "dry_run_fixture";

export interface ConciergeManualQaStep {
  id: string;
  kind: ConciergeManualQaStepKind;
  title: string;
  instruction: string;
  expectedResult: string;
  source: ConciergeManualQaStepSource;
}

export interface ConciergeManualQaEntryPoint {
  id: string;
  label: string;
  surface: WorkflowEntryPoint["surface"];
  source: string;
  route: string | null;
  suggestedFlow: string;
}

export interface ConciergeManualQaProviderPath {
  required: boolean;
  setupFocusId: ConciergeProviderCategoryId | null;
  setupFocusLabel: string | null;
  missingProviderStep: ConciergeManualQaStep | null;
  savedProviderStep: ConciergeManualQaStep | null;
}

export interface ConciergeManualQaSmokeAudit {
  passed: boolean;
  checkCount: number;
  failedCheckCount: number;
  failures: string[];
}

export interface ConciergeManualQaScript {
  reference: ConciergeFlowReference;
  actionName: string;
  smokeAudit: ConciergeManualQaSmokeAudit;
  entryPoints: ConciergeManualQaEntryPoint[];
  detailsToAsk: string[];
  providerPath: ConciergeManualQaProviderPath;
  dryRunFixture: ConciergeDryRunFixture;
  liveHandoffJourney: ConciergeLiveHandoffQaJourney | null;
  finalConfirmationStep: ConciergeManualQaStep;
  liveFollowUpSteps: ConciergeManualQaStep[];
  handoffHistorySteps: ConciergeManualQaStep[];
  steps: ConciergeManualQaStep[];
}

function providerLabel(categoryId: ConciergeProviderCategoryId | null): string | null {
  if (!categoryId) return null;
  return CONCIERGE_PROVIDER_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function entryPointSummary(entry: WorkflowEntryPoint): ConciergeManualQaEntryPoint {
  return {
    id: entry.id,
    label: entry.label,
    surface: entry.surface,
    source: entry.source,
    route: entry.route ?? null,
    suggestedFlow: entry.suggestedFlow,
  };
}

function qaStep(step: ConciergeManualQaStep): ConciergeManualQaStep {
  return step;
}

function startEntryPointSteps(
  reference: ConciergeFlowReference,
  entryPoints: ConciergeManualQaEntryPoint[],
): ConciergeManualQaStep[] {
  return entryPoints.map((entry) => qaStep({
    id: `${reference}:entry:${entry.id}`,
    kind: "start_entry_point",
    title: `Start from ${entry.label}`,
    instruction: `Open ${entry.source}${entry.route ? ` at ${entry.route}` : ""} and choose ${entry.label}.`,
    expectedResult: `The user lands in the ${entry.suggestedFlow} flow without being sent to an unrelated screen.`,
    source: "coverage",
  }));
}

function providerPathForFlow(reference: ConciergeFlowReference, actionName: string): ConciergeManualQaProviderPath {
  const required = conciergeFlowNeedsSavedProvider(reference);
  const setupFocusId = providerSetupFocusForFlow(reference);
  const setupFocusLabel = providerLabel(setupFocusId);
  if (!required) {
    return {
      required: false,
      setupFocusId: null,
      setupFocusLabel: null,
      missingProviderStep: null,
      savedProviderStep: null,
    };
  }

  const providerName = setupFocusLabel ?? "provider";

  return {
    required: true,
    setupFocusId,
    setupFocusLabel,
    missingProviderStep: qaStep({
      id: `${reference}:missing-provider`,
      kind: "missing_provider_path",
      title: "Missing provider path",
      instruction: `Start ${actionName} with no saved trusted ${providerName.toLowerCase()}.`,
      expectedResult: `VYVA routes to Trusted providers focused on ${providerName} before continuing, without treating the flow as a dead end.`,
      source: "coverage",
    }),
    savedProviderStep: qaStep({
      id: `${reference}:saved-provider`,
      kind: "saved_provider_path",
      title: "Saved provider path",
      instruction: `Start ${actionName} with a saved trusted ${providerName.toLowerCase()}.`,
      expectedResult: "VYVA uses the saved provider to prepare the next step, then still waits for final user confirmation before contact, booking, or sending.",
      source: "coverage",
    }),
  };
}

function detailCollectionStep(
  reference: ConciergeFlowReference,
  detailsToAsk: string[],
): ConciergeManualQaStep {
  return qaStep({
    id: `${reference}:details`,
    kind: "detail_collection",
    title: "Ask for needed details",
    instruction: `Confirm VYVA asks only for missing details: ${detailsToAsk.join(", ")}.`,
    expectedResult: "The user can answer naturally by voice or touch, and the task stays in the same Concierge flow.",
    source: "registry",
  });
}

function dryRunFixtureStep(
  reference: ConciergeFlowReference,
  fixture: ConciergeDryRunFixture,
): ConciergeManualQaStep {
  return qaStep({
    id: `${reference}:dry-run-fixture`,
    kind: "dry_run_fixture",
    title: "Dry-run test fixture",
    instruction: `${fixture.checklistPrompt} Use ${fixture.endpoint.label}: ${fixture.endpoint.value}.`,
    expectedResult: "The task is labelled Test mode, no real call/email/form/upload opens, and the simulated outcome can be saved to completed history.",
    source: "dry_run_fixture",
  });
}

function finalConfirmationStep(
  reference: ConciergeFlowReference,
  confirmationRule: string,
): ConciergeManualQaStep {
  const coverage = getConciergeFlowCoverage(reference);
  return qaStep({
    id: `${reference}:final-confirmation`,
    kind: "final_confirmation",
    title: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS.final_user_confirmation,
    instruction: confirmationRule,
    expectedResult: coverage.evidence.final_user_confirmation
      ?? "VYVA shows a final confirmation checkpoint before acting.",
    source: "registry",
  });
}

function handoffHistorySteps(
  reference: ConciergeFlowReference,
  liveJourney: ConciergeLiveHandoffQaJourney | null,
): ConciergeManualQaStep[] {
  const coverage = getConciergeFlowCoverage(reference);
  return (["action_handoff", "outcome_capture", "completed_history"] as const).map((stage) => qaStep({
    id: `${reference}:${stage}`,
    kind: "handoff_history",
    title: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage],
    instruction: liveJourney
      ? stage === "action_handoff"
        ? liveJourney.launchInstruction
        : stage === "outcome_capture"
          ? liveJourney.replyInstruction
          : liveJourney.historyInstruction
      : `Complete the ${CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage].toLowerCase()} check.`,
    expectedResult: liveJourney
      ? stage === "action_handoff"
        ? liveJourney.launchExpectedResult
        : stage === "outcome_capture"
          ? liveJourney.replyExpectedResult
          : liveJourney.historyExpectedResult
      : coverage.evidence[stage] ?? `The ${CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage].toLowerCase()} stage is visible and traceable.`,
    source: liveJourney ? "live_handoff_contract" : "coverage",
  }));
}

function liveFollowUpSteps(
  reference: ConciergeFlowReference,
  liveJourney: ConciergeLiveHandoffQaJourney | null,
): ConciergeManualQaStep[] {
  if (!liveJourney) return [];
  return [
    qaStep({
      id: `${reference}:waiting-persistence`,
      kind: "waiting_persistence",
      title: "Waiting survives reload",
      instruction: liveJourney.waitingInstruction,
      expectedResult: liveJourney.waitingExpectedResult,
      source: "live_handoff_contract",
    }),
    qaStep({
      id: `${reference}:follow-up-confirmation`,
      kind: "follow_up_confirmation",
      title: "No answer and retry confirmation",
      instruction: liveJourney.noAnswerInstruction,
      expectedResult: liveJourney.noAnswerExpectedResult,
      source: "live_handoff_contract",
    }),
  ];
}

function smokeAuditSummary(audit: ConciergeLaunchSmokeFlowAudit | undefined): ConciergeManualQaSmokeAudit {
  if (!audit) {
    return {
      passed: false,
      checkCount: 0,
      failedCheckCount: 1,
      failures: ["No launch smoke audit row found."],
    };
  }

  return {
    passed: audit.failures.length === 0,
    checkCount: audit.checks.length,
    failedCheckCount: audit.checks.filter((check) => !check.passed).length,
    failures: audit.failures,
  };
}

export function buildConciergeManualQaScripts(options?: {
  launchAudit?: ConciergeLaunchSmokeFlowAudit[];
}): ConciergeManualQaScript[] {
  const auditByReference = new Map(
    (options?.launchAudit ?? buildConciergeLaunchSmokeAudit()).map((audit) => [audit.reference, audit]),
  );

  return CONCIERGE_FLOW_REGISTRY.map((flow) => {
    const entryPoints = conciergeFlowCoverageEntryPoints(flow.reference).map(entryPointSummary);
    const providerPath = providerPathForFlow(flow.reference, flow.actionName);
    const dryRunFixture = getConciergeDryRunFixture(flow.reference);
    const liveHandoffJourney = getConciergeLiveHandoffQaJourney(flow.reference);
    const entrySteps = startEntryPointSteps(flow.reference, entryPoints);
    const detailStep = detailCollectionStep(flow.reference, flow.firstQuestions);
    const dryRunStep = dryRunFixtureStep(flow.reference, dryRunFixture);
    const finalStep = finalConfirmationStep(flow.reference, flow.confirmationRule);
    const historySteps = handoffHistorySteps(flow.reference, liveHandoffJourney);
    const followUpSteps = liveFollowUpSteps(flow.reference, liveHandoffJourney);
    const providerSteps = [
      providerPath.missingProviderStep,
      providerPath.savedProviderStep,
    ].filter((step): step is ConciergeManualQaStep => Boolean(step));

    return {
      reference: flow.reference,
      actionName: flow.actionName,
      smokeAudit: smokeAuditSummary(auditByReference.get(flow.reference)),
      entryPoints,
      detailsToAsk: flow.firstQuestions,
      providerPath,
      dryRunFixture,
      liveHandoffJourney,
      finalConfirmationStep: finalStep,
      liveFollowUpSteps: followUpSteps,
      handoffHistorySteps: historySteps,
      steps: [
        ...entrySteps,
        ...providerSteps,
        dryRunStep,
        detailStep,
        finalStep,
        historySteps[0],
        ...followUpSteps,
        ...historySteps.slice(1),
      ],
    };
  });
}
