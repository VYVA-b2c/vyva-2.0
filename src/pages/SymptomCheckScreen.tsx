import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Brain, Calendar, Car, ChevronLeft, Share2, CheckCircle, AlertTriangle, ArrowRight, Droplets, Eye, ClipboardList, FileText, Gauge, Heart, HeartPulse, Home, Loader2, Mail, Mic, PhoneCall, Pill, Send, ShieldCheck, ShoppingBasket, Square, Stethoscope, Users, Wind, type LucideIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import TriageChat, { type TriageChatDraft } from "@/components/TriageChat";
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
import { compactReportRecommendations, uniqueReportLines } from "@/lib/reportRecommendations";
import { getSymptomRecommendationActionKinds, type SymptomRecommendationActionKind } from "@/lib/symptomReportActions";
import { emitVoiceSpecialistTransfer, VOICE_SPECIALIST_AGENT_SLUGS } from "@/lib/voiceNavigation";
import type { TriagePersonalizedSuggestion } from "@/triage";
import type { ShoppingSupportPackageId } from "../../shared/shopping";
import type { TriageScanResult } from "../../shared/triageScans";

type Step = "intro" | "chat" | "report";

type SymptomCheckLocationState = {
  initialClue?: string;
  autoStartVoice?: boolean;
} | null;

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
  contextConfidence?: {
    score: number;
    label: string;
    reasons: string[];
    missing: string[];
  };
  contextSignals?: Array<{
    id: string;
    label: string;
    status: "available" | "missing" | "not_needed";
  }>;
  contextBrief?: string;
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
  careContext?: string;
  checkinContext?: string;
  conditions?: string;
  allergies?: string;
  medications?: string;
  devices?: string;
  latestVitals?: string;
  vitalsTrend?: string;
  latestSymptomReport?: string;
  recentSymptomReports?: string;
  medicationAdherence?: string;
  medicationInteraction?: string;
  recentHealthEvents?: string;
  latestMedicalVisit?: string;
  upcomingMedicalAppointment?: string;
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
  personalizedSuggestions?: TriagePersonalizedSuggestion[];
  activeConditions?: string[];
};

type VoiceTriageChoice = {
  id: string;
  spoken_label: string;
  value?: string;
  kind?: string;
};

type VoiceTriageVitalsPrompt = {
  title: string;
  body: string;
  actions: Array<{
    id: string;
    label: string;
    value: string;
  }>;
};

type VoiceTriageActionOption = {
  id: string;
  kind: string;
  label: string;
  route?: string;
  tel_href?: string | null;
  disabled?: boolean;
};

type VoiceTriageLatestResponse = {
  ok?: boolean;
  status?: "active" | "emergency" | "complete" | "failed";
  spoken_text?: string;
  safety_level?: string;
  vitals_prompt?: VoiceTriageVitalsPrompt | null;
  question?: {
    stage?: string;
    text?: string;
    reason?: string | null;
    profile_context_used?: boolean;
    choices?: VoiceTriageChoice[];
  };
  report?: {
    triage_report_id?: string | null;
    next_step_level?: string | null;
    chief_complaint?: string;
    watch_signs?: string[];
  };
  emergencyContact?: EmergencyContact | null;
  staff_review_requested?: boolean;
  action_options?: VoiceTriageActionOption[];
  guidancePlan?: {
    confidence?: TriageSummary["contextConfidence"];
    usefulSignals?: TriageSummary["contextSignals"];
    protocolLabel?: string;
    nextQuestionFocus?: string;
  } | null;
};

type VoiceTriageSessionResponse = {
  conversation_id: string;
  status: "active" | "emergency" | "complete" | "abandoned" | "failed";
  latest_response?: VoiceTriageLatestResponse;
  triage_report_id?: string | null;
  updated_at?: string;
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
  sent_to?: string[];
  staff_review_requested?: boolean;
};

type ConciergePrefillKind = "ride" | "appointment" | "home_care_quote";

type ReportAction = {
  kind: SymptomRecommendationActionKind | "add_doctor_contact";
  label: string;
  ariaLabel: string;
  Icon: LucideIcon;
  href?: string;
  onClick?: () => void;
};

const SYMPTOM_CHECK_DRAFT_KEY = "vyva.symptomCheck.draft.v1";
const SYMPTOM_CHECK_DRAFT_TTL_MS = 2 * 60 * 60 * 1000;
const SYMPTOM_CHECK_VISITED_KEY = "vyva_symptom_check_visited";
const VOICE_SESSION_STORAGE_KEY = "vyva.voice.sessionId";

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

function readCurrentVoiceSessionId() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOICE_SESSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearCurrentVoiceSessionId() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VOICE_SESSION_STORAGE_KEY);
  } catch {
    // Ignore private-mode storage errors.
  }
}

function readSymptomCheckVisited() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SYMPTOM_CHECK_VISITED_KEY) === "true";
  } catch {
    return false;
  }
}

function writeSymptomCheckVisited() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SYMPTOM_CHECK_VISITED_KEY, "true");
  } catch {
    return;
  }
}

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

