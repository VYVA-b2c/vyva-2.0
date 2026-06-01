import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ClipboardList,
  Heart,
  LucideIcon,
  Phone,
  Plus,
  ScanLine,
  Share2,
  ShieldCheck,
  Stethoscope,
  Users,
  Watch,
  Wind,
  X,
} from "lucide-react";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import VoiceHero from "@/components/VoiceHero";
import VitalsTracker from "@/components/VitalsTracker";
import VitalsScan from "@/components/VitalsScan";
import {
  HealthWizardCard,
  HealthWizardSectionLabel,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useToast } from "@/hooks/use-toast";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";
import { apiFetch } from "@/lib/queryClient";
import { vitalsEvidenceFor, type VitalsSourceConfidence } from "../../shared/vitalsEvidence";

type MetricType = "hr" | "rr" | "bp";
type ReadingSource = "phone_estimate" | "manual_entry" | "connected_device" | "clinical";

interface VitalsSummaryEntry {
  latest_value: string | null;
  latest_recorded_at: string | null;
  latest_source?: ReadingSource | null;
  latest_source_confidence?: VitalsSourceConfidence | null;
  latest_source_confidence_reason?: string | null;
  latest_source_display_label?: string | null;
  latest_source_context_label?: string | null;
  trend: (string | null)[];
  has_data: boolean;
}

interface VitalsResponse {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
}

interface MetricMeta {
  id: MetricType;
  Icon: LucideIcon;
  labelKey: string;
  fallbackLabel: string;
  unit: string;
  placeholder: string;
  accent: string;
  soft: string;
  range?: { low: number; high: number };
}

const METRIC_META: Record<MetricType, MetricMeta> = {
  hr: {
    id: "hr",
    Icon: Heart,
    labelKey: "statusVitals.metrics.heartRate",
    fallbackLabel: "Heart rate",
    unit: "bpm",
    placeholder: "72",
    accent: "#BE123C",
    soft: "#FFF1F2",
    range: { low: 50, high: 100 },
  },
  rr: {
    id: "rr",
    Icon: Wind,
    labelKey: "statusVitals.metrics.respiration",
    fallbackLabel: "Respiration",
    unit: "rpm",
    placeholder: "16",
    accent: "#0369A1",
    soft: "#EFF6FF",
    range: { low: 12, high: 20 },
  },
  bp: {
    id: "bp",
    Icon: Activity,
    labelKey: "statusVitals.metrics.bloodPressure",
    fallbackLabel: "Blood pressure",
    unit: "mmHg",
    placeholder: "118/76",
    accent: "#6B21A8",
    soft: "#F5F3FF",
  },
};

const ENGINE_SIGNAL_BY_METRIC: Record<MetricType, string> = {
  hr: "resting_hr_bpm",
  rr: "respiratory_rate",
  bp: "bp_systolic",
};

const DAY_LABELS = [
  { key: "statusVitals.days.mon", fallback: "M" },
  { key: "statusVitals.days.tue", fallback: "T" },
  { key: "statusVitals.days.wed", fallback: "W" },
  { key: "statusVitals.days.thu", fallback: "T" },
  { key: "statusVitals.days.fri", fallback: "F" },
  { key: "statusVitals.days.sat", fallback: "S" },
  { key: "statusVitals.days.sun", fallback: "S" },
];

const DEVICE_ROWS = [
  { id: "watch", Icon: Watch, labelKey: "statusVitals.deviceRows.smartwatch", fallbackLabel: "Smartwatch", model: "VYVA Band 2", connected: true },
  { id: "bp-cuff", Icon: Activity, labelKey: "statusVitals.deviceRows.bloodPressureCuff", fallbackLabel: "Blood pressure cuff", model: "OmronConnect", connected: true },
  { id: "stethoscope", Icon: Stethoscope, labelKey: "statusVitals.deviceRows.digitalStethoscope", fallbackLabel: "Digital stethoscope", model: "Eko DUO", connected: false },
];

type VitalsTrackerLanguage = "de" | "en" | "es" | "fr" | "it" | "pt";

