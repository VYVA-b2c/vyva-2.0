import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/queryClient";
import {
  Heart,
  Wind,
  Activity,
  Watch,
  Stethoscope,
  Plus,
  ChevronDown,
  ChevronUp,
  Share2,
  Phone,
  ClipboardList,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import VoiceHero from "@/components/VoiceHero";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { BackButton, SectionTitle } from "@/components/vyva-ui";
import { useToast } from "@/hooks/use-toast";
import { useVoiceActionFulfillment } from "@/hooks/useVoiceActionFulfillment";

const METRIC_META = {
  hr: {
    id: "hr",
    Icon: Heart,
    iconColor: "#BE123C",
    iconBg: "#FFF1F2",
    labelKey: "health.vitalsPage.metrics.hr.label",
    labelFallback: "Heart rate",
    unit: "bpm",
    placeholderKey: "health.vitalsPage.metrics.hr.placeholder",
    placeholderFallback: "e.g. 72",
    statusKey: "health.vitalsPage.metrics.hr.defaultStatus",
    statusFallback: "Normal",
    statusColor: "#16A34A",
    statusBg: "#F0FDF4",
  },
  rr: {
    id: "rr",
    Icon: Wind,
    iconColor: "#0369A1",
    iconBg: "#EFF6FF",
    labelKey: "health.vitalsPage.metrics.rr.label",
    labelFallback: "Respiratory rate",
    unit: "rpm",
    placeholderKey: "health.vitalsPage.metrics.rr.placeholder",
    placeholderFallback: "e.g. 16",
    statusKey: "health.vitalsPage.metrics.rr.defaultStatus",
    statusFallback: "Stable",
    statusColor: "#1D4ED8",
    statusBg: "#EFF6FF",
  },
  bp: {
    id: "bp",
    Icon: Activity,
    iconColor: "#7C3AED",
    iconBg: "#F5F3FF",
    labelKey: "health.vitalsPage.metrics.bp.label",
    labelFallback: "Blood pressure",
    unit: "mmHg",
    placeholderKey: "health.vitalsPage.metrics.bp.placeholder",
    placeholderFallback: "e.g. 118/76",
    statusKey: "health.vitalsPage.metrics.bp.defaultStatus",
    statusFallback: "Normal",
    statusColor: "#16A34A",
    statusBg: "#F0FDF4",
  },
} as const;

type MetricType = keyof typeof METRIC_META;

const DEVICE_META = [
  {
    id: "watch",
    Icon: Watch,
    labelKey: "health.vitalsPage.devices.watch.label",
    labelFallback: "Smartwatch",
    modelKey: "health.vitalsPage.devices.watch.model",
    modelFallback: "VYVA Band 2",
    connected: true,
  },
  {
    id: "bp-cuff",
    Icon: Activity,
    labelKey: "health.vitalsPage.devices.bpCuff.label",
    labelFallback: "Blood pressure cuff",
    modelKey: "health.vitalsPage.devices.bpCuff.model",
    modelFallback: "OmronConnect",
    connected: true,
  },
  {
    id: "stethoscope",
    Icon: Stethoscope,
    labelKey: "health.vitalsPage.devices.stethoscope.label",
    labelFallback: "Digital stethoscope",
    modelKey: "health.vitalsPage.devices.stethoscope.model",
    modelFallback: "Eko DUO",
    connected: false,
  },
];

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

interface VitalsSummaryEntry {
  latest_value: string | null;
  latest_recorded_at: string | null;
  trend: (string | null)[];
  has_data: boolean;
}

interface VitalsResponse {
  summary: Record<string, VitalsSummaryEntry>;
  compliance_days: boolean[];
}

function parseNumericValue(val: string | null): number | null {
  if (!val) return null;
  const n = parseFloat(val.split("/")[0]);
  return isNaN(n) ? null : n;
}

function buildTrend(trend: (string | null)[]): number[] {
  const numeric = trend.map((v) => parseNumericValue(v) ?? 0);
  return numeric;
}

function focusedMetricFromVoice(value: string): MetricType | null {
  const normalized = value.toLowerCase();
  if (normalized.includes("blood") || normalized.includes("pressure") || normalized.includes("presion")) return "bp";
  if (normalized.includes("resp") || normalized.includes("breath") || normalized.includes("rpm")) return "rr";
  if (normalized.includes("heart") || normalized.includes("pulse") || normalized.includes("card") || normalized.includes("bpm")) return "hr";
  return null;
}

function formatRecordedAt(
  iso: string | null,
  locale: string,
  labels: { today: string; yesterday: string },
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / (1000 * 60 * 60);
  if (diffH < 24) {
    return `${labels.today}, ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  if (diffH < 48) return labels.yesterday;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short" });
}

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-[3px] h-[36px] mt-3">
      {values.map((v, i) => {
        const height = Math.round(((v - min) / range) * 28) + 8;
        return (
          <div
            key={i}
            style={{
              height,
              flex: 1,
              borderRadius: 3,
              background: i === values.length - 1 ? "#6B21A8" : "hsl(var(--vyva-warm2))",
              opacity: i === values.length - 1 ? 1 : 0.6,
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
  highlighted = false,
}: {
  metricKey: MetricType;
  summary: VitalsSummaryEntry | undefined;
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const meta = METRIC_META[metricKey];
  const { Icon, iconColor, iconBg, unit, statusColor, statusBg } = meta;
  const label = t(meta.labelKey, meta.labelFallback);
  const defaultStatus = t(meta.statusKey, meta.statusFallback);

  const hasData = summary?.has_data === true;
  const displayValue = hasData ? (summary?.latest_value ?? "—") : "—";
  const trend = buildTrend(summary?.trend ?? Array(7).fill(null));
  const hasTrendData = hasData && trend.some((v) => v > 0);

  return (
    <div
      className={`vyva-card p-4 transition-all ${highlighted ? "ring-2 ring-emerald-200 bg-emerald-50" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            <Icon size={18} style={{ color: iconColor }} />
          </div>
          <div>
            <p className="font-body text-[12px] text-vyva-text-2">{label}</p>
            <p className="font-body text-[22px] font-bold text-vyva-text-1 leading-tight">
              {displayValue === "—"
                ? <span className="text-vyva-text-2 font-normal text-[16px]">{t("health.vitalsPage.noData", "No data")}</span>
                : (
                  <>
                    {displayValue}
                    <span className="text-[13px] font-normal ml-1 text-vyva-text-2">{unit}</span>
                  </>
                )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasData && (
            <span
              className="font-body text-[11px] font-semibold px-[10px] py-[3px] rounded-full"
              style={{ color: statusColor, background: statusBg }}
            >
              {defaultStatus}
            </span>
          )}
          {hasTrendData && (
            <button
              onClick={() => setExpanded((v) => !v)}
              data-testid={`button-metric-expand-${metricKey}`}
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "hsl(var(--vyva-warm))" }}
              aria-label={expanded
                ? t("health.vitalsPage.collapseTrend", "Collapse trend")
                : t("health.vitalsPage.expandTrend", "View trend")}
            >
              {expanded
                ? <ChevronUp size={16} className="text-vyva-text-2" />
                : <ChevronDown size={16} className="text-vyva-text-2" />}
            </button>
          )}
        </div>
      </div>

      {expanded && hasTrendData && (
        <div className="mt-2 pt-3 border-t border-vyva-warm">
          <p className="font-body text-[11px] text-vyva-text-2 mb-1">{t("health.vitalsPage.trend7d", "Last 7 days")}</p>
          <MiniBarChart values={trend} />
        </div>
      )}
    </div>
  );
}

