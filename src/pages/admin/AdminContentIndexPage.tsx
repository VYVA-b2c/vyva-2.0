import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  CircleSlash2,
  Home,
  Languages,
  ListFilter,
  MessageSquareText,
  RefreshCw,
  Search,
} from "lucide-react";
import type {
  AdminContentIndexItem,
  AdminContentIndexResponse,
  AdminContentStatus,
  AdminContentType,
} from "../../../shared/adminContentIndex";
import { apiFetch } from "@/lib/queryClient";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";

type TypeFilter = "all" | AdminContentType;
type StatusFilter = "all" | "published" | "not_live";
type ReadinessFilter = "all" | "ready" | "attention" | "route_issues" | "language_gaps";

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All content" },
  { value: "home_card", label: "Home cards" },
  { value: "curated_activity", label: "Activities" },
  { value: "lesson", label: "Lessons" },
  { value: "room_prompt", label: "Room prompts" },
];

const TYPE_META: Record<AdminContentType, { label: string; icon: typeof Home; tone: string }> = {
  home_card: { label: "Home card", icon: Home, tone: "bg-violet-50 text-violet-700" },
  curated_activity: { label: "Activity", icon: CalendarCheck, tone: "bg-sky-50 text-sky-700" },
  lesson: { label: "Lesson", icon: BookOpen, tone: "bg-amber-50 text-amber-800" },
  room_prompt: { label: "Room prompt", icon: MessageSquareText, tone: "bg-emerald-50 text-emerald-700" },
};

function statusTone(status: AdminContentStatus) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "hidden" || status === "archived") return "bg-slate-100 text-slate-600";
  if (status === "review" || status === "mixed") return "bg-sky-50 text-sky-700";
  return "bg-amber-50 text-amber-800";
}

