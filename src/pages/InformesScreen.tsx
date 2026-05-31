import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  Car,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Heart,
  Mail,
  MessageCircle,
  Pill,
  PhoneCall,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Stethoscope,
  TrendingUp,
  Users,
  Wind,
  type LucideIcon,
} from "lucide-react";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import {
  HealthWizardCard,
  HealthWizardHero,
  HealthWizardSectionLabel,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { getSymptomRecommendationActionKinds, type SymptomRecommendationActionKind } from "@/lib/symptomReportActions";
import type { TriageScanResult } from "../../shared/triageScans";

type TriageReport = {
  id: string;
  chief_complaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  ai_summary: string | null;
  next_step_label: string | null;
  next_step_level: "emergency" | "doctor_today" | "doctor_24_48" | "monitor" | null;
  triage_reasons: string[];
  watch_signs: string[];
  profile_considerations: string[];
  vitals_notes: string[];
  scan_results?: TriageScanResult[];
  scan_notes?: string[];
  bpm: number | null;
  respiratory_rate: number | null;
  duration_seconds: number | null;
  created_at: string;
};

type VitalsReading = {
  id: string;
  bpm: number;
  respiratory_rate: number | null;
  recorded_at: string;
};

type Summary = {
  latestTriage: TriageReport | null;
  latestVitals: VitalsReading | null;
  todayMeds: { taken: number; total: number; adherencePct: number | null };
};

type VitalsHistory = {
  readings: VitalsReading[];
};

type ProfileContactsResponse = {
  gpName?: string | null;
  gpPhone?: string | null;
  gpEmail?: string | null;
} | null;

type ReportAction = {
  kind: SymptomRecommendationActionKind | "add_doctor_contact";
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

const cardShell = "rounded-[28px] border border-[#E8DED4] bg-white shadow-[0_12px_30px_rgba(63,45,35,0.07)]";

function urgencyConfig(urgency: TriageReport["urgency"]) {
  if (urgency === "urgent") return { icon: AlertTriangle, bg: "#FEE2E2", text: "#B91C1C", labelBg: "#FEE2E2" };
  if (urgency === "routine") return { icon: AlertTriangle, bg: "#FEF3C7", text: "#B45309", labelBg: "#FFF7ED" };
  return { icon: CheckCircle2, bg: "#D1FAE5", text: "#047857", labelBg: "#ECFDF5" };
}

function formatDate(iso?: string | null): string {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatTime(iso?: string | null): string {
  if (!iso) return "--";
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--";
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`;
}

function reportSignal(summary?: Summary | null) {
  if (!summary) return { tone: "neutral", text: "No report data yet" };
  const { latestTriage, latestVitals, todayMeds } = summary;
  if (latestTriage?.urgency === "urgent") return { tone: "urgent", text: "Needs attention" };
  if (latestTriage?.urgency === "routine") return { tone: "routine", text: "Routine follow-up" };
  if (latestVitals && (latestVitals.bpm < 55 || latestVitals.bpm > 100)) return { tone: "routine", text: "Vitals to review" };
  if (todayMeds.total > 0 && todayMeds.taken < todayMeds.total) return { tone: "routine", text: "Medication pending" };
  if (latestTriage || latestVitals || todayMeds.total > 0) return { tone: "good", text: "Looks steady" };
  return { tone: "neutral", text: "Ready for first report" };
}

function SummaryPhrase({ summary }: { summary: Summary }) {
  const { t } = useTranslation();
  if (!summary.latestTriage && !summary.latestVitals && summary.todayMeds.total === 0) {
    return <p className="font-body text-[15px] leading-relaxed text-white/86">{t("informes.summaryEmpty")}</p>;
  }

  let phrase = t("informes.summaryGood");
  if (summary.latestTriage?.urgency === "urgent") phrase = t("informes.summaryUrgent");
  else if (summary.latestTriage?.urgency === "routine") phrase = t("informes.summaryRoutine");
  else if (summary.todayMeds.total > 0 && summary.todayMeds.taken < summary.todayMeds.total) {
    phrase = t("informes.summaryMedsPending", { pending: summary.todayMeds.total - summary.todayMeds.taken });
  } else if (summary.latestVitals && summary.latestVitals.bpm > 100) phrase = t("informes.summaryHighHR");
  else if (summary.latestVitals && summary.latestVitals.bpm < 55) phrase = t("informes.summaryLowHR");

  return <p className="font-body text-[17px] font-semibold leading-relaxed text-white">{phrase}</p>;
}

function LineChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 10;
  const width = 280;
  const height = 64;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`M ${points.join(" L ")}`} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return <HealthWizardSectionLabel action={action}>{children}</HealthWizardSectionLabel>;
}

function EmptyCard({ icon: Icon, title, body }: { icon: typeof ClipboardList; title: string; body: string }) {
  return (
    <HealthWizardCard className="p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
          <Icon size={21} />
        </div>
        <div className="min-w-0">
          <p className="font-body text-[16px] font-bold text-vyva-text-1">{title}</p>
          <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">{body}</p>
        </div>
      </div>
    </HealthWizardCard>
  );
}

function sanitizePhoneHref(phone?: string | null): string {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function reportDoctorNote(report: TriageReport, t: ReturnType<typeof useTranslation>["t"]) {
  return [
    `${t("health.symptomCheck.report.tellMainSymptom", "Main symptom")}: ${report.chief_complaint}`,
    report.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${report.symptoms.join(", ")}` : "",
    report.next_step_label ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${report.next_step_label}` : "",
    report.triage_reasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${report.triage_reasons.join(" ")}` : "",
    report.vitals_notes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${report.vitals_notes.join(" ")}` : "",
    report.scan_notes?.length ? `${t("health.symptomCheck.report.scanNotes", "Scan notes")}: ${report.scan_notes.join(" ")}` : "",
    report.recommendations.length ? `${t("informes.reportDetail.recommendations", "What to do next")}: ${report.recommendations.join(" ")}` : "",
  ].filter(Boolean).join("\n");
}

export function DetailView({ report, onBack }: { report: TriageReport; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
  });
  const cfg = urgencyConfig(report.urgency);
  const UrgencyIcon = cfg.icon;
  const triageReasons = report.triage_reasons ?? [];
  const watchSigns = report.watch_signs ?? [];
  const profileConsiderations = report.profile_considerations ?? [];
  const vitalsNotes = report.vitals_notes ?? [];
  const scanNotes = report.scan_notes ?? [];
  const doctorNote = reportDoctorNote(report, t);
  const gpPhone = profileContacts?.gpPhone?.trim() ?? "";
  const gpEmail = profileContacts?.gpEmail?.trim() ?? "";
  const telHref = sanitizePhoneHref(gpPhone);
  const mailtoHref = gpEmail
    ? `mailto:${gpEmail}?subject=${encodeURIComponent(t("health.symptomCheck.report.actions.emailSubject", "VYVA symptom report"))}&body=${encodeURIComponent(doctorNote)}`
    : "";

  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };

  const openConciergePrefill = (kind: "ride" | "appointment" | "home_care_quote", recommendation: string) => {
    const key = kind === "ride"
      ? "health.symptomCheck.report.actions.ridePrefill"
      : kind === "appointment"
        ? "health.symptomCheck.report.actions.appointmentPrefill"
        : "health.symptomCheck.report.actions.quotePrefill";
    const fallback = kind === "ride"
      ? "Please help me book a safe ride for this health recommendation: {{recommendation}}. Ask me to confirm before booking."
      : kind === "appointment"
        ? "Please help me schedule care for this health recommendation: {{recommendation}}. Ask me to confirm before booking."
        : "Please help me request a quote for someone to stay with me or support me at home: {{recommendation}}. Ask me to confirm before requesting anything.";
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind,
          message: t(key, fallback, { recommendation, report: doctorNote }),
          source: "symptom_report",
        },
      },
    });
  };

  const openHydrationOrder = (recommendation: string) => {
    navigate("/concierge/shopping", {
      state: {
        shoppingPrefill: {
          needText: t(
            "health.symptomCheck.report.actions.hydrationPrefill",
            "Hydration support for this health recommendation: {{recommendation}}. Please suggest easy delivery options such as water, oral rehydration salts, or electrolyte drinks.",
            { recommendation, report: doctorNote },
          ),
          category: "groceries",
          priorities: ["delivery", "simplicity"],
        },
      },
    });
  };

  const actionLabels: Record<SymptomRecommendationActionKind, string> = {
    call_gp: t("health.symptomCheck.report.actions.callGp", "Call GP"),
    email_gp: t("health.symptomCheck.report.actions.emailGp", "Email GP"),
    doctor_help: t("health.symptomCheck.report.actions.doctorHelp", "Doctor help"),
    book_ride: t("health.symptomCheck.report.actions.bookRide", "Book ride"),
    schedule_appointment: t("health.symptomCheck.report.actions.scheduleAppointment", "Appointment"),
    online_order: t("health.symptomCheck.report.actions.onlineOrder", "Online order"),
    request_quote: t("health.symptomCheck.report.actions.requestQuote", "Request quote"),
  };
  const actionIcons: Record<SymptomRecommendationActionKind, LucideIcon> = {
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    book_ride: Car,
    schedule_appointment: Calendar,
    online_order: ShoppingBasket,
    request_quote: ClipboardList,
  };

  const recommendationActions = (recommendation: string): ReportAction[] => {
    const actions = getSymptomRecommendationActionKinds(recommendation, {
      hasGpPhone: Boolean(gpPhone),
      hasGpEmail: Boolean(gpEmail),
    }).map((kind): ReportAction => {
      const label = actionLabels[kind];
      const base = {
        kind,
        label,
        ariaLabel: t("health.symptomCheck.report.actions.aria", "{{action}} for: {{recommendation}}", { action: label, recommendation }),
        Icon: actionIcons[kind],
      };
      if (kind === "call_gp") return { ...base, href: telHref };
      if (kind === "email_gp") return { ...base, href: mailtoHref };
      if (kind === "doctor_help") return { ...base, onClick: openDoctorWithContext };
      if (kind === "book_ride") return { ...base, onClick: () => openConciergePrefill("ride", recommendation) };
      if (kind === "schedule_appointment") return { ...base, onClick: () => openConciergePrefill("appointment", recommendation) };
      if (kind === "online_order") return { ...base, onClick: () => openHydrationOrder(recommendation) };
      return { ...base, onClick: () => openConciergePrefill("home_care_quote", recommendation) };
    }).filter((action) => action.href || action.onClick);

    const hasDoctorAction = actions.some((action) => action.kind === "doctor_help" || action.kind === "call_gp" || action.kind === "email_gp");
    if (hasDoctorAction && !gpPhone && !gpEmail) {
      actions.push({
        kind: "add_doctor_contact",
        label: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        ariaLabel: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        Icon: Users,
        onClick: () => navigate("/onboarding/profile/gp"),
      });
    }

    return actions;
  };

  return (
    <HealthWizardShell contentClassName="pb-10">
      <HealthWizardTopBar
        title={report.chief_complaint}
        kicker={t("informes.reportDetail.title")}
        onBack={onBack}
        backLabel={t("informes.back", "Back")}
      />

      <section className="overflow-hidden rounded-[28px] bg-[#3D0D82] text-white shadow-[0_16px_36px_rgba(91,18,160,0.24)]">
        <div className="relative p-5">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px]" style={{ background: "rgba(255,255,255,0.14)" }}>
              <UrgencyIcon size={25} />
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full px-3 py-1 font-body text-[12px] font-bold" style={{ background: cfg.bg, color: cfg.text }}>
                {t(`informes.urgency.${report.urgency}`)}
              </span>
              <p className="mt-4 font-body text-[13px] text-white/65">{formatDate(report.created_at)} · {formatTime(report.created_at)}</p>
              {report.ai_summary && (
                <p className="mt-3 font-body text-[16px] font-semibold leading-relaxed text-white">{report.ai_summary}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {report.bpm != null && (
          <div className={`${cardShell} p-4`}>
            <Heart size={18} style={{ color: "#BE123C" }} />
            <p className="mt-3 font-body text-[28px] font-bold leading-none text-vyva-text-1">{report.bpm}<span className="ml-1 text-[13px] text-vyva-text-2">bpm</span></p>
          </div>
        )}
        {report.respiratory_rate != null && (
          <div className={`${cardShell} p-4`}>
            <Wind size={18} style={{ color: "#0369A1" }} />
            <p className="mt-3 font-body text-[28px] font-bold leading-none text-vyva-text-1">{report.respiratory_rate}<span className="ml-1 text-[13px] text-vyva-text-2">breaths/min</span></p>
          </div>
        )}
        {report.duration_seconds != null && report.duration_seconds > 0 && (
          <div className={`${cardShell} p-4`}>
            <ClipboardList size={18} style={{ color: "#6B21A8" }} />
            <p className="mt-3 font-body text-[18px] font-bold leading-tight text-vyva-text-1">{formatDuration(report.duration_seconds)}</p>
          </div>
        )}
      </div>

      {report.symptoms.length > 0 && (
        <section className={`${cardShell} mt-4 p-5`}>
          <p className="mb-3 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-2">
            {t("informes.reportDetail.symptoms")}
          </p>
          <div className="flex flex-wrap gap-2">
            {report.symptoms.map((symptom) => (
              <span key={symptom} className="rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[13px] font-bold text-[#6B21A8]">
                {symptom}
              </span>
            ))}
          </div>
        </section>
      )}

      {(report.next_step_label || triageReasons.length > 0) && (
        <section className={`${cardShell} mt-4 p-5`} data-testid="report-detail-next-step">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
              <ArrowRight size={21} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-2">
                {t("informes.reportDetail.nextStep", "Next step")}
              </p>
              {report.next_step_label && (
                <p className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                  {report.next_step_label}
                </p>
              )}
            </div>
          </div>
          {triageReasons.length > 0 && (
            <div className="rounded-[20px] bg-[#F5F3FF] p-4 text-[#6B21A8]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("informes.reportDetail.whyThisStep", "Initial Assessment")}
              </p>
              <ul className="mt-3 grid gap-2">
                {triageReasons.slice(0, 3).map((reason, index) => (
                  <li key={`${index}-${reason}`} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {report.recommendations.length > 0 && (
        <section className={`${cardShell} mt-4 p-5`}>
          <p className="mb-4 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-2">
            {t("informes.reportDetail.recommendations", "What to do next")}
          </p>
          <ol className="flex flex-col gap-3">
            {report.recommendations.map((recommendation, index) => {
              const actions = recommendationActions(recommendation);
              return (
                <li key={`${index}-${recommendation}`} className="rounded-[20px] bg-[#FFFCF8] p-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#6B21A8] font-body text-[12px] font-bold text-white">
                      {index + 1}
                    </span>
                    <span className="pt-1 font-body text-[15px] leading-relaxed text-vyva-text-1">{recommendation}</span>
                  </div>
                  {actions.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid={`report-detail-actions-${index}`}>
                      {actions.map((action) => {
                        const ActionIcon = action.Icon;
                        const className = "vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-white px-4 py-3 text-center font-body text-[14px] font-black leading-tight text-vyva-purple shadow-sm";
                        if (action.href) {
                          return (
                            <a
                              key={action.kind}
                              href={action.href}
                              aria-label={action.ariaLabel}
                              data-testid={`button-report-detail-action-${index}-${action.kind}`}
                              className={className}
                            >
                              <ActionIcon size={18} />
                              <span>{action.label}</span>
                            </a>
                          );
                        }
                        return (
                          <button
                            key={action.kind}
                            type="button"
                            onClick={action.onClick}
                            aria-label={action.ariaLabel}
                            data-testid={`button-report-detail-action-${index}-${action.kind}`}
                            className={className}
                          >
                            <ActionIcon size={18} />
                            <span>{action.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {(watchSigns.length > 0 || profileConsiderations.length > 0 || vitalsNotes.length > 0 || scanNotes.length > 0) && (
        <section className={`${cardShell} mt-4 p-5`}>
          {watchSigns.length > 0 && (
            <div>
              <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-[#9A3412]">
                {t("informes.reportDetail.watchSigns", "Watch for")}
              </p>
              <ul className="mt-3 grid gap-2">
                {watchSigns.slice(0, 3).map((sign, index) => (
                  <li key={`${index}-${sign}`} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                    {sign}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {[...profileConsiderations, ...vitalsNotes, ...scanNotes].length > 0 && (
            <div className={watchSigns.length > 0 ? "mt-5 border-t border-[#EADFD5] pt-5" : ""}>
              <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-[#6B21A8]">
                {t("informes.reportDetail.contextUsed", "What VYVA considered")}
              </p>
              <ul className="mt-3 grid gap-2">
                {[...profileConsiderations, ...vitalsNotes, ...scanNotes].slice(0, 6).map((note, index) => (
                  <li key={`${index}-${note}`} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {report.disclaimer && (
        <section className="mt-4 rounded-[22px] border border-[#FED7AA] bg-[#FFFBEB] p-4">
          <p className="font-body text-[12px] leading-relaxed text-[#92400E]">{report.disclaimer}</p>
        </section>
      )}

      <button
        data-testid="button-report-detail-chat"
        onClick={() => navigate("/chat")}
        className="vyva-primary-action mt-5 w-full"
      >
        <MessageCircle size={18} />
        {t("informes.reportDetail.chatCta")}
      </button>
    </HealthWizardShell>
  );
}

function InformesMain() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: urlId } = useParams<{ id?: string }>();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(urlId ?? null);

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/reports/summary"],
  });
  const { data: vitalsHistory } = useQuery<VitalsHistory>({
    queryKey: ["/api/reports/vitals/history"],
  });
  const { data: directReport, isLoading: directLoading, isError: directError } = useQuery<TriageReport>({
    queryKey: [`/api/reports/triage/${selectedReportId}`],
    enabled: !!selectedReportId,
    retry: 1,
  });

  const handleBack = () => {
    setSelectedReportId(null);
    navigate("/informes");
  };

  const respReadings = vitalsHistory?.readings.filter((reading) => reading.respiratory_rate != null) ?? [];
  const bpmReadings = vitalsHistory?.readings ?? [];
  const hasRespHistory = respReadings.length >= 2;
  const hasBpmHistory = bpmReadings.length >= 2;
  const hasData = summary && (summary.latestTriage || summary.latestVitals || summary.todayMeds.total > 0);
  const signal = reportSignal(summary);
  const pendingMeds = summary?.todayMeds.total ? Math.max(summary.todayMeds.total - summary.todayMeds.taken, 0) : 0;
  const statusTone = signal.tone === "urgent" ? "#B91C1C" : signal.tone === "routine" ? "#B45309" : signal.tone === "good" ? "#047857" : "#6B7280";

  const voiceHighlights = [
    ...(summary?.latestTriage ? [{ label: t("informes.cards.symptom.title"), value: formatDate(summary.latestTriage.created_at), tone: "neutral" as const }] : []),
    ...(summary?.latestVitals ? [{ label: t("health.quickTiles.status.label", "Vitals"), value: `${summary.latestVitals.bpm} bpm`, tone: "good" as const }] : []),
    ...(summary?.todayMeds.total ? [{ label: t("health.quickTiles.medication.label", "Medication"), value: `${summary.todayMeds.taken}/${summary.todayMeds.total}`, tone: pendingMeds ? "warning" as const : "good" as const }] : []),
  ];

  if (selectedReportId) {
    if (directLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-12 w-12 animate-pulse rounded-full bg-[#E8DED4]" />
        </div>
      );
    }

    if (directError || !directReport) {
      return (
        <HealthWizardShell contentClassName="pb-10">
          <button
            data-testid="button-back-from-error"
            onClick={handleBack}
            className="mb-5 mt-2 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-[0_4px_14px_rgba(63,45,35,0.08)]"
            aria-label={t("informes.back")}
          >
            <ChevronLeft size={20} />
          </button>
          <EmptyCard icon={ClipboardList} title={t("informes.errorTitle")} body={t("informes.errorSub")} />
        </HealthWizardShell>
      );
    }

    return <DetailView report={directReport} onBack={handleBack} />;
  }

  return (
    <HealthWizardShell contentClassName="pb-10">
      <HealthWizardTopBar
        title={t("informes.subtitle")}
        kicker={t("informes.title")}
        action={(
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#EFF6FF] text-[#1D4ED8] shadow-sm">
            <ClipboardList size={22} />
          </span>
        )}
      />

      <VoiceActionFulfillmentPanel
        domain="reports"
        actionTypes={["reports.history"]}
        title={t("informes.voiceContextTitle", "Report context ready")}
        description={t("informes.voiceContextSub", "VYVA can use recent reports, latest vitals, and medication summary when this page is opened.")}
        highlights={voiceHighlights}
        className="mb-4"
      />

      {summaryLoading && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[24px] bg-white shadow-[0_8px_24px_rgba(63,45,35,0.06)]" />
          ))}
        </div>
      )}

      {!summaryLoading && summary && (
        <>
          <section className="relative overflow-hidden rounded-[30px] bg-[#3D0D82] p-5 text-white shadow-[0_16px_36px_rgba(91,18,160,0.24)]" data-testid="banner-today-summary">
            <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-white/10" />
            <div className="relative">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-body text-[12px] font-bold uppercase tracking-[0.14em] text-white/64">
                    {t("informes.todaySummary")}
                  </p>
                  <h2 className="mt-1 font-display text-[30px] italic leading-tight text-white">
                    {signal.text}
                  </h2>
                </div>
                <span className="rounded-full bg-white px-3 py-1 font-body text-[12px] font-bold" style={{ color: statusTone }}>
                  {formatTime(summary.latestTriage?.created_at ?? summary.latestVitals?.recorded_at)}
                </span>
              </div>
              {hasData ? <SummaryPhrase summary={summary} /> : <p className="font-body text-[15px] text-white/86">{t("informes.summaryEmpty")}</p>}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
                <div>
                  <p className="font-body text-[20px] font-bold text-white">{summary.latestTriage ? "1" : "0"}</p>
                  <p className="font-body text-[11px] leading-tight text-white/66">{t("informes.cards.symptom.title")}</p>
                </div>
                <div>
                  <p className="font-body text-[20px] font-bold text-white">{summary.latestVitals ? summary.latestVitals.bpm : "--"}</p>
                  <p className="font-body text-[11px] leading-tight text-white/66">bpm</p>
                </div>
                <div>
                  <p className="font-body text-[20px] font-bold text-white">{summary.todayMeds.total ? `${summary.todayMeds.taken}/${summary.todayMeds.total}` : "--"}</p>
                  <p className="font-body text-[11px] leading-tight text-white/66">{t("informes.cards.meds.title")}</p>
                </div>
              </div>
            </div>
          </section>

          <SectionLabel>{t("informes.latestReports")}</SectionLabel>

          <div className="flex flex-col gap-3">
            {summary.latestTriage ? (
              <button
                data-testid="card-symptom-report"
                onClick={() => {
                  setSelectedReportId(summary.latestTriage!.id);
                  navigate(`/informes/${summary.latestTriage!.id}`);
                }}
                className={`${cardShell} w-full p-5 text-left active:scale-[0.99]`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF] text-[#6B21A8]">
                      <Activity size={21} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-body text-[16px] font-bold leading-tight text-vyva-text-1">{t("informes.cards.symptom.title")}</p>
                      <p className="font-body text-[12px] text-vyva-text-2">{formatDate(summary.latestTriage.created_at)}</p>
                    </div>
                  </div>
                  <span className="rounded-full px-3 py-1 font-body text-[11px] font-bold" style={{ background: urgencyConfig(summary.latestTriage.urgency).bg, color: urgencyConfig(summary.latestTriage.urgency).text }} data-testid="badge-symptom-urgency">
                    {t(`informes.urgency.${summary.latestTriage.urgency}`)}
                  </span>
                </div>
                <p className="line-clamp-2 font-body text-[14px] leading-relaxed text-vyva-text-2">
                  {summary.latestTriage.ai_summary || summary.latestTriage.chief_complaint}
                </p>
                <div className="mt-4 flex items-center justify-between pr-24">
                  <div className="flex items-center gap-3">
                    {summary.latestTriage.bpm != null && <span className="font-body text-[12px] font-bold text-vyva-text-2">{summary.latestTriage.bpm} bpm</span>}
                    {summary.latestTriage.respiratory_rate != null && <span className="font-body text-[12px] font-bold text-vyva-text-2">{summary.latestTriage.respiratory_rate} breaths/min</span>}
                  </div>
                  <span className="inline-flex items-center gap-1 font-body text-[12px] font-bold text-[#6B21A8]">
                    {t("informes.cards.symptom.cta")}
                    <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            ) : (
              <EmptyCard icon={Activity} title={t("informes.cards.symptom.title")} body={t("informes.cards.symptom.empty")} />
            )}

            {summary.latestVitals ? (
              <section className={`${cardShell} p-5`} data-testid="card-vitals">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FFF1F2] text-[#BE123C]">
                      <Heart size={21} />
                    </div>
                    <div>
                      <p className="font-body text-[16px] font-bold text-vyva-text-1">{t("informes.cards.vitals.title")}</p>
                      <p className="font-body text-[12px] text-vyva-text-2">{formatDate(summary.latestVitals.recorded_at)}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[11px] font-bold text-[#047857]">
                    {t("informes.cards.vitals.statusNormal")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[18px] bg-[#FFF7F8] p-4">
                    <Heart size={16} style={{ color: "#BE123C" }} />
                    <p className="mt-3 font-body text-[30px] font-bold leading-none text-vyva-text-1">{summary.latestVitals.bpm}<span className="ml-1 text-[13px] text-vyva-text-2">bpm</span></p>
                  </div>
                  <div className="rounded-[18px] bg-[#EFF6FF] p-4">
                    <Wind size={16} style={{ color: "#0369A1" }} />
                    <p className="mt-3 font-body text-[30px] font-bold leading-none text-vyva-text-1">{summary.latestVitals.respiratory_rate ?? "--"}<span className="ml-1 text-[13px] text-vyva-text-2">breaths/min</span></p>
                  </div>
                </div>
              </section>
            ) : (
              <EmptyCard icon={Heart} title={t("informes.cards.vitals.title")} body={t("informes.cards.vitals.empty")} />
            )}

            <section className={`${cardShell} p-5`} data-testid="card-medication">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FDF4FF] text-[#86198F]">
                  <Pill size={21} />
                </div>
                <div>
                  <p className="font-body text-[16px] font-bold text-vyva-text-1">{t("informes.cards.meds.title")}</p>
                  <p className="font-body text-[12px] text-vyva-text-2">{t("informes.cards.meds.today")}</p>
                </div>
              </div>
              {summary.todayMeds.total > 0 ? (
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="font-body text-[34px] font-bold leading-none text-vyva-text-1">{summary.todayMeds.adherencePct ?? 0}%</p>
                    <p className="mt-1 font-body text-[13px] text-vyva-text-2">
                      {t("informes.cards.meds.taken", { taken: summary.todayMeds.taken, total: summary.todayMeds.total })}
                    </p>
                  </div>
                  <button
                    data-testid="button-meds-details"
                    onClick={() => navigate("/meds/adherence-report")}
                    className="rounded-full bg-[#FDF4FF] px-4 py-2 font-body text-[13px] font-bold text-[#86198F] active:scale-95"
                  >
                    {t("informes.cards.meds.cta")}
                  </button>
                </div>
              ) : (
                <p className="font-body text-[14px] leading-relaxed text-vyva-text-2">{t("informes.cards.meds.empty")}</p>
              )}
            </section>
          </div>

          <SectionLabel>{t("informes.trends.title")}</SectionLabel>

          {!hasBpmHistory && !hasRespHistory && (
            <section className={`${cardShell} p-5 text-center`} data-testid="trends-empty-state">
              <TrendingUp className="mx-auto" size={28} style={{ color: "#A78BFA" }} />
              <p className="mt-2 font-body text-[14px] leading-relaxed text-vyva-text-2">{t("informes.trends.empty")}</p>
            </section>
          )}

          {hasBpmHistory && (
            <section className={`${cardShell} mb-3 p-5`} data-testid="chart-heart-rate">
              <div className="mb-3 flex items-center gap-2">
                <Heart size={16} style={{ color: "#BE123C" }} />
                <p className="font-body text-[15px] font-bold text-vyva-text-1">{t("informes.trends.heartRate")}</p>
                <span className="ml-auto font-body text-[12px] text-vyva-text-2">{t("informes.trends.readings", { count: bpmReadings.length })}</span>
              </div>
              <LineChart values={bpmReadings.map((reading) => reading.bpm)} color="#BE123C" />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.min")}: {Math.min(...bpmReadings.map((reading) => reading.bpm))} bpm</span>
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.max")}: {Math.max(...bpmReadings.map((reading) => reading.bpm))} bpm</span>
              </div>
            </section>
          )}

          {hasRespHistory && (
            <section className={`${cardShell} p-5`} data-testid="chart-respiratory-rate">
              <div className="mb-3 flex items-center gap-2">
                <Wind size={16} style={{ color: "#0369A1" }} />
                <p className="font-body text-[15px] font-bold text-vyva-text-1">{t("informes.trends.respiratoryRate")}</p>
                <span className="ml-auto font-body text-[12px] text-vyva-text-2">{t("informes.trends.readings", { count: respReadings.length })}</span>
              </div>
              <LineChart values={respReadings.map((reading) => reading.respiratory_rate!)} color="#0369A1" />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.min")}: {Math.min(...respReadings.map((reading) => reading.respiratory_rate!))} breaths/min</span>
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.max")}: {Math.max(...respReadings.map((reading) => reading.respiratory_rate!))} breaths/min</span>
              </div>
            </section>
          )}

          <section className="mt-5 rounded-[22px] border border-[#D1FAE5] bg-[#ECFDF5] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={18} className="mt-0.5 flex-shrink-0" style={{ color: "#047857" }} />
              <p className="font-body text-[12px] leading-relaxed text-[#047857]">
                {t("informes.privacyNote", "Reports are private to your account unless you choose to share them with a caregiver or clinician.")}
              </p>
            </div>
          </section>
        </>
      )}

      {!summaryLoading && !summary && (
        <EmptyCard icon={ClipboardList} title={t("informes.errorTitle")} body={t("informes.errorSub")} />
      )}
    </HealthWizardShell>
  );
}

export default function InformesScreen() {
  return <InformesMain />;
}
