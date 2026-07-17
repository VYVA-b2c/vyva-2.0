import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Loader2, RefreshCw, RotateCcw, ShieldCheck, Wrench, X } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  OPERATOR_CONCIERGE_ADAPTER_STATUSES,
  OPERATOR_CONCIERGE_QUEUE_STATUSES,
  OPERATOR_CONCIERGE_QUEUE_STATUS_LABELS,
  buildOperatorConciergeAdapterTotals,
  buildOperatorConciergeQueueTotals,
  emptyOperatorConciergeQueueTotals,
  filterOperatorConciergeQueueItems,
  type OperatorConciergeAdapterStatus,
  type OperatorConciergeQueueItem,
  type OperatorConciergeQueueStatus,
  type OperatorConciergeQueueTotals,
} from "../../../shared/conciergeOperatorQueue";

type QueueFilter = OperatorConciergeQueueStatus | "all";
type AdapterFilter = OperatorConciergeAdapterStatus | "all";
type QueueAction = "in_progress" | "done" | "failed" | "retry_adapter" | "manual_follow_up" | "request_reconfirmation";
type OwnerFilter = "all" | "mine" | "unassigned";

type QueueResponse = {
  items?: OperatorConciergeQueueItem[];
  totals?: Partial<OperatorConciergeQueueTotals>;
};

