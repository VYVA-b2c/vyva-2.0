import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleDashed, Filter, Route, Search } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import {
  WORKFLOW_DEFINITIONS,
  WORKFLOW_ACTION_LEVEL_LABELS,
  WORKFLOW_ACTION_LEVELS,
  WORKFLOW_ACTION_LEVEL_RULES,
  WORKFLOW_DOMAINS,
  WORKFLOW_PARITY_STATUS_LABELS,
  WORKFLOW_REUSABLE_PATTERN_LABELS,
  type WorkflowActionLevel,
  type WorkflowActionLookup,
  type WorkflowCoverageState,
  type WorkflowDefinition,
  type WorkflowDomain,
  type WorkflowFlowMatrixRow,
  type WorkflowFlowStatus,
  type WorkflowParityAuditItem,
  type WorkflowParityStatus,
  type WorkflowReadinessChecklistRow,
  type WorkflowReadinessGate,
  type WorkflowReference,
  getWorkflowCoverageSummary,
  getWorkflowParityAuditSummary,
  getWorkflowParityBacklog,
  nextWorkflowImplementationCandidates,
  workflowFlowMatrixRows,
  workflowReadinessChecklistRows,
  workflowActionsForTarget,
  workflowCoverageState,
} from "../../../shared/workflowRegistry";
import {
  CROSS_PILLAR_MANUAL_QA_STATUS_OPTIONS,
  buildCrossPillarManualQaFlows,
  buildCrossPillarManualQaNotes,
  normalizeCrossPillarManualQaRunnerState,
  summarizeCrossPillarManualQaRunner,
  updateCrossPillarManualQaRunnerStatus,
  type CrossPillarManualQaFlow,
  type CrossPillarManualQaRunnerState,
  type CrossPillarManualQaStatus,
} from "../../../shared/crossPillarManualQa";
import type { HomeFastHelpActionId, HomeFastHelpOutcomeAggregate } from "../../../shared/homeFastHelpSync";
import { buildWorkflowReceiptMoment } from "../../../shared/workflowReceiptMoments";
import {
  CROSS_PILLAR_PRIMARY_ACTION_IDS,
  evaluateCrossPillarActionToolReadiness,
  type CrossPillarToolEvidence,
  type CrossPillarToolFamily,
  type CrossPillarToolReadinessStatus,
} from "../../../shared/crossPillarToolReadiness";
import {
  CROSS_PILLAR_HANDOFF_EVENT,
  CROSS_PILLAR_HANDOFF_STORAGE_KEY,
  type CrossPillarHandoffRecord,
} from "@/lib/crossPillarHandoffExecution";

type DomainFilter = "all" | WorkflowDomain;
type CoverageFilter = "all" | "incomplete" | WorkflowCoverageState;
type ActionLevelFilter = "all" | WorkflowActionLevel;
type CrossPillarToolReadinessResponse = {
  generated_at: string;
  tools: CrossPillarToolEvidence[];
};

const TOOL_STATUS_LABELS: Record<CrossPillarToolReadinessStatus, string> = {
  ready: "Ready",
  setup_needed: "Setup needed",
  temporarily_unavailable: "Temporarily unavailable",
  manual_help_required: "Manual help required",
};

const TOOL_STATUS_CLASS: Record<CrossPillarToolReadinessStatus, string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  setup_needed: "border-amber-200 bg-amber-50 text-amber-800",
  temporarily_unavailable: "border-orange-200 bg-orange-50 text-orange-800",
  manual_help_required: "border-red-200 bg-red-50 text-red-800",
};

const CROSS_PILLAR_MANUAL_QA_STORAGE_KEY = "vyva:admin:crossPillarManualQa:v1";

