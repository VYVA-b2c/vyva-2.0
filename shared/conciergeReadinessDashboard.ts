import {
  CONCIERGE_FLOW_REGISTRY,
  CONCIERGE_PROVIDER_CATEGORIES,
  conciergeFlowNeedsSavedProvider,
  type ConciergeFlowDefinition,
  type ConciergeFlowLevel,
  type ConciergeFlowReference,
  type ConciergeFlowStatus,
  type ConciergeProviderCategoryId,
  type ConciergeSavedDataKey,
  type ConciergeToolRequirement,
} from "./conciergeFlowRegistry";
import {
  CONCIERGE_FLOW_COVERAGE_STAGE_LABELS,
  conciergeFlowCoverageEntryPoints,
  getConciergeFlowCoverage,
  missingConciergeFlowCoverage,
  missingConciergeFlowEntryCoverage,
  type ConciergeFlowCoverageStage,
  type ConciergeFlowEntryCoverageGap,
} from "./conciergeFlowCoverage";
import {
  buildConciergeLaunchSmokeAudit,
  type ConciergeLaunchSmokeCheckId,
  type ConciergeLaunchSmokeFlowAudit,
} from "./conciergeLaunchSmokeAudit";
import {
  buildConciergeManualQaScripts,
  type ConciergeManualQaScript,
} from "./conciergeManualQaScripts";
import type { WorkflowEntryPoint, WorkflowEntrySurface } from "./workflowRegistry";

export type ConciergeReadinessStatus = "ready" | "needs_attention";
export type ConciergeReadinessAuditStatus = "pass" | "needs_attention";

export interface ConciergeReadinessChip<T extends string = string> {
  id: T;
  label: string;
}

export interface ConciergeReadinessEntryPoint {
  id: string;
  label: string;
  surface: WorkflowEntrySurface;
  source: string;
  route: string | null;
}

export interface ConciergeReadinessProviderDependency {
  categoryId: ConciergeProviderCategoryId | null;
  categoryLabel: string | null;
  setupFocusId: ConciergeProviderCategoryId | null;
  setupFocusLabel: string | null;
  needsSavedProvider: boolean;
}

export interface ConciergeReadinessStageStatus {
  id: ConciergeFlowCoverageStage;
  label: string;
  covered: boolean;
  evidence: string | null;
}

export interface ConciergeReadinessLaunchAuditCheck {
  id: ConciergeLaunchSmokeCheckId;
  label: string;
  passed: boolean;
  details: string[];
}

export interface ConciergeReadinessLaunchAudit {
  status: ConciergeReadinessAuditStatus;
  passed: boolean;
  checkCount: number;
  failedCheckCount: number;
  checks: ConciergeReadinessLaunchAuditCheck[];
  failures: string[];
}

export interface ConciergeReadinessRow {
  reference: ConciergeFlowReference;
  actionName: string;
  flowStatus: ConciergeFlowStatus;
  readinessStatus: ConciergeReadinessStatus;
  readyForUsers: boolean;
  levels: Array<ConciergeReadinessChip<ConciergeFlowLevel>>;
  entryPoints: ConciergeReadinessEntryPoint[];
  missingSetup: Array<ConciergeReadinessChip>;
  providerDependency: ConciergeReadinessProviderDependency;
  toolDependencies: Array<ConciergeReadinessChip<ConciergeToolRequirement>>;
  firstQuestions: string[];
  confirmationRule: string;
  finalConfirmation: ConciergeReadinessStageStatus;
  savedProviderPath: ConciergeReadinessStageStatus;
  handoffHistory: ConciergeReadinessStageStatus[];
  launchAudit: ConciergeReadinessLaunchAudit;
  manualQaScript: ConciergeManualQaScript;
  requiredStageCount: number;
  coveredStageCount: number;
  missingStages: Array<ConciergeReadinessChip<ConciergeFlowCoverageStage>>;
  entryGaps: Array<ConciergeReadinessChip<ConciergeFlowEntryCoverageGap>>;
  readinessNotes: string[];
  nextImplementationStep: string | null;
}

export interface ConciergeReadinessSummary {
  total: number;
  ready: number;
  needsAttention: number;
  providerGated: number;
  toolGated: number;
  entryPoints: number;
  launchAuditPassed: number;
  launchAuditNeedsAttention: number;
  launchAuditChecks: number;
}

const FLOW_LEVEL_LABELS: Record<ConciergeFlowLevel, string> = {
  main_category: "Main category",
  sub_action: "Sub-action",
  fast_help: "Fast help",
  voice_handoff: "Voice handoff",
};

