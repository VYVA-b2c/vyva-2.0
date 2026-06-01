import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Calendar, Car, ChevronLeft, Share2, CheckCircle, AlertTriangle, Eye, ClipboardList, FileText, Heart, ListChecks, Loader2, Mail, PhoneCall, RefreshCw, Send, ShoppingBasket, Stethoscope, Users, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import TriageChat, { type TriageChatDraft } from "@/components/TriageChat";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import { useProfile } from "@/contexts/ProfileContext";
import {
  HealthWizardCard,
  HealthWizardHero,
  HealthWizardShell,
  HealthWizardTopBar,
} from "@/components/health/HealthWizard";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n";
import { apiFetch, queryClient } from "@/lib/queryClient";
import { getSymptomRecommendationActionKinds, type SymptomRecommendationActionKind } from "@/lib/symptomReportActions";
import type { TriageScanResult } from "../../shared/triageScans";

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
  scanResults?: TriageScanResult[];
  scanNotes?: string[];
  evidenceSummary?: string;
  evidenceSources?: Array<{ title?: string; url?: string; year?: string; journal?: string }>;
  refinementContext?: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    quickAnswers: Array<{ id: string; label: string; value: string; kind: string }>;
    scanResults?: TriageScanResult[];
    entryMode: "with_vitals" | "without_vitals";
    initialClue: string;
  };
}

type RefinementVitalKey = "glucose" | "bloodPressure" | "oxygen" | "respiratoryRate" | "temperature" | "pulse" | "pain" | "energy";

type RefinementVitalConfig = {
  key: RefinementVitalKey;
  title: string;
  unit: string;
  placeholder: string;
  helper: string;
  signalType: string;
  invalidMessage?: string;
  parse: (raw: string) => { value: number; extraValue?: number; display: string; vitals: Record<string, number> } | null;
};

type RefinementStatus = {
  state: "idle" | "saving" | "refining" | "done" | "error";
  message?: string;
};

type ReportSaveState = "idle" | "saving" | "saved" | "error";

type LatestVitalReading = {
  signal_type: string;
  context_tag?: string | null;
  value: string | number;
  recorded_at?: string | null;
  source?: string | null;
  source_confidence?: "low" | "medium" | "high" | null;
  source_display_label?: string | null;
  source_context_label?: string | null;
};

type LatestVitalsResponse = {
  recent_readings?: LatestVitalReading[];
};

type LatestVitalCandidate = {
  value: string;
  display: string;
  source?: string | null;
};

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
  gpEmail?: string | null;
} | null;

type CareTeamMember = {
  id: string;
  invitee_name?: string | null;
  invitee_phone?: string | null;
  invitee_email?: string | null;
  role?: string | null;
  relationship?: string | null;
  status?: string | null;
};

type DoctorShareTarget = {
  name: string;
  value: string;
  channel: "email" | "sms";
};

type SavedTriageReport = {
  id?: string;
  chief_complaint?: string;
  symptoms?: string[];
  urgency?: TriageSummary["urgency"];
  recommendations?: string[];
  disclaimer?: string;
  ai_summary?: string | null;
  scan_results?: TriageScanResult[];
  scan_notes?: string[];
  bpm?: number | null;
  respiratory_rate?: number | null;
  duration_seconds?: number | null;
  created_at?: string;
};

type ConciergePrefillKind = "ride" | "appointment" | "home_care_quote";

