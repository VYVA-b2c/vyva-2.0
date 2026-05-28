import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Search } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

type ActivityResultStatus = "success" | "warning" | "failed";

type AdminActivityItem = {
  id: string;
  source: string;
  actor: string;
  action: string;
  event_type: string;
  result: string;
  result_status: ActivityResultStatus;
  target_type: string;
  target_name: string;
  target_detail?: string | null;
  channel?: string | null;
  details?: string | null;
  created_at: string;
};

type ActivityResponse = {
  activity: AdminActivityItem[];
  summary: {
    total: number;
    failed: number;
    warning: number;
    latest_at?: string | null;
  };
};

const RESULT_FILTERS = [
  { value: "all", label: "All results" },
  { value: "success", label: "Completed" },
  { value: "warning", label: "Queued / warning" },
  { value: "failed", label: "Failed" },
] as const;

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function resultClass(status: ActivityResultStatus) {
  if (status === "failed") return "bg-red-50 text-red-700 border-red-100";
  if (status === "warning") return "bg-amber-50 text-amber-800 border-amber-100";
  return "bg-emerald-50 text-emerald-800 border-emerald-100";
}

function sourceLabel(source: string) {
  if (source === "communication") return "Communication";
  return "Lifecycle";
}

export default function AdminActivityPage() {
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivityResponse["summary"]>({ total: 0, failed: 0, warning: 0 });
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<(typeof RESULT_FILTERS)[number]["value"]>("all");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadActivity() {
    setIsLoading(true);
    try {
      const res = await apiFetch("/api/admin/lifecycle/activity?limit=250");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Activity could not be loaded.");
      setItems(data.activity ?? []);
      setSummary(data.summary ?? { total: 0, failed: 0, warning: 0 });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activity could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadActivity().catch(() => undefined);
  }, []);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesResult = resultFilter === "all" || item.result_status === resultFilter;
      if (!matchesResult) return false;
      if (!needle) return true;
      return [
        item.actor,
        item.action,
        item.target_name,
        item.target_detail,
        item.result,
        item.details,
        item.channel,
        item.event_type,
      ].some((value) => String(value ?? "").toLowerCase().includes(needle));
    });
  }, [items, query, resultFilter]);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Admin activity"
          subtitle="Who did what, when, to which user or organization, and whether it worked."
        >
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={() => loadActivity().catch(() => undefined)}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {message && <span className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Events loaded" value={summary.total} />
          <SummaryCard label="Failed" value={summary.failed} tone="red" />
          <SummaryCard label="Warnings" value={summary.warning} tone="amber" />
          <SummaryCard label="Latest" value={summary.latest_at ? formatDate(summary.latest_at) : "None"} compact />
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">Audit trail</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Activity log</h2>
              <p className="mt-1 text-sm text-[#7d6b65]">{filteredItems.length} visible of {items.length} loaded events.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(220px,360px)_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8b85]" size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full rounded-xl border border-[#eadfd5] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                  placeholder="Search actor, target, action"
                />
              </label>
              <select
                value={resultFilter}
                onChange={(event) => setResultFilter(event.target.value as typeof resultFilter)}
                className="rounded-xl border border-[#eadfd5] bg-white px-3 py-2.5 text-sm font-bold outline-none transition focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
              >
                {RESULT_FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-2 text-left">
              <thead>
                <tr className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">
                  <th className="px-4 py-2">When</th>
                  <th className="px-4 py-2">Actor</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Target</th>
                  <th className="px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="rounded-2xl bg-[#fbf8f5] px-4 py-8 text-center font-bold text-[#7d6b65]">
                      No activity matches the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="align-top">
                      <td className="rounded-l-2xl bg-[#fbf8f5] px-4 py-4 text-sm font-bold text-[#4f4352]">{formatDate(item.created_at)}</td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="break-words font-black">{item.actor}</p>
                        <p className="mt-1 text-xs font-bold text-[#8b7a73]">{sourceLabel(item.source)}</p>
                      </td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="font-black">{item.action}</p>
                        {item.details && <p className="mt-1 max-w-md break-words text-xs font-semibold text-[#7d6b65]">{item.details}</p>}
                      </td>
                      <td className="bg-[#fbf8f5] px-4 py-4">
                        <p className="font-black">{item.target_name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-[#8b7a73]">{item.target_type}</p>
                        {item.target_detail && <p className="mt-1 break-words text-xs font-semibold text-[#7d6b65]">{item.target_detail}</p>}
                      </td>
                      <td className="rounded-r-2xl bg-[#fbf8f5] px-4 py-4">
                        <span className={`inline-flex max-w-xs rounded-full border px-3 py-1 text-xs font-black ${resultClass(item.result_status)}`}>
                          {item.result}
                        </span>
                        {item.channel && <p className="mt-2 text-xs font-bold text-[#8b7a73]">{item.channel}</p>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "purple",
  compact = false,
}: {
  label: string;
  value: number | string;
  tone?: "purple" | "red" | "amber";
  compact?: boolean;
}) {
  const toneClass = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-[#2f2135]";
  return (
    <article className="rounded-2xl border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Activity size={16} className={toneClass} />
        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{label}</p>
      </div>
      <p className={`mt-2 font-black ${toneClass} ${compact ? "text-base" : "text-3xl"}`}>{value}</p>
    </article>
  );
}