export function AssessmentConfidenceTracker({
  current,
  variant = "full",
}: {
  current: Step;
  variant?: "full" | "compact";
}) {
  const { t } = useTranslation();
  const isReport = current === "report";
  const activeIndex = isReport ? 2 : current === "chat" ? 1 : 0;
  const filledSignals = isReport ? 5 : current === "chat" ? 4 : 2;
  const confidenceLabel = isReport
    ? t("health.symptomCheck.tracker.high", "High")
    : current === "chat"
      ? t("health.symptomCheck.tracker.medium", "Medium")
      : t("health.symptomCheck.tracker.low", "Low");
  const statusLabel = isReport
    ? t("health.symptomCheck.tracker.ready", "Ready to guide")
    : current === "chat"
      ? t("health.symptomCheck.tracker.building", "Confidence improving")
      : t("health.symptomCheck.tracker.starting", "Getting started");
  const detailLabel = isReport
    ? t("health.symptomCheck.tracker.prepared", "Next steps are ready")
    : current === "chat"
      ? t("health.symptomCheck.tracker.checking", "VYVA is checking symptoms and safety signs")
      : t("health.symptomCheck.tracker.listening", "Tell me how you feel, right now");
  const milestones = [
    { key: "listen", label: t("health.symptomCheck.tracker.listen", "Symptoms"), Icon: Stethoscope },
    { key: "check", label: t("health.symptomCheck.tracker.check", "Safety check"), Icon: Activity },
    { key: "next", label: t("health.symptomCheck.tracker.nextStep", "Next step"), Icon: CheckCircle },
  ];
  const confidenceValue = `${filledSignals}/5`;
  const activeStageLabel = milestones[activeIndex]?.label ?? milestones[0].label;

  if (variant === "compact") {
    return (
      <section
        className="mx-4 overflow-hidden rounded-[28px] border border-[#D8C7FF] bg-white shadow-[0_16px_36px_rgba(63,45,35,0.10)] sm:mx-5 lg:mx-auto lg:w-full lg:max-w-[760px]"
        data-testid="assessment-confidence-tracker"
      >
        <div className="bg-[linear-gradient(135deg,#FFFFFF_0%,#F7F1FF_58%,#FFF8EA_100%)] px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="relative flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[22px] bg-vyva-purple text-white shadow-[0_12px_24px_rgba(107,33,168,0.24)]"
              aria-hidden="true"
            >
              <Activity size={25} className={!isReport ? "motion-safe:animate-pulse" : ""} />
              {!isReport ? (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
                  <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
                </span>
              ) : null}
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-black uppercase text-vyva-purple">
                {t("health.symptomCheck.tracker.live", "Live assessment")}
              </p>
              <p className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {statusLabel}
              </p>
              <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                {detailLabel}
              </p>
            </div>

            <div
              className="flex min-h-[58px] min-w-[74px] flex-shrink-0 flex-col items-center justify-center rounded-[22px] border border-white bg-white px-2 text-center shadow-[0_8px_18px_rgba(63,45,35,0.07)]"
              role="meter"
              aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={filledSignals}
              aria-valuetext={`${confidenceLabel} ${confidenceValue}`}
            >
              <span className="font-body text-[20px] font-black leading-none text-vyva-purple">
                {confidenceValue}
              </span>
              <span className="mt-1 rounded-full bg-[#ECFDF5] px-2 py-1 font-body text-[10px] font-black uppercase text-[#047857]">
                {confidenceLabel}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => {
              const isFilled = index < filledSignals;
              const isCurrent = index === filledSignals - 1 && !isReport;

              return (
                <span
                  key={index}
                  className={`h-3 rounded-full transition-all duration-300 ${
                    isFilled
                      ? `bg-vyva-purple shadow-[0_7px_14px_rgba(107,33,168,0.18)] ${isCurrent ? "motion-safe:animate-pulse" : ""}`
                      : "bg-[#E8DED4]"
                  }`}
                />
              );
            })}
          </div>
        </div>

        <div className="border-t border-[#EEE4DA] bg-[#FFFCF8] px-3 py-3">
          <div className="grid grid-cols-3 gap-2" aria-label={t("health.symptomCheck.tracker.label", "Confidence level")} data-testid="assessment-confidence-signals">
            {milestones.map(({ key, label, Icon }, index) => {
              const isComplete = index < activeIndex;
              const isActive = index === activeIndex;
              const stateLabel = isComplete
                ? t("health.symptomCheck.tracker.complete", "Done")
                : isActive
                  ? t("health.symptomCheck.tracker.current", "Now")
                  : t("health.symptomCheck.tracker.waiting", "Next");
              const tileClass = isActive
                ? "border-vyva-purple bg-vyva-purple text-white shadow-[0_10px_22px_rgba(107,33,168,0.18)]"
                : isComplete
                  ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
                  : "border-[#E8DED4] bg-white text-vyva-text-2";
              const iconClass = isActive
                ? `bg-white/18 text-white ${isReport ? "" : "motion-safe:animate-pulse"}`
                : isComplete
                  ? "bg-[#10B981] text-white"
                  : "bg-[#F4EEE8] text-vyva-text-2";

              return (
                <div
                  key={key}
                  aria-current={isActive ? "step" : undefined}
                  className={`min-h-[70px] rounded-[18px] border px-2 py-2 text-center transition-all ${tileClass}`}
                >
                  <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                    <Icon size={17} />
                  </span>
                  <span className="mt-1 block font-body text-[11px] font-black leading-tight">
                    {label}
                  </span>
                  <span className="mt-0.5 block font-body text-[10px] font-black uppercase opacity-75">
                    {stateLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-center font-body text-[12px] font-black text-vyva-purple">
            {activeStageLabel}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div
      className="mx-4 rounded-[30px] border border-[#E8DED4] bg-[linear-gradient(135deg,#FFFFFF_0%,#F6EEFF_48%,#FFF7E8_100%)] p-4 shadow-[0_16px_34px_rgba(63,45,35,0.10)] sm:mx-5 lg:mx-auto lg:w-full lg:max-w-[760px]"
      data-testid="assessment-confidence-tracker"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative flex min-h-[102px] flex-shrink-0 items-center gap-3 rounded-[26px] border border-white/80 bg-white px-4 py-3 shadow-[0_12px_26px_rgba(107,33,168,0.14)] sm:w-[188px] sm:flex-col sm:items-start sm:justify-center"
          role="meter"
          aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={filledSignals}
          aria-valuetext={`${confidenceLabel} ${filledSignals}/5`}
        >
          <span className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-[20px] bg-vyva-purple text-white shadow-[0_12px_22px_rgba(107,33,168,0.24)]">
            <Activity size={28} className={!isReport ? "motion-safe:animate-pulse" : ""} />
          </span>
          <span className="min-w-0 font-body leading-tight">
            <span className="block text-[11px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
              {t("health.symptomCheck.tracker.label", "Confidence level")}
            </span>
            <strong className="mt-1 block text-[24px] font-black text-vyva-purple">{confidenceLabel}</strong>
            <span className="mt-2 flex gap-1" aria-hidden="true" data-testid="assessment-confidence-signals">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-full ${
                    index < filledSignals
                      ? "bg-vyva-purple"
                      : "bg-[#E8DED4]"
                  }`}
                />
              ))}
            </span>
          </span>
          <span className="sr-only">
            {t("health.symptomCheck.tracker.label", "Confidence level")}:
            {" "}
            {filledSignals}/5
            {" "}
            {confidenceLabel}
          </span>
          {!isReport ? (
            <span className="absolute right-3 top-3 flex h-4 w-4 items-center justify-center rounded-full bg-[#34D399] ring-4 ring-white">
              <span className="h-2 w-2 rounded-full bg-white motion-safe:animate-pulse" />
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-purple">
                {isReport
                  ? t("health.symptomCheck.tracker.complete", "Done")
                  : t("health.symptomCheck.tracker.live", "Live")}
              </p>
              <p className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
                {statusLabel}
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#047857] shadow-[0_4px_12px_rgba(63,45,35,0.06)]">
              {confidenceLabel}
            </span>
          </div>
          <p className="mt-2 font-body text-[15px] font-bold leading-snug text-vyva-text-2 sm:text-[16px]">
            {detailLabel}
          </p>
          <div className="mt-4 rounded-[22px] border border-white/80 bg-white/82 px-4 py-3 shadow-[0_8px_18px_rgba(63,45,35,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <span className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.tracker.live", "Live")}
              </span>
              <span className="flex gap-2" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-4 w-4 rounded-full transition-all duration-300 ${
                      index < filledSignals
                        ? "bg-vyva-purple shadow-[0_6px_14px_rgba(107,33,168,0.22)]"
                        : "bg-[#E8DED4]"
                    }`}
                  />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2" aria-label={t("health.symptomCheck.tracker.label", "Confidence level")}>
        {milestones.map(({ key, label, Icon }, index) => {
          const isComplete = index < activeIndex;
          const isActive = index === activeIndex;
          const stateLabel = isComplete
            ? t("health.symptomCheck.tracker.complete", "Done")
            : isActive
              ? t("health.symptomCheck.tracker.current", "Now")
              : t("health.symptomCheck.tracker.waiting", "Next");
          const tileClass = isActive
            ? "border-vyva-purple bg-white text-vyva-purple shadow-[0_10px_20px_rgba(107,33,168,0.14)]"
            : isComplete
              ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E8DED4] bg-white/70 text-vyva-text-2";
          const iconClass = isActive
            ? `bg-vyva-purple text-white ${isReport ? "" : "motion-safe:animate-pulse"}`
            : isComplete
              ? "bg-[#10B981] text-white"
              : "bg-[#F4EEE8] text-vyva-text-2";

          return (
            <div
              key={key}
              aria-current={isActive ? "step" : undefined}
              className={`min-h-[82px] rounded-[20px] border px-2 py-2 text-center transition-all ${tileClass}`}
            >
              <span className={`mx-auto flex h-9 w-9 items-center justify-center rounded-[14px] ${iconClass}`}>
                <Icon size={18} />
              </span>
              <span className="mt-1 block font-body text-[12px] font-black leading-tight">
                {label}
              </span>
              <span className="mt-0.5 block font-body text-[10px] font-black uppercase tracking-[0.08em] opacity-70">
                {stateLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type VoiceTriageAnswerInput = {
  choiceId?: string | null;
  utterance: string;
  vitalsText?: string | null;
};

function VoiceTriageLivePanel({
  session,
  onAnswer,
  onStartOver,
  isAnswering = false,
}: {
  session: VoiceTriageSessionResponse;
  onAnswer?: (answer: VoiceTriageAnswerInput) => void;
  onStartOver?: () => void;
  isAnswering?: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typedAnswer, setTypedAnswer] = useState("");
  const latest = session.latest_response;
  const question = latest?.question;
  const choices = question?.choices?.slice(0, 3) ?? [];
  const actionOptions = latest?.action_options?.filter((action) => action.kind !== "call_emergency") ?? [];
  const vitalsPrompt = latest?.vitals_prompt;
  const isEmergency = session.status === "emergency";
  const isComplete = session.status === "complete";
  const isFailed = session.status === "failed";
  const canTapAnswer = Boolean(onAnswer && !isAnswering && !isEmergency && !isComplete && !isFailed);
  const voiceGuidancePlan = latest?.guidancePlan;
  const emergencyContact = latest?.emergencyContact;
  const statusLabel = isEmergency
    ? t("health.symptomCheck.voicePanel.emergency", "Emergency guidance")
    : isComplete
      ? t("health.symptomCheck.voicePanel.saved", "Report saved")
      : isFailed
        ? t("health.symptomCheck.voicePanel.needsRetry", "Needs retry")
        : t("health.symptomCheck.voicePanel.live", "Voice and touch check");
  const headline = isEmergency
    ? latest?.spoken_text || t("health.symptomCheck.voicePanel.emergencyFallback", "This may need emergency help.")
    : isComplete
      ? latest?.report?.chief_complaint || t("health.symptomCheck.voicePanel.completedTitle", "Your check has been saved.")
      : question?.text || latest?.spoken_text || t("health.symptomCheck.voicePanel.waiting", "VYVA is listening.");
  const cleanTypedAnswer = typedAnswer.trim();
  const submitTypedAnswer = () => {
    if (!cleanTypedAnswer || !canTapAnswer) return;
    onAnswer?.({ utterance: cleanTypedAnswer });
    setTypedAnswer("");
  };
  const runActionOption = (action: VoiceTriageActionOption) => {
    if (action.disabled) return;
    if (action.tel_href) {
      window.location.href = action.tel_href;
      return;
    }
    if (action.route) navigate(action.route);
  };

  return (
    <aside
      className={`mx-auto mt-4 w-full max-w-[1040px] overflow-hidden rounded-[30px] border bg-white shadow-[0_18px_44px_rgba(63,45,35,0.09)] ${
        isEmergency ? "border-[#FCA5A5]" : isComplete ? "border-[#BBF7D0]" : isFailed ? "border-[#FCA5A5]" : "border-[#DDD6FE]"
      }`}
      data-testid="voice-triage-live-panel"
      aria-live="polite"
    >
      <div className={`p-4 sm:p-5 ${
        isEmergency ? "bg-[#FFF7F7]" : isComplete ? "bg-[#F0FDF4]" : "bg-gradient-to-br from-[#FBFAFF] via-white to-[#F0FDFF]"
      }`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] shadow-sm ${
              isEmergency ? "bg-[#FEE2E2] text-[#B91C1C]" : isComplete ? "bg-[#DCFCE7] text-[#047857]" : "bg-white text-vyva-purple"
            }`}>
              {isEmergency ? <AlertTriangle size={24} strokeWidth={2.8} /> : isComplete ? <CheckCircle size={24} strokeWidth={2.8} /> : <Mic size={24} strokeWidth={2.8} />}
            </span>
            <div className="min-w-0">
              <p className={`font-body text-[12px] font-black uppercase tracking-[0.14em] ${
                isEmergency ? "text-[#B91C1C]" : isComplete ? "text-[#047857]" : "text-vyva-purple"
              }`}>
                {statusLabel}
              </p>
              <h2 className="mt-1 font-body text-[24px] font-black leading-tight text-vyva-text-1 sm:text-[30px]">
                {headline}
              </h2>
              {!isComplete && !isEmergency ? (
                <p className="mt-2 font-body text-[15px] font-bold leading-snug text-vyva-text-2">
                  {t("health.symptomCheck.voicePanel.sayOrTap", "Say your answer out loud, or tap one answer below.")}
                </p>
              ) : null}
              {voiceGuidancePlan?.confidence ? (
                <p className="mt-2 inline-flex rounded-full border border-[#BFDBFE] bg-white px-3 py-1.5 font-body text-[12px] font-black text-[#1D4ED8]" data-testid="voice-triage-context-confidence">
                  {t("health.symptomCheck.voicePanel.contextConfidence", "{{label}} - {{score}}/5 signals", {
                    label: voiceGuidancePlan.confidence.label,
                    score: voiceGuidancePlan.confidence.score,
                  })}
                </p>
              ) : null}
            </div>
          </div>
          {isAnswering ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[13px] font-black text-vyva-purple shadow-sm">
              <Loader2 size={16} className="animate-spin" />
              {t("health.symptomCheck.voicePanel.checking", "Checking")}
            </span>
          ) : isComplete && latest?.report?.triage_report_id ? (
            <span className="rounded-full bg-[#DCFCE7] px-3 py-2 font-body text-[13px] font-black text-[#047857]">
              {t("health.symptomCheck.voicePanel.reportReady", "Ready in My Reports")}
            </span>
          ) : onStartOver ? (
            <button
              type="button"
              onClick={onStartOver}
              className="vyva-tap rounded-full border border-[#DDD6FE] bg-white px-3 py-2 font-body text-[13px] font-black text-vyva-purple shadow-sm"
            >
              {t("health.symptomCheck.voicePanel.startOver", "Start over")}
            </button>
          ) : null}
        </div>

        {choices.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={!canTapAnswer}
                onClick={() => onAnswer?.({
                  choiceId: choice.id,
                  utterance: choice.value || choice.spoken_label,
                })}
                className="vyva-tap flex min-h-[74px] items-center justify-center rounded-[22px] border border-[#DDD6FE] bg-white px-4 py-3 text-center font-body text-[16px] font-black leading-tight text-vyva-text-1 shadow-[0_8px_20px_rgba(63,45,35,0.06)] transition hover:border-vyva-purple hover:text-vyva-purple disabled:cursor-not-allowed disabled:opacity-55 sm:text-[17px]"
              >
                {choice.spoken_label}
              </button>
            ))}
          </div>
        ) : null}

        {!isEmergency && !isComplete && !isFailed ? (
          <div className="mt-4 rounded-[24px] border border-[#E8DED4] bg-white p-2 shadow-sm">
            <label className="sr-only" htmlFor="voice-triage-typed-answer">
              {t("health.symptomCheck.voicePanel.typeAnother", "Type another answer")}
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                id="voice-triage-typed-answer"
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitTypedAnswer();
                  }
                }}
                placeholder={t("health.symptomCheck.voicePanel.typePlaceholder", "Or type your answer...")}
                className="min-h-[56px] min-w-0 rounded-[18px] border border-transparent bg-[#FBFAFF] px-4 font-body text-[16px] font-bold text-vyva-text-1 outline-none placeholder:text-[#9A8C83] focus:border-vyva-purple"
              />
              <button
                type="button"
                onClick={submitTypedAnswer}
                disabled={!canTapAnswer || cleanTypedAnswer.length < 2}
                className="vyva-tap flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-4 font-body text-[15px] font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Send size={18} strokeWidth={2.7} />
                {t("health.symptomCheck.voicePanel.sendAnswer", "Send")}
              </button>
            </div>
          </div>
        ) : null}

        {!isEmergency && !isComplete && vitalsPrompt?.actions?.length ? (
          <div className="mt-4 rounded-[24px] border border-[#BFEAF2] bg-white/85 p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[15px] bg-[#E6FAFD] text-[#0E7490]">
                <Activity size={20} strokeWidth={2.7} />
              </span>
              <div className="min-w-0">
                <p className="font-body text-[15px] font-black text-vyva-text-1">
                  {vitalsPrompt.title}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2">
                  {vitalsPrompt.body}
                </p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {vitalsPrompt.actions.slice(0, 2).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  disabled={!canTapAnswer}
                  onClick={() => onAnswer?.({ utterance: action.value, vitalsText: action.value })}
                  className="vyva-tap min-h-[54px] rounded-[18px] border border-[#BFEAF2] bg-white px-3 font-body text-[14px] font-black text-[#0E7490] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {question?.reason ? (
          <details className="mt-4 rounded-[20px] border border-[#E8DED4] bg-white/80 px-4 py-3">
            <summary className="cursor-pointer list-none font-body text-[13px] font-black text-vyva-text-2">
              {t("health.symptomCheck.voicePanel.whyAsking", "Why VYVA is asking this")}
            </summary>
            <p className="mt-2 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
              {question.reason}
            </p>
          </details>
        ) : null}

        {isComplete && actionOptions.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {actionOptions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={Boolean(action.disabled)}
                onClick={() => runActionOption(action)}
                className="vyva-tap flex min-h-[52px] items-center justify-center gap-2 rounded-[18px] border border-[#BBF7D0] bg-white px-3 text-center font-body text-[14px] font-black text-[#047857] shadow-sm disabled:cursor-default disabled:border-[#E5E7EB] disabled:text-vyva-text-2"
              >
                {action.kind === "view_report" ? <FileText size={17} strokeWidth={2.7} /> : <CheckCircle size={17} strokeWidth={2.7} />}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        ) : null}

        {isEmergency && emergencyContact?.telHref ? (
          <a
            href={emergencyContact.telHref}
            className="vyva-tap mt-4 flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#B91C1C] px-4 text-center font-body text-[17px] font-black text-white shadow-[0_12px_28px_rgba(185,28,28,0.22)] sm:w-fit"
          >
            <PhoneCall size={20} strokeWidth={2.8} />
            {t("health.symptomCheck.voicePanel.callEmergency", "Call {{number}} now", { number: emergencyContact.label })}
          </a>
        ) : null}
      </div>
    </aside>
  );
}

type IntroScreenProps = {
  onStart: (clue: string) => void;
  onTalkToVyva?: () => void;
  onEmergencyUnsure?: () => void;
  onNavigate?: (route: string) => void;
  personalizedSuggestions?: TriagePersonalizedSuggestion[];
  activeConditions?: string[];
  profileContextItems?: string[];
  emergencyContact?: EmergencyContact | null;
  showGuide?: boolean;
};

function fallbackIntroSuggestions(t: ReturnType<typeof useTranslation>["t"]): TriagePersonalizedSuggestion[] {
  return [
    {
      id: "fallback-breathing",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackBreathingLabel", "Breathing feels different"),
      description: t("health.symptomCheck.intro.fallbackBreathingDesc", "Start with what changed and when."),
      initialClue: t("health.symptomCheck.intro.fallbackBreathingClue", "Breathing feels different"),
      tone: "blue",
      icon: "wind",
      source: "fallback",
      priority: 45,
    },
    {
      id: "fallback-pain",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackPainLabel", "Pain or headache"),
      description: t("health.symptomCheck.intro.fallbackPainDesc", "Tell VYVA where it hurts."),
      initialClue: t("health.symptomCheck.intro.fallbackPainClue", "Pain or headache"),
      tone: "red",
      icon: "heart",
      source: "fallback",
      priority: 44,
    },
    {
      id: "fallback-dizzy",
      kind: "common_concern",
      label: t("health.symptomCheck.intro.fallbackDizzyLabel", "Dizzy or weak"),
      description: t("health.symptomCheck.intro.fallbackDizzyDesc", "Start with when it began."),
      initialClue: t("health.symptomCheck.intro.fallbackDizzyClue", "Dizzy or weak"),
      tone: "amber",
      icon: "activity",
      source: "fallback",
      priority: 43,
    },
    {
      id: "fallback-vitals",
      kind: "health_improvement",
      label: t("health.symptomCheck.intro.fallbackVitalsLabel", "Check vitals"),
      description: t("health.symptomCheck.intro.fallbackVitalsDesc", "Add a quick reading before or after the check."),
      route: "/health/vitals",
      tone: "blue",
      icon: "gauge",
      source: "fallback",
      priority: 42,
    },
    {
      id: "fallback-checkin",
      kind: "health_improvement",
      label: t("health.symptomCheck.intro.fallbackCheckinLabel", "Daily check-in"),
      description: t("health.symptomCheck.intro.fallbackCheckinDesc", "Log how today feels in one minute."),
      route: "/health/check-in",
      tone: "green",
      icon: "activity",
      source: "fallback",
      priority: 41,
    },
  ];
}

function symptomSeverityForSummary(summary: TriageSummary): "mild" | "moderate" | "severe" {
  if (summary.nextStepLevel === "emergency" || summary.nextStepLevel === "doctor_today" || summary.urgency === "urgent") {
    return "severe";
  }
  if (summary.nextStepLevel === "doctor_24_48" || summary.urgency === "routine") {
    return "moderate";
  }
  return "mild";
}

type ConditionChipGroup = "heart" | "diabetes" | "alzheimers" | "asthma" | "anxiety" | "falls" | "oncology";

const conditionChipGroups: Array<{ group: ConditionChipGroup; pattern: RegExp }> = [
  { group: "heart", pattern: /\b(heart|cardiac|coronary|angina|atrial|afib|hypertension|blood pressure|stroke|tia)\b/i },
  { group: "diabetes", pattern: /\b(diabetes|diabetic|glucose|blood sugar|insulin|metformin)\b/i },
  { group: "alzheimers", pattern: /\b(alzheimer|dementia|memory|cognitive)\b/i },
  { group: "asthma", pattern: /\b(asthma|copd|emphysema|inhaler|breathing)\b/i },
  { group: "anxiety", pattern: /\b(anxiety|panic|anxious|depression|low mood)\b/i },
  { group: "falls", pattern: /\b(fall|falls|unsteady|frail|frailty|balance|walker|walking aid|mobility)\b/i },
  { group: "oncology", pattern: /\b(cancer|oncology|chemo|chemotherapy|tumou?r|malignan)\b/i },
];

function matchedConditionGroups(activeConditions: string[]): ConditionChipGroup[] {
  const normalized = activeConditions.join(" ");
  const groups: ConditionChipGroup[] = [];
  for (const item of conditionChipGroups) {
    if (item.pattern.test(normalized) && !groups.includes(item.group)) groups.push(item.group);
  }
  return groups;
}

function conditionAwareIntroSuggestions(
  activeConditions: string[],
  t: ReturnType<typeof useTranslation>["t"],
): TriagePersonalizedSuggestion[] {
  const groupSuggestions: Record<ConditionChipGroup, TriagePersonalizedSuggestion[]> = {
    heart: [
      {
        id: "condition-heart-chest-tight",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionHeartChest", "Chest feels tight"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionHeartChestClue", "Chest feels tight"),
        tone: "red",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 120,
      },
      {
        id: "condition-heart-short-breath",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionShortBreath", "Short of breath"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionShortBreathClue", "I feel short of breath"),
        tone: "red",
        icon: "wind",
        source: "profile",
        reasonCode: "condition_match",
        priority: 119,
      },
    ],
    diabetes: [
      {
        id: "condition-diabetes-shaky",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionDiabetesShaky", "Feeling shaky or weak"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionDiabetesShakyClue", "I feel shaky or weak"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 118,
      },
      {
        id: "condition-diabetes-thirsty",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionDiabetesThirsty", "Very thirsty"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionDiabetesThirstyClue", "I feel very thirsty"),
        tone: "amber",
        icon: "droplet",
        source: "profile",
        reasonCode: "condition_match",
        priority: 117,
      },
    ],
    alzheimers: [
      {
        id: "condition-alzheimers-confused",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAlzheimersConfused", "Feeling confused"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAlzheimersConfusedClue", "I feel confused"),
        tone: "red",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 116,
      },
      {
        id: "condition-alzheimers-memory",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAlzheimersMemory", "Memory feels off"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAlzheimersMemoryClue", "My memory feels off"),
        tone: "purple",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 115,
      },
    ],
    asthma: [
      {
        id: "condition-asthma-hard-breathe",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAsthmaBreathe", "Hard to breathe"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAsthmaBreatheClue", "It is hard to breathe"),
        tone: "red",
        icon: "wind",
        source: "profile",
        reasonCode: "condition_match",
        priority: 114,
      },
      {
        id: "condition-asthma-chest-tight",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionHeartChest", "Chest feels tight"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionHeartChestClue", "Chest feels tight"),
        tone: "red",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 113,
      },
    ],
    anxiety: [
      {
        id: "condition-anxiety-heart-racing",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAnxietyHeart", "Heart racing"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAnxietyHeartClue", "My heart is racing"),
        tone: "amber",
        icon: "heart",
        source: "profile",
        reasonCode: "condition_match",
        priority: 112,
      },
      {
        id: "condition-anxiety-panicked",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionAnxietyPanicked", "Feeling panicked"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionAnxietyPanickedClue", "I feel panicked"),
        tone: "purple",
        icon: "brain",
        source: "profile",
        reasonCode: "condition_match",
        priority: 111,
      },
    ],
    falls: [
      {
        id: "condition-falls-unsteady",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionFallsUnsteady", "Feeling unsteady"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionFallsUnsteadyClue", "I feel unsteady"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 110,
      },
      {
        id: "condition-falls-dizzy",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionFallsDizzy", "Dizzy or lightheaded"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionFallsDizzyClue", "I feel dizzy or lightheaded"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 109,
      },
    ],
    oncology: [
      {
        id: "condition-oncology-tired",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionOncologyTired", "More tired than usual"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionOncologyTiredClue", "I feel more tired than usual"),
        tone: "amber",
        icon: "activity",
        source: "profile",
        reasonCode: "condition_match",
        priority: 108,
      },
      {
        id: "condition-oncology-sick",
        kind: "common_concern",
        label: t("health.symptomCheck.intro.conditionOncologySick", "Feeling sick"),
        description: t("health.symptomCheck.intro.conditionProfileChipDesc", "Start here if this fits today."),
        initialClue: t("health.symptomCheck.intro.conditionOncologySickClue", "I feel sick"),
        tone: "amber",
        icon: "stethoscope",
        source: "profile",
        reasonCode: "condition_match",
        priority: 107,
      },
    ],
  };

  const seen = new Set<string>();
  const chips: TriagePersonalizedSuggestion[] = [];
  for (const group of matchedConditionGroups(activeConditions)) {
    for (const suggestion of groupSuggestions[group]) {
      const dedupeKey = suggestion.label.toLowerCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      chips.push(suggestion);
      if (chips.length >= 4) return chips;
    }
  }
  return chips;
}

const suggestionIconByKey: Record<TriagePersonalizedSuggestion["icon"], LucideIcon> = {
  activity: Activity,
  brain: Brain,
  droplet: Droplets,
  gauge: Gauge,
  heart: HeartPulse,
  home: Home,
  pill: Pill,
  shield: ShieldCheck,
  stethoscope: Stethoscope,
  wind: Wind,
};

const suggestionToneClass: Record<TriagePersonalizedSuggestion["tone"], { button: string; icon: string; badge: string }> = {
  amber: {
    button: "border-[#FED7AA] bg-[#FFF7ED] hover:border-[#FDBA74]",
    icon: "bg-[#FFEDD5] text-[#C2410C]",
    badge: "bg-[#FFEDD5] text-[#9A3412]",
  },
  blue: {
    button: "border-[#BFDBFE] bg-[#EFF6FF] hover:border-[#93C5FD]",
    icon: "bg-[#DBEAFE] text-[#1D4ED8]",
    badge: "bg-[#DBEAFE] text-[#1D4ED8]",
  },
  green: {
    button: "border-[#BBF7D0] bg-[#ECFDF5] hover:border-[#86EFAC]",
    icon: "bg-[#D1FAE5] text-[#047857]",
    badge: "bg-[#D1FAE5] text-[#047857]",
  },
  purple: {
    button: "border-[#DDD6FE] bg-[#F5F3FF] hover:border-[#C4B5FD]",
    icon: "bg-[#EDE9FE] text-vyva-purple",
    badge: "bg-[#EDE9FE] text-vyva-purple",
  },
  red: {
    button: "border-[#FECACA] bg-[#FEF2F2] hover:border-[#FCA5A5]",
    icon: "bg-[#FEE2E2] text-[#B91C1C]",
    badge: "bg-[#FEE2E2] text-[#B91C1C]",
  },
};

type VoiceCaptureState = "idle" | "recording" | "transcribing";
const VOICE_CAPTURE_MAX_MS = 30_000;

const voiceMimeCandidates = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function preferredVoiceMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return voiceMimeCandidates.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  }) ?? "";
}

function stopVoiceStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function IntroScreen({
  onStart,
  onTalkToVyva,
  onEmergencyUnsure,
  onNavigate,
  personalizedSuggestions,
  activeConditions = [],
  profileContextItems = [],
  emergencyContact = null,
  showGuide = true,
}: IntroScreenProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [clue, setClue] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStopTimerRef = useRef<number | null>(null);
  const cleanClue = clue.trim();
  const canStart = cleanClue.length >= 2;
  const isRecordingVoice = voiceState === "recording";
  const isTranscribingVoice = voiceState === "transcribing";
  const fallbackSuggestions = fallbackIntroSuggestions(t);
  const suggestions = personalizedSuggestions?.length ? personalizedSuggestions : fallbackSuggestions;
  const conditionExamples = conditionAwareIntroSuggestions(activeConditions, t);
  const candidateConcerns = suggestions.filter((suggestion) => suggestion.kind === "common_concern");
  const fallbackConcerns = fallbackSuggestions.filter((suggestion) => suggestion.kind === "common_concern");
  const defaultExamples = [
    ...candidateConcerns,
    ...fallbackConcerns.filter((fallback) => !candidateConcerns.some((suggestion) => suggestion.id === fallback.id)),
  ];
  const visibleExamples = conditionExamples.length
    ? [
        ...conditionExamples,
        ...fallbackConcerns.filter((fallback) => !conditionExamples.some((suggestion) => suggestion.label.toLowerCase() === fallback.label.toLowerCase())),
      ].slice(0, 4)
    : defaultExamples.slice(0, 3);
  const visibleExampleIds = new Set(visibleExamples.map((suggestion) => suggestion.id));
  const healthImprovements = suggestions.filter((suggestion) => suggestion.kind === "health_improvement").slice(0, 5);
  const moreIdeas = [
    ...suggestions.filter((suggestion) => !visibleExampleIds.has(suggestion.id)),
    ...fallbackSuggestions.filter((suggestion) => !visibleExampleIds.has(suggestion.id) && !suggestions.some((current) => current.id === suggestion.id)),
  ].slice(0, 8);
  const hasProfileSuggestions = suggestions.some((suggestion) => suggestion.source !== "fallback");
  const sourceLabels: Record<TriagePersonalizedSuggestion["source"], string> = {
    fallback: t("health.symptomCheck.intro.sourceFallback", "Common option"),
    medications: t("health.symptomCheck.intro.sourceMedications", "From medicines"),
    profile: t("health.symptomCheck.intro.sourceProfile", "Based on profile"),
    recent_report: t("health.symptomCheck.intro.sourceRecentReport", "Recent report"),
    vitals: t("health.symptomCheck.intro.sourceVitals", "Recent vitals"),
  };
  const handleEmergencyUnsure = useCallback(() => {
    if (onEmergencyUnsure) {
      onEmergencyUnsure();
      return;
    }
    onStart(t("health.symptomCheck.intro.notSureEmergencyClue", "I am not sure if this is urgent"));
  }, [onEmergencyUnsure, onStart, t]);

  const renderSuggestion = (suggestion: TriagePersonalizedSuggestion) => {
    const Icon = suggestionIconByKey[suggestion.icon] ?? Stethoscope;
    const tone = suggestionToneClass[suggestion.tone] ?? suggestionToneClass.purple;
    const isConcern = suggestion.kind === "common_concern";
    return (
      <button
        key={suggestion.id}
        type="button"
        onClick={() => {
          if (isConcern) {
            setClue(suggestion.initialClue || suggestion.label);
            return;
          }
          if (suggestion.route) onNavigate?.(suggestion.route);
        }}
        data-testid={`button-symptom-intro-suggestion-${suggestion.id}`}
        className={`vyva-tap group flex min-h-[78px] w-full min-w-0 items-start gap-3 rounded-[22px] border px-3 py-3 text-left shadow-[0_8px_20px_rgba(63,45,35,0.05)] transition sm:items-center ${tone.button}`}
      >
        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] ${tone.icon}`}>
          <Icon size={21} strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="break-words font-body text-[16px] font-black leading-tight text-vyva-text-1">
              {suggestion.label}
            </span>
            <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-black uppercase tracking-[0.08em] ${tone.badge}`}>
              {sourceLabels[suggestion.source]}
            </span>
          </span>
          <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2">
            {suggestion.description}
          </span>
        </span>
        {isConcern ? null : (
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/80 text-vyva-purple shadow-sm">
            <ArrowRight size={18} strokeWidth={2.8} />
          </span>
        )}
      </button>
    );
  };

  const renderExampleChip = (suggestion: TriagePersonalizedSuggestion, index: number) => {
    const Icon = suggestionIconByKey[suggestion.icon] ?? Stethoscope;
    const tone = suggestionToneClass[suggestion.tone] ?? suggestionToneClass.purple;
    return (
      <button
        key={suggestion.id}
        type="button"
        onClick={() => setClue(suggestion.initialClue || suggestion.label)}
        data-testid={`button-symptom-example-${index}`}
        className={`vyva-tap flex min-h-[74px] min-w-0 items-center gap-3 rounded-[22px] border px-4 py-3 text-left shadow-[0_8px_20px_rgba(63,45,35,0.05)] transition ${tone.button}`}
      >
        <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] ${tone.icon}`}>
          <Icon size={21} strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1 break-words font-body text-[16px] font-black leading-tight text-vyva-text-1">
          {suggestion.label}
        </span>
      </button>
    );
  };

  const clearVoiceStopTimer = useCallback(() => {
    if (voiceStopTimerRef.current !== null) {
      window.clearTimeout(voiceStopTimerRef.current);
      voiceStopTimerRef.current = null;
    }
  }, []);

  const transcribeVoiceBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 32) {
      setVoiceState("idle");
      setVoiceError(t("health.symptomCheck.intro.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      return;
    }

    setVoiceState("transcribing");
    try {
      const res = await apiFetch(`/api/triage/transcribe?language=${encodeURIComponent(language)}`, {
        method: "POST",
        headers: { "Content-Type": blob.type || "application/octet-stream" },
        body: blob,
      });

      const payload = await res.json().catch(() => null) as { transcript?: unknown; error?: unknown } | null;
      if (!res.ok) {
        const message = typeof payload?.error === "string"
          ? payload.error
          : t("health.symptomCheck.intro.voiceFailed", "I couldn't turn that voice note into text. Please try again.");
        throw new Error(message);
      }

      const transcript = typeof payload?.transcript === "string" ? payload.transcript.trim() : "";
      if (!transcript) {
        throw new Error(t("health.symptomCheck.intro.voiceEmpty", "I couldn't hear anything clearly. Please try again."));
      }

      setClue(transcript);
      setVoiceError(null);
      window.setTimeout(() => {
        document.getElementById("symptom-clue")?.focus();
      }, 0);
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : t("health.symptomCheck.intro.voiceFailed", "I couldn't turn that voice note into text. Please try again."));
    } finally {
      setVoiceState("idle");
    }
  }, [language, t]);

  const stopVoiceCapture = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const startVoiceCapture = useCallback(async () => {
    setVoiceError(null);
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setVoiceError(t("health.symptomCheck.intro.voiceUnsupported", "Voice input is not available in this browser."));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];

      const mimeType = preferredVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) voiceChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        clearVoiceStopTimer();
        stopVoiceStream(stream);
        voiceStreamRef.current = null;
        recorderRef.current = null;
        voiceChunksRef.current = [];
        setVoiceState("idle");
        setVoiceError(t("health.symptomCheck.intro.voiceMicError", "I couldn't use the microphone. Please try again or type instead."));
      };
      recorder.onstop = () => {
        clearVoiceStopTimer();
        const chunks = voiceChunksRef.current;
        const recordedType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: recordedType });
        stopVoiceStream(stream);
        voiceStreamRef.current = null;
        recorderRef.current = null;
        voiceChunksRef.current = [];
        void transcribeVoiceBlob(blob);
      };

      recorder.start();
      voiceStopTimerRef.current = window.setTimeout(() => {
        const activeRecorder = recorderRef.current;
        if (activeRecorder && activeRecorder.state !== "inactive") {
          activeRecorder.stop();
        }
      }, VOICE_CAPTURE_MAX_MS);
      setVoiceState("recording");
    } catch {
      clearVoiceStopTimer();
      stopVoiceStream(voiceStreamRef.current);
      voiceStreamRef.current = null;
      recorderRef.current = null;
      setVoiceState("idle");
      setVoiceError(t("health.symptomCheck.intro.voiceMicError", "I couldn't use the microphone. Please try again or type instead."));
    }
  }, [clearVoiceStopTimer, t, transcribeVoiceBlob]);

  const toggleVoiceCapture = useCallback(() => {
    if (isTranscribingVoice) return;
    if (isRecordingVoice) {
      stopVoiceCapture();
      return;
    }
    void startVoiceCapture();
  }, [isRecordingVoice, isTranscribingVoice, startVoiceCapture, stopVoiceCapture]);

  useEffect(() => () => {
    clearVoiceStopTimer();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
    }
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopVoiceStream(voiceStreamRef.current);
  }, [clearVoiceStopTimer]);

  const voiceButtonLabel = isRecordingVoice
    ? t("health.symptomCheck.intro.voiceStop", "Stop voice input")
    : isTranscribingVoice
      ? t("health.symptomCheck.intro.voiceTranscribing", "Turning voice into text")
      : onTalkToVyva
        ? t("health.symptomCheck.intro.talkToVyva", "Talk to VYVA")
        : t("health.symptomCheck.intro.voiceStart", "Use voice input");
  const voiceStatus = isRecordingVoice
    ? t("health.symptomCheck.intro.voiceRecording", "Listening... tap again to stop. It stops after 30 seconds.")
    : isTranscribingVoice
      ? t("health.symptomCheck.intro.voiceTranscribingStatus", "Turning voice into text...")
      : voiceError;
  const emergencyCallLabel = emergencyContact?.telHref
    ? t("health.symptomCheck.intro.emergencyCallNumber", "Call {{number}} now", { number: emergencyContact.label })
    : t("health.symptomCheck.intro.emergencyCall", "Call emergency services");
  const guidancePromises = [
    {
      key: "listen",
      label: t("health.symptomCheck.intro.promiseListen", "Speak freely"),
      body: t("health.symptomCheck.intro.promiseListenBody", "No medical words needed."),
      Icon: Mic,
    },
    {
      key: "profile",
      label: t("health.symptomCheck.intro.promiseProfile", "Profile-aware"),
      body: profileContextItems.length
        ? t("health.symptomCheck.intro.promiseProfileReady", "Medicines and context guide questions.")
        : t("health.symptomCheck.intro.promiseProfileFallback", "Safety questions come first."),
      Icon: Brain,
    },
    {
      key: "handoff",
      label: t("health.symptomCheck.intro.promiseHandoff", "Clear next step"),
      body: t("health.symptomCheck.intro.promiseHandoffBody", "Follow it or share it."),
      Icon: Share2,
    },
  ];
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1040px] flex-1 flex-col gap-4 px-4 py-3 sm:px-5 lg:px-0" data-testid="symptom-check-intro">
      <section
        className="rounded-[22px] border border-[#FECACA] bg-[#FFF7F7] p-3 shadow-[0_10px_24px_rgba(185,28,28,0.07)] sm:p-4"
        aria-label={t("health.symptomCheck.intro.emergencyTitle", "Emergency warning")}
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[16px] bg-[#FEE2E2] text-[#B91C1C] sm:h-12 sm:w-12 sm:rounded-[18px]">
              <AlertTriangle size={22} strokeWidth={2.8} />
            </span>
            <div className="min-w-0">
              <p className="font-body text-[16px] font-black leading-tight text-[#7F1D1D] sm:text-[17px]">
                {t("health.symptomCheck.intro.emergencyTitle", "If this feels urgent, do not wait")}
              </p>
              <p className="mt-1 font-body text-[13px] font-bold leading-snug text-[#991B1B] sm:text-[15px]">
                {t("health.symptomCheck.intro.emergencyBody", "Chest pain, breathing trouble, sudden weakness, heavy bleeding, or collapse needs emergency help.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-shrink-0 lg:flex-row">
            {emergencyContact?.telHref ? (
              <a
                href={emergencyContact.telHref}
                className="vyva-tap flex min-h-[48px] items-center justify-center gap-2 rounded-[17px] bg-[#B91C1C] px-3 text-center font-body text-[14px] font-black text-white shadow-[0_10px_24px_rgba(185,28,28,0.22)] sm:text-[15px]"
              >
                <PhoneCall size={18} strokeWidth={2.8} />
                {emergencyCallLabel}
              </a>
            ) : (
              <span className="flex min-h-[48px] items-center justify-center rounded-[17px] bg-[#B91C1C] px-3 text-center font-body text-[14px] font-black text-white sm:text-[15px]">
                {emergencyCallLabel}
              </span>
            )}
            <button
              type="button"
              onClick={handleEmergencyUnsure}
              className="vyva-tap min-h-[48px] rounded-[17px] border border-[#FCA5A5] bg-white px-3 font-body text-[14px] font-black text-[#991B1B] sm:text-[15px]"
            >
              {t("health.symptomCheck.intro.notSureEmergency", "Help me decide")}
            </button>
          </div>
        </div>
      </section>

      <section
        data-testid="symptom-check-start-panel"
        className={`grid min-w-0 gap-4 rounded-[32px] border border-[#E8DED4] bg-white p-4 shadow-[0_18px_46px_rgba(63,45,35,0.10)] sm:p-5 lg:p-6 ${showGuide ? "lg:grid-cols-[minmax(0,1fr)_270px]" : ""}`}
      >
        <div className="min-w-0 space-y-4">
          <div className="flex flex-col gap-4 text-left sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onTalkToVyva ?? toggleVoiceCapture}
              disabled={!onTalkToVyva && isTranscribingVoice}
              aria-label={voiceButtonLabel}
              title={voiceButtonLabel}
              data-testid="button-symptom-clue-voice"
              className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-[26px] border shadow-[0_12px_28px_rgba(107,33,168,0.16)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B21A8] focus-visible:ring-offset-2 sm:h-24 sm:w-24 ${
                isRecordingVoice
                  ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]"
                  : "border-[#DDD6FE] bg-[#F5F3FF] text-vyva-purple hover:border-[#C4B5FD]"
              } disabled:cursor-wait disabled:opacity-70`}
            >
                {!onTalkToVyva && isTranscribingVoice ? (
                  <Loader2 size={30} strokeWidth={2.8} className="animate-spin" />
              ) : !onTalkToVyva && isRecordingVoice ? (
                <Square size={24} strokeWidth={3} fill="currentColor" />
              ) : (
                <Mic size={36} strokeWidth={2.7} />
              )}
            </button>

            <div className="min-w-0">
              <h1 className="font-body text-[31px] font-black leading-[1.05] text-vyva-text-1 sm:text-[40px]">
                {t("health.symptomCheck.intro.assistantTitle", "Tell VYVA what has changed")}
              </h1>
              <p className="mt-2 max-w-[520px] font-body text-[17px] font-bold leading-snug text-vyva-text-2 sm:text-[18px]">
                {t("health.symptomCheck.intro.assistantBody", "Use your voice or type a few words.")}
              </p>
            </div>
          </div>

          <div className="rounded-[26px] border border-[#DDD6FE] bg-[#FBFAFF] p-3 shadow-[0_10px_26px_rgba(63,45,35,0.06)]">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_190px_190px]">
              <div className="grid gap-2 text-left">
                <label className="sr-only" htmlFor="symptom-clue">
                  {t("health.symptomCheck.intro.inputLabel", "What feels different?")}
                </label>
                <input
                  id="symptom-clue"
                  value={clue}
                  onChange={(event) => {
                    setClue(event.target.value);
                    if (voiceError) setVoiceError(null);
                  }}
                  placeholder={t("health.symptomCheck.intro.simplePlaceholder", "Type what changed...")}
                  data-testid="input-symptom-clue"
                  className="min-h-[70px] w-full min-w-0 max-w-full rounded-[22px] border-2 border-transparent bg-white px-5 py-3 font-body text-[18px] font-black text-vyva-text-1 shadow-[0_8px_18px_rgba(63,45,35,0.05)] outline-none placeholder:text-[#9A8C83] focus:border-[#6B21A8] sm:text-[22px]"
                />
              </div>

              {onTalkToVyva ? (
                <button
                  type="button"
                  onClick={onTalkToVyva}
                  data-testid="button-symptom-check-talk-to-vyva"
                  className="vyva-primary-action min-h-[70px] w-full self-end bg-[#17B8D6] text-[17px] shadow-[0_14px_28px_rgba(23,184,214,0.20)] sm:text-[18px]"
                >
                  {t("health.symptomCheck.intro.talkToVyva", "Talk to VYVA")}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => onStart(cleanClue)}
                disabled={!canStart}
                data-testid="button-symptom-check-start"
                className="vyva-primary-action min-h-[70px] w-full self-end text-[17px] disabled:opacity-45 sm:text-[18px]"
              >
                {t("health.symptomCheck.intro.startBtn", "Start check")}
              </button>
            </div>
            {voiceStatus ? (
              <p
                role={voiceError ? "alert" : "status"}
                data-testid="symptom-clue-voice-status"
                className={`mt-2 px-2 font-body text-[13px] font-bold leading-snug ${voiceError ? "text-[#B91C1C]" : "text-vyva-text-2"}`}
              >
                {voiceStatus}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2 text-left" data-testid="symptom-check-example-chips">
            <p className="px-1 font-body text-[12px] font-black uppercase tracking-[0.12em] text-vyva-text-3">
              {t("health.symptomCheck.intro.examplesLabel", "Examples")}
            </p>
            <div className={`grid gap-2 ${visibleExamples.length > 3 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
              {visibleExamples.map(renderExampleChip)}
            </div>
          </div>

        </div>

        {showGuide ? (
          <aside className="rounded-[24px] border border-[#D8C7FF] bg-[linear-gradient(180deg,#FBFAFF_0%,#FFFFFF_100%)] p-3 text-left shadow-[0_14px_34px_rgba(107,33,168,0.08)]">
            <details className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 rounded-[18px] bg-vyva-purple px-4 py-3 text-white shadow-[0_12px_28px_rgba(107,33,168,0.16)]">
                <span className="font-body text-[15px] font-black leading-tight">
                  {t("health.symptomCheck.intro.guideTitle", "How VYVA helps")}
                </span>
                <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 transition-transform group-open:rotate-90" />
              </summary>
              <div className="mt-2 grid gap-2">
                {guidancePromises.map(({ key, label, body, Icon }) => (
                  <div key={key} className="flex gap-2 rounded-[18px] border border-[#E8DED4] bg-white px-3 py-2">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[14px] bg-vyva-purple-light text-vyva-purple shadow-sm">
                      <Icon size={18} strokeWidth={2.7} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-body text-[14px] font-black leading-tight text-vyva-text-1">{label}</span>
                      <span className="mt-0.5 block font-body text-[12px] font-bold leading-snug text-vyva-text-2">{body}</span>
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </aside>
        ) : null}
      </section>

      {(moreIdeas.length || profileContextItems.length) ? (
        <details
          data-testid="symptom-check-more-ideas"
          className="group rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="font-body text-[17px] font-black text-vyva-text-1">
              {t("health.symptomCheck.intro.moreIdeas", "More ideas")}
            </span>
            <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-3 border-t border-[#EADFD5] pt-4">
            {profileContextItems.length ? (
              <div data-testid="symptom-check-profile-context" className="rounded-[20px] border border-[#EDE5DB] bg-[#FFFCF8] px-4 py-3">
                <p className="font-body text-[12px] font-black uppercase tracking-[0.14em] text-vyva-purple">
                  {hasProfileSuggestions
                    ? t("health.symptomCheck.intro.personalizedBadge", "Profile tuned")
                    : t("health.symptomCheck.intro.fallbackBadge", "Helpful starts")}
                </p>
                <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                  {profileContextItems.slice(0, 4).join(" - ")}
                </p>
              </div>
            ) : null}
            {moreIdeas.map(renderSuggestion)}
          </div>
        </details>
      ) : null}
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
  return uniqueReportLines(lines);
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

function refinementKeyForMissingSignal(label: string): RefinementVitalKey | null {
  const normalized = label.toLowerCase();
  if (/\b(blood pressure|bp|hypertension|pressure)\b/.test(normalized)) return "bloodPressure";
  if (/\b(pulse|heart rate|heartbeat|afib|irregular)\b/.test(normalized)) return "pulse";
  if (/\b(oxygen|spo2|short of breath|breathing|breathless)\b/.test(normalized)) return "oxygen";
  if (/\b(respiratory rate|breathing rate|breaths per minute|fast breathing)\b/.test(normalized)) return "respiratoryRate";
  if (/\b(fever|temperature|chills)\b/.test(normalized)) return "temperature";
  if (/\b(glucose|sugar|diabetes|diabetic|insulin|cgm)\b/.test(normalized)) return "glucose";
  if (/\b(pain|ache|headache|injury)\b/.test(normalized)) return "pain";
  if (/\b(energy|fatigue|tired|weak|exhausted|dizzy)\b/.test(normalized)) return "energy";
  return null;
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

export function ReportScreen({
  summary,
  bpm,
  respiratoryRate,
  durationSeconds,
  reportId,
  reportSaveState,
  savedReport,
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
  reportSaveState: ReportSaveState;
  savedReport: SavedTriageReport | null;
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
  const reportMissingSignals = uniqueLines([
    ...(summary.contextConfidence?.missing ?? []),
    ...(summary.contextSignals ?? [])
      .filter((signal) => signal.status === "missing")
      .map((signal) => signal.label),
  ]).slice(0, 3);
  const actionText = [reportText(summary), ...reportMissingSignals].join(" ").toLowerCase();
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
  const missingSignalActions = Array.from(
    reportMissingSignals
      .reduce((actions, label) => {
        const key = refinementKeyForMissingSignal(label);
        const action = key ? vitalActions.find((candidate) => candidate.key === key) : undefined;
        if (action && !actions.has(action.key)) {
          actions.set(action.key, { label, action });
        }
        return actions;
      }, new Map<RefinementVitalKey, { label: string; action: RefinementVitalConfig }>())
      .values(),
  );
  const passiveMissingSignals = reportMissingSignals.filter((label) => !refinementKeyForMissingSignal(label));
  const openMissingSignalAction = (action: RefinementVitalConfig) => {
    setOpenVitalKey(action.key);
    setVitalInputError(null);
    window.setTimeout(() => {
      document
        .querySelector<HTMLElement>(`[data-testid="card-report-vital-action-${action.key}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };
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
  const reportRecommendations = compactReportRecommendations(summary.recommendations, { max: 4, level: cfg.level });
  const doctorNote = [
    summary.chiefComplaint,
    summary.symptoms.length ? `${t("health.symptomCheck.report.symptoms", "Symptoms noted")}: ${summary.symptoms.join(", ")}` : "",
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    `${urgencyQualifierText}: ${urgencyStatusText}`,
    nextStepDisplayText ? `${t("health.symptomCheck.report.nextStep", "Next step")}: ${nextStepDisplayText}` : "",
    summary.triageReasons?.length ? `${t("health.symptomCheck.report.whyThisStep", "Initial Assessment")}: ${summary.triageReasons.join(" ")}` : "",
    summary.evidenceSummary ? `${t("health.symptomCheck.report.evidenceChecked", "Science-based source check")}: ${summary.evidenceSummary}` : "",
    reportRecommendations.length ? `${t("health.symptomCheck.report.recommendations", "What to do next")}: ${reportRecommendations.join(" ")}` : "",
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
      ? "Please help me book a safe ride for this health recommendation: {{recommendation}}. Report: {{report}}. Ask me to confirm before booking."
      : kind === "appointment"
        ? "Please help me schedule care for this health recommendation: {{recommendation}}. Report: {{report}}. Ask me to confirm before booking."
        : "Please help me request a quote for someone to stay with me or support me at home: {{recommendation}}. Report: {{report}}. Ask me to confirm before requesting anything.";
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

  const openSupportPackage = (packageId: ShoppingSupportPackageId, recommendation: string) => {
    navigate("/concierge/shopping", {
      state: {
        shoppingPrefill: {
          packageId,
          sourceRecommendation: recommendation,
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
    call_emergency: emergencyContact?.telHref
      ? t("health.symptomCheck.report.callEmergencyNumber", "Call {{number}}", { number: emergencyContact.label })
      : t("health.symptomCheck.report.contactEmergencyServices", "Contact emergency services"),
    call_gp: t("health.symptomCheck.report.actions.callGp", "Call GP"),
    email_gp: t("health.symptomCheck.report.actions.emailGp", "Email GP"),
    doctor_help: t("health.symptomCheck.report.actions.doctorHelp", "Doctor help"),
    book_ride: t("health.symptomCheck.report.actions.bookRide", "Find transport"),
    schedule_appointment: t("health.symptomCheck.report.actions.scheduleAppointment", "Appointment"),
    online_order: t("health.symptomCheck.report.actions.onlineOrder", "Get support package"),
    request_quote: t("health.symptomCheck.report.actions.requestQuote", "Request quote"),
  };

  const reportActionIcons: Record<SymptomRecommendationActionKind, LucideIcon> = {
    call_emergency: PhoneCall,
    call_gp: PhoneCall,
    email_gp: Mail,
    doctor_help: Stethoscope,
    book_ride: Car,
    schedule_appointment: Calendar,
    online_order: ShoppingBasket,
    request_quote: ClipboardList,
  };

  const actionsForRecommendation = (recommendation: string): ReportAction[] => {
    const actions = getSymptomRecommendationActionKinds(recommendation, {
      hasEmergencyContact: Boolean(emergencyContact?.telHref),
      hasGpPhone: Boolean(gpPhone),
      hasGpEmail: Boolean(gpEmail),
    }).map((kind): ReportAction => {
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

      if (kind === "call_emergency") return { ...base, href: emergencyContact?.telHref };
      if (kind === "call_gp") return { ...base, href: telHref };
      if (kind === "email_gp") return { ...base, href: mailtoHref };
      if (kind === "doctor_help") return { ...base, onClick: openDoctorWithContext };
      if (kind === "book_ride") return { ...base, onClick: () => openConciergePrefill("ride", recommendation) };
      if (kind === "schedule_appointment") return { ...base, onClick: () => openConciergePrefill("appointment", recommendation) };
      if (kind === "online_order") return { ...base, onClick: () => openSupportPackage("hydration_support", recommendation) };
      return { ...base, onClick: () => openConciergePrefill("home_care_quote", recommendation) };
    }).filter((action) => action.href || action.onClick);

    const hasDoctorAction = actions.some((action) => action.kind === "doctor_help" || action.kind === "call_gp" || action.kind === "email_gp");
    if (hasDoctorAction && !gpPhone && !gpEmail) {
      actions.push({
        kind: "add_doctor_contact",
        label: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        ariaLabel: t("health.symptomCheck.report.addDoctorContact", "Add doctor contact"),
        Icon: Users,
        onClick: openDoctorContactSetup,
      });
    }

    return actions;
  };
  const allReasons = uniqueLines([
    ...(summary.triageReasons ?? []),
    ...(summary.profileConsiderations ?? []),
    ...(summary.vitalsNotes ?? []),
    ...(summary.scanNotes ?? []),
  ]);
  const visibleRecommendations = reportRecommendations.slice(0, 4);
  const primaryRecommendations = visibleRecommendations.slice(0, 2);
  const remainingRecommendations = visibleRecommendations.slice(2);
  const visibleWatchSigns = uniqueLines(summary.watchSigns ?? []).slice(0, 2);
  const contextNotes = uniqueLines([...(summary.profileConsiderations ?? []), ...(summary.vitalsNotes ?? []), ...(summary.scanNotes ?? [])]);
  const reportContextConfidence = summary.contextConfidence;
  const reportConfidenceScore = typeof reportContextConfidence?.score === "number"
    ? Math.min(5, Math.max(1, reportContextConfidence.score))
    : Math.min(5, Math.max(2, 2 + (contextNotes.length ? 1 : 0) + (bpm != null || respiratoryRate != null ? 1 : 0)));
  const reportConfidenceLabel = reportContextConfidence?.label ?? (
    reportConfidenceScore >= 5
      ? t("health.symptomCheck.report.contextConfidenceHigh", "High confidence")
      : reportConfidenceScore >= 4
        ? t("health.symptomCheck.report.contextConfidenceStrong", "Strong confidence")
        : reportConfidenceScore >= 3
          ? t("health.symptomCheck.report.contextConfidenceBuilding", "Building confidence")
          : t("health.symptomCheck.report.contextConfidenceEarly", "Early confidence")
  );
  const reportConfidenceReasons = uniqueLines([
    ...(reportContextConfidence?.reasons ?? []),
    ...(summary.contextBrief ? [summary.contextBrief] : []),
    ...(contextNotes.length ? [t("health.symptomCheck.report.contextProfileUsed", "profile and recent context considered")] : []),
  ]).slice(0, 3);
  const vitalsSummaryItems = uniqueLines([
    bpm != null ? `${t("health.symptomCheck.scan.heartRate", "Heart Rate")}: ${bpm} bpm` : "",
    respiratoryRate != null ? `${t("health.symptomCheck.scan.respiratoryRate", "Breathing rate")}: ${respiratoryRate} breaths/min` : "",
    ...(summary.vitalsNotes ?? []),
  ]).slice(0, 4);
  const evidenceSourceNames = summary.evidenceSources?.map((source) => source.title).filter(Boolean) ?? [];
  const openReport = () => navigate(reportId ? `/informes/${reportId}` : "/informes");
  const primaryActionKind: SymptomRecommendationActionKind | null = isEmergency
    ? "call_emergency"
    : cfg.level === "monitor"
      ? null
      : telHref
        ? "call_gp"
        : mailtoHref
          ? "email_gp"
          : "doctor_help";
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
          label: telHref
            ? t("health.symptomCheck.report.actions.callGp", "Call GP")
            : mailtoHref
              ? t("health.symptomCheck.report.actions.emailGp", "Email GP")
              : t("health.symptomCheck.report.callDoctor", "Talk to doctor"),
          Icon: telHref ? PhoneCall : mailtoHref ? Mail : Stethoscope,
          onClick: () => {
            if (telHref) {
              window.location.href = telHref;
              return;
            }
            if (mailtoHref) {
              window.location.href = mailtoHref;
              return;
            }
            openDoctorWithContext();
          },
          className: "bg-[#6B21A8] text-white shadow-[0_12px_26px_rgba(107,33,168,0.20)]",
          testId: telHref ? "button-report-call-gp" : mailtoHref ? "button-report-email-gp" : "button-report-doctor",
        };
  const savedRecipientLabels = uniqueLines(savedReport?.sent_to ?? []);
  const staffReviewRequested = Boolean(savedReport?.staff_review_requested);
  const reportStatusText = reportSaveState === "saving"
    ? t("health.symptomCheck.report.savingReport", "Saving this report to My Reports...")
    : reportSaveState === "error"
      ? t("health.symptomCheck.report.reportSaveFailed", "This report could not be saved automatically. You can still share it now.")
      : reportId
        ? t("health.symptomCheck.report.reportSaved", "Saved in My Reports")
        : t("health.symptomCheck.report.reportNotSavedYet", "Not saved yet");
  const handoffTitle = staffReviewRequested
    ? t("health.symptomCheck.report.staffReviewTitle", "Staff review requested")
    : savedRecipientLabels.length
      ? t("health.symptomCheck.report.handoffSentTitle", "Care handoff started")
      : t("health.symptomCheck.report.handoffReadyTitle", "Ready to share");
  const handoffBody = staffReviewRequested
    ? savedRecipientLabels.length
      ? t("health.symptomCheck.report.staffReviewWithContacts", "The team has this report for review. It was also shared with {{contacts}}.", {
          contacts: savedRecipientLabels.join(", "),
        })
      : t("health.symptomCheck.report.staffReviewNoContacts", "The team has this report for review. Add a doctor or caregiver contact to share future reports automatically.")
    : savedRecipientLabels.length
      ? t("health.symptomCheck.report.handoffSentBody", "This report was shared with {{contacts}} so they can help with the next step.", {
          contacts: savedRecipientLabels.join(", "),
        })
      : t("health.symptomCheck.report.handoffReadyBody", "No caregiver or doctor was notified automatically. You can share this report with someone you trust.");
  const handoffIsActive = staffReviewRequested || savedRecipientLabels.length > 0 || Boolean(reportId);
  const planSteps = visibleRecommendations.length
    ? visibleRecommendations.slice(0, 3)
    : [recommendationExplanation];
  const supportActions = Array.from(
    visibleRecommendations
      .flatMap((recommendation) => actionsForRecommendation(recommendation))
      .reduce((map, action) => {
        if (action.kind === primaryActionKind) return map;
        if (!map.has(action.kind)) map.set(action.kind, action);
        return map;
      }, new Map<ReportAction["kind"], ReportAction>())
      .values(),
  ).slice(0, 3);
  const simpleReportRows = [
    {
      label: t("health.symptomCheck.report.simpleWhatChanged", "Situation"),
      value: summary.chiefComplaint || summary.symptoms[0] || t("health.symptomCheck.report.notRecorded", "Not recorded"),
    },
    {
      label: t("health.symptomCheck.report.simpleHelpNeeded", "Help needed"),
      value: planSteps[0] ?? nextStepDisplayText,
    },
    {
      label: t("health.symptomCheck.report.simpleEscalateIf", "Escalate if"),
      value: visibleWatchSigns.length
        ? visibleWatchSigns.join(" ")
        : t("health.symptomCheck.report.noWatchSigns", "If symptoms worsen or feel urgent, seek medical help."),
    },
  ];

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
    ...reportRecommendations.map((r, i) => `${i + 1}. ${r}`),
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
  const renderRecommendationItem = (recommendation: string, index: number) => {
    const actions = actionsForRecommendation(recommendation);
    return (
      <li key={`${recommendation}-${index}`} className="rounded-[20px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
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
              const className = "vyva-tap inline-flex min-h-[50px] min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-white px-4 py-3 text-center font-body text-[15px] font-black leading-tight text-vyva-purple shadow-sm";
              if (action.href) {
                return (
                  <a
                    key={action.kind}
                    href={action.href}
                    aria-label={action.ariaLabel}
                    data-testid={`button-report-action-${index}-${action.kind}`}
                    className={className}
                  >
                    <Icon size={19} className="flex-shrink-0" />
                    <span className="min-w-0 break-words">{action.label}</span>
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
                  <Icon size={19} className="flex-shrink-0" />
                  <span className="min-w-0 break-words">{action.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </li>
    );
  };
  const PrimaryActionIcon = primaryAction.Icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" data-testid="symptom-check-report">
      <div ref={reportTopRef} />
      <section
        data-testid="card-report-answer"
        className={`mx-4 mb-4 mt-4 rounded-[28px] p-4 text-white shadow-[0_16px_36px_rgba(91,18,160,0.18)] sm:mx-5 sm:p-5 lg:mx-auto lg:w-full lg:max-w-[760px] ${isEmergency ? "motion-safe:animate-pulse" : ""}`}
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
            <p className="mt-1 font-display text-[25px] italic leading-tight text-white sm:text-[28px]">
              {urgencyStatusText}
            </p>
          </div>
        </div>

        <p className="mt-5 font-body text-[20px] font-black leading-tight text-white sm:text-[23px]">
          {summary.chiefComplaint || t("health.symptomCheck.report.checkComplete", "Your check is complete")}
        </p>
        <p className="mt-2 font-body text-[14px] font-bold leading-relaxed text-white/84">
          {t("health.symptomCheck.report.resultSummary", "VYVA has turned your answers into a simple plan below.")}
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

      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 px-4 pb-[172px] sm:px-5 sm:pb-[190px] lg:px-0">
        <section className="overflow-hidden rounded-[28px] border border-[#E8DED4] bg-white shadow-[0_14px_34px_rgba(63,45,35,0.08)]" data-testid="card-report-do-now">
          <div className="border-b border-[#EFE5DA] bg-[#FFFCF8] p-4">
            <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
              {t("health.symptomCheck.report.whatToDoNow", "What to do now")}
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-body text-[24px] font-black leading-tight text-vyva-text-1">
                  {nextStepDisplayText}
                </p>
                <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-vyva-text-2">
                  {recommendationExplanation}
                </p>
              </div>
              <button
                type="button"
                onClick={primaryAction.onClick}
                disabled={isEmergency && !emergencyContact?.telHref}
                data-testid={primaryAction.testId}
                className={`vyva-tap inline-flex min-h-[54px] flex-shrink-0 items-center justify-center gap-2 rounded-[18px] px-4 text-center font-body text-[16px] font-black leading-tight ${primaryAction.className}`}
              >
                <PrimaryActionIcon size={19} className="flex-shrink-0" />
                <span>{primaryAction.label}</span>
              </button>
            </div>
          </div>
          <div className="grid gap-4 p-4">
            <ol className="grid gap-3">
              {planSteps.map((recommendation, index) => (
                <li key={`${recommendation}-${index}`} className="flex items-start gap-3 rounded-[20px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-vyva-purple font-body text-[13px] font-black text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5 font-body text-[16px] font-bold leading-snug text-vyva-text-1">
                    {recommendation}
                  </span>
                </li>
              ))}
            </ol>
            {supportActions.length ? (
              <div className="rounded-[22px] border border-[#E7DCF8] bg-[#F8F5FF] p-3" data-testid="report-support-actions">
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                  {t("health.symptomCheck.report.supportOptions", "Useful support")}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {supportActions.map((action) => {
                    const Icon = action.Icon;
                    const className = "vyva-tap inline-flex min-h-[48px] min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-white px-3 py-3 text-center font-body text-[14px] font-black leading-tight text-vyva-purple shadow-sm";
                    if (action.href) {
                      return (
                        <a key={action.kind} href={action.href} aria-label={action.ariaLabel} data-testid={`button-report-support-${action.kind}`} className={className}>
                          <Icon size={18} className="flex-shrink-0" />
                          <span className="min-w-0 break-words">{action.label}</span>
                        </a>
                      );
                    }
                    return (
                      <button key={action.kind} type="button" onClick={action.onClick} aria-label={action.ariaLabel} data-testid={`button-report-support-${action.kind}`} className={className}>
                        <Icon size={18} className="flex-shrink-0" />
                        <span className="min-w-0 break-words">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-blue-950 shadow-[0_10px_26px_rgba(29,78,216,0.07)]" data-testid="card-report-context-confidence">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              role="meter"
              aria-label={t("health.symptomCheck.report.contextConfidence", "Context confidence")}
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={reportConfidenceScore}
              className="relative mx-auto grid h-[92px] w-[92px] flex-shrink-0 place-items-center rounded-full p-2 shadow-[0_14px_28px_rgba(29,78,216,0.14)] sm:mx-0"
              style={{ background: `conic-gradient(#2563EB 0 ${reportConfidenceScore * 20}%, #DBEAFE ${reportConfidenceScore * 20}% 100%)` }}
            >
              <span className="grid h-full w-full place-items-center rounded-full bg-white text-center">
                <span className="font-body text-[23px] font-black leading-none text-[#1D4ED8]">
                  {reportConfidenceScore}/5
                </span>
                <span className="font-body text-[9px] font-black uppercase tracking-[0.08em] text-vyva-text-3">
                  {t("health.symptomCheck.report.contextSignalShort", "Signals")}
                </span>
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1D4ED8]">
                {t("health.symptomCheck.report.contextConfidence", "Context confidence")}
              </p>
              <p className="mt-1 font-body text-[21px] font-black leading-tight text-vyva-text-1">
                {reportConfidenceLabel}
              </p>
              <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-blue-900">
                {reportConfidenceReasons.length
                  ? t("health.symptomCheck.report.contextConfidenceReason", "This check used {{items}}.", { items: reportConfidenceReasons.join(", ") })
                  : t("health.symptomCheck.report.contextConfidenceGeneric", "This check used the answers from this session and any available profile context.")}
              </p>
              {reportMissingSignals.length ? (
                <div className="mt-3 rounded-[18px] border border-[#BFDBFE] bg-white px-3 py-3">
                  <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                    {t("health.symptomCheck.report.missingSignals", "Add what is missing")}
                  </p>
                  <p className="mt-1 font-body text-[14px] font-bold leading-snug text-vyva-text-2">
                    {reportMissingSignals.join(", ")}
                  </p>
                  {missingSignalActions.length ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="report-missing-signal-actions">
                      {missingSignalActions.map(({ action }) => (
                        <button
                          key={action.key}
                          type="button"
                          onClick={() => openMissingSignalAction(action)}
                          data-testid={`button-report-missing-signal-${action.key}`}
                          className="vyva-tap flex min-h-[54px] items-center justify-between gap-3 rounded-[18px] bg-[#1D4ED8] px-3 text-left font-body text-[14px] font-black leading-tight text-white shadow-[0_10px_20px_rgba(29,78,216,0.18)]"
                        >
                          <span className="min-w-0">{action.title}</span>
                          <ArrowRight className="h-4 w-4 flex-shrink-0" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {passiveMissingSignals.length ? (
                    <p className="mt-2 font-body text-[13px] font-bold leading-snug text-vyva-text-3">
                      {t("health.symptomCheck.report.passiveMissingSignals", "Also useful for care review: {{items}}", {
                        items: passiveMissingSignals.join(", "),
                      })}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#D9F0E3] bg-[#F0FDF4] p-4 text-[#064E3B] shadow-[0_10px_26px_rgba(4,120,87,0.08)]" data-testid="card-report-handoff">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[16px] bg-white text-[#047857] shadow-sm">
              {staffReviewRequested ? <ShieldCheck size={20} /> : savedRecipientLabels.length ? <Send size={20} /> : <Users size={20} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#047857]">
                {t("health.symptomCheck.report.handoffLabel", "Care handoff")}
              </p>
              <p className="mt-1 font-body text-[18px] font-black leading-tight text-[#052E25]">
                {handoffTitle}
              </p>
              <p className="mt-2 font-body text-[15px] font-bold leading-relaxed text-[#065F46]">
                {handoffBody}
              </p>
              <p className="mt-3 inline-flex rounded-full border border-[#BBF7D0] bg-white px-3 py-1.5 font-body text-[13px] font-black text-[#047857]">
                {reportStatusText}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-simple-summary">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                {t("health.symptomCheck.report.simpleReport", "Simple report")}
              </p>
              <p className="mt-1 font-body text-[18px] font-black leading-tight text-vyva-text-1">
                {t("health.symptomCheck.report.simpleReportTitle", "For someone helping you")}
              </p>
            </div>
            <button
              type="button"
              onClick={handleShare}
              data-testid="button-report-share-simple"
              className="vyva-tap inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#E7DCF8] bg-[#F5F3FF] px-4 text-center font-body text-[15px] font-black text-vyva-purple"
            >
              <Share2 size={17} />
              {t("health.symptomCheck.report.shareReportAria", "Share report")}
            </button>
          </div>
          <dl className="mt-4 grid gap-3">
            {simpleReportRows.map((row) => (
              <div key={row.label} className="rounded-[18px] border border-[#F1E8DE] bg-[#FFFCF8] p-3">
                <dt className="font-body text-[11px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {row.label}
                </dt>
                <dd className="mt-1 font-body text-[16px] font-black leading-snug text-vyva-text-1">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {isEmergency && visibleWatchSigns.length ? (
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
                  <span className="font-body text-[15px] font-black leading-snug text-[#9A3412] sm:text-[17px]">
                    {sign}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!isEmergency && visibleWatchSigns.length ? (
          <details className="group rounded-[22px] border border-[#FED7AA] bg-[#FFF7ED] p-4 text-[#9A3412] shadow-[0_8px_22px_rgba(154,52,18,0.08)]" data-testid="card-report-watch">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#FFEDD5] text-[#C2410C]">
                  <AlertTriangle size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-[#9A3412]">
                  {t("health.symptomCheck.report.whatToWatchFor", "What to watch for")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-[#C2410C] transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-3 grid gap-2 border-t border-[#FED7AA] pt-3">
              {visibleWatchSigns.map((sign, index) => (
                <li key={index} className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-black leading-snug text-[#9A3412] shadow-sm">
                  {sign}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {allReasons.length ? (
          <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="card-report-why">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                  <Stethoscope size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-vyva-text-1">
                  {t("health.symptomCheck.report.whyThisAnswer", "Why this answer")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
            </summary>
            <ul className="mt-3 grid gap-2 border-t border-[#EADFD5] pt-3">
              {allReasons.map((reason, index) => (
                <li key={index} className="rounded-[16px] bg-[#FAF7F3] px-4 py-3 font-body text-[15px] font-bold leading-snug text-vyva-text-1">
                  {reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        {(vitalsSummaryItems.length || summary.evidenceSummary || evidenceSourceNames.length) ? (
          <details className="group rounded-[22px] border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-blue-900 shadow-[0_8px_22px_rgba(29,78,216,0.07)]" data-testid="card-report-vitals-context">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-blue-700 shadow-sm">
                  <Activity size={18} />
                </span>
                <span className="font-body text-[15px] font-black text-blue-900">
                  {t("health.symptomCheck.report.readingsUsed", "Readings used")}
                </span>
              </span>
              <ChevronLeft size={18} className="-rotate-90 flex-shrink-0 text-blue-700 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-3 grid gap-3 border-t border-[#BFDBFE] pt-3">
              {vitalsSummaryItems.length ? (
                <ul className="grid gap-2">
                  {vitalsSummaryItems.map((item, index) => (
                    <li key={index} className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-black leading-snug text-vyva-text-1 shadow-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {summary.evidenceSummary ? (
                <p className="rounded-[16px] bg-white px-4 py-3 font-body text-[15px] font-bold leading-snug text-vyva-text-1 shadow-sm">
                  {summary.evidenceSummary}
                </p>
              ) : null}
              {evidenceSourceNames.length ? (
                <p className="font-body text-[13px] font-extrabold leading-snug text-blue-700">
                  {evidenceSourceNames.slice(0, 2).join(" - ")}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {vitalActions.length ? (
          <section className="grid grid-cols-1 gap-3" data-testid="card-report-vital-refinement-note">
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
              <div key={action.key} className="min-w-0 overflow-hidden rounded-[24px] border-2 border-[#DDD6FE] bg-[#FAF5FF] p-4 shadow-[0_10px_26px_rgba(107,33,168,0.08)]" data-testid={`card-report-vital-action-${action.key}`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[18px] bg-white text-vyva-purple shadow-sm">
                    <Activity size={23} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-purple">
                      {t("health.symptomCheck.report.vitalRefinementTitle", "Refine with a reading")}
                    </p>
                    <p className="mt-1 break-words font-body text-[19px] font-black leading-tight text-vyva-text-1 sm:text-[21px]">
                      {action.title}
                    </p>
                    <p className="mt-1 break-words font-body text-[14px] font-bold leading-snug text-vyva-text-2 sm:text-[15px]">
                      {action.helper}
                    </p>
                  </div>
                </div>
                <div className={`mt-4 grid min-w-0 gap-2 ${latestCandidate ? "sm:grid-cols-2" : ""}`}>
                  {latestCandidate ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenVitalKey(action.key);
                        setVitalInputs((current) => ({
                          ...current,
                          [action.key]: latestCandidate.value,
                        }));
                        setVitalInputError(null);
                      }}
                      disabled={busy}
                      data-testid={`button-report-vital-latest-${action.key}`}
                      className="vyva-tap flex min-h-[62px] w-full min-w-0 items-center justify-between rounded-[20px] bg-[#6B21A8] px-4 text-left text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid min-w-0 gap-1">
                        <span className="min-w-0 font-body text-[16px] font-black leading-tight">
                          {t("health.symptomCheck.report.useLatestReading", "Use latest saved reading")}
                        </span>
                        <span className="min-w-0 font-body text-[13px] font-bold leading-snug text-white/82">
                          {t("health.symptomCheck.report.latestReadingDetail", "{{display}} from {{source}}", {
                            display: latestCandidate.display,
                            source: latestSource,
                          })}
                        </span>
                      </span>
                      <ChevronLeft size={20} className="ml-3 flex-shrink-0 rotate-180" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenVitalKey(action.key);
                      setVitalInputError(null);
                    }}
                    disabled={busy}
                    data-testid={`button-report-vital-add-${action.key}`}
                    className={`vyva-tap flex min-h-[62px] w-full min-w-0 items-center justify-between rounded-[20px] px-4 text-left font-body font-black shadow-sm disabled:opacity-60 ${
                      latestCandidate
                        ? "border border-[#DDD6FE] bg-white text-vyva-purple"
                        : "bg-[#6B21A8] text-white shadow-[0_10px_22px_rgba(107,33,168,0.16)]"
                    }`}
                  >
                    <span className="min-w-0 text-[17px] leading-tight">
                      {t("health.symptomCheck.report.addReading", "Add reading")}
                    </span>
                    <ChevronLeft size={20} className={`ml-3 flex-shrink-0 rotate-180 ${latestCandidate ? "text-vyva-purple" : "text-white"}`} />
                  </button>
                  {!latestCandidate ? (
                    <p className="px-1 font-body text-[13px] font-bold leading-snug text-vyva-text-2 sm:col-span-2">
                      {t("health.symptomCheck.report.noLatestReadingDetail", "Enter this reading manually to refine the assessment.")}
                    </p>
                  ) : null}
                  {open ? (
                    <div className="grid min-w-0 gap-3 overflow-hidden border-t border-[#DDD6FE] pt-3 sm:col-span-2">
                      <label className="flex min-h-[86px] w-full min-w-0 max-w-full items-end gap-2 overflow-hidden rounded-[24px] border-2 border-[#DDD6FE] bg-white px-4 py-2 sm:items-baseline sm:gap-3 sm:py-0">
                        <input
                          type="text"
                          inputMode={action.key === "bloodPressure" ? "text" : "decimal"}
                          value={value}
                          onChange={(event) => setVitalInputs((current) => ({ ...current, [action.key]: event.target.value }))}
                          placeholder={action.placeholder}
                          className="w-full min-w-0 flex-1 bg-transparent font-body text-[34px] font-black leading-none text-vyva-text-1 outline-none placeholder:text-[#D6C7BA] sm:text-[48px]"
                        />
                        <span className="flex-shrink-0 pb-1 font-body text-[15px] font-black text-vyva-text-2 sm:pb-0 sm:text-[20px]">{action.unit}</span>
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
                        className="vyva-tap flex min-h-[74px] w-full min-w-0 max-w-full items-center justify-center gap-3 overflow-hidden rounded-[22px] bg-[#0A7C4E] px-4 text-center font-body text-[16px] font-black leading-tight text-white disabled:opacity-60 sm:text-[20px]"
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
            <div className={`rounded-[22px] border p-4 font-body text-[17px] font-black leading-snug ${
              refinementStatus.state === "error"
                ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]"
                : "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]"
            }`}>
              {refinementStatus.message}
            </div>
          ) : null}
          </section>
        ) : null}

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

        <details className="group rounded-[22px] border border-[#E8DED4] bg-white p-4 shadow-[0_8px_22px_rgba(63,45,35,0.05)]" data-testid="report-share-save">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#F5F3FF] text-vyva-purple">
                <Share2 size={18} />
              </span>
              <span className="font-body text-[15px] font-black text-vyva-text-1">
                {t("health.symptomCheck.report.shareOrSave", "Share or save")}
              </span>
            </span>
            <ChevronLeft size={20} className="-rotate-90 flex-shrink-0 text-vyva-purple transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-4 grid gap-2 border-t border-[#EADFD5] pt-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleShare}
              data-testid="button-report-share"
              className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-[#E8DED4] bg-[#FAF9F6] px-4 text-center font-body text-[15px] font-black text-vyva-purple"
            >
              <Share2 size={18} />
              {t("health.symptomCheck.report.shareReportAria", "Share report")}
            </button>
            <button
              type="button"
              onClick={openReport}
              data-testid="button-report-view-reports"
              className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 text-center font-body text-[15px] font-black text-[#1D4ED8]"
            >
              <FileText size={18} />
              {t("health.symptomCheck.report.openReportAria", "Open report")}
            </button>
          </div>
        </details>

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
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] bg-[#EFF6FF] text-[#1D4ED8]">
                <FileText size={18} />
              </span>
              <span className="min-w-0 font-body text-[15px] font-extrabold text-vyva-text-1">
                {t("health.symptomCheck.report.fullReport", "Full report")}
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

            {reportRecommendations.length > 0 ? (
              <div>
                <p className="font-body text-[12px] font-extrabold uppercase tracking-[0.1em] text-vyva-text-3">
                  {t("health.symptomCheck.report.recommendations")}
                </p>
                <ol className="mt-3 grid gap-3">
                  {reportRecommendations.map((recommendation, index) => (
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

            <div className={`flex items-start gap-3 border-t border-[#EADFD5] pt-4 ${handoffIsActive ? "text-[#047857]" : "text-vyva-text-2"}`}>
              <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${handoffIsActive ? "bg-[#DCFCE7]" : "bg-[#F5F3FF]"}`}>
                {handoffIsActive ? <CheckCircle size={18} /> : <ClipboardList size={18} />}
              </span>
              <div>
                <p className="font-body text-[15px] font-extrabold leading-snug">
                  {handoffBody}
                </p>
                <p className="mt-1 font-body text-[13px] font-bold text-vyva-text-3">
                  {reportStatusText}
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

      <div className="pointer-events-none fixed bottom-[calc(84px+env(safe-area-inset-bottom))] left-1/2 z-[70] w-full max-w-[760px] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(250,248,245,0)_0%,#FAF8F5_26%,#FAF8F5_100%)] px-4 pb-3 pt-5 sm:hidden">
        <div className="pointer-events-auto rounded-[24px] border border-[#E8DED4]/80 bg-white/95 p-2 shadow-[0_18px_44px_rgba(63,45,35,0.14)] backdrop-blur">
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={isEmergency && !emergencyContact?.telHref}
            data-testid={`${primaryAction.testId}-sticky`}
            className={`vyva-tap flex min-h-[58px] w-full min-w-0 items-center justify-center gap-2 rounded-[18px] px-4 text-center font-body text-[17px] font-black leading-tight sm:min-h-[62px] sm:text-[19px] ${primaryAction.className}`}
          >
            <PrimaryActionIcon size={20} className="flex-shrink-0" />
            <span className="min-w-0 break-words">{primaryAction.label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SymptomCheckScreen() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { isLoading: profileLoading } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingState = location.state as SymptomCheckLocationState;
  const incomingInitialClue = typeof incomingState?.initialClue === "string" ? incomingState.initialClue.trim() : "";
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
  const [step, setStep] = useState<Step>(() => restoredDraft?.step ?? (incomingInitialClue ? "chat" : "intro"));
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
  const [chatStartTime, setChatStartTime] = useState<number | null>(() => restoredDraft?.chatStartTime ?? (incomingInitialClue ? Date.now() : null));
  const [initialClue, setInitialClue] = useState(() => restoredDraft?.initialClue ?? incomingInitialClue);
  const [autoStartVoice, setAutoStartVoice] = useState(() => Boolean(!restoredDraft && incomingState?.autoStartVoice));
  const [summary, setSummary] = useState<TriageSummary | null>(() => restoredDraft?.summary ?? null);
  const [reportSaveState, setReportSaveState] = useState<ReportSaveState>(() => restoredDraft?.reportSaveState ?? "idle");
  const [reportId, setReportId] = useState<string | null>(() => restoredDraft?.reportId ?? null);
  const [savedReport, setSavedReport] = useState<SavedTriageReport | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(() => restoredDraft?.durationSeconds ?? null);
  const [refinementStatus, setRefinementStatus] = useState<RefinementStatus>(() => restoredDraft?.refinementStatus ?? { state: "idle" });
  const [chatDraft, setChatDraft] = useState<TriageChatDraft | null>(() => restoredDraft?.chatDraft ?? null);
  const [resumePendingRequest] = useState(() => Boolean(restoredDraft?.chatDraft?.pendingRequest));
  const [showFirstVisitGuide, setShowFirstVisitGuide] = useState(() => !readSymptomCheckVisited());
  const [voiceTriageSessionId, setVoiceTriageSessionId] = useState<string | null>(() => readCurrentVoiceSessionId());
  const { data: voiceTriageSession } = useQuery<VoiceTriageSessionResponse | null>({
    queryKey: ["/api/voice-triage/session", voiceTriageSessionId],
    enabled: Boolean(voiceTriageSessionId),
    queryFn: async () => {
      if (!voiceTriageSessionId) return null;
      const res = await apiFetch(`/api/voice-triage/session/${encodeURIComponent(voiceTriageSessionId)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<VoiceTriageSessionResponse>;
    },
    retry: false,
    refetchInterval: voiceTriageSessionId ? 2500 : false,
  });
  const voiceTriageAnswerMutation = useMutation({
    mutationFn: async (answer: VoiceTriageAnswerInput) => {
      if (!voiceTriageSessionId) throw new Error("No active voice check");
      const res = await apiFetch(`/api/voice-triage/session/${encodeURIComponent(voiceTriageSessionId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: language,
          utterance: answer.utterance,
          choice_id: answer.choiceId ?? undefined,
          vitals_text: answer.vitalsText ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json() as Promise<VoiceTriageLatestResponse>;
    },
    onSuccess: (latest) => {
      if (!voiceTriageSessionId) return;
      queryClient.setQueryData<VoiceTriageSessionResponse | null>(
        ["/api/voice-triage/session", voiceTriageSessionId],
        (current) => current
          ? {
              ...current,
              status: (latest.status as VoiceTriageSessionResponse["status"]) || current.status,
              latest_response: latest,
              triage_report_id: latest.report?.triage_report_id ?? current.triage_report_id,
              updated_at: new Date().toISOString(),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["/api/voice-triage/session", voiceTriageSessionId] });
      if (latest.status === "complete") {
        void queryClient.invalidateQueries({ queryKey: ["/api/reports/triage"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/symptoms"] });
      }
    },
    onError: () => {
      toast({
        title: t("health.symptomCheck.voicePanel.answerFailedTitle", "Could not continue the voice check"),
        description: t("health.symptomCheck.voicePanel.answerFailedBody", "Please try again, or use emergency services now if this feels urgent."),
        variant: "destructive",
      });
    },
  });
  const handleVoiceTriageAnswer = useCallback((answer: VoiceTriageAnswerInput) => {
    voiceTriageAnswerMutation.mutate(answer);
  }, [voiceTriageAnswerMutation]);

  const stepTitle: Record<Step, string> = {
    intro: t("health.symptomCheck.title"),
    chat: t("health.symptomCheck.chat.title"),
    report: t("health.symptomCheck.report.yourAnswerTitle", "Your answer"),
  };

  const resetSymptomCheck = useCallback(() => {
    clearSymptomCheckDraft();
    clearCurrentVoiceSessionId();
    setBpm(null);
    setRespiratoryRate(null);
    setChatStartTime(null);
    setInitialClue("");
    setAutoStartVoice(false);
    setSummary(null);
    setReportSaveState("idle");
    setReportId(null);
    setSavedReport(null);
    setDurationSeconds(null);
    setRefinementStatus({ state: "idle" });
    setChatDraft(null);
    setVoiceTriageSessionId(null);
    voiceTriageAnswerMutation.reset();
    setStep("intro");
  }, [voiceTriageAnswerMutation]);

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
    setSavedReport(null);
    setDurationSeconds(null);
    setReportSaveState("idle");
    setRefinementStatus({ state: "idle" });
    setInitialClue(clue);
    setChatStartTime(Date.now());
    setAutoStartVoice(withVoice);
    setStep("chat");
  };

  const handleIntroStart = useCallback((clue: string) => {
    writeSymptomCheckVisited();
    setShowFirstVisitGuide(false);
    startChatDirectly(clue, false);
  }, []);

  const refreshVoiceSessionIdSoon = useCallback(() => {
    window.setTimeout(() => setVoiceTriageSessionId(readCurrentVoiceSessionId()), 250);
    window.setTimeout(() => setVoiceTriageSessionId(readCurrentVoiceSessionId()), 1200);
  }, []);

  const handleTalkToVyva = useCallback(() => {
    writeSymptomCheckVisited();
    setShowFirstVisitGuide(false);
    const contextHint = "The user opened Feel Better and wants a voice-first symptom check. Start by asking what has changed today, then call the VYVA triage tool before giving health guidance.";
    emitVoiceSpecialistTransfer({
      domain: "health",
      reason: "The user tapped Talk to VYVA on Feel Better.",
      evidence: "Feel Better voice-first entry",
      contextHint,
      route: "/health/symptom-check",
      agentSlug: VOICE_SPECIALIST_AGENT_SLUGS.health,
      autoStart: true,
      appEntrypoint: "feel_better_voice",
    });
    refreshVoiceSessionIdSoon();
  }, [refreshVoiceSessionIdSoon]);

  const handleEmergencyUnsure = useCallback(() => {
    const contextHint = "The user is unsure if their situation is an emergency. Start by asking one calm question about their most urgent symptom to help them decide whether to call 112.";
    emitVoiceSpecialistTransfer({
      domain: "health",
      reason: "The user tapped Help me decide on the symptom-check emergency banner.",
      evidence: "Emergency banner uncertainty action",
      contextHint,
      route: "/health/symptom-check",
      agentSlug: VOICE_SPECIALIST_AGENT_SLUGS.health,
      autoStart: true,
      appEntrypoint: "feel_better_emergency_unsure",
    });
    refreshVoiceSessionIdSoon();
  }, [refreshVoiceSessionIdSoon]);

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

  const logSymptomResult = (triageSummary: TriageSummary, saved: SavedTriageReport | null) => {
    if (!saved?.id) return;

    void apiFetch("/api/symptoms/log", {
      method: "POST",
      body: JSON.stringify({
        triage_report_id: saved.id,
        symptom_description: triageSummary.chiefComplaint,
        severity: symptomSeverityForSummary(triageSummary),
        check_completed: true,
        vyva_recommendation: triageSummary.nextStepLabel || triageSummary.recommendations[0] || "",
        escalated_to_caregiver: Boolean(saved.sent_to?.length),
      }),
    })
      .then((response) => {
        if (!response.ok) return;
        void queryClient.invalidateQueries({ queryKey: ["/api/health/prevention"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/reports/summary"] });
      })
      .catch((err) => {
        console.warn("[symptoms/log] refresh skipped:", err);
      });
  };

  const applySavedReport = (saved: SavedTriageReport | null) => {
    setReportId(saved?.id ?? null);
    setSavedReport(saved);
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
    setSavedReport(null);
    setRefinementStatus({ state: "idle" });
    setReportSaveState("saving");
    setStep("report");
    saveTriageReport(triageSummary, durationSeconds)
      .then((saved) => {
        applySavedReport(saved);
        logSymptomResult(triageSummary, saved);
      })
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
        contextConfidence: refinedPayload.guidancePlan?.confidence ?? summary.contextConfidence,
        contextSignals: refinedPayload.guidancePlan?.usefulSignals ?? summary.contextSignals,
        contextBrief: refinedPayload.guidancePlan
          ? `${refinedPayload.guidancePlan.protocolLabel}: ${refinedPayload.guidancePlan.nextQuestionFocus}`
          : summary.contextBrief,
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
      logSymptomResult(refinedSummary, saved);

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

  const isWideWorkspace = step === "intro";
  const shellMaxWidth = isWideWorkspace ? "max-w-[1120px]" : "max-w-[920px]";
  const topBarMaxWidth = isWideWorkspace ? "max-w-[1040px]" : "max-w-[760px]";

  return (
    <HealthWizardShell contentClassName={`flex min-h-[calc(100dvh-204px)] ${shellMaxWidth} flex-col px-0 pb-10 pt-0`}>
      <div className={`mx-auto w-full ${topBarMaxWidth} px-4 pt-3 sm:px-5 lg:px-0`} data-testid="symptom-check-shell">
        {step === "intro" && !voiceTriageSession ? (
          <button
            type="button"
            onClick={handleBack}
            aria-label={t("common.back", "Back")}
            className="vyva-tap flex h-12 w-12 items-center justify-center rounded-full bg-white text-vyva-text-1 shadow-[0_8px_24px_rgba(63,45,35,0.10)]"
          >
            <ChevronLeft size={24} strokeWidth={2.6} />
          </button>
        ) : (
          <HealthWizardTopBar
            title={voiceTriageSession ? t("health.symptomCheck.voicePanel.topBarTitle", "Feel better") : stepTitle[step]}
            kicker={t("health.symptomCheck.intro.stepLabel", "Symptom check")}
            onBack={handleBack}
            backLabel={t("common.back", "Back")}
            action={(
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
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {step === "intro" && !voiceTriageSession && (
          <IntroScreen
            onStart={handleIntroStart}
            onTalkToVyva={handleTalkToVyva}
            onEmergencyUnsure={handleEmergencyUnsure}
            onNavigate={(route) => navigate(route)}
            personalizedSuggestions={triageContext?.personalizedSuggestions}
            activeConditions={triageContext?.activeConditions ?? []}
            profileContextItems={triageContext?.usedItems ?? []}
            emergencyContact={triageContext?.emergencyContact ?? null}
            showGuide={showFirstVisitGuide}
          />
        )}

        {voiceTriageSession ? (
          <VoiceTriageLivePanel
            session={voiceTriageSession}
            onAnswer={handleVoiceTriageAnswer}
            onStartOver={resetSymptomCheck}
            isAnswering={voiceTriageAnswerMutation.isPending}
          />
        ) : null}

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
            reportSaveState={reportSaveState}
            savedReport={savedReport}
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
