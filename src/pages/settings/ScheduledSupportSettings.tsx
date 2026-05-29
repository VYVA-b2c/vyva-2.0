import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BellRing,
  Brain,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Pause,
  Pill,
  Play,
  ShieldCheck,
} from "lucide-react";
import { PhoneFrame } from "@/components/onboarding/PhoneFrame";
import { ProfileSectionHero } from "@/components/onboarding/ProfileSectionHero";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Schedule = {
  id: string;
  interaction_type: "CHECK_IN" | "BRAIN_COACH" | "MEDICATION" | "SYMPTOM_FOLLOWUP" | "CONCIERGE_FOLLOWUP";
  friendly_label?: string | null;
  user_description?: string | null;
  status: "ACTIVE" | "PAUSED" | "CANCELLED";
  frequency_type: "DAILY" | "WEEKLY" | "CUSTOM" | "ONE_OFF";
  frequency_value?: Record<string, unknown> | null;
  days_of_week: string[];
  times_of_day: string[];
  timezone: string;
  preferred_language: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  escalation_contacts?: Array<{ name?: string; contact?: string; relationship?: string }>;
  next_run_at?: string | null;
  last_completed_at?: string | null;
  last_result?: string | null;
  is_paused: boolean;
  pause_until?: string | null;
  pause_reason?: string | null;
  admin_edit_allowed: boolean;
  consent_status?: string | null;
  source_ref_id?: string | null;
};

type InteractionLog = {
  id: string;
  scheduled_interaction_id?: string | null;
  interaction_type: string;
  scheduled_for?: string | null;
  completed_at?: string | null;
  outcome: "COMPLETED" | "MISSED" | "NO_RESPONSE" | "CANCELLED" | "ESCALATED";
  summary?: string | null;
  created_at: string;
};

type ScheduledEvent = {
  id: string;
  event_type: string;
  title: string;
  description?: string | null;
  channel: string;
  scheduled_for?: string | null;
  display_time?: string | null;
  timezone: string;
  recurrence: string;
  status: string;
  source: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  read_only?: boolean;
};

const dayOptions = [
  { value: "MON", label: "Mon" },
  { value: "TUE", label: "Tue" },
  { value: "WED", label: "Wed" },
  { value: "THU", label: "Thu" },
  { value: "FRI", label: "Fri" },
  { value: "SAT", label: "Sat" },
  { value: "SUN", label: "Sun" },
];

