import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Droplets,
  Gauge,
  Heart,
  MessageCircle,
  Pill,
  ShieldCheck,
  Thermometer,
  TrendingUp,
  Wind,
  Zap,
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

type SignalReading = {
  signal_type: string;
  value: string | number;
  recorded_at: string;
  source: string;
  context_tag: string | null;
};

type Summary = {
  latestTriage: TriageReport | null;
  latestVitals: VitalsReading | null;
  latestSignals?: SignalReading[];
  todayMeds: { taken: number; total: number; adherencePct: number | null };
};

type VitalsHistory = {
  readings: VitalsReading[];
  signalReadings?: SignalReading[];
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

const signalConfig: Record<string, { label: string; unit: string; Icon: LucideIcon; bg: string; color: string }> = {
  resting_hr_bpm: { label: "Pulse", unit: "bpm", Icon: Heart, bg: "#FFF1F2", color: "#BE123C" },
  respiratory_rate: { label: "Breathing", unit: "/min", Icon: Wind, bg: "#EFF6FF", color: "#0369A1" },
  oxygen_saturation: { label: "Oxygen", unit: "%", Icon: Wind, bg: "#ECFDF5", color: "#047857" },
  temperature_c: { label: "Temperature", unit: "C", Icon: Thermometer, bg: "#FFF7ED", color: "#B45309" },
  bp_systolic: { label: "BP top", unit: "mmHg", Icon: Gauge, bg: "#F5F3FF", color: "#6B21A8" },
  bp_diastolic: { label: "BP bottom", unit: "mmHg", Icon: Gauge, bg: "#F5F3FF", color: "#6B21A8" },
  glucose_mgdl: { label: "Glucose", unit: "mg/dL", Icon: Droplets, bg: "#ECFEFF", color: "#0E7490" },
  pain_score: { label: "Pain", unit: "/10", Icon: Activity, bg: "#FEF2F2", color: "#B91C1C" },
  energy_level: { label: "Energy", unit: "/10", Icon: Zap, bg: "#FFFBEB", color: "#B45309" },
};

function signalMeta(signalType: string) {
  return signalConfig[signalType] ?? { label: signalType.replace(/_/g, " "), unit: "", Icon: Activity, bg: "#F5F3FF", color: "#6B21A8" };
}

function signalDisplay(reading: SignalReading) {
  const meta = signalMeta(reading.signal_type);
  const numeric = Number(reading.value);
  const value = Number.isFinite(numeric) ? numeric.toString() : String(reading.value ?? "--");
  return `${value}${meta.unit ? ` ${meta.unit}` : ""}`;
}

function sourceLabel(source?: string | null) {
  if (source === "phone_estimate") return "Estimated trend";
  if (source === "connected_device") return "Device reading";
  if (source === "clinical") return "Clinical reading";
  return "Manual entry";
}

function reportSignal(summary?: Summary | null) {
  if (!summary) return { tone: "neutral", text: "No report data yet" };
  const { latestTriage, latestVitals, latestSignals = [], todayMeds } = summary;
  if (latestTriage?.urgency === "urgent") return { tone: "urgent", text: "Needs attention" };
  if (latestTriage?.urgency === "routine") return { tone: "routine", text: "Routine follow-up" };
  const signalMap = new Map(latestSignals.map((reading) => [reading.signal_type, Number(reading.value)]));
  if ((signalMap.get("oxygen_saturation") ?? 100) <= 92) return { tone: "routine", text: "Oxygen to review" };
  if ((signalMap.get("temperature_c") ?? 0) >= 38) return { tone: "routine", text: "Temperature to review" };
  if ((signalMap.get("pain_score") ?? 0) >= 8) return { tone: "routine", text: "Pain to review" };
  if (latestVitals && (latestVitals.bpm < 55 || latestVitals.bpm > 100)) return { tone: "routine", text: "Vitals to review" };
  if ((signalMap.get("resting_hr_bpm") ?? 72) < 55 || (signalMap.get("resting_hr_bpm") ?? 72) > 100) return { tone: "routine", text: "Pulse to review" };
  if (todayMeds.total > 0 && todayMeds.taken < todayMeds.total) return { tone: "routine", text: "Medication pending" };
  if (latestTriage || latestVitals || latestSignals.length > 0 || todayMeds.total > 0) return { tone: "good", text: "Looks steady" };
  return { tone: "neutral", text: "Ready for first report" };
}

function SummaryPhrase({ summary }: { summary: Summary }) {
  const { t } = useTranslation();
  const latestSignals = summary.latestSignals ?? [];
  if (!summary.latestTriage && !summary.latestVitals && latestSignals.length === 0 && summary.todayMeds.total === 0) {
    return <p className="font-body text-[15px] leading-relaxed text-white/86">{t("informes.summaryEmpty")}</p>;
  }

  let phrase = t("informes.summaryGood");
  if (summary.latestTriage?.urgency === "urgent") phrase = t("informes.summaryUrgent");
  else if (summary.latestTriage?.urgency === "routine") phrase = t("informes.summaryRoutine");
  else if (summary.todayMeds.total > 0 && summary.todayMeds.taken < summary.todayMeds.total) {
    phrase = t("informes.summaryMedsPending", { pending: summary.todayMeds.total - summary.todayMeds.taken });
  } else {
    const latestPulse = Number(latestSignals.find((reading) => reading.signal_type === "resting_hr_bpm")?.value ?? summary.latestVitals?.bpm);
    if (Number.isFinite(latestPulse) && latestPulse > 100) phrase = t("informes.summaryHighHR");
    else if (Number.isFinite(latestPulse) && latestPulse < 55) phrase = t("informes.summaryLowHR");
  }

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

function DetailView({ report, onBack }: { report: TriageReport; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cfg = urgencyConfig(report.urgency);
  const UrgencyIcon = cfg.icon;
  const triageReasons = report.triage_reasons ?? [];
  const watchSigns = report.watch_signs ?? [];
  const profileConsiderations = report.profile_considerations ?? [];
  const vitalsNotes = report.vitals_notes ?? [];

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
            <p className="mt-3 font-body text-[28px] font-bold leading-none text-vyva-text-1">{report.respiratory_rate}<span className="ml-1 text-[13px] text-vyva-text-2">rpm</span></p>
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

      {report.recommendations.length > 0 && (
        <section className={`${cardShell} mt-4 p-5`}>
          <p className="mb-4 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-2">
            {t("informes.reportDetail.recommendations")}
          </p>
          <ol className="flex flex-col gap-3">
            {report.recommendations.map((recommendation, index) => (
              <li key={`${index}-${recommendation}`} className="flex items-start gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#6B21A8] font-body text-[12px] font-bold text-white">
                  {index + 1}
                </span>
                <span className="pt-1 font-body text-[15px] leading-relaxed text-vyva-text-1">{recommendation}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(report.next_step_label || triageReasons.length > 0) && (
        <section className={`${cardShell} mt-4 p-5`}>
          <p className="mb-3 font-body text-[13px] font-bold uppercase tracking-[0.12em] text-vyva-text-2">
            {t("informes.reportDetail.nextStep", "Next step")}
          </p>
          {report.next_step_label && (
            <p className="font-body text-[20px] font-black leading-tight text-vyva-text-1">
              {report.next_step_label}
            </p>
          )}
          {triageReasons.length > 0 && (
            <div className="mt-4 rounded-[20px] bg-[#F5F3FF] p-4 text-[#6B21A8]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("informes.reportDetail.whyThisStep", "Why VYVA chose this")}
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

      {(watchSigns.length > 0 || profileConsiderations.length > 0 || vitalsNotes.length > 0) && (
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
          {[...profileConsiderations, ...vitalsNotes].length > 0 && (
            <div className={watchSigns.length > 0 ? "mt-5 border-t border-[#EADFD5] pt-5" : ""}>
              <p className="font-body text-[13px] font-bold uppercase tracking-[0.12em] text-[#6B21A8]">
                {t("informes.reportDetail.contextUsed", "What VYVA considered")}
              </p>
              <ul className="mt-3 grid gap-2">
                {[...profileConsiderations, ...vitalsNotes].slice(0, 4).map((note, index) => (
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

  const signalHistory = vitalsHistory?.signalReadings ?? [];
  const signalHistoryValues = (signalType: string) =>
    signalHistory
      .filter((reading) => reading.signal_type === signalType)
      .map((reading) => Number(reading.value))
      .filter(Number.isFinite);
  const oldRespValues = vitalsHistory?.readings
    .filter((reading) => reading.respiratory_rate != null)
    .map((reading) => reading.respiratory_rate!) ?? [];
  const oldBpmValues = vitalsHistory?.readings.map((reading) => reading.bpm) ?? [];
  const respSignalValues = signalHistoryValues("respiratory_rate");
  const bpmSignalValues = signalHistoryValues("resting_hr_bpm");
  const respValues = respSignalValues.length >= 2 ? respSignalValues : oldRespValues;
  const bpmValues = bpmSignalValues.length >= 2 ? bpmSignalValues : oldBpmValues;
  const hasRespHistory = respValues.length >= 2;
  const hasBpmHistory = bpmValues.length >= 2;
  const latestSignals = summary?.latestSignals ?? [];
  const primarySignal = latestSignals[0] ?? null;
  const hasData = summary && (summary.latestTriage || summary.latestVitals || latestSignals.length > 0 || summary.todayMeds.total > 0);
  const signal = reportSignal(summary);
  const pendingMeds = summary?.todayMeds.total ? Math.max(summary.todayMeds.total - summary.todayMeds.taken, 0) : 0;
  const statusTone = signal.tone === "urgent" ? "#B91C1C" : signal.tone === "routine" ? "#B45309" : signal.tone === "good" ? "#047857" : "#6B7280";

  const voiceHighlights = [
    ...(summary?.latestTriage ? [{ label: t("informes.cards.symptom.title"), value: formatDate(summary.latestTriage.created_at), tone: "neutral" as const }] : []),
    ...(primarySignal ? [{ label: t("health.quickTiles.status.label", "Status"), value: signalDisplay(primarySignal), tone: "good" as const }] : summary?.latestVitals ? [{ label: t("health.quickTiles.status.label", "Status"), value: `${summary.latestVitals.bpm} bpm`, tone: "good" as const }] : []),
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
                  {formatTime(summary.latestTriage?.created_at ?? primarySignal?.recorded_at ?? summary.latestVitals?.recorded_at)}
                </span>
              </div>
              {hasData ? <SummaryPhrase summary={summary} /> : <p className="font-body text-[15px] text-white/86">{t("informes.summaryEmpty")}</p>}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
                <div>
                  <p className="font-body text-[20px] font-bold text-white">{summary.latestTriage ? "1" : "0"}</p>
                  <p className="font-body text-[11px] leading-tight text-white/66">{t("informes.cards.symptom.title")}</p>
                </div>
                <div>
                  <p className="font-body text-[20px] font-bold text-white">{primarySignal ? signalDisplay(primarySignal).split(" ")[0] : summary.latestVitals ? summary.latestVitals.bpm : "--"}</p>
                  <p className="font-body text-[11px] leading-tight text-white/66">{primarySignal ? signalMeta(primarySignal.signal_type).label : "bpm"}</p>
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
                    {summary.latestTriage.respiratory_rate != null && <span className="font-body text-[12px] font-bold text-vyva-text-2">{summary.latestTriage.respiratory_rate} rpm</span>}
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

            {summary.latestVitals || latestSignals.length ? (
              <section className={`${cardShell} p-5`} data-testid="card-vitals">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#FFF1F2] text-[#BE123C]">
                      <Heart size={21} />
                    </div>
                    <div>
                      <p className="font-body text-[16px] font-bold text-vyva-text-1">{t("informes.cards.vitals.title")}</p>
                      <p className="font-body text-[12px] text-vyva-text-2">{formatDate(primarySignal?.recorded_at ?? summary.latestVitals?.recorded_at)}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-[#ECFDF5] px-3 py-1 font-body text-[11px] font-bold text-[#047857]">
                    {primarySignal ? sourceLabel(primarySignal.source) : t("informes.cards.vitals.statusNormal")}
                  </span>
                </div>
                {latestSignals.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {latestSignals.slice(0, 6).map((reading) => {
                      const meta = signalMeta(reading.signal_type);
                      const Icon = meta.Icon;
                      return (
                        <div key={`${reading.signal_type}-${reading.recorded_at}`} className="rounded-[18px] p-4" style={{ background: meta.bg }}>
                          <div className="flex items-center justify-between gap-2">
                            <Icon size={16} style={{ color: meta.color }} />
                            <span className="rounded-full bg-white/80 px-2 py-1 font-body text-[10px] font-bold" style={{ color: meta.color }}>
                              {sourceLabel(reading.source)}
                            </span>
                          </div>
                          <p className="mt-3 font-body text-[12px] font-bold text-vyva-text-2">{meta.label}</p>
                          <p className="font-body text-[24px] font-bold leading-none text-vyva-text-1">{signalDisplay(reading)}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[18px] bg-[#FFF7F8] p-4">
                      <Heart size={16} style={{ color: "#BE123C" }} />
                      <p className="mt-3 font-body text-[30px] font-bold leading-none text-vyva-text-1">{summary.latestVitals?.bpm}<span className="ml-1 text-[13px] text-vyva-text-2">bpm</span></p>
                    </div>
                    <div className="rounded-[18px] bg-[#EFF6FF] p-4">
                      <Wind size={16} style={{ color: "#0369A1" }} />
                      <p className="mt-3 font-body text-[30px] font-bold leading-none text-vyva-text-1">{summary.latestVitals?.respiratory_rate ?? "--"}<span className="ml-1 text-[13px] text-vyva-text-2">rpm</span></p>
                    </div>
                  </div>
                )}
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
                <span className="ml-auto font-body text-[12px] text-vyva-text-2">{t("informes.trends.readings", { count: bpmValues.length })}</span>
              </div>
              <LineChart values={bpmValues} color="#BE123C" />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.min")}: {Math.min(...bpmValues)} bpm</span>
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.max")}: {Math.max(...bpmValues)} bpm</span>
              </div>
            </section>
          )}

          {hasRespHistory && (
            <section className={`${cardShell} p-5`} data-testid="chart-respiratory-rate">
              <div className="mb-3 flex items-center gap-2">
                <Wind size={16} style={{ color: "#0369A1" }} />
                <p className="font-body text-[15px] font-bold text-vyva-text-1">{t("informes.trends.respiratoryRate")}</p>
                <span className="ml-auto font-body text-[12px] text-vyva-text-2">{t("informes.trends.readings", { count: respValues.length })}</span>
              </div>
              <LineChart values={respValues} color="#0369A1" />
              <div className="mt-2 flex items-center justify-between">
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.min")}: {Math.min(...respValues)} rpm</span>
                <span className="font-body text-[12px] text-vyva-text-2">{t("informes.trends.max")}: {Math.max(...respValues)} rpm</span>
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
