import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BookmarkCheck,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  MapPin,
  Monitor,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import type {
  ParticipationEvent,
  ParticipationEventRecommendation,
  ParticipationEventResponseAction,
  ParticipationPulse,
  SocialLanguage,
} from "./types";

type PulseResponse = {
  pulse: ParticipationPulse;
};

type RespondInput = {
  eventId: string;
  response: ParticipationEventResponseAction;
};

type CuratedEventsVariant = "activities" | "participate";
type EventFilter = "for_you" | "nearby" | "online" | "saved";

type CuratedEventsExperienceProps = {
  variant?: CuratedEventsVariant;
  afterEvents?: ReactNode;
};

function participationLanguage(language?: string | null): SocialLanguage {
  const base = language?.split("-")[0]?.toLowerCase();
  if (base === "es" || base === "de") return base;
  return "en";
}

const copyByLanguage: Record<SocialLanguage, {
  back: string;
  loading: string;
  error: string;
  activitiesHeadline: string;
  featured: string;
  forYou: string;
  nearby: string;
  online: string;
  saved: string;
  savedTitle: string;
  savedEmpty: string;
  interested: string;
  maybe: string;
  notForMe: string;
  askVyva: string;
  interestedSaved: string;
  maybeSaved: string;
  notForMeSaved: string;
  checkRequested: string;
  profileReason: (items: string) => string;
  secondaryTitle: string;
  nearbyTitle: string;
  onlineTitle: string;
  savedFilterTitle: string;
  emptyFilter: string;
  inPerson: string;
  hybrid: string;
  dateTbc: string;
  confirmFirst: string;
  timingDetail: string;
  timingToConfirm: string;
  frequencyDetail: string;
  oneOffTaster: string;
  recurringOption: string;
  oneGentleSession: string;
  whereDetail: string;
  costDetail: string;
  comfortIncluded: string;
  seatedOption: string;
  noPaymentNow: string;
  costChecked: string;
  vyvaChecksAccess: string;
  detailsApproved: string;
  socialProofTitle: string;
  socialGoing: (names: string[]) => string;
  responseCounts: (interested: number, maybe: number) => string;
}> = {
  es: {
    back: "Volver",
    loading: "Preparando actividades...",
    error: "No se pudieron cargar las actividades. Intentalo de nuevo.",
    activitiesHeadline: "Para ti",
    featured: "Sugerido",
    forYou: "Para ti",
    nearby: "Cerca",
    online: "Online",
    saved: "Guardado",
    savedTitle: "Guardado",
    savedEmpty: "Tus opciones guardadas apareceran aqui.",
    interested: "Me interesa",
    maybe: "Quizas luego",
    notForMe: "No es para mi",
    askVyva: "Comprobar detalles",
    interestedSaved: "Interes guardado",
    maybeSaved: "Guardado para luego",
    notForMeSaved: "No se mostrara primero",
    checkRequested: "Comprobacion pedida",
    profileReason: (items) => `Porque encaja con ${items}.`,
    secondaryTitle: "Mas",
    nearbyTitle: "Cerca",
    onlineTitle: "Online",
    savedFilterTitle: "Guardado",
    emptyFilter: "No hay opciones aqui todavia.",
    inPerson: "En persona",
    hybrid: "Ambos",
    dateTbc: "Fecha por confirmar",
    confirmFirst: "Tu confirmas primero",
    timingDetail: "Cuando",
    timingToConfirm: "Horario por confirmar",
    frequencyDetail: "Cada cuanto",
    oneOffTaster: "Sesion de prueba",
    recurringOption: "Opcion recurrente",
    oneGentleSession: "Una sesion tranquila",
    whereDetail: "Lugar",
    costDetail: "Coste",
    comfortIncluded: "Comodidad incluida",
    seatedOption: "Con asiento",
    noPaymentNow: "Sin pago ahora",
    costChecked: "Coste comprobado",
    vyvaChecksAccess: "VYVA revisa acceso",
    detailsApproved: "Detalles aprobados",
    socialProofTitle: "Caras conocidas",
    socialGoing: (names) => `${names[0]}, ${names[1]} y ${names[2]} tambien van`,
    responseCounts: (interested, maybe) => `${interested} interesados - ${maybe} quizas`,
  },
  de: {
    back: "Zurueck",
    loading: "Aktivitaeten werden vorbereitet...",
    error: "Aktivitaeten konnten nicht geladen werden. Bitte versuche es erneut.",
    activitiesHeadline: "Fuer dich",
    featured: "Vorschlag",
    forYou: "Fuer dich",
    nearby: "In der Naehe",
    online: "Online",
    saved: "Gespeichert",
    savedTitle: "Gespeichert",
    savedEmpty: "Gespeicherte Optionen erscheinen hier.",
    interested: "Interesse",
    maybe: "Vielleicht spaeter",
    notForMe: "Nicht fuer mich",
    askVyva: "Details pruefen",
    interestedSaved: "Interesse gespeichert",
    maybeSaved: "Fuer spaeter gespeichert",
    notForMeSaved: "Wird nicht zuerst gezeigt",
    checkRequested: "Pruefung angefragt",
    profileReason: (items) => `Passt zu ${items}.`,
    secondaryTitle: "Mehr",
    nearbyTitle: "In der Naehe",
    onlineTitle: "Online",
    savedFilterTitle: "Gespeichert",
    emptyFilter: "Hier gibt es noch keine Optionen.",
    inPerson: "Vor Ort",
    hybrid: "Beides",
    dateTbc: "Datum offen",
    confirmFirst: "Du bestaetigst zuerst",
    timingDetail: "Wann",
    timingToConfirm: "Zeit wird geprueft",
    frequencyDetail: "Wie oft",
    oneOffTaster: "Einmalige Probe",
    recurringOption: "Wiederkehrende Option",
    oneGentleSession: "Eine ruhige Einheit",
    whereDetail: "Ort",
    costDetail: "Kosten",
    comfortIncluded: "Komfort dabei",
    seatedOption: "Sitzplatz",
    noPaymentNow: "Keine Zahlung jetzt",
    costChecked: "Kosten geprueft",
    vyvaChecksAccess: "VYVA prueft Zugang",
    detailsApproved: "Details geprueft",
    socialProofTitle: "Bekannte Gesichter",
    socialGoing: (names) => `${names[0]}, ${names[1]} und ${names[2]} gehen auch hin`,
    responseCounts: (interested, maybe) => `${interested} interessiert - ${maybe} vielleicht`,
  },
  en: {
    back: "Back",
    loading: "Preparing activities...",
    error: "Activities could not load. Please try again.",
    activitiesHeadline: "For you",
    featured: "Suggested",
    forYou: "For you",
    nearby: "Nearby",
    online: "Online",
    saved: "Saved",
    savedTitle: "Saved",
    savedEmpty: "Saved options will appear here.",
    interested: "I'm interested",
    maybe: "Maybe later",
    notForMe: "Not for me",
    askVyva: "Check details",
    interestedSaved: "Interest saved",
    maybeSaved: "Saved for later",
    notForMeSaved: "This will not be shown first",
    checkRequested: "Check requested",
    profileReason: (items) => `Because you like ${items}.`,
    secondaryTitle: "More",
    nearbyTitle: "Nearby",
    onlineTitle: "Online",
    savedFilterTitle: "Saved",
    emptyFilter: "No options here yet.",
    inPerson: "In person",
    hybrid: "Both",
    dateTbc: "Date TBC",
    confirmFirst: "You confirm first",
    timingDetail: "When",
    timingToConfirm: "Timing to confirm",
    frequencyDetail: "How often",
    oneOffTaster: "One-off taster",
    recurringOption: "Recurring option",
    oneGentleSession: "One gentle session",
    whereDetail: "Where",
    costDetail: "Cost",
    comfortIncluded: "Comfort included",
    seatedOption: "Seated option",
    noPaymentNow: "No payment now",
    costChecked: "Cost checked",
    vyvaChecksAccess: "VYVA checks access",
    detailsApproved: "Details approved",
    socialProofTitle: "Friendly faces",
    socialGoing: (names) => `${names[0]} from Music Room, ${names[1]} and ${names[2]} are going too`,
    responseCounts: (interested, maybe) => `${interested} interested - ${maybe} maybe`,
  },
};