function EventDot({ level }: { level: string }) {
  const colors: Record<string, string> = {
    amber: "#D97706",
    green: "#16A34A",
    neutral: "#9CA3AF",
  };
  return (
    <div
      className="w-2 h-2 rounded-full mt-[6px] flex-shrink-0"
      style={{ background: colors[level] ?? "#9CA3AF" }}
    />
  );
}

function LogReadingModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [metricType, setMetricType] = useState<MetricType>("hr");
  const [value, setValue] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/vitals", {
        method: "POST",
        body: JSON.stringify({ metric_type: metricType, value: value.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vitals"] });
      toast({
        title: t("health.vitalsPage.savedToastTitle", "Reading saved"),
        description: t("health.vitalsPage.savedToastDescription", "Your vital sign was recorded."),
      });
      onSaved();
    },
    onError: () => {
      toast({
        title: t("health.vitalsPage.saveErrorTitle", "Could not save reading"),
        description: t("health.vitalsPage.saveErrorDescription", "Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!value.trim()) return;
    mutation.mutate();
  };

  const meta = METRIC_META[metricType];
  const placeholder = t(meta.placeholderKey, meta.placeholderFallback);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-t-[24px] bg-white px-5 pt-5 pb-8"
        style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.12)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <p className="font-display italic text-[18px] text-vyva-text-1">{t("health.vitalsPage.modalTitle", "Log reading")}</p>
          <button
            onClick={onClose}
            data-testid="button-close-log-modal"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "hsl(var(--vyva-warm))" }}
          >
            <X size={16} className="text-vyva-text-2" />
          </button>
        </div>

        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-semibold uppercase tracking-wide">
          {t("health.vitalsPage.measurementType", "Measurement type")}
        </p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {(Object.keys(METRIC_META) as MetricType[]).map((key) => {
            const m = METRIC_META[key];
            const active = metricType === key;
            return (
              <button
                key={key}
                onClick={() => { setMetricType(key); setValue(""); }}
                data-testid={`button-metric-select-${key}`}
                className="flex flex-col items-center gap-1 py-3 rounded-[14px] transition-all"
                style={{
                  background: active ? "#6B21A8" : "hsl(var(--vyva-warm))",
                }}
              >
                <m.Icon size={16} style={{ color: active ? "#fff" : m.iconColor }} />
                <span
                  className="font-body text-[10px] font-semibold text-center leading-tight"
                  style={{ color: active ? "#fff" : "#6B21A8" }}
                >
                  {m.unit}
                </span>
              </button>
            );
          })}
        </div>

        <p className="font-body text-[12px] text-vyva-text-2 mb-2 font-semibold uppercase tracking-wide">
          {t("health.vitalsPage.valueLabel", "Value")} ({meta.unit})
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          data-testid="input-vitals-value"
          className="w-full rounded-[14px] px-4 py-[14px] font-body text-[18px] text-vyva-text-1 font-bold outline-none border-2 border-transparent focus:border-[#6B21A8] mb-5"
          style={{ background: "hsl(var(--vyva-warm))" }}
        />

        <button
          onClick={handleSubmit}
          disabled={!value.trim() || mutation.isPending}
          data-testid="button-save-vital"
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[14px] transition-all active:scale-[0.98] min-h-[52px] disabled:opacity-50"
          style={{ background: "#6B21A8" }}
        >
          <span className="font-body text-[14px] font-semibold text-white">
            {mutation.isPending
              ? t("health.vitalsPage.saving", "Saving...")
              : t("health.vitalsPage.saveReading", "Save reading")}
          </span>
        </button>
      </div>
    </div>
  );
}

