import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronLeft, Share2, CheckCircle, AlertTriangle, Eye, ClipboardList, FileText, Heart, Loader2, PhoneCall, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VitalsScan from "@/components/VitalsScan";
import TriageChat from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import {
  HealthWizardCard,
  HealthWizardChoiceTile,
  HealthWizardHero,
  HealthWizardProgress,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, queryClient } from "@/lib/queryClient";

type Step = "intro" | "vitals" | "chat" | "report";

interface TriageSummary {
  chiefComplaint: string;
  symptoms: string[];
  urgency: "urgent" | "routine" | "monitor";
  recommendations: string[];
  disclaimer: string;
  aiSummary?: string;
  nextStepLabel?: string;
  nextStepLevel?: "emergency" | "doctor_today" | "doctor_24_48" | "monitor";
  triageReasons?: string[];
  watchSigns?: string[];
  profileConsiderations?: string[];
  vitalsNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  refinementContext?: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    quickAnswers: Array<{ id: string; label: string; value: string; kind: string }>;
    entryMode: "with_vitals" | "without_vitals";
    initialClue: string;
  };
}

type RefinementVitalKey = "glucose" | "bloodPressure" | "oxygen" | "respiratoryRate" | "temperature" | "pulse";

type RefinementVitalConfig = {
  key: RefinementVitalKey;
  title: string;
  unit: string;
  placeholder: string;
  helper: string;
  signalType: string;
  parse: (raw: string) => { value: number; extraValue?: number; display: string; vitals: Record<string, number> } | null;
};

type RefinementStatus = {
  state: "idle" | "saving" | "refining" | "done" | "error";
  message?: string;
};

type ReportSaveState = "idle" | "saving" | "saved" | "error";

type TriageHealthMemory = {
  healthContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  latestVitals?: string;
  latestSymptomReport?: string;
};

type TriageContextResponse = {
  memory: TriageHealthMemory;
  usedItems: string[];
};

type ProfileContactsResponse = {
  caregiverName?: string | null;
  caregiverContact?: string | null;
  gpName?: string | null;
  gpPhone?: string | null;
} | null;

type SavedTriageReport = {
  id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  urgency?: TriageSummary["urgency"];
  recommendations?: string[];
  disclaimer?: string;
  ai_summary?: string | null;
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
  created_at?: string;
};

function StepDots({ current, includeVitals }: { current: Step; includeVitals: boolean }) {
  const steps: Step[] = includeVitals ? ["vitals", "chat", "report"] : ["chat", "report"];
  const idx = steps.indexOf(current);
  return (
    <div className="mx-[18px] flex items-center gap-2 rounded-[22px] border border-[#E8DED4] bg-white/90 p-3 shadow-[0_8px_20px_rgba(63,45,35,0.06)]">
      {steps.map((s, i) => (
        <div
          key={s}
          className="h-3 flex-1 rounded-full transition-all"
          style={{
            background: i <= idx ? "hsl(var(--vyva-purple))" : "#E8DED4",
            opacity: i === idx ? 1 : i < idx ? 0.85 : 0.7,
          }}
        />
      ))}
    </div>
  );
}