const statusStyles: Record<OperatorConciergeQueueStatus, string> = {
  needs_info: "border-amber-200 bg-amber-50 text-amber-800",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  confirmed: "border-purple-200 bg-purple-50 text-purple-800",
  in_progress: "border-blue-200 bg-blue-50 text-blue-800",
  done: "border-slate-200 bg-slate-50 text-slate-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

const statusDescriptions: Record<OperatorConciergeQueueStatus, string> = {
  needs_info: "More details needed",
  ready: "Ready for user OK",
  confirmed: "User approved",
  in_progress: "Being worked now",
  done: "Closed successfully",
  failed: "Needs attention",
};

const statusIcons: Record<OperatorConciergeQueueStatus, typeof AlertCircle> = {
  needs_info: AlertCircle,
  ready: ShieldCheck,
  confirmed: CheckCircle2,
  in_progress: Clock3,
  done: CheckCircle2,
  failed: AlertCircle,
};

const adapterStatusLabels: Record<OperatorConciergeAdapterStatus, string> = {
  blocked: "Blocked",
  failed: "Failed",
  sent: "Sent",
  simulated: "Simulated",
};

const adapterStatusStyles: Record<OperatorConciergeAdapterStatus, string> = {
  blocked: "border-amber-200 bg-amber-50 text-amber-800",
  failed: "border-red-200 bg-red-50 text-red-700",
  sent: "border-emerald-200 bg-emerald-50 text-emerald-800",
  simulated: "border-blue-200 bg-blue-50 text-blue-800",
};

function cleanLabel(value: string | null | undefined) {
  return (value ?? "")
    .replace(/^FLOW_/, "")
    .replace(/_/g, " ")
    .toLowerCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "No time yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No time yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function incidentSummary(item: OperatorConciergeQueueItem) {
  const incident = item.adapter_incident;
  if (!incident) return "No adapter attempt yet";
  return incident.error || incident.blocker || incident.result || "No adapter result";
}

function incidentModeLabel(item: OperatorConciergeQueueItem) {
  const incident = item.adapter_incident;
  if (!incident) return "No channel action";
  if (incident.simulated) return "Simulated";
  if (incident.live) return "Live action";
  return cleanLabel(incident.mode) || "Adapter";
}

function historyModeLabel(item: OperatorConciergeQueueItem) {
  if (item.adapter_incident) return incidentModeLabel(item);
  if (item.status === "done") return item.user_confirmed ? "Completed manually" : "Completed";
  if (item.status === "failed") return "Failed";
  return item.user_confirmed ? "Awaiting action" : "Awaiting confirmation";
}

function formatPayload(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function approvalChangedLabels(fields: string[]) {
  const labels: Record<string, string> = {
    approval: "approval fingerprint",
    channel: "channel",
    provider_name: "provider",
    provider_contact: "provider contact",
    summary: "summary",
    payload: "payload",
  };
  return fields.map((field) => labels[field] ?? cleanLabel(field)).join(", ");
}

function mergeTotals(items: OperatorConciergeQueueItem[], responseTotals?: Partial<OperatorConciergeQueueTotals>): OperatorConciergeQueueTotals {
  return {
    ...buildOperatorConciergeQueueTotals(items),
    ...responseTotals,
  };
}

export default function ConciergeQueueAdminPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<OperatorConciergeQueueItem[]>([]);
  const [totals, setTotals] = useState<OperatorConciergeQueueTotals>(emptyOperatorConciergeQueueTotals());
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [adapterFilter, setAdapterFilter] = useState<AdapterFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState<OperatorConciergeQueueItem | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [savingAction, setSavingAction] = useState<QueueAction | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await apiFetch("/api/admin/concierge/queue");
      const data = await res.json().catch(() => ({})) as QueueResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "Queue could not load.");
      const loadedItems = data.items ?? [];
      setItems(loadedItems);
      setTotals(mergeTotals(loadedItems, data.totals));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Queue could not load.");
      setItems([]);
      setTotals(emptyOperatorConciergeQueueTotals());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const currentOperatorId = user?.id?.trim() || "";
  const currentOperatorEmail = user?.email?.trim().toLowerCase() || "";
  const isAssignedToCurrentOperator = useCallback((item: OperatorConciergeQueueItem) => (
    Boolean(currentOperatorId && item.operator_assigned_to === currentOperatorId)
      || Boolean(currentOperatorEmail && item.operator_assigned_email?.trim().toLowerCase() === currentOperatorEmail)
  ), [currentOperatorEmail, currentOperatorId]);
  const isUnassigned = useCallback((item: OperatorConciergeQueueItem) => !item.operator_assigned_to && !item.operator_assigned_email, []);
  const canCurrentOperatorAct = (item: OperatorConciergeQueueItem) => isUnassigned(item) || isAssignedToCurrentOperator(item);
  const assignmentLabel = (item: OperatorConciergeQueueItem) => {
    if (isAssignedToCurrentOperator(item)) return "Assigned to me";
    if (item.operator_assigned_email) return `Assigned to ${item.operator_assigned_email}`;
    if (item.operator_assigned_to) return `Assigned to ${item.operator_assigned_to}`;
    return "Unassigned";
  };
  const canTakeTask = (item: OperatorConciergeQueueItem) => (
    item.source === "pending"
      && item.user_confirmed
      && item.status !== "done"
      && (item.status !== "failed" || Boolean(item.adapter_incident?.manual_follow_up_allowed || item.adapter_incident?.retry_allowed))
      && isUnassigned(item)
  );
  const visibleItems = useMemo(() => {
    const statusFiltered = filterOperatorConciergeQueueItems(items, filter);
    const adapterFiltered = adapterFilter === "all"
      ? statusFiltered
      : statusFiltered.filter((item) => item.adapter_incident?.status === adapterFilter);
    if (ownerFilter === "mine") return adapterFiltered.filter(isAssignedToCurrentOperator);
    if (ownerFilter === "unassigned") return adapterFiltered.filter(isUnassigned);
    return adapterFiltered;
  }, [adapterFilter, filter, isAssignedToCurrentOperator, isUnassigned, items, ownerFilter]);
  const allCount = useMemo(() => OPERATOR_CONCIERGE_QUEUE_STATUSES.reduce((sum, status) => sum + totals[status], 0), [totals]);
  const adapterTotals = useMemo(() => buildOperatorConciergeAdapterTotals(items), [items]);
  const adapterAllCount = useMemo(() => OPERATOR_CONCIERGE_ADAPTER_STATUSES.reduce((sum, status) => sum + adapterTotals[status], 0), [adapterTotals]);
  const mineCount = useMemo(() => items.filter(isAssignedToCurrentOperator).length, [isAssignedToCurrentOperator, items]);
  const unassignedCount = useMemo(() => items.filter(isUnassigned).length, [isUnassigned, items]);
  const selectedCanAct = Boolean(
    selectedItem?.source === "pending"
      && selectedItem.user_confirmed
      && selectedItem.status !== "done"
      && selectedItem.status !== "failed"
      && canCurrentOperatorAct(selectedItem),
  );
  const selectedCanRecoverIncident = Boolean(
    selectedItem?.source === "pending"
      && selectedItem.user_confirmed
      && selectedItem.adapter_incident?.live
      && canCurrentOperatorAct(selectedItem),
  );

  async function updateTask(action: QueueAction) {
    if (!selectedItem) return;
    setSavingAction(action);
    setMessage("");
    try {
      const res = await apiFetch(`/api/admin/concierge/queue/${selectedItem.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          outcome_note: outcomeNote,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Task could not be updated.");
      setSelectedItem(null);
      setOutcomeNote("");
      await refresh();
      setMessage(action === "retry_adapter"
        ? "Adapter retry requested."
        : action === "request_reconfirmation"
          ? "User reconfirmation requested."
        : action === "manual_follow_up"
          ? "Manual follow-up queued."
          : "Concierge task updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Task could not be updated.");
      if (action === "retry_adapter" || action === "manual_follow_up" || action === "request_reconfirmation") {
        await refresh();
      }
    } finally {
      setSavingAction(null);
    }
  }

  async function takeTask(item: OperatorConciergeQueueItem) {
    setAssigningId(item.id);
    setMessage("");
    try {
      const res = await apiFetch(`/api/admin/concierge/queue/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "assign" }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Task could not be assigned.");
      await refresh();
      setMessage("Task assigned to you.");
      if (selectedItem?.id === item.id) {
        setSelectedItem(null);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Task could not be assigned.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Concierge queue"
          subtitle="See Concierge tasks by operator status. Seniors still approve before VYVA books, sends, calls, uploads, or shares anything."
        >
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
            onClick={() => refresh()}
          >
            {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            Refresh
          </button>
          {message && <span className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="admin-concierge-queue-summary">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-serif text-3xl">Task status</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                Showing {visibleItems.length} of {allCount} Concierge tasks.
              </p>
            </div>
            {(filter !== "all" || adapterFilter !== "all") && (
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800"
                onClick={() => {
                  setFilter("all");
                  setAdapterFilter("all");
                }}
              >
                Show all
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3 xl:grid-cols-7">
            <button
              type="button"
              onClick={() => setFilter("all")}
              aria-pressed={filter === "all"}
              className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                filter === "all"
                  ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                  : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
              }`}
              data-testid="admin-concierge-queue-filter-all"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-black">All</span>
                <span className="text-2xl font-black leading-none">{allCount}</span>
              </span>
              <span className={`mt-1 block text-xs font-bold ${filter === "all" ? "text-purple-100" : "text-[#8b7a73]"}`}>Every visible task</span>
            </button>

            {OPERATOR_CONCIERGE_QUEUE_STATUSES.map((status) => {
              const Icon = statusIcons[status];
              const active = filter === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilter(status)}
                  aria-pressed={active}
                  className={`min-h-[92px] rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                      : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                  }`}
                  data-testid={`admin-concierge-queue-filter-${status}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-black">
                      <Icon size={16} aria-hidden="true" />
                      {OPERATOR_CONCIERGE_QUEUE_STATUS_LABELS[status]}
                    </span>
                    <span className="text-2xl font-black leading-none">{totals[status]}</span>
                  </span>
                  <span className={`mt-1 block text-xs font-bold ${active ? "text-purple-100" : "text-[#8b7a73]"}`}>{statusDescriptions[status]}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-[#eadfd5] pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#2f2135]">Channel attempts</h3>
                <p className="mt-1 text-xs font-bold text-[#7d6b65]">Filter by the last adapter result recorded for each Concierge task.</p>
              </div>
              <span className="text-sm font-black text-[#7d6b65]">{adapterAllCount} with adapter history</span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <button
                type="button"
                onClick={() => setAdapterFilter("all")}
                aria-pressed={adapterFilter === "all"}
                className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition ${
                  adapterFilter === "all"
                    ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                    : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                }`}
                data-testid="admin-concierge-adapter-filter-all"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black">All attempts</span>
                  <span className="text-xl font-black leading-none">{adapterAllCount}</span>
                </span>
              </button>
              {OPERATOR_CONCIERGE_ADAPTER_STATUSES.map((status) => {
                const active = adapterFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setAdapterFilter(status)}
                    aria-pressed={active}
                    className={`min-h-16 rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : "border-[#eadfd5] bg-[#fffaf4] text-[#2f2135] hover:border-purple-200"
                    }`}
                    data-testid={`admin-concierge-adapter-filter-${status}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-sm font-black">{adapterStatusLabels[status]}</span>
                      <span className="text-xl font-black leading-none">{adapterTotals[status]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" aria-label="Owner filters">
            {[
              { id: "all" as const, label: "All owners", count: allCount },
              { id: "mine" as const, label: "Assigned to me", count: mineCount },
              { id: "unassigned" as const, label: "Unassigned", count: unassignedCount },
            ].map((owner) => {
              const active = ownerFilter === owner.id;
              return (
                <button
                  key={owner.id}
                  type="button"
                  onClick={() => setOwnerFilter(owner.id)}
                  aria-pressed={active}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${
                    active
                      ? "border-purple-600 bg-purple-700 text-white"
                      : "border-[#eadfd5] bg-[#fffaf4] text-[#5b4a46] hover:border-purple-200 hover:text-purple-700"
                  }`}
                  data-testid={`admin-concierge-owner-filter-${owner.id}`}
                >
                  {owner.label}
                  <span className={active ? "text-purple-100" : "text-[#8b7a73]"}>{owner.count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm" data-testid="admin-concierge-queue-list">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Operator list</h2>
              <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Prioritize missing information and failed tasks first, then ready work.</p>
            </div>
            {loading && <span className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700"><Loader2 size={16} className="animate-spin" /> Loading</span>}
          </div>

          <div className="mt-4 grid gap-3">
            {!loading && visibleItems.length === 0 ? (
              <div className="rounded-[18px] bg-[#fbf8f5] px-5 py-8 text-center text-sm font-bold text-[#7d6b65]">
                No Concierge tasks match this status.
              </div>
            ) : visibleItems.map((item) => (
              <article key={`${item.source}-${item.id}`} className="rounded-[18px] border border-[#eadfd5] bg-[#fffdfb] p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.status]}`}>
                        {OPERATOR_CONCIERGE_QUEUE_STATUS_LABELS[item.status]}
                      </span>
                      <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-black text-purple-800">{cleanLabel(item.use_case)}</span>
                      {item.active_tool && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f7f2eb] px-3 py-1 text-xs font-black text-[#6b5a53]">
                          <Wrench size={13} aria-hidden="true" />
                          {cleanLabel(item.active_tool)}
                        </span>
                      )}
                      {item.adapter_incident && (
                        <span className={`rounded-full border px-3 py-1 text-xs font-black ${adapterStatusStyles[item.adapter_incident.status]}`}>
                          {adapterStatusLabels[item.adapter_incident.status]}
                        </span>
                      )}
                      {item.adapter_incident && (
                        <span className="rounded-full bg-[#f7f2eb] px-3 py-1 text-xs font-black text-[#6b5a53]">
                          {incidentModeLabel(item)}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-xl font-black text-[#2f2135]">{item.action_summary}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                      {item.user_label}
                      {item.user_contact ? ` - ${item.user_contact}` : ""}
                    </p>
                  </div>
                  <div className="grid gap-1 text-left text-sm font-bold text-[#6b5a53] lg:min-w-[15rem] lg:text-right">
                    <span>Updated {formatDate(item.updated_at)}</span>
                    <span>{assignmentLabel(item)}</span>
                    <span>{item.user_confirmed ? "User confirmed" : "Awaiting confirmation"}</span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Provider</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{item.provider_name || "No provider saved"}</p>
                    {item.provider_phone && <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{item.provider_phone}</p>}
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Flow</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{cleanLabel(item.flow_reference) || "general task"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{cleanLabel(item.action_type) || item.source}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Missing</p>
                    <p className="mt-1 font-bold text-[#2f2135]">
                      {item.missing_labels.length > 0 ? item.missing_labels.join(", ") : "Nothing obvious"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Channel result</p>
                    {item.adapter_incident ? (
                      <>
                        <p className="mt-1 font-bold text-[#2f2135]">{historyModeLabel(item)}</p>
                        <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{cleanLabel(item.adapter_incident.channel) || cleanLabel(item.adapter_incident.tool) || "adapter"}</p>
                        <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{incidentSummary(item)}</p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">{formatDate(item.adapter_incident.attempted_at)}</p>
                      </>
                    ) : (
                      <p className="mt-1 font-bold text-[#2f2135]">{historyModeLabel(item)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {canTakeTask(item) && (
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-black text-emerald-800 transition hover:border-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2"
                      onClick={() => takeTask(item)}
                      disabled={assigningId === item.id}
                    >
                      {assigningId === item.id ? "Taking..." : "Take task"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-purple-700 px-5 text-sm font-black text-white shadow-sm transition hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2"
                    onClick={() => {
                      setSelectedItem(item);
                      setOutcomeNote("");
                    }}
                  >
                    Open task
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1f1724]/55 px-4 py-4 sm:items-center" role="presentation">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-task-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[selectedItem.status]}`}>
                  {OPERATOR_CONCIERGE_QUEUE_STATUS_LABELS[selectedItem.status]}
                </span>
                <h2 id="operator-task-title" className="mt-3 font-serif text-3xl leading-tight text-[#2f2135]">
                  {selectedItem.action_summary}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#7d6b65]">
                  {selectedItem.user_label}
                  {selectedItem.user_contact ? ` - ${selectedItem.user_contact}` : ""}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close task detail"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#eadfd5] bg-[#fffaf4] text-[#5b4a46] transition hover:border-purple-200 hover:text-purple-700"
                onClick={() => setSelectedItem(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Provider</p>
                <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.provider_name || "No provider saved"}</p>
                {selectedItem.provider_phone && <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{selectedItem.provider_phone}</p>}
              </div>
              <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Work mode</p>
                <p className="mt-1 font-bold text-[#2f2135]">{historyModeLabel(selectedItem)}</p>
                <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{cleanLabel(selectedItem.active_tool) || cleanLabel(selectedItem.action_type) || "operator review"}</p>
              </div>
              <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Missing info</p>
                <p className="mt-1 font-bold text-[#2f2135]">
                  {selectedItem.missing_labels.length > 0 ? selectedItem.missing_labels.join(", ") : "Nothing obvious"}
                </p>
              </div>
              <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Safety</p>
                <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.user_confirmed ? "User confirmed" : "Awaiting user confirmation"}</p>
                <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Updated {formatDate(selectedItem.updated_at)}</p>
              </div>
              <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3 md:col-span-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Owner</p>
                <p className="mt-1 font-bold text-[#2f2135]">{assignmentLabel(selectedItem)}</p>
                {selectedItem.operator_assigned_at && (
                  <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Taken {formatDate(selectedItem.operator_assigned_at)}</p>
                )}
              </div>
            </div>

            {selectedItem.adapter_payload_preview && (
              <section className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#fffdfb] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Payload preview</p>
                    <h3 className="mt-1 text-xl font-black text-[#2f2135]">
                      {selectedItem.adapter_payload_preview.channel
                        ? cleanLabel(selectedItem.adapter_payload_preview.channel)
                        : "No live adapter channel"}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                      {selectedItem.adapter_payload_preview.adapter || "No adapter mapped"}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${
                    selectedItem.adapter_payload_preview.valid
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}>
                    {selectedItem.adapter_payload_preview.valid ? "Contract ready" : "Missing fields"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Provider target</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.adapter_payload_preview.provider_name || "No provider saved"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{selectedItem.adapter_payload_preview.provider_contact || "No contact saved"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">User-approved summary</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.adapter_payload_preview.summary || "No summary saved"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Trace fields</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.adapter_payload_preview.pending_id || "No pending ID"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{selectedItem.adapter_payload_preview.user_id || "No user ID"}</p>
                  </div>
                </div>
                {selectedItem.adapter_payload_preview.missing_fields.length > 0 && (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3">
                    <p className="text-sm font-black text-amber-900">Fix before live send</p>
                    <ul className="mt-2 grid gap-1 text-sm font-bold text-amber-800">
                      {selectedItem.adapter_payload_preview.missing_fields.map((field) => (
                        <li key={field.key}>{field.label}: {field.detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedItem.adapter_approval && (
                  <div className={`mt-3 rounded-2xl px-4 py-3 ${
                    selectedItem.adapter_approval.requires_reconfirmation
                      ? "bg-red-50 text-red-800"
                      : "bg-emerald-50 text-emerald-800"
                  }`}>
                    <p className="text-sm font-black">
                      {selectedItem.adapter_approval.requires_reconfirmation
                        ? "User reconfirmation required"
                        : "Approval still matches"}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {selectedItem.adapter_approval.requires_reconfirmation
                        ? `Changed since approval: ${approvalChangedLabels(selectedItem.adapter_approval.changed_fields)}.`
                        : "Provider, channel, summary, and payload match the saved approval."}
                    </p>
                    {selectedItem.adapter_approval.approved_at && (
                      <p className="mt-1 text-xs font-bold">Approved {formatDate(selectedItem.adapter_approval.approved_at)}</p>
                    )}
                  </div>
                )}
                {selectedItem.reconfirmation_request && (
                  <div
                    className={`mt-3 rounded-2xl px-4 py-3 ${
                      selectedItem.reconfirmation_request.status === "needed"
                        ? "bg-amber-50 text-amber-900"
                        : "bg-emerald-50 text-emerald-800"
                    }`}
                    data-testid="panel-admin-reconfirmation-request"
                  >
                    <p className="text-sm font-black">
                      {selectedItem.reconfirmation_request.status === "needed"
                        ? "Reconfirmation requested"
                        : "Reconfirmation resolved"}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      Changed details: {approvalChangedLabels(selectedItem.reconfirmation_request.changed_fields)}.
                    </p>
                    <p className="mt-1 text-xs font-bold">
                      Requested {formatDate(selectedItem.reconfirmation_request.requested_at)}
                      {selectedItem.reconfirmation_request.resolved_at ? ` - resolved ${formatDate(selectedItem.reconfirmation_request.resolved_at)}` : ""}
                    </p>
                    {selectedItem.reconfirmation_request.payload_preview && (
                      <div className="mt-3 grid gap-2 md:grid-cols-3">
                        <div className="rounded-2xl bg-white/70 px-3 py-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.1em]">Provider</p>
                          <p className="mt-1 text-sm font-black">{selectedItem.reconfirmation_request.payload_preview.provider_name || "No provider saved"}</p>
                          <p className="mt-1 text-xs font-bold">{selectedItem.reconfirmation_request.payload_preview.provider_contact || "No contact saved"}</p>
                        </div>
                        <div className="rounded-2xl bg-white/70 px-3 py-2 md:col-span-2">
                          <p className="text-[11px] font-black uppercase tracking-[0.1em]">Current user preview</p>
                          <p className="mt-1 text-sm font-black">{selectedItem.reconfirmation_request.payload_preview.summary || "No summary saved"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Outbound payload</p>
                  <pre className="mt-2 max-h-72 overflow-auto rounded-2xl bg-[#1f1724] p-4 text-xs font-semibold leading-relaxed text-[#fffaf4]">
                    {formatPayload(selectedItem.adapter_payload_preview.outbound_payload)}
                  </pre>
                </div>
              </section>
            )}

            {selectedItem.adapter_incident && (
              <section className="mt-5 rounded-2xl border border-[#eadfd5] bg-[#fffdfb] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Channel incident</p>
                    <h3 className="mt-1 text-xl font-black text-[#2f2135]">
                      {adapterStatusLabels[selectedItem.adapter_incident.status]} - {incidentModeLabel(selectedItem)}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">
                      {cleanLabel(selectedItem.adapter_incident.channel) || cleanLabel(selectedItem.adapter_incident.tool) || "adapter"}
                      {selectedItem.adapter_incident.adapter ? ` via ${selectedItem.adapter_incident.adapter}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${adapterStatusStyles[selectedItem.adapter_incident.status]}`}>
                    {adapterStatusLabels[selectedItem.adapter_incident.status]}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Provider target</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{selectedItem.adapter_incident.provider_name || selectedItem.provider_name || "No provider saved"}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{selectedItem.adapter_incident.provider_contact || selectedItem.provider_phone || "No contact saved"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fbf8f5] px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Latest result</p>
                    <p className="mt-1 font-bold text-[#2f2135]">{incidentSummary(selectedItem)}</p>
                    <p className="mt-1 text-sm font-semibold text-[#7d6b65]">Attempted {formatDate(selectedItem.adapter_incident.attempted_at)}</p>
                  </div>
                </div>
                {selectedItem.adapter_incident.retry_blocker && !selectedItem.adapter_incident.retry_allowed && (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                    Retry blocked: {selectedItem.adapter_incident.retry_blocker === "user_reconfirmation_required"
                      ? "user reconfirmation required"
                      : selectedItem.adapter_incident.retry_blocker}
                  </div>
                )}
                {selectedItem.adapter_incident.manual_follow_up_queued_at && (
                  <div className="mt-3 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800">
                    Manual follow-up queued {formatDate(selectedItem.adapter_incident.manual_follow_up_queued_at)}.
                  </div>
                )}
                {selectedItem.adapter_incident.attempts.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Attempt history</p>
                    <div className="mt-2 grid gap-2">
                      {selectedItem.adapter_incident.attempts.map((attempt, index) => (
                        <div key={`${attempt.event}-${attempt.at ?? index}`} className="rounded-2xl bg-[#fbf8f5] px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-black text-[#2f2135]">{cleanLabel(attempt.event)}</span>
                            <span className="font-bold text-[#7d6b65]">{formatDate(attempt.at)}</span>
                          </div>
                          <p className="mt-1 font-semibold text-[#7d6b65]">
                            {attempt.status ? adapterStatusLabels[attempt.status] : cleanLabel(attempt.mode) || "Audit"}
                            {attempt.channel ? ` - ${cleanLabel(attempt.channel)}` : ""}
                          </p>
                          {(attempt.error || attempt.blocker || attempt.reason || attempt.result) && (
                            <p className="mt-1 font-semibold text-[#2f2135]">{attempt.error || attempt.blocker || attempt.reason || attempt.result}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <label className="mt-5 block">
              <span className="text-sm font-black text-[#4d4351]">Operator note</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                value={outcomeNote}
                onChange={(event) => setOutcomeNote(event.target.value)}
                placeholder="Example: Taxi confirmed for 10:30, or provider did not answer."
              />
            </label>

            {selectedCanAct ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                {canTakeTask(selectedItem) && (
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 px-4 text-sm font-black text-purple-800 transition hover:border-purple-300"
                    onClick={() => takeTask(selectedItem)}
                    disabled={Boolean(assigningId)}
                  >
                    {assigningId === selectedItem.id ? "Taking..." : "Take task"}
                  </button>
                )}
                {selectedItem.status !== "in_progress" && (
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-800 transition hover:border-blue-300"
                    onClick={() => updateTask("in_progress")}
                    disabled={Boolean(savingAction)}
                  >
                    {savingAction === "in_progress" ? "Saving..." : "Mark in progress"}
                  </button>
                )}
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-800 transition hover:border-emerald-300"
                  onClick={() => updateTask("done")}
                  disabled={Boolean(savingAction)}
                >
                  {savingAction === "done" ? "Saving..." : "Mark done"}
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:border-red-300"
                  onClick={() => updateTask("failed")}
                  disabled={Boolean(savingAction)}
                >
                  {savingAction === "failed" ? "Saving..." : "Mark failed"}
                </button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl bg-[#fbf8f5] px-4 py-3 text-sm font-bold text-[#7d6b65]">
                Standard task controls are read-only here. It is either already closed, failed, or still awaiting user confirmation.
              </div>
            )}

            {selectedItem.adapter_incident && (selectedItem.adapter_incident.status === "failed" || selectedItem.adapter_incident.status === "blocked") && (
              <div className="mt-4 rounded-2xl border border-[#eadfd5] bg-[#fffdfb] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">Recovery</p>
                    <p className="mt-1 text-sm font-bold text-[#7d6b65]">
                      Retry checks live readiness again before any provider contact. Manual follow-up keeps the task queued for operator handling.
                    </p>
                  </div>
                  {!selectedCanRecoverIncident && (
                    <span className="rounded-full bg-[#fbf8f5] px-3 py-1 text-xs font-black text-[#7d6b65]">Not available</span>
                  )}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {selectedItem.adapter_approval?.requires_reconfirmation && (
                    <button
                      type="button"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => updateTask("request_reconfirmation")}
                      disabled={!selectedCanRecoverIncident || selectedItem.reconfirmation_request?.status === "needed" || Boolean(savingAction)}
                    >
                      {savingAction === "request_reconfirmation" ? "Requesting..." : "Request user reconfirmation"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-800 transition hover:border-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => updateTask("retry_adapter")}
                    disabled={!selectedCanRecoverIncident || !selectedItem.adapter_incident.retry_allowed || Boolean(savingAction)}
                  >
                    <RotateCcw size={16} aria-hidden="true" />
                    {savingAction === "retry_adapter" ? "Retrying..." : "Retry live action"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-800 transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => updateTask("manual_follow_up")}
                    disabled={!selectedCanRecoverIncident || !selectedItem.adapter_incident.manual_follow_up_allowed || Boolean(savingAction)}
                  >
                    {savingAction === "manual_follow_up" ? "Queuing..." : "Manual follow-up queued"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
