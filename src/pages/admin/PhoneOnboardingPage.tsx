import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock,
  FileText,
  MessageCircle,
  PhoneCall,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import AdminMenu from "./AdminMenu";
import AdminPageHeader from "./AdminPageHeader";
import { apiFetch } from "@/lib/queryClient";
import {
  callbackMetadata,
  callbackScheduledLabel,
  cleanLabel,
  type Intake,
} from "./lifecycle/shared";

type PhoneIntake = Intake & {
  metadata?: Record<string, unknown> | null;
  source_payload?: Record<string, unknown> | null;
};

type PhoneOnboardingTab = "phone" | "callbacks";

function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${cleanLabel(key)}: ${valueText(item)}`)
    .filter(Boolean)
    .join("; ");
  return String(value);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function profileName(user: PhoneIntake) {
  return user.profile_name || user.name || user.login_email || user.phone;
}

function keyData(user: PhoneIntake) {
  const metadata = user.metadata ?? {};
  const source = user.source_payload ?? {};
  const elder = typeof metadata.elder === "object" && metadata.elder ? metadata.elder as Record<string, unknown> : {};
  const keys = [
    "preferred_name",
    "language",
    "timezone",
    "date_of_birth",
    "gender",
    "country_code",
    "whatsapp_number",
    "calling_code",
  ];
  const rows = keys
    .map((key) => [key, metadata[key] ?? source[key]] as const)
    .filter(([, value]) => valueText(value));

  if (Object.keys(elder).length) rows.push(["elder", elder]);
  if (user.organization_name) rows.push(["organization", user.organization_name]);
  if (user.profile_email || user.email) rows.push(["email", user.profile_email || user.email]);
  return rows.slice(0, 9);
}

function statusTone(status: string) {
  if (status === "active") return "bg-green-100 text-green-700";
  if (status === "dropped") return "bg-red-100 text-red-700";
  if (status === "link_sent") return "bg-blue-100 text-blue-700";
  if (status === "consent_pending") return "bg-amber-100 text-amber-800";
  return "bg-purple-50 text-purple-800";
}

function PhoneUserCard({ user }: { user: PhoneIntake }) {
  const dataRows = keyData(user);
  const callback = callbackMetadata(user);
  const callbackScheduled = callbackScheduledLabel(user);
  const callbackStatus = typeof callback?.status === "string" ? callback.status : user.journey_step;

  return (
    <article className="rounded-[24px] border border-[#eadfd5] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-serif text-2xl leading-tight">{profileName(user)}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${statusTone(user.status)}`}>
              {cleanLabel(user.status)}
            </span>
            <span className="rounded-full bg-[#fff4df] px-3 py-1 text-xs font-black text-[#8a5a00]">
              {cleanLabel(user.user_type)}
            </span>
            {callback && (
              <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-purple-800">
                Callback onboarding
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#7d6b65]">
            <span className="inline-flex items-center gap-1.5"><PhoneCall size={14} /> {user.profile_phone || user.login_phone || user.phone}</span>
            {(user.profile_email || user.login_email || user.email) && (
              <span>{user.profile_email || user.login_email || user.email}</span>
            )}
            <span>Tier: {cleanLabel(user.tier)}</span>
            <span>Consent: {cleanLabel(user.consent_status)}</span>
          </div>
        </div>
        <div className="text-right text-sm text-[#7d6b65]">
          <p className="font-black text-[#2f2135]">{formatDateTime(user.created_at)}</p>
          <p>{callback ? cleanLabel(callbackStatus) : cleanLabel(user.journey_step)}</p>
          {callbackScheduled && <p className="font-bold text-purple-700">Scheduled {callbackScheduled}</p>}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniMetric icon={Clock} label="Last activity" value={formatDateTime(user.last_activity_at || user.activated_at || user.link_sent_at || user.created_at)} />
        <MiniMetric icon={MessageCircle} label="Link sent" value={user.link_sent_at ? formatDateTime(user.link_sent_at) : "Not sent"} />
        <MiniMetric icon={BadgeCheck} label="Account" value={cleanLabel(user.account_status || "pending")} />
        <MiniMetric icon={UserRound} label="Profile ID" value={user.elder_user_id || user.user_id || user.id} />
      </div>

      <div className="mt-4 rounded-2xl bg-[#fffaf5] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">
          <FileText size={14} className="text-purple-700" />
          Captured phone data
        </div>
        {dataRows.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {dataRows.map(([key, value]) => (
              <div key={key} className="rounded-xl bg-white px-3 py-2">
                <p className="text-xs font-black uppercase tracking-[0.04em] text-[#8b7a73]">{cleanLabel(key)}</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#2f2135]">{valueText(value)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm font-semibold text-[#8b7a73]">No additional phone intake attributes captured yet.</p>
        )}
      </div>
    </article>
  );
}

function MiniMetric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eadfd5] bg-[#fbf8f5] px-3 py-3">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.06em] text-[#8b7a73]">
        <Icon size={14} className="text-purple-700" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-black text-[#2f2135]" title={value}>{value}</p>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{label}</p>
      <p className="mt-1 text-3xl font-black leading-none">{value}</p>
    </div>
  );
}

function CallbackRequestTable({
  callbacks,
  busyAction,
  onCallNow,
}: {
  callbacks: PhoneIntake[];
  busyAction: string | null;
  onCallNow: (intake: PhoneIntake) => void;
}) {
  return (
    <section className="mt-4 overflow-auto rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-sm">
      <table className="w-full min-w-[880px] border-separate border-spacing-y-2">
        <thead>
          <tr className="text-left text-sm uppercase tracking-wide text-[#8b7a73]">
            <th>Name</th>
            <th>Phone</th>
            <th>Scheduled</th>
            <th>For</th>
            <th>Language</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {callbacks.length === 0 && (
            <tr>
              <td colSpan={7} className="rounded-2xl bg-[#fbf8f5] px-4 py-8 text-center font-bold text-[#7d6b65]">
                No callback requests match the current filters.
              </td>
            </tr>
          )}
          {callbacks.map((intake) => {
            const callback = callbackMetadata(intake);
            const callbackStatus = cleanLabel(typeof callback?.status === "string" ? callback.status : intake.journey_step);
            const callbackFor = cleanLabel(typeof callback?.callback_for === "string" ? callback.callback_for : intake.user_type);
            const callbackLanguage = typeof callback?.language === "string" ? callback.language : "-";
            const callBusy = busyAction === `callback:${intake.id}`;
            const callStarted = intake.journey_step === "callback_calling" || callbackStatus === "Calling";
            const completed = intake.journey_step === "callback_complete_confirmation_queued" || callbackStatus === "Completed";

            return (
              <tr key={intake.id} className="rounded-2xl bg-[#fbf8f5]">
                <td className="rounded-l-2xl px-3 py-3">
                  <p className="font-bold">{profileName(intake)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#7d6b65]">{intake.email || intake.profile_email || intake.login_email || "No email yet"}</p>
                </td>
                <td className="px-3 py-3 font-semibold">{intake.profile_phone || intake.login_phone || intake.phone}</td>
                <td className="px-3 py-3">{callbackScheduledLabel(intake) ?? "Not scheduled"}</td>
                <td className="px-3 py-3">{callbackFor}</td>
                <td className="px-3 py-3 uppercase">{callbackLanguage}</td>
                <td className="px-3 py-3">
                  <span className="font-bold">{callbackStatus}</span>
                  <span className="mt-1 block text-xs font-semibold text-[#7d6b65]">{cleanLabel(intake.status)}</span>
                </td>
                <td className="rounded-r-2xl px-3 py-3">
                  <button
                    type="button"
                    className="rounded-full border border-purple-100 bg-white px-3 py-2 text-sm font-bold text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={callBusy || callStarted || completed}
                    onClick={() => onCallNow(intake)}
                  >
                    {callBusy ? "Calling..." : callStarted ? "Call started" : completed ? "Completed" : "Call now"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default function PhoneOnboardingPage() {
  const [activeTab, setActiveTab] = useState<PhoneOnboardingTab>("phone");
  const [users, setUsers] = useState<PhoneIntake[]>([]);
  const [callbacks, setCallbacks] = useState<PhoneIntake[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function lifecycleApi(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Phone onboarding request failed");
    return data as Record<string, unknown>;
  }

  async function loadPhoneUsers(tab: PhoneOnboardingTab = activeTab, options: { announce?: boolean; clearMessage?: boolean } = {}) {
    const { announce = false, clearMessage = true } = options;
    setIsLoading(true);
    if (clearMessage) setMessage("");
    try {
      const params = new URLSearchParams(tab === "callbacks"
        ? { callback_onboarding: "true" }
        : { entry_point: "phone", callback_onboarding: "false" });
      if (query.trim()) params.set("query", query.trim());
      if (status) params.set("status", status);
      const data = await lifecycleApi(`/users?${params.toString()}`);
      const nextUsers = (data.users ?? []) as PhoneIntake[];
      if (tab === "callbacks") setCallbacks(nextUsers);
      else setUsers(nextUsers);
      if (announce) {
        setMessage(`${tab === "callbacks" ? "Callbacks" : "Inbound calls"} refreshed: ${nextUsers.length} ${nextUsers.length === 1 ? "record" : "records"}.`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load phone onboarding users");
    } finally {
      setIsLoading(false);
    }
  }

  async function runDueCallbacks() {
    setBusyAction("callbacks:dispatch");
    setMessage("");
    try {
      await lifecycleApi("/communications/dispatch", {
        method: "POST",
        body: JSON.stringify({ limit: 50 }),
      });
      await loadPhoneUsers("callbacks", { clearMessage: false });
      setMessage("Due callbacks checked.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not check due callbacks.");
    } finally {
      setBusyAction(null);
    }
  }

  async function triggerCallbackNow(intake: PhoneIntake) {
    setBusyAction(`callback:${intake.id}`);
    setMessage("");
    try {
      const data = await lifecycleApi(`/callbacks/${intake.id}/trigger`, { method: "POST" });
      await loadPhoneUsers("callbacks", { clearMessage: false });
      setMessage(typeof data.message === "string" ? data.message : "Callback call started.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start this callback.");
    } finally {
      setBusyAction(null);
    }
  }

  useEffect(() => {
    loadPhoneUsers().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, activeTab]);

  const phoneSummary = useMemo(() => ([
    ["Phone intakes", users.length],
    ["Active", users.filter((user) => user.status === "active").length],
    ["Links sent", users.filter((user) => Boolean(user.link_sent_at) || user.status === "link_sent" || user.status === "active").length],
    ["Consent flows", users.filter((user) => user.consent_status && user.consent_status !== "not_required").length],
  ]), [users]);

  const callbackSummary = useMemo(() => ([
    ["Callbacks", callbacks.length],
    ["Scheduled", callbacks.filter((user) => user.status === "created" || user.journey_step === "callback_scheduled").length],
    ["Calling", callbacks.filter((user) => user.journey_step === "callback_calling").length],
    ["Completed", callbacks.filter((user) => user.journey_step === "callback_complete_confirmation_queued" || user.status === "link_sent" || user.status === "active").length],
  ]), [callbacks]);

  const activeUsers = activeTab === "callbacks" ? callbacks : users;

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-4 text-[#2f2135] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Phone onboarding"
          subtitle="Inbound caller intake and follow-up."
        >
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={() => loadPhoneUsers(activeTab, { announce: true }).catch(() => undefined)}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {(activeTab === "callbacks" ? callbackSummary : phoneSummary).map(([label, value]) => (
            <SummaryCard key={label} label={label} value={value} />
          ))}
        </div>

        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            { id: "phone" as const, label: "Inbound calls" },
            { id: "callbacks" as const, label: "Callbacks" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-black shadow-sm ${activeTab === tab.id ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700 hover:bg-purple-50"}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="mt-4 rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_auto_auto]">
            <label className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b7a73]" size={16} />
              <input
                className="w-full rounded-2xl border border-[#e4d8ce] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                placeholder={activeTab === "callbacks" ? "Search callback name, phone or email" : "Search name, phone or email"}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && loadPhoneUsers().catch(() => undefined)}
              />
            </label>
            <select
              className="rounded-2xl border border-[#e4d8ce] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">all statuses</option>
              <option value="created">created</option>
              <option value="link_sent">link sent</option>
              <option value="consent_pending">consent pending</option>
              <option value="active">active</option>
              <option value="dropped">dropped</option>
            </select>
            <button
              type="button"
              className="rounded-2xl bg-[#2f2135] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              disabled={isLoading}
              onClick={() => loadPhoneUsers().catch(() => undefined)}
            >
              Search
            </button>
            {activeTab === "callbacks" && (
              <button
                type="button"
                className="rounded-2xl border border-purple-100 bg-white px-5 py-3 text-sm font-black text-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busyAction === "callbacks:dispatch"}
                onClick={() => runDueCallbacks()}
              >
                {busyAction === "callbacks:dispatch" ? "Checking..." : "Check due"}
              </button>
            )}
          </div>
        </section>

        {activeTab === "callbacks" ? (
          <CallbackRequestTable callbacks={callbacks} busyAction={busyAction} onCallNow={triggerCallbackNow} />
        ) : (
          <section className="mt-4 grid gap-4">
          {isLoading ? (
            <div className="rounded-[24px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#8b7a73]">Loading phone onboarding users...</div>
          ) : activeUsers.length === 0 ? (
            <div className="rounded-[24px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#8b7a73]">No phone onboarding users match the current filters.</div>
          ) : (
            activeUsers.map((user) => <PhoneUserCard key={user.id} user={user} />)
          )}
          </section>
        )}
      </section>
    </main>
  );
}
