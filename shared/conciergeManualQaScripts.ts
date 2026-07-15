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
import type { WorkflowEntryPoint } from "./workflowRegistry";

export type ConciergeManualQaStepKind =
  | "start_entry_point"
  | "missing_provider_path"
  | "saved_provider_path"
  | "detail_collection"
  | "final_confirmation"
  | "handoff_history";

export type ConciergeManualQaStepSource = "registry" | "coverage" | "smoke_audit";

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
  finalConfirmationStep: ConciergeManualQaStep;
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

function handoffHistorySteps(reference: ConciergeFlowReference): ConciergeManualQaStep[] {
  const coverage = getConciergeFlowCoverage(reference);
  return (["action_handoff", "outcome_capture", "completed_history"] as const).map((stage) => qaStep({
    id: `${reference}:${stage}`,
    kind: "handoff_history",
    title: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage],
    instruction: `Complete the ${CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage].toLowerCase()} check.`,
    expectedResult: coverage.evidence[stage] ?? `The ${CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage].toLowerCase()} stage is visible and traceable.`,
    source: "coverage",
  }));
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
    const entrySteps = startEntryPointSteps(flow.reference, entryPoints);
    const detailStep = detailCollectionStep(flow.reference, flow.firstQuestions);
    const finalStep = finalConfirmationStep(flow.reference, flow.confirmationRule);
    const historySteps = handoffHistorySteps(flow.reference);
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
      finalConfirmationStep: finalStep,
      handoffHistorySteps: historySteps,
      steps: [
        ...entrySteps,
        ...providerSteps,
        detailStep,
        finalStep,
        ...historySteps,
      ],
    };
  });
}