function readCrossPillarHandoffHistory(): CrossPillarHandoffRecord[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CROSS_PILLAR_HANDOFF_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const DOMAIN_LABELS: Record<WorkflowDomain, string> = {
  home: "Home",
  health: "Health",
  medication: "Medication",
  mind_memory: "Mind & Memory",
  learning: "Learning",
  community: "Community",
  room: "Rooms",
  game: "Games",
  concierge: "Concierge",
  profile: "Profile setup",
};

const COVERAGE_LABELS: Record<WorkflowCoverageState, string> = {
  complete: "Complete",
  partial: "Partial",
  missing: "Missing",
};

const FAST_HELP_LABELS: Record<HomeFastHelpActionId, string> = {
  "feel-better": "Symptoms check",
  "stay-well": "Age well",
  "find-care": "Find care",
  "book-ride": "Book ride",
  "paperwork-help": "Paperwork",
  "safe-home": "Safe home",
};

const COVERAGE_CLASS: Record<WorkflowCoverageState, string> = {
  complete: "border-emerald-100 bg-emerald-50 text-emerald-800",
  partial: "border-amber-100 bg-amber-50 text-amber-800",
  missing: "border-red-100 bg-red-50 text-red-700",
};

const ACTION_LEVEL_CLASS: Record<WorkflowActionLevel, string> = {
  light: "border-sky-100 bg-sky-50 text-sky-800",
  guided: "border-violet-100 bg-violet-50 text-violet-800",
  external_action: "border-amber-100 bg-amber-50 text-amber-800",
  setup: "border-teal-100 bg-teal-50 text-teal-800",
  admin: "border-slate-200 bg-slate-50 text-slate-700",
};

const PARITY_CLASS: Record<WorkflowParityStatus, string> = {
  ready: "border-emerald-100 bg-emerald-50 text-emerald-800",
  partial: "border-amber-100 bg-amber-50 text-amber-800",
  missing_resume: "border-orange-100 bg-orange-50 text-orange-800",
  missing_confirmation: "border-red-100 bg-red-50 text-red-700",
  missing_setup_path: "border-rose-100 bg-rose-50 text-rose-700",
  needs_tool_service: "border-sky-100 bg-sky-50 text-sky-800",
};

const FLOW_STATUS_CLASS: Record<WorkflowFlowStatus, string> = {
  ready: "border-emerald-100 bg-emerald-50 text-emerald-800",
  partial: "border-amber-100 bg-amber-50 text-amber-800",
  ui_only: "border-blue-100 bg-blue-50 text-blue-800",
  blocked: "border-red-100 bg-red-50 text-red-700",
};

const READINESS_GATE_CLASS: Record<WorkflowReadinessGate["state"], string> = {
  ready: "border-emerald-100 bg-emerald-50 text-emerald-800",
  needs_attention: "border-amber-100 bg-amber-50 text-amber-800",
};

const MANUAL_QA_STATUS_CLASS: Record<CrossPillarManualQaStatus, string> = {
  not_tested: "border-[#eadfd5] bg-white text-[#7d6b65]",
  pass: "border-emerald-100 bg-emerald-50 text-emerald-800",
  fail: "border-red-100 bg-red-50 text-red-700",
  needs_review: "border-amber-100 bg-amber-50 text-amber-800",
};

function coverageIcon(state: WorkflowCoverageState) {
  if (state === "complete") return <CheckCircle2 size={16} aria-hidden="true" />;
  if (state === "partial") return <AlertTriangle size={16} aria-hidden="true" />;
  return <CircleDashed size={16} aria-hidden="true" />;
}

function coverageClass(state: WorkflowCoverageState) {
  return COVERAGE_CLASS[state];
}

function actionLevelClass(level: WorkflowActionLevel) {
  return ACTION_LEVEL_CLASS[level];
}

function parityClass(status: WorkflowParityStatus) {
  return PARITY_CLASS[status];
}

function flowStatusClass(status: WorkflowFlowStatus) {
  return FLOW_STATUS_CLASS[status];
}

function readinessGateClass(state: WorkflowReadinessGate["state"]) {
  return READINESS_GATE_CLASS[state];
}

function domainLabel(domain: WorkflowDomain) {
  return DOMAIN_LABELS[domain];
}

function workflowNeedle(workflow: WorkflowDefinition, actions: WorkflowActionLookup[]) {
  return [
    workflow.title,
    workflow.summary,
    workflow.domain,
    workflow.status,
    workflow.actionLevel,
    workflow.nextStep,
    workflow.confirmationRule,
    workflow.completionState,
    ...actions.flatMap((action) => [
      action.label,
      action.source,
      action.route,
      action.suggestedFlow,
    ]),
  ].join(" ").toLowerCase();
}

function matchesCoverageFilter(state: WorkflowCoverageState, filter: CoverageFilter) {
  if (filter === "all") return true;
  if (filter === "incomplete") return state !== "complete";
  return state === filter;
}

function SummaryCard({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: number;
  tone?: "plain" | WorkflowCoverageState;
}) {
  const toneClass = tone === "plain" ? "border-[#eadfd5] bg-white text-[#2f2135]" : coverageClass(tone);

  return (
    <div className={`rounded-[14px] border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function insightRate(numerator: number, denominator: number) {
  if (denominator <= 0) return "--";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function InsightCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#2f2135]">{value}</p>
    </div>
  );
}

function ParityBacklogCard({ item }: { item: WorkflowParityAuditItem }) {
  return (
    <article className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-purple-700">
              {domainLabel(item.domain)}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${parityClass(item.status)}`}>
              {WORKFLOW_PARITY_STATUS_LABELS[item.status]}
            </span>
            <span className="rounded-full border border-[#eadfd5] bg-[#fffaf4] px-2.5 py-1 text-xs font-black text-[#7d6b65]">
              Priority {item.backlogPriority}
            </span>
          </div>
          <h3 className="mt-2 font-serif text-2xl leading-tight text-[#2f2135]">{item.title}</h3>
        </div>
        <code className="shrink-0 rounded-xl bg-[#f7f2eb] px-3 py-2 text-xs font-bold text-[#6f5f59]">
          {item.workflowReference}
        </code>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Evidence</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-[#2f2135]">{item.evidence}</p>
        </div>
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Next step</p>
          <p className="mt-1 text-sm font-bold leading-relaxed text-[#2f2135]">{item.nextStep}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.reusablePatterns.length === 0 ? (
          <span className="rounded-full border border-[#eadfd5] bg-[#fffaf4] px-3 py-1.5 text-xs font-bold text-[#7d6b65]">
            No Concierge pattern needed
          </span>
        ) : (
          item.reusablePatterns.map((pattern) => (
            <span
              key={pattern}
              className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-black text-teal-800"
            >
              {WORKFLOW_REUSABLE_PATTERN_LABELS[pattern]}
            </span>
          ))
        )}
      </div>
      <p className="mt-3 text-xs font-bold text-[#8b7a73]">
        Covers {item.affectedEntryPointIds.length} entry point{item.affectedEntryPointIds.length === 1 ? "" : "s"}.
      </p>
    </article>
  );
}

function EntryPointList({ actions }: { actions: WorkflowActionLookup[] }) {
  if (actions.length === 0) {
    return <p className="text-sm font-semibold text-[#8b7a73]">No entry points mapped yet.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <span
          key={action.entryPointId}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#eadfd5] bg-[#fffaf4] px-3 py-1.5 text-xs font-bold text-[#5b4a46]"
          title={action.suggestedFlow}
        >
          <Route size={13} aria-hidden="true" />
          <span className="truncate">{action.label}</span>
          <span className="text-[#9c8a82]">{action.surface.replace("_", " ")}</span>
        </span>
      ))}
    </div>
  );
}

