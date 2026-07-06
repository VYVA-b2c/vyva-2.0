import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  UsersRound,
  Waypoints,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";

const CHANNELS = ["email", "whatsapp", "facebook", "instagram", "linkedin", "tiktok"] as const;
const AUDIENCES = ["b2c", "b2b", "both"] as const;
const TABS = ["dashboard", "journeys", "content", "calendar", "contacts", "settings"] as const;

type Channel = typeof CHANNELS[number];
type Audience = typeof AUDIENCES[number];
type Tab = typeof TABS[number];

type MarketingSummary = {
  totals: {
    campaigns: number;
    journeys: number;
    content: number;
    contacts: number;
    thisWeek: number;
    scheduled: number;
    published: number;
  };
  byChannel: Array<{ channel: Channel; campaigns: number; content: number }>;
  byAudience: Array<{ audienceType: Audience; campaigns: number; contacts: number }>;
  lockedSendCapabilities: SendCapability[];
  latestSyncRun: SyncRun | null;
};

type SendCapability = {
  channel: Channel;
  sendCapability: string;
  locked: boolean;
  note: string;
};

type CampaignChannel = {
  id: string;
  channel: Channel;
  scheduledAt: string | null;
  status: string;
  sendCapability: string;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  scheduleStartsAt: string | null;
  timezone: string;
  source: string;
  lovableExternalId: string | null;
  channels: CampaignChannel[];
  recipientCount: number;
};

type Journey = {
  id: string;
  name: string;
  status: string;
  audienceType: Audience;
  objective: string;
  source: string;
  steps: Array<{ id: string; stepOrder: number; channel: Channel; delayHours: number; status: string }>;
};

type ContentAsset = {
  id: string;
  title: string;
  channel: Channel;
  language: string;
  status: string;
  subject: string | null;
  body: string;
  source: string;
  lovableExternalId: string | null;
};

type MarketingContact = {
  id: string;
  audienceType: Audience;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  whatsappNumber: string | null;
  roleLabel: string | null;
  companyName: string | null;
  consentStatus: string;
  source: string;
  tags: string[];
  lovableExternalId: string | null;
};

type SyncRun = {
  id: string;
  provider: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  summary: Record<string, unknown>;
  error: string | null;
  createdBy: string | null;
  createdAt: string | null;
};

type SyncState = {
  provider: string;
  configured: boolean;
  canRunSync: boolean;
  requiredRunnerEmail: string | null;
  apiUrl: string | null;
  mode: string;
  realSendingLocked: boolean;
  lockedSendCapabilities: SendCapability[];
  runs: SyncRun[];
};

type CampaignDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  status: "draft" | "scheduled";
  scheduleStartsAt: string;
  objective: string;
};

type JourneyDraft = {
  name: string;
  audienceType: Audience;
  channel: Channel;
  objective: string;
};

type ContentDraft = {
  title: string;
  channel: Channel;
  subject: string;
  body: string;
};

type ContactDraft = {
  fullName: string;
  audienceType: Audience;
  email: string;
  whatsappNumber: string;
  companyName: string;
};

const emptySummary: MarketingSummary = {
  totals: {
    campaigns: 0,
    journeys: 0,
    content: 0,
    contacts: 0,
    thisWeek: 0,
    scheduled: 0,
    published: 0,
  },
  byChannel: CHANNELS.map((channel) => ({ channel, campaigns: 0, content: 0 })),
  byAudience: AUDIENCES.map((audienceType) => ({ audienceType, campaigns: 0, contacts: 0 })),
  lockedSendCapabilities: CHANNELS.map((channel) => ({
    channel,
    sendCapability: channel === "email" || channel === "whatsapp" ? "future_send_capable" : "planning_only",
    locked: true,
    note: "Marketing sends are locked in this foundation.",
  })),
  latestSyncRun: null,
};

const emptySync: SyncState = {
  provider: "lovable",
  configured: false,
  canRunSync: false,
  requiredRunnerEmail: null,
  apiUrl: null,
  mode: "one_way_into_vyva",
  realSendingLocked: true,
  lockedSendCapabilities: emptySummary.lockedSendCapabilities,
  runs: [],
};

const channelLabel: Record<Channel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
};