const SOCIAL_GOING_NAMES = ["Martha", "Layla", "Ali"] as const;

type ParticipateCopy = (typeof copyByLanguage)[SocialLanguage];

function uniqueEvents<T extends ParticipationEvent>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function updateEventChoice(
  pulse: ParticipationPulse,
  eventId: string,
  response: ParticipationEventResponseAction,
): ParticipationPulse {
  const myResponse = response === "clear" ? null : response;
  const updateEvent = <T extends ParticipationEvent>(event: T): T => {
    if (event.id !== eventId) return event;
    return { ...event, myResponse } as T;
  };
  const featuredEvent = updateEvent(pulse.featuredEvent);
  const recommendations = pulse.recommendations.map(updateEvent);
  const savedEvents = uniqueEvents([
    featuredEvent,
    ...recommendations,
    ...pulse.savedEvents.map(updateEvent),
  ]).filter((event) => event.myResponse === "interested" || event.myResponse === "maybe");

  return {
    ...pulse,
    featuredEvent,
    recommendations,
    savedEvents,
  };
}

function responseLabel(event: ParticipationEvent, copy: ParticipateCopy) {
  if (event.myResponse === "interested") return copy.interestedSaved;
  if (event.myResponse === "maybe") return copy.maybeSaved;
  if (event.myResponse === "not_for_me") return copy.notForMeSaved;
  if (event.checkStatus === "requested") return copy.checkRequested;
  return "";
}