const languageOptions = [
  { value: "es", label: "Espanol" },
  { value: "en", label: "English" },
  { value: "fr", label: "Francais" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Portugues" },
];

const cardClassName =
  "rounded-[28px] border border-[#EFE4D5] bg-white p-5 shadow-[0_14px_34px_rgba(53,28,87,0.06)]";
const detailPanelClassName = "mt-4 grid gap-3 rounded-[22px] bg-[#FFF9F1] p-4 text-[15px]";
const inputClassName =
  "h-14 rounded-[18px] border border-[#DDC7FF] bg-white px-4 text-[17px] text-vyva-text-1 shadow-[0_8px_20px_rgba(53,28,87,0.05)] focus:border-vyva-purple focus:outline-none focus:ring-4 focus:ring-vyva-purple/15";

function readableType(type: Schedule["interaction_type"]) {
  if (type === "CHECK_IN") return "Check-in calls";
  if (type === "BRAIN_COACH") return "Brain coach";
  if (type === "MEDICATION") return "Medication reminders";
  if (type === "SYMPTOM_FOLLOWUP") return "Symptom follow-up";
  return "Concierge follow-up";
}

function iconFor(type: Schedule["interaction_type"]) {
  if (type === "CHECK_IN") return BellRing;
  if (type === "BRAIN_COACH") return Brain;
  if (type === "MEDICATION") return Pill;
  return CalendarClock;
}

function formatDate(value?: string | null) {
  if (!value) return "Not scheduled yet";
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventTypeLabel(type: string) {
  if (type === "check_in_call") return "Check-in call";
  if (type === "medication_reminder") return "Reminder";
  if (type === "brain_coach") return "Brain coach";
  if (type === "vyva_chat") return "VYVA chat";
  if (type === "social_room_session") return "Social room";
  if (type === "concierge_call") return "Concierge";
  return "Event";
}

function eventOwnerLabel(event: ScheduledEvent) {
  if (event.created_by === "admin" || event.updated_by === "admin" || event.source === "admin") {
    return "Scheduled by the VYVA team";
  }
  if (event.source === "system") return "Scheduled by VYVA";
  return "Created by you";
}

function frequencyLabel(schedule: Schedule) {
  if (schedule.frequency_type === "ONE_OFF") return "One time";
  if (schedule.frequency_type === "DAILY") {
    return schedule.times_of_day.length > 1 ? "Several times a day" : "Every day";
  }

  const days = schedule.days_of_week
    .map((day) => dayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
  return days ? `Days: ${days}` : "Selected days";
}

function lastResult(schedule: Schedule, logs: InteractionLog[]) {
  const ownLog = logs.find((log) => log.scheduled_interaction_id === schedule.id || log.interaction_type === schedule.interaction_type);
  if (ownLog?.outcome === "COMPLETED") return "Completed";
  if (ownLog?.outcome === "MISSED") return "Missed";
  if (ownLog?.outcome === "NO_RESPONSE") return "No response";
  if (ownLog?.outcome === "ESCALATED") return "Help requested";
  if (schedule.last_result) return schedule.last_result;
  return "No activity yet";
}

function scheduleSort(schedule: Schedule) {
  const order = { CHECK_IN: 1, BRAIN_COACH: 2, MEDICATION: 3, SYMPTOM_FOLLOWUP: 4, CONCIERGE_FOLLOWUP: 5 };
  return order[schedule.interaction_type] ?? 99;
}

async function readError(response: Response) {
  const body = await response.clone().json().catch(() => null);
  return body?.error ?? "We could not save that change. Please try again.";
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-[12px] font-black ${active ? "bg-[#EAFBF2] text-[#087443]" : "bg-[#F4EAFE] text-vyva-purple"}`}>
      {active ? "Active" : "Paused"}
    </span>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white p-5 text-center text-[15px] font-semibold text-vyva-text-2 shadow-[0_14px_34px_rgba(53,28,87,0.06)]">
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, count, color = "purple" }: { title: string; subtitle: string; count?: number; color?: "purple" | "blue" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div>
        <h2 className="font-display text-[28px] leading-tight text-vyva-text-1">{title}</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-vyva-text-2">{subtitle}</p>
      </div>
      {typeof count === "number" ? (
        <span className={`rounded-full px-3 py-1 text-[12px] font-black ${color === "blue" ? "bg-[#EEF4FF] text-[#2563EB]" : "bg-[#F5F0FF] text-vyva-purple"}`}>
          {count}
        </span>
      ) : null}
    </div>
  );
}

function ScheduledEventCard({ event }: { event: ScheduledEvent }) {
  return (
    <article className={cardClassName}>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#EEF4FF] text-[#2563EB]">
          <CalendarClock size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[26px] leading-tight text-vyva-text-1">{event.title}</h3>
            <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[12px] font-black text-[#2563EB]">
              {event.status}
            </span>
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-vyva-text-2">
            {eventTypeLabel(event.event_type)} - {eventOwnerLabel(event)}
          </p>
          {event.description ? <p className="mt-2 text-[15px] leading-relaxed text-vyva-text-2">{event.description}</p> : null}
        </div>
      </div>
      <div className={detailPanelClassName}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">When</span>
          <strong className="text-right text-vyva-text-1">{event.display_time ?? formatDate(event.scheduled_for)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Channel</span>
          <strong className="text-right capitalize text-vyva-text-1">{event.channel}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Repeat</span>
          <strong className="text-right text-vyva-text-1">{event.recurrence === "none" ? "Does not repeat" : event.recurrence}</strong>
        </div>
      </div>
    </article>
  );
}

function ScheduleCard({
  schedule,
  logs,
  isEditing,
  onEdit,
  onCancel,
  onSave,
  onPause,
  onResume,
  saving,
}: {
  schedule: Schedule;
  logs: InteractionLog[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (draft: Schedule) => void;
  onPause: () => void;
  onResume: () => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<Schedule>(schedule);
  const Icon = iconFor(schedule.interaction_type);
  const active = schedule.status === "ACTIVE" && !schedule.is_paused;
  const medicationName = typeof schedule.frequency_value?.medication_name === "string"
    ? schedule.frequency_value.medication_name
    : schedule.friendly_label;

  if (isEditing) {
    return (
      <article className="rounded-[28px] border-2 border-vyva-purple bg-white p-5 shadow-[0_18px_42px_rgba(107,33,168,0.14)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F0FF] text-vyva-purple">
            <Icon size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[26px] leading-tight text-vyva-text-1">{schedule.friendly_label || readableType(schedule.interaction_type)}</h3>
            <p className="mt-1 text-[15px] leading-relaxed text-vyva-text-2">{schedule.user_description}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-5">
          <label className="grid gap-2 text-[14px] font-black text-vyva-text-2">
            Frequency
            <select
              className={inputClassName}
              value={draft.frequency_type}
              onChange={(event) => setDraft({ ...draft, frequency_type: event.target.value as Schedule["frequency_type"] })}
            >
              <option value="DAILY">Every day</option>
              <option value="WEEKLY">Selected days</option>
              <option value="CUSTOM">Custom</option>
              <option value="ONE_OFF">One time</option>
            </select>
          </label>

          {(draft.frequency_type === "WEEKLY" || draft.frequency_type === "CUSTOM") ? (
            <div>
              <p className="mb-2 text-[14px] font-black text-vyva-text-2">Days of the week</p>
              <div className="grid grid-cols-7 gap-2">
                {dayOptions.map((day) => {
                  const selected = draft.days_of_week.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`h-12 rounded-[14px] text-[13px] font-black ${selected ? "bg-vyva-purple text-white" : "bg-[#F8F3ED] text-vyva-text-2"}`}
                      onClick={() => setDraft({
                        ...draft,
                        days_of_week: selected
                          ? draft.days_of_week.filter((value) => value !== day.value)
                          : [...draft.days_of_week, day.value],
                      })}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[14px] font-black text-vyva-text-2">Times</p>
            <div className="grid gap-2">
              {(draft.times_of_day.length ? draft.times_of_day : ["09:00"]).map((time, index) => (
                <div key={`${schedule.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="time"
                    className={inputClassName}
                    value={time}
                    onChange={(event) => {
                      const next = [...(draft.times_of_day.length ? draft.times_of_day : ["09:00"])];
                      next[index] = event.target.value;
                      setDraft({ ...draft, times_of_day: next });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-[18px] border border-vyva-border px-4 font-black text-vyva-text-2"
                    onClick={() => setDraft({ ...draft, times_of_day: draft.times_of_day.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="h-14 rounded-[18px] bg-[#F5F0FF] font-black text-vyva-purple"
                onClick={() => setDraft({ ...draft, times_of_day: [...draft.times_of_day, "12:00"] })}
              >
                Add another time
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-[14px] font-black text-vyva-text-2">
              Preferred language
              <select
                className={inputClassName}
                value={draft.preferred_language}
                onChange={(event) => setDraft({ ...draft, preferred_language: event.target.value })}
              >
                {languageOptions.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-[14px] font-black text-vyva-text-2">
              Pause until
              <input
                type="date"
                className={inputClassName}
                value={draft.pause_until ? draft.pause_until.slice(0, 10) : ""}
                onChange={(event) => setDraft({ ...draft, pause_until: event.target.value ? `${event.target.value}T00:00:00.000Z` : null })}
              />
            </label>
          </div>

          <div className="rounded-[22px] bg-[#FFF9F1] p-4">
            <p className="text-[15px] font-black text-vyva-text-1">Do not call during these hours</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input
                type="time"
                className={inputClassName}
                value={draft.quiet_hours_start}
                onChange={(event) => setDraft({ ...draft, quiet_hours_start: event.target.value })}
              />
              <input
                type="time"
                className={inputClassName}
                value={draft.quiet_hours_end}
                onChange={(event) => setDraft({ ...draft, quiet_hours_end: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-[22px] bg-[#F7F2FF] p-4">
            <p className="text-[15px] font-black text-vyva-text-1">Who should VYVA contact if help is needed?</p>
            <div className="mt-3 grid gap-3">
              <input
                className={inputClassName}
                placeholder="Name"
                value={draft.escalation_contacts?.[0]?.name ?? ""}
                onChange={(event) => setDraft({ ...draft, escalation_contacts: [{ ...(draft.escalation_contacts?.[0] ?? {}), name: event.target.value }] })}
              />
              <input
                className={inputClassName}
                placeholder="Phone or email"
                value={draft.escalation_contacts?.[0]?.contact ?? ""}
                onChange={(event) => setDraft({ ...draft, escalation_contacts: [{ ...(draft.escalation_contacts?.[0] ?? {}), contact: event.target.value }] })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="h-14 rounded-full border border-vyva-border font-black" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="h-14 rounded-full bg-vyva-purple font-black text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] disabled:opacity-60"
              onClick={() => onSave(draft)}
            >
              Save
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cardClassName}>
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F0FF] text-vyva-purple">
          <Icon size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[26px] leading-tight text-vyva-text-1">{schedule.friendly_label || readableType(schedule.interaction_type)}</h3>
            <StatusPill active={active} />
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-vyva-text-2">{schedule.user_description}</p>
        </div>
      </div>

      <div className={detailPanelClassName}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Frequency</span>
          <strong className="text-right text-vyva-text-1">{frequencyLabel(schedule)}</strong>
        </div>
        {schedule.interaction_type === "MEDICATION" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-vyva-text-2">Medication</span>
            <strong className="text-right text-vyva-text-1">{medicationName}</strong>
          </div>
        ) : null}
        {schedule.interaction_type === "BRAIN_COACH" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-vyva-text-2">Session type</span>
            <strong className="text-right text-vyva-text-1">{String(schedule.frequency_value?.session_type ?? "Memory")}</strong>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Next call</span>
          <strong className="text-right text-vyva-text-1">{formatDate(schedule.next_run_at)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Last result</span>
          <strong className="text-right text-vyva-text-1">{lastResult(schedule, logs)}</strong>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="h-14 rounded-full bg-[#F5F0FF] font-black text-vyva-purple" onClick={onEdit}>
          Edit schedule
        </button>
        {active ? (
          <button type="button" className="flex h-14 items-center justify-center gap-2 rounded-full border border-vyva-border font-black text-vyva-text-1" onClick={onPause}>
            <Pause size={18} /> Pause
          </button>
        ) : (
          <button type="button" className="flex h-14 items-center justify-center gap-2 rounded-full border border-vyva-border font-black text-vyva-text-1" onClick={onResume}>
            <Play size={18} /> Resume
          </button>
        )}
      </div>
    </article>
  );
}

export default function ScheduledSupportSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);

  const schedulesQuery = useQuery<{ schedules: Schedule[] }>({
    queryKey: ["/api/users/me/schedules"],
  });
  const eventsQuery = useQuery<{ events: ScheduledEvent[] }>({
    queryKey: ["/api/profile/scheduled-events"],
  });
  const logsQuery = useQuery<{ logs: InteractionLog[] }>({
    queryKey: ["/api/users/me/interaction-logs"],
  });
  const auditQuery = useQuery<{ logs: Array<{ id: string; changed_by_role: string; created_at: string; new_value?: unknown }> }>({
    queryKey: ["/api/users/me/consent-audit-logs"],
  });

  const schedules = useMemo(
    () => (schedulesQuery.data?.schedules ?? [])
      .filter((schedule) => schedule.status !== "CANCELLED")
      .sort((a, b) => scheduleSort(a) - scheduleSort(b)),
    [schedulesQuery.data?.schedules],
  );
  const scheduledEvents = useMemo(
    () => (eventsQuery.data?.events ?? [])
      .filter((event) => !event.read_only && !event.id.startsWith("medication:") && event.status !== "cancelled")
      .sort((a, b) => {
        const left = a.scheduled_for ? new Date(a.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        const right = b.scheduled_for ? new Date(b.scheduled_for).getTime() : Number.MAX_SAFE_INTEGER;
        return left - right;
      }),
    [eventsQuery.data?.events],
  );
  const logs = logsQuery.data?.logs ?? [];
  const adminEditAllowed = schedules.some((schedule) => schedule.admin_edit_allowed);

  const saveMutation = useMutation({
    mutationFn: async (schedule: Schedule) => {
      const response = await apiFetch(`/api/schedules/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify(schedule),
      });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/consent-audit-logs"] });
      toast({ title: "Schedule saved", description: "Your scheduled support has been updated." });
    },
    onError: (error) => {
      toast({ title: "Could not save", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" }) => {
      const response = await apiFetch(`/api/schedules/${id}/${action}`, { method: "POST", body: JSON.stringify({}) });
      if (!response.ok) throw new Error(await readError(response));
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/schedules"] });
    },
    onError: (error) => {
      toast({ title: "Could not change the status", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  const consentMutation = useMutation({
    mutationFn: async (allowed: boolean) => {
      await Promise.all(schedules.map(async (schedule) => {
        const response = await apiFetch(`/api/schedules/${schedule.id}`, {
          method: "PATCH",
          body: JSON.stringify({ admin_edit_allowed: allowed }),
        });
        if (!response.ok) throw new Error(await readError(response));
      }));
    },
    onSuccess: (_data, allowed) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/consent-audit-logs"] });
      toast({
        title: allowed ? "Care team help allowed" : "Care team help turned off",
        description: allowed
          ? "Your caregiver or the VYVA team can help you manage schedules."
          : "Only you can change your schedules.",
      });
    },
    onError: (error) => {
      toast({ title: "Could not save permission", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  return (
    <PhoneFrame subtitle="Scheduled support" showBack onBack={() => navigate("/settings")}>
      <div className="flex flex-col gap-6 px-1 pb-6 pt-5 sm:px-2 md:px-3">
        <ProfileSectionHero
          icon={CalendarClock}
          title="Scheduled support"
          kicker="Calls & reminders"
          description="Choose when VYVA calls, reminds you, follows up, and asks for help if something needs attention."
          badges={[
            { label: "Check-ins", color: "purple" },
            { label: "Medication", color: "green" },
            { label: "Brain coach", color: "blue" },
          ]}
        />

        <section className={cardClassName}>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#EAFBF2] text-[#087443]">
              <ShieldCheck size={26} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[26px] leading-tight text-vyva-text-1">Caregiver help</h2>
              <p className="mt-1 text-[15px] leading-relaxed text-vyva-text-2">
                Changes made by a caregiver or by the VYVA team are recorded here, so you stay in control.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={consentMutation.isPending || schedules.length === 0}
            className={`mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-[20px] px-4 text-left text-[16px] font-black transition ${adminEditAllowed ? "bg-[#EAFBF2] text-[#087443]" : "bg-[#F5F0FF] text-vyva-purple"} disabled:opacity-60`}
            onClick={() => consentMutation.mutate(!adminEditAllowed)}
          >
            <span>Allow my caregiver to help manage my schedules</span>
            <span className="rounded-full bg-white px-3 py-1 text-[12px]">{adminEditAllowed ? "Yes" : "No"}</span>
          </button>
        </section>

        <section className="grid gap-4">
          <SectionTitle
            title="Upcoming events"
            subtitle="Appointments, reminders, and one-off sessions scheduled by you or by VYVA."
            count={scheduledEvents.length}
            color="blue"
          />
          {eventsQuery.isLoading ? (
            <EmptyState>Loading events...</EmptyState>
          ) : eventsQuery.isError ? (
            <EmptyState>
              <p className="font-black text-vyva-text-1">We could not load your events.</p>
              <p className="mt-2">Refresh the page. If it keeps happening, contact the VYVA team.</p>
            </EmptyState>
          ) : scheduledEvents.length === 0 ? (
            <EmptyState>No one-off events are scheduled.</EmptyState>
          ) : (
            scheduledEvents.map((event) => <ScheduledEventCard key={event.id} event={event} />)
          )}
        </section>

        <section className="grid gap-4">
          <SectionTitle
            title="Recurring support"
            subtitle="Routines VYVA keeps active to support your day."
            count={schedules.length}
          />
          {schedulesQuery.isLoading ? (
            <EmptyState>Loading your schedules...</EmptyState>
          ) : schedulesQuery.isError ? (
            <EmptyState>
              <p className="font-black text-vyva-text-1">We could not load your schedules.</p>
              <p className="mt-2">Refresh the page. If it keeps happening, contact the VYVA team.</p>
            </EmptyState>
          ) : schedules.length === 0 ? (
            <EmptyState>No scheduled support yet.</EmptyState>
          ) : (
            schedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                logs={logs}
                isEditing={editingId === schedule.id}
                onEdit={() => setEditingId(schedule.id)}
                onCancel={() => setEditingId(null)}
                onSave={(draft) => saveMutation.mutate(draft)}
                onPause={() => statusMutation.mutate({ id: schedule.id, action: "pause" })}
                onResume={() => statusMutation.mutate({ id: schedule.id, action: "resume" })}
                saving={saveMutation.isPending}
              />
            ))
          )}
        </section>

        <section className={cardClassName}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#EEF4FF] text-[#2563EB]">
              <History size={24} />
            </div>
            <h2 className="font-display text-[26px] text-vyva-text-1">Activity history</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {logs.slice(0, 5).length === 0 ? (
              <p className="rounded-[20px] bg-[#FFF9F1] p-4 text-[15px] text-vyva-text-2">No completed calls or reminders yet.</p>
            ) : logs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-[20px] bg-[#FFF9F1] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-black text-vyva-text-1">{readableType(log.interaction_type as Schedule["interaction_type"])}</span>
                  <span className="text-[13px] text-vyva-text-2">{formatDate(log.completed_at ?? log.scheduled_for ?? log.created_at)}</span>
                </div>
                <p className="mt-1 text-[14px] text-vyva-text-2">
                  Result: {lastResult({ id: "", interaction_type: log.interaction_type as Schedule["interaction_type"], status: "ACTIVE", frequency_type: "DAILY", frequency_value: {}, days_of_week: [], times_of_day: [], timezone: "Europe/Madrid", preferred_language: "es", quiet_hours_start: "21:00", quiet_hours_end: "08:00", is_paused: false, admin_edit_allowed: false }, [log])}
                </p>
                {log.summary ? <p className="mt-1 text-[14px] text-vyva-text-2">{log.summary}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className={cardClassName}>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#F5F0FF] text-vyva-purple">
              <Clock size={24} />
            </div>
            <h2 className="font-display text-[26px] text-vyva-text-1">Recent changes</h2>
          </div>
          <div className="mt-4 grid gap-3">
            {(auditQuery.data?.logs ?? []).slice(0, 4).length === 0 ? (
              <p className="rounded-[20px] bg-[#FFF9F1] p-4 text-[15px] text-vyva-text-2">No recent permission or schedule changes.</p>
            ) : (auditQuery.data?.logs ?? []).slice(0, 4).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-[20px] bg-[#FFF9F1] p-4 text-[14px] text-vyva-text-2">
                <CheckCircle2 size={18} className="flex-shrink-0 text-[#087443]" />
                <span>{log.changed_by_role === "elder" ? "Change made by you" : "Change made with permission"} - {formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PhoneFrame>
  );
}
