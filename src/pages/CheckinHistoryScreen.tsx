import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, CalendarDays, Car, Check, ClipboardList, Compass, HeartPulse, Loader2, Mail, PhoneCall, Share2, ShoppingBasket, Sparkles, Stethoscope, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/contexts/ProfileContext";
import { sanitizePhoneHref } from "@/lib/emergencyContacts";
import { checkinActionNavigationFor, type CheckinActionNavigation } from "./CheckHowIFeelScreen";
import { useLanguage } from "@/i18n";

type CheckinHistoryReport = {
  id: string;
  completed_at: string;
  energy_level: number | null;
  mood: string | null;
  sleep_quality: string | null;
  symptoms: string[];
  social_contact: string | null;
  feeling_label: string | null;
  overall_state: "excellent" | "good" | "moderate" | "tired" | "low" | null;
  vyva_reading: string | null;
  right_now: string[];
  today_actions: string[];
  highlight: string | null;
  flag_caregiver: boolean;
  watch_for: string | null;
  language: string | null;
};

type CheckinHistoryResponse = {
  reports: CheckinHistoryReport[];
};

type SavedCheckinServiceAction = {
  key: "call_gp" | "email_gp" | "care" | "appointment" | "ride" | "order" | "quote" | "symptom" | "vitals" | "concierge";
  title: string;
  to: string;
  href?: string;
};

const stateStyle: Record<string, { bg: string; text: string; label: string }> = {
  excellent: { bg: "#FFFBEB", text: "#92400E", label: "Muy bien" },
  good: { bg: "#ECFDF5", text: "#047857", label: "Estable" },
  moderate: { bg: "#F5F3FF", text: "#6B21A8", label: "Atención suave" },
  tired: { bg: "#EFF6FF", text: "#1D4ED8", label: "Cansancio" },
  low: { bg: "#FEF2F2", text: "#B91C1C", label: "Cuidar de cerca" },
};

function formatDate(value: string, language = "es") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shareText(report: CheckinHistoryReport, name: string) {
  return [
    name ? `Lectura VYVA para ${name}` : "Lectura VYVA",
    formatDate(report.completed_at, report.language ?? "es"),
    "",
    report.feeling_label ?? "Check-in de bienestar",
    report.vyva_reading ?? "",
    report.highlight ? `Lo importante: ${report.highlight}` : "",
    report.today_actions?.length ? "\nPara hoy:" : "",
    ...(report.today_actions ?? []).slice(0, 3).map((item) => `- ${item}`),
    report.watch_for ? `\nTen en cuenta: ${report.watch_for}` : "",
  ].filter(Boolean).join("\n");
}

