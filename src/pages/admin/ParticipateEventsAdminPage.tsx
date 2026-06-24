import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Globe2, Plus, RefreshCw, Save, Search, ShieldCheck } from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import type {
  AdminParticipationEvent,
  ParticipationEventFormat,
  ParticipationHelperAction,
} from "@/social/types";

type EventStatus = "active" | "draft" | "hidden" | "archived";
type SafetyStatus = "approved" | "needs_review" | "hidden";
type ActivityRecord = Record<string, unknown>;

type AdminParticipationActivity = {
  responses?: ActivityRecord[];
  checks?: ActivityRecord[];
  notifications?: ActivityRecord[];
};

type Filters = {
  search: string;
  city: string;
  country: string;
  language: string;
  status: string;
  format: string;
  safety: string;
};

const STATUS_OPTIONS: EventStatus[] = ["draft", "active", "hidden", "archived"];
const FORMAT_OPTIONS: ParticipationEventFormat[] = ["nearby", "online", "hybrid"];
const SAFETY_OPTIONS: SafetyStatus[] = ["approved", "needs_review", "hidden"];
const LANGUAGE_OPTIONS = ["en", "es", "de"];
const HELPER_ACTION_OPTIONS: ParticipationHelperAction[] = ["check_details", "transport", "reminder", "bring_friend"];

const emptyCounts = { interested: 0, maybe: 0, not_for_me: 0 };

const emptyEvent: AdminParticipationEvent = {
  id: "",
  eventKey: "",
  titleEs: "",
  titleDe: "",
  titleEn: "",
  summaryEs: "",
  summaryDe: "",
  summaryEn: "",
  descriptionEs: "",
  descriptionDe: "",
  descriptionEn: "",
  format: "nearby",
  locationLabel: "Nearby",
  city: "",
  countryCode: "ES",
  timeLabelEs: "",
  timeLabelDe: "",
  timeLabelEn: "",
  startsAt: null,
  endsAt: null,
  costLabelEs: "",
  costLabelDe: "",
  costLabelEn: "",
  languageCodes: ["en", "es", "de"],
  tags: [],
  interestTags: [],
  accessibilityTags: [],
  helperActions: ["check_details"],
  source: "admin",
  sourceUrl: null,
  status: "draft",
  isCurated: true,
  needsLiveCheck: true,
  safetyStatus: "needs_review",
  metadata: {},
  createdBy: null,
  createdAt: null,
  updatedAt: null,
  responseCounts: emptyCounts,
  checkRequestCount: 0,
};

function cloneEvent(event: AdminParticipationEvent) {
  return JSON.parse(JSON.stringify(event)) as AdminParticipationEvent;
}

function listToText(values?: string[]) {
  return (values ?? []).join(", ");
}

function textToList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanText(value?: string | null) {
  return value?.trim() ?? "";
}

function nullableText(value?: string | null) {
  const trimmed = cleanText(value);
  return trimmed ? trimmed : null;
}

function normalizeCountry(value?: string | null) {
  const trimmed = cleanText(value).toUpperCase();
  return trimmed ? trimmed.slice(0, 2) : null;
}

function normalizeHelperActions(values: string[]) {
  return values.filter((value): value is ParticipationHelperAction => (
    HELPER_ACTION_OPTIONS.includes(value as ParticipationHelperAction)
  ));
}

