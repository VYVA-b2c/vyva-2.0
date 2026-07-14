import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
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
  cleanLabel,
  type Intake,
} from "./lifecycle/shared";

type PhoneIntake = Intake & {
  metadata?: Record<string, unknown> | null;
  source_payload?: Record<string, unknown> | null;
};

type PhoneBucket = "new_call" | "missing_info" | "link_sent" | "completed";

const phoneBucketLabels: Record<PhoneBucket, string> = {
  new_call: "New call",
  missing_info: "Missing info",
  link_sent: "Link sent",
  completed: "Completed",
};

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

function phoneBucket(user: PhoneIntake): PhoneBucket {
  const hasName = Boolean((user.profile_name || user.name || "").trim());
  const hasPhone = Boolean((user.profile_phone || user.login_phone || user.phone || "").trim());
  const normalizedStep = user.journey_step.toLowerCase();
  if (user.status === "active" || Boolean(user.activated_at) || normalizedStep.includes("completed")) return "completed";
  if (user.status === "link_sent" || Boolean(user.link_sent_at)) return "link_sent";
  if (!hasName || !hasPhone || normalizedStep.includes("collect") || normalizedStep.includes("missing")) return "missing_info";
  return "new_call";
}

function phoneSearchText(user: PhoneIntake) {
  return [
    profileName(user),
    user.profile_phone,
    user.login_phone,
    user.phone,
    user.profile_email,
    user.login_email,
    user.email,
    user.organization_name,
    user.journey_step,
    user.status,
  ].filter(Boolean).join(" ").toLowerCase();
}

function phoneAction(user: PhoneIntake) {
  const bucket = phoneBucket(user);
  if (bucket === "missing_info") return {
    label: "Missing info",
    title: "Complete caller details",
    detail: "Review the captured phone data, then complete the profile in Lifecycle if name, phone, or consent is missing.",
    tone: "warning" as const,
  };
  if (bucket === "link_sent") return {
    label: "Invite sent",
    title: "Check signup progress",
    detail: "The caller has a link. Watch for completion, resend only if they report not receiving it.",
    tone: "info" as const,
  };
  if (bucket === "completed") return {
    label: "Completed",
    title: "No immediate action",
    detail: "This inbound caller appears to have completed onboarding or activated their account.",
    tone: "success" as const,
  };
  return {
    label: "New call",
    title: "Ready for admin review",
    detail: "Caller has enough phone intake data to review next steps, invite state, and organization assignment.",
    tone: "info" as const,
  };
}