type ReportAction = {
  kind: SymptomRecommendationActionKind;
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void;
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

function AssessmentConfidenceTracker({ current }: { current: Step }) {
  const { t } = useTranslation();
  const isReport = current === "report";
  const activeIndex = isReport ? 2 : current === "chat" ? 1 : 0;
  const progress = isReport ? 100 : current === "chat" ? 66 : 33;
  const stepLabel = t("health.symptomCheck.tracker.stepLabel", "Step {{current}} of {{total}}", { current: activeIndex + 1, total: 3 });
  const milestones = [
    { key: "listen", label: t("health.symptomCheck.tracker.listen", "Listen"), Icon: Stethoscope },
    { key: "check", label: t("health.symptomCheck.tracker.check", "Check"), Icon: Activity },
    { key: "next", label: t("health.symptomCheck.tracker.nextStep", "Next step"), Icon: CheckCircle },
  ];

  return (
    <div className="mx-[18px] rounded-[28px] border border-[#E8DED4] bg-white/95 p-4 shadow-[0_14px_32px_rgba(63,45,35,0.08)]">
      <div className="flex items-center gap-3">
        <span className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[20px] bg-vyva-purple text-white shadow-[0_10px_20px_rgba(107,33,168,0.20)]">
          {isReport ? <CheckCircle size={27} /> : <Activity size={28} />}
          {!isReport ? (
            <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#34D399] ring-4 ring-white motion-safe:animate-pulse" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
            {t("health.symptomCheck.tracker.label", "Symptom check progress")}
          </p>
          <p className="font-body text-[19px] font-black leading-tight text-vyva-text-1">
            {isReport
              ? t("health.symptomCheck.tracker.ready", "Ready")
              : stepLabel}
          </p>
          <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
            {isReport
              ? t("health.symptomCheck.tracker.prepared", "Clear next steps prepared")
              : t("health.symptomCheck.tracker.checking", "VYVA is checking your answers")}
          </p>
        </div>
        <div
          className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full p-[5px]"
          style={{ background: `conic-gradient(hsl(var(--vyva-purple)) ${progress}%, #EFE7DE 0)` }}
          aria-label={t("health.symptomCheck.tracker.label", "Symptom check progress")}
        >
          <span className="flex h-full w-full items-center justify-center rounded-full bg-white font-body text-[15px] font-black text-vyva-purple">
            {activeIndex + 1}/3
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {milestones.map(({ key, label, Icon }, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          const tileClass = isActive
            ? "border-vyva-purple bg-[#F5F3FF] text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.12)]"
            : isComplete
              ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E8DED4] bg-[#FFFCF8] text-vyva-text-2";
          const iconClass = isActive
            ? `bg-vyva-purple text-white ${isReport ? "" : "motion-safe:animate-pulse"}`
            : isComplete
              ? "bg-[#10B981] text-white"
              : "bg-[#F4EEE8] text-vyva-text-2";

          return (
            <div
              key={key}
              aria-current={isActive ? "step" : undefined}
              className={`min-h-[72px] rounded-[18px] border px-2 py-2 text-center transition-all ${tileClass}`}
            >
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                <Icon size={18} />
              </span>
              <span className="mt-1 block font-body text-[12px] font-black leading-tight">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IntroScreen({ onStart }: { onStart: (clue: string) => void }) {
  const { t } = useTranslation();
  const [clue, setClue] = useState("");
  const [quickClueSetIndex, setQuickClueSetIndex] = useState(0);
  const cleanClue = clue.trim();
  const canStart = cleanClue.length >= 2;
  const quickClueSets = [
    [
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
    ],
    [
      t("health.symptomCheck.intro.clueCough", "Cough"),
      t("health.symptomCheck.intro.clueBack", "Back pain"),
      t("health.symptomCheck.intro.clueThroat", "Sore throat"),
      t("health.symptomCheck.intro.clueRash", "Rash"),
      t("health.symptomCheck.intro.clueNausea", "Nausea"),
      t("health.symptomCheck.intro.clueSleep", "Trouble sleeping"),
      t("health.symptomCheck.intro.clueSwelling", "Leg swelling"),
      t("health.symptomCheck.intro.clueEar", "Ear pain"),
      t("health.symptomCheck.intro.clueLowEnergy", "Low energy"),
      t("health.symptomCheck.intro.clueConfusion", "New confusion"),
    ],
    [
      t("health.symptomCheck.intro.clueVomiting", "Vomiting"),
      t("health.symptomCheck.intro.clueDiarrhea", "Diarrhea"),
      t("health.symptomCheck.intro.clueEye", "Eye pain"),
      t("health.symptomCheck.intro.clueNumbness", "Numbness"),
      t("health.symptomCheck.intro.clueWeakness", "Weakness"),
      t("health.symptomCheck.intro.clueSideEffect", "Side effect"),
      t("health.symptomCheck.intro.clueBleeding", "Bleeding"),
      t("health.symptomCheck.intro.cluePalpitations", "Palpitations"),
      t("health.symptomCheck.intro.clueLowMood", "Low mood"),
      t("health.symptomCheck.intro.clueWound", "Skin wound"),
    ],
  ];
  const quickClues = quickClueSets[quickClueSetIndex] ?? quickClueSets[0];
  const refreshCluesLabel = t("health.symptomCheck.intro.refreshCluesLabel", "Refresh examples");

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-5 px-[18px] py-5">
      <HealthWizardHero
        icon={<Stethoscope size={28} />}
        kicker={t("health.symptomCheck.intro.stepLabel", "Symptom check")}
        title={t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        body={t("health.symptomCheck.intro.clueSub", "Use a few words. VYVA will choose the right questions.")}
      />

      <HealthWizardCard tone="soft" className="px-4 py-4" testId="symptom-check-one-question-note">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
            <ListChecks size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-body text-[17px] font-black leading-tight text-vyva-text-1">
              {t("health.symptomCheck.intro.oneQuestionTitle", "One question at a time")}
            </p>
            <p className="mt-1 font-body text-[15px] font-bold leading-snug text-vyva-text-2">
              {t("health.symptomCheck.intro.oneQuestionBody", "You can tap simple choices, type a short answer, or stop after the next-step report is ready.")}
            </p>
          </div>
        </div>
      </HealthWizardCard>

      <HealthWizardCard className="grid min-w-0 gap-4">
        <label className="sr-only" htmlFor="symptom-clue">
          {t("health.symptomCheck.intro.clueTitle", "What is bothering you?")}
        </label>
        <input
          id="symptom-clue"
          value={clue}
          onChange={(event) => setClue(event.target.value)}
          placeholder={t("health.symptomCheck.intro.cluePlaceholder", "For example: bad headache...")}
          data-testid="input-symptom-clue"
          className="min-h-[78px] w-full min-w-0 max-w-full rounded-[24px] border-2 border-[#DDD6FE] bg-white px-5 font-body text-[22px] font-black text-vyva-text-1 shadow-[0_10px_26px_rgba(63,45,35,0.06)] outline-none placeholder:text-[#9A8C83] focus:border-[#6B21A8]"
        />
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <button
            type="button"
            aria-label={refreshCluesLabel}
            title={refreshCluesLabel}
            data-testid="button-refresh-symptom-clues"
            onClick={() => setQuickClueSetIndex((current) => (current + 1) % quickClueSets.length)}
            className="vyva-tap flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full border border-[#D8C7FF] bg-[#F7F1FF] text-[#6B21A8] shadow-[0_4px_12px_rgba(107,33,168,0.08)] transition hover:border-[#B794F4] hover:bg-[#F1E8FF] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#6B21A8]"
          >
            <RefreshCw size={22} strokeWidth={2.7} aria-hidden="true" />
          </button>
          {quickClues.map((quickClue) => (
            <button
              key={quickClue}
              type="button"
              onClick={() => setClue(quickClue)}
              className="vyva-tap min-h-[58px] max-w-full whitespace-normal rounded-full border border-[#E8DED4] bg-[#FFFCF8] px-5 text-left font-body text-[17px] font-extrabold text-vyva-text-1 shadow-[0_4px_12px_rgba(63,45,35,0.04)]"
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

function simplifyReportRecommendations(lines: string[]) {
  const unique = uniqueLines(lines);
  const hasDoctorContactAction = unique.some((line) =>
    /^(contacta|contact).*(doctor|m(?:e|\u00e9)dico|cl(?:i|\u00ed)nica|clinic|urgent care|urgencias)/i.test(line),
  );

  return unique.filter((line, index) => {
    if (!hasDoctorContactAction) return true;
    return !/^(habla|talk|speak).*(doctor|m(?:e|\u00e9)dico).*hoy/i.test(line);
  });
}

function compactDoctorContactRecommendations(lines: string[]) {
  const unique = simplifyReportRecommendations(lines);
  const doctorContactIndex = unique.findIndex((line) =>
    /\b(contacta|contact|habla|talk|speak|comparte|share)\b.*\b(doctor|m(?:e|\u00e9)dico|clinic|cl(?:i|\u00ed)nica|urgent care|urgencias)\b/i.test(line),
  );

  if (doctorContactIndex < 0) return unique;

  return unique.filter((line, index) => {
    if (index === doctorContactIndex) return true;
    return !/\b(contacta|contact|habla|talk|speak|comparte|share)\b.*\b(doctor|m(?:e|\u00e9)dico|clinic|cl(?:i|\u00ed)nica|urgent care|urgencias)\b/i.test(line);
  });
}

function directShareChannel(value: string): DoctorShareTarget["channel"] {
  return value.includes("@") ? "email" : "sms";
}

function findDoctorShareTarget(
  profileContacts: ProfileContactsResponse | undefined,
  careTeamMembers: CareTeamMember[],
  fallbackDoctorName: string,
): DoctorShareTarget | null {
  const gpPhone = profileContacts?.gpPhone?.trim();
  if (gpPhone) {
    return {
      name: profileContacts?.gpName?.trim() || fallbackDoctorName,
      value: gpPhone,
      channel: "sms",
    };
  }

  const careTeamDoctor = careTeamMembers.find((member) => {
    const status = member.status?.toLowerCase();
    if (status && ["revoked", "declined", "expired"].includes(status)) return false;
    const hasContact = Boolean(member.invitee_email?.trim() || member.invitee_phone?.trim());
    if (!hasContact) return false;
    const role = member.role?.toLowerCase();
    const relationship = member.relationship?.toLowerCase();
    return role === "doctor" || relationship === "gp" || relationship === "specialist_doctor";
  });

  const value = careTeamDoctor?.invitee_email?.trim() || careTeamDoctor?.invitee_phone?.trim();
  if (!careTeamDoctor || !value) return null;

  return {
    name: careTeamDoctor.invitee_name?.trim() || fallbackDoctorName,
    value,
    channel: directShareChannel(value),
  };
}

function directDoctorShareHref(target: DoctorShareTarget, subject: string, text: string) {
  if (target.channel === "email") {
    return `mailto:${encodeURIComponent(target.value)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  }

  const separator = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent) ? "&" : "?";
  return `sms:${target.value}${separator}body=${encodeURIComponent(text)}`;
}

function parseNumber(raw: string) {
  const value = Number(raw.replace(",", ".").trim());
  return Number.isFinite(value) ? value : null;
}

function parseRangeNumber(raw: string, min: number, max: number) {
  const value = parseNumber(raw);
  if (value == null || value < min || value > max) return null;
  return value;
}

function parseBloodPressure(raw: string) {
  const match = raw.trim().match(/^(\d{2,3})\s*[/ ]\s*(\d{2,3})$/);
  if (!match) return null;
  const systolic = Number(match[1]);
  const diastolic = Number(match[2]);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) return null;
  return { systolic, diastolic };
}

function normalizeReadingValue(value: string | number | null | undefined) {
  if (value == null) return "";
  return String(value).trim();
}

function findLatestReading(readings: LatestVitalReading[], signalType: string) {
  return readings.find((reading) => reading.signal_type === signalType && normalizeReadingValue(reading.value));
}

function latestCandidateForAction(action: RefinementVitalConfig, readings: LatestVitalReading[]): LatestVitalCandidate | null {
  if (action.key === "bloodPressure") {
    const systolic = findLatestReading(readings, "bp_systolic");
    const diastolic = findLatestReading(readings, "bp_diastolic");
    if (!systolic || !diastolic) return null;

    const value = `${normalizeReadingValue(systolic.value)}/${normalizeReadingValue(diastolic.value)}`;
    const parsed = action.parse(value);
    if (!parsed) return null;
    return {
      value,
      display: parsed.display,
      source: systolic.source ?? diastolic.source ?? null,
    };
  }

  const reading = findLatestReading(readings, action.signalType);
  if (!reading) return null;
  const value = normalizeReadingValue(reading.value);
  const parsed = action.parse(value);
  if (!parsed) return null;
  return {
    value,
    display: parsed.display,
    source: reading.source ?? null,
  };
}

function reportText(summary: TriageSummary) {
  return [
    summary.chiefComplaint,
    ...summary.symptoms,
  ...(summary.triageReasons ?? []),
  ...(summary.profileConsiderations ?? []),
  ...(summary.vitalsNotes ?? []),
  ...(summary.scanNotes ?? []),
  ].join(" ").toLowerCase();
}

function ReportScreen({
  summary,
  bpm,
  respiratoryRate,
  durationSeconds,
  reportId,
  profileContacts,
  careTeamMembers,
  emergencyContact,
  latestVitalReadings = [],
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
  careTeamMembers: CareTeamMember[];
  emergencyContact?: EmergencyContact | null;
  latestVitalReadings?: LatestVitalReading[];
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
  const recommendationExplanation = (() => {
    const level = summary.nextStepLevel ?? cfg.level;
    if (level === "emergency") {
      return t("health.symptomCheck.report.explainEmergency", "Your answers included an emergency warning sign, so the next step is urgent help now.");
    }
    if (level === "doctor_today") {
      return t("health.symptomCheck.report.explainDoctorToday", "Your answers suggest this should be reviewed today rather than watched at home.");
    }
    if (level === "doctor_24_48") {
      return t("health.symptomCheck.report.explainDoctorSoon", "Your answers point to medical follow-up soon, with clear watch signs in the meantime.");
    }
    return t("health.symptomCheck.report.explainMonitor", "Your answers fit home monitoring for now, with clear signs that should change the plan.");
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
          signalType: "oxygen_saturation",
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
    /\b(pain|ache|headache|back|belly pain|stomach pain|fall|injury|dolor|cabeza|espalda|barriga|caida|golpe)\b/.test(actionText)
      ? {
          key: "pain",
          title: t("health.symptomCheck.report.checkPainNow", "Rate pain now"),
          unit: "/10",
          placeholder: "6",
          helper: t("health.symptomCheck.report.checkPainReason", "Use 0 for no pain and 10 for the worst pain."),
          signalType: "pain_score",
          invalidMessage: t("health.symptomCheck.report.invalidPainReading", "Enter pain from 0 to 10."),
          parse: (raw) => {
            const value = parseRangeNumber(raw, 0, 10);
            return value == null ? null : { value, display: `${value}/10`, vitals: { painScore: value } };
          },
        }
      : null,
    /\b(tired|weak|fatigue|energy|exhausted|dizzy|confused|cansado|debil|energia|agotado|mareo|confusion)\b/.test(actionText)
      ? {
          key: "energy",
          title: t("health.symptomCheck.report.checkEnergyNow", "Rate energy now"),
          unit: "/10",
          placeholder: "4",
          helper: t("health.symptomCheck.report.checkEnergyReason", "Use 1 for very low energy and 10 for normal/high energy."),
          signalType: "energy_level",
          invalidMessage: t("health.symptomCheck.report.invalidEnergyReading", "Enter energy from 1 to 10."),
          parse: (raw) => {
            const value = parseRangeNumber(raw, 1, 10);
            return value == null ? null : { value, display: `${value}/10`, vitals: { energyLevel: value } };
          },
        }
      : null,
  ].filter(Boolean) as RefinementVitalConfig[];
  const latestVitalCandidates = useMemo(() => {
    const entries = vitalActions.map((action) => [action.key, latestCandidateForAction(action, latestVitalReadings)] as const);
    return Object.fromEntries(entries) as Partial<Record<RefinementVitalKey, LatestVitalCandidate | null>>;
  }, [latestVitalReadings, vitalActions]);
  const latestSourceLabel = (source?: string | null) => {
    if (source === "connected_device") return t("health.symptomCheck.report.latestSourceDevice", "device reading");
    if (source === "clinical") return t("health.symptomCheck.report.latestSourceClinical", "clinical reading");
    if (source === "phone_estimate") return t("health.symptomCheck.report.latestSourcePhone", "phone estimate");
    return t("health.symptomCheck.report.latestSourceManual", "saved reading");
  };
  const doctorTellItems = uniqueLines([
    `${t("health.symptomCheck.report.tellMainSymptom", "Main symptom")}: ${summary.chiefComplaint}`,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.scanNotes?.length ? `${t("health.symptomCheck.report.scanNotes", "Scan notes")}: ${summary.scanNotes.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
  ]).slice(0, 6);
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    summary.recommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${summary.recommendations.join(" ")}` : "",
    summary.watchSigns?.length ? `${t("health.symptomCheck.report.watchSigns", "Watch signs")}: ${summary.watchSigns.join(" ")}` : "",
    summary.profileConsiderations?.length ? `${t("health.symptomCheck.report.profileConsidered", "Profile considered")}: ${summary.profileConsiderations.join(" ")}` : "",
    summary.vitalsNotes?.length ? `${t("health.symptomCheck.report.vitalsUsed", "Vitals used")}: ${summary.vitalsNotes.join(" ")}` : "",
    summary.scanNotes?.length ? `${t("health.symptomCheck.report.scanNotes", "Scan notes")}: ${summary.scanNotes.join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const doctorShareTarget = findDoctorShareTarget(profileContacts, careTeamMembers, t("health.symptomCheck.report.doctorContact", "your doctor"));
  const doctorShareHref = doctorShareTarget
    ? directDoctorShareHref(doctorShareTarget, t("health.symptomCheck.report.shareTitle"), doctorNote)
    : "";
  const openDoctorContactSetup = () => navigate("/onboarding/profile/gp");
  const openDoctorWithContext = () => {
    navigate("/health/doctor", {
      state: {
        autoStartVoice: true,
        latestSymptomReport: doctorNote,
      },
    });
  };
  const gpPhone = profileContacts?.gpPhone?.trim() ?? "";
  const gpEmail = profileContacts?.gpEmail?.trim() ?? "";
  const telHref = gpPhone ? `tel:${gpPhone.replace(/[^\d+]/g, "") || gpPhone}` : "";
  const emailSubject = t("health.symptomCheck.report.actions.emailSubject", "VYVA symptom report");
  const mailtoHref = gpEmail
    ? `mailto:${gpEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(doctorNote)}`
    : "";

  const conciergePrefillMessage = (kind: ConciergePrefillKind, recommendation: string) => {
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
    return t(key, fallback, { recommendation, report: doctorNote });
  };

  const openConciergePrefill = (kind: ConciergePrefillKind, recommendation: string) => {
    navigate("/concierge", {
      state: {
        conciergePrefill: {
          kind,
          message: conciergePrefillMessage(kind, recommendation),
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

  const reportActionLabels: Record<SymptomRecommendationActionKind, string> = {
    call_gp: t("health.symptomCheck.report.actions.callGp", "Call GP"),
    email_gp: t("health.symptomCheck.report.actions.emailGp", "Email GP"),
    doctor_help: t("health.symptomCheck.report.actions.doctorHelp", "Doctor help"),
    book_ride: t("health.symptomCheck.report.actions.bookRide", "Book ride"),
    schedule_appointment: t("health.symptomCheck.report.actions.scheduleAppointment", "Appointment"),
    online_order: t("health.symptomCheck.report.actions.onlineOrder", "Online order"),
    request_quote: t("health.symptomCheck.report.actions.requestQuote", "Request quote"),
  };

  const reportActionIcons: Record<SymptomRecommendationActionKind, LucideIcon> = {
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    book_ride: Car,
    schedule_appointment: Calendar,
    online_order: ShoppingBasket,
    request_quote: ClipboardList,
  };

  const actionsForRecommendation = (recommendation: string): ReportAction[] => getSymptomRecommendationActionKinds(recommendation, {
    hasGpPhone: Boolean(gpPhone),
    hasGpEmail: Boolean(gpEmail),
  }).map((kind) => {
    const label = reportActionLabels[kind];
    const base = {
      kind,
      label,
      ariaLabel: t("health.symptomCheck.report.actions.aria", "{{action}} for: {{recommendation}}", {
        action: label,
        recommendation,
      }),
      Icon: reportActionIcons[kind],
    };

    if (kind === "call_gp") return { ...base, href: telHref };
    if (kind === "email_gp") return { ...base, href: mailtoHref };
    if (kind === "doctor_help") return { ...base, onClick: openDoctorWithContext };
    if (kind === "book_ride") return { ...base, onClick: () => openConciergePrefill("ride", recommendation) };
    if (kind === "schedule_appointment") return { ...base, onClick: () => openConciergePrefill("appointment", recommendation) };
    if (kind === "online_order") return { ...base, onClick: () => openHydrationOrder(recommendation) };
    return { ...base, onClick: () => openConciergePrefill("home_care_quote", recommendation) };
  }).filter((action) => action.href || action.onClick);
  const allReasons = uniqueLines([
    ...(summary.triageReasons ?? []),
    ...(summary.profileConsiderations ?? []),
    ...(summary.vitalsNotes ?? []),
    ...(summary.scanNotes ?? []),
  ]);
  const visibleReasons = allReasons.slice(0, 2);
  const visibleRecommendations = compactDoctorContactRecommendations(summary.recommendations).slice(0, 4);
  const visibleWatchSigns = uniqueLines(summary.watchSigns ?? []).slice(0, 2);
  const contextNotes = uniqueLines([...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? []), ...(summary.scanNotes ?? [])]);
  const vitalsSummaryItems = uniqueLines([
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    ...(summary.vitalsNotes ?? []),
  ]).slice(0, 4);
  const contactTransparencyText = notifiedText || t(
    "health.symptomCheck.report.noAutomaticContacts",
    "No doctor or caregiver contact is set in your profile yet. This report is saved and ready to share.",
  );
  const answerFinding = t("health.symptomCheck.report.summaryIntro", "This recommendation is based on the answers and any profile or vitals context available during this check.");
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
      setVitalInputError(config.invalidMessage ?? t("health.symptomCheck.report.enterValidReading", "Enter a valid reading first."));
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
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    durationText ? `${t("health.symptomCheck.report.timeTaken", "Time taken")}: ${durationText}` : "",
    "",
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
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
                {respiratoryRate} breaths/min
              </span>
            </span>
          ) : null}
        </div>
      </section>

      <div className="flex flex-col gap-4 px-[18px] pb-[236px]">
        <section className="rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-next-step-explainer">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#ECFDF5] text-[#047857]">
              <CheckCircle size={21} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.whatThisMeans", "What this means")}
              </p>
              <p className="mt-1 font-body text-[18px] font-black leading-snug text-vyva-text-1">
                {recommendationExplanation}
              </p>
            </div>
          </div>
        </section>

        {visibleReasons.length ? (
          <section className="rounded-[26px] border-2 border-[#7C3AED] bg-[linear-gradient(135deg,#F5F3FF_0%,#FFFFFF_58%,#FFF7ED_100%)] p-4 text-vyva-purple shadow-[0_18px_38px_rgba(107,33,168,0.18)] ring-4 ring-[#F5E8FF]" data-testid="card-report-why">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.22)]">
                <Stethoscope size={20} />
              </span>
              <p className="font-body text-[13px] font-extrabold uppercase tracking-[0.12em]">
                {t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}
              </p>
            </div>
            <ul className="grid gap-3 border-l-4 border-[#7C3AED] pl-4">
              {visibleReasons.map((reason, index) => (
                <li key={index} className="font-body text-[18px] font-black leading-snug text-vyva-text-1">
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
              {visibleRecommendations.map((recommendation, index) => {
                const actions = actionsForRecommendation(recommendation);
                return (
                  <li key={index} className="rounded-[20px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
                    <div className="flex items-start gap-3 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                      <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 pt-0.5">{recommendation}</span>
                    </div>
                    {actions.length ? (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid={`report-actions-${index}`}>
                        {actions.map((action) => {
                          const Icon = action.Icon;
                          const className = "vyva-tap inline-flex min-h-[50px] items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-white px-4 py-3 text-center font-body text-[15px] font-black leading-tight text-vyva-purple shadow-sm";
                          if (action.href) {
                            return (
                              <a
                                key={action.kind}
                                href={action.href}
                                aria-label={action.ariaLabel}
                                data-testid={`button-report-action-${index}-${action.kind}`}
                                className={className}
                              >
                                <Icon size={19} />
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
                              data-testid={`button-report-action-${index}-${action.kind}`}
                              className={className}
                            >
                              <Icon size={19} />
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
        ) : null}

        {visibleWatchSigns.length ? (
          <section className="overflow-hidden rounded-[28px] border-2 border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412] shadow-[0_18px_42px_rgba(154,52,18,0.12)]" data-testid="card-report-watch">
            <div className="flex items-center gap-3 border-b border-[#FED7AA] bg-[#FFEDD5] px-4 py-3">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-[#C2410C] text-white shadow-[0_10px_22px_rgba(194,65,12,0.22)]">
                <AlertTriangle size={25} strokeWidth={2.4} />
              </span>
              <p className="font-body text-[13px] font-black uppercase tracking-[0.11em]">
                {t("health.symptomCheck.report.watchSigns", "Watch for")}
              </p>
            </div>
            <ul className="grid gap-3 p-4">
              {visibleWatchSigns.map((sign, index) => (
                <li key={index} className="flex items-start gap-3 rounded-[20px] border border-[#FED7AA] bg-white px-4 py-3 shadow-[0_8px_18px_rgba(154,52,18,0.08)]">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#FFF7ED] text-[#C2410C] ring-2 ring-[#FDBA74]">
                    <AlertTriangle size={17} strokeWidth={2.5} />
                  </span>
                  <span className="font-body text-[17px] font-black leading-snug text-[#9A3412]">
                    {sign}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {vitalsSummaryItems.length ? (
          <section className="rounded-[24px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-blue-900 shadow-[0_10px_24px_rgba(29,78,216,0.08)]" data-testid="card-report-vitals-context">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-blue-700 shadow-sm">
                <Activity size={21} />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-blue-700">
                  {t("health.symptomCheck.report.vitalsIncluded", "Vitals included")}
                </p>
                <p className="font-body text-[16px] font-bold leading-snug text-blue-900">
                  {t("health.symptomCheck.report.vitalsIncludedBody", "These readings were already available for this report.")}
                </p>
              </div>
            </div>
            <ul className="grid gap-2">
              {vitalsSummaryItems.map((item, index) => (
                <li key={index} className="rounded-[18px] bg-white px-4 py-3 font-body text-[16px] font-black leading-snug text-vyva-text-1 shadow-sm">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-escalation-transparency">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#F5F3FF] text-vyva-purple">
              <Users size={21} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.careTeamTransparency", "Care team transparency")}
              </p>
              <p className="mt-1 font-body text-[17px] font-black leading-snug text-vyva-text-1">
                {contactTransparencyText}
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3">
          {vitalActions.map((action) => {
            const open = openVitalKey === action.key;
            const value = vitalInputs[action.key] ?? "";
            const busy = refinementStatus.state === "saving" || refinementStatus.state === "refining";
            const latestCandidate = latestVitalCandidates[action.key] ?? null;
            const latestSource = latestSourceLabel(latestCandidate?.source);
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
                      if (!latestCandidate) return;
                      setOpenVitalKey(action.key);
                      setVitalInputs((current) => ({
                        ...current,
                        [action.key]: latestCandidate.value,
                      }));
                      setVitalInputError(null);
                    }}
                    disabled={busy || !latestCandidate}
                    className={`vyva-tap flex min-h-[82px] w-full min-w-0 items-center justify-between rounded-[22px] px-5 text-left shadow-[0_12px_26px_rgba(107,33,168,0.12)] disabled:cursor-not-allowed ${
                      latestCandidate
                        ? "bg-[#6B21A8] text-white"
                        : "border border-[#E8DED4] bg-[#FAF9F6] text-vyva-text-3"
                    }`}
                  >
                    <span className="grid min-w-0 gap-1">
                      <span className="min-w-0 font-body text-[18px] font-black leading-tight">
                        {latestCandidate
                          ? t("health.symptomCheck.report.useLatestReading", "Use latest saved reading")
                          : t("health.symptomCheck.report.noLatestReading", "No saved reading yet")}
                      </span>
                      <span className={`min-w-0 font-body text-[14px] font-bold leading-snug ${
                        latestCandidate ? "text-white/82" : "text-vyva-text-3"
                      }`}>
                        {latestCandidate
                          ? t("health.symptomCheck.report.latestReadingDetail", "{{display}} from {{source}}", {
                              display: latestCandidate.display,
                              source: latestSource,
                            })
                          : t("health.symptomCheck.report.noLatestReadingDetail", "Enter this reading manually to refine the assessment.")}
                      </span>
                    </span>
                    <ChevronLeft size={22} className={`ml-3 flex-shrink-0 rotate-180 ${latestCandidate ? "" : "opacity-45"}`} />
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
          <summary className="cursor-pointer list-none">
            <span className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                  <Stethoscope size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                    {t("health.symptomCheck.report.detailsForDoctor", "Details for doctor")}
                  </span>
                  <span className="mt-1 block font-body text-[14px] font-bold text-vyva-text-2">
                    {t("health.symptomCheck.report.doctorNoteSub", "Plain text to read, show, or share.")}
                  </span>
                </span>
              </span>
              <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </span>
            <span className="mt-3 block">
              {doctorShareHref ? (
                <a
                  href={doctorShareHref}
                  onClick={(event) => event.stopPropagation()}
                  aria-label={t("health.symptomCheck.report.shareWithDoctor", "Share with doctor")}
                  title={doctorShareTarget?.name}
                  data-testid="link-report-share-doctor"
                  className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 text-center font-body text-[15px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)] sm:w-auto"
                >
                  <Send size={18} className="flex-shrink-0" />
                  <span className="min-w-0 truncate">{t("health.symptomCheck.report.shareWithDoctor", "Share with doctor")}</span>
                </a>
              ) : (
                <span
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className="grid w-full gap-2 sm:grid-cols-2"
                >
                  <button
                    type="button"
                    onClick={openDoctorContactSetup}
                    data-testid="button-report-add-doctor-contact"
                    className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-4 text-center font-body text-[15px] font-black leading-tight text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
                  >
                    <Users size={18} className="flex-shrink-0" />
                    <span className="min-w-0 truncate">{t("health.symptomCheck.report.addDoctorContact", "Add doctor contact")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openDoctorWithContext}
                    data-testid="button-report-doctor-help-inline"
                    className="vyva-tap inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[#D8B4FE] bg-white px-4 text-center font-body text-[15px] font-black leading-tight text-vyva-purple"
                  >
                    <Stethoscope size={18} className="flex-shrink-0" />
                    <span className="min-w-0 truncate">{t("health.symptomCheck.report.actions.doctorHelp", "Doctor help")}</span>
                  </button>
                  <span className="rounded-[16px] bg-[#FAF9F6] px-3 py-2 text-center font-body text-[13px] font-bold text-vyva-text-2 sm:col-span-2">
                    {t("health.symptomCheck.report.noDoctorToShare", "No doctor contact in profile")}
                  </span>
                </span>
              )}
            </span>
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
              <div className="rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-3">
                <div className="flex items-center gap-2 text-[#9A3412]">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#C2410C] text-white">
                    <AlertTriangle size={18} />
                  </span>
                  <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em]">
                    {t("health.symptomCheck.report.watchSigns", "Watch for")}
                  </p>
                </div>
                <ul className="mt-3 grid gap-2">
                  {summary.watchSigns.map((sign, index) => (
                    <li key={index} className="flex items-start gap-2 rounded-[16px] bg-white px-3 py-2 font-body text-[15px] font-bold leading-snug text-[#9A3412]">
                      <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[#C2410C]" />
                      <span>{sign}</span>
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
  const { data: careTeamData } = useQuery<{ members: CareTeamMember[] }>({
    queryKey: ["/api/onboarding/careteam"],
    enabled: step === "report",
    retry: false,
    staleTime: 2 * 60 * 1000,
  });
  const { data: latestVitalsData } = useQuery<LatestVitalsResponse>({
    queryKey: ["/api/vitals-engine/latest", "symptom-report"],
    enabled: step === "report",
    retry: false,
    staleTime: 60 * 1000,
  });
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
        scan_results: triageSummary.scanResults ?? [],
        scan_notes: triageSummary.scanNotes ?? [],
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
            source: "manual_entry",
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
            scanResults: context?.scanResults ?? summary.scanResults ?? [],
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
          <AssessmentConfidenceTracker current={step} />
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
                    {triageContext.usedItems.slice(0, 4).join(" - ")}
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
            onVitalsScanned={(nextBpm, nextRespiratoryRate) => {
              if (nextBpm != null) setBpm(nextBpm);
              if (nextRespiratoryRate != null) setRespiratoryRate(nextRespiratoryRate);
            }}
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
            careTeamMembers={careTeamData?.members ?? []}
            emergencyContact={triageContext?.emergencyContact ?? null}
            latestVitalReadings={latestVitalsData?.recent_readings ?? []}
            refinementStatus={refinementStatus}
            onRefineVital={handleRefineVital}
            onDone={handleDone}
          />
        )}
      </div>
    </HealthWizardShell>
  );
}