function eventPayload(event: AdminParticipationEvent, includeKey: boolean) {
  const payload = {
    ...(includeKey ? { eventKey: cleanText(event.eventKey) } : {}),
    titleEs: cleanText(event.titleEs),
    titleDe: cleanText(event.titleDe),
    titleEn: cleanText(event.titleEn),
    summaryEs: cleanText(event.summaryEs),
    summaryDe: cleanText(event.summaryDe),
    summaryEn: cleanText(event.summaryEn),
    descriptionEs: cleanText(event.descriptionEs),
    descriptionDe: cleanText(event.descriptionDe),
    descriptionEn: cleanText(event.descriptionEn),
    format: event.format,
    locationLabel: cleanText(event.locationLabel) || (event.format === "online" ? "Online" : "Nearby"),
    city: nullableText(event.city),
    countryCode: normalizeCountry(event.countryCode),
    timeLabelEs: cleanText(event.timeLabelEs),
    timeLabelDe: cleanText(event.timeLabelDe),
    timeLabelEn: cleanText(event.timeLabelEn),
    startsAt: nullableText(event.startsAt),
    endsAt: nullableText(event.endsAt),
    costLabelEs: cleanText(event.costLabelEs),
    costLabelDe: cleanText(event.costLabelDe),
    costLabelEn: cleanText(event.costLabelEn),
    languageCodes: event.languageCodes.map((language) => language.trim()).filter(Boolean),
    tags: event.tags.map((tag) => tag.trim()).filter(Boolean),
    interestTags: event.interestTags.map((tag) => tag.trim()).filter(Boolean),
    accessibilityTags: event.accessibilityTags.map((tag) => tag.trim()).filter(Boolean),
    helperActions: normalizeHelperActions(event.helperActions),
    source: cleanText(event.source) || "admin",
    sourceUrl: nullableText(event.sourceUrl),
    status: event.status as EventStatus,
    isCurated: event.isCurated,
    needsLiveCheck: event.needsLiveCheck,
    safetyStatus: event.safetyStatus as SafetyStatus,
    metadata: event.metadata ?? {},
  };
  return payload;
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-sm font-bold text-[#4d4351]">
        <span>{label}</span>
        {optional && <span className="font-normal text-purple-700">Optional</span>}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      className="min-h-20 w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold leading-relaxed text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | string;
  onChange: (value: T) => void;
  options: readonly T[];
}) {
  return (
    <select
      className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]"
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
    >
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function Pill({ children, tone = "purple" }: { children: ReactNode; tone?: "purple" | "green" | "amber" | "rose" | "plain" }) {
  const tones = {
    purple: "bg-purple-50 text-purple-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    plain: "bg-[#f7f2eb] text-[#5b4a46]",
  };
  return <span className={`rounded-full px-3 py-1.5 text-xs font-black ${tones[tone]}`}>{children}</span>;
}

function cityKey(event: AdminParticipationEvent) {
  const city = cleanText(event.city);
  const country = cleanText(event.countryCode).toUpperCase();
  return city ? `${city}${country ? `, ${country}` : ""}` : "";
}

function statusTone(status: string) {
  if (status === "active") return "green";
  if (status === "draft") return "amber";
  if (status === "hidden") return "rose";
  return "plain";
}

function safetyTone(status: string) {
  if (status === "approved") return "green";
  if (status === "needs_review") return "amber";
  return "rose";
}

export default function ParticipateEventsAdminPage() {
  const [events, setEvents] = useState<AdminParticipationEvent[]>([]);
  const [activity, setActivity] = useState<AdminParticipationActivity>({});
  const [draft, setDraft] = useState<AdminParticipationEvent>(cloneEvent(emptyEvent));
  const [filters, setFilters] = useState<Filters>({
    search: "",
    city: "",
    country: "",
    language: "",
    status: "",
    format: "",
    safety: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function api(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/social/participate${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Admin request failed");
    return data;
  }

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      const [eventData, activityData] = await Promise.all([
        api("/events"),
        api("/activity"),
      ]);
      setEvents(eventData.events ?? []);
      setActivity(activityData.activity ?? {});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setMessage(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cityOptions = useMemo(() => (
    Array.from(new Set(events.map((event) => cleanText(event.city)).filter(Boolean))).sort()
  ), [events]);

  const countryOptions = useMemo(() => (
    Array.from(new Set(events.map((event) => cleanText(event.countryCode).toUpperCase()).filter(Boolean))).sort()
  ), [events]);

  const filteredEvents = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return events.filter((event) => {
      const haystack = [
        event.eventKey,
        event.titleEn,
        event.titleEs,
        event.titleDe,
        event.city ?? "",
        event.countryCode ?? "",
        ...event.tags,
        ...event.interestTags,
      ].join(" ").toLowerCase();
      if (query && !haystack.includes(query)) return false;
      if (filters.city && cleanText(event.city).toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.country && cleanText(event.countryCode).toUpperCase() !== filters.country.toUpperCase()) return false;
      if (filters.language && !event.languageCodes.includes(filters.language)) return false;
      if (filters.status && event.status !== filters.status) return false;
      if (filters.format && event.format !== filters.format) return false;
      if (filters.safety && event.safetyStatus !== filters.safety) return false;
      return true;
    });
  }, [events, filters]);

  const activeApproved = useMemo(() => (
    events.filter((event) => event.status === "active" && event.safetyStatus === "approved")
  ), [events]);

  const onlineFallbackCount = activeApproved.filter((event) => event.format === "online" || event.format === "hybrid").length;
  const localCityCount = new Set(activeApproved.map(cityKey).filter(Boolean)).size;
  const interestedCount = events.reduce((sum, event) => sum + event.responseCounts.interested, 0);
  const checkRequestCount = events.reduce((sum, event) => sum + event.checkRequestCount, 0);

  const coverageRows = useMemo(() => {
    const map = new Map<string, { label: string; active: number; drafts: number; checks: number; interested: number }>();
    for (const event of events) {
      const key = cityKey(event);
      if (!key) continue;
      const current = map.get(key) ?? { label: key, active: 0, drafts: 0, checks: 0, interested: 0 };
      if (event.status === "active" && event.safetyStatus === "approved") current.active += 1;
      if (event.status === "draft") current.drafts += 1;
      current.checks += event.checkRequestCount;
      current.interested += event.responseCounts.interested;
      map.set(key, current);
    }
    return Array.from(map.values()).sort((a, b) => b.active - a.active || a.label.localeCompare(b.label));
  }, [events]);

  const filteredCityHasNoActiveLocal = Boolean(filters.city) && !activeApproved.some((event) => (
    cleanText(event.city).toLowerCase() === filters.city.toLowerCase()
  ));

  function updateEvent(eventKey: string, patch: Partial<AdminParticipationEvent>) {
    setEvents((current) => current.map((event) => event.eventKey === eventKey ? { ...event, ...patch } : event));
  }

  async function addEvent() {
    const body = eventPayload(draft, true);
    await api("/events", { method: "POST", body: JSON.stringify(body) });
    setMessage(`${body.eventKey} added as ${body.status}.`);
    setDraft(cloneEvent(emptyEvent));
    await refresh();
  }

  async function saveEvent(event: AdminParticipationEvent) {
    const body = eventPayload(event, false);
    await api(`/events/${event.eventKey}`, { method: "PATCH", body: JSON.stringify(body) });
    setMessage(`${event.eventKey} saved.`);
    await refresh();
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Participate events"
          subtitle="Manage city coverage, publish status, and Concierge-checked curated events shown in Community."
        >
          <button
            className="inline-flex items-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white disabled:opacity-60"
            onClick={() => refresh().catch((err) => setMessage(err.message))}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {message && <span className="rounded-2xl bg-purple-50 px-4 py-3 text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><ShieldCheck size={16} /> Active cities</div>
            <p className="mt-2 text-3xl font-black">{localCityCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><Globe2 size={16} /> Online fallback</div>
            <p className="mt-2 text-3xl font-black">{onlineFallbackCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><CheckCircle2 size={16} /> Interested</div>
            <p className="mt-2 text-3xl font-black">{interestedCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-[#eadfd5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-purple-700"><Search size={16} /> Concierge checks</div>
            <p className="mt-2 text-3xl font-black">{checkRequestCount}</p>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">City coverage</h2>
              <p className="mt-2 max-w-3xl text-sm text-[#7d6b65]">
                Active approved city events are shown first; online and hybrid events keep Participate useful when a city has no local coverage.
              </p>
            </div>
            <Pill tone={onlineFallbackCount > 0 ? "green" : "amber"}>{onlineFallbackCount > 0 ? "Online fallback available" : "No online fallback"}</Pill>
          </div>

          {filteredCityHasNoActiveLocal && (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              {filters.city} has no active approved local events. Add a draft for this city or keep online/hybrid fallback active.
            </div>
          )}

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {coverageRows.length === 0 ? (
              <div className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No city-specific events yet.</div>
            ) : coverageRows.map((row) => (
              <div key={row.label} className="rounded-2xl bg-[#f7f2eb] p-4">
                <p className="font-black">{row.label}</p>
                <p className="mt-1 text-sm text-[#7d6b65]">{row.active} active - {row.drafts} draft - {row.interested} interested - {row.checks} checks</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Filters</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">{filteredEvents.length} visible of {events.length} events.</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-7">
            <Field label="Search">
              <TextInput value={filters.search} onChange={(value) => setFilters((prev) => ({ ...prev, search: value }))} placeholder="title, tag, key" />
            </Field>
            <Field label="City filter">
              <input
                className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-semibold text-[#2f2135]"
                list="participate-admin-cities"
                value={filters.city}
                onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="Madrid"
              />
              <datalist id="participate-admin-cities">
                {cityOptions.map((city) => <option key={city} value={city} />)}
              </datalist>
            </Field>
            <Field label="Country">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.country} onChange={(event) => setFilters((prev) => ({ ...prev, country: event.target.value }))}>
                <option value="">All</option>
                {countryOptions.map((country) => <option key={country} value={country}>{country}</option>)}
              </select>
            </Field>
            <Field label="Language">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.language} onChange={(event) => setFilters((prev) => ({ ...prev, language: event.target.value }))}>
                <option value="">All</option>
                {LANGUAGE_OPTIONS.map((language) => <option key={language} value={language}>{language}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.format} onChange={(event) => setFilters((prev) => ({ ...prev, format: event.target.value }))}>
                <option value="">All</option>
                {FORMAT_OPTIONS.map((format) => <option key={format} value={format}>{format}</option>)}
              </select>
            </Field>
            <Field label="Safety">
              <select className="w-full rounded-2xl border border-[#eadfd5] px-4 py-3 text-sm font-bold text-[#2f2135]" value={filters.safety} onChange={(event) => setFilters((prev) => ({ ...prev, safety: event.target.value }))}>
                <option value="">All</option>
                {SAFETY_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl">Add event</h2>
              <p className="mt-2 text-sm text-[#7d6b65]">New entries start as drafts or review-ready events until details are checked.</p>
            </div>
            <Pill tone="amber">Human verified before publish</Pill>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <Field label="Event key">
              <TextInput value={draft.eventKey} onChange={(value) => setDraft((prev) => ({ ...prev, eventKey: value }))} placeholder="madrid-garden-walk" />
            </Field>
            <Field label="Title EN">
              <TextInput value={draft.titleEn} onChange={(value) => setDraft((prev) => ({ ...prev, titleEn: value }))} />
            </Field>
            <Field label="Title ES">
              <TextInput value={draft.titleEs} onChange={(value) => setDraft((prev) => ({ ...prev, titleEs: value }))} />
            </Field>
            <Field label="Title DE">
              <TextInput value={draft.titleDe} onChange={(value) => setDraft((prev) => ({ ...prev, titleDe: value }))} />
            </Field>
            <Field label="City">
              <TextInput value={draft.city ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, city: value }))} placeholder="Madrid" />
            </Field>
            <Field label="Country code">
              <TextInput value={draft.countryCode ?? ""} onChange={(value) => setDraft((prev) => ({ ...prev, countryCode: value }))} placeholder="ES" />
            </Field>
            <Field label="Format">
              <SelectInput value={draft.format} onChange={(value) => setDraft((prev) => ({ ...prev, format: value }))} options={FORMAT_OPTIONS} />
            </Field>
            <Field label="Status">
              <SelectInput value={draft.status} onChange={(value) => setDraft((prev) => ({ ...prev, status: value }))} options={STATUS_OPTIONS} />
            </Field>
            <Field label="Summary EN">
              <TextArea value={draft.summaryEn} onChange={(value) => setDraft((prev) => ({ ...prev, summaryEn: value }))} />
            </Field>
            <Field label="Interest tags">
              <TextArea value={listToText(draft.interestTags)} onChange={(value) => setDraft((prev) => ({ ...prev, interestTags: textToList(value) }))} placeholder="music, walking, art" />
            </Field>
            <Field label="Accessibility">
              <TextArea value={listToText(draft.accessibilityTags)} onChange={(value) => setDraft((prev) => ({ ...prev, accessibilityTags: textToList(value) }))} placeholder="seated, step-free" />
            </Field>
            <button
              className="inline-flex min-h-[52px] items-center justify-center gap-2 self-end rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
              onClick={() => addEvent().catch((err) => setMessage(err.message))}
            >
              <Plus size={17} />
              Add event
            </button>
          </div>
        </section>

        <section className="mt-5 grid gap-4" data-testid="admin-participate-events">
          {filteredEvents.map((event) => (
            <article key={event.eventKey} className="rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xl font-black">{event.eventKey}</p>
                  <p className="mt-1 text-sm text-[#7d6b65]">{event.titleEn || event.titleEs || event.titleDe}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={statusTone(event.status)}>{event.status}</Pill>
                  <Pill tone={safetyTone(event.safetyStatus)}>{event.safetyStatus}</Pill>
                  <Pill tone="plain">{event.format}</Pill>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Status">
                  <SelectInput value={event.status} onChange={(value) => updateEvent(event.eventKey, { status: value })} options={STATUS_OPTIONS} />
                </Field>
                <Field label="Safety status">
                  <SelectInput value={event.safetyStatus} onChange={(value) => updateEvent(event.eventKey, { safetyStatus: value })} options={SAFETY_OPTIONS} />
                </Field>
                <Field label="Format">
                  <SelectInput value={event.format} onChange={(value) => updateEvent(event.eventKey, { format: value })} options={FORMAT_OPTIONS} />
                </Field>
                <Field label="Source">
                  <TextInput value={event.source} onChange={(value) => updateEvent(event.eventKey, { source: value })} />
                </Field>
                <Field label="City">
                  <TextInput value={event.city ?? ""} onChange={(value) => updateEvent(event.eventKey, { city: value })} />
                </Field>
                <Field label="Country code">
                  <TextInput value={event.countryCode ?? ""} onChange={(value) => updateEvent(event.eventKey, { countryCode: value })} />
                </Field>
                <Field label="Location label">
                  <TextInput value={event.locationLabel} onChange={(value) => updateEvent(event.eventKey, { locationLabel: value })} />
                </Field>
                <Field label="Source URL" optional>
                  <TextInput value={event.sourceUrl ?? ""} onChange={(value) => updateEvent(event.eventKey, { sourceUrl: value })} />
                </Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Title EN"><TextInput value={event.titleEn} onChange={(value) => updateEvent(event.eventKey, { titleEn: value })} /></Field>
                <Field label="Title ES"><TextInput value={event.titleEs} onChange={(value) => updateEvent(event.eventKey, { titleEs: value })} /></Field>
                <Field label="Title DE"><TextInput value={event.titleDe} onChange={(value) => updateEvent(event.eventKey, { titleDe: value })} /></Field>
                <Field label="Summary EN"><TextArea value={event.summaryEn} onChange={(value) => updateEvent(event.eventKey, { summaryEn: value })} /></Field>
                <Field label="Summary ES"><TextArea value={event.summaryEs} onChange={(value) => updateEvent(event.eventKey, { summaryEs: value })} /></Field>
                <Field label="Summary DE"><TextArea value={event.summaryDe} onChange={(value) => updateEvent(event.eventKey, { summaryDe: value })} /></Field>
                <Field label="Description EN"><TextArea value={event.descriptionEn} onChange={(value) => updateEvent(event.eventKey, { descriptionEn: value })} /></Field>
                <Field label="Description ES"><TextArea value={event.descriptionEs} onChange={(value) => updateEvent(event.eventKey, { descriptionEs: value })} /></Field>
                <Field label="Description DE"><TextArea value={event.descriptionDe} onChange={(value) => updateEvent(event.eventKey, { descriptionDe: value })} /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label="Time EN"><TextInput value={event.timeLabelEn} onChange={(value) => updateEvent(event.eventKey, { timeLabelEn: value })} /></Field>
                <Field label="Time ES"><TextInput value={event.timeLabelEs} onChange={(value) => updateEvent(event.eventKey, { timeLabelEs: value })} /></Field>
                <Field label="Time DE"><TextInput value={event.timeLabelDe} onChange={(value) => updateEvent(event.eventKey, { timeLabelDe: value })} /></Field>
                <Field label="Cost EN"><TextInput value={event.costLabelEn} onChange={(value) => updateEvent(event.eventKey, { costLabelEn: value })} /></Field>
                <Field label="Cost ES"><TextInput value={event.costLabelEs} onChange={(value) => updateEvent(event.eventKey, { costLabelEs: value })} /></Field>
                <Field label="Cost DE"><TextInput value={event.costLabelDe} onChange={(value) => updateEvent(event.eventKey, { costLabelDe: value })} /></Field>
                <Field label="Starts at ISO" optional><TextInput value={event.startsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { startsAt: value })} placeholder="2026-07-12T10:00:00.000Z" /></Field>
                <Field label="Ends at ISO" optional><TextInput value={event.endsAt ?? ""} onChange={(value) => updateEvent(event.eventKey, { endsAt: value })} placeholder="2026-07-12T11:00:00.000Z" /></Field>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Languages">
                  <TextInput value={listToText(event.languageCodes)} onChange={(value) => updateEvent(event.eventKey, { languageCodes: textToList(value) })} />
                </Field>
                <Field label="Tags">
                  <TextArea value={listToText(event.tags)} onChange={(value) => updateEvent(event.eventKey, { tags: textToList(value) })} />
                </Field>
                <Field label="Interest tags">
                  <TextArea value={listToText(event.interestTags)} onChange={(value) => updateEvent(event.eventKey, { interestTags: textToList(value) })} />
                </Field>
                <Field label="Accessibility tags">
                  <TextArea value={listToText(event.accessibilityTags)} onChange={(value) => updateEvent(event.eventKey, { accessibilityTags: textToList(value) })} />
                </Field>
                <Field label="Helper actions">
                  <TextInput value={listToText(event.helperActions)} onChange={(value) => updateEvent(event.eventKey, { helperActions: normalizeHelperActions(textToList(value)) })} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                    <input type="checkbox" checked={event.isCurated} onChange={(input) => updateEvent(event.eventKey, { isCurated: input.target.checked })} />
                    Curated
                  </label>
                  <label className="flex items-center gap-2 rounded-full bg-purple-50 px-4 py-2 text-sm font-bold text-purple-700">
                    <input type="checkbox" checked={event.needsLiveCheck} onChange={(input) => updateEvent(event.eventKey, { needsLiveCheck: input.target.checked })} />
                    Concierge check
                  </label>
                  <Pill tone="green">{event.responseCounts.interested} interested</Pill>
                  <Pill tone="amber">{event.responseCounts.maybe} maybe</Pill>
                  <Pill tone="rose">{event.responseCounts.not_for_me} not for me</Pill>
                  <Pill tone="plain">{event.checkRequestCount} checks</Pill>
                </div>
                <button
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-purple-700 px-5 py-3 font-bold text-white"
                  onClick={() => saveEvent(event).catch((err) => setMessage(err.message))}
                >
                  <Save size={17} />
                  Save event
                </button>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[2rem] border border-[#eadfd5] bg-white p-5 shadow-sm">
          <h2 className="font-serif text-3xl">Recent Concierge checks</h2>
          <div className="mt-4 grid gap-2">
            {(activity.checks ?? []).slice(0, 8).length === 0 ? (
              <p className="rounded-2xl bg-[#f7f2eb] p-4 text-sm font-bold text-[#7d6b65]">No check requests yet.</p>
            ) : (activity.checks ?? []).slice(0, 8).map((item, index) => (
              <div key={`${String(item.id ?? index)}-${index}`} className="rounded-2xl bg-[#f7f2eb] p-4 text-sm">
                <p className="font-black text-[#2f2135]">{String(item.eventKey ?? item.event_id ?? "event")}</p>
                <p className="mt-1 text-[#7d6b65]">Status: {String(item.status ?? "requested")} - User: {String(item.userId ?? item.user_id ?? "unknown")}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