function actionToneClass(tone: ReturnType<typeof phoneAction>["tone"]) {
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-950";
  if (tone === "success") return "border-emerald-100 bg-emerald-50 text-emerald-950";
  return "border-blue-100 bg-blue-50 text-blue-950";
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
  const bucket = phoneBucket(user);
  const action = phoneAction(user);

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
            <span className="rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-black text-purple-800">
              {phoneBucketLabels[bucket]}
            </span>
            <span className="rounded-full bg-[#eef8ff] px-3 py-1 text-xs font-black text-blue-800">
              Inbound call
            </span>
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
          <p>{cleanLabel(user.journey_step)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MiniMetric icon={Clock} label="Last activity" value={formatDateTime(user.last_activity_at || user.activated_at || user.link_sent_at || user.created_at)} />
        <MiniMetric icon={MessageCircle} label="Link sent" value={user.link_sent_at ? formatDateTime(user.link_sent_at) : "Not sent"} />
        <MiniMetric icon={BadgeCheck} label="Account" value={cleanLabel(user.account_status || "pending")} />
        <MiniMetric icon={UserRound} label="Profile ID" value={user.elder_user_id || user.user_id || user.id} />
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 ${actionToneClass(action.tone)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.08em] opacity-70">{action.label}</p>
            <p className="mt-1 font-black">{action.title}</p>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed opacity-80">{action.detail}</p>
          </div>
          {action.tone === "warning" ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
        </div>
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

function SummaryCard({ label, value, active, testId, onClick }: { label: string; value: number; active: boolean; testId: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={testId}
      className={`rounded-2xl border px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-55 ${active ? "border-purple-300 bg-purple-50" : "border-[#eadfd5] bg-white"}`}
      disabled={value === 0 && !active}
      onClick={onClick}
    >
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{label}</p>
      <p className="mt-1 text-3xl font-black leading-none">{value}</p>
    </button>
  );
}

export default function PhoneOnboardingPage() {
  const [users, setUsers] = useState<PhoneIntake[]>([]);
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<PhoneBucket | "">("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function lifecycleApi(path: string, options: RequestInit = {}) {
    const res = await apiFetch(`/api/admin/lifecycle${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Phone onboarding request failed");
    return data as Record<string, unknown>;
  }

  async function loadPhoneUsers(options: { announce?: boolean; clearMessage?: boolean } = {}) {
    const { announce = false, clearMessage = true } = options;
    setIsLoading(true);
    if (clearMessage) setMessage("");
    try {
      const params = new URLSearchParams({
        entry_point: "phone",
        callback_onboarding: "false",
        inbound_phone_onboarding: "true",
      });
      if (query.trim()) params.set("query", query.trim());
      const data = await lifecycleApi(`/users?${params.toString()}`);
      const nextUsers = (data.users ?? []) as PhoneIntake[];
      setUsers(nextUsers);
      if (announce) {
        setMessage(`Inbound callers refreshed: ${nextUsers.length} ${nextUsers.length === 1 ? "record" : "records"}.`);
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load phone onboarding users");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadPhoneUsers().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phoneSummary = useMemo(() => (
    (Object.keys(phoneBucketLabels) as PhoneBucket[]).map((bucket) => ({
      bucket,
      label: phoneBucketLabels[bucket],
      value: users.filter((user) => phoneBucket(user) === bucket).length,
    }))
  ), [users]);

  const phoneWorkQueue = useMemo(() => {
    const priority: Record<PhoneBucket, number> = {
      missing_info: 0,
      new_call: 1,
      link_sent: 2,
      completed: 3,
    };
    return [...users]
      .filter((user) => phoneBucket(user) !== "completed")
      .sort((left, right) => priority[phoneBucket(left)] - priority[phoneBucket(right)])
      .slice(0, 8);
  }, [users]);

  const visiblePhoneUsers = useMemo(
    () => {
      const needle = query.trim().toLowerCase();
      return users.filter((user) => {
        if (bucketFilter && phoneBucket(user) !== bucketFilter) return false;
        return !needle || phoneSearchText(user).includes(needle);
      });
    },
    [bucketFilter, query, users],
  );

  function focusCaller(user: PhoneIntake) {
    setBucketFilter(phoneBucket(user));
    setQuery(profileName(user) || user.phone || "");
  }

  function clearFilters() {
    setBucketFilter("");
    setQuery("");
  }

  return (
    <main className="min-h-screen bg-[#f7f2eb] px-4 py-4 text-[#2f2135] sm:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminPageHeader
          title="Phone onboarding"
          subtitle="Inbound callers who start VYVA setup by phone."
        >
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={() => loadPhoneUsers({ announce: true }).catch(() => undefined)}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          {message && <span className="rounded-xl bg-purple-50 px-3 py-2 text-sm font-bold text-purple-800">{message}</span>}
        </AdminPageHeader>

        <AdminMenu />

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {phoneSummary.map((item) => (
            <SummaryCard
              key={item.bucket}
              label={item.label}
              value={item.value}
              active={bucketFilter === item.bucket}
              testId={`phone-summary-${item.bucket}`}
              onClick={() => setBucketFilter(bucketFilter === item.bucket ? "" : item.bucket)}
            />
          ))}
        </div>

        <section className="mt-4 rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-purple-700">Work queue</p>
              <h2 className="mt-1 font-serif text-3xl leading-tight">Needs follow-up</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-[#7d6b65]">
                Inbound callers that are not completed yet, ordered by the most likely admin follow-up first.
              </p>
            </div>
            <span className="rounded-full bg-[#f3e8ff] px-4 py-2 text-sm font-black text-purple-800">
              {phoneWorkQueue.length} shown
            </span>
          </div>

          {phoneWorkQueue.length === 0 ? (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              <CheckCircle2 size={18} />
              No inbound callers need follow-up in the loaded records.
            </div>
          ) : (
            <div className="mt-4 grid gap-2 lg:grid-cols-2">
              {phoneWorkQueue.map((user) => {
                const action = phoneAction(user);
                return (
                  <button
                    key={`queue-${user.id}`}
                    type="button"
                    className={`rounded-2xl border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${actionToneClass(action.tone)}`}
                    onClick={() => focusCaller(user)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black">{profileName(user)}</p>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.08em] opacity-70">{action.label}</p>
                        <p className="mt-1 truncate text-sm font-semibold opacity-80">{action.title}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-4 rounded-[24px] border border-[#eadfd5] bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-3xl leading-tight">Inbound caller intake</h2>
              <p className="mt-1 max-w-2xl text-sm text-[#7d6b65]">
                Records captured from the VYVA phone agent only. Callback requests live outside this queue.
              </p>
            </div>
            <span className="rounded-full bg-[#f3e8ff] px-4 py-2 text-sm font-black text-purple-800">
              {users.length} callers
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto]">
            <label className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b7a73]" size={16} />
              <input
                className="w-full rounded-2xl border border-[#e4d8ce] bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                placeholder="Search caller name, phone or email"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && loadPhoneUsers().catch(() => undefined)}
              />
            </label>
            <button
              type="button"
              className="rounded-2xl bg-[#2f2135] px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              disabled={isLoading}
              onClick={() => loadPhoneUsers().catch(() => undefined)}
            >
              Search
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={`rounded-full px-4 py-2 text-sm font-black ${bucketFilter === "" ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700"}`}
              onClick={() => setBucketFilter("")}
            >
              All inbound callers
            </button>
            {(Object.keys(phoneBucketLabels) as PhoneBucket[]).map((bucket) => (
              <button
                key={bucket}
                type="button"
                className={`rounded-full px-4 py-2 text-sm font-black ${bucketFilter === bucket ? "bg-purple-700 text-white" : "border border-purple-100 bg-white text-purple-700"}`}
                onClick={() => setBucketFilter(bucket)}
              >
                {phoneBucketLabels[bucket]}
              </button>
            ))}
            {(bucketFilter || query.trim()) && (
              <button
                type="button"
                className="rounded-full border border-[#eadfd5] bg-white px-4 py-2 text-sm font-black text-[#5f514b] hover:border-purple-200 hover:text-purple-700"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )}
          </div>
          <p className="mt-3 text-sm font-bold text-[#7d6b65]">
            Showing {visiblePhoneUsers.length} of {users.length} loaded callers.
          </p>
        </section>

        <section className="mt-4 grid gap-4">
          {isLoading ? (
            <div className="rounded-[24px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#8b7a73]">Loading inbound callers...</div>
          ) : visiblePhoneUsers.length === 0 ? (
            <div className="rounded-[24px] border border-[#eadfd5] bg-white p-8 text-center font-bold text-[#8b7a73]">No inbound caller intake records match the current filters.</div>
          ) : (
            visiblePhoneUsers.map((user) => <PhoneUserCard key={user.id} user={user} />)
          )}
        </section>
      </section>
    </main>
  );
}
