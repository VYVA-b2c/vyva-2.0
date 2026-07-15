import { useMemo, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, History, ListChecks, ShieldCheck } from "lucide-react";
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

function flowTestId(reference: string) {
  return `row-concierge-readiness-${reference.toLowerCase().replace(/_/g, "-")}`;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "dark" }) {
  const classes = {
    neutral: "border-[#eadfd5] bg-white text-[#5b4a46]",
    good: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warn: "border-amber-200 bg-amber-50 text-amber-800",
    dark: "border-[#2f2135] bg-[#2f2135] text-white",
  }[tone];

  return (
    <span className={`inline-flex min-h-[28px] items-center rounded-full border px-2.5 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
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
      </div>
    </div>
  );
}