function WorkflowRow({
  workflow,
  actions,
}: {
  workflow: WorkflowDefinition;
  actions: WorkflowActionLookup[];
}) {
  const state = workflowCoverageState(workflow.status);
  const level = actions[0]?.actionLevel ?? "guided";
  const receiptPreview = buildWorkflowReceiptMoment({ workflowReference: workflow.reference });

  return (
    <article
      data-testid={`workflow-row-${workflow.reference}`}
      className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-purple-700">
              {domainLabel(workflow.domain)}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${coverageClass(state)}`}>
              {coverageIcon(state)}
              {COVERAGE_LABELS[state]}
            </span>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-black ${actionLevelClass(level)}`}
              title={WORKFLOW_ACTION_LEVEL_RULES[level]}
            >
              {WORKFLOW_ACTION_LEVEL_LABELS[level]}
            </span>
          </div>
          <h3 className="mt-2 font-serif text-2xl leading-tight text-[#2f2135]">{workflow.title}</h3>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#6f5f59]">{workflow.summary}</p>
        </div>
        <code className="shrink-0 rounded-xl bg-[#f7f2eb] px-3 py-2 text-xs font-bold text-[#6f5f59]">
          {workflow.reference}
        </code>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Next step</p>
          <p className="mt-1 text-sm font-bold text-[#2f2135]">{workflow.nextStep ?? "Keep current flow available."}</p>
        </div>
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Confirmation</p>
          <p className="mt-1 text-sm font-bold text-[#2f2135]">{workflow.confirmationRule}</p>
        </div>
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Done when</p>
          <p className="mt-1 text-sm font-bold text-[#2f2135]">{workflow.completionState}</p>
        </div>
        <div className="rounded-[12px] bg-[#fbf8f5] p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Receipt moment</p>
          <p className="mt-1 text-sm font-bold text-[#2f2135]">{receiptPreview.title}</p>
          <p className="mt-1 text-xs font-bold text-[#7d6b65]">{receiptPreview.primaryActionLabel}</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Entry points</p>
        <EntryPointList actions={actions} />
      </div>
    </article>
  );
}

function MatrixCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#9c8a82]">{label}</p>
      <p className="mt-1 text-sm font-bold leading-snug text-[#2f2135]">{value}</p>
    </div>
  );
}

function FlowMatrixTable({ rows }: { rows: WorkflowFlowMatrixRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 rounded-xl bg-[#fbf8f5] p-4 text-sm font-bold text-[#7d6b65]">No matrix rows match the current filters.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto" data-testid="workflow-flow-matrix">
      <table className="w-full min-w-[1320px] text-left align-top text-sm">
        <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
          <tr>
            <th className="px-3 py-2">Flow</th>
            <th className="px-3 py-2">Entry points</th>
            <th className="px-3 py-2">Required setup</th>
            <th className="px-3 py-2">Profile feed</th>
            <th className="px-3 py-2">Missing setup</th>
            <th className="px-3 py-2">Find options</th>
            <th className="px-3 py-2">Confirm / receipt / resume</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.reference} className="border-t border-[#f0e7df]" data-testid={`workflow-matrix-row-${row.reference}`}>
              <td className="max-w-[220px] px-3 py-3">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${flowStatusClass(row.currentStatus)}`}>
                  {row.currentStatusLabel}
                </span>
                <p className="mt-2 font-black text-[#2f2135]">{row.title}</p>
                <code className="mt-1 block text-xs font-bold text-[#8b7a73]">{row.reference}</code>
              </td>
              <td className="max-w-[220px] px-3 py-3">
                <p className="font-bold text-[#2f2135]">{row.entryPoints.length} mapped</p>
                <p className="mt-1 text-xs font-semibold leading-snug text-[#7d6b65]">
                  {row.entryPoints.slice(0, 3).map((entry) => entry.label).join(", ")}
                  {row.entryPoints.length > 3 ? "..." : ""}
                </p>
              </td>
              <td className="max-w-[220px] px-3 py-3 font-bold leading-snug text-[#2f2135]">{row.requiredSetup}</td>
              <td className="max-w-[220px] px-3 py-3 font-bold leading-snug text-[#2f2135]">{row.profileDataSourceLabels}</td>
              <td className="max-w-[260px] px-3 py-3 font-bold leading-snug text-[#2f2135]">{row.missingSetupFallback}</td>
              <td className="max-w-[260px] px-3 py-3 font-bold leading-snug text-[#2f2135]">{row.findOptionsPath}</td>
              <td className="min-w-[320px] px-3 py-3">
                <div className="grid gap-3">
                  <MatrixCell label="Confirmation" value={row.confirmationRule} />
                  <MatrixCell label="Receipt" value={row.receiptMoment} />
                  <MatrixCell label="Resume" value={row.resumeBehavior} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReadinessGatePill({ gate }: { gate: WorkflowReadinessGate }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${readinessGateClass(gate.state)}`}
      title={gate.detail}
    >
      {gate.state === "ready" ? <CheckCircle2 size={12} aria-hidden="true" /> : <AlertTriangle size={12} aria-hidden="true" />}
      {gate.label}
    </span>
  );
}

