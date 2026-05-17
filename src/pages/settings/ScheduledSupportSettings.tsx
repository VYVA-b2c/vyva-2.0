import { useMemo, useState } from "react";
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
  { value: "MON", label: "L" },
  { value: "TUE", label: "M" },
  { value: "WED", label: "X" },
  { value: "THU", label: "J" },
  { value: "FRI", label: "V" },
  { value: "SAT", label: "S" },
  { value: "SUN", label: "D" },
];

const languageOptions = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "pt", label: "Português" },
];

function readableType(type: Schedule["interaction_type"]) {
  if (type === "CHECK_IN") return "Llamadas de seguimiento";
  if (type === "BRAIN_COACH") return "Entrenador de memoria";
  if (type === "MEDICATION") return "Recordatorios de medicación";
  if (type === "SYMPTOM_FOLLOWUP") return "Seguimiento de síntomas";
  return "Seguimiento de concierge";
}

function iconFor(type: Schedule["interaction_type"]) {
  if (type === "CHECK_IN") return BellRing;
  if (type === "BRAIN_COACH") return Brain;
  if (type === "MEDICATION") return Pill;
  return CalendarClock;
}

function formatDate(value?: string | null) {
  if (!value) return "Aún no programado";
  return new Date(value).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventTypeLabel(type: string) {
  if (type === "check_in_call") return "Llamada de seguimiento";
  if (type === "medication_reminder") return "Recordatorio";
  if (type === "brain_coach") return "Entrenador de memoria";
  if (type === "vyva_chat") return "VYVA chat";
  if (type === "social_room_session") return "Sala social";
  if (type === "concierge_call") return "Concierge";
  return "Evento";
}

function eventOwnerLabel(event: ScheduledEvent) {
  if (event.created_by === "admin" || event.updated_by === "admin" || event.source === "admin") return "Programado por el equipo VYVA";
  if (event.source === "system") return "Programado por VYVA";
  return "Creado por ti";
}

function frequencyLabel(schedule: Schedule) {
  if (schedule.frequency_type === "ONE_OFF") return "Una sola vez";
  if (schedule.frequency_type === "DAILY") return schedule.times_of_day.length > 1 ? "Varias veces al día" : "Cada día";
  const days = schedule.days_of_week
    .map((day) => dayOptions.find((option) => option.value === day)?.label)
    .filter(Boolean)
    .join(", ");
  return days ? `Días: ${days}` : "Días concretos";
}

function ScheduledEventCard({ event }: { event: ScheduledEvent }) {
  return (
    <article className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-vyva-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#EEF4FF] text-[#2563EB]">
          <CalendarClock size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[23px] leading-tight text-vyva-text-1">{event.title}</h3>
            <span className="rounded-full bg-[#EEF4FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB]">
              {event.status}
            </span>
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">{eventTypeLabel(event.event_type)} - {eventOwnerLabel(event)}</p>
          {event.description ? <p className="mt-2 text-[14px] leading-relaxed text-vyva-text-2">{event.description}</p> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-3 rounded-[20px] bg-[#FFF9F1] p-3 text-[14px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">CuÃ¡ndo</span>
          <strong className="text-right text-vyva-text-1">{event.display_time ?? formatDate(event.scheduled_for)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Canal</span>
          <strong className="text-right capitalize text-vyva-text-1">{event.channel}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">RepeticiÃ³n</span>
          <strong className="text-right text-vyva-text-1">{event.recurrence === "none" ? "No se repite" : event.recurrence}</strong>
        </div>
      </div>
    </article>
  );
}

function lastResult(schedule: Schedule, logs: InteractionLog[]) {
  const ownLog = logs.find((log) => log.scheduled_interaction_id === schedule.id || log.interaction_type === schedule.interaction_type);
  if (ownLog?.outcome === "COMPLETED") return "Completado";
  if (ownLog?.outcome === "MISSED") return "Perdido";
  if (ownLog?.outcome === "NO_RESPONSE") return "Sin respuesta";
  if (ownLog?.outcome === "ESCALATED") return "Se pidió ayuda";
  if (schedule.last_result) return schedule.last_result;
  return "Sin actividad todavía";
}

function scheduleSort(schedule: Schedule) {
  const order = { CHECK_IN: 1, BRAIN_COACH: 2, MEDICATION: 3, SYMPTOM_FOLLOWUP: 4, CONCIERGE_FOLLOWUP: 5 };
  return order[schedule.interaction_type] ?? 99;
}

async function readError(response: Response) {
  const body = await response.clone().json().catch(() => null);
  return body?.error ?? "No pudimos guardar el cambio. Inténtalo de nuevo.";
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
      <article className="rounded-[24px] border-2 border-vyva-purple bg-white p-4 shadow-vyva-card">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#F5F0FF] text-vyva-purple">
            <Icon size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[24px] leading-tight text-vyva-text-1">{schedule.friendly_label || readableType(schedule.interaction_type)}</h3>
            <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">{schedule.user_description}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-[13px] font-semibold text-vyva-text-2">
            Frecuencia
            <select
              className="h-12 rounded-[16px] border border-vyva-border bg-white px-3 text-[16px]"
              value={draft.frequency_type}
              onChange={(event) => setDraft({ ...draft, frequency_type: event.target.value as Schedule["frequency_type"] })}
            >
              <option value="DAILY">Cada día</option>
              <option value="WEEKLY">Días concretos</option>
              <option value="CUSTOM">Personalizado</option>
              <option value="ONE_OFF">Una sola vez</option>
            </select>
          </label>

          {(draft.frequency_type === "WEEKLY" || draft.frequency_type === "CUSTOM") && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-vyva-text-2">Días de la semana</p>
              <div className="grid grid-cols-7 gap-2">
                {dayOptions.map((day) => {
                  const selected = draft.days_of_week.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      className={`h-11 rounded-[14px] text-[15px] font-bold ${selected ? "bg-vyva-purple text-white" : "bg-[#F8F3ED] text-vyva-text-2"}`}
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
          )}

          <div>
            <p className="mb-2 text-[13px] font-semibold text-vyva-text-2">Horas</p>
            <div className="grid gap-2">
              {(draft.times_of_day.length ? draft.times_of_day : ["09:00"]).map((time, index) => (
                <div key={`${schedule.id}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    type="time"
                    className="h-12 rounded-[16px] border border-vyva-border bg-white px-3 text-[17px]"
                    value={time}
                    onChange={(event) => {
                      const next = [...(draft.times_of_day.length ? draft.times_of_day : ["09:00"])];
                      next[index] = event.target.value;
                      setDraft({ ...draft, times_of_day: next });
                    }}
                  />
                  <button
                    type="button"
                    className="rounded-[16px] border border-vyva-border px-4 font-bold text-vyva-text-2"
                    onClick={() => setDraft({ ...draft, times_of_day: draft.times_of_day.filter((_, i) => i !== index) })}
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="h-12 rounded-[16px] bg-[#F5F0FF] font-bold text-vyva-purple"
                onClick={() => setDraft({ ...draft, times_of_day: [...draft.times_of_day, "12:00"] })}
              >
                Añadir otra hora
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-[13px] font-semibold text-vyva-text-2">
              Idioma preferido
              <select
                className="h-12 rounded-[16px] border border-vyva-border bg-white px-3 text-[16px]"
                value={draft.preferred_language}
                onChange={(event) => setDraft({ ...draft, preferred_language: event.target.value })}
              >
                {languageOptions.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-[13px] font-semibold text-vyva-text-2">
              Pausar hasta
              <input
                type="date"
                className="h-12 rounded-[16px] border border-vyva-border bg-white px-3 text-[16px]"
                value={draft.pause_until ? draft.pause_until.slice(0, 10) : ""}
                onChange={(event) => setDraft({ ...draft, pause_until: event.target.value ? `${event.target.value}T00:00:00.000Z` : null })}
              />
            </label>
          </div>

          <div className="rounded-[20px] bg-[#FFF9F1] p-3">
            <p className="text-[14px] font-bold text-vyva-text-1">No llamar durante estas horas</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="time"
                className="h-11 rounded-[14px] border border-vyva-border bg-white px-3"
                value={draft.quiet_hours_start}
                onChange={(event) => setDraft({ ...draft, quiet_hours_start: event.target.value })}
              />
              <input
                type="time"
                className="h-11 rounded-[14px] border border-vyva-border bg-white px-3"
                value={draft.quiet_hours_end}
                onChange={(event) => setDraft({ ...draft, quiet_hours_end: event.target.value })}
              />
            </div>
          </div>

          <div className="rounded-[20px] bg-[#F7F2FF] p-3">
            <p className="text-[14px] font-bold text-vyva-text-1">Contacto si necesitamos ayuda</p>
            <div className="mt-2 grid gap-2">
              <input
                className="h-11 rounded-[14px] border border-vyva-border bg-white px-3"
                placeholder="Nombre"
                value={draft.escalation_contacts?.[0]?.name ?? ""}
                onChange={(event) => setDraft({ ...draft, escalation_contacts: [{ ...(draft.escalation_contacts?.[0] ?? {}), name: event.target.value }] })}
              />
              <input
                className="h-11 rounded-[14px] border border-vyva-border bg-white px-3"
                placeholder="Teléfono o email"
                value={draft.escalation_contacts?.[0]?.contact ?? ""}
                onChange={(event) => setDraft({ ...draft, escalation_contacts: [{ ...(draft.escalation_contacts?.[0] ?? {}), contact: event.target.value }] })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button type="button" className="h-12 rounded-[18px] border border-vyva-border font-bold" onClick={onCancel}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              className="h-12 rounded-[18px] bg-vyva-purple font-bold text-white disabled:opacity-60"
              onClick={() => onSave(draft)}
            >
              Guardar
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-vyva-card">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#F5F0FF] text-vyva-purple">
          <Icon size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-[23px] leading-tight text-vyva-text-1">{schedule.friendly_label || readableType(schedule.interaction_type)}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${active ? "bg-[#EAFBF2] text-[#087443]" : "bg-[#F4EAFE] text-vyva-purple"}`}>
              {active ? "Activo" : "Pausado"}
            </span>
          </div>
          <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">{schedule.user_description}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 rounded-[20px] bg-[#FFF9F1] p-3 text-[14px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Frecuencia</span>
          <strong className="text-right text-vyva-text-1">{frequencyLabel(schedule)}</strong>
        </div>
        {schedule.interaction_type === "MEDICATION" && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-vyva-text-2">Medicación</span>
            <strong className="text-right text-vyva-text-1">{medicationName}</strong>
          </div>
        )}
        {schedule.interaction_type === "BRAIN_COACH" && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-vyva-text-2">Tipo de sesión</span>
            <strong className="text-right text-vyva-text-1">{String(schedule.frequency_value?.session_type ?? "Memoria")}</strong>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Próxima llamada</span>
          <strong className="text-right text-vyva-text-1">{formatDate(schedule.next_run_at)}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-vyva-text-2">Último resultado</span>
          <strong className="text-right text-vyva-text-1">{lastResult(schedule, logs)}</strong>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button type="button" className="h-12 rounded-[16px] bg-[#F5F0FF] font-bold text-vyva-purple" onClick={onEdit}>
          Editar horario
        </button>
        {active ? (
          <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-[16px] border border-vyva-border font-bold text-vyva-text-1" onClick={onPause}>
            <Pause size={18} /> Pausar
          </button>
        ) : (
          <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-[16px] border border-vyva-border font-bold text-vyva-text-1" onClick={onResume}>
            <Play size={18} /> Reactivar
          </button>
        )}
      </div>
    </article>
  );
}

export default function ScheduledSupportSettings() {
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
      toast({ title: "Horario guardado", description: "Tu apoyo programado se ha actualizado." });
    },
    onError: (error) => {
      toast({ title: "No pudimos guardar", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
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
      toast({ title: "No pudimos cambiar el estado", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
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
        title: allowed ? "Ayuda permitida" : "Ayuda desactivada",
        description: allowed
          ? "Tu cuidador o el equipo VYVA podrán ayudarte con los horarios."
          : "Solo tú podrás cambiar tus horarios.",
      });
    },
    onError: (error) => {
      toast({ title: "No pudimos guardar el permiso", description: error instanceof Error ? error.message : undefined, variant: "destructive" });
    },
  });

  return (
    <PhoneFrame>
      <div className="flex flex-col gap-4 pb-6">
        <section className="rounded-[26px] bg-[#FFF9F1] p-5 shadow-vyva-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#F5F0FF] text-vyva-purple">
            <CalendarClock size={25} />
          </div>
          <h1 className="mt-4 font-display text-[31px] leading-tight text-vyva-text-1">Mi apoyo programado</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-vyva-text-2">
            Aquí puedes elegir cuándo quieres recibir llamadas, recordatorios y ayuda de VYVA.
          </p>
        </section>

        <section className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-vyva-card">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#EAFBF2] text-[#087443]">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-[23px] text-vyva-text-1">Consentimiento y ayuda del cuidador</h2>
              <p className="mt-1 text-[14px] leading-relaxed text-vyva-text-2">
                Los cambios hechos por un cuidador o por el equipo quedan registrados y puedes revisarlos aquí.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={consentMutation.isPending || schedules.length === 0}
            className={`mt-4 flex min-h-14 w-full items-center justify-between gap-3 rounded-[18px] px-4 text-left text-[15px] font-bold transition ${adminEditAllowed ? "bg-[#EAFBF2] text-[#087443]" : "bg-[#F5F0FF] text-vyva-purple"} disabled:opacity-60`}
            onClick={() => consentMutation.mutate(!adminEditAllowed)}
          >
            <span>Permitir que mi cuidador me ayude a gestionar mis horarios</span>
            <span className="rounded-full bg-white px-3 py-1 text-[12px]">{adminEditAllowed ? "Sí" : "No"}</span>
          </button>
        </section>

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-[24px] leading-tight text-vyva-text-1">PrÃ³ximos eventos</h2>
              <p className="mt-1 text-[14px] text-vyva-text-2">Citas, recordatorios y sesiones puntuales programadas por ti o por VYVA.</p>
            </div>
            <span className="rounded-full bg-[#EEF4FF] px-3 py-1 text-[12px] font-bold text-[#2563EB]">{scheduledEvents.length}</span>
          </div>
          {eventsQuery.isLoading ? (
            <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">Cargando eventos...</div>
          ) : eventsQuery.isError ? (
            <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">
              <p className="font-bold text-vyva-text-1">No pudimos cargar tus eventos.</p>
              <p className="mt-2 text-[14px]">Actualiza la pagina. Si sigue pasando, avisa al equipo VYVA.</p>
            </div>
          ) : scheduledEvents.length === 0 ? (
            <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">No hay eventos puntuales programados.</div>
          ) : (
            scheduledEvents.map((event) => <ScheduledEventCard key={event.id} event={event} />)
          )}
        </section>

        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <h2 className="font-display text-[24px] leading-tight text-vyva-text-1">Apoyo recurrente</h2>
            <p className="mt-1 text-[14px] text-vyva-text-2">Rutinas que VYVA mantiene activas para acompaÃ±arte.</p>
          </div>
          <span className="rounded-full bg-[#F5F0FF] px-3 py-1 text-[12px] font-bold text-vyva-purple">{schedules.length}</span>
        </div>

        {schedulesQuery.isLoading ? (
          <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">Cargando tus horarios...</div>
        ) : schedulesQuery.isError ? (
          <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">
            <p className="font-bold text-vyva-text-1">No pudimos cargar tus horarios.</p>
            <p className="mt-2 text-[14px]">Actualiza la pagina. Si sigue pasando, avisa al equipo VYVA.</p>
          </div>
        ) : schedules.length === 0 ? (
          <div className="rounded-[24px] bg-white p-5 text-center text-vyva-text-2 shadow-vyva-card">Aún no hay apoyo programado.</div>
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

        <section className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-vyva-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#EEF4FF] text-[#2563EB]">
              <History size={22} />
            </div>
            <h2 className="font-display text-[23px] text-vyva-text-1">Historial de actividad</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {logs.slice(0, 5).length === 0 ? (
              <p className="rounded-[18px] bg-[#FFF9F1] p-3 text-[14px] text-vyva-text-2">Todavía no hay llamadas o recordatorios completados.</p>
            ) : logs.slice(0, 5).map((log) => (
              <div key={log.id} className="rounded-[18px] bg-[#FFF9F1] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-vyva-text-1">{readableType(log.interaction_type as Schedule["interaction_type"])}</span>
                  <span className="text-[12px] text-vyva-text-2">{formatDate(log.completed_at ?? log.scheduled_for ?? log.created_at)}</span>
                </div>
                <p className="mt-1 text-[13px] text-vyva-text-2">Resultado: {lastResult({ id: "", interaction_type: log.interaction_type as Schedule["interaction_type"], status: "ACTIVE", frequency_type: "DAILY", frequency_value: {}, days_of_week: [], times_of_day: [], timezone: "Europe/Madrid", preferred_language: "es", quiet_hours_start: "21:00", quiet_hours_end: "08:00", is_paused: false, admin_edit_allowed: false }, [log])}</p>
                {log.summary ? <p className="mt-1 text-[13px] text-vyva-text-2">{log.summary}</p> : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-vyva-border bg-white p-4 shadow-vyva-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#F5F0FF] text-vyva-purple">
              <Clock size={22} />
            </div>
            <h2 className="font-display text-[23px] text-vyva-text-1">Cambios recientes</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {(auditQuery.data?.logs ?? []).slice(0, 4).length === 0 ? (
              <p className="rounded-[18px] bg-[#FFF9F1] p-3 text-[14px] text-vyva-text-2">No hay cambios recientes en permisos u horarios.</p>
            ) : (auditQuery.data?.logs ?? []).slice(0, 4).map((log) => (
              <div key={log.id} className="flex items-center gap-2 rounded-[18px] bg-[#FFF9F1] p-3 text-[13px] text-vyva-text-2">
                <CheckCircle2 size={16} className="text-[#087443]" />
                <span>{log.changed_by_role === "elder" ? "Cambio hecho por ti" : "Cambio hecho con permiso"} - {formatDate(log.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PhoneFrame>
  );
}