function eventDateLabel(event: ParticipationEvent, copy: ParticipateCopy, language: SocialLanguage) {
  if (!event.startsAt) return copy.dateTbc;

  const date = new Date(event.startsAt);
  if (Number.isNaN(date.getTime())) return copy.dateTbc;

  return new Intl.DateTimeFormat(language, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function eventTimingFact(event: ParticipationEvent, copy: ParticipateCopy, language: SocialLanguage) {
  const dateLabel = eventDateLabel(event, copy, language);

  if (!event.startsAt) {
    return {
      label: event.timeLabel || copy.timingToConfirm,
      detail: copy.timingDetail,
    };
  }

  return {
    label: dateLabel,
    detail: event.timeLabel && event.timeLabel !== dateLabel ? event.timeLabel : copy.timingDetail,
  };
}

function eventFrequencyLabel(event: ParticipationEvent, copy: ParticipateCopy) {
  const text = `${event.title} ${event.summary} ${event.timeLabel} ${event.tags.join(" ")}`.toLowerCase();

  if (text.includes("taster")) return copy.oneOffTaster;
  if (
    text.includes("weekly")
    || text.includes("every ")
    || text.includes("each ")
    || text.includes("cada ")
    || text.includes("seman")
    || text.includes("woch")
  ) {
    return copy.recurringOption;
  }

  return copy.oneGentleSession;
}

function readableList(items: string[], language: SocialLanguage) {
  try {
    return new Intl.ListFormat(language, { style: "long", type: "conjunction" }).format(items);
  } catch {
    if (items.length <= 2) return items.join(" and ");
    return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  }
}

function profileReasonLine(pulse: ParticipationPulse, copy: ParticipateCopy, language: SocialLanguage) {
  const items = [
    ...pulse.profileSignals.interests.slice(0, 2),
    pulse.profileSignals.preferredTimes[0] ? `${pulse.profileSignals.preferredTimes[0]} plans` : "",
  ].filter(Boolean);

  if (items.length === 0) return pulse.reassurance;
  return copy.profileReason(readableList(items, language));
}

function confidenceItems(event: ParticipationEvent, copy: ParticipateCopy) {
  const hasSeating = event.accessibilityTags.some((tag) => tag.toLowerCase().includes("seat"));
  const costLooksOpen = /free|gratis|kostenlos/i.test(event.costLabel);

  return [
    hasSeating ? copy.seatedOption : copy.comfortIncluded,
    costLooksOpen ? copy.noPaymentNow : copy.costChecked,
    event.needsLiveCheck ? copy.vyvaChecksAccess : copy.detailsApproved,
  ];
}

function EventFact({
  icon: Icon,
  label,
  detail,
}: {
  icon: typeof Sparkles;
  label: string;
  detail?: string;
}) {
  return (
    <span className="flex min-h-[54px] items-center gap-2 rounded-[16px] border border-[#E5DED3] bg-[#FFFCF8] px-3">
      <Icon size={17} strokeWidth={2.4} className="shrink-0 text-[#0F766E]" />
      <span className="min-w-0">
        <span className="block truncate font-body text-[13px] font-black leading-tight text-vyva-text-1">{label}</span>
        {detail ? (
          <span className="mt-0.5 block truncate font-body text-[12px] font-bold leading-tight text-vyva-text-3">
            {detail}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function ConfidenceStrip({ event, copy }: { event: ParticipationEvent; copy: ParticipateCopy }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid={`event-confidence-${event.id}`}>
      {confidenceItems(event, copy).map((item) => (
        <span
          key={`${event.id}-${item}`}
          className="inline-flex min-h-[30px] items-center gap-1.5 rounded-full border border-[#DDEBDD] bg-[#F8FCF8] px-3 font-body text-[12px] font-black text-[#31534A]"
        >
          <CheckCircle2 size={14} strokeWidth={2.5} className="text-[#0F766E]" aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

function SocialProofStrip({ event, copy }: { event: ParticipationEvent; copy: ParticipateCopy }) {
  const names = [...SOCIAL_GOING_NAMES];

  return (
    <div
      className="mt-3 flex flex-col gap-2 rounded-[18px] border border-[#CDE9D8] bg-[#F4FFF9] px-3 py-2.5 sm:flex-row sm:items-center"
      data-testid={`event-social-proof-${event.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 font-body text-[11px] font-black uppercase tracking-[0.08em] text-[#0F766E] shadow-sm">
          <UsersRound size={14} strokeWidth={2.5} aria-hidden="true" />
          {copy.socialProofTitle}
        </span>
        <span className="flex -space-x-2" aria-hidden="true">
          {names.map((name, index) => (
            <span
              key={`${event.id}-${name}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white font-body text-[12px] font-black text-white shadow-sm"
              style={{ background: ["#0F766E", "#7C3AED", "#C9890A"][index] }}
            >
              {name.slice(0, 1)}
            </span>
          ))}
        </span>
      </div>
      <span className="min-w-0 flex-1 font-body text-[13px] font-black leading-snug text-[#27463F] sm:pl-1">
        {copy.socialGoing(names)}
      </span>
    </div>
  );
}

function EventActionButton({
  children,
  onClick,
  tone,
  active = false,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  tone: "primary" | "green" | "blue" | "plain" | "rose";
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const tones = {
    primary: "border-[#047857] bg-[#047857] text-white shadow-[0_12px_24px_rgba(4,120,87,0.2)]",
    green: active ? "border-[#047857] bg-[#047857] text-white" : "border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]",
    blue: active ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]",
    rose: active ? "border-[#BE123C] bg-[#BE123C] text-white" : "border-[#FECDD3] bg-[#FFF1F2] text-[#BE123C]",
    plain: "border-[#E5DED3] bg-white text-vyva-text-1",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`vyva-tap flex min-h-[46px] items-center justify-center rounded-[16px] border px-3 font-body text-[14px] font-black leading-tight shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${tones} ${className}`}
    >
      {children}
    </button>
  );
}

function EventTextAction({
  children,
  onClick,
  active,
  disabled,
  tone = "plain",
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "plain" | "rose";
}) {
  const activeClass = tone === "rose"
    ? "bg-[#FFF1F2] text-[#BE123C]"
    : "bg-[#F5F3FF] text-[#6B21A8]";
  const inactiveClass = tone === "rose"
    ? "text-[#9F1239] hover:bg-[#FFF1F2]"
    : "text-[#4B5563] hover:bg-[#F8FAFC]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`vyva-tap inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-3 font-body text-[13px] font-black transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? activeClass : inactiveClass
      }`}
    >
      {children}
    </button>
  );
}

function EventPanel({
  event,
  copy,
  language,
  testIdPrefix,
  featured = false,
  onRespond,
  onAskVyva,
  pending = false,
}: {
  event: ParticipationEventRecommendation | ParticipationEvent;
  copy: ParticipateCopy;
  language: SocialLanguage;
  testIdPrefix: string;
  featured?: boolean;
  onRespond: (eventId: string, response: ParticipationEventResponseAction) => void;
  onAskVyva: (eventId: string) => void;
  pending?: boolean;
}) {
  const statusLabel = responseLabel(event, copy);
  const timingFact = eventTimingFact(event, copy, language);
  const frequencyLabel = eventFrequencyLabel(event, copy);
  const placeIcon = event.format === "online" ? Monitor : event.format === "hybrid" ? Sparkles : MapPin;
  const visibleFitReasons = event.fitReasons
    .filter((reason) => !reason.label.toLowerCase().includes("online"))
    .slice(0, 2);

  return (
    <article
      className={`rounded-[22px] border bg-white p-4 shadow-[0_10px_26px_rgba(52,42,30,0.07)] ${featured ? "border-[#B7E4D2]" : "border-[#E8DED4]"}`}
      data-testid={featured ? `${testIdPrefix}-featured-event` : `${testIdPrefix}-event-${event.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-body text-[11px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
            {featured ? copy.featured : copy.forYou}
          </p>
          <h2 className="mt-1.5 font-body text-[24px] font-black leading-tight text-vyva-text-1">
            {event.title}
          </h2>
          <p className="mt-1.5 max-w-[42rem] font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
            {event.summary}
          </p>
        </div>
        {statusLabel ? (
          <span className="inline-flex min-h-[34px] items-center rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-[#6B21A8]">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <EventFact icon={Clock3} label={timingFact.label} detail={timingFact.detail} />
        <EventFact icon={CalendarCheck} label={frequencyLabel} detail={copy.frequencyDetail} />
        <EventFact icon={placeIcon} label={event.locationLabel} detail={copy.whereDetail} />
        <EventFact icon={ShieldCheck} label={event.costLabel} detail={copy.costDetail} />
      </div>

      <SocialProofStrip event={event} copy={copy} />
      <ConfidenceStrip event={event} copy={copy} />

      {visibleFitReasons.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {visibleFitReasons.map((reason) => (
            <span
              key={`${event.id}-${reason.id}-${reason.label}`}
              className="rounded-full bg-[#F8FAF8] px-3 py-1.5 font-body text-[12px] font-bold text-[#50635E]"
            >
              {reason.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <EventActionButton
          tone="primary"
          active={event.myResponse === "interested"}
          disabled={pending}
          className="lg:min-w-[190px] lg:flex-none"
          onClick={() => onRespond(event.id, event.myResponse === "interested" ? "clear" : "interested")}
        >
          <CheckCircle2 size={18} className="mr-2" />
          {copy.interested}
        </EventActionButton>
        <EventActionButton
          tone="plain"
          disabled={pending}
          className="lg:min-w-[170px] lg:flex-none"
          onClick={() => onAskVyva(event.id)}
        >
          <Sparkles size={18} className="mr-2 text-[#6B21A8]" />
          {copy.askVyva}
        </EventActionButton>
        <div className="flex flex-wrap gap-2">
          <EventTextAction
            active={event.myResponse === "maybe"}
            disabled={pending}
            onClick={() => onRespond(event.id, event.myResponse === "maybe" ? "clear" : "maybe")}
          >
            <CalendarCheck size={16} />
            {copy.maybe}
          </EventTextAction>
          <EventTextAction
            tone="rose"
            active={event.myResponse === "not_for_me"}
            disabled={pending}
            onClick={() => onRespond(event.id, event.myResponse === "not_for_me" ? "clear" : "not_for_me")}
          >
            <ThumbsDown size={15} />
            {copy.notForMe}
          </EventTextAction>
        </div>
      </div>
    </article>
  );
}

function filterMatches(event: ParticipationEvent, filter: EventFilter) {
  if (filter === "nearby") return event.format === "nearby" || event.format === "hybrid";
  if (filter === "online") return event.format === "online" || event.format === "hybrid";
  return true;
}

function FilterButton({
  active,
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  active: boolean;
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={`vyva-tap inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 font-body text-[14px] font-black shadow-sm transition active:scale-[0.98] ${
        active
          ? "border-[#0F766E] bg-[#0F766E] text-white"
          : "border-[#DDE8DD] bg-white text-[#2F4A44]"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

export default function CuratedEventsExperience({
  variant = "participate",
  afterEvents,
}: CuratedEventsExperienceProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language: appLanguage } = useLanguage();
  const language = participationLanguage(appLanguage);
  const copy = copyByLanguage[language];
  const queryKey = [`/api/social/participate/pulse?lang=${language}`] as const;
  const testIdPrefix = variant === "activities" ? "activities" : "participate";
  const [activeFilter, setActiveFilter] = useState<EventFilter>("for_you");

  const { data, isLoading, isError } = useQuery<PulseResponse>({ queryKey });
  const pulse = data?.pulse;

  const respondMutation = useMutation({
    mutationFn: async ({ eventId, response }: RespondInput) => {
      const res = await apiFetch(`/api/social/participate/events/${eventId}/respond`, {
        method: "POST",
        body: JSON.stringify({ response, lang: language }),
      });
      if (!res.ok) throw new Error("Could not save response");
      return res.json();
    },
    onMutate: async ({ eventId, response }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PulseResponse>(queryKey);
      if (previous?.pulse) {
        queryClient.setQueryData<PulseResponse>(queryKey, {
          pulse: updateEventChoice(previous.pulse, eventId, response),
        });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const askVyvaMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiFetch(`/api/social/participate/events/${eventId}/ask-vyva`, {
        method: "POST",
        body: JSON.stringify({ lang: language }),
      });
      if (!res.ok) throw new Error("Could not ask VYVA to check");
      return res.json() as Promise<{ conciergePrefill: unknown }>;
    },
    onSuccess: (payload) => {
      void queryClient.invalidateQueries({ queryKey });
      navigate("/concierge", {
        state: {
          conciergePrefill: payload.conciergePrefill,
        },
      });
    },
  });

  const filteredRecommendations = useMemo(() => {
    if (!pulse) return [];
    if (activeFilter === "for_you") return pulse.recommendations;
    if (activeFilter === "saved") return pulse.savedEvents;

    const allEvents = uniqueEvents([pulse.featuredEvent, ...pulse.recommendations]);
    return allEvents
      .filter((event) => event.id !== pulse.featuredEvent.id)
      .filter((event) => filterMatches(event, activeFilter));
  }, [activeFilter, pulse]);

  if (isLoading) {
    return (
      <main className="vyva-page flex min-h-[60vh] items-center justify-center">
        <p className="font-body text-[17px] font-bold text-vyva-text-2">{copy.loading}</p>
      </main>
    );
  }

  if (isError || !pulse) {
    return (
      <main className="vyva-page">
        {variant === "participate" ? (
          <button
            type="button"
            onClick={() => navigate("/social-rooms")}
            className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={18} />
            {copy.back}
          </button>
        ) : null}
        <section className="rounded-[24px] border border-[#FECACA] bg-[#FEF2F2] p-5">
          <p className="font-body text-[16px] font-bold text-[#991B1B]">{copy.error}</p>
        </section>
      </main>
    );
  }

  const pending = respondMutation.isPending || askVyvaMutation.isPending;
  const filteredTitle = activeFilter === "nearby"
    ? copy.nearbyTitle
    : activeFilter === "online"
      ? copy.onlineTitle
      : activeFilter === "saved"
        ? copy.savedFilterTitle
        : copy.secondaryTitle;

  return (
    <main className="vyva-page pb-[120px]" data-testid={`${testIdPrefix}-screen`}>
      {variant === "participate" ? (
        <button
          type="button"
          onClick={() => navigate("/social-rooms")}
          className="vyva-tap mb-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-body text-[15px] font-black text-vyva-text-1 shadow-sm"
        >
          <ArrowLeft size={18} />
          {copy.back}
        </button>
      ) : null}

      <section className="px-1 py-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-[26px] font-semibold leading-[0.98] text-[#223B35] sm:text-[28px]">
              {copy.activitiesHeadline}
            </h1>
            <p className="mt-1 hidden max-w-[42rem] font-body text-[13px] font-bold leading-snug text-[#526B63] sm:block sm:text-[14px]">
              {profileReasonLine(pulse, copy, language)}
            </p>
          </div>
          <div className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full border border-[#CDE9D8] bg-white px-2.5 shadow-sm">
            <ShieldCheck size={14} className="shrink-0 text-[#0F766E]" />
            <p className="whitespace-nowrap font-body text-[11px] font-black leading-tight text-[#0F766E] sm:text-[12px]">
              {copy.confirmFirst}
            </p>
          </div>
        </div>

      </section>

      {pulse.emptyProfileNudge ? (
        <section className="mt-4 rounded-[22px] border border-[#F8D97B] bg-[#FFFBEB] p-4" data-testid={`${testIdPrefix}-profile-nudge`}>
          <p className="font-body text-[17px] font-black text-[#6B4A00]">{pulse.emptyProfileNudge.title}</p>
          <p className="mt-1 font-body text-[14px] font-bold leading-relaxed text-[#80621A]">{pulse.emptyProfileNudge.body}</p>
          <button
            type="button"
            onClick={() => navigate(pulse.emptyProfileNudge?.path ?? "/onboarding/profile/hobbies")}
            className="vyva-tap mt-3 min-h-[46px] rounded-full bg-[#B45309] px-5 font-body text-[14px] font-black text-white"
          >
            {pulse.emptyProfileNudge.actionLabel}
          </button>
        </section>
      ) : null}

      <div className="mt-3">
        <EventPanel
          event={pulse.featuredEvent}
          copy={copy}
          language={language}
          testIdPrefix={testIdPrefix}
          featured
          pending={pending}
          onRespond={(eventId, response) => respondMutation.mutate({ eventId, response })}
          onAskVyva={(eventId) => askVyvaMutation.mutate(eventId)}
        />
      </div>

      <section className="mt-5" data-testid={`${testIdPrefix}-filters`}>
        <div className="flex flex-wrap gap-2">
          <FilterButton
            active={activeFilter === "for_you"}
            icon={Sparkles}
            label={copy.forYou}
            testId={`${testIdPrefix}-filter-for-you`}
            onClick={() => setActiveFilter("for_you")}
          />
          <FilterButton
            active={activeFilter === "nearby"}
            icon={MapPin}
            label={copy.nearby}
            testId={`${testIdPrefix}-filter-nearby`}
            onClick={() => setActiveFilter("nearby")}
          />
          <FilterButton
            active={activeFilter === "online"}
            icon={Monitor}
            label={copy.online}
            testId={`${testIdPrefix}-filter-online`}
            onClick={() => setActiveFilter("online")}
          />
          <FilterButton
            active={activeFilter === "saved"}
            icon={BookmarkCheck}
            label={copy.saved}
            testId={`${testIdPrefix}-filter-saved`}
            onClick={() => setActiveFilter("saved")}
          />
        </div>
      </section>

      <section className="mt-6" data-testid={`${testIdPrefix}-more-recommendations`}>
        <h2 className="mb-3 font-body text-[22px] font-black text-vyva-text-1">{filteredTitle}</h2>
        {filteredRecommendations.length > 0 ? (
          <div className="grid gap-4">
            {filteredRecommendations.map((event) => (
              <EventPanel
                key={event.id}
                event={event}
                copy={copy}
                language={language}
                testIdPrefix={testIdPrefix}
                pending={pending}
                onRespond={(eventId, response) => respondMutation.mutate({ eventId, response })}
                onAskVyva={(eventId) => askVyvaMutation.mutate(eventId)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-[20px] border border-[#E8DED4] bg-white p-4 font-body text-[15px] font-bold text-vyva-text-2">
            {copy.emptyFilter}
          </p>
        )}
      </section>

      {activeFilter !== "saved" ? (
        <section className="mt-6 rounded-[24px] border border-[#E8DED4] bg-[#FFFCF8] p-5" data-testid={`${testIdPrefix}-saved-events`}>
          <h2 className="font-body text-[21px] font-black text-vyva-text-1">{copy.savedTitle}</h2>
          {pulse.savedEvents.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {pulse.savedEvents.map((event) => (
                <div key={`saved-${event.id}`} className="rounded-[18px] border border-[#E5DED3] bg-white px-4 py-3">
                  <p className="font-body text-[16px] font-black text-vyva-text-1">{event.title}</p>
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-2">{responseLabel(event, copy)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 font-body text-[14px] font-bold text-vyva-text-2">{copy.savedEmpty}</p>
          )}
        </section>
      ) : null}

      {afterEvents}
    </main>
  );
}
