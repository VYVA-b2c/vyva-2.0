import { useMemo, useState } from "react";
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
  type WorkflowActionLevel,
  type WorkflowActionLookup,
  type WorkflowCoverageState,
  type WorkflowDefinition,
  type WorkflowDomain,
  type WorkflowReference,
  getWorkflowCoverageSummary,
  nextWorkflowImplementationCandidates,
  workflowActionsForTarget,
  workflowCoverageState,
} from "../../../shared/workflowRegistry";
import type { HomeFastHelpActionId, HomeFastHelpOutcomeAggregate } from "../../../shared/homeFastHelpSync";
import { buildWorkflowReceiptMoment } from "../../../shared/workflowReceiptMoments";

type DomainFilter = "all" | WorkflowDomain;
type CoverageFilter = "all" | "incomplete" | WorkflowCoverageState;
type ActionLevelFilter = "all" | WorkflowActionLevel;

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

export default function WorkflowCoverageAdminPage() {
  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("incomplete");
  const [actionLevelFilter, setActionLevelFilter] = useState<ActionLevelFilter>("all");
  const [query, setQuery] = useState("");
  const summary = useMemo(() => getWorkflowCoverageSummary(), []);
  const nextCandidates = useMemo(() => nextWorkflowImplementationCandidates(6), []);
  const { data: fastHelpOutcomes, isLoading: fastHelpLoading } = useQuery<HomeFastHelpOutcomeAggregate>({
    queryKey: ["/api/admin/home/fast-help-outcomes?days=30"],
    retry: false,
    staleTime: 60_000,
  });

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

  const clearFilters = () => {
    setDomainFilter("all");
    setCoverageFilter("incomplete");
    setActionLevelFilter("all");
    setQuery("");
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

        <section className="mt-3 grid gap-3 md:grid-cols-5" aria-label="Action level summary">
          {WORKFLOW_ACTION_LEVELS.map((level) => (
            <div key={level} className={`rounded-[14px] border p-4 shadow-sm ${actionLevelClass(level)}`}>
              <p className="text-xs font-black uppercase tracking-[0.14em] opacity-80">{WORKFLOW_ACTION_LEVEL_LABELS[level]}</p>
              <p className="mt-2 text-3xl font-black">{summary.byActionLevel[level]}</p>
              <p className="mt-1 text-xs font-bold opacity-85">{WORKFLOW_ACTION_LEVEL_RULES[level]}</p>
            </div>
          ))}
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