function vitalsTrackerLanguage(language?: string | null): VitalsTrackerLanguage {
  const base = (language ?? "").split("-")[0]?.toLowerCase();
  if (base === "de" || base === "en" || base === "es" || base === "fr" || base === "it" || base === "pt") return base;
  return "en";
}

function parseNumericValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseFloat(value.split("/")[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildTrend(values: (string | null)[]): number[] {
  return values.map((value) => parseNumericValue(value) ?? 0);
}

function focusedMetricFromVoice(value: string): MetricType | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("blood") || normalized.includes("pressure") || normalized.includes("presion")) return "bp";
  if (normalized.includes("resp") || normalized.includes("breath") || normalized.includes("rpm")) return "rr";
  if (normalized.includes("heart") || normalized.includes("pulse") || normalized.includes("card") || normalized.includes("bpm")) return "hr";
  return null;
}

function formatRecordedAt(iso: string | null, language: string): string {
  if (!iso) return "--";
  const date = new Date(iso);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return `${language.startsWith("es") ? "Hoy" : "Today"}, ${date.toLocaleTimeString(language, {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  if (diffHours < 48) return language.startsWith("es") ? "Ayer" : "Yesterday";
  return date.toLocaleDateString(language, { day: "numeric", month: "short" });
}

function getMetricState(meta: MetricMeta, value: string | null) {
  const numeric = parseNumericValue(value);
  if (!numeric) return { tone: "neutral", color: "#6B7280", bg: "#F3F4F6" };
  if (!meta.range) return { tone: "logged", color: "#6B21A8", bg: "#F5F3FF" };
  if (numeric < meta.range.low || numeric > meta.range.high) return { tone: "review", color: "#B45309", bg: "#FEF3C7" };
  return { tone: "steady", color: "#047857", bg: "#D1FAE5" };
}

function confidenceLabel(confidence: VitalsSourceConfidence | null | undefined, t: (key: string, fallback: string) => string) {
  if (confidence === "high") return t("statusVitals.confidence.high", "High");
  if (confidence === "low") return t("statusVitals.confidence.low", "Low");
  return t("statusVitals.confidence.medium", "Medium");
}

function sourceLabel(source: ReadingSource | null | undefined, fallback: string, t: (key: string, fallback: string) => string) {
  if (source === "phone_estimate") return t("statusVitals.source.phoneEstimate", fallback);
  if (source === "connected_device") return t("statusVitals.source.connectedDevice", fallback);
  if (source === "clinical") return t("statusVitals.source.clinical", fallback);
  return t("statusVitals.source.manual", fallback);
}

function sourceTone(summary: VitalsSummaryEntry | undefined, metricKey: MetricType, t: (key: string, fallback: string) => string) {
  const source = summary?.latest_source;
  const evidence = vitalsEvidenceFor(source, ENGINE_SIGNAL_BY_METRIC[metricKey]);
  const confidence = summary?.latest_source_confidence ?? evidence.confidence;
  const label = `${sourceLabel(source, summary?.latest_source_display_label ?? evidence.displayLabel, t)} - ${confidenceLabel(confidence, t)}`;
  if (source === "phone_estimate") return { label, color: "#6B21A8", bg: "#F5F3FF" };
  if (source === "connected_device") {
    return { label, color: "#047857", bg: "#D1FAE5" };
  }
  if (source === "clinical") {
    return { label, color: "#0369A1", bg: "#E0F2FE" };
  }
  return { label, color: "#92400E", bg: "#FEF3C7" };
}

function MiniTrend({ values, accent }: { values: number[]; accent: string }) {
  const nonZeroValues = values.filter((value) => value > 0);
  const max = Math.max(...nonZeroValues, 1);
  const min = Math.min(...nonZeroValues, max);
  const range = Math.max(max - min, 1);

  return (
    <div className="mt-4 flex h-[42px] items-end gap-[5px]" aria-hidden="true">
      {values.map((value, index) => {
        const hasValue = value > 0;
        const height = hasValue ? Math.round(((value - min) / range) * 26) + 12 : 8;
        return (
          <div
            key={`${value}-${index}`}
            className="flex-1 rounded-full"
            style={{
              height,
              background: hasValue ? accent : "#E8DED4",
              opacity: index === values.length - 1 && hasValue ? 1 : 0.5,
            }}
          />
        );
      })}
    </div>
  );
}

function MetricCard({
  metricKey,
  summary,
  t,
  highlighted = false,
}: {
  metricKey: MetricType;
  summary?: VitalsSummaryEntry;
  t: (key: string, fallback: string) => string;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = METRIC_META[metricKey];
  const trend = buildTrend(summary?.trend ?? Array(7).fill(null));
  const hasData = summary?.has_data === true;
  const displayValue = hasData ? summary?.latest_value ?? "--" : "--";
  const hasTrend = trend.some((value) => value > 0);
  const state = getMetricState(meta, summary?.latest_value ?? null);
  const source = sourceTone(summary, metricKey, t);
  const stateLabel =
    state.tone === "steady"
      ? t("statusVitals.status.steady", "Steady")
      : state.tone === "review"
      ? t("statusVitals.status.review", "Review")
      : state.tone === "logged"
      ? t("statusVitals.status.logged", "Logged")
      : t("statusVitals.status.noData", "No data");
  const Icon = meta.Icon;

  return (
    <HealthWizardCard
      className={`p-4 ${highlighted ? "ring-2 ring-emerald-200" : ""}`}
      testId={`card-vital-${metricKey}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: meta.soft }}>
            <Icon size={21} style={{ color: meta.accent }} />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[13px] font-semibold text-vyva-text-2">
              {t(meta.labelKey, meta.fallbackLabel)}
            </p>
            <p className="mt-1 font-body text-[28px] font-bold leading-none text-vyva-text-1">
              {displayValue === "--" ? (
                <span className="text-[17px] font-semibold text-vyva-text-2">{t("statusVitals.emptyMetric", "No reading")}</span>
              ) : (
                <>
                  {displayValue}
                  <span className="ml-1 text-[13px] font-semibold text-vyva-text-2">{meta.unit}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="rounded-full px-3 py-1 font-body text-[11px] font-bold" style={{ color: state.color, background: state.bg }}>
            {stateLabel}
          </span>
          {hasData && (
            <span className="rounded-full px-3 py-1 font-body text-[11px] font-bold" style={{ color: source.color, background: source.bg }}>
              {source.label}
            </span>
          )}
          {hasTrend && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F7F1E9] text-vyva-text-2 active:scale-95"
              aria-label={expanded ? t("statusVitals.collapseTrend", "Hide trend") : t("statusVitals.expandTrend", "Show trend")}
              data-testid={`button-metric-expand-${metricKey}`}
            >
              {expanded ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
          )}
        </div>
      </div>
      {expanded && hasTrend && (
        <div className="mt-4 border-t border-[#EFE5DC] pt-3">
          <div className="flex items-center justify-between">
            <p className="font-body text-[12px] font-semibold uppercase tracking-[0.08em] text-vyva-text-2">
              {t("statusVitals.sevenDayTrend", "7-day trend")}
            </p>
            <p className="font-body text-[12px] text-vyva-text-3">{t("statusVitals.latestRight", "Latest at right")}</p>
          </div>
          <MiniTrend values={trend} accent={meta.accent} />
        </div>
      )}
    </HealthWizardCard>
  );
}

function LogReadingModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [metricType, setMetricType] = useState<MetricType>("hr");
  const [value, setValue] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiFetch("/api/vitals", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ metric_type: metricType, value: value.trim(), source: "manual_entry" }),
      });
      if (!response.ok) throw new Error("Failed to save reading");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
      toast({
        title: t("statusVitals.savedTitle", "Reading saved"),
        description: t("statusVitals.savedBody", "Your vitals timeline has been updated."),
      });
      onClose();
    },
    onError: () => {
      toast({
        title: t("statusVitals.saveErrorTitle", "Could not save reading"),
        description: t("statusVitals.saveErrorBody", "Please try again in a moment."),
        variant: "destructive",
      });
    },
  });

  const activeMetric = METRIC_META[metricType];

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-0" onClick={(event) => event.currentTarget === event.target && onClose()}>
      <section className="w-full max-w-[520px] rounded-t-[30px] bg-white px-5 pb-8 pt-4 shadow-[0_-16px_40px_rgba(31,24,18,0.18)]">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#E8DED4]" />
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-[24px] italic leading-tight text-vyva-text-1">
              {t("statusVitals.logTitle", "Log a reading")}
            </h2>
            <p className="mt-1 font-body text-[13px] text-vyva-text-2">
              {t("statusVitals.logSubtitle", "Add a confirmed number from a device or manual check.")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-log-modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 grid grid-cols-3 gap-2">
          {(Object.keys(METRIC_META) as MetricType[]).map((key) => {
            const meta = METRIC_META[key];
            const Icon = meta.Icon;
            const active = metricType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMetricType(key);
                  setValue("");
                }}
                className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-[18px] border px-2 py-3 active:scale-[0.98]"
                style={{
                  background: active ? meta.accent : "#F9F6F2",
                  borderColor: active ? meta.accent : "#EDE5DB",
                  color: active ? "#FFFFFF" : meta.accent,
                }}
                data-testid={`button-metric-select-${key}`}
              >
                <Icon size={18} />
                <span className="font-body text-[11px] font-bold leading-tight">{meta.unit}</span>
              </button>
            );
          })}
        </div>

        <label className="mb-2 block font-body text-[12px] font-bold uppercase tracking-[0.1em] text-vyva-text-2" htmlFor="vitals-value-input">
          {t(activeMetric.labelKey, activeMetric.fallbackLabel)} ({activeMetric.unit})
        </label>
        <input
          id="vitals-value-input"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activeMetric.placeholder}
          className="mb-5 w-full rounded-[18px] border-2 border-transparent bg-[#F7F1E9] px-4 py-4 font-body text-[22px] font-bold text-vyva-text-1 outline-none focus:border-[#6B21A8]"
          data-testid="input-vitals-value"
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={!value.trim() || mutation.isPending}
          className="vyva-primary-action w-full"
          data-testid="button-save-vital"
        >
          {mutation.isPending ? t("statusVitals.saving", "Saving...") : t("statusVitals.saveReading", "Save reading")}
        </button>
      </section>
    </div>
  );
}

function ScanModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return (
    <div className="fixed inset-0 z-[80] flex justify-center bg-white">
      <section className="flex min-h-screen w-full max-w-[520px] flex-col bg-[#FBF7F2]">
        <div className="flex items-center justify-between border-b border-[#EDE5DB] bg-white px-5 py-4">
          <div>
            <h2 className="font-display text-[22px] italic text-vyva-text-1">
              {t("statusVitals.scanTitle", "Vitals scan")}
            </h2>
            <p className="font-body text-[12px] text-vyva-text-2">
              {t("statusVitals.scanSubtitle", "Camera estimate, not a medical device reading")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F7F1E9]"
            aria-label={t("common.close", "Close")}
            data-testid="button-close-scan-modal"
          >
            <X size={18} />
          </button>
        </div>
        <VitalsScan
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
            onClose();
          }}
        />
      </section>
    </div>
  );
}

const SignosScreen = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [showLogModal, setShowLogModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const { action: voiceAction, payloadValue: voicePayloadValue } = useVoiceActionFulfillment({
    domain: "health",
    actionTypes: ["health.vitals_review"],
  });

  const { data: vitalsData, isLoading } = useQuery<VitalsResponse>({
    queryKey: ["/api/vitals"],
    retry: false,
  });
  const { data: personalisationData } = useQuery<{
    conditions: string[];
    hobbies: string[];
    hasMedications: boolean;
  }>({
    queryKey: ["/api/profile/personalisation"],
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const summary = vitalsData?.summary;
  const complianceDays = vitalsData?.compliance_days ?? (Array(7).fill(false) as boolean[]);
  const filledDays = complianceDays.filter(Boolean).length;
  const connectedDevices = DEVICE_ROWS.filter((device) => device.connected).length;

  const latestReadingAt = useMemo(() => {
    if (!summary) return null;
    const dates = Object.values(summary)
      .map((entry) => entry.latest_recorded_at)
      .filter(Boolean) as string[];
    return dates.sort().reverse()[0] ?? null;
  }, [summary]);

  const metricsWithData = (["hr", "rr", "bp"] as MetricType[]).filter((key) => summary?.[key]?.has_data).length;
  const latestText = latestReadingAt
    ? formatRecordedAt(latestReadingAt, i18n.language)
    : t("statusVitals.noLatest", "No recent readings");
  const completionPct = Math.round((filledDays / 7) * 100);
  const overallGood = metricsWithData > 0 && filledDays >= 3;
  const focusedMetric = focusedMetricFromVoice(
    voicePayloadValue("vital_type")
      || voicePayloadValue("trend_focus")
      || voiceAction?.extractedSubject
      || "",
  );
  const focusedMetricSummary = focusedMetric ? summary?.[focusedMetric] : undefined;
  const voiceActionHighlights = [
    ...(focusedMetric
      ? [{
          label: t("statusVitals.voiceMetric", "Metric"),
          value: t(METRIC_META[focusedMetric].labelKey, METRIC_META[focusedMetric].fallbackLabel),
          tone: "good" as const,
        }]
      : []),
    ...(focusedMetricSummary?.latest_value
      ? [{
          label: t("statusVitals.voiceLatest", "Latest"),
          value: `${focusedMetricSummary.latest_value} ${METRIC_META[focusedMetric!].unit}`,
          tone: "neutral" as const,
        }]
      : []),
    ...(latestReadingAt
      ? [{
          label: t("statusVitals.voiceLastScan", "Last scan"),
          value: latestText,
          tone: "neutral" as const,
        }]
      : []),
  ];
  const measurementModes = [
    {
      id: "phone",
      Icon: ScanLine,
      title: t("statusVitals.capabilities.phoneTitle", "Phone estimate"),
      body: t("statusVitals.capabilities.phoneBody", "Camera-based pulse and breathing trend. Useful for a quick check, not a medical device reading."),
      items: [
        t("statusVitals.capabilities.pulse", "Pulse"),
        t("statusVitals.capabilities.breathing", "Breathing"),
      ],
      color: "#6B21A8",
      bg: "#F5F3FF",
    },
    {
      id: "manual",
      Icon: Plus,
      title: t("statusVitals.capabilities.manualTitle", "Manual log"),
      body: t("statusVitals.capabilities.manualBody", "Add numbers from a cuff, oximeter, thermometer, glucose meter, or how you feel today."),
      items: [
        t("statusVitals.capabilities.bp", "BP"),
        t("statusVitals.capabilities.oxygen", "Oxygen"),
        t("statusVitals.capabilities.temp", "Temp"),
        t("statusVitals.capabilities.glucose", "Glucose"),
        t("statusVitals.capabilities.pain", "Pain"),
        t("statusVitals.capabilities.mood", "Mood"),
        t("statusVitals.capabilities.energy", "Energy"),
        t("statusVitals.capabilities.sleep", "Sleep"),
        t("statusVitals.capabilities.medication", "Medication"),
      ],
      color: "#92400E",
      bg: "#FEF3C7",
    },
    {
      id: "device",
      Icon: Watch,
      title: t("statusVitals.capabilities.deviceTitle", "Device or clinical"),
      body: t("statusVitals.capabilities.deviceBody", "Connected devices and clinical readings carry the strongest weight in VYVA's safety checks."),
      items: [
        t("statusVitals.capabilities.highConfidence", "Higher confidence"),
        t("statusVitals.capabilities.safetyChecks", "Safety checks"),
      ],
      color: "#047857",
      bg: "#D1FAE5",
    },
  ];

  const shareStatus = async () => {
    const lines = (["hr", "rr", "bp"] as MetricType[]).map((key) => {
      const meta = METRIC_META[key];
      const value = summary?.[key]?.latest_value;
      return `${t(meta.labelKey, meta.fallbackLabel)}: ${value ? `${value} ${meta.unit}` : t("statusVitals.noReading", "no reading")}`;
    });
    const text = `${t("statusVitals.shareTitle", "VYVA Status / Vitals")}\n${lines.join("\n")}\n${t("statusVitals.shareUpdated", "Updated")}: ${latestText}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: t("statusVitals.shareTitle", "VYVA Status / Vitals"), text });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    await navigator.clipboard.writeText(text);
    toast({ description: t("statusVitals.copied", "Vitals summary copied.") });
  };

  return (
    <HealthWizardShell>
      <HealthWizardTopBar
        title={t("statusVitals.title", "Status / Vitals")}
        kicker={t("health.quickTiles.status.label", "Vitals")}
        onBack={() => navigate("/health")}
        backLabel={t("common.back", "Back")}
        className="mb-3"
      />

      <VoiceHero
        heroSurface="vitals"
        sourceText={t("statusVitals.heroSource", "Status / Vitals")}
        headline={t("statusVitals.heroHeadline", "Vitals are ready when you are")}
        subtitle={latestReadingAt ? t("statusVitals.heroSubtitleWithLatest", { defaultValue: "Last reading: {{latest}}", latest: latestText }) : t("statusVitals.heroSubtitle", "Scan, log, and share your key health numbers.")}
        contextHint="status vitals heart rate breathing blood pressure"
        talkLabel={t("statusVitals.heroCta", "Ask about my vitals")}
      >
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/15 pt-4">
          <div>
            <p className="font-body text-[18px] font-bold text-white">{metricsWithData}/3</p>
            <p className="font-body text-[11px] leading-tight text-white/70">{t("statusVitals.heroMetrics", "metrics")}</p>
          </div>
          <div>
            <p className="font-body text-[18px] font-bold text-white">{filledDays}/7</p>
            <p className="font-body text-[11px] leading-tight text-white/70">{t("statusVitals.heroDays", "days")}</p>
          </div>
          <div>
            <p className="font-body text-[18px] font-bold text-white">{connectedDevices}</p>
            <p className="font-body text-[11px] leading-tight text-white/70">{t("statusVitals.heroDevices", "devices")}</p>
          </div>
        </div>
      </VoiceHero>

      <VoiceActionFulfillmentPanel
        domain="health"
        actionTypes={["health.vitals_review"]}
        title={t("statusVitals.contextPanelTitle", "Vitals context ready")}
        description={t("statusVitals.contextPanelDescription", "VYVA can use the latest readings, trend cards, and scan timing from this page.")}
        highlights={voiceActionHighlights}
        className="mt-4"
      />

      {user?.id && (
        <div className="mt-5">
          <VitalsTracker
            userId={user.id}
            userConditions={personalisationData?.conditions ?? []}
            language={vitalsTrackerLanguage(profile?.language ?? i18n.language)}
          />
        </div>
      )}

      <section
        className="mt-5 rounded-[26px] border border-[#E4D9CE] bg-white p-4 shadow-[0_10px_28px_rgba(63,45,35,0.07)]"
        data-testid="card-general-status"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px]" style={{ background: overallGood ? "#ECFDF5" : "#FFF7ED" }}>
            {overallGood ? <CheckCircle2 size={23} style={{ color: "#047857" }} /> : <AlertTriangle size={23} style={{ color: "#B45309" }} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-body text-[13px] font-semibold text-vyva-text-2">
                  {t("statusVitals.overallLabel", "Overall status")}
                </p>
                <p className="mt-1 font-body text-[17px] font-bold leading-snug text-vyva-text-1">
                  {overallGood
                    ? t("statusVitals.overallGood", "Stable pattern this week")
                    : t("statusVitals.overallNeedsData", "Add a reading to complete today")}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-1 font-body text-[11px] font-bold"
                style={{
                  background: overallGood ? "#D1FAE5" : "#FEF3C7",
                  color: overallGood ? "#047857" : "#B45309",
                }}
              >
                {overallGood ? t("health.statGood", "Good") : t("statusVitals.pending", "Pending")}
              </span>
            </div>
            <p className="mt-3 font-body text-[13px] leading-relaxed text-vyva-text-2">
              {t("statusVitals.overallBody", "Latest update")}: {latestText}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowScanModal(true)}
          className="flex min-h-[92px] flex-col justify-between rounded-[22px] bg-[#6B21A8] p-4 text-left shadow-[0_10px_24px_rgba(107,33,168,0.24)] active:scale-[0.98]"
          data-testid="button-open-vitals-scan"
        >
          <ScanLine size={21} className="text-white" />
          <span className="font-body text-[15px] font-bold leading-tight text-white">
            {t("statusVitals.scanAction", "Phone estimate")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setShowLogModal(true)}
          className="flex min-h-[92px] flex-col justify-between rounded-[22px] border border-[#EDE5DB] bg-white p-4 text-left shadow-[0_8px_22px_rgba(63,45,35,0.06)] active:scale-[0.98]"
          data-testid="button-log-reading"
        >
          <Plus size={21} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[15px] font-bold leading-tight text-vyva-text-1">
            {t("statusVitals.logAction", "Confirmed reading")}
          </span>
        </button>
      </div>

      <p className="mt-3 rounded-[20px] border border-[#EDE5DB] bg-white px-4 py-3 font-body text-[13px] font-semibold leading-relaxed text-vyva-text-2">
        {t("statusVitals.sourceNote", "Phone scans are estimates for trends. Device or manual readings are stronger evidence for VYVA.")}
      </p>

      <section className="mt-4 rounded-[24px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="vitals-capabilities-guide">
        <div className="mb-3 flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
            <ShieldCheck size={20} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.11em] text-vyva-purple">
              {t("statusVitals.capabilities.title", "What VYVA can measure")}
            </p>
            <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
              {t("statusVitals.capabilities.subtitle", "Different readings have different confidence. VYVA labels that before using them in assessments.")}
            </p>
          </div>
        </div>
        <div className="grid gap-3">
          {measurementModes.map(({ id, Icon, title, body, items, color, bg }) => (
            <div key={id} className="flex items-start gap-3 border-t border-[#F0E7DE] pt-3 first:border-t-0 first:pt-0">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px]" style={{ color, background: bg }}>
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-extrabold leading-tight text-vyva-text-1">{title}</p>
                <p className="mt-1 font-body text-[13px] font-semibold leading-snug text-vyva-text-2">{body}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <span key={item} className="rounded-full px-2.5 py-1 font-body text-[11px] font-bold" style={{ color, background: bg }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <HealthWizardSectionLabel
        action={(
          <button
            type="button"
            onClick={shareStatus}
            className="flex min-h-[38px] items-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-3 font-body text-[12px] font-bold text-[#6B21A8]"
            data-testid="button-share-vitals-summary"
          >
            <Share2 size={14} />
            {t("statusVitals.share", "Share")}
          </button>
        )}
      >
        {t("statusVitals.keyMetrics", "Key metrics")}
      </HealthWizardSectionLabel>

      <div className="flex flex-col gap-3">
        {isLoading
          ? (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <div key={key} className="h-[112px] animate-pulse rounded-[24px] bg-white shadow-[0_8px_24px_rgba(63,45,35,0.06)]" />
            ))
          : (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <MetricCard key={key} metricKey={key} summary={summary?.[key]} t={t} highlighted={focusedMetric === key} />
            ))}
      </div>

      <section className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="card-compliance">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-body text-[13px] font-bold uppercase tracking-[0.11em] text-vyva-text-2">
              {t("statusVitals.weeklyRhythm", "Weekly rhythm")}
            </p>
            <p className="mt-1 font-body text-[15px] font-bold text-vyva-text-1">
              {t("statusVitals.daysWithReadings", { defaultValue: "{{count}} of 7 days with readings", count: filledDays })}
            </p>
          </div>
          <span className="rounded-full bg-[#FFF7ED] px-3 py-1 font-body text-[12px] font-bold text-[#B45309]">{completionPct}%</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {complianceDays.map((done, index) => (
            <div key={`${index}-${done}`} className="flex flex-col items-center gap-1">
              <div
                className="h-8 w-full rounded-[10px]"
                style={{
                  background: done ? "#6B21A8" : "#E8DED4",
                  opacity: done ? 1 : 0.5,
                }}
                data-testid={`compliance-day-${index}`}
              />
              <span className="font-body text-[10px] font-semibold text-vyva-text-2">{t(DAY_LABELS[index].key, DAY_LABELS[index].fallback)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-white shadow-[0_8px_24px_rgba(63,45,35,0.06)]">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <p className="font-body text-[13px] font-bold uppercase tracking-[0.11em] text-vyva-text-2">
            {t("statusVitals.devices", "Devices")}
          </p>
          <span className="font-body text-[12px] font-bold text-[#047857]">
            {connectedDevices} {t("statusVitals.connected", "connected")}
          </span>
        </div>
        {DEVICE_ROWS.map((device, index) => {
          const Icon = device.Icon;
          return (
            <div
              key={device.id}
              className={`flex items-center gap-3 px-4 py-3 ${index < DEVICE_ROWS.length - 1 ? "border-b border-[#F0E7DE]" : ""}`}
              data-testid={`row-device-${device.id}`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F7F1E9]">
                <Icon size={17} className="text-vyva-text-2" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[14px] font-bold leading-tight text-vyva-text-1">{t(device.labelKey, device.fallbackLabel)}</p>
                <p className="font-body text-[12px] text-vyva-text-2">{device.model}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: device.connected ? "#047857" : "#D1D5DB" }} />
                <span className="font-body text-[11px] font-semibold" style={{ color: device.connected ? "#047857" : "#9CA3AF" }}>
                  {device.connected ? t("statusVitals.online", "Online") : t("statusVitals.offline", "Offline")}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-5 rounded-[24px] border border-[#EDE5DB] bg-white p-4 shadow-[0_8px_24px_rgba(63,45,35,0.06)]" data-testid="card-sharing">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#F5F3FF]">
            <ShieldCheck size={21} style={{ color: "#6B21A8" }} />
          </div>
          <div className="min-w-0">
            <p className="font-body text-[15px] font-bold text-vyva-text-1">
              {t("statusVitals.sharingTitle", "Share with care team")}
            </p>
            <p className="mt-1 font-body text-[13px] leading-relaxed text-vyva-text-2">
              {t("statusVitals.sharingBody", "Copy a clean summary for a caregiver, doctor, or upcoming appointment.")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={shareStatus}
            className="vyva-secondary-action min-h-[52px] rounded-[16px] px-3 text-[14px]"
            data-testid="button-share-care-team"
          >
            <Users size={16} />
            {t("statusVitals.copySummary", "Copy")}
          </button>
          <button
            type="button"
            onClick={() => navigate("/health/doctor")}
            className="vyva-primary-action min-h-[52px] rounded-[16px] text-[14px]"
            data-testid="button-contact-doctor"
          >
            <Phone size={16} />
            {t("statusVitals.doctor", "Doctor")}
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-[22px] border border-[#FED7AA] bg-[#FFFBEB] p-4">
        <div className="flex items-start gap-3">
          <ClipboardList size={18} className="mt-0.5 flex-shrink-0" style={{ color: "#B45309" }} />
          <p className="font-body text-[12px] leading-relaxed" style={{ color: "#92400E" }}>
            {t("statusVitals.disclaimer", "Vitals are informational and do not replace medical care. If symptoms are severe or sudden, contact emergency services.")}
          </p>
        </div>
      </section>

      {showLogModal && <LogReadingModal onClose={() => setShowLogModal(false)} />}
      {showScanModal && <ScanModal onClose={() => setShowScanModal(false)} />}
    </HealthWizardShell>
  );
};

export default SignosScreen;