const SAVED_DATA_LABELS: Record<ConciergeSavedDataKey, string> = {
  trusted_provider: "Trusted provider",
  coverage: "Insurance / coverage",
  mobility_preferences: "Mobility preferences",
  home_address: "Home address",
  contact_channel: "Contact preference",
  document_or_media: "Document or photo",
};

const TOOL_LABELS: Record<ConciergeToolRequirement, string> = {
  phone_call: "Phone call",
  email: "Email",
  whatsapp: "WhatsApp",
  booking_link: "Booking link",
  camera_or_upload: "Camera / upload",
  web_search: "Web search",
  operator_review: "Operator review",
};

const ENTRY_GAP_LABELS: Record<ConciergeFlowEntryCoverageGap, string> = {
  missing_entry_point: "No entry point",
  missing_visible_entry: "No visible entry",
  missing_concierge_entry: "No Concierge entry",
  missing_voice_handoff: "No voice handoff",
};

const LAUNCH_SMOKE_CHECK_LABELS: Record<ConciergeLaunchSmokeCheckId, string> = {
  entry_points_open_correct_flow: "Entry points open correct flow",
  missing_provider_setup_routes: "Missing provider setup routes",
  saved_provider_path_collects_details: "Saved-provider path collects details",
  final_confirmation_gate: "Final confirmation gate",
  handoff_and_completed_history: "Handoff and completed history",
};

function categoryLabel(categoryId: ConciergeProviderCategoryId | null | undefined): string | null {
  if (!categoryId) return null;
  return CONCIERGE_PROVIDER_CATEGORIES.find((category) => category.id === categoryId)?.label ?? categoryId;
}

function entryPointSummary(entry: WorkflowEntryPoint): ConciergeReadinessEntryPoint {
  return {
    id: entry.id,
    label: entry.label,
    surface: entry.surface,
    source: entry.source,
    route: entry.route ?? null,
  };
}

function missingSetupForFlow(flow: ConciergeFlowDefinition): Array<ConciergeReadinessChip> {
  return flow.savedData.map((key) => {
    if (key === "trusted_provider") {
      const label = categoryLabel(flow.setupFocus ?? flow.providerCategory);
      return {
        id: key,
        label: label ? `Trusted ${label.toLowerCase()}` : SAVED_DATA_LABELS[key],
      };
    }

    return { id: key, label: SAVED_DATA_LABELS[key] };
  });
}

function readinessNotesForFlow(
  flow: ConciergeFlowDefinition,
  missingStages: Array<ConciergeReadinessChip<ConciergeFlowCoverageStage>>,
  entryGaps: Array<ConciergeReadinessChip<ConciergeFlowEntryCoverageGap>>,
  launchAudit: ConciergeReadinessLaunchAudit,
): string[] {
  const notes: string[] = [];
  if (flow.status !== "ready") notes.push(`Flow status is ${flow.status}.`);
  if (missingStages.length > 0) notes.push(`Missing coverage: ${missingStages.map((stage) => stage.label).join(", ")}.`);
  if (entryGaps.length > 0) notes.push(`Entry gap: ${entryGaps.map((gap) => gap.label).join(", ")}.`);
  if (!launchAudit.passed) {
    const failedLabels = launchAudit.checks
      .filter((check) => !check.passed)
      .map((check) => check.label);
    notes.push(`Smoke audit needs attention: ${failedLabels.join(", ")}.`);
  }
  if (notes.length === 0) notes.push("Launch gates covered.");
  return notes;
}

function stageStatus(
  coverage: ReturnType<typeof getConciergeFlowCoverage>,
  stage: ConciergeFlowCoverageStage,
): ConciergeReadinessStageStatus {
  return {
    id: stage,
    label: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage],
    covered: coverage.coveredStages.includes(stage),
    evidence: coverage.evidence[stage] ?? null,
  };
}

function launchAuditSummary(audit: ConciergeLaunchSmokeFlowAudit | undefined): ConciergeReadinessLaunchAudit {
  if (!audit) {
    return {
      status: "needs_attention",
      passed: false,
      checkCount: 0,
      failedCheckCount: 1,
      checks: [{
        id: "entry_points_open_correct_flow",
        label: LAUNCH_SMOKE_CHECK_LABELS.entry_points_open_correct_flow,
        passed: false,
        details: ["No launch smoke audit row found."],
      }],
      failures: ["No launch smoke audit row found."],
    };
  }

  const checks = audit.checks.map((check) => ({
    id: check.id,
    label: LAUNCH_SMOKE_CHECK_LABELS[check.id],
    passed: check.passed,
    details: check.details,
  }));
  const failures = checks.flatMap((check) => check.details);

  return {
    status: failures.length === 0 ? "pass" : "needs_attention",
    passed: failures.length === 0,
    checkCount: checks.length,
    failedCheckCount: checks.filter((check) => !check.passed).length,
    checks,
    failures,
  };
}