function normalizeActionText(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function savedCheckinServiceActionsFor(report: CheckinHistoryReport): SavedCheckinServiceAction[] {
  const text = normalizeActionText([
    report.highlight ?? "",
    report.watch_for ?? "",
    ...(report.today_actions ?? []),
    ...(report.right_now ?? []),
  ].join(" "));
  const actions: SavedCheckinServiceAction[] = [];
  const add = (action: SavedCheckinServiceAction) => {
    if (!actions.some((item) => item.key === action.key)) actions.push(action);
  };

  const needsCare = /\b(medica|medico|doctor|urgente|emergencia|pecho|falta de aire|confusion|seek medical|medical attention|doctor|urgent)\b/.test(text);
  if (needsCare) {
    add({ key: "care", title: "Hablar con doctor", to: "/health/doctor" });
    add({ key: "appointment", title: "Pedir cita", to: "/concierge" });
    add({ key: "ride", title: "Organizar transporte", to: "/concierge" });
  }
  if (/\b(sintoma|symptom|empeora|worsen|dolor|mareo|fiebre|nausea|preocupa|worries)\b/.test(text)) {
    add({ key: "symptom", title: "Chequear sintomas", to: "/health/symptom-check" });
  }
  if (/\b(signos|vital|pulso|respiracion|presion|oxygen|heart rate|vitals)\b/.test(text)) {
    add({ key: "vitals", title: "Tomar signos", to: "/health/vitals" });
  }
  if (/\b(hidrata|agua|liquidos|electrolitos|farmacia|entrega|compra|pedido|domicilio|hydrat|water|fluids|electrolyte|pharmacy|delivery|groceries|order)\b/.test(text)) {
    add({ key: "order", title: "Pedir entrega", to: "/concierge/shopping" });
  }
  if (/\b(acompan|no estar solo|no estes solo|ayuda en casa|apoyo en casa|cuidador|cuidadora|presupuesto|someone stay|stay with you|not be alone|home care|home help|support at home|companion|quote)\b/.test(text)) {
    add({ key: "quote", title: "Pedir ayuda en casa", to: "/concierge" });
  }
  if (!needsCare && /\b(concierge|para ti hoy|salida|cerca|adaptad|transporte|cita|compania|company|appointment|ride|nearby)\b/.test(text)) {
    add({ key: "concierge", title: "Preparar ayuda", to: "/concierge" });
  }

  return actions;
}

export function savedCheckinActionsWithGpContact(
  actions: SavedCheckinServiceAction[],
  profile: { gpName?: string | null; gpPhone?: string | null; gpEmail?: string | null } | null | undefined,
  report: CheckinHistoryReport,
  name: string,
): SavedCheckinServiceAction[] {
  const hasCareNeed = actions.some((action) => ["care", "appointment", "ride"].includes(action.key));
  if (!hasCareNeed) return actions;

  const gpPhoneHref = sanitizePhoneHref(profile?.gpPhone);
  const gpEmail = profile?.gpEmail?.trim() ?? "";
  if (!gpPhoneHref && !gpEmail) return actions;

  const isEnglish = (report.language ?? "").toLowerCase().startsWith("en");
  const gpName = profile?.gpName?.trim() || (isEnglish ? "GP" : "medico");
  const context = shareText(report, name);
  const directActions: SavedCheckinServiceAction[] = [];

  if (gpPhoneHref) {
    directActions.push({
      key: "call_gp",
      title: isEnglish ? `Call ${gpName}` : `Llamar a ${gpName}`,
      to: "",
      href: gpPhoneHref,
    });
  }

  if (gpEmail) {
    directActions.push({
      key: "email_gp",
      title: isEnglish ? "Email GP" : "Email medico",
      to: "",
      href: `mailto:${gpEmail}?subject=${encodeURIComponent("VYVA saved check-in")}&body=${encodeURIComponent(context)}`,
    });
  }

  return [...directActions, ...actions];
}

export function savedCheckinNavigationFor(report: CheckinHistoryReport, name: string, action: SavedCheckinServiceAction): CheckinActionNavigation {
  const symptomClue = [
    report.watch_for ?? "",
    report.highlight ?? "",
    ...(report.right_now ?? []),
  ].filter(Boolean).slice(0, 3).join(". ");
  const conciergeMessage = `Ayudame a preparar el siguiente paso practico para este check-in guardado de ${name || "la persona"}: ${report.highlight ?? report.feeling_label ?? "bienestar"}. Acciones sugeridas: ${(report.today_actions ?? []).slice(0, 3).join("; ")}. Pideme confirmar antes de reservar, llamar o solicitar nada.`;
  if (action.key === "appointment" || action.key === "ride") {
    const contextText = shareText(report, name) || symptomClue || conciergeMessage;
    const isRide = action.key === "ride";
    return {
      to: "/concierge",
      state: {
        conciergePrefill: {
          kind: isRide ? "ride" : "appointment",
          message: isRide
            ? `Please help me arrange a ride for care based on this saved VYVA check-in. Ask me to confirm before contacting anyone.\n\n${contextText}`
            : `Please help me schedule a care appointment based on this saved VYVA check-in. Ask me to confirm before booking.\n\n${contextText}`,
          source: "daily_checkin",
        },
      },
    };
  }

  return checkinActionNavigationFor(action, {
    reportText: shareText(report, name),
    symptomClue,
    conciergeMessage,
  });
}

const CheckinHistoryScreen = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { firstName, profile } = useProfile();
  const { language } = useLanguage();
  const name = firstName.trim();
  const { data, isLoading, isError } = useQuery<CheckinHistoryResponse>({
    queryKey: ["/api/checkins/history"],
  });
  const reports = useMemo(() => data?.reports ?? [], [data?.reports]);
  const latest = reports[0];
  const averageEnergy = useMemo(() => {
    const values = reports.map((report) => report.energy_level).filter((value): value is number => typeof value === "number");
    if (!values.length) return null;
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [reports]);

  const handleShare = async (report: CheckinHistoryReport) => {
    const text = shareText(report, name);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Lectura VYVA", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ description: "Lectura copiada para compartir." });
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        toast({ description: "Lectura copiada para compartir." });
      } catch {
        toast({ description: "No he podido compartir la lectura ahora mismo." });
      }
    }
  };

  return (
    <div className="vyva-page bg-[radial-gradient(circle_at_top_left,#FFF7ED_0%,transparent_34%),linear-gradient(180deg,#FAF7F2_0%,#F6EFE7_100%)]">
      <button
        onClick={() => navigate("/health")}
        className="vyva-tap mb-4 inline-flex min-h-[54px] items-center gap-2 rounded-full bg-white px-5 font-body text-[17px] font-bold text-vyva-text-1 shadow-[0_8px_22px_rgba(63,45,35,0.08)]"
      >
        <ArrowLeft size={20} />
        Atrás
      </button>

      <section className="overflow-hidden rounded-[34px] border border-white/80 bg-white shadow-[0_16px_44px_rgba(63,45,35,0.10)]">
        <div className="relative bg-gradient-to-br from-[#F5F3FF] via-white to-[#FFF7ED] p-6">
          <div className="absolute right-[-34px] top-[-40px] h-32 w-32 rounded-full bg-vyva-purple/10" />
          <div className="relative mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-[26px] bg-white text-vyva-purple shadow-[0_12px_30px_rgba(107,33,168,0.14)]">
            <HeartPulse size={38} />
          </div>
          <p className="relative mb-2 font-body text-[15px] font-bold uppercase tracking-[0.14em] text-vyva-purple">
            Bienestar
          </p>
          <h1 className="relative font-display text-[38px] leading-tight text-vyva-text-1">
            Historial de bienestar
          </h1>
          <p className="relative mt-3 font-body text-[20px] leading-relaxed text-vyva-text-2">
            Tus lecturas anteriores, tendencias y consejos de VYVA en un solo lugar.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <SummaryTile label="Lecturas" value={String(reports.length)} />
          <SummaryTile label="Energía media" value={averageEnergy ? `${averageEnergy}/5` : "—"} />
        </div>
      </section>

      {latest && (
        <section className="mt-5 rounded-[30px] border border-vyva-border bg-white p-5 shadow-[0_10px_28px_rgba(63,45,35,0.08)]">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-vyva-purple-light text-vyva-purple">
              <Sparkles size={23} />
            </span>
            <div>
              <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Última lectura</p>
              <p className="font-body text-[15px] text-vyva-text-2">{formatDate(latest.completed_at, language)}</p>
            </div>
          </div>
          <p className="font-body text-[22px] font-bold leading-snug text-vyva-text-1">{latest.feeling_label}</p>
          {latest.highlight && (
            <p className="mt-2 rounded-[20px] bg-vyva-purple-light p-4 font-body text-[18px] font-semibold leading-relaxed text-vyva-text-1">
              {latest.highlight}
            </p>
          )}
        </section>
      )}

      <section className="mt-5">
        <h2 className="mb-3 font-display text-[28px] text-vyva-text-1">Lecturas anteriores</h2>
        {isLoading ? (
          <div className="rounded-[28px] bg-white p-8 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 animate-spin text-vyva-purple" size={34} />
            <p className="font-body text-[18px] text-vyva-text-2">Cargando historial...</p>
          </div>
        ) : isError ? (
          <EmptyState title="No he podido cargar el historial" text="Inténtalo de nuevo en un momento." />
        ) : reports.length === 0 ? (
          <EmptyState title="Aún no hay lecturas guardadas" text="Cuando completes un check-in, aparecerá aquí." />
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                language={language}
                name={name}
                gpProfile={profile}
                onShare={() => handleShare(report)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-[#FAF9F6] p-4 text-center">
      <p className="font-body text-[26px] font-bold text-vyva-text-1">{value}</p>
      <p className="mt-1 font-body text-[14px] font-semibold text-vyva-text-2">{label}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[28px] border border-vyva-border bg-white p-6 text-center shadow-sm">
      <p className="font-body text-[20px] font-bold text-vyva-text-1">{title}</p>
      <p className="mt-2 font-body text-[17px] leading-relaxed text-vyva-text-2">{text}</p>
    </div>
  );
}

function ReportCard({
  report,
  language,
  name,
  gpProfile,
  onShare,
}: {
  report: CheckinHistoryReport;
  language: string;
  name: string;
  gpProfile?: { gpName?: string | null; gpPhone?: string | null; gpEmail?: string | null } | null;
  onShare: () => void;
}) {
  const style = stateStyle[report.overall_state ?? "moderate"] ?? stateStyle.moderate;
  const navigate = useNavigate();
  const serviceActions = savedCheckinActionsWithGpContact(savedCheckinServiceActionsFor(report), gpProfile, report, name);

  return (
    <article className="rounded-[30px] border border-vyva-border bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.07)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
            <CalendarDays size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[15px] font-semibold leading-snug text-vyva-text-2">
              {formatDate(report.completed_at, language)}
            </p>
            <p className="mt-1 font-body text-[20px] font-bold leading-tight text-vyva-text-1">
              {report.feeling_label ?? "Lectura de bienestar"}
            </p>
          </div>
        </div>
        <span className="rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: style.bg, color: style.text }}>
          {style.label}
        </span>
      </div>

      {report.vyva_reading && (
        <p className="font-body text-[17px] leading-relaxed text-vyva-text-2">{report.vyva_reading}</p>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric label="Energía" value={report.energy_level ? `${report.energy_level}/5` : "—"} />
        <MiniMetric label="Sueño" value={prettyValue(report.sleep_quality)} />
        <MiniMetric label="Ánimo" value={prettyValue(report.mood)} />
      </div>

      {report.highlight && (
        <div className="mt-4 rounded-[20px] bg-[#F5F3FF] p-4">
          <p className="font-body text-[14px] font-bold uppercase tracking-[0.14em] text-vyva-purple">Lo importante</p>
          <p className="mt-1 font-body text-[17px] font-semibold leading-relaxed text-vyva-text-1">{report.highlight}</p>
        </div>
      )}

      {report.today_actions?.length > 0 && (
        <div className="mt-4 grid gap-2">
          {report.today_actions.slice(0, 2).map((item) => (
            <div key={item} className="flex gap-2 rounded-[18px] bg-[#FAF9F6] p-3">
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-white">
                <Check size={15} />
              </span>
              <p className="font-body text-[16px] leading-relaxed text-vyva-text-1">{item}</p>
            </div>
          ))}
        </div>
      )}

      {report.watch_for && (
        <p className="mt-4 rounded-[18px] border border-[#FED7AA] bg-[#FFF7ED] p-3 font-body text-[15px] leading-relaxed text-[#7C2D12]">
          {report.watch_for}
        </p>
      )}

      {serviceActions.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2" data-testid={`checkin-history-actions-${report.id}`}>
          {serviceActions.map((action) => (
            <SavedCheckinActionButton
              key={action.key}
              action={action}
              onClick={() => {
                const destination = savedCheckinNavigationFor(report, name, action);
                navigate(destination.to, destination.state ? { state: destination.state } : undefined);
              }}
            />
          ))}
        </div>
      )}

      <button
        onClick={onShare}
        className="vyva-secondary-action mt-4 min-h-[56px] w-full text-[16px]"
      >
        <Share2 size={18} className="mr-2" />
        Compartir esta lectura
      </button>
    </article>
  );
}

function SavedCheckinActionButton({ action, onClick }: { action: SavedCheckinServiceAction; onClick: () => void }) {
  const Icon =
    action.key === "call_gp" ? PhoneCall :
    action.key === "email_gp" ? Mail :
    action.key === "care" ? Stethoscope :
    action.key === "appointment" ? CalendarDays :
    action.key === "ride" ? Car :
    action.key === "order" ? ShoppingBasket :
    action.key === "quote" ? Users :
    action.key === "symptom" ? ClipboardList :
    action.key === "vitals" ? Activity :
    Compass;
  const className = "vyva-tap inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[17px] border border-[#E7DCF8] bg-white px-4 py-3 text-center font-body text-[15px] font-black leading-tight text-vyva-purple shadow-sm";

  if (action.href) {
    return (
      <a
        href={action.href}
        data-testid={`button-checkin-history-action-${action.key}`}
        className={className}
      >
        <Icon size={18} />
        <span>{action.title}</span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`button-checkin-history-action-${action.key}`}
      className={className}
    >
      <Icon size={18} />
      <span>{action.title}</span>
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-[#FAF9F6] p-3 text-center">
      <p className="font-body text-[16px] font-bold leading-tight text-vyva-text-1">{value}</p>
      <p className="mt-1 font-body text-[12px] font-semibold text-vyva-text-2">{label}</p>
    </div>
  );
}

function prettyValue(value: string | null) {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (char) => char.toUpperCase());
}

export default CheckinHistoryScreen;
