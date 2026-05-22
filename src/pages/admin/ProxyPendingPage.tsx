import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flag,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
} from "lucide-react";
import { VyvaWordmark } from "@/components/VyvaWordmark";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, queryClient } from "@/lib/queryClient";

type CareTeamMember = {
  source: string;
  id: string;
  name: string;
  relationship?: string | null;
  role?: string | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  accepted_at?: string | null;
  is_primary?: boolean | null;
  permissions?: Record<string, boolean>;
};

type SupportSchedule = {
  id: string;
  interaction_type: string;
  friendly_label?: string | null;
  status: string;
  frequency_type: string;
  days_of_week?: string[];
  times_of_day?: string[];
  timezone?: string | null;
  admin_edit_allowed?: boolean;
  is_paused?: boolean;
  next_run_at?: string | null;
};

type RecentCommunication = {
  id: string;
  channel: string;
  purpose: string;
  status: string;
  recipient: string;
  sent_at?: string | null;
  created_at?: string | null;
};

type RecentAlert = {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
  resolved_at?: string | null;
  created_at?: string | null;
};

type ProxyProfile = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  proxy_initiator_id: string | null;
  proxy_name: string;
  proxy_initiated_at: string | null;
  elder_confirmed_at: string | null;
  phone_number: string | null;
  email?: string | null;
  whatsapp_number?: string | null;
  caregiver_name?: string | null;
  caregiver_contact?: string | null;
  contact_method?: string | null;
  channel_reports?: string | null;
  channel_chats?: string | null;
  channel_notifications?: string | null;
  language?: string | null;
  timezone?: string | null;
  onboarding_channel?: string | null;
  current_stage?: string | null;
  onboarding_complete?: boolean | null;
  subscription_tier?: string | null;
  account_status?: string | null;
  created_at: string;
  elder?: {
    id: string;
    name: string | null;
    full_name: string | null;
    preferred_name: string | null;
    phone_number: string | null;
    email?: string | null;
    whatsapp_number?: string | null;
    account_status?: string | null;
    subscription_tier?: string | null;
    onboarding_stage?: string | null;
    onboarding_channel?: string | null;
    onboarding_complete?: boolean | null;
  };
  caregiver?: {
    name: string;
    saved_name?: string | null;
    saved_contact?: string | null;
    team: CareTeamMember[];
  };
  preferences?: {
    language?: string | null;
    timezone?: string | null;
    contact_method?: string | null;
    reports?: string | null;
    chats?: string | null;
    notifications?: string | null;
    channel?: Record<string, unknown> | null;
  };
  automations?: {
    upcoming_events_count: number;
    next_event?: {
      title: string;
      event_type: string;
      channel: string;
      status: string;
      scheduled_for?: string | null;
      source?: string | null;
      created_by?: string | null;
    } | null;
    active_support_count: number;
    support_schedules: SupportSchedule[];
    communications_count: number;
    recent_communications: RecentCommunication[];
    unresolved_alerts_count: number;
    recent_alerts: RecentAlert[];
  };
};

type AdminData = {
  pending: ProxyProfile[];
  confirmed: ProxyProfile[];
};

function daysSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not set";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not set";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Not scheduled";
  return new Date(dateStr).toLocaleString([], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayName(profile: ProxyProfile): string {
  return profile.elder?.name || profile.preferred_name || profile.full_name || `User ${profile.id.slice(0, 8)}`;
}

function caregiverDisplay(profile: ProxyProfile) {
  const raw = profile.caregiver?.name || profile.proxy_name || "Unknown caregiver";
  const match = raw.match(/^(.*?)\s*\((.*?)\)\s*$/);
  return {
    name: match?.[1]?.trim() || raw,
    relationship: match?.[2]?.trim() || profile.caregiver?.team?.[0]?.relationship || null,
  };
}

function contactItems(profile: ProxyProfile) {
  return [
    { icon: Phone, label: "Elder phone", value: profile.elder?.phone_number || profile.phone_number },
    { icon: Mail, label: "Elder email", value: profile.elder?.email || profile.email },
    { icon: Smartphone, label: "Elder WhatsApp", value: profile.elder?.whatsapp_number || profile.whatsapp_number },
    { icon: HeartHandshake, label: "Caregiver contact", value: profile.caregiver?.saved_contact || profile.caregiver_contact },
  ].filter((item) => item.value);
}

function PreferencePill({ label, value }: { label: string; value?: string | null }) {
  return (
    <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-800">
      {label}: {cleanLabel(value)}
    </span>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#eadfd5] bg-[#fffaf5] p-4">
      <p className="mb-3 text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">{title}</p>
      {children}
    </div>
  );
}

function ContactLine({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm">
      <Icon size={15} className="mt-0.5 shrink-0 text-purple-700" />
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#8b7a73]">{label}</p>
        <p className="break-words font-semibold text-[#2f2135]">{value}</p>
      </div>
    </div>
  );
}

function CaregiverRow({
  profile,
  isPending,
}: {
  profile: ProxyProfile;
  isPending: boolean;
}) {
  const [flagReason, setFlagReason] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const caregiver = caregiverDisplay(profile);
  const dayCount = profile.proxy_initiated_at
    ? Math.floor((Date.now() - new Date(profile.proxy_initiated_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const isOverdue = isPending && dayCount > 7;
  const automations = profile.automations;
  const team = profile.caregiver?.team ?? [];

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/admin/proxy-confirm/${profile.id}`, { method: "POST" });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActionMsg("Caregiver confirmed.");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proxy-pending"] });
    },
    onError: () => setActionMsg("Could not confirm caregiver."),
  });

  const flagMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/admin/proxy-flag/${profile.id}`, {
        method: "POST",
        body: JSON.stringify({ reason: flagReason || undefined }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: () => {
      setActionMsg("Caregiver flagged for review.");
      setShowFlagInput(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/proxy-pending"] });
    },
    onError: () => setActionMsg("Could not flag caregiver."),
  });

  return (
    <article
      data-testid={`card-proxy-profile-${profile.id}`}
      className={`rounded-[28px] border bg-white p-5 shadow-sm ${isOverdue ? "border-red-200" : "border-[#eadfd5]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-serif text-2xl leading-tight">{caregiver.name}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${isPending ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
              {isPending ? "Awaiting elder confirmation" : "Confirmed"}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-700">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#7d6b65]">
            Assigned to <span className="font-black text-[#2f2135]">{displayName(profile)}</span>
            {caregiver.relationship ? ` - ${caregiver.relationship}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#7d6b65]">
            <span className="inline-flex items-center gap-1"><Clock size={12} /> Started {daysSince(profile.proxy_initiated_at)}</span>
            <span>ID: {profile.id}</span>
            {!isPending && <span className="text-green-700">Confirmed {daysSince(profile.elder_confirmed_at)}</span>}
          </div>
        </div>

        {isPending && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid={`button-confirm-${profile.id}`}
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
            >
              <UserCheck size={16} />
              {confirmMutation.isPending ? "Confirming..." : "Confirm"}
            </button>
            <button
              type="button"
              data-testid={`button-flag-${profile.id}`}
              onClick={() => setShowFlagInput((value) => !value)}
              disabled={flagMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-800 disabled:opacity-50"
            >
              <Flag size={16} />
              Flag
            </button>
          </div>
        )}
      </div>

      {showFlagInput && (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid={`form-flag-reason-${profile.id}`}>
          <Input
            data-testid={`input-flag-reason-${profile.id}`}
            value={flagReason}
            onChange={(event) => setFlagReason(event.target.value)}
            placeholder="Optional reason for review"
            className="min-w-[260px] flex-1 rounded-xl"
          />
          <button
            type="button"
            data-testid={`button-flag-submit-${profile.id}`}
            onClick={() => flagMutation.mutate()}
            disabled={flagMutation.isPending}
            className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
          >
            {flagMutation.isPending ? "Flagging..." : "Submit flag"}
          </button>
        </div>
      )}

      {actionMsg && <p data-testid={`text-action-result-${profile.id}`} className="mt-3 text-sm font-bold text-purple-800">{actionMsg}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <DetailBlock title="Elder assigned to">
          <p className="font-black text-[#2f2135]">{displayName(profile)}</p>
          <p className="mt-1 text-sm text-[#7d6b65]">
            {cleanLabel(profile.subscription_tier)} - {cleanLabel(profile.account_status)} - {profile.elder?.onboarding_complete ? "Onboarding complete" : cleanLabel(profile.current_stage)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PreferencePill label="Language" value={profile.preferences?.language || profile.language} />
            <PreferencePill label="Timezone" value={profile.preferences?.timezone || profile.timezone} />
          </div>
        </DetailBlock>

        <DetailBlock title="Contact details">
          <div className="grid gap-3 sm:grid-cols-2">
            {contactItems(profile).length ? (
              contactItems(profile).map((item) => <ContactLine key={item.label} icon={item.icon} label={item.label} value={item.value} />)
            ) : (
              <p className="text-sm font-semibold text-[#8b7a73]">No contact details saved yet.</p>
            )}
          </div>
        </DetailBlock>

        <DetailBlock title="Preferences">
          <div className="flex flex-wrap gap-2">
            <PreferencePill label="Contact" value={profile.preferences?.contact_method || profile.contact_method} />
            <PreferencePill label="Chats" value={profile.preferences?.chats || profile.channel_chats} />
            <PreferencePill label="Alerts" value={profile.preferences?.notifications || profile.channel_notifications} />
            <PreferencePill label="Reports" value={profile.preferences?.reports || profile.channel_reports} />
          </div>
          {team.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">Care team</p>
              {team.slice(0, 3).map((member) => (
                <div key={`${member.source}-${member.id}`} className="rounded-xl bg-white px-3 py-2 text-sm">
                  <p className="font-black">{member.name}</p>
                  <p className="text-xs text-[#7d6b65]">{cleanLabel(member.role)} - {cleanLabel(member.status)}{member.email ? ` - ${member.email}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </DetailBlock>

        <DetailBlock title="Automations">
          <div className="grid grid-cols-2 gap-2">
            <AutomationMetric icon={CalendarClock} label="Events" value={automations?.upcoming_events_count ?? 0} />
            <AutomationMetric icon={Bell} label="Support" value={automations?.active_support_count ?? 0} />
            <AutomationMetric icon={MessageCircle} label="Comms" value={automations?.communications_count ?? 0} />
            <AutomationMetric icon={AlertTriangle} label="Open alerts" value={automations?.unresolved_alerts_count ?? 0} />
          </div>
          {automations?.next_event && (
            <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm">
              <span className="font-black">Next:</span> {automations.next_event.title} - {formatDateTime(automations.next_event.scheduled_for)}
            </p>
          )}
          {automations?.support_schedules?.length ? (
            <div className="mt-3 space-y-2">
              {automations.support_schedules.slice(0, 2).map((schedule) => (
                <p key={schedule.id} className="rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-black">{schedule.friendly_label || cleanLabel(schedule.interaction_type)}</span>
                  {" - "}
                  {cleanLabel(schedule.frequency_type)} {schedule.times_of_day?.join(", ") || "time not set"}
                </p>
              ))}
            </div>
          ) : null}
        </DetailBlock>
      </div>
    </article>
  );
}

function AutomationMetric({ icon: Icon, label, value }: { icon: typeof CalendarClock; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[#8b7a73]">
        <Icon size={14} className="text-purple-700" />
        {label}
      </div>
      <p className="mt-1 text-xl font-black">{value}</p>
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "warning" | "success";
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${tone === "warning" ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default function ProxyPendingPage() {
  const { logout } = useAuth();

  const { data, isLoading, error, refetch } = useQuery<AdminData>({
    queryKey: ["/api/admin/proxy-pending"],
    queryFn: async () => {
      const res = await apiFetch("/api/admin/proxy-pending");
      if (res.status === 403) throw new Error("FORBIDDEN");
      if (res.status === 401) throw new Error("UNAUTHENTICATED");
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      return res.json();
    },
    retry: false,
  });

  const pending = data?.pending ?? [];
  const confirmed = data?.confirmed ?? [];
  const totalAutomations = [...pending, ...confirmed].reduce((sum, profile) => (
    sum + (profile.automations?.upcoming_events_count ?? 0) + (profile.automations?.active_support_count ?? 0)
  ), 0);

  return (
    <main className="min-h-screen bg-[#f7f2eb] text-[#2f2135]">
      <header className="border-b border-[#eadfd5] bg-white px-5 py-4">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <VyvaWordmark className="h-auto w-[112px] shrink-0 sm:w-[132px]" />
            <Link
              to="/admin/lifecycle"
              data-testid="link-proxy-back"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-purple-100 bg-white px-3 text-sm font-black text-purple-700 shadow-sm"
              aria-label="Back to admin"
            >
              <ArrowLeft size={16} />
              Back to admin
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-100">
                <Users size={21} className="text-purple-700" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-purple-700">VYVA Admin</p>
                <h1 className="font-serif text-3xl leading-tight">Caregivers</h1>
                <p className="text-sm text-[#7d6b65]">Elder assignments, contact details, preferences and automations.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-testid="button-admin-refresh"
              onClick={() => refetch()}
              className="rounded-xl bg-purple-700 px-4 py-2 text-sm font-black text-white"
            >
              Refresh
            </button>
            <button
              type="button"
              data-testid="button-admin-logout"
              onClick={logout}
              className="rounded-xl border border-[#eadfd5] bg-[#fffaf4] px-4 py-2 text-sm font-black text-[#5b4a46]"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-6">
        {error && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700" data-testid="text-admin-error">
            {(error as Error).message === "FORBIDDEN"
              ? "Access denied - your account is not an admin"
              : "Failed to load caregivers. Please refresh."}
          </div>
        )}

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={Clock} label="Awaiting confirmation" value={pending.length} />
          <SummaryCard icon={ShieldCheck} label="Confirmed caregivers" value={confirmed.length} />
          <SummaryCard icon={CalendarClock} label="Active automations" value={totalAutomations} />
        </div>

        <div className="space-y-7">
          <Section title="Awaiting confirmation" count={pending.length} tone="warning">
            {isLoading ? (
              <LoadingList />
            ) : pending.length === 0 ? (
              <EmptyState text="No caregivers awaiting elder confirmation." />
            ) : (
              <div data-testid="list-proxy-pending" className="grid gap-4">
                {pending.map((profile) => <CaregiverRow key={profile.id} profile={profile} isPending />)}
              </div>
            )}
          </Section>

          <Section title="Confirmed caregivers" count={confirmed.length} tone="success">
            {isLoading ? (
              <LoadingList />
            ) : confirmed.length === 0 ? (
              <EmptyState text="No confirmed caregivers yet." />
            ) : (
              <div data-testid="list-proxy-confirmed" className="grid gap-4">
                {confirmed.map((profile) => <CaregiverRow key={profile.id} profile={profile} isPending={false} />)}
              </div>
            )}
          </Section>
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#eadfd5] bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#8b7a73]">
        <Icon size={15} className="text-purple-700" />
        {label}
      </div>
      <p className="mt-2 text-3xl font-black leading-none">{value}</p>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="grid gap-4">
      {[1, 2].map((item) => (
        <div key={item} className="rounded-[28px] border border-[#eadfd5] bg-white p-5">
          <Skeleton className="mb-3 h-6 w-56" />
          <Skeleton className="mb-5 h-4 w-80" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[28px] border border-[#eadfd5] bg-white py-12 text-center text-sm font-bold text-[#8b7a73]">
      <CheckCircle2 size={34} className="mx-auto mb-3 text-green-500" />
      {text}
    </div>
  );
}
