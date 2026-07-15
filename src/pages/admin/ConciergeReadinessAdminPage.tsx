import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, History, ListChecks, ShieldCheck } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import {
  buildConciergeReadinessRows,
  summarizeConciergeReadiness,
  type ConciergeReadinessChip,
  type ConciergeReadinessEntryPoint,
  type ConciergeReadinessRow,
  type ConciergeReadinessStageStatus,
} from "../../../shared/conciergeReadinessDashboard";
import {
  CONCIERGE_MANUAL_QA_STATUS_OPTIONS,
  buildConciergeManualQaJsonExport,
  buildConciergeManualQaMarkdownReport,
  buildConciergeManualQaNotes,
  normalizeConciergeManualQaRunnerState,
  parseConciergeManualQaImport,
  summarizeConciergeManualQaRunner,
  updateConciergeManualQaRunnerStatus,
  type ConciergeManualQaRunnerState,
  type ConciergeManualQaStatus,
  type ConciergeManualQaFlowStatus,
} from "../../../shared/conciergeManualQaRunner";

const MANUAL_QA_RUNNER_STORAGE_KEY = "vyva:conciergeManualQaRunner:v1";

function flowTestId(reference: string) {
  return `row-concierge-readiness-${reference.toLowerCase().replace(/_/g, "-")}`;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "dark" | "bad" }) {
  const classes = {
    neutral: "border-[#eadfd5] bg-white text-[#5b4a46]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    dark: "border-[#2f2135] bg-[#2f2135] text-white",
    bad: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <span className={`inline-flex min-h-[28px] items-center rounded-full border px-2.5 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
}

function readStoredManualQaState(): Partial<Record<string, unknown>> {
  if (typeof window === "undefined") return {};

  try {
    const stored = window.localStorage.getItem(MANUAL_QA_RUNNER_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStoredManualQaState(state: ConciergeManualQaRunnerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MANUAL_QA_RUNNER_STORAGE_KEY, JSON.stringify(state));
}

function statusLabel(status: ConciergeManualQaStatus) {
  return CONCIERGE_MANUAL_QA_STATUS_OPTIONS.find((option) => option.id === status)?.label ?? status;
}

function statusTone(status: ConciergeManualQaStatus): "neutral" | "good" | "warn" | "bad" {
  if (status === "pass") return "good";
  if (status === "fail") return "bad";
  if (status === "needs_review") return "warn";
  return "neutral";
}

function flowStatusLabel(status: ConciergeManualQaFlowStatus) {
  const labels: Record<ConciergeManualQaFlowStatus, string> = {
    not_tested: "Not tested",
    in_progress: "In progress",
    passed: "Passed",
    blocked: "Blocked",
    needs_review: "Needs review",
  };
  return labels[status];
}

function flowStatusTone(status: ConciergeManualQaFlowStatus): "neutral" | "good" | "warn" | "bad" {
  if (status === "passed") return "good";
  if (status === "blocked") return "bad";
  if (status === "needs_review") return "warn";
  return "neutral";
}

function MetricTile({ icon: Icon, label, value, sub, testId }: {
  icon: typeof ClipboardCheck;
  label: string;
  value: string;
  sub: string;
  testId: string;
}) {
  return (
    <section className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" data-testid={testId}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f0ff] text-purple-700">
          <Icon size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#8b7a73]">{label}</p>
          <p className="mt-1 truncate text-xl font-black text-[#2f2135]">{value}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold leading-relaxed text-[#7d6b65]">{sub}</p>
    </section>
  );
}

function ChipList<T extends string>({ items, emptyLabel }: { items: Array<ConciergeReadinessChip<T>>; emptyLabel: string }) {
  if (items.length === 0) {
    return <span className="text-sm font-semibold text-[#8b7a73]">{emptyLabel}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Pill key={item.id}>{item.label}</Pill>
      ))}
    </div>
  );
}

function EntryPointList({ entries }: { entries: ConciergeReadinessEntryPoint[] }) {
  if (entries.length === 0) return <span className="text-sm font-semibold text-[#8b7a73]">No entry points</span>;

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black text-[#2f2135]">{entry.label}</span>
            <Pill tone="neutral">{entry.surface.replace(/_/g, " ")}</Pill>
          </div>
          <p className="mt-1 text-xs font-semibold text-[#8b7a73]">
            {entry.source}{entry.route ? ` -> ${entry.route}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function ProviderDependency({ row }: { row: ConciergeReadinessRow }) {
  if (!row.providerDependency.categoryLabel && !row.providerDependency.needsSavedProvider) {
    return <span className="text-sm font-semibold text-[#8b7a73]">No saved provider required</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {row.providerDependency.categoryLabel ? <Pill>{row.providerDependency.categoryLabel}</Pill> : null}
      {row.providerDependency.needsSavedProvider ? <Pill tone="warn">Saved provider gate</Pill> : null}
      {row.providerDependency.setupFocusLabel ? (
        <span className="text-xs font-semibold text-[#8b7a73]">Setup focus: {row.providerDependency.setupFocusLabel}</span>
      ) : null}
    </div>
  );
}

function StageStatus({ stage, notRequired = false }: { stage: ConciergeReadinessStageStatus; notRequired?: boolean }) {
  if (notRequired) {
    return <Pill>Not required</Pill>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Pill tone={stage.covered ? "good" : "warn"}>{stage.covered ? "Covered" : "Needs attention"}</Pill>
      {stage.evidence ? <p className="text-xs font-semibold leading-relaxed text-[#7d6b65]">{stage.evidence}</p> : null}
    </div>
  );
}

function HandoffHistory({ row }: { row: ConciergeReadinessRow }) {
  return (
    <div className="flex flex-col gap-2">
      {row.handoffHistory.map((stage) => (
        <div key={stage.id} className="rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-2.5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-black text-[#2f2135]">{stage.label}</span>
            <Pill tone={stage.covered ? "good" : "warn"}>{stage.covered ? "OK" : "Missing"}</Pill>
          </div>
          {stage.evidence ? <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8b7a73]">{stage.evidence}</p> : null}
        </div>
      ))}
    </div>
  );
}

function ManualQaScriptCard({
  row,
  runnerState,
  onStatusChange,
  flowStatus,
}: {
  row: ConciergeReadinessRow;
  runnerState: ConciergeManualQaRunnerState;
  onStatusChange: (stepId: string, status: ConciergeManualQaStatus) => void;
  flowStatus: ConciergeManualQaFlowStatus;
}) {
  const script = row.manualQaScript;

  return (
    <article
      className="rounded-[14px] border border-[#eadfd5] bg-[#fffaf4] p-4 shadow-sm"
      data-testid={`manual-qa-script-${row.reference.toLowerCase().replace(/_/g, "-")}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b7a73]">{row.reference}</p>
          <h3 className="mt-1 text-lg font-black text-[#2f2135]">{script.actionName}</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={script.smokeAudit.passed ? "good" : "warn"}>
            {script.smokeAudit.passed ? "Smoke pass" : "Smoke issue"}
          </Pill>
          <Pill tone={script.providerPath.required ? "warn" : "good"}>
            {script.providerPath.required ? "Provider path" : "No provider setup required"}
          </Pill>
          <Pill tone={flowStatusTone(flowStatus)}>{flowStatusLabel(flowStatus)}</Pill>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[12px] border border-[#f0e7df] bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Start entry points</p>
          <div className="mt-2 flex flex-col gap-2">
            {script.entryPoints.map((entry) => (
              <div key={entry.id} className="rounded-[10px] bg-[#fbf8f5] px-2.5 py-2">
                <p className="text-sm font-black text-[#2f2135]">{entry.label}</p>
                <p className="mt-1 text-xs font-semibold text-[#8b7a73]">
                  {entry.source}{entry.route ? ` -> ${entry.route}` : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700">Ask for</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {script.detailsToAsk.map((detail) => (
              <Pill key={detail}>{detail.replace(/_/g, " ")}</Pill>
            ))}
          </div>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-purple-700">Tools</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.toolDependencies.map((tool) => (
              <Pill key={tool.id}>{tool.label}</Pill>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-[#f0e7df] bg-white p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Manual QA script</p>
          <ol className="mt-2 flex flex-col gap-2">
            {script.steps.map((step, index) => (
              <li key={step.id} className="grid grid-cols-[28px_1fr] gap-2 rounded-[10px] bg-[#fbf8f5] px-2.5 py-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f5f0ff] text-xs font-black text-purple-700">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-black text-[#2f2135]">{step.title}</p>
                    <Pill>{step.source.replace(/_/g, " ")}</Pill>
                    <Pill tone={statusTone(runnerState[step.id] ?? "not_tested")}>
                      {statusLabel(runnerState[step.id] ?? "not_tested")}
                    </Pill>
                  </div>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#5b4a46]">{step.instruction}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#8b7a73]">{step.expectedResult}</p>
                  <label className="mt-2 flex max-w-[220px] flex-col gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                    QA status
                    <select
                      aria-label={`QA status for ${step.title}`}
                      className="min-h-[38px] rounded-[10px] border border-[#eadfd5] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#2f2135]"
                      value={runnerState[step.id] ?? "not_tested"}
                      onChange={(event) => onStatusChange(step.id, event.target.value as ConciergeManualQaStatus)}
                    >
                      {CONCIERGE_MANUAL_QA_STATUS_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}

function ManualQaRunnerMetric({ label, value, tone = "neutral" }: {
  label: string;
  value: number;
  tone?: "neutral" | "good" | "warn" | "bad";
}) {
  const classes = {
    neutral: "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    bad: "border-red-200 bg-red-50 text-red-800",
  }[tone];

  return (
    <div className={`rounded-[12px] border p-3 ${classes}`} data-testid={`manual-qa-metric-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}

function ManualQaScriptSection({
  rows,
  runnerState,
  onStatusChange,
  onCopyNotes,
  onCopyMarkdownReport,
  onCopyJsonReport,
  exportMessage,
  importText,
  onImportTextChange,
  onImportJson,
  importMessage,
  importError,
  copied,
}: {
  rows: ConciergeReadinessRow[];
  runnerState: ConciergeManualQaRunnerState;
  onStatusChange: (stepId: string, status: ConciergeManualQaStatus) => void;
  onCopyNotes: () => void;
  onCopyMarkdownReport: () => void;
  onCopyJsonReport: () => void;
  exportMessage: string | null;
  importText: string;
  onImportTextChange: (text: string) => void;
  onImportJson: () => void;
  importMessage: string | null;
  importError: string | null;
  copied: boolean;
}) {
  const scripts = rows.map((row) => row.manualQaScript);
  const runnerSummary = summarizeConciergeManualQaRunner(scripts, runnerState);
  const flowResultsByReference = new Map(runnerSummary.flowResults.map((flow) => [flow.reference, flow]));

  return (
    <section
      className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm"
      data-testid="section-manual-qa-script"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f0ff] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
            <ClipboardCheck size={14} aria-hidden="true" />
            Manual QA script runner
          </div>
          <h2 className="mt-2 font-serif text-2xl text-[#2f2135]">Flow-by-flow test guide</h2>
          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
            Generated from the Concierge registry, coverage map, and launch smoke audit. Tester status is saved in this browser only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-sm font-black text-[#5b4a46]">
            <ListChecks size={16} aria-hidden="true" />
            {runnerSummary.totalSteps} scripted checks
          </div>
          <button
            type="button"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#2f2135] bg-[#2f2135] px-3 py-2 text-sm font-black text-white"
            onClick={onCopyNotes}
          >
            <Copy size={16} aria-hidden="true" />
            {copied ? "Copied" : "Copy QA notes"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5" data-testid="manual-qa-runner-summary">
        <ManualQaRunnerMetric label="Flows passed" value={runnerSummary.fullyPassedFlows} tone="good" />
        <ManualQaRunnerMetric label="Flows blocked" value={runnerSummary.blockedFlows} tone="bad" />
        <ManualQaRunnerMetric label="Needs review" value={runnerSummary.needsReviewFlows} tone="warn" />
        <ManualQaRunnerMetric label="Failed checks" value={runnerSummary.failedCheckpoints} tone="bad" />
        <ManualQaRunnerMetric label="Not tested" value={runnerSummary.notTestedCheckpoints} />
      </div>

      <div className="mt-4 rounded-[12px] border border-[#eadfd5] bg-[#fffaf4] p-3" data-testid="manual-qa-export-import">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-purple-700">Export QA report</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed text-[#7d6b65]">
              Copy Markdown for PR notes or JSON so another tester can import the same browser-local QA state.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-white px-3 py-2 text-sm font-black text-[#2f2135]"
              onClick={onCopyMarkdownReport}
            >
              <Copy size={16} aria-hidden="true" />
              Copy Markdown report
            </button>
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-white px-3 py-2 text-sm font-black text-[#2f2135]"
              onClick={onCopyJsonReport}
            >
              <Copy size={16} aria-hidden="true" />
              Copy JSON report
            </button>
          </div>
        </div>
        {exportMessage ? <p className="mt-2 text-sm font-black text-emerald-800">{exportMessage}</p> : null}

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="flex flex-col gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
            Import QA state from JSON
            <textarea
              className="min-h-[96px] rounded-[10px] border border-[#eadfd5] bg-white px-3 py-2 font-mono text-sm normal-case tracking-normal text-[#2f2135]"
              placeholder="Paste exported QA JSON here"
              value={importText}
              onChange={(event) => onImportTextChange(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-purple-700 bg-purple-700 px-4 py-2 text-sm font-black text-white"
            onClick={onImportJson}
          >
            Import QA state
          </button>
        </div>
        {importMessage ? <p className="mt-2 text-sm font-black text-emerald-800">{importMessage}</p> : null}
        {importError ? <p className="mt-2 text-sm font-black text-red-800">{importError}</p> : null}
      </div>

      <div className="mt-4 grid gap-3">
        {rows.map((row) => (
          <ManualQaScriptCard
            key={row.reference}
            row={row}
            runnerState={runnerState}
            onStatusChange={onStatusChange}
            flowStatus={flowResultsByReference.get(row.reference)?.status ?? "not_tested"}
          />
        ))}
      </div>
    </section>
  );
}

function LaunchAuditState({ row }: { row: ConciergeReadinessRow }) {
  const failedChecks = row.launchAudit.checks.filter((check) => !check.passed);

  return (
    <div className="flex flex-col gap-2">
      <Pill tone={row.launchAudit.passed ? "good" : "warn"}>
        {row.launchAudit.passed ? "Smoke pass" : "Needs attention"}
      </Pill>
      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
        {row.launchAudit.checkCount - row.launchAudit.failedCheckCount}/{row.launchAudit.checkCount} QA checks
      </span>
      <div className="flex flex-wrap gap-1.5" data-testid={`audit-checks-${row.reference}`}>
        {row.launchAudit.checks.map((check) => (
          <Pill key={check.id} tone={check.passed ? "good" : "warn"}>{check.label}</Pill>
        ))}
      </div>
      {row.readinessNotes.map((note) => (
        <p key={note} className="text-sm font-semibold leading-relaxed text-[#7d6b65]">{note}</p>
      ))}
      {failedChecks.length > 0 ? (
        <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-2.5 py-2" data-testid={`needs-attention-${row.reference}`}>
          {failedChecks.map((check) => (
            <div key={check.id}>
              <p className="text-sm font-black text-amber-900">{check.label}</p>
              {check.details.map((detail) => (
                <p key={detail} className="mt-1 text-xs font-semibold leading-relaxed text-amber-800">{detail}</p>
              ))}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReadinessRow({ row }: { row: ConciergeReadinessRow }) {
  const savedProviderPathNotRequired = !row.providerDependency.needsSavedProvider;

  return (
    <tr className="align-top" data-testid={flowTestId(row.reference)}>
      <td className="min-w-[240px] border-t border-[#f0e7df] px-4 py-4">
        <div className="flex flex-col gap-2">
          <span className="text-base font-black text-[#2f2135]">{row.actionName}</span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b7a73]">{row.reference}</span>
          <Pill tone={row.flowStatus === "ready" ? "good" : "warn"}>Registry {row.flowStatus}</Pill>
          <ChipList items={row.levels} emptyLabel="No level" />
          <ChipList items={row.toolDependencies} emptyLabel="No tool dependency" />
        </div>
      </td>
      <td className="min-w-[220px] border-t border-[#f0e7df] px-4 py-4">
        <LaunchAuditState row={row} />
      </td>
      <td className="min-w-[260px] border-t border-[#f0e7df] px-4 py-4">
        <EntryPointList entries={row.entryPoints} />
      </td>
      <td className="min-w-[210px] border-t border-[#f0e7df] px-4 py-4">
        <ChipList items={row.missingSetup} emptyLabel="No required saved setup" />
        <ProviderDependency row={row} />
      </td>
      <td className="min-w-[220px] border-t border-[#f0e7df] px-4 py-4">
        <StageStatus stage={row.savedProviderPath} notRequired={savedProviderPathNotRequired} />
      </td>
      <td className="min-w-[280px] border-t border-[#f0e7df] px-4 py-4">
        <div className="flex flex-col gap-2">
          <Pill tone={row.finalConfirmation.covered ? "good" : "warn"}>
            {row.finalConfirmation.covered ? "Confirmation covered" : "Confirmation missing"}
          </Pill>
          <p className="text-sm font-semibold leading-relaxed text-[#2f2135]">{row.confirmationRule}</p>
          {row.finalConfirmation.evidence ? (
            <p className="text-xs font-semibold leading-relaxed text-[#8b7a73]">{row.finalConfirmation.evidence}</p>
          ) : null}
        </div>
      </td>
      <td className="min-w-[240px] border-t border-[#f0e7df] px-4 py-4">
        <div className="flex flex-col gap-2">
          <Pill tone={row.missingStages.length === 0 && row.entryGaps.length === 0 ? "good" : "warn"}>
            {row.coveredStageCount}/{row.requiredStageCount} stages
          </Pill>
          <ChipList items={row.missingStages} emptyLabel="All required stages covered" />
          <ChipList items={row.entryGaps} emptyLabel="Entry coverage OK" />
          <HandoffHistory row={row} />
        </div>
      </td>
    </tr>
  );
}

export default function ConciergeReadinessAdminPage({ rowsOverride }: { rowsOverride?: ConciergeReadinessRow[] }) {
  const rows = useMemo(() => rowsOverride ?? buildConciergeReadinessRows(), [rowsOverride]);
  const summary = useMemo(() => summarizeConciergeReadiness(rows), [rows]);
  const scripts = useMemo(() => rows.map((row) => row.manualQaScript), [rows]);
  const [manualQaState, setManualQaState] = useState<ConciergeManualQaRunnerState>(() => (
    normalizeConciergeManualQaRunnerState(scripts, readStoredManualQaState())
  ));
  const [notesCopied, setNotesCopied] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setManualQaState((current) => normalizeConciergeManualQaRunnerState(scripts, current));
  }, [scripts]);

  useEffect(() => {
    writeStoredManualQaState(manualQaState);
  }, [manualQaState]);

  function handleManualQaStatusChange(stepId: string, status: ConciergeManualQaStatus) {
    setNotesCopied(false);
    setExportMessage(null);
    setImportMessage(null);
    setImportError(null);
    setManualQaState((current) => updateConciergeManualQaRunnerStatus(current, stepId, status));
  }

  function handleCopyManualQaNotes() {
    const notes = buildConciergeManualQaNotes(scripts, manualQaState);
    void navigator.clipboard?.writeText(notes);
    setNotesCopied(true);
    setExportMessage(null);
  }

  function handleCopyMarkdownReport() {
    const report = buildConciergeManualQaMarkdownReport(scripts, manualQaState);
    void navigator.clipboard?.writeText(report);
    setNotesCopied(false);
    setExportMessage("Markdown QA report copied.");
  }

  function handleCopyJsonReport() {
    const report = buildConciergeManualQaJsonExport(scripts, manualQaState);
    void navigator.clipboard?.writeText(report);
    setNotesCopied(false);
    setExportMessage("JSON QA report copied.");
  }

  function handleImportJson() {
    const result = parseConciergeManualQaImport(scripts, importText);
    if (!result.ok) {
      setImportError(result.error);
      setImportMessage(null);
      return;
    }

    setManualQaState(result.state);
    setImportError(null);
    setImportMessage(result.importedAt ? `Imported QA state from ${result.importedAt}.` : "Imported QA state.");
    setNotesCopied(false);
    setExportMessage(null);
  }

  return (
    <div className="min-h-screen bg-[#f8f2ea] px-4 py-6 text-[#2f2135] sm:px-8" data-testid="page-concierge-readiness">
      <div className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Concierge flow readiness"
          subtitle="A production launch view of every Concierge flow, its entry points, setup gates, tool dependencies, and user confirmation coverage."
        />

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            icon={ClipboardCheck}
            label="Total flows"
            value={String(summary.total)}
            sub="Tracked from the shared Concierge registry."
            testId="metric-concierge-readiness-total"
          />
          <MetricTile
            icon={CheckCircle2}
            label="Ready for users"
            value={String(summary.ready)}
            sub={`${summary.launchAuditPassed} flows passing the launch smoke audit.`}
            testId="metric-concierge-readiness-ready"
          />
          <MetricTile
            icon={AlertTriangle}
            label="Needs attention"
            value={String(summary.needsAttention)}
            sub={`${summary.launchAuditNeedsAttention} smoke-audit failures across all flows.`}
            testId="metric-concierge-readiness-needs-attention"
          />
          <MetricTile
            icon={ListChecks}
            label="QA checks"
            value={String(summary.launchAuditChecks)}
            sub={`${summary.providerGated} provider-gated flows and ${summary.entryPoints} entry points tracked.`}
            testId="metric-concierge-readiness-qa-checks"
          />
        </section>

        <section className="mt-5 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#f0e7df] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#f5f0ff] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-purple-700">
                <ShieldCheck size={14} aria-hidden="true" />
                QA launch matrix
              </div>
              <h2 className="mt-2 font-serif text-2xl text-[#2f2135]">Flow readiness table</h2>
              <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                One row per Concierge flow, including routes, provider setup, saved-provider path, confirmation, and history proof.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-[10px] border border-[#eadfd5] bg-[#fffaf4] px-3 py-2 text-sm font-black text-[#5b4a46]">
              <History size={16} aria-hidden="true" />
              {summary.entryPoints} entry points tracked
            </div>
          </div>

          <div className="overflow-x-auto" data-testid="table-concierge-readiness">
            <table className="min-w-full border-collapse text-left">
              <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">
                <tr>
                  <th className="px-4 py-3">Flow</th>
                  <th className="px-4 py-3">QA state</th>
                  <th className="px-4 py-3">Entry points</th>
                  <th className="px-4 py-3">Provider setup</th>
                  <th className="px-4 py-3">Saved-provider path</th>
                  <th className="px-4 py-3">Final confirmation</th>
                  <th className="px-4 py-3">Handoff / history</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ReadinessRow key={row.reference} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <ManualQaScriptSection
          rows={rows}
          runnerState={manualQaState}
          onStatusChange={handleManualQaStatusChange}
          onCopyNotes={handleCopyManualQaNotes}
          onCopyMarkdownReport={handleCopyMarkdownReport}
          onCopyJsonReport={handleCopyJsonReport}
          exportMessage={exportMessage}
          importText={importText}
          onImportTextChange={(text) => {
            setImportText(text);
            setImportError(null);
            setImportMessage(null);
          }}
          onImportJson={handleImportJson}
          importMessage={importMessage}
          importError={importError}
          copied={notesCopied}
        />
      </div>
    </div>
  );
}