const SignosScreen = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showLogModal, setShowLogModal] = useState(false);
  const { action: voiceAction, payloadValue: voicePayloadValue } = useVoiceActionFulfillment({
    domain: "health",
    actionTypes: ["health.vitals_review"],
  });

  const { data: vitalsData, isLoading } = useQuery<VitalsResponse>({
    queryKey: ["/api/vitals"],
  });

  const complianceDays = vitalsData?.compliance_days ?? Array(7).fill(false) as boolean[];
  const filledDays = complianceDays.filter(Boolean).length;

  const summary = vitalsData?.summary;

  const latestReadingAt = (() => {
    if (!summary) return null;
    const dates = (Object.values(summary) as VitalsSummaryEntry[])
      .map((s) => s.latest_recorded_at)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().reverse()[0];
  })();

  const recordedAtLabels = {
    today: t("health.vitalsPage.today", "Today"),
    yesterday: t("health.vitalsPage.yesterday", "Yesterday"),
  };
  const subtitleText = latestReadingAt
    ? `${t("health.vitalsPage.latestReadingLabel", "Latest reading")}: ${formatRecordedAt(latestReadingAt, i18n.language, recordedAtLabels)}`
    : `${t("health.vitalsPage.latestReadingLabel", "Latest reading")}: -`;

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
          label: t("health.vitalsPage.metricHighlight", "Metric"),
          value: t(METRIC_META[focusedMetric].labelKey, METRIC_META[focusedMetric].labelFallback),
          tone: "good" as const,
        }]
      : []),
    ...(focusedMetricSummary?.latest_value
      ? [{
          label: t("health.vitalsPage.latestHighlight", "Latest"),
          value: `${focusedMetricSummary.latest_value} ${METRIC_META[focusedMetric!].unit}`,
          tone: "neutral" as const,
        }]
      : []),
    ...(latestReadingAt
      ? [{
          label: t("health.vitalsPage.lastScanHighlight", "Last scan"),
          value: formatRecordedAt(latestReadingAt, i18n.language, recordedAtLabels),
          tone: "neutral" as const,
        }]
      : []),
  ];

  return (
    <div className="vyva-page">
      <BackButton
        to="/health"
        label={t("common.back", "Back")}
        data-testid="button-signos-back"
        className="mb-5"
      />

      <VoiceHero
        heroSurface="vitals"
        headline={t("health.vitalsPage.heroTitle", "Active monitoring")}
        subtitle={subtitleText}
        contextHint={t("health.vitalsPage.contextHint", "vital signs monitoring")}
        talkLabel={t("health.vitalsPage.scanVitals", "Scan my vitals")}
      >
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/15">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#34D399" }} />
            <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.82)" }}>
              {t("health.vitalsPage.activeDevices", "{{count}} active devices", { count: 3 })}
            </span>
          </div>
          <div className="w-[1px] h-[14px]" style={{ background: "rgba(255,255,255,0.2)" }} />
          <span className="font-body text-[12px]" style={{ color: "rgba(255,255,255,0.82)" }}>
            {t("health.vitalsPage.trackedDays", "{{count}}/7 days", { count: filledDays })}
          </span>
        </div>
      </VoiceHero>

      <VoiceActionFulfillmentPanel
        domain="health"
        actionTypes={["health.vitals_review"]}
        title={t("health.vitalsPage.contextPanelTitle", "Vitals context ready")}
        description={t("health.vitalsPage.contextPanelDescription", "VYVA can use the latest readings, trend cards, and scan timing from this page.")}
        highlights={voiceActionHighlights}
        className="mt-4 mb-4"
      />

      <div
        className="vyva-card p-4 mb-4 mt-5 flex items-center gap-4"
        data-testid="card-general-status"
      >
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "#F0FDF4" }}
        >
          <CheckCircle2 size={22} style={{ color: "#16A34A" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-body text-[13px] text-vyva-text-2">{t("health.vitalsPage.generalStatusLabel", "General status")}</p>
          <p className="font-body text-[16px] font-semibold text-vyva-text-1 leading-snug">
            {t("health.vitalsPage.generalStatusValue", "Stable - no relevant changes")}
          </p>
        </div>
        <span
          className="font-body text-[11px] font-bold px-[10px] py-[3px] rounded-full flex-shrink-0"
          style={{ color: "#16A34A", background: "#DCFCE7" }}
        >
          {t("health.vitalsPage.generalStatusBadge", "Good")}
        </span>
      </div>

      <SectionTitle
        className="mb-3"
        title={t("health.vitalsPage.keyMetrics", "Key metrics")}
        titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
        action={(
          <button
            onClick={() => setShowLogModal(true)}
            data-testid="button-log-reading"
            className="vyva-tap flex items-center gap-1.5 rounded-full px-3 py-[6px]"
            style={{ background: "#6B21A8" }}
          >
            <Plus size={13} className="text-white" />
            <span className="font-body text-[12px] font-semibold text-white">
              {t("health.vitalsPage.logReading", "Log")}
            </span>
          </button>
        )}
      />

      <div className="flex flex-col gap-3 mb-5">
        {isLoading
          ? (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <div
                key={key}
                className="vyva-card h-[72px] animate-pulse p-4"
              />
            ))
          : (["hr", "rr", "bp"] as MetricType[]).map((key) => (
              <MetricCard
                key={key}
                metricKey={key}
                summary={summary?.[key]}
                highlighted={focusedMetric === key}
              />
            ))}
      </div>

      <SectionTitle
        className="mb-3"
        title={t("health.vitalsPage.devicesTitle", "Devices")}
        titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
      />
      <div className="vyva-card overflow-hidden mb-5">
        {DEVICE_META.map((d, i) => (
          <div
            key={d.id}
            data-testid={`row-device-${d.id}`}
            className={`flex items-center gap-3 px-4 py-[14px] ${i < DEVICE_META.length - 1 ? "border-b border-vyva-warm" : ""}`}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "hsl(var(--vyva-warm))" }}
            >
              <d.Icon size={16} className="text-vyva-text-2" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-body text-[14px] font-semibold text-vyva-text-1">{t(d.labelKey, d.labelFallback)}</p>
              <p className="font-body text-[12px] text-vyva-text-2">{t(d.modelKey, d.modelFallback)}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: d.connected ? "#16A34A" : "#D1D5DB" }}
              />
              <span
                className="font-body text-[11px]"
                style={{ color: d.connected ? "#16A34A" : "#9CA3AF" }}
              >
                {d.connected
                  ? t("health.vitalsPage.connected", "Connected")
                  : t("health.vitalsPage.disconnected", "Disconnected")}
              </span>
            </div>
          </div>
        ))}
        <button
          data-testid="button-add-device"
          className="w-full flex items-center justify-center gap-2 py-3 border-t border-vyva-warm transition-colors active:bg-vyva-warm"
        >
          <Plus size={15} style={{ color: "#6B21A8" }} />
          <span className="font-body text-[14px] font-semibold" style={{ color: "#6B21A8" }}>
            {t("health.vitalsPage.addDevice", "Add device")}
          </span>
        </button>
      </div>

      <SectionTitle
        className="mb-3"
        title={t("health.vitalsPage.adherence", "Adherence")}
        titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
      />
      <div
        className="vyva-card p-4 mb-5"
        data-testid="card-compliance"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-body text-[14px] font-semibold text-vyva-text-1">
            {t("health.vitalsPage.complianceSummary", "{{count}} of 7 days with readings", { count: filledDays })}
          </p>
          <span
            className="font-body text-[11px] font-semibold px-[10px] py-[3px] rounded-full"
            style={{ color: "#D97706", background: "#FFF7ED" }}
          >
            {Math.round((filledDays / 7) * 100)}%
          </span>
        </div>
        <div className="flex gap-2">
          {complianceDays.map((done, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div
                className="w-full rounded-[6px]"
                style={{
                  height: 28,
                  background: done ? "#6B21A8" : "hsl(var(--vyva-warm2))",
                  opacity: done ? 1 : 0.45,
                }}
                data-testid={`compliance-day-${i}`}
              />
              <span className="font-body text-[10px] text-vyva-text-2">{DAY_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <SectionTitle
        className="mb-3"
        title={t("health.vitalsPage.actions", "Actions")}
        titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
      />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            id: "revisar",
            Icon: ClipboardList,
            label: t("health.vitalsPage.actionReviewSymptoms", "Review symptoms"),
            color: "#7C3AED",
            bg: "#F5F3FF",
            action: () => navigate("/health/symptom-check"),
          },
          {
            id: "contactar",
            Icon: Phone,
            label: t("health.vitalsPage.actionContactDoctor", "Contact doctor"),
            color: "#0369A1",
            bg: "#EFF6FF",
            action: () => {},
          },
          {
            id: "compartir",
            Icon: Share2,
            label: t("health.vitalsPage.actionShareReport", "Share report"),
            color: "#BE123C",
            bg: "#FFF1F2",
            action: () => {},
          },
        ].map((btn) => (
          <button
            key={btn.id}
            onClick={btn.action}
            data-testid={`button-action-${btn.id}`}
            className="flex flex-col items-center justify-center gap-2 rounded-[16px] py-4 px-2 transition-all active:scale-95 min-h-[80px]"
            style={{ background: btn.bg, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}
          >
            <btn.Icon size={20} style={{ color: btn.color }} />
            <span
              className="font-body text-[11px] font-semibold text-center leading-tight"
              style={{ color: btn.color }}
            >
              {btn.label}
            </span>
          </button>
        ))}
      </div>

      <SectionTitle
        className="mb-3"
        title={t("health.vitalsPage.shareData", "Share data")}
        titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
      />
      <div
        className="vyva-card p-4"
        data-testid="card-sharing"
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "#F5F3FF" }}
          >
            <Users size={20} style={{ color: "#6B21A8" }} />
          </div>
          <div className="flex-1">
            <p className="font-body text-[14px] font-semibold text-vyva-text-1">
              {t("health.vitalsPage.sharingTitle", "Caregivers and doctor")}
            </p>
            <p className="font-body text-[12px] text-vyva-text-2">
              {t("health.vitalsPage.sharingSubtitle", "Share your health data securely")}
            </p>
          </div>
        </div>
        <div
          className="rounded-[12px] p-3 mb-4 flex items-center gap-2"
          style={{ background: "#FFFBEB", border: "1px dashed #D97706" }}
        >
          <AlertTriangle size={14} style={{ color: "#D97706" }} />
          <p className="font-body text-[12px]" style={{ color: "#92400E" }}>
            {t("health.vitalsPage.noCaregiver", "No caregiver connected yet.")}
          </p>
        </div>
        <button
          data-testid="button-connect-caregiver"
          className="w-full flex items-center justify-center gap-2 py-[14px] rounded-[14px] transition-all active:scale-[0.98] min-h-[52px]"
          style={{ background: "#6B21A8" }}
        >
          <Plus size={16} className="text-white" />
          <span className="font-body text-[14px] font-semibold text-white">
            {t("health.vitalsPage.connectCaregiver", "Connect caregiver")}
          </span>
        </button>
      </div>

      {showLogModal && (
        <LogReadingModal
          onClose={() => setShowLogModal(false)}
          onSaved={() => setShowLogModal(false)}
        />
      )}
    </div>
  );
};

export default SignosScreen;