export function buildConciergeReadinessRows(options?: {
  launchAudit?: ConciergeLaunchSmokeFlowAudit[];
  manualQaScripts?: ConciergeManualQaScript[];
}): ConciergeReadinessRow[] {
  const launchAudits = options?.launchAudit ?? buildConciergeLaunchSmokeAudit();
  const auditByReference = new Map(
    launchAudits.map((audit) => [audit.reference, audit]),
  );
  const manualScriptByReference = new Map(
    (options?.manualQaScripts ?? buildConciergeManualQaScripts({ launchAudit: launchAudits })).map((script) => [script.reference, script]),
  );

  return CONCIERGE_FLOW_REGISTRY.map((flow) => {
    const coverage = getConciergeFlowCoverage(flow.reference);
    const launchAudit = launchAuditSummary(auditByReference.get(flow.reference));
    const manualQaScript = manualScriptByReference.get(flow.reference);
    if (!manualQaScript) throw new Error(`No Concierge manual QA script found for ${flow.reference}`);
    const missingStages = missingConciergeFlowCoverage(flow.reference).map((stage) => ({
      id: stage,
      label: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage],
    }));
    const entryGaps = missingConciergeFlowEntryCoverage(flow.reference).map((gap) => ({
      id: gap,
      label: ENTRY_GAP_LABELS[gap],
    }));
    const readyForUsers = flow.status === "ready" && missingStages.length === 0 && entryGaps.length === 0 && launchAudit.passed;

    return {
      reference: flow.reference,
      actionName: flow.actionName,
      flowStatus: flow.status,
      readinessStatus: readyForUsers ? "ready" : "needs_attention",
      readyForUsers,
      levels: flow.levels.map((level) => ({ id: level, label: FLOW_LEVEL_LABELS[level] })),
      entryPoints: conciergeFlowCoverageEntryPoints(flow.reference).map(entryPointSummary),
      missingSetup: missingSetupForFlow(flow),
      providerDependency: {
        categoryId: flow.providerCategory ?? null,
        categoryLabel: categoryLabel(flow.providerCategory),
        setupFocusId: flow.setupFocus ?? null,
        setupFocusLabel: categoryLabel(flow.setupFocus),
        needsSavedProvider: conciergeFlowNeedsSavedProvider(flow.reference),
      },
      toolDependencies: flow.tools.map((tool) => ({ id: tool, label: TOOL_LABELS[tool] })),
      firstQuestions: flow.firstQuestions,
      confirmationRule: flow.confirmationRule,
      finalConfirmation: stageStatus(coverage, "final_user_confirmation"),
      savedProviderPath: stageStatus(coverage, "saved_provider_path"),
      handoffHistory: [
        stageStatus(coverage, "action_handoff"),
        stageStatus(coverage, "outcome_capture"),
        stageStatus(coverage, "completed_history"),
      ],
      launchAudit,
      manualQaScript,
      requiredStageCount: coverage.requiredStages.length,
      coveredStageCount: coverage.coveredStages.length,
      missingStages,
      entryGaps,
      readinessNotes: readinessNotesForFlow(flow, missingStages, entryGaps, launchAudit),
      nextImplementationStep: flow.nextImplementationStep ?? null,
    };
  });
}

export function summarizeConciergeReadiness(
  rows: ConciergeReadinessRow[] = buildConciergeReadinessRows(),
): ConciergeReadinessSummary {
  return {
    total: rows.length,
    ready: rows.filter((row) => row.readyForUsers).length,
    needsAttention: rows.filter((row) => !row.readyForUsers).length,
    providerGated: rows.filter((row) => row.providerDependency.needsSavedProvider).length,
    toolGated: rows.filter((row) => row.toolDependencies.length > 0).length,
    entryPoints: rows.reduce((total, row) => total + row.entryPoints.length, 0),
    launchAuditPassed: rows.filter((row) => row.launchAudit.passed).length,
    launchAuditNeedsAttention: rows.filter((row) => !row.launchAudit.passed).length,
    launchAuditChecks: rows.reduce((total, row) => total + row.launchAudit.checkCount, 0),
  };
}