function IntroScreen({
  onStartWithVitals,
  onStartWithoutVitals,
}: {
  onStartWithVitals: (clue: string) => void;
  onStartWithoutVitals: (clue: string) => void;
}) {
  const { t } = useTranslation();
  const [clue, setClue] = useState("");
  const cleanClue = clue.trim();
  const canStart = cleanClue.length >= 2;
  const quickClues = [
    t("health.symptomCheck.intro.clueHeadache", "Bad headache"),
    t("health.symptomCheck.intro.clueBreathing", "Short of breath"),
    t("health.symptomCheck.intro.clueDizzy", "Dizzy"),
    t("health.symptomCheck.intro.clueFever", "Fever"),
    t("health.symptomCheck.intro.clueFall", "I fell"),
    t("health.symptomCheck.intro.clueUrine", "Pain when I pee"),
  ];
  const choices = [
    {
      id: "with-vitals",
      title: t("health.symptomCheck.intro.withVitalsCta", "Check my vitals first"),
      className: "border-[#6B21A8] bg-white text-vyva-text-1",
      onClick: () => onStartWithVitals(cleanClue),
    },
    {
      id: "without-vitals",
      title: t("health.symptomCheck.intro.withoutVitalsCta", "Skip vitals"),
      className: "border-[#E8DED4] bg-white text-vyva-text-1",
      onClick: () => onStartWithoutVitals(cleanClue),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-[18px] py-5">
      <HealthWizardHero
        icon={<Stethoscope size={28} />}
        kicker={t("health.symptomCheck.intro.stepLabel", "Symptom check")}
        title={t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        body={t("health.symptomCheck.intro.clueSub", "Use a few words. VYVA will choose the right questions.")}
      />

      <HealthWizardCard className="grid gap-4">
        <label className="sr-only" htmlFor="symptom-clue">
          {t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        </label>
        <input
          id="symptom-clue"
          value={clue}
          onChange={(event) => setClue(event.target.value)}
          placeholder={t("health.symptomCheck.intro.cluePlaceholder", "For example: bad headache...")}
          data-testid="input-symptom-clue"
          className="min-h-[78px] rounded-[24px] border-2 border-[#DDD6FE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 shadow-[0_10px_26px_rgba(63,45,35,0.06)] outline-none placeholder:text-[#9A8C83] focus:border-[#6B21A8]"
        />
        <div className="flex flex-wrap gap-2">
          {quickClues.map((quickClue) => (
            <button
              key={quickClue}
              type="button"
              onClick={() => setClue(quickClue)}
              className="vyva-tap min-h-[58px] rounded-full border border-[#E8DED4] bg-[#FFFCF8] px-5 font-body text-[17px] font-extrabold text-vyva-text-1 shadow-[0_4px_12px_rgba(63,45,35,0.04)]"
            >
              {quickClue}
            </button>
          ))}
        </div>
      </HealthWizardCard>

      <div className="grid gap-4">
        {choices.map(({ id, title, onClick }) => (
          <HealthWizardChoiceTile
            key={id}
            onClick={onClick}
            disabled={!canStart}
            testId={`button-symptom-check-${id}`}
            icon={id === "with-vitals" ? <Heart size={24} /> : <ClipboardList size={24} />}
            title={title}
          >
            <ChevronLeft size={22} className={`rotate-180 ${id === "with-vitals" ? "text-vyva-purple" : "text-vyva-text-3"}`} />
          </HealthWizardChoiceTile>
        ))}
      </div>
    </div>
  );
}

function ReportConfig(summary: TriageSummary) {
  const level = summary.nextStepLevel ?? (summary.urgency === "urgent" ? "doctor_today" : summary.urgency === "routine" ? "doctor_24_48" : "monitor");
  if (level === "emergency") {
    return {
      bg: "linear-gradient(135deg, #B91C1C 0%, #EF4444 100%)",
      icon: AlertTriangle,
      label: "health.symptomCheck.report.emergencyLabel",
      fallbackLabel: "Emergency now",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_today") {
    return {
      bg: "linear-gradient(135deg, #B45309 0%, #F59E0B 100%)",
      icon: Stethoscope,
      label: "health.symptomCheck.report.doctorTodayLabel",
      fallbackLabel: "Doctor today",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_24_48") {
    return {
      bg: "linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)",
      icon: Eye,
      label: "health.symptomCheck.report.routineLabel",
      fallbackLabel: "Doctor within 24-48 hours",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    label: "health.symptomCheck.report.monitorLabel",
    fallbackLabel: "Monitor at home",
    pillBg: "rgba(255,255,255,0.25)",
    level,
  };
}

function uniqueLines(lines: string[]) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line, index, list) => list.findIndex((item) => item.toLowerCase() === line.toLowerCase()) === index);
}

function parseNumber(raw: string) {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) ? value : null;
}

function parseBloodPressure(raw: string) {
  const match = raw.trim().match(/^(\d{2,3})\s*[/ ]\s*(\d{2,3})$/);
  if (!match) return null;
  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  return { systolic, diastolic };
}

function reportText(summary: TriageSummary) {
  return [
    summary.chiefComplaint,
    ...summary.symptoms,
    ...(summary.triageReasons ?? []),
    ...(summary.profileConsiderations ?? []),
    ...(summary.vitalsNotes ?? []),
  ].join(" ").toLowerCase();
}

function ReportScreen({
  summary,
  bpm,
  respiratoryRate,
  durationSeconds,
  reportId,
  reportSaveState,
  profileContacts,
  refinementStatus,
  onRefineVital,
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  respiratoryRate: number | null;
  durationSeconds: number | null;
  reportId: string | null;
  reportSaveState: ReportSaveState;
  profileContacts?: ProfileContactsResponse;
  refinementStatus: RefinementStatus;
  onRefineVital: (config: RefinementVitalConfig, rawValue: string) => Promise<void>;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const cfg = ReportConfig(summary);
  const UrgencyIcon = cfg.icon;
  const isEmergency = cfg.level === "emergency";
  const [openVitalKey, setOpenVitalKey] = useState<RefinementVitalKey | null>(null);
  const [vitalInputs, setVitalInputs] = useState<Record<string, string>>({});
  const [vitalInputError, setVitalInputError] = useState<string | null>(null);
  const saveStatusText = reportSaveState === "saved"
    ? t("health.symptomCheck.report.savedToReports", "Saved to Reports")
    : reportSaveState === "saving"
      ? t("health.symptomCheck.report.savingReport", "Saving report...")
      : reportSaveState === "error"
        ? t("health.symptomCheck.report.saveFailed", "Report not saved")
        : t("health.symptomCheck.report.readyReport", "Report ready");
  const durationText = durationSeconds != null
    ? durationSeconds < 60
      ? `${durationSeconds}s`
      : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : null;
  const doctorContactName = profileContacts?.gpName?.trim() || (profileContacts?.gpPhone?.trim() ? t("health.symptomCheck.report.doctorContact", "your doctor") : "");
  const caregiverContactName = profileContacts?.caregiverName?.trim() || (profileContacts?.caregiverContact?.trim() ? t("health.symptomCheck.report.caregiverContact", "your caregiver") : "");
  const notifiedContacts = [
    doctorContactName ? { id: "doctor", label: doctorContactName } : null,
    caregiverContactName ? { id: "caregiver", label: caregiverContactName } : null,
  ].filter(Boolean) as Array<{ id: string; label: string }>;
  const notifiedText = notifiedContacts.length === 2
    ? t("health.symptomCheck.report.sentToBoth", "A copy of this report has been sent to {{first}} and {{second}}.", {
        first: notifiedContacts[0].label,
        second: notifiedContacts[1].label,
      })
    : notifiedContacts.length === 1
      ? t("health.symptomCheck.report.sentToOne", "A copy of this report has been sent to {{contact}}.", {
          contact: notifiedContacts[0].label,
        })
      : "";
  const contactStatusText = notifiedText || t("health.symptomCheck.report.noContactsConfigured", "No doctor or caregiver contact is set yet.");
  const actionText = reportText(summary);
  const vitalActions: RefinementVitalConfig[] = [
    /\b(glucose|sugar|diabetes|diabetic|insulin|cgm)\b/.test(actionText)
      ? {
          key: "glucose",
          title: t("health.symptomCheck.report.checkGlucoseNow", "Check glucose now"),
          unit: "mg/dL",
          placeholder: "92",
          helper: t("health.symptomCheck.report.checkGlucoseReason", "Add the number to this report before you speak to a doctor."),
          signalType: "glucose_mgdl",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} mg/dL`, vitals: { glucoseMgdl: value } };
          },
        }
      : null,
    /\b(blood pressure|bp|hypertension|180\/120|pressure)\b/.test(actionText)
      ? {
          key: "bloodPressure",
          title: t("health.symptomCheck.report.checkBloodPressureNow", "Check blood pressure now"),
          unit: "",
          placeholder: "120/80",
          helper: t("health.symptomCheck.report.checkBloodPressureReason", "Enter both numbers, for example 120/80."),
          signalType: "bp_systolic",
          parse: (raw) => {
            const bp = parseBloodPressure(raw);
            return bp ? { value: bp.systolic, extraValue: bp.diastolic, display: `${bp.systolic}/${bp.diastolic}`, vitals: { systolicBp: bp.systolic, diastolicBp: bp.diastolic } } : null;
          },
        }
      : null,
    /\b(oxygen|spo2|short of breath|breathing|breathless|blue lips)\b/.test(actionText)
      ? {
          key: "oxygen",
          title: t("health.symptomCheck.report.checkOxygenNow", "Check oxygen now"),
          unit: "%",
          placeholder: "96",
          helper: t("health.symptomCheck.report.checkOxygenReason", "Add your oxygen reading if you have a pulse oximeter."),
          signalType: "spo2_pct",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value}%`, vitals: { oxygenSaturation: value } };
          },
        }
      : null,
    /\b(respiratory rate|breathing rate|breaths per minute|fast breathing)\b/.test(actionText)
      ? {
          key: "respiratoryRate",
          title: t("health.symptomCheck.report.checkBreathingRateNow", "Check breathing rate now"),
          unit: "/min",
          placeholder: "16",
          helper: t("health.symptomCheck.report.checkBreathingRateReason", "Count breaths for one minute, or use the scan result."),
          signalType: "respiratory_rate",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value}/min`, vitals: { respiratoryRate: value } };
          },
        }
      : null,
    /\b(fever|temperature|chills|infection)\b/.test(actionText)
      ? {
          key: "temperature",
          title: t("health.symptomCheck.report.checkTemperatureNow", "Check temperature now"),
          unit: "C",
          placeholder: "37.8",
          helper: t("health.symptomCheck.report.checkTemperatureReason", "Add the thermometer reading."),
          signalType: "temperature_c",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} C`, vitals: { temperatureC: value } };
          },
        }
      : null,
    /\b(pulse|heart rate|heartbeat|afib|irregular)\b/.test(actionText)
      ? {
          key: "pulse",
          title: t("health.symptomCheck.report.checkPulseNow", "Check pulse now"),
          unit: "bpm",
          placeholder: "72",
          helper: t("health.symptomCheck.report.checkPulseReason", "Add pulse from a device or count it manually."),
          signalType: "resting_hr_bpm",
          parse: (raw) => {
            const value = parseNumber(raw);
            return value == null ? null : { value, display: `${value} bpm`, vitals: { pulseBpm: value } };
          },
        }
      : null,
  ].filter(Boolean) as RefinementVitalConfig[];
  const doctorTellItems = uniqueLines([
    `${t("health.symptomCheck.report.tellMainSymptom", "Main symptom")}: ${summary.chiefComplaint}`,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why VYVA chose this")}: ${summary.triageReasons.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
  ]).slice(0, 6);
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    `${t("health.symptomCheck.report.urgencyLabel", "Urgency")}: ${t(cfg.label, cfg.fallbackLabel)}`,
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why VYVA chose this")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    summary.recommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${summary.recommendations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };

  const handleRefineVital = async (config: RefinementVitalConfig, rawValue: string) => {
    const parsed = config.parse(rawValue);
    if (!parsed) {
      setVitalInputError(t("health.symptomCheck.report.enterValidReading", "Enter a valid reading first."));
      return;
    }
    setVitalInputError(null);
    await onRefineVital(config, rawValue);
  };

  const shareText = [
    t("health.symptomCheck.report.shareTitle"),
    "",
    `${t("health.symptomCheck.report.chiefComplaint")}: ${summary.chiefComplaint}`,
    bpm != null ? `${t("health.symptomCheck.scan.heartRate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Resp. Rate")}: ${respiratoryRate} rpm` : "",
    durationText ? `${t("health.symptomCheck.report.timeTaken", "Time taken")}: ${durationText}` : "",
    "",
    `${t("health.symptomCheck.report.urgencyLabel")}: ${t(cfg.label, cfg.fallbackLabel)}`,
    summary.nextStepLabel ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${summary.nextStepLabel}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Why VYVA chose this")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    "",
    t("health.symptomCheck.report.recommendations") + ":",
    ...summary.recommendations.map((r, i) => `${i + 1}. ${r}`),
    "",
    t("health.symptomCheck.report.disclaimer"),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("health.symptomCheck.report.shareTitle"), text: shareText });
        return;
      } catch {
        /* user cancelled or not supported */
      }
    }
    const copied = await navigator.clipboard.writeText(shareText).then(() => true).catch(() => false);
    if (copied) {
      toast({
        title: t("health.symptomCheck.report.copiedToast"),
        description: t("health.symptomCheck.report.copiedToastDesc"),
      });
    }
  };

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div
        className={`mx-[18px] mb-4 mt-4 flex flex-col gap-3 rounded-[30px] p-5 shadow-[0_16px_36px_rgba(91,18,160,0.18)] ${isEmergency ? "motion-safe:animate-pulse" : ""}`}
        style={{ background: cfg.bg }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px]"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            <UrgencyIcon size={24} className="text-white" />
          </div>
          <div>
            <p className="font-body text-[12px] font-medium text-white/75 uppercase tracking-wider">
              {t("health.symptomCheck.report.urgencyLabel")}
            </p>
            <p className="font-display text-[28px] italic leading-tight text-white">
              {t(cfg.label, cfg.fallbackLabel)}
            </p>
          </div>
        </div>

        <p className="font-body text-[21px] font-black leading-tight text-white">
          {summary.nextStepLabel ?? t(cfg.label, cfg.fallbackLabel)}
        </p>
        <p className="font-body text-[16px] font-bold text-white/90 leading-relaxed">
          {summary.chiefComplaint}
        </p>

        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 self-start"
          style={{ background: cfg.pillBg }}
        >
          <Heart size={13} className="text-white" />
          <span className="font-body text-[13px] text-white font-semibold">
            {bpm != null ? `${bpm} bpm` : `${t("health.symptomCheck.scan.heartRate")}: —`}
          </span>
        </div>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 self-start"
          style={{ background: cfg.pillBg }}
        >
          <ClipboardList size={13} className="text-white" />
          <span className="font-body text-[13px] text-white font-semibold">
            {saveStatusText}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-[18px] pb-6">
        <div className="grid grid-cols-2 gap-3">
          {isEmergency ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = "tel:112";
              }}
              data-testid="button-report-emergency"
              className="vyva-tap col-span-2 flex min-h-[96px] items-center justify-between rounded-[24px] bg-[#DC2626] p-5 text-left text-white shadow-[0_16px_36px_rgba(220,38,38,0.28)]"
            >
              <span className="flex items-center gap-3">
                <PhoneCall size={26} />
                <span className="font-body text-[20px] font-black leading-tight">
                  {t("health.symptomCheck.report.callEmergency", "Call emergency services")}
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openDoctorWithContext}
              data-testid="button-report-doctor"
              className="vyva-tap col-span-2 flex min-h-[96px] items-center justify-between rounded-[24px] bg-[#6B21A8] p-5 text-left text-white shadow-[0_16px_36px_rgba(107,33,168,0.24)]"
            >
              <span className="flex items-center gap-3">
                <Stethoscope size={26} />
                <span className="font-body text-[20px] font-black leading-tight">
                  {t("health.symptomCheck.report.callDoctor", "Talk to a real doctor")}
                </span>
              </span>
            </button>
          )}
          {summary.nextStepLabel && (
            <div className="col-span-2 rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.nextStep", "Next step")}
              </p>
              <p className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                {summary.nextStepLabel}
              </p>
            </div>
          )}
          {summary.triageReasons?.length ? (
            <div className="col-span-2 rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 text-vyva-purple shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle size={18} />
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.whyThisStep", "Why VYVA chose this")}
                </p>
              </div>
              <ul className="grid gap-2">
                {summary.triageReasons.slice(0, 3).map((reason, index) => (
                  <li key={index} className="font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {vitalActions.map((action) => {
            const open = openVitalKey === action.key;
            const value = vitalInputs[action.key] ?? "";
            const busy = refinementStatus.state === "saving" || refinementStatus.state === "refining";
            return (
              <div key={action.key} className="col-span-2 rounded-[26px] border-2 border-[#6B21A8] bg-white p-4 shadow-[0_14px_34px_rgba(107,33,168,0.16)]">
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-[#F5F3FF] text-vyva-purple">
                    <Activity size={28} />
                  </span>
                  <div>
                    <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                      {t("health.symptomCheck.report.actionNeeded", "Action now")}
                    </p>
                    <p className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                      {action.title}
                    </p>
                    <p className="mt-1 font-body text-[16px] font-bold leading-snug text-vyva-text-2">
                      {action.helper}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenVitalKey(action.key);
                      setVitalInputs((current) => ({
                        ...current,
                        [action.key]: action.key === "glucose" ? "92" : action.placeholder,
                      }));
                      setVitalInputError(null);
                    }}
                    disabled={busy}
                    className="vyva-tap flex min-h-[76px] items-center justify-between rounded-[22px] bg-[#6B21A8] px-5 text-left text-white shadow-[0_12px_26px_rgba(107,33,168,0.22)]"
                  >
                    <span className="font-body text-[18px] font-black leading-tight">
                      {t("health.symptomCheck.report.readConnectedSensor", "Read from connected sensor")}
                    </span>
                    <ChevronLeft size={22} className="rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenVitalKey(action.key);
                      setVitalInputError(null);
                    }}
                    disabled={busy}
                    className="vyva-tap flex min-h-[76px] items-center justify-between rounded-[22px] border border-[#E8DED4] bg-[#FAF9F6] px-5 text-left text-vyva-text-1"
                  >
                    <span className="font-body text-[18px] font-black leading-tight">
                      {t("health.symptomCheck.report.enterManualReading", "Enter manually")}
                    </span>
                    <ChevronLeft size={22} className="rotate-180 text-vyva-purple" />
                  </button>
                  {open ? (
                    <div className="grid gap-3 border-t border-[#EADFD5] pt-3">
                      <label className="flex min-h-[86px] items-baseline gap-3 rounded-[24px] border-2 border-[#DDD6FE] bg-white px-5">
                        <input
                          type="text"
                          inputMode={action.key === "bloodPressure" ? "text" : "decimal"}
                          value={value}
                          onChange={(event) => setVitalInputs((current) => ({ ...current, [action.key]: event.target.value }))}
                          placeholder={action.placeholder}
                          className="min-w-0 flex-1 bg-transparent font-body text-[48px] font-black leading-none text-vyva-text-1 outline-none placeholder:text-[#D6C7BA]"
                        />
                        <span className="font-body text-[20px] font-black text-vyva-text-2">{action.unit}</span>
                      </label>
                      {vitalInputError ? (
                        <p className="font-body text-[16px] font-black text-[#B91C1C]">{vitalInputError}</p>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRefineVital(action, value)}
                        className="vyva-tap flex min-h-[74px] items-center justify-center gap-3 rounded-[22px] bg-[#0A7C4E] px-5 font-body text-[20px] font-black text-white disabled:opacity-60"
                      >
                        {busy ? <Loader2 size={22} className="animate-spin" /> : <CheckCircle size={22} />}
                        {busy
                          ? t("health.symptomCheck.report.refining", "Updating your result...")
                          : t("health.symptomCheck.report.saveAndRefine", "Save and refine result")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
          {refinementStatus.message ? (
            <div className={`col-span-2 rounded-[22px] border p-4 font-body text-[17px] font-black leading-snug ${
              refinementStatus.state === "error"
                ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                : "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
            }`}>
              {refinementStatus.message}
            </div>
          ) : null}
          <div className="col-span-2 rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
            <div className="mb-3 flex items-center gap-2 text-vyva-purple">
              <Stethoscope size={19} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.tellDoctorTitle", "Tell the doctor")}
              </p>
            </div>
            <ul className="grid gap-2">
              {doctorTellItems.map((item, index) => (
                <li key={index} className="font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {(summary.evidenceSummary || summary.evidenceSources?.length) ? (
            <div className="col-span-2 rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[#1D4ED8] shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}
              </p>
              {summary.evidenceSummary ? (
                <p className="mt-2 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  {summary.evidenceSummary}
                </p>
              ) : null}
              {summary.evidenceSources?.length ? (
                <p className="mt-2 font-body text-[14px] font-extrabold leading-snug text-[#1D4ED8]">
                  {summary.evidenceSources.slice(0, 2).map((source) => source.title).filter(Boolean).join(" - ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => navigate(reportId ? `/informes/${reportId}` : "/informes")}
            data-testid="button-report-view-reports"
            className="vyva-tap flex min-h-[92px] flex-col justify-between rounded-[24px] bg-[#EFF6FF] p-4 text-left text-[#1D4ED8] shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <ClipboardList size={22} />
            <span className="font-body text-[16px] font-extrabold leading-tight">
              {t("health.symptomCheck.report.viewReports", "View reports")}
            </span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            data-testid="button-report-share-quick"
            className="vyva-tap flex min-h-[92px] flex-col justify-between rounded-[24px] bg-[#ECFDF5] p-4 text-left text-[#047857] shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <Share2 size={22} />
            <span className="font-body text-[16px] font-extrabold leading-tight">
              {t("health.symptomCheck.report.shareBtn", "Share Report")}
            </span>
          </button>
        </div>

        {summary.symptoms.length > 0 && (
          <div
            className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
          >
            <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
              {t("health.symptomCheck.report.symptoms")}
            </p>
            <ul className="flex flex-wrap gap-2">
              {summary.symptoms.map((s, i) => (
                <li key={i} className="rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[13px] font-bold text-[#6B21A8]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_12px_30px_rgba(63,45,35,0.06)]"
        >
          <p className="font-body text-[12px] font-semibold text-vyva-text-3 uppercase tracking-wider mb-3">
            {t("health.symptomCheck.report.recommendations")}
          </p>
          <ol className="flex flex-col gap-3">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-body text-[12px] font-bold text-white"
                  style={{ background: "hsl(var(--vyva-purple))" }}
                >
                  {i + 1}
                </span>
                <span className="font-body text-[15px] text-vyva-text-1 leading-relaxed pt-0.5">{rec}</span>
              </li>
            ))}
          </ol>
          <div className={`mt-5 flex items-start gap-3 border-t border-[#EADFD5] pt-4 ${notifiedText ? "text-[#047857]" : "text-vyva-text-2"}`}>
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${notifiedText ? "bg-[#DCFCE7]" : "bg-[#F5F3FF]"}`}>
              {notifiedText ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
            </span>
            <p className="font-body text-[17px] font-extrabold leading-snug">
              {contactStatusText}
            </p>
          </div>
        </div>

        {isEmergency ? (
          <div className="rounded-[24px] border-2 border-[#DC2626] bg-[#FEF2F2] p-5 text-[#991B1B] shadow-[0_12px_30px_rgba(220,38,38,0.14)]">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#DC2626] text-white">
                <AlertTriangle size={24} />
              </span>
              <p className="font-body text-[22px] font-black leading-tight">
                {t("health.symptomCheck.report.emergencyDoNotWait", "Do not wait")}
              </p>
            </div>
            <p className="font-body text-[18px] font-bold leading-snug">
              {t("health.symptomCheck.report.emergencyBody", "Call emergency services now. Do not drive yourself. Keep this report open for the responder.")}
            </p>
          </div>
        ) : null}

        {(summary.watchSigns?.length || summary.profileConsiderations?.length || summary.vitalsNotes?.length) && (
          <div className="grid gap-3">
            {summary.watchSigns?.length ? (
              <div className="rounded-[24px] border border-[#FED7AA] bg-[#FFF7ED] p-5 text-[#9A3412] shadow-[0_8px_24px_rgba(63,45,35,0.05)]">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.watchSigns", "Watch for")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {summary.watchSigns.slice(0, 3).map((sign, index) => (
                    <li key={index} className="font-body text-[16px] font-bold leading-snug">
                      {sign}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.profileConsiderations?.length || summary.vitalsNotes?.length ? (
              <div className="rounded-[24px] border border-[#DDD6FE] bg-[#F5F3FF] p-5 text-vyva-purple shadow-[0_8px_24px_rgba(63,45,35,0.05)]">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                  {t("health.symptomCheck.report.contextUsed", "What VYVA considered")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {[...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? [])].slice(0, 4).map((note, index) => (
                    <li key={index} className="font-body text-[16px] font-bold leading-snug">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <div
          className="rounded-[24px] border border-[#E8DED4] bg-white p-5 shadow-[0_8px_24px_rgba(63,45,35,0.06)]"
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <FileText size={20} />
            </span>
            <div>
              <p className="font-body text-[12px] font-semibold uppercase tracking-wider text-vyva-text-3">
                {t("health.symptomCheck.report.doctorNoteTitle", "Doctor-ready note")}
              </p>
              <p className="font-body text-[13px] font-semibold text-vyva-text-2">
                {t("health.symptomCheck.report.doctorNoteSub", "Plain text to read, show, or share.")}
              </p>
            </div>
          </div>
          <p className="whitespace-pre-line rounded-[18px] bg-[#FAF7F3] p-4 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
            {doctorNote}
          </p>
        </div>

        <button
          onClick={handleShare}
          data-testid="button-report-share"
          className="vyva-primary-action w-full"
        >
          <Share2 size={18} />
          {t("health.symptomCheck.report.shareBtn")}
        </button>

        <button
          onClick={onDone}
          data-testid="button-report-done"
          className="vyva-secondary-action w-full"
        >
          {t("health.symptomCheck.report.doneBtn")}
        </button>

        <p className="font-body text-[11px] text-vyva-text-3 text-center leading-relaxed px-2">
          {t("health.symptomCheck.report.disclaimer")}
        </p>
      </div>
    </div>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: triageContext } = useQuery<TriageContextResponse>({
    queryKey: ["/api/triage/context"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: profileContacts } = useQuery<ProfileContactsResponse>({
    queryKey: ["/api/profile"],
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const [step, setStep] = useState<Step>("intro");
  const [bpm, setBpm] = useState<number | null>(null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(null);
  const [chatStartTime, setChatStartTime] = useState<number | null>(null);
  const [chatEntryMode, setChatEntryMode] = useState<"vitals" | "direct">("vitals");
  const [initialClue, setInitialClue] = useState("");
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>("idle");
  const [reportId, setReportId] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [refinementStatus, setRefinementStatus] = useState<RefinementStatus>({ state: "idle" });

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    vitals: t("health.symptomCheck.scan.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.title"),
  };

  const handleBack = () => {
    if (step === "intro") {
      navigate("/health");
    } else if (step === "vitals") {
      setStep("intro");
    } else if (step === "chat") {
      setStep(chatEntryMode === "direct" ? "intro" : "vitals");
    } else {
      navigate("/health");
    }
  };

  const handleScanComplete = (detectedBpm: number | null, detectedResp: number | null) => {
    setBpm(detectedBpm);
    setRespiratoryRate(detectedResp);
    setChatStartTime(Date.now());
    setChatEntryMode("vitals");
    setAutoStartVoice(false);
    setStep("chat");
  };

  const startChatDirectly = (clue: string, withVoice = false) => {
    setInitialClue(clue);
    setChatStartTime(Date.now());
    setChatEntryMode("direct");
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const saveTriageReport = async (
    triageSummary: TriageSummary,
    reportDurationSeconds: number | null,
    vitalOverrides?: { bpm?: number | null; respiratoryRate?: number | null },
  ) => {
    const res = await apiFetch("/api/reports/triage", {
      method: "POST",
      body: JSON.stringify({
        chief_complaint: triageSummary.chiefComplaint,
        symptoms: triageSummary.symptoms,
        urgency: triageSummary.urgency,
        recommendations: triageSummary.recommendations,
        disclaimer: triageSummary.disclaimer,
        ai_summary: triageSummary.aiSummary ?? null,
        next_step_label: triageSummary.nextStepLabel ?? null,
        next_step_level: triageSummary.nextStepLevel ?? null,
        triage_reasons: triageSummary.triageReasons ?? [],
        watch_signs: triageSummary.watchSigns ?? [],
        profile_considerations: triageSummary.profileConsiderations ?? [],
        vitals_notes: triageSummary.vitalsNotes ?? [],
        bpm: vitalOverrides?.bpm ?? bpm ?? null,
        respiratory_rate: vitalOverrides?.respiratoryRate ?? respiratoryRate ?? null,
        duration_seconds: reportDurationSeconds,
      }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json().catch(() => null) as Promise<SavedTriageReport | null>;
  };

  const applySavedReport = (saved: SavedTriageReport | null) => {
    setReportId(saved?.id ?? null);
    setReportSaveState("saved");
    queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/reports/vitals/history"] });
    if (saved) {
      queryClient.setQueryData(["/api/reports/summary"], (current: unknown) => ({
        ...(current && typeof current === "object" ? current : {}),
        latestTriage: saved,
      }));
      if (saved.id) {
        queryClient.setQueryData([`/api/reports/triage/${saved.id}`], saved);
      }
    }
  };

  const handleChatComplete = (triageSummary: TriageSummary) => {
    const durationSeconds = chatStartTime
      ? Math.round((Date.now() - chatStartTime) / 1000)
      : null;
    setDurationSeconds(durationSeconds);
    setSummary(triageSummary);
    setReportId(null);
    setRefinementStatus({ state: "idle" });
    setReportSaveState("saving");
    setStep("report");
    saveTriageReport(triageSummary, durationSeconds)
      .then(applySavedReport)
      .catch((err) => {
        console.error("[reports/triage] save failed:", err);
        setReportSaveState("error");
      });
  };

  const handleRefineVital = async (config: RefinementVitalConfig, rawValue: string) => {
    if (!summary) return;
    const parsed = config.parse(rawValue);
    if (!parsed) return;

    const previousNextStep = summary.nextStepLabel ?? "";
    try {
      setRefinementStatus({ state: "saving", message: `Saving ${parsed.display}...` });

      const readings = config.key === "bloodPressure"
        ? [
            { signal_type: "bp_systolic", value: parsed.value },
            { signal_type: "bp_diastolic", value: parsed.extraValue },
          ]
        : [{ signal_type: config.signalType, value: parsed.value }];

      for (const reading of readings) {
        if (reading.value == null) continue;
        const saveReading = await apiFetch("/api/vitals-engine/reading", {
          method: "POST",
          body: JSON.stringify({
            signal_type: reading.signal_type,
            value: reading.value,
            source: "manual",
            context_tag: "general",
          }),
        });
        if (!saveReading.ok) throw new Error(`vitals ${saveReading.status}`);
      }

      setRefinementStatus({ state: "refining", message: "Updating your result with this reading..." });

      const refinedVitals = {
        bpm: parsed.vitals.pulseBpm ?? bpm ?? undefined,
        respiratoryRate: parsed.vitals.respiratoryRate ?? respiratoryRate ?? undefined,
        ...parsed.vitals,
      };
      const context = summary.refinementContext;
      const baseMessages = context?.messages?.length
        ? context.messages
        : [{ role: "user" as const, content: initialClue || summary.chiefComplaint }];

      const refineResponse = await apiFetch("/api/triage/message", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            ...baseMessages,
            {
              role: "user",
              content: `New vital added after the first report: ${config.title}: ${parsed.display}. Refine the triage result with this new reading. Vitals can increase or clarify urgency, but must not downgrade emergency red flags.`,
            },
          ],
          vitals: refinedVitals,
          locale: navigator.language || "en",
          wizard: {
            mode: context?.entryMode ?? (chatEntryMode === "vitals" ? "with_vitals" : "without_vitals"),
            vitalsScanCompleted: chatEntryMode === "vitals",
            vitals: refinedVitals,
            quickAnswers: context?.quickAnswers ?? [],
            refineRequested: true,
            previousSummary: summary,
          },
          healthMemory: triageContext?.memory ?? null,
        }),
      });
      if (!refineResponse.ok) throw new Error(`triage ${refineResponse.status}`);
      const refinedPayload = await refineResponse.json();
      if (!refinedPayload?.done || !refinedPayload?.summary) {
        throw new Error("refinement did not return a report");
      }

      const refinedSummary = {
        ...refinedPayload.summary,
        aiSummary: refinedPayload.content,
        evidenceSources: refinedPayload.summary.evidenceSources ?? refinedPayload.evidenceSources,
        refinementContext: context,
      } as TriageSummary;

      if (parsed.vitals.pulseBpm != null) setBpm(parsed.vitals.pulseBpm);
      if (parsed.vitals.respiratoryRate != null) setRespiratoryRate(parsed.vitals.respiratoryRate);
      setSummary(refinedSummary);
      setReportSaveState("saving");

      const saved = await saveTriageReport(refinedSummary, durationSeconds, {
        bpm: parsed.vitals.pulseBpm ?? bpm,
        respiratoryRate: parsed.vitals.respiratoryRate ?? respiratoryRate,
      });
      applySavedReport(saved);

      const nextStepChanged = Boolean(
        previousNextStep &&
        refinedSummary.nextStepLabel &&
        refinedSummary.nextStepLabel !== previousNextStep,
      );
      setRefinementStatus({
        state: "done",
        message: `Updated with ${parsed.display}. ${nextStepChanged ? "Next step changed." : "Next step stayed the same."} Report updated and ready to share.`,
      });
    } catch (err) {
      console.error("[symptom-check] refinement failed:", err);
      setRefinementStatus({
        state: "error",
        message: "Could not update with this reading. The original report is still available.",
      });
    }
  };

  return (
    <HealthWizardShell contentClassName="flex min-h-[calc(100vh-204px)] flex-col overflow-hidden px-0 pb-0 pt-0">
      <div className="px-[18px] pt-3" data-testid="symptom-check-shell">
        <HealthWizardTopBar
          title={stepTitle[step]}
          kicker={t("health.symptomCheck.intro.stepLabel", "Symptom check")}
          onBack={handleBack}
          backLabel={t("common.back", "Back")}
        />
      </div>

      {step !== "intro" && (
        <div className="flex-shrink-0 pb-3">
          <StepDots current={step} includeVitals={chatEntryMode !== "direct"} />
        </div>
      )}

      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4">
          <VoiceActionFulfillmentPanel
            domain="health"
            actionTypes={["health.symptom_support"]}
            title={t("health.symptomCheck.contextReady", "Symptom context ready")}
            description={t("health.symptomCheck.contextReadySub", "VYVA can keep the current symptom topic, scan context, and report flow together here.")}
          />
          {triageContext?.usedItems?.length ? (
            <div className="mt-3 rounded-[22px] border border-[#E8DED4] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(63,45,35,0.05)]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#F5F3FF] text-vyva-purple">
                  <ClipboardList size={19} />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                    {t("health.symptomCheck.memory.title", "VYVA checked your health profile")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    {triageContext.usedItems.slice(0, 4).join(" • ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {step === "intro" && (
          <IntroScreen
            onStartWithVitals={(clue) => {
              setInitialClue(clue);
              setChatEntryMode("vitals");
              setAutoStartVoice(false);
              setStep("vitals");
            }}
            onStartWithoutVitals={(clue) => startChatDirectly(clue, false)}
          />
        )}

        {step === "vitals" && (
          <VitalsScan onComplete={handleScanComplete} />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            entryMode={chatEntryMode === "vitals" ? "with_vitals" : "without_vitals"}
            initialClue={initialClue}
            healthMemory={triageContext?.memory ?? null}
            autoStartVoice={autoStartVoice}
            onVoiceAutoStarted={() => setAutoStartVoice(false)}
            onComplete={handleChatComplete}
          />
        )}

        {step === "report" && summary && (
          <ReportScreen
            summary={summary}
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            durationSeconds={durationSeconds}
            reportId={reportId}
            reportSaveState={reportSaveState}
            profileContacts={profileContacts}
            refinementStatus={refinementStatus}
            onRefineVital={handleRefineVital}
            onDone={() => navigate("/health")}
          />
        )}
      </div>
    </HealthWizardShell>
  );
}
