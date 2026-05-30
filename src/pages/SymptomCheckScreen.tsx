import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, ChevronLeft, Share2, CheckCircle, AlertTriangle, Eye, ClipboardList, FileText, Heart, Loader2, PhoneCall, Stethoscope } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import TriageChat, { type TriageChatDraft } from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useProfile } from "@/contexts/ProfileContext";
import {
  HealthWizardCard,
  HealthWizardHero,
  HealthWizardProgress,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { apiFetch, queryClient } from "@/lib/queryClient";

type Step = "intro" | "chat" | "report";

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
  countryCode?: string;
};

type EmergencyContact = {
  label: string;
  telHref?: string;
};

type TriageContextResponse = {
  memory: TriageHealthMemory;
  usedItems: string[];
  countryCode?: string;
  emergencyContact?: EmergencyContact;
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

const SYMPTOM_CHECK_DRAFT_KEY = "vyva.symptomCheck.draft.v1";
const SYMPTOM_CHECK_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

type SymptomCheckDraft = {
  version: 1;
  updatedAt: number;
  step: Exclude<Step, "intro">;
  initialClue: string;
  bpm: number | null;
  respiratoryRate: number | null;
  chatStartTime: number | null;
  summary: TriageSummary | null;
  reportSaveState: ReportSaveState;
  reportId: string | null;
  durationSeconds: number | null;
  refinementStatus: RefinementStatus;
  chatDraft: TriageChatDraft | null;
};

const canUseSessionStorage = () => typeof window !== "undefined" && Boolean(window.sessionStorage);

function clearSymptomCheckDraft() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(SYMPTOM_CHECK_DRAFT_KEY);
}

function readSymptomCheckDraft(): SymptomCheckDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(SYMPTOM_CHECK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SymptomCheckDraft>;
    const isExpired = typeof parsed.updatedAt !== "number" || Date.now() - parsed.updatedAt > SYMPTOM_CHECK_DRAFT_TTL_MS;
    const hasValidStep = parsed.step === "chat" || parsed.step === "report";
    const hasRestorableState = parsed.step === "chat"
      ? Boolean(parsed.chatDraft)
      : Boolean(parsed.summary);
    if (parsed.version !== 1 || isExpired || !hasValidStep || !hasRestorableState) {
      clearSymptomCheckDraft();
      return null;
    }
    return {
      version: 1,
      updatedAt: parsed.updatedAt,
      step: parsed.step,
      initialClue: typeof parsed.initialClue === "string" ? parsed.initialClue : "",
      bpm: typeof parsed.bpm === "number" ? parsed.bpm : null,
      respiratoryRate: typeof parsed.respiratoryRate === "number" ? parsed.respiratoryRate : null,
      chatStartTime: typeof parsed.chatStartTime === "number" ? parsed.chatStartTime : null,
      summary: parsed.summary ?? null,
      reportSaveState: parsed.reportSaveState === "saving" ? "idle" : parsed.reportSaveState ?? "idle",
      reportId: typeof parsed.reportId === "string" ? parsed.reportId : null,
      durationSeconds: typeof parsed.durationSeconds === "number" ? parsed.durationSeconds : null,
      refinementStatus: parsed.refinementStatus ?? { state: "idle" },
      chatDraft: parsed.chatDraft ?? null,
    };
  } catch {
    clearSymptomCheckDraft();
    return null;
  }
}

function writeSymptomCheckDraft(draft: Omit<SymptomCheckDraft, "version" | "updatedAt">) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(SYMPTOM_CHECK_DRAFT_KEY, JSON.stringify({
    ...draft,
    version: 1,
    updatedAt: Date.now(),
  }));
}