function formatDate(value: string | null) {
  if (!value) return "No update date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No update date";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function needsAttention(item: AdminContentIndexItem) {
  return item.missingContent.length > 0 || item.languageCoverage.missing.length > 0 || item.routeStatus !== "ready";
}

function matchesReadiness(item: AdminContentIndexItem, filter: ReadinessFilter) {
  if (filter === "all") return true;
  if (filter === "ready") return !needsAttention(item);
  if (filter === "attention") return needsAttention(item);
  if (filter === "route_issues") return item.routeStatus !== "ready";
  return item.languageCoverage.missing.length > 0;
}

export default function AdminContentIndexPage() {
  const [data, setData] = useState<AdminContentIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [languageFilter, setLanguageFilter] = useState("all");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/admin/content-index");
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Content index could not be loaded.");
      setData(payload as AdminContentIndexResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Content index could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.items ?? []).filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (statusFilter === "published" && item.status !== "published") return false;
      if (statusFilter === "not_live" && item.status === "published") return false;
      if (!matchesReadiness(item, readinessFilter)) return false;
      if (languageFilter !== "all" && !item.languageCoverage.missing.includes(languageFilter as never)) return false;
      if (query) {
        const haystack = [
          item.title,
          item.subtitle,
          item.sourceId,
          item.type,
          item.status,
          item.route ?? "",
          ...item.missingContent,
        ].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [data, languageFilter, readinessFilter, search, statusFilter, typeFilter]);

  const hasFilters = Boolean(search || typeFilter !== "all" || statusFilter !== "all" || readinessFilter !== "all" || languageFilter !== "all");

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setReadinessFilter("all");
    setLanguageFilter("all");
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-6 text-[#2f2135] sm:px-6 sm:py-8">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Content index"
          subtitle="One place to find what is live, incomplete, untranslated, or pointing to the wrong destination. Open any item in its source editor."
        >
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-purple-700 px-4 text-sm font-black text-white disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
        </AdminPageHeader>

        <AdminMenu />

        {error ? (
          <div className="mt-5 flex items-start gap-3 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800" role="alert">
            <AlertTriangle size={20} className="shrink-0" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        {data?.sources.some((source) => !source.available) ? (
          <section className="mt-5 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3" data-testid="content-index-source-warning">
            <p className="text-sm font-black text-amber-900">Some content sources are unavailable</p>
            <p className="mt-1 text-sm font-semibold text-amber-800">
              {data.sources.filter((source) => !source.available).map((source) => TYPE_META[source.type].label).join(", ")}. Other sources are still shown.
            </p>
          </section>
        ) : null}

        <section className="mt-5 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-white shadow-sm" aria-label="Content readiness summary">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Content groups", value: data?.summary.total ?? 0, note: "Across four sources", tone: "text-[#2f2135]" },
              { label: "Live", value: data?.summary.published ?? 0, note: "Published or enabled", tone: "text-emerald-700" },
              { label: "Needs attention", value: data?.summary.needsAttention ?? 0, note: "Any visible readiness gap", tone: "text-amber-800" },
              { label: "Route issues", value: data?.summary.routeIssues ?? 0, note: "Missing destinations", tone: "text-red-700" },
              { label: "Language gaps", value: data?.summary.languageGaps ?? 0, note: "Missing app-language copy", tone: "text-sky-700" },
            ].map((stat, index) => (
              <div key={stat.label} className={`px-5 py-4 ${index > 0 ? "border-t border-[#eee5dd] sm:border-l lg:border-t-0" : ""}`}>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8b7a73]">{stat.label}</p>
                <p className={`mt-1 text-3xl font-black ${stat.tone}`}>{loading ? "-" : stat.value}</p>
                <p className="mt-1 text-xs font-semibold text-[#8b7a73]">{stat.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm" aria-label="Content filters">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">Search</span>
              <span className="relative block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b7a73]" size={17} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Title, ID, route, or missing field"
                  className="h-11 w-full rounded-[10px] border border-[#dfd3ca] bg-[#fffdfb] pl-10 pr-3 text-sm font-semibold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100"
                  data-testid="content-index-search"
                />
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect label="Type" value={typeFilter} onChange={(value) => setTypeFilter(value as TypeFilter)} options={TYPE_OPTIONS} />
              <FilterSelect label="Publication" value={statusFilter} onChange={(value) => setStatusFilter(value as StatusFilter)} options={[
                { value: "all", label: "Any status" }, { value: "published", label: "Live only" }, { value: "not_live", label: "Not live" },
              ]} />
              <FilterSelect label="Readiness" value={readinessFilter} onChange={(value) => setReadinessFilter(value as ReadinessFilter)} options={[
                { value: "all", label: "Any readiness" }, { value: "ready", label: "Ready" }, { value: "attention", label: "Needs attention" },
                { value: "route_issues", label: "Route issues" }, { value: "language_gaps", label: "Language gaps" },
              ]} />
              <FilterSelect label="Missing language" value={languageFilter} onChange={setLanguageFilter} options={[
                { value: "all", label: "Any language" }, ...["en", "es", "fr", "de", "it", "pt"].map((language) => ({ value: language, label: language.toUpperCase() })),
              ]} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#eee5dd] pt-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold text-[#6f625e]">
              <ListFilter size={16} aria-hidden="true" />
              Showing {visibleItems.length} of {data?.items.length ?? 0}
            </p>
            {hasFilters ? (
              <button type="button" onClick={clearFilters} className="text-sm font-black text-purple-700 hover:underline">Clear filters</button>
            ) : null}
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-[14px] border border-[#eadfd5] bg-white shadow-sm" data-testid="content-index-list">
          <div className="hidden grid-cols-[minmax(250px,1.6fr)_120px_190px_minmax(210px,1fr)_90px] gap-4 border-b border-[#eadfd5] bg-[#fbf8f5] px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[#7d6b65] lg:grid">
            <span>Content</span><span>Status</span><span>Languages</span><span>Readiness</span><span className="text-right">Edit</span>
          </div>
          {loading ? (
            <div className="px-5 py-12 text-center text-sm font-bold text-[#7d6b65]">Loading content operations...</div>
          ) : visibleItems.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <CircleSlash2 className="mx-auto text-[#b8aaa1]" size={28} aria-hidden="true" />
              <p className="mt-3 font-black">No content matches these filters.</p>
            </div>
          ) : visibleItems.map((item) => <ContentRow key={item.key} item={item} />)}
        </section>
      </section>
    </main>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full min-w-[150px] rounded-[10px] border border-[#dfd3ca] bg-[#fffdfb] px-3 text-sm font-bold outline-none focus:border-purple-400 focus:ring-4 focus:ring-purple-100">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ContentRow({ item }: { item: AdminContentIndexItem }) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const attention = needsAttention(item);
  return (
    <article className="grid gap-4 border-b border-[#eee5dd] px-4 py-4 last:border-b-0 lg:grid-cols-[minmax(250px,1.6fr)_120px_190px_minmax(210px,1fr)_90px] lg:items-center" data-testid={`content-index-item-${item.key}`}>
      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${meta.tone}`}><Icon size={18} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="break-words font-black leading-snug">{item.title}</p>
            <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#7d6b65]">{item.subtitle}</p>
            <p className="mt-1 break-all text-xs font-bold text-[#9b8c84]">{item.sourceId} - {formatDate(item.updatedAt)}</p>
          </div>
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-[#8b7a73] lg:hidden">Status</span>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black capitalize ${statusTone(item.status)}`}>{item.status}</span>
      </div>
      <div>
        <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-[#8b7a73] lg:hidden">Languages</span>
        {item.languageCoverage.mode === "universal" ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700"><Languages size={15} aria-hidden="true" /> Universal</span>
        ) : (
          <div>
            <p className="text-sm font-black">{item.languageCoverage.available.length}/{item.languageCoverage.expected.length} ready</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {item.languageCoverage.expected.map((language) => {
                const ready = item.languageCoverage.available.includes(language);
                return <span key={language} className={`rounded px-1.5 py-0.5 text-[10px] font-black uppercase ${ready ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{language}</span>;
              })}
            </div>
          </div>
        )}
      </div>
      <div>
        <span className="mb-1 block text-xs font-black uppercase tracking-[0.1em] text-[#8b7a73] lg:hidden">Readiness</span>
        {attention ? (
          <div className="flex items-start gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {item.routeStatus !== "ready" ? "Route needs fixing" : null}
              {item.routeStatus !== "ready" && (item.missingContent.length > 0 || item.languageCoverage.missing.length > 0) ? "; " : null}
              {item.missingContent.length > 0 ? `${item.missingContent.slice(0, 2).join(", ")}${item.missingContent.length > 2 ? ` +${item.missingContent.length - 2}` : ""}` : null}
              {item.missingContent.length > 0 && item.languageCoverage.missing.length > 0 ? "; " : null}
              {item.languageCoverage.missing.length > 0 ? `Missing ${item.languageCoverage.missing.map((language) => language.toUpperCase()).join(", ")}` : null}
            </span>
          </div>
        ) : (
          <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700"><CheckCircle2 size={16} aria-hidden="true" /> Ready</span>
        )}
      </div>
      <div className="lg:text-right">
        <Link to={item.editorUrl} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[10px] border border-purple-200 bg-purple-50 px-3 text-sm font-black text-purple-700 hover:bg-purple-100" aria-label={`Edit ${item.title}`}>
          Edit <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
