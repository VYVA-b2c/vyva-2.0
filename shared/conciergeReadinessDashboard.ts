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
import type { WorkflowEntryPoint, WorkflowEntrySurface } from "./workflowRegistry";

export type ConciergeReadinessStatus = "ready" | "needs_attention";

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
): string[] {
  const notes: string[] = [];
  if (flow.status !== "ready") notes.push(`Flow status is ${flow.status}.`);
  if (missingStages.length > 0) notes.push(`Missing coverage: ${missingStages.map((stage) => stage.label).join(", ")}.`);
  if (entryGaps.length > 0) notes.push(`Entry gap: ${entryGaps.map((gap) => gap.label).join(", ")}.`);
  if (notes.length === 0) notes.push("Launch gates covered.");
  return notes;
}

export function buildConciergeReadinessRows(): ConciergeReadinessRow[] {
  return CONCIERGE_FLOW_REGISTRY.map((flow) => {
    const coverage = getConciergeFlowCoverage(flow.reference);
    const missingStages = missingConciergeFlowCoverage(flow.reference).map((stage) => ({
      id: stage,
      label: CONCIERGE_FLOW_COVERAGE_STAGE_LABELS[stage],
    }));
    const entryGaps = missingConciergeFlowEntryCoverage(flow.reference).map((gap) => ({
      id: gap,
      label: ENTRY_GAP_LABELS[gap],
    }));
    const readyForUsers = flow.status === "ready" && missingStages.length === 0 && entryGaps.length === 0;

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
      requiredStageCount: coverage.requiredStages.length,
      coveredStageCount: coverage.coveredStages.length,
      missingStages,
      entryGaps,
      readinessNotes: readinessNotesForFlow(flow, missingStages, entryGaps),
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
  };
}