const tabLabel: Record<Tab, string> = {
  dashboard: "Dashboard",
  journeys: "Journeys",
  content: "Content",
  calendar: "Calendar",
  contacts: "Contacts",
  settings: "Settings",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function statusClass(status: string) {
  if (["published", "active", "succeeded", "opted_in"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["scheduled", "running", "pending", "review"].includes(status)) return "bg-sky-50 text-sky-700";
  if (["failed", "opted_out"].includes(status)) return "bg-red-50 text-red-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-800";
}

function channelClass(channel: Channel) {
  if (channel === "whatsapp") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (channel === "email") return "bg-blue-50 text-blue-700 border-blue-100";
  if (channel === "instagram" || channel === "tiktok") return "bg-pink-50 text-pink-700 border-pink-100";
  if (channel === "linkedin" || channel === "facebook") return "bg-sky-50 text-sky-700 border-sky-100";
  return "bg-purple-50 text-purple-700 border-purple-100";
}

function lower(value: string | null | undefined) {
  return value?.toLowerCase() ?? "";
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(url, options);
  const body = await response.json().catch(() => null) as T | { error?: string } | null;
  if (!response.ok) {
    throw new Error((body && typeof body === "object" && "error" in body && body.error) || "Request failed");
  }
  return body as T;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-[#4d4351]">{label}</span>
      {children}
    </label>
  );
}

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${className}`}>{children}</span>;
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: LucideIcon }) {
  return (
    <div className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
        <Icon size={19} aria-hidden="true" />
      </div>
      <p className="mt-4 text-3xl font-black text-[#241133]">{value}</p>
      <p className="mt-1 text-sm font-bold text-[#7d6b65]">{label}</p>
    </div>
  );
}

function LockedSendPanel() {
  return (
    <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-amber-900" data-testid="marketing-send-locked-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700">
            <Lock size={18} aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black">Campaign sending is locked in this foundation.</h3>
            <p className="mt-1 text-sm font-semibold text-amber-800">Use this area to plan, migrate, preview, and schedule metadata. Provider dispatch will be wired later through the existing communications dispatcher.</p>
          </div>
        </div>
        <button type="button" disabled className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-xl bg-amber-200 px-4 font-black text-amber-800 opacity-80" data-testid="button-marketing-send-locked">
          <Send size={16} aria-hidden="true" /> Send locked
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[#241133]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

const inputClass = "h-11 w-full rounded-xl border border-[#E5D8CA] bg-white px-3 text-sm font-semibold text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";
const textareaClass = "min-h-[92px] w-full rounded-xl border border-[#E5D8CA] bg-white px-3 py-3 text-sm font-semibold leading-relaxed text-[#2f2135] outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100";

export default function MarketingAdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [summary, setSummary] = useState<MarketingSummary>(emptySummary);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [content, setContent] = useState<ContentAsset[]>([]);
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [syncState, setSyncState] = useState<SyncState>(emptySync);
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState<Channel | "all">("all");
  const [audienceFilter, setAudienceFilter] = useState<Audience | "all">("all");
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>({ name: "", audienceType: "b2c", channel: "email", status: "draft", scheduleStartsAt: "", objective: "" });
  const [journeyDraft, setJourneyDraft] = useState<JourneyDraft>({ name: "", audienceType: "b2c", channel: "email", objective: "" });
  const [contentDraft, setContentDraft] = useState<ContentDraft>({ title: "", channel: "email", subject: "", body: "" });
  const [contactDraft, setContactDraft] = useState<ContactDraft>({ fullName: "", audienceType: "b2b", email: "", whatsappNumber: "", companyName: "" });

  async function refreshAll() {
    const [summaryBody, campaignBody, journeyBody, contentBody, contactBody, syncBody] = await Promise.all([
      api<MarketingSummary>("/api/admin/marketing/summary"),
      api<{ campaigns: Campaign[] }>("/api/admin/marketing/campaigns"),
      api<{ journeys: Journey[] }>("/api/admin/marketing/journeys"),
      api<{ content: ContentAsset[] }>("/api/admin/marketing/content"),
      api<{ contacts: MarketingContact[] }>("/api/admin/marketing/contacts"),
      api<SyncState>("/api/admin/marketing/sync/lovable"),
    ]);
    setSummary(summaryBody);
    setCampaigns(campaignBody.campaigns);
    setJourneys(journeyBody.journeys);
    setContent(contentBody.content);
    setContacts(contactBody.contacts);
    setSyncState(syncBody);
  }

  useEffect(() => {
    refreshAll().catch((error) => setMessage(error.message));
  }, []);

  const visibleCampaigns = useMemo(() => campaigns.filter((campaign) => {
    const matchesSearch = !search || lower(campaign.name).includes(search.toLowerCase()) || lower(campaign.objective).includes(search.toLowerCase());
    const matchesAudience = audienceFilter === "all" || campaign.audienceType === audienceFilter;
    const matchesChannel = channelFilter === "all" || campaign.channels.some((item) => item.channel === channelFilter);
    return matchesSearch && matchesAudience && matchesChannel;
  }), [campaigns, search, audienceFilter, channelFilter]);

  const visibleContent = useMemo(() => content.filter((item) => {
    const matchesSearch = !search || lower(item.title).includes(search.toLowerCase()) || lower(item.subject).includes(search.toLowerCase()) || lower(item.body).includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || item.channel === channelFilter;
    return matchesSearch && matchesChannel;
  }), [content, search, channelFilter]);

  const visibleContacts = useMemo(() => contacts.filter((contact) => {
    const matchesSearch = !search || lower(contact.fullName).includes(search.toLowerCase()) || lower(contact.email).includes(search.toLowerCase()) || lower(contact.companyName).includes(search.toLowerCase());
    const matchesAudience = audienceFilter === "all" || contact.audienceType === audienceFilter;
    return matchesSearch && matchesAudience;
  }), [contacts, search, audienceFilter]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault();
    if (!campaignDraft.name.trim()) return;
    await api("/api/admin/marketing/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: campaignDraft.name,
        audienceType: campaignDraft.audienceType,
        status: campaignDraft.status,
        objective: campaignDraft.objective,
        scheduleStartsAt: campaignDraft.scheduleStartsAt ? new Date(campaignDraft.scheduleStartsAt).toISOString() : null,
        channels: [{ channel: campaignDraft.channel, status: campaignDraft.status, scheduledAt: campaignDraft.scheduleStartsAt ? new Date(campaignDraft.scheduleStartsAt).toISOString() : null }],
      }),
    });
    setCampaignDraft({ name: "", audienceType: "b2c", channel: "email", status: "draft", scheduleStartsAt: "", objective: "" });
    setMessage("Campaign draft created. Sending remains locked.");
    await refreshAll();
  }

  async function createJourney(event: FormEvent) {
    event.preventDefault();
    if (!journeyDraft.name.trim()) return;
    await api("/api/admin/marketing/journeys", {
      method: "POST",
      body: JSON.stringify({
        name: journeyDraft.name,
        audienceType: journeyDraft.audienceType,
        objective: journeyDraft.objective,
        steps: [{ stepOrder: 0, channel: journeyDraft.channel, delayHours: 0, status: "draft" }],
      }),
    });
    setJourneyDraft({ name: "", audienceType: "b2c", channel: "email", objective: "" });
    setMessage("Journey draft created.");
    await refreshAll();
  }

  async function createContent(event: FormEvent) {
    event.preventDefault();
    if (!contentDraft.title.trim()) return;
    await api("/api/admin/marketing/content", {
      method: "POST",
      body: JSON.stringify({
        title: contentDraft.title,
        channel: contentDraft.channel,
        subject: contentDraft.subject || null,
        body: contentDraft.body,
      }),
    });
    setContentDraft({ title: "", channel: "email", subject: "", body: "" });
    setMessage("Content draft created.");
    await refreshAll();
  }

  async function createContact(event: FormEvent) {
    event.preventDefault();
    if (!contactDraft.fullName.trim() && !contactDraft.email.trim()) return;
    await api("/api/admin/marketing/contacts", {
      method: "POST",
      body: JSON.stringify({
        fullName: contactDraft.fullName,
        audienceType: contactDraft.audienceType,
        email: contactDraft.email || null,
        whatsappNumber: contactDraft.whatsappNumber || null,
        companyName: contactDraft.companyName || null,
        channelAvailability: {
          email: Boolean(contactDraft.email),
          whatsapp: Boolean(contactDraft.whatsappNumber),
        },
      }),
    });
    setContactDraft({ fullName: "", audienceType: "b2b", email: "", whatsappNumber: "", companyName: "" });
    setMessage("Marketing contact created.");
    await refreshAll();
  }

  async function runLovableSync() {
    setSyncFeedback("");
    setMessage("Running Lovable sync...");
    setSyncRunning(true);
    try {
      await api("/api/admin/marketing/sync/lovable/run", { method: "POST" });
      await refreshAll();
      setMessage("Lovable sync completed.");
      setSyncFeedback("Lovable sync completed.");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Lovable sync failed.";
      setMessage(errorMessage);
      setSyncFeedback(errorMessage);
    } finally {
      setSyncRunning(false);
    }
  }

  const syncBlockedReason = !syncState.configured
    ? "Set LOVABLE_MARKETING_API_URL and LOVABLE_MARKETING_API_KEY before running a sync."
    : syncState.canRunSync === false
      ? `Only the super admin${syncState.requiredRunnerEmail ? ` (${syncState.requiredRunnerEmail})` : ""} can run Lovable sync.`
      : "";
  const syncButtonDisabled = Boolean(syncBlockedReason) || syncRunning;
  const syncFeedbackText = syncFeedback || syncBlockedReason;
  const syncFeedbackIsError = Boolean(syncBlockedReason) || /fail|error|unauthorized|forbidden|not configured|only the super admin/i.test(syncFeedback);

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-6 py-8 text-[#2f2135]">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Marketing"
          subtitle="Campaign planning, Lovable migration, audiences, content, and schedules. Real provider sending is locked in this foundation."
        >
          <button className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-3 font-bold text-white" onClick={() => refreshAll().catch((error) => setMessage(error.message))}>
            <RefreshCw size={16} /> Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-4 py-3 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <section className="mt-5 grid gap-4">
          <div className="overflow-hidden rounded-[18px] border border-purple-200 bg-[#2f2135] text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-purple-200">Marketing engine foundation</p>
                <h2 className="mt-2 text-3xl font-black">Plan campaigns now. Send later, safely.</h2>
                <p className="mt-2 max-w-3xl text-sm font-semibold text-white/70">This module prepares VYVA to absorb Lovable marketing data while keeping campaign dispatch locked until compliance, consent, and provider controls are explicitly enabled.</p>
              </div>
              <Pill className="bg-white/10 text-white"><Lock size={13} className="mr-1" /> Sending locked</Pill>
            </div>
          </div>

          <LockedSendPanel />

          <div className="rounded-[14px] border border-[#eadfd5] bg-white p-2 shadow-sm">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Marketing admin sections">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-black transition ${
                    activeTab === tab ? "bg-purple-700 text-white shadow-sm" : "text-[#5b4a46] hover:bg-[#fbf8f5] hover:text-purple-700"
                  }`}
                  data-testid={`tab-marketing-${tab}`}
                >
                  {tabLabel[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 rounded-[14px] border border-[#eadfd5] bg-white p-4 shadow-sm xl:grid-cols-[1fr_180px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b7a73]" aria-hidden="true" />
              <input className={`${inputClass} pl-9`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaigns, content, or contacts" data-testid="input-marketing-search" />
            </label>
            <select className={inputClass} value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as Channel | "all")} aria-label="Channel filter">
              <option value="all">All channels</option>
              {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
            </select>
            <select className={inputClass} value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value as Audience | "all")} aria-label="Audience filter">
              <option value="all">All audiences</option>
              {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
            </select>
          </div>

          {activeTab === "dashboard" && (
            <div className="grid gap-4" data-testid="marketing-dashboard-tab">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total campaigns" value={summary.totals.campaigns} icon={Megaphone} />
                <MetricCard label="This week" value={summary.totals.thisWeek} icon={CalendarDays} />
                <MetricCard label="Scheduled" value={summary.totals.scheduled} icon={Clock} />
                <MetricCard label="Published" value={summary.totals.published} icon={CheckCircle2} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_0.75fr]">
                <SectionCard title="By channel" subtitle="Planning coverage across campaign channels.">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {summary.byChannel.map((item) => (
                      <div key={item.channel} className={`rounded-xl border p-3 ${channelClass(item.channel)}`}>
                        <p className="font-black">{channelLabel[item.channel]}</p>
                        <p className="mt-2 text-2xl font-black">{item.campaigns}</p>
                        <p className="text-xs font-bold opacity-80">campaign routes / {item.content} content assets</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                <SectionCard title="By audience" subtitle="B2C, B2B, and combined campaigns.">
                  <div className="grid gap-3">
                    {summary.byAudience.map((item) => (
                      <div key={item.audienceType} className="flex items-center justify-between rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div>
                          <p className="font-black">{item.audienceType.toUpperCase()}</p>
                          <p className="text-xs font-bold text-[#8b7a73]">{item.contacts} contacts</p>
                        </div>
                        <span className="text-2xl font-black">{item.campaigns}</span>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </div>

              <SectionCard title="Campaign planner" subtitle="Create draft or scheduled campaign metadata. No provider dispatch is triggered.">
                <form className="grid gap-3 xl:grid-cols-[1fr_160px_160px_200px_auto]" onSubmit={(event) => createCampaign(event).catch((error) => setMessage(error.message))}>
                  <Field label="Campaign name">
                    <input className={inputClass} value={campaignDraft.name} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Summer caregiver onboarding" data-testid="input-marketing-campaign-name" />
                  </Field>
                  <Field label="Audience">
                    <select className={inputClass} value={campaignDraft.audienceType} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))}>
                      {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="Channel">
                    <select className={inputClass} value={campaignDraft.channel} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))}>
                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                    </select>
                  </Field>
                  <Field label="Schedule">
                    <input className={inputClass} type="datetime-local" value={campaignDraft.scheduleStartsAt} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, scheduleStartsAt: event.target.value, status: event.target.value ? "scheduled" : "draft" }))} />
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white" type="submit" data-testid="button-marketing-create-campaign">
                    <Plus size={16} /> Add campaign
                  </button>
                </form>
                <textarea className={`${textareaClass} mt-3`} value={campaignDraft.objective} onChange={(event) => setCampaignDraft((draft) => ({ ...draft, objective: event.target.value }))} placeholder="Objective or internal notes" />
              </SectionCard>

              <SectionCard title="Campaign list" subtitle={`${visibleCampaigns.length} visible of ${campaigns.length} campaigns.`}>
                <CampaignTable campaigns={visibleCampaigns} />
              </SectionCard>
            </div>
          )}

          {activeTab === "journeys" && (
            <div className="grid gap-4" data-testid="marketing-journeys-tab">
              <SectionCard title="Journey draft" subtitle="Create a starter journey with one locked planning step.">
                <form className="grid gap-3 xl:grid-cols-[1fr_180px_180px_auto]" onSubmit={(event) => createJourney(event).catch((error) => setMessage(error.message))}>
                  <Field label="Journey name">
                    <input className={inputClass} value={journeyDraft.name} onChange={(event) => setJourneyDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="Lead nurture sequence" data-testid="input-marketing-journey-name" />
                  </Field>
                  <Field label="Audience">
                    <select className={inputClass} value={journeyDraft.audienceType} onChange={(event) => setJourneyDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))}>
                      {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="First channel">
                    <select className={inputClass} value={journeyDraft.channel} onChange={(event) => setJourneyDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))}>
                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                    </select>
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white" type="submit">
                    <Waypoints size={16} /> Add journey
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="Journeys" subtitle={`${journeys.length} journeys in the planning foundation.`}>
                <div className="grid gap-3">
                  {journeys.length === 0 ? <EmptyState text="No journeys yet." /> : journeys.map((journey) => (
                    <article key={journey.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{journey.name}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{journey.objective || "No objective yet."}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill className={statusClass(journey.status)}>{journey.status}</Pill>
                          <Pill className="bg-purple-50 text-purple-700">{journey.audienceType.toUpperCase()}</Pill>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {journey.steps.length === 0 ? <span className="text-sm font-bold text-[#8b7a73]">No steps yet.</span> : journey.steps.map((step) => (
                          <span key={step.id} className={`rounded-full border px-3 py-1 text-xs font-black ${channelClass(step.channel)}`}>{step.stepOrder + 1}. {channelLabel[step.channel]} / {step.delayHours}h</span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "content" && (
            <div className="grid gap-4" data-testid="marketing-content-tab">
              <SectionCard title="Content draft" subtitle="Reusable campaign copy by channel and language.">
                <form className="grid gap-3 xl:grid-cols-[1fr_180px_1fr_auto]" onSubmit={(event) => createContent(event).catch((error) => setMessage(error.message))}>
                  <Field label="Title">
                    <input className={inputClass} value={contentDraft.title} onChange={(event) => setContentDraft((draft) => ({ ...draft, title: event.target.value }))} placeholder="Caregiver invite follow-up" data-testid="input-marketing-content-title" />
                  </Field>
                  <Field label="Channel">
                    <select className={inputClass} value={contentDraft.channel} onChange={(event) => setContentDraft((draft) => ({ ...draft, channel: event.target.value as Channel }))}>
                      {CHANNELS.map((channel) => <option key={channel} value={channel}>{channelLabel[channel]}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject">
                    <input className={inputClass} value={contentDraft.subject} onChange={(event) => setContentDraft((draft) => ({ ...draft, subject: event.target.value }))} placeholder="Optional subject" />
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white" type="submit">
                    <FileText size={16} /> Add content
                  </button>
                </form>
                <textarea className={`${textareaClass} mt-3`} value={contentDraft.body} onChange={(event) => setContentDraft((draft) => ({ ...draft, body: event.target.value }))} placeholder="Campaign copy" />
              </SectionCard>
              <SectionCard title="Content library" subtitle={`${visibleContent.length} visible of ${content.length} assets.`}>
                <div className="grid gap-3">
                  {visibleContent.length === 0 ? <EmptyState text="No content matches the filters." /> : visibleContent.map((item) => (
                    <article key={item.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-black">{item.title}</h3>
                          <p className="mt-1 text-sm font-semibold text-[#7d6b65]">{item.subject || item.body || "No copy yet."}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                          <Pill className={statusClass(item.status)}>{item.status}</Pill>
                          {item.source === "lovable" ? <Pill className="bg-violet-50 text-violet-700">Lovable</Pill> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="grid gap-4" data-testid="marketing-calendar-tab">
              <SectionCard title="Calendar" subtitle="Scheduled campaign metadata only. Dispatch remains locked.">
                <CampaignTable campaigns={visibleCampaigns.filter((campaign) => campaign.scheduleStartsAt || campaign.status === "scheduled")} />
              </SectionCard>
            </div>
          )}

          {activeTab === "contacts" && (
            <div className="grid gap-4" data-testid="marketing-contacts-tab">
              <SectionCard title="Contact draft" subtitle="Create B2B contacts or planning records before sync/cutover.">
                <form className="grid gap-3 xl:grid-cols-[1fr_160px_1fr_1fr_auto]" onSubmit={(event) => createContact(event).catch((error) => setMessage(error.message))}>
                  <Field label="Name">
                    <input className={inputClass} value={contactDraft.fullName} onChange={(event) => setContactDraft((draft) => ({ ...draft, fullName: event.target.value }))} placeholder="Contact name" data-testid="input-marketing-contact-name" />
                  </Field>
                  <Field label="Audience">
                    <select className={inputClass} value={contactDraft.audienceType} onChange={(event) => setContactDraft((draft) => ({ ...draft, audienceType: event.target.value as Audience }))}>
                      {AUDIENCES.map((audience) => <option key={audience} value={audience}>{audience.toUpperCase()}</option>)}
                    </select>
                  </Field>
                  <Field label="Email">
                    <input className={inputClass} value={contactDraft.email} onChange={(event) => setContactDraft((draft) => ({ ...draft, email: event.target.value }))} placeholder="name@example.com" />
                  </Field>
                  <Field label="Company">
                    <input className={inputClass} value={contactDraft.companyName} onChange={(event) => setContactDraft((draft) => ({ ...draft, companyName: event.target.value }))} placeholder="Organization" />
                  </Field>
                  <button className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white" type="submit">
                    <UsersRound size={16} /> Add contact
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="Contacts" subtitle={`${visibleContacts.length} visible of ${contacts.length} contacts.`}>
                <div className="overflow-hidden rounded-xl border border-[#eadfd5]">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
                      <tr>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Audience</th>
                        <th className="px-4 py-3">Channels</th>
                        <th className="px-4 py-3">Consent</th>
                        <th className="px-4 py-3">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleContacts.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center font-bold text-[#8b7a73]">No contacts match the filters.</td></tr>
                      ) : visibleContacts.map((contact) => (
                        <tr key={contact.id} className="border-t border-[#f0e7df]">
                          <td className="px-4 py-3">
                            <p className="font-black">{contact.fullName || contact.email || "Unnamed contact"}</p>
                            <p className="text-xs font-semibold text-[#7d6b65]">{contact.companyName || contact.roleLabel || "No organization"}</p>
                          </td>
                          <td className="px-4 py-3 font-black">{contact.audienceType.toUpperCase()}</td>
                          <td className="px-4 py-3 text-xs font-bold text-[#7d6b65]">{[contact.email ? "email" : "", contact.whatsappNumber ? "whatsapp" : ""].filter(Boolean).join(", ") || "No direct channel"}</td>
                          <td className="px-4 py-3"><Pill className={statusClass(contact.consentStatus)}>{contact.consentStatus}</Pill></td>
                          <td className="px-4 py-3 font-bold">{contact.source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="grid gap-4 xl:grid-cols-[1fr_0.9fr]" data-testid="marketing-settings-tab">
              <SectionCard
                title="Lovable sync"
                subtitle="One-way import into VYVA. Nothing is written back to Lovable."
                action={<Pill className={syncState.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}>{syncState.configured ? "Configured" : "Not configured"}</Pill>}
              >
                <div className="grid gap-3">
                  <div className="rounded-xl bg-[#fffaf4] p-4">
                    <p className="text-sm font-bold text-[#7d6b65]">Mode</p>
                    <p className="font-black">{syncState.mode}</p>
                    <p className="mt-2 text-sm font-semibold text-[#7d6b65]">Endpoint: {syncState.apiUrl ?? "Set LOVABLE_MARKETING_API_URL"}</p>
                  </div>
                  <button
                    type="button"
                    disabled={syncButtonDisabled}
                    onClick={() => void runLovableSync()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:bg-[#b8abb8]"
                    data-testid="button-marketing-run-sync"
                  >
                    <RefreshCw size={16} className={syncRunning ? "animate-spin" : ""} /> {syncRunning ? "Running sync..." : "Run one-way sync"}
                  </button>
                  {syncFeedbackText ? (
                    <p
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${syncFeedbackIsError ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}
                      data-testid="marketing-sync-feedback"
                    >
                      {syncFeedbackText}
                    </p>
                  ) : null}
                  <div className="grid gap-2">
                    {syncState.runs.length === 0 ? <EmptyState text="No Lovable sync runs yet." /> : syncState.runs.map((run) => (
                      <div key={run.id} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Pill className={statusClass(run.status)}>{run.status}</Pill>
                          <span className="text-xs font-bold text-[#7d6b65]">{formatDate(run.createdAt)}</span>
                        </div>
                        {run.error ? <p className="mt-2 text-sm font-bold text-red-700">{run.error}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Channel send readiness" subtitle="All channels are intentionally locked in v1.">
                <div className="grid gap-3">
                  {syncState.lockedSendCapabilities.map((item) => (
                    <div key={item.channel} className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <Pill className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                        <Pill className="bg-amber-50 text-amber-800">Locked</Pill>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#7d6b65]">{item.note}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[#eadfd5] bg-[#fffaf4] p-4 text-center text-sm font-bold text-[#8b7a73]">{text}</p>;
}

function CampaignTable({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#eadfd5]" data-testid="marketing-campaign-table">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-[#fbf8f5] text-xs font-black uppercase tracking-[0.12em] text-[#7d6b65]">
          <tr>
            <th className="px-4 py-3">Campaign</th>
            <th className="px-4 py-3">Audience</th>
            <th className="px-4 py-3">Channels</th>
            <th className="px-4 py-3">Schedule</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Recipients</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-6 text-center font-bold text-[#8b7a73]">No campaigns match the filters.</td></tr>
          ) : campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-t border-[#f0e7df]">
              <td className="px-4 py-3">
                <p className="font-black">{campaign.name}</p>
                <p className="text-xs font-semibold text-[#7d6b65]">{campaign.objective || campaign.source}</p>
              </td>
              <td className="px-4 py-3 font-black">{campaign.audienceType.toUpperCase()}</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {campaign.channels.length === 0 ? <span className="text-xs font-bold text-[#8b7a73]">No channels</span> : campaign.channels.map((item) => (
                    <Pill key={item.id} className={channelClass(item.channel)}>{channelLabel[item.channel]}</Pill>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3 font-bold text-[#7d6b65]">{formatDate(campaign.scheduleStartsAt)}</td>
              <td className="px-4 py-3"><Pill className={statusClass(campaign.status)}>{campaign.status}</Pill></td>
              <td className="px-4 py-3 font-black">{campaign.recipientCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