function ReadinessChecklistTable({ rows }: { rows: WorkflowReadinessChecklistRow[] }) {
  if (rows.length === 0) {
    return <p className="mt-4 rounded-xl bg-[#fbf8f5] p-4 text-sm font-bold text-[#7d6b65]">No readiness rows match the current filters.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto" data-testid="workflow-readiness-checklist">
      <table className="w-full min-w-[980px] text-left align-top text-sm">
        <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
          <tr>
            <th className="px-3 py-2">Flow</th>
            <th className="px-3 py-2">Level</th>
            <th className="px-3 py-2">Readiness gates</th>
            <th className="px-3 py-2">Attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.reference} className="border-t border-[#f0e7df]" data-testid={`workflow-readiness-row-${row.reference}`}>
              <td className="max-w-[260px] px-3 py-3">
                <p className="font-black text-[#2f2135]">{row.title}</p>
                <code className="mt-1 block text-xs font-bold text-[#8b7a73]">{row.reference}</code>
              </td>
              <td className="px-3 py-3">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${actionLevelClass(row.actionLevel)}`}>
                  {WORKFLOW_ACTION_LEVEL_LABELS[row.actionLevel]}
                </span>
              </td>
              <td className="max-w-[560px] px-3 py-3">
                <div className="flex flex-wrap gap-2">
                  {row.gates.map((gate) => (
                    <ReadinessGatePill key={gate.kind} gate={gate} />
                  ))}
                </div>
              </td>
              <td className="max-w-[240px] px-3 py-3 font-bold text-[#2f2135]">
                {row.needsAttention.length === 0 ? "All required gates mapped" : row.needsAttention.join(", ").replace(/_/g, " ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function readStoredCrossPillarQaState(flows: CrossPillarManualQaFlow[]): CrossPillarManualQaRunnerState {
  if (typeof window === "undefined") return normalizeCrossPillarManualQaRunnerState(flows, null);
  try {
    const raw = window.localStorage.getItem(CROSS_PILLAR_MANUAL_QA_STORAGE_KEY);
    return normalizeCrossPillarManualQaRunnerState(flows, raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeCrossPillarManualQaRunnerState(flows, null);
  }
}

function writeStoredCrossPillarQaState(state: CrossPillarManualQaRunnerState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CROSS_PILLAR_MANUAL_QA_STORAGE_KEY, JSON.stringify(state));
}

function ManualQaStatusButton({
  active,
  label,
  status,
  onClick,
}: {
  active: boolean;
  label: string;
  status: CrossPillarManualQaStatus;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${MANUAL_QA_STATUS_CLASS[status]} ${
        active ? "ring-2 ring-purple-200" : ""
      }`}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function ManualQaRunner({
  flows,
  runnerState,
  notes,
  onStatusChange,
  onCopyNotes,
  onReset,
}: {
  flows: CrossPillarManualQaFlow[];
  runnerState: CrossPillarManualQaRunnerState;
  notes: string;
  onStatusChange: (checkId: string, status: CrossPillarManualQaStatus) => void;
  onCopyNotes: () => void;
  onReset: () => void;
}) {
  const summary = summarizeCrossPillarManualQaRunner(flows, runnerState);
  const resultsByReference = new Map(summary.flowResults.map((result) => [result.reference, result]));

  return (
    <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Cross-pillar manual QA runner">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Manual QA runner</p>
          <h2 className="mt-1 font-serif text-3xl leading-tight">Prove the real flow, not just the map</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-[#7d6b65]">
            Start with high-risk flows, mark each checkpoint, then copy failed notes into PRs or tasks.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCopyNotes}
            className="min-h-11 rounded-xl bg-purple-700 px-4 text-sm font-black text-white"
          >
            Copy QA notes
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 text-sm font-black text-purple-700"
          >
            Reset QA
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <InsightCard label="Flows passed" value={`${summary.fullyPassedFlows}/${summary.totalFlows}`} />
        <InsightCard label="High-risk passed" value={`${summary.highPriorityPassedFlows}/${summary.highPriorityFlows}`} />
        <InsightCard label="Blocked" value={summary.blockedFlows} />
        <InsightCard label="Needs review" value={summary.needsReviewFlows} />
        <InsightCard label="Failed checks" value={summary.failedCheckpoints} />
      </div>

      <div className="mt-4 grid gap-3">
        {flows.map((flow) => {
          const result = resultsByReference.get(flow.reference);
          return (
            <article
              key={flow.reference}
              className="rounded-[14px] border border-[#eadfd5] bg-[#fffaf4] p-4"
              data-testid={`cross-pillar-qa-flow-${flow.reference}`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                      flow.priority === "high" ? "border-red-100 bg-red-50 text-red-700" : "border-[#eadfd5] bg-white text-[#7d6b65]"
                    }`}>
                      {flow.priority === "high" ? "High risk" : "Standard"}
                    </span>
                    <span className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-purple-700">
                      {domainLabel(flow.domain)}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${
                      result?.status === "passed" ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                      : result?.status === "blocked" ? "border-red-100 bg-red-50 text-red-700"
                      : result?.status === "needs_review" ? "border-amber-100 bg-amber-50 text-amber-800"
                      : "border-[#eadfd5] bg-white text-[#7d6b65]"
                    }`}>
                      {(result?.status ?? "not_tested").replace(/_/g, " ")}
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-2xl leading-tight text-[#2f2135]">{flow.title}</h3>
                  <code className="mt-1 block text-xs font-bold text-[#8b7a73]">{flow.reference}</code>
                </div>
                {flow.route ? (
                  <span className="rounded-xl bg-white px-3 py-2 text-xs font-black text-[#7d6b65]">{flow.route}</span>
                ) : null}
              </div>

              <div className="mt-3 grid gap-3">
                {flow.checks.map((check) => {
                  const currentStatus = runnerState[check.id] ?? "not_tested";
                  return (
                    <div key={check.id} className="rounded-[12px] bg-white p-3" data-testid={`cross-pillar-qa-check-${check.id}`}>
                      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                        <div>
                          <p className="text-sm font-black text-[#2f2135]">{check.title}</p>
                          <p className="mt-1 text-sm font-semibold leading-relaxed text-[#6f5f59]">{check.instruction}</p>
                          <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Expected</p>
                          <p className="mt-1 text-sm font-bold leading-relaxed text-[#2f2135]">{check.expectedResult}</p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          {CROSS_PILLAR_MANUAL_QA_STATUS_OPTIONS.map((option) => (
                            <ManualQaStatusButton
                              key={option.id}
                              active={currentStatus === option.id}
                              label={option.label}
                              status={option.id}
                              onClick={() => onStatusChange(check.id, option.id)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">QA notes</span>
        <textarea
          readOnly
          value={notes}
          className="mt-2 min-h-[160px] w-full rounded-xl border border-[#eadfd5] bg-[#fbf8f5] p-3 font-mono text-xs font-semibold text-[#2f2135]"
        />
      </label>
    </section>
  );
}

export default function WorkflowCoverageAdminPage() {
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("incomplete");
  const [actionLevelFilter, setActionLevelFilter] = useState<ActionLevelFilter>("all");
  const [query, setQuery] = useState("");
  const summary = useMemo(() => getWorkflowCoverageSummary(), []);
  const paritySummary = useMemo(() => getWorkflowParityAuditSummary(), []);
  const parityBacklog = useMemo(() => getWorkflowParityBacklog(8), []);
  const nextCandidates = useMemo(() => nextWorkflowImplementationCandidates(6), []);
  const matrixRows = useMemo(() => workflowFlowMatrixRows(), []);
  const readinessRows = useMemo(() => workflowReadinessChecklistRows(), []);
  const manualQaFlows = useMemo(() => buildCrossPillarManualQaFlows(), []);
  const [manualQaState, setManualQaState] = useState<CrossPillarManualQaRunnerState>(() => readStoredCrossPillarQaState(manualQaFlows));
  const [manualQaNotes, setManualQaNotes] = useState(() => buildCrossPillarManualQaNotes(manualQaFlows, manualQaState));
  const [handoffHistory, setHandoffHistory] = useState<CrossPillarHandoffRecord[]>(readCrossPillarHandoffHistory);
  const { data: fastHelpOutcomes, isLoading: fastHelpLoading } = useQuery<HomeFastHelpOutcomeAggregate>({
    queryKey: ["/api/admin/home/fast-help-outcomes?days=30"],
    retry: false,
    staleTime: 60_000,
  });
  const { data: toolReadiness, isLoading: toolReadinessLoading } = useQuery<CrossPillarToolReadinessResponse>({
    queryKey: ["/api/admin/cross-pillar/tool-readiness"],
    retry: false,
    staleTime: 30_000,
  });

  const toolEvidence = useMemo(() => Object.fromEntries(
    (toolReadiness?.tools ?? []).map((item) => [item.family, item]),
  ) as Partial<Record<CrossPillarToolFamily, CrossPillarToolEvidence>>, [toolReadiness]);
  const actionToolReadiness = useMemo(() => CROSS_PILLAR_PRIMARY_ACTION_IDS.map((actionId) => (
    evaluateCrossPillarActionToolReadiness({ actionId, evidence: toolEvidence })
  )), [toolEvidence]);
  const toolReadinessSummary = useMemo(() => ({
    ready: actionToolReadiness.filter((item) => item.status === "ready").length,
    setup_needed: actionToolReadiness.filter((item) => item.status === "setup_needed").length,
    temporarily_unavailable: actionToolReadiness.filter((item) => item.status === "temporarily_unavailable").length,
    manual_help_required: actionToolReadiness.filter((item) => item.status === "manual_help_required").length,
  }), [actionToolReadiness]);

  useEffect(() => {
    const refresh = () => setHandoffHistory(readCrossPillarHandoffHistory());
    window.addEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CROSS_PILLAR_HANDOFF_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const handoffSummary = useMemo(() => ({
    total: handoffHistory.length,
    acknowledged: handoffHistory.filter((item) => item.status === "acknowledged").length,
    completed: handoffHistory.filter((item) => item.status === "completed").length,
    failed: handoffHistory.filter((item) => item.status === "failed").length,
    cancelled: handoffHistory.filter((item) => item.status === "cancelled").length,
  }), [handoffHistory]);

  const workflows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return WORKFLOW_DEFINITIONS
      .map((workflow) => ({
        workflow,
        actions: workflowActionsForTarget({ workflow: workflow.reference }),
        state: workflowCoverageState(workflow.status),
      }))
      .filter((item) => {
        if (domainFilter !== "all" && item.workflow.domain !== domainFilter) return false;
        if (!matchesCoverageFilter(item.state, coverageFilter)) return false;
        if (actionLevelFilter !== "all" && item.actions.every((action) => action.actionLevel !== actionLevelFilter)) return false;
        if (!needle) return true;
        return workflowNeedle(item.workflow, item.actions).includes(needle);
      })
      .sort((left, right) => {
        const stateOrder = { partial: 0, missing: 1, complete: 2 } satisfies Record<WorkflowCoverageState, number>;
        if (stateOrder[left.state] !== stateOrder[right.state]) return stateOrder[left.state] - stateOrder[right.state];
        if (left.workflow.domain !== right.workflow.domain) {
          return domainLabel(left.workflow.domain).localeCompare(domainLabel(right.workflow.domain));
        }
        return left.workflow.title.localeCompare(right.workflow.title);
      });
  }, [actionLevelFilter, coverageFilter, domainFilter, query]);

  const groupedWorkflows = useMemo(() => {
    return workflows.reduce<Record<WorkflowDomain, typeof workflows>>((groups, item) => {
      groups[item.workflow.domain] = [...(groups[item.workflow.domain] ?? []), item];
      return groups;
    }, {} as Record<WorkflowDomain, typeof workflows>);
  }, [workflows]);

  const visibleMatrixRows = useMemo(() => {
    const byReference = new Map(matrixRows.map((row) => [row.reference, row]));
    return workflows
      .map(({ workflow }) => byReference.get(workflow.reference))
      .filter((row): row is WorkflowFlowMatrixRow => Boolean(row));
  }, [matrixRows, workflows]);

  const visibleReadinessRows = useMemo(() => {
    const byReference = new Map(readinessRows.map((row) => [row.reference, row]));
    return workflows
      .map(({ workflow }) => byReference.get(workflow.reference))
      .filter((row): row is WorkflowReadinessChecklistRow => Boolean(row));
  }, [readinessRows, workflows]);

  const clearFilters = () => {
    setDomainFilter("all");
    setCoverageFilter("incomplete");
    setActionLevelFilter("all");
    setQuery("");
  };

  const updateManualQaStatus = (checkId: string, status: CrossPillarManualQaStatus) => {
    setManualQaState((current) => {
      const next = updateCrossPillarManualQaRunnerStatus(current, checkId, status);
      writeStoredCrossPillarQaState(next);
      setManualQaNotes(buildCrossPillarManualQaNotes(manualQaFlows, next));
      return next;
    });
  };

  const copyManualQaNotes = () => {
    const notes = buildCrossPillarManualQaNotes(manualQaFlows, manualQaState);
    setManualQaNotes(notes);
    void navigator.clipboard?.writeText(notes);
  };

  const resetManualQa = () => {
    const next = normalizeCrossPillarManualQaRunnerState(manualQaFlows, null);
    setManualQaState(next);
    writeStoredCrossPillarQaState(next);
    setManualQaNotes(buildCrossPillarManualQaNotes(manualQaFlows, next));
  };

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Workflow coverage"
          subtitle="Track every user-facing action, the workflow it belongs to, and what remains before it feels complete."
        />

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-4" aria-label="Workflow summary">
          <SummaryCard label="Workflows" value={summary.workflows.total} />
          <SummaryCard label="Complete" value={summary.workflows.complete} tone="complete" />
          <SummaryCard label="Partial" value={summary.workflows.partial} tone="partial" />
          <SummaryCard label="Missing" value={summary.workflows.missing} tone="missing" />
        </section>

        <section
          className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm"
          aria-label="Cross-pillar tool readiness"
          data-testid="cross-pillar-tool-readiness"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Live execution readiness</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Can each action really finish?</h2>
            </div>
            <p className="text-xs font-bold text-[#8b7a73]">
              {toolReadinessLoading ? "Checking adapters..." : `Checked ${toolReadiness?.generated_at ? new Date(toolReadiness.generated_at).toLocaleString() : "locally"}`}
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <InsightCard label="Ready" value={toolReadinessSummary.ready} />
            <InsightCard label="Setup needed" value={toolReadinessSummary.setup_needed} />
            <InsightCard label="Unavailable" value={toolReadinessSummary.temporarily_unavailable} />
            <InsightCard label="Manual help" value={toolReadinessSummary.manual_help_required} />
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                <tr>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Required tools</th>
                  <th className="px-2 py-2">Blocker / fallback</th>
                </tr>
              </thead>
              <tbody>
                {actionToolReadiness.map((item) => (
                  <tr key={item.actionId} className="border-t border-[#f0e7df] align-top font-bold text-[#4d3d45]">
                    <td className="px-2 py-2.5">{item.actionId}</td>
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${TOOL_STATUS_CLASS[item.status]}`}>
                        {TOOL_STATUS_LABELS[item.status]}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">{item.required.join(", ")}</td>
                    <td className="px-2 py-2.5">
                      {item.blockers[0]?.reason ?? (item.status === "ready" ? "Verified adapters available." : item.fallbackPath)}
                      {item.status !== "ready" && <div className="mt-1 text-xs text-[#8b7a73]">Fallback: {item.fallbackPath}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm"
          aria-label="Cross-pillar handoff outcomes"
          data-testid="cross-pillar-handoff-outcomes"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Real handoff outcomes</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Did the next step receive the task?</h2>
            </div>
            <p className="text-xs font-bold text-[#8b7a73]">Local QA evidence only; no health details are shown.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <InsightCard label="Handoffs" value={handoffSummary.total} />
            <InsightCard label="Received" value={handoffSummary.acknowledged} />
            <InsightCard label="Completed" value={handoffSummary.completed} />
            <InsightCard label="Failed" value={handoffSummary.failed} />
            <InsightCard label="Cancelled" value={handoffSummary.cancelled} />
          </div>
          {handoffHistory.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                  <tr>
                    <th className="px-2 py-2">Pillar</th>
                    <th className="px-2 py-2">Action</th>
                    <th className="px-2 py-2">Destination</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {handoffHistory.slice(0, 12).map((item) => (
                    <tr key={item.id} className="border-t border-[#f0e7df] font-bold text-[#4d3d45]">
                      <td className="px-2 py-2.5 capitalize">{item.pillar}</td>
                      <td className="px-2 py-2.5">{item.actionId}</td>
                      <td className="px-2 py-2.5">{item.destinationPath}</td>
                      <td className="px-2 py-2.5 capitalize">{item.status.replace("_", " ")}</td>
                      <td className="px-2 py-2.5">{item.attemptCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-5" aria-label="Action level summary">
          {WORKFLOW_ACTION_LEVELS.map((level) => (
            <div key={level} className={`rounded-[14px] border p-4 shadow-sm ${actionLevelClass(level)}`}>
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{WORKFLOW_ACTION_LEVEL_LABELS[level]}</p>
              <p className="mt-2 text-3xl font-black">{summary.byActionLevel[level]}</p>
              <p className="mt-1 text-xs font-bold opacity-85">{WORKFLOW_ACTION_LEVEL_RULES[level]}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Cross-pillar parity audit">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Cross-pillar parity audit</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Same safety standard everywhere</h2>
            </div>
            <p className="text-xs font-bold text-[#8b7a73]">Uses the Concierge patterns where an action leaves the app.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <InsightCard label="Audited" value={paritySummary.total} />
            <InsightCard label="Ready" value={paritySummary.byStatus.ready} />
            <InsightCard label="Partial" value={paritySummary.byStatus.partial} />
            <InsightCard label="Missing setup" value={paritySummary.byStatus.missing_setup_path} />
            <InsightCard label="Missing resume" value={paritySummary.byStatus.missing_resume} />
            <InsightCard label="Tool/service" value={paritySummary.byStatus.needs_tool_service} />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2" data-testid="workflow-parity-backlog">
            {parityBacklog.length === 0 ? (
              <div className="rounded-[14px] border border-emerald-100 bg-emerald-50 p-4 text-sm font-black text-emerald-800">
                Every mapped workflow is ready against the current parity rules.
              </div>
            ) : (
              parityBacklog.map((item) => (
                <ParityBacklogCard key={item.workflowReference} item={item} />
              ))
            )}
          </div>
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Fast Help ranking insights">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Fast Help ranking insights</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Shown to outcome, last 30 days</h2>
            </div>
            <p className="text-xs font-bold text-[#8b7a73]">Aggregate action IDs only; no health or profile content</p>
          </div>
          {fastHelpLoading ? (
            <p className="mt-4 text-sm font-semibold text-[#7d6b65]">Loading outcome totals...</p>
          ) : !fastHelpOutcomes ? (
            <p className="mt-4 text-sm font-semibold text-[#7d6b65]">Outcome totals are not available yet.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <InsightCard label="Options shown" value={fastHelpOutcomes.totals.shown} />
                <InsightCard
                  label="Opened from shown"
                  value={fastHelpOutcomes.totals.attributedOpened}
                />
                <InsightCard
                  label="Open rate"
                  value={insightRate(fastHelpOutcomes.totals.attributedOpened, fastHelpOutcomes.totals.shown)}
                />
                <InsightCard
                  label="Completed"
                  value={fastHelpOutcomes.totals.attributedCompleted}
                />
                <InsightCard
                  label="Blocked"
                  value={fastHelpOutcomes.totals.attributedBlocked}
                />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[780px] text-left text-sm">
                  <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                    <tr>
                      <th className="px-2 py-2">Action</th>
                      <th className="px-2 py-2">Shown</th>
                      <th className="px-2 py-2">Opened</th>
                      <th className="px-2 py-2">Completed</th>
                      <th className="px-2 py-2">Blocked</th>
                      <th className="px-2 py-2">Open rate</th>
                      <th className="px-2 py-2">Finish rate</th>
                      <th className="px-2 py-2">Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fastHelpOutcomes.actions.map((row) => (
                      <tr key={row.actionId} className="border-t border-[#f0e7df] font-bold text-[#4d3d45]">
                        <td className="px-2 py-2.5">{FAST_HELP_LABELS[row.actionId]}</td>
                        <td className="px-2 py-2.5">{row.shown}</td>
                        <td className="px-2 py-2.5">{row.attributedOpened}</td>
                        <td className="px-2 py-2.5">{row.attributedCompleted}</td>
                        <td className="px-2 py-2.5">{row.attributedBlocked}</td>
                        <td className="px-2 py-2.5">{insightRate(row.attributedOpened, row.shown)}</td>
                        <td className="px-2 py-2.5">{insightRate(row.attributedCompleted, row.attributedOpened)}</td>
                        <td className="px-2 py-2.5">
                          <span className={`rounded-full px-2 py-1 text-xs font-black ${
                            row.shown >= 30
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }`}>
                            {row.shown >= 30 ? "Ready to compare" : "Collecting data"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 border-t border-[#f0e7df] pt-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">Ranking versions</p>
                    <h3 className="mt-1 font-serif text-2xl text-[#2f2135]">Compare changes with evidence</h3>
                  </div>
                  <p className="text-xs font-bold text-[#8b7a73]">Rates use only journeys linked to a shown set.</p>
                </div>
                {fastHelpOutcomes.rankingVersions.length === 0 ? (
                  <p className="mt-3 text-sm font-semibold text-[#7d6b65]">No ranking impressions have synced yet.</p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                        <tr>
                          <th className="px-2 py-2">Version</th>
                          <th className="px-2 py-2">Action</th>
                          <th className="px-2 py-2">Shown sets</th>
                          <th className="px-2 py-2">Options shown</th>
                          <th className="px-2 py-2">Opened</th>
                          <th className="px-2 py-2">Completed</th>
                          <th className="px-2 py-2">Blocked</th>
                          <th className="px-2 py-2">Open rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fastHelpOutcomes.rankingVersions.flatMap((version) => (
                          version.actions.map((action) => (
                            <tr
                              key={`${version.rankingVersion}:${action.actionId}`}
                              className="border-t border-[#f0e7df] font-bold text-[#4d3d45]"
                            >
                              <td className="px-2 py-2.5"><code>{version.rankingVersion}</code></td>
                              <td className="px-2 py-2.5">{FAST_HELP_LABELS[action.actionId]}</td>
                              <td className="px-2 py-2.5">{version.impressions}</td>
                              <td className="px-2 py-2.5">{action.shown}</td>
                              <td className="px-2 py-2.5">{action.opened}</td>
                              <td className="px-2 py-2.5">{action.completed}</td>
                              <td className="px-2 py-2.5">{action.blocked}</td>
                              <td className="px-2 py-2.5">{insightRate(action.opened, action.shown)}</td>
                            </tr>
                          ))
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Next work</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Incomplete workflows first</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-[#7d6b65]">
                These are generated from the registry, so future flow work can start from evidence instead of memory.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[460px]">
              {nextCandidates.map((candidate) => (
                <div
                  key={candidate.entryPointId}
                  className={`rounded-[12px] border p-3 ${coverageClass(candidate.coverageState)}`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.12em] opacity-80">{domainLabel(candidate.domain)}</p>
                  <p className="mt-1 text-sm font-black">{candidate.workflowTitle}</p>
                  <p className="mt-0.5 text-xs font-semibold opacity-85">{candidate.nextStep}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Cross-pillar flow matrix">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Cross-pillar matrix</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Setup, options, confirmation, receipt, resume</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-[#7d6b65]">
                One row per workflow, derived from the shared registry so Concierge patterns can be reused across Health, Meds, Safe Home, Community, Learning, and Games.
              </p>
            </div>
            <span className="rounded-full border border-[#eadfd5] bg-[#fffaf4] px-3 py-1.5 text-xs font-black text-[#7d6b65]">
              {visibleMatrixRows.length} rows
            </span>
          </div>
          <FlowMatrixTable rows={visibleMatrixRows} />
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Workflow readiness checklist">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Readiness gates</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Provider, tool, confirmation, receipt, resume</h2>
              <p className="mt-1 max-w-3xl text-sm font-semibold text-[#7d6b65]">
                Derived from the same matrix, so external-action flows cannot quietly miss setup, tool readiness, profile data, final confirmation, receipt, or resume behavior.
              </p>
            </div>
            <span className="rounded-full border border-[#eadfd5] bg-[#fffaf4] px-3 py-1.5 text-xs font-black text-[#7d6b65]">
              {visibleReadinessRows.length} rows
            </span>
          </div>
          <ReadinessChecklistTable rows={visibleReadinessRows} />
        </section>

        <ManualQaRunner
          flows={manualQaFlows}
          runnerState={manualQaState}
          notes={manualQaNotes}
          onStatusChange={updateManualQaStatus}
          onCopyNotes={copyManualQaNotes}
          onReset={resetManualQa}
        />

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Registry browser</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Mapped workflows</h2>
            </div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <label className="relative block min-w-[240px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9c8a82]" size={16} aria-hidden="true" />
                <span className="sr-only">Search workflows</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#eadfd5] bg-white py-2 pl-10 pr-3 text-sm font-bold outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
                  placeholder="Search action, route, flow"
                />
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#eadfd5] bg-white px-3">
                <Filter size={16} className="text-[#9c8a82]" aria-hidden="true" />
                <span className="sr-only">Filter by domain</span>
                <select
                  value={domainFilter}
                  onChange={(event) => setDomainFilter(event.target.value as DomainFilter)}
                  className="bg-transparent text-sm font-black text-[#2f2135] outline-none"
                >
                  <option value="all">All areas</option>
                  {WORKFLOW_DOMAINS.map((domain) => (
                    <option key={domain} value={domain}>{domainLabel(domain)}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex min-h-11 items-center rounded-xl border border-[#eadfd5] bg-white px-3">
                <span className="sr-only">Filter by coverage</span>
                <select
                  value={coverageFilter}
                  onChange={(event) => setCoverageFilter(event.target.value as CoverageFilter)}
                  className="bg-transparent text-sm font-black text-[#2f2135] outline-none"
                >
                  <option value="incomplete">Needs work</option>
                  <option value="all">All statuses</option>
                  <option value="complete">Complete</option>
                  <option value="partial">Partial</option>
                  <option value="missing">Missing</option>
                </select>
              </label>
              <label className="inline-flex min-h-11 items-center rounded-xl border border-[#eadfd5] bg-white px-3">
                <span className="sr-only">Filter by action level</span>
                <select
                  value={actionLevelFilter}
                  onChange={(event) => setActionLevelFilter(event.target.value as ActionLevelFilter)}
                  className="bg-transparent text-sm font-black text-[#2f2135] outline-none"
                >
                  <option value="all">All levels</option>
                  {WORKFLOW_ACTION_LEVELS.map((level) => (
                    <option key={level} value={level}>{WORKFLOW_ACTION_LEVEL_LABELS[level]}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 text-sm font-black text-purple-700"
              >
                Reset
              </button>
            </div>
          </div>

          <p className="mt-3 text-sm font-bold text-[#7d6b65]">
            Showing {workflows.length} of {WORKFLOW_DEFINITIONS.length} workflows.
          </p>
        </section>

        <section className="mt-5 space-y-5" aria-label="Workflow list">
          {workflows.length === 0 ? (
            <div className="rounded-[14px] border border-[#eadfd5] bg-white p-6 text-center text-sm font-bold text-[#7d6b65]">
              No workflows match the current filters.
            </div>
          ) : (
            WORKFLOW_DOMAINS
              .filter((domain) => groupedWorkflows[domain]?.length)
              .map((domain) => (
                <section key={domain} data-testid={`workflow-domain-${domain}`} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-serif text-2xl leading-tight text-[#2f2135]">{domainLabel(domain)}</h2>
                    <span className="rounded-full border border-[#eadfd5] bg-white px-3 py-1 text-xs font-black text-[#7d6b65]">
                      {groupedWorkflows[domain].length} shown
                    </span>
                  </div>
                  <div className="space-y-3">
                    {groupedWorkflows[domain].map(({ workflow, actions }) => (
                      <WorkflowRow key={workflow.reference} workflow={workflow} actions={actions} />
                    ))}
                  </div>
                </section>
              ))
          )}
        </section>
      </section>
    </main>
  );
}