function StepDots({ current }: { current: Step }) {
  const steps: Step[] = ["chat", "report"];
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

function IntroScreen({ onStart }: { onStart: (clue: string) => void }) {
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
    t("health.symptomCheck.intro.clueChest", "Chest pain"),
    t("health.symptomCheck.intro.clueStomach", "Stomach pain"),
    t("health.symptomCheck.intro.clueMedicine", "Medication concern"),
    t("health.symptomCheck.intro.clueAnxiety", "Feeling anxious"),
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

      <div className="grid gap-3">
        <p className="font-body text-[15px] font-bold leading-snug text-vyva-text-2">
          {t("health.symptomCheck.intro.vitalsAsNextStep", "Vitals can be checked after VYVA understands what is happening.")}
        </p>
        <button
          type="button"
          onClick={() => onStart(cleanClue)}
          disabled={!canStart}
          data-testid="button-symptom-check-start"
          className="vyva-primary-action min-h-[72px] w-full text-[20px] disabled:opacity-45"
        >
          {t("health.symptomCheck.intro.startBtn", "Start symptom check")}
        </button>
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
      urgencyLabel: "health.symptomCheck.report.emergencyUrgencyLabel",
      fallbackUrgencyLabel: "Emergency urgency",
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
      urgencyLabel: "health.symptomCheck.report.highUrgencyLabel",
      fallbackUrgencyLabel: "High urgency",
      label: "health.symptomCheck.report.doctorTodayLabel",
      fallbackLabel: "Doctor today",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  if (level === "doctor_24_48") {
    return {
      bg: "linear-gradient(135deg, #1D4ED8 0%, #6D28D9 100%)",
      icon: Eye,
      urgencyLabel: "health.symptomCheck.report.mediumUrgencyLabel",
      fallbackUrgencyLabel: "Medium urgency",
      label: "health.symptomCheck.report.routineLabel",
      fallbackLabel: "Doctor within 24-48 hours",
      pillBg: "rgba(255,255,255,0.25)",
      level,
    };
  }
  return {
    bg: "linear-gradient(135deg, #0A7C4E 0%, #10B981 100%)",
    icon: CheckCircle,
    urgencyLabel: "health.symptomCheck.report.lowUrgencyLabel",
    fallbackUrgencyLabel: "Low urgency",
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
  profileContacts,
  emergencyContact,
  refinementStatus,
  onRefineVital,
  onDone,
}: {
  summary: TriageSummary;
  bpm: number | null;
  respiratoryRate: number | null;
  durationSeconds: number | null;
  reportId: string | null;
  profileContacts?: ProfileContactsResponse;
  emergencyContact?: EmergencyContact | null;
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
  const urgencyQualifierText = t(cfg.urgencyLabel, cfg.fallbackUrgencyLabel);
  const urgencyStatusText = t(cfg.label, cfg.fallbackLabel);
  const nextStepDisplayText = (() => {
    const level = summary.nextStepLevel ?? cfg.level;
    if (level === "emergency") {
      return t("health.symptomCheck.report.nextStepEmergency", "Call emergency services now");
    }
    if (level === "doctor_today") {
      return t("health.symptomCheck.report.nextStepDoctorToday", "Talk to a doctor today");
    }
    if (level === "doctor_24_48") {
      return t("health.symptomCheck.report.nextStepDoctor24_48", "Talk to a doctor within 24-48 hours");
    }
    if (level === "monitor") {
      return t("health.symptomCheck.report.nextStepMonitorReady", "Monitor at home, with doctor access ready");
    }
    return summary.nextStepLabel ?? t(cfg.label, cfg.fallbackLabel);
  })();
  const emergencyCallLabel = emergencyContact?.telHref
    ? t("health.symptomCheck.report.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
    : t("health.symptomCheck.report.contactEmergencyServices", "Contact emergency services");
  const emergencyBody = emergencyContact?.telHref
    ? t("health.symptomCheck.report.emergencyBodyWithNumber", "Call {{number}} now. Do not drive yourself. Keep this report open for the responder.", {
        number: emergencyContact.label,
      })
    : t("health.symptomCheck.report.emergencyBodyGeneric", "Contact local emergency services now. Do not drive yourself. Keep this report open for the responder.");
  const [openVitalKey, setOpenVitalKey] = useState<RefinementVitalKey | null>(null);
  const [vitalInputs, setVitalInputs] = useState<Record<string, string>>({});
  const [vitalInputError, setVitalInputError] = useState<string | null>(null);
  const reportTopRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (refinementStatus.state === "done") {
      reportTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [refinementStatus.state]);
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
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
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
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
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
  const allReasons = uniqueLines([
    ...(summary.triageReasons ?? []),
    ...(summary.profileConsiderations ?? []),
    ...(summary.vitalsNotes ?? []),
  ]);
  const visibleReasons = allReasons.slice(0, 2);
  const visibleRecommendations = uniqueLines(summary.recommendations).slice(0, 3);
  const visibleWatchSigns = uniqueLines(summary.watchSigns ?? []).slice(0, 2);
  const contextNotes = uniqueLines([...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? [])]);
  const answerFinding = t("health.symptomCheck.report.summaryIntro", "Thank you for your answers. Here's a summary of your situation:");
  const evidenceSourceNames = summary.evidenceSources?.map((source) => source.title).filter(Boolean) ?? [];
  const openReport = () => navigate(reportId ? `/informes/${reportId}` : "/informes");
  const primaryAction = isEmergency
    ? {
        label: emergencyCallLabel,
        Icon: PhoneCall,
        onClick: () => {
          if (emergencyContact?.telHref) {
            window.location.href = emergencyContact.telHref;
          }
        },
        className: "bg-[#DC2626] text-white shadow-[0_12px_26px_rgba(220,38,38,0.24)] disabled:opacity-70",
        testId: "button-report-emergency",
      }
    : cfg.level === "monitor"
      ? {
          label: t("health.symptomCheck.report.nextStepVitals", "Check vitals"),
          Icon: Activity,
          onClick: () => navigate("/health/vitals"),
          className: "bg-[#6B21A8] text-white shadow-[0_12px_26px_rgba(107,33,168,0.20)]",
          testId: "button-report-vitals",
        }
      : {
          label: t("health.symptomCheck.report.callDoctor", "Talk to doctor"),
          Icon: Stethoscope,
          onClick: openDoctorWithContext,
          className: "bg-[#6B21A8] text-white shadow-[0_12px_26px_rgba(107,33,168,0.20)]",
          testId: "button-report-doctor",
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
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
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
  const PrimaryActionIcon = primaryAction.Icon;

  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div ref={reportTopRef} />
      <section
        data-testid="card-report-answer"
        className={`mx-[18px] mb-4 mt-4 rounded-[28px] p-5 text-white shadow-[0_16px_36px_rgba(91,18,160,0.18)] ${isEmergency ? "motion-safe:animate-pulse" : ""}`}
        style={{ background: cfg.bg }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-[18px] p-3"
            style={{ background: "rgba(255,255,255,0.22)" }}
          >
            <UrgencyIcon size={24} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.12em] text-white/76">
              {urgencyQualifierText}
            </p>
            <p className="mt-1 font-display text-[28px] italic leading-tight text-white">
              {urgencyStatusText}
            </p>
          </div>
        </div>

        <p className="mt-5 font-body text-[24px] font-black leading-tight text-white">
          {nextStepDisplayText}
        </p>
        <p className="mt-2 font-body text-[16px] font-bold leading-relaxed text-white/90">
          <span className="sr-only">{t("health.symptomCheck.report.findingLabel", "Finding")}: </span>
          {answerFinding}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {bpm != null ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: cfg.pillBg }}
            >
              <Heart size={13} className="text-white" />
              <span className="font-body text-[13px] font-semibold text-white">
                {bpm} bpm
              </span>
            </span>
          ) : null}
          {respiratoryRate != null ? (
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: cfg.pillBg }}
            >
              <Activity size={13} className="text-white" />
              <span className="font-body text-[13px] font-semibold text-white">
                {respiratoryRate} rpm
              </span>
            </span>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-4 px-[18px] pb-[236px]">
        {visibleReasons.length ? (
          <section className="rounded-[22px] border border-[#DDD6FE] bg-[#F5F3FF] p-4 text-vyva-purple shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-why">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.whyThisStep", "Why VYVA chose this")}
              </p>
            </div>
            <ul className="grid gap-2">
              {visibleReasons.map((reason, index) => (
                <li key={index} className="font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  {reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {visibleRecommendations.length ? (
          <section className="rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-do-now">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
              {t("health.symptomCheck.report.doNow", "Do now")}
            </p>
            <ol className="mt-3 grid gap-3">
              {visibleRecommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-3 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#ECFDF5] text-[#047857]">
                    <CheckCircle size={15} />
                  </span>
                  <span>{recommendation}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {visibleWatchSigns.length ? (
          <section className="rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-4 text-[#9A3412] shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-watch">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.watchSigns", "Watch for")}
              </p>
            </div>
            <ul className="grid gap-2">
              {visibleWatchSigns.map((sign, index) => (
                <li key={index} className="font-body text-[16px] font-bold leading-snug">
                  {sign}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-3">
          {vitalActions.map((action) => {
            const open = openVitalKey === action.key;
            const value = vitalInputs[action.key] ?? "";
            const busy = refinementStatus.state === "saving" || refinementStatus.state === "refining";
            const statusTone = refinementStatus.state === "error"
              ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
              : "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]";
            return (
              <div key={action.key} className="min-w-0 overflow-hidden rounded-[26px] border-2 border-[#6B21A8] bg-white p-4 shadow-[0_14px_34px_rgba(107,33,168,0.16)]">
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
                <div className="grid min-w-0 gap-3">
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
                    className="vyva-tap flex min-h-[76px] w-full min-w-0 items-center justify-between rounded-[22px] bg-[#6B21A8] px-5 text-left text-white shadow-[0_12px_26px_rgba(107,33,168,0.22)]"
                  >
                    <span className="min-w-0 font-body text-[18px] font-black leading-tight">
                      {t("health.symptomCheck.report.readConnectedSensor", "Read from connected sensor")}
                    </span>
                    <ChevronLeft size={22} className="ml-3 flex-shrink-0 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenVitalKey(action.key);
                      setVitalInputError(null);
                    }}
                    disabled={busy}
                    className="vyva-tap flex min-h-[76px] w-full min-w-0 items-center justify-between rounded-[22px] border border-[#E8DED4] bg-[#FAF9F6] px-5 text-left text-vyva-text-1"
                  >
                    <span className="min-w-0 font-body text-[18px] font-black leading-tight">
                      {t("health.symptomCheck.report.enterManualReading", "Enter manually")}
                    </span>
                    <ChevronLeft size={22} className="ml-3 flex-shrink-0 rotate-180 text-vyva-purple" />
                  </button>
                  {open ? (
                    <div className="grid min-w-0 gap-3 overflow-hidden border-t border-[#EADFD5] pt-3">
                      <label className="flex min-h-[86px] w-full min-w-0 max-w-full items-baseline gap-3 overflow-hidden rounded-[24px] border-2 border-[#DDD6FE] bg-white px-4">
                        <input
                          type="text"
                          inputMode={action.key === "bloodPressure" ? "text" : "decimal"}
                          value={value}
                          onChange={(event) => setVitalInputs((current) => ({ ...current, [action.key]: event.target.value }))}
                          placeholder={action.placeholder}
                          className="w-full min-w-0 flex-1 bg-transparent font-body text-[44px] font-black leading-none text-vyva-text-1 outline-none placeholder:text-[#D6C7BA] sm:text-[48px]"
                        />
                        <span className="flex-shrink-0 font-body text-[18px] font-black text-vyva-text-2 sm:text-[20px]">{action.unit}</span>
                      </label>
                      {vitalInputError ? (
                        <p className="font-body text-[16px] font-black text-[#B91C1C]">{vitalInputError}</p>
                      ) : null}
                      {refinementStatus.message ? (
                        <div className={`rounded-[18px] border p-3 font-body text-[16px] font-black leading-snug ${statusTone}`} aria-live="polite">
                          {busy ? <Loader2 className="mr-2 inline h-5 w-5 animate-spin align-[-3px]" /> : null}
                          {refinementStatus.message}
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRefineVital(action, value)}
                        className="vyva-tap flex min-h-[74px] w-full min-w-0 max-w-full items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-[#0A7C4E] px-4 text-center font-body text-[18px] font-black leading-tight text-white disabled:opacity-60 sm:text-[20px]"
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
        </div>

        {isEmergency ? (
          <section className="rounded-[22px] border-2 border-[#DC2626] bg-[#FEF2F2] p-4 text-[#991B1B] shadow-[0_12px_30px_rgba(220,38,38,0.14)]" data-testid="card-report-emergency">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle size={18} />
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                {t("health.symptomCheck.report.emergencyDoNotWait", "Do not wait")}
              </p>
            </div>
            <p className="font-body text-[16px] font-bold leading-snug">
              {emergencyBody}
            </p>
          </section>
        ) : null}

        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                <Stethoscope size={18} />
              </span>
              <span>
                <span className="block font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.detailsForDoctor", "Details for doctor")}
                </span>
                <span className="mt-1 block font-body text-[14px] font-bold text-vyva-text-2">
                  {t("health.symptomCheck.report.doctorNoteSub", "Plain text to read, show, or share.")}
                </span>
              </span>
            </span>
            <ChevronLeft size={20} className="-rotate-90 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-3 border-t border-[#EADFD5] pt-4">
            {doctorTellItems.length ? (
              <ul className="grid gap-2">
                {doctorTellItems.map((item, index) => (
                  <li key={index} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                    {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="whitespace-pre-line rounded-[18px] bg-[#FAF7F3] p-4 font-body text-[14px] font-semibold leading-relaxed text-vyva-text-1">
              {doctorNote}
            </p>
          </div>
        </details>

        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#EFF6FF] text-[#1D4ED8]">
                <FileText size={18} />
              </span>
              <span className="font-body text-[15px] font-extrabold text-vyva-text-1">
                {t("health.symptomCheck.report.showFullReport", "Show full report")}
              </span>
            </span>
            <ChevronLeft size={20} className="-rotate-90 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-5 border-t border-[#EADFD5] pt-4">
            {summary.symptoms.length > 0 ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.symptoms")}
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {summary.symptoms.map((symptom, index) => (
                    <li key={index} className="rounded-full bg-[#F5F3FF] px-3 py-2 font-body text-[13px] font-bold text-[#6B21A8]">
                      {symptom}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.recommendations.length > 0 ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.recommendations")}
                </p>
                <ol className="mt-3 grid gap-3">
                  {summary.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[12px] font-bold text-white">
                        {index + 1}
                      </span>
                      <span className="font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">{recommendation}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {summary.watchSigns?.length ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#9A3412]">
                  {t("health.symptomCheck.report.watchSigns", "Watch for")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {summary.watchSigns.map((sign, index) => (
                    <li key={index} className="font-body text-[15px] font-bold leading-snug text-[#9A3412]">
                      {sign}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {contextNotes.length ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                  {t("health.symptomCheck.report.contextUsed", "What VYVA considered")}
                </p>
                <ul className="mt-3 grid gap-2">
                  {contextNotes.map((note, index) => (
                    <li key={index} className="font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(summary.evidenceSummary || evidenceSourceNames.length) ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1D4ED8]">
                  {t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}
                </p>
                {summary.evidenceSummary ? (
                  <p className="mt-2 font-body text-[15px] font-semibold leading-relaxed text-vyva-text-1">
                    {summary.evidenceSummary}
                  </p>
                ) : null}
                {evidenceSourceNames.length ? (
                  <p className="mt-2 font-body text-[13px] font-extrabold leading-snug text-[#1D4ED8]">
                    {evidenceSourceNames.slice(0, 2).join(" - ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className={`flex items-start gap-3 border-t border-[#EADFD5] pt-4 ${notifiedText ? "text-[#047857]" : "text-vyva-text-2"}`}>
              <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${notifiedText ? "bg-[#DCFCE7]" : "bg-[#F5F3FF]"}`}>
                {notifiedText ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
              </span>
              <div>
                <p className="font-body text-[15px] font-extrabold leading-snug">
                  {contactStatusText}
                </p>
                {durationText ? (
                  <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-3">
                    {t("health.symptomCheck.report.timeTaken", "Time taken")}: {durationText}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </details>

        <button
          onClick={onDone}
          data-testid="button-report-done"
          className="vyva-secondary-action w-full"
        >
          {t("health.symptomCheck.report.doneBtn")}
        </button>

        <p className="px-2 text-center font-body text-[11px] leading-relaxed text-vyva-text-3">
          {t("health.symptomCheck.report.disclaimer")}
        </p>
      </div>

      <div className="pointer-events-none fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-full max-w-[520px] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(250,248,245,0)_0%,#FAF8F5_26%,#FAF8F5_100%)] px-[18px] pb-3 pt-5">
        <div className="pointer-events-auto flex items-center gap-2 rounded-[24px] border border-[#E8DED4]/80 bg-white/95 p-2 shadow-[0_18px_44px_rgba(63,45,35,0.14)] backdrop-blur">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={isEmergency && !emergencyContact?.telHref}
            data-testid={primaryAction.testId}
            className={`vyva-tap flex min-h-[58px] min-w-0 flex-1 items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[17px] font-black leading-tight ${primaryAction.className}`}
          >
            <PrimaryActionIcon size={20} />
            <span>{primaryAction.label}</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label={t("health.symptomCheck.report.shareReportAria", "Share report")}
            title={t("health.symptomCheck.report.shareReportAria", "Share report")}
            data-testid="button-report-share"
            className="vyva-tap flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[18px] border border-[#E8DED4] bg-[#FAF9F6] text-vyva-purple"
          >
            <Share2 size={20} />
          </button>
          <button
            type="button"
            onClick={openReport}
            aria-label={t("health.symptomCheck.report.openReportAria", "Open report")}
            title={t("health.symptomCheck.report.openReportAria", "Open report")}
            data-testid="button-report-view-reports"
            className="vyva-tap flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[18px] border border-[#E8DED4] bg-[#EFF6FF] text-[#1D4ED8]"
          >
            <FileText size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const [restoredDraft] = useState(() => readSymptomCheckDraft());
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
  const [step, setStep] = useState<Step>(() => restoredDraft?.step ?? "intro");
  const [bpm, setBpm] = useState<number | null>(() => restoredDraft?.bpm ?? null);
  const [respiratoryRate, setRespiratoryRate] = useState<number | null>(() => restoredDraft?.respiratoryRate ?? null);
  const [chatStartTime, setChatStartTime] = useState<number | null>(() => restoredDraft?.chatStartTime ?? null);
  const [initialClue, setInitialClue] = useState(() => restoredDraft?.initialClue ?? "");
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const [summary, setSummary] = useState<TriageSummary | null>(() => restoredDraft?.summary ?? null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>(() => restoredDraft?.reportSaveState ?? "idle");
  const [reportId, setReportId] = useState<string | null>(() => restoredDraft?.reportId ?? null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(() => restoredDraft?.durationSeconds ?? null);
  const [refinementStatus, setRefinementStatus] = useState<RefinementStatus>(() => restoredDraft?.refinementStatus ?? { state: "idle" });
  const [chatDraft, setChatDraft] = useState<TriageChatDraft | null>(() => restoredDraft?.chatDraft ?? null);
  const [resumePendingRequest] = useState(() => Boolean(restoredDraft?.chatDraft?.pendingRequest));

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.yourAnswerTitle", "Your answer"),
  };

  const resetSymptomCheck = useCallback(() => {
    clearSymptomCheckDraft();
    setBpm(null);
    setRespiratoryRate(null);
    setChatStartTime(null);
    setInitialClue("");
    setAutoStartVoice(false);
    setSummary(null);
    setReportSaveState("idle");
    setReportId(null);
    setDurationSeconds(null);
    setRefinementStatus({ state: "idle" });
    setChatDraft(null);
    setStep("intro");
  }, []);

  useEffect(() => {
    if (step === "intro") return;
    if (step === "chat" && !chatDraft) return;
    if (step === "report" && !summary) return;
    writeSymptomCheckDraft({
      step,
      initialClue,
      bpm,
      respiratoryRate,
      chatStartTime,
      summary,
      reportSaveState,
      reportId,
      durationSeconds,
      refinementStatus,
      chatDraft,
    });
  }, [bpm, chatDraft, chatStartTime, durationSeconds, initialClue, refinementStatus, reportId, reportSaveState, respiratoryRate, step, summary]);

  const handleBack = () => {
    if (step === "intro") {
      clearSymptomCheckDraft();
      navigate("/health");
    } else if (step === "chat") {
      resetSymptomCheck();
    } else {
      navigate("/health");
    }
  };

  const startChatDirectly = (clue: string, withVoice = false) => {
    clearSymptomCheckDraft();
    setChatDraft(null);
    setSummary(null);
    setReportId(null);
    setDurationSeconds(null);
    setReportSaveState("idle");
    setRefinementStatus({ state: "idle" });
    setInitialClue(clue);
    setChatStartTime(Date.now());
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const handleChatDraftChange = useCallback((draft: TriageChatDraft) => {
    setChatDraft(draft);
  }, []);

  const handleDone = () => {
    clearSymptomCheckDraft();
    navigate("/health");
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

    const previousNextStep = summary.nextStepLevel ?? summary.nextStepLabel ?? "";
    try {
      setRefinementStatus({
        state: "saving",
        message: t("health.symptomCheck.report.savingReading", "Saving {{display}}...", { display: parsed.display }),
      });

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

      setRefinementStatus({
        state: "refining",
        message: t("health.symptomCheck.report.updatingWithReading", "Updating your result with this reading..."),
      });

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
              content: t(
                "health.symptomCheck.report.refinePrompt",
                "New vital added after the first report: {{title}}: {{display}}. Refine the triage result with this new reading. Vitals can increase or clarify urgency, but must not downgrade emergency red flags.",
                { title: config.title, display: parsed.display },
              ),
            },
          ],
          vitals: refinedVitals,
          locale: language,
          wizard: {
            mode: context?.entryMode ?? "without_vitals",
            vitalsScanCompleted: false,
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
        (refinedSummary.nextStepLevel ?? refinedSummary.nextStepLabel) &&
        (refinedSummary.nextStepLevel ?? refinedSummary.nextStepLabel) !== previousNextStep,
      );
      setRefinementStatus({
        state: "done",
        message: t(
          nextStepChanged ? "health.symptomCheck.report.updatedReadingChanged" : "health.symptomCheck.report.updatedReadingSame",
          nextStepChanged
            ? "Updated with {{display}}. Next step changed. Report updated and ready to share."
            : "Updated with {{display}}. Next step stayed the same. Report updated and ready to share.",
          { display: parsed.display },
        ),
      });
    } catch (err) {
      console.error("[symptom-check] refinement failed:", err);
      setRefinementStatus({
        state: "error",
        message: t("health.symptomCheck.report.updateReadingFailed", "Could not update with this reading. The original report is still available."),
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
          action={step === "intro" ? undefined : (
            <button
              type="button"
              onClick={resetSymptomCheck}
              data-testid="button-symptom-check-start-over"
              className="vyva-tap min-h-[40px] rounded-full bg-white px-3 font-body text-[13px] font-black text-vyva-purple shadow-[0_4px_14px_rgba(63,45,35,0.08)]"
            >
              {t("health.symptomCheck.startOver", "Start over")}
            </button>
          )}
        />
      </div>

      {step !== "intro" && (
        <div className="flex-shrink-0 pb-3">
          <StepDots current={step} />
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
                    {triageContext.usedItems.slice(0, 4).join(" â€¢ ")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {step === "intro" && (
          <IntroScreen
            onStart={(clue) => startChatDirectly(clue, false)}
          />
        )}

        {step === "chat" && (
          <TriageChat
            bpm={bpm}
            respiratoryRate={respiratoryRate}
            entryMode="without_vitals"
            initialClue={initialClue}
            healthMemory={triageContext?.memory ?? null}
            autoStartVoice={autoStartVoice}
            initialDraft={chatDraft}
            resumePendingRequest={resumePendingRequest}
            language={language}
            languageReady={!profileLoading}
            onDraftChange={handleChatDraftChange}
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
            profileContacts={profileContacts}
            emergencyContact={triageContext?.emergencyContact ?? null}
            refinementStatus={refinementStatus}
            onRefineVital={handleRefineVital}
            onDone={handleDone}
          />
        )}
      </div>
    </HealthWizardShell>
  );
}
