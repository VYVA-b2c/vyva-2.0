import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Activity, Brain, Camera, Heart, Users, ConciergeBell, Stethoscope, Calendar, Car, PhoneCall, Mail, Mic, Pill, ShieldCheck, MessageCircle, FileText, HeartHandshake, HeartPulse, ChevronRight, ChevronDown, ChevronUp, PackageCheck, History, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import VyvaSessionCta from "@/components/VyvaSessionCta";
import { ActionCard, ResponsiveGrid } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { serviceForPath, useServiceGate } from "@/hooks/useServiceGate";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { useOptionalVyvaVoice } from "@/hooks/useVyvaVoice";
import { useLanguage } from "@/i18n";
import { displayFirstName } from "@/lib/displayIdentity";
import {
  HOME_FAST_HELP_REASON_FALLBACKS,
  homeFastHelpHistoryStorageKey,
  rankContextualHomeFastHelp,
  readHomeFastHelpHistory,
  recordHomeFastHelpUse,
  writeHomeFastHelpHistory,
  type ContextualHomeFastHelpActionId,
  type HomeFastHelpActivity,
} from "@/lib/contextualHomeFastHelp";
import {
  HOME_FAST_HELP_JOURNEY_EVENT,
  HOME_FAST_HELP_RECOVERY_REFERENCE_ID,
  abandonOpenedHomeFastHelpJourneys,
  homeFastHelpActivityFromJourneys,
  homeFastHelpContextForJourney,
  homeFastHelpJourneyStorageKey,
  latestBlockedHomeFastHelpJourney,
  markHomeFastHelpJourney,
  readHomeFastHelpJourneys,
  reconcileHomeFastHelpJourneys,
  resumeHomeFastHelpJourney,
  selectHomeFastHelpRecoveryNudge,
  startHomeFastHelpJourney,
  withHomeFastHelpContextState,
  type HomeFastHelpJourney,
} from "@/lib/homeFastHelpOutcome";
import { recordHomeFastHelpImpression } from "@/lib/homeFastHelpInsights";
import { selectHomeResumeCandidate } from "@/lib/homeResumeOrchestrator";
import { conciergeTaskPath } from "@/lib/conciergeTaskNavigation";
import {
  readShowVyvaReviewHistory,
  SHOW_VYVA_REVIEW_HISTORY_EVENT,
  type ShowVyvaReviewHistoryItem,
} from "@/lib/showVyvaReviewHistory";
import { CONCIERGE_FLOW_REFERENCES } from "../../shared/conciergeFlowRegistry";
import {
  conciergeCanvasExplainability,
  conciergeCanvasStateLabel,
  deriveConciergeCanvasState,
  type ConciergeCanvasStateSummary,
} from "../../shared/conciergeCanvasState";
import { buildConciergeConfirmationReceipt } from "../../shared/conciergeConfirmationReceipt";
import type { ConciergeExecutionTask } from "../../shared/conciergeActionExecution";
import { HOME_FAST_HELP_RANKING_VERSION } from "../../shared/homeFastHelpSync";
import {
  isShowVyvaPreparedTask,
  showVyvaResumeActionLabel,
  showVyvaResumeSourceLabel,
  showVyvaResumeSummary,
} from "../../shared/showVyvaResume";

type HomeAgentCard = {
  id: "health" | "cognitive" | "social" | "concierge";
  icon: LucideIcon;
  path: string;
  theme: "pink" | "purple" | "blue" | "green";
};

type WeatherData = {
  city: string;
  temperature: number;
  description: string;
};

type MedicationHomeSignal = {
  todaySummary?: {
    scheduled: number;
    remaining: number;
  };
  nextDose?: {
    name?: string | null;
    minutesUntil?: number | null;
  };
};

type PreventionHomeSignal = {
  focus?: "Heart" | "Falls" | "Diabetes" | "Medicine" | "Follow-up" | "Plan";
};

type LatestVitalsHomeSignal = {
  analysis?: {
    safety_status?: string | null;
    recommended_action?: string | null;
  } | null;
  latest_alert?: {
    severity?: string | null;
  } | null;
};

type DailyCheckinHomeSignal = {
  status?: "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";
};

type BrainCoachHomeSignal = {
  summary?: {
    completedSessions?: number;
    streakDays?: number;
  };
  today?: {
    completedCount?: number;
  };
};

type ParticipationPulseHomeSignal = {
  pulse?: {
    featuredEvent?: {
      format?: "nearby" | "online" | "hybrid" | string;
    } | null;
    savedEvents?: unknown[];
    notifications?: unknown[];
    emptyProfileNudge?: unknown;
  };
};

type ConciergePendingHomeSignal = {
  items?: ConciergePendingHomeItem[];
};

type ConciergeCompletedHomeSignal = {
  items?: ConciergeCompletedHomeItem[];
};

type ConciergePendingHomeItem = {
  id?: string | null;
  use_case?: string | null;
  provider_name?: string | null;
  action_summary?: string | null;
  status?: "pending" | "calling" | "completed" | "failed" | "cancelled" | string | null;
  action_payload?: Record<string, unknown> | null;
  confirmed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  task_path?: string | null;
};

type ConciergeCompletedHomeItem = {
  id?: string | null;
  pending_id?: string | null;
  use_case?: string | null;
  provider_name?: string | null;
  outcome?: string | null;
  outcome_payload?: Record<string, unknown> | null;
  outcome_summary?: string | null;
  completed_at?: string | null;
};

type HomeFastAction = {
  id: "callGp" | "emailGp" | "doctor" | "appointment" | "ride";
  icon: LucideIcon;
  tone: "call" | "email" | "doctor" | "appointment" | "ride";
  label: string;
  sub: string;
  mobileLabel?: string;
  mobileSub?: string;
  href?: string;
};

type HomeIntentLayer = "home" | "health";


const COORDS_WEATHER_CACHE_KEY = "vyva_coords_weather_cache";
const COORDS_WEATHER_TTL_MS = 30 * 60 * 1000;

function readCoordsWeatherCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(COORDS_WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: WeatherData; ts: number };
    if (Date.now() - parsed.ts > COORDS_WEATHER_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCoordsWeatherCache(data: WeatherData) {
  try {
    localStorage.setItem(COORDS_WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    return;
  }
}

function sanitizePhoneHref(phone?: string | null) {
  const raw = phone?.trim();
  if (!raw) return "";
  const normalized = raw.replace(/[^\d+]/g, "");
  return `tel:${normalized || raw}`;
}

function homeDoctorMailto(email: string | undefined | null, subject: string, body: string) {
  const raw = email?.trim();
  if (!raw) return "";
  return `mailto:${raw}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const HOME_AGENT_CARDS: HomeAgentCard[] = [
  { id: "health", icon: Heart, path: "/health", theme: "pink" },
  { id: "cognitive", icon: Brain, path: "/mind-memory", theme: "purple" },
  { id: "social", icon: Users, path: "/social-rooms", theme: "blue" },
  { id: "concierge", icon: ConciergeBell, path: "/concierge", theme: "green" },
];

const HOME_FAST_ACTIONS: Array<Pick<HomeFastAction, "id" | "icon" | "tone">> = [
  { id: "doctor", icon: Stethoscope, tone: "doctor" },
  { id: "appointment", icon: Calendar, tone: "appointment" },
  { id: "ride", icon: Car, tone: "ride" },
];

const HOME_AGENT_MOBILE_COPY: Record<HomeAgentCard["id"], { title: string; subtitle: string }> = {
  health: { title: "My Health", subtitle: "Care today" },
  cognitive: { title: "My Mental", subtitle: "Memory and focus" },
  social: { title: "My Community", subtitle: "Rooms and chats" },
  concierge: { title: "My Concierge", subtitle: "Help and errands" },
};

const HOME_FAST_ACTION_MOBILE_COPY: Record<"doctor" | "appointment" | "ride", { label: string; sub: string }> = {
  doctor: { label: "Doctor help", sub: "Talk through a concern" },
  appointment: { label: "Appointment", sub: "Prepare a request" },
  ride: { label: "Find transport", sub: "Compare safe options" },
};

const HOME_FAST_HELP_VISIBLE_COUNT = 3;

const SECTION_VOICE_AUTO_START_OPTIONS: NavigateOptions = {
  state: { [SECTION_VOICE_AUTO_START_KEY]: true },
};

type HomeTranslate = (key: string, fallback: string, values?: Record<string, string | number>) => string;

function baseLanguageCode(language?: string | null) {
  const code = language?.split("-")[0]?.toLowerCase();
  if (code === "es" || code === "de") return code;
  return "en";
}

function conciergeHomeItems(pending: ConciergePendingHomeSignal | null | undefined) {
  return pending?.items?.filter((item) => item?.id && item.status !== "completed" && item.status !== "cancelled") ?? [];
}

function conciergeHomeStatus(item: ConciergePendingHomeItem) {
  return (item.status ?? "").toLowerCase();
}

function conciergeTaskKind(useCase: string | null | undefined, payload: Record<string, unknown> | null | undefined) {
  if (payload?.task_type === "provider_shortlist") return "providerShortlist";
  const appointmentType = typeof payload?.appointment_type === "string"
    ? payload.appointment_type
    : "";
  if (appointmentType === "home-service") return "homeService";
  switch (useCase) {
    case "book_ride":
      return "ride";
    case "book_appointment":
      return "appointment";
    case "order_medicine":
      return "pharmacy";
    case "home_service":
      return "homeService";
    case "find_provider":
      return "provider";
    case "admin_task":
    case "paperwork":
      return "admin";
    case "scam_check":
      return "safety";
    default:
      return "default";
  }
}

function conciergeHomeTaskKind(item: ConciergePendingHomeItem) {
  return conciergeTaskKind(item.use_case, item.action_payload);
}

function conciergeCompletedHomeTaskKind(item: ConciergeCompletedHomeItem) {
  return conciergeTaskKind(item.use_case, item.outcome_payload);
}

function contextualFastHelpActionForConciergeKind(
  kind: ReturnType<typeof conciergeTaskKind>,
): ContextualHomeFastHelpActionId | null {
  switch (kind) {
    case "ride":
      return "book-ride";
    case "appointment":
    case "homeService":
    case "pharmacy":
    case "provider":
    case "providerShortlist":
      return "find-care";
    case "admin":
      return "paperwork-help";
    case "safety":
      return "safe-home";
    default:
      return null;
  }
}

function contextualFastHelpRemoteActivity(
  completed: ConciergeCompletedHomeSignal | null | undefined,
): HomeFastHelpActivity[] {
  return completed?.items?.flatMap((item) => {
    const actionId = contextualFastHelpActionForConciergeKind(conciergeCompletedHomeTaskKind(item));
    const occurredAt = item.completed_at?.trim();
    if (!actionId || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return [];
    const outcome = item.outcome?.toLowerCase() ?? "";
    const status = outcome.includes("dismiss") || outcome.includes("cancel") || outcome.includes("declin")
      ? "dismissed" as const
      : outcome.includes("fail") || outcome.includes("unavailable") || outcome.includes("error")
        ? "blocked" as const
        : "completed" as const;
    return [{ actionId, status, occurredAt }];
  }) ?? [];
}

function conciergeHomeTaskLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  switch (conciergeHomeTaskKind(item)) {
    case "ride":
      return t("home.conciergeResume.task.ride", "ride");
    case "appointment":
      return t("home.conciergeResume.task.appointment", "appointment");
    case "pharmacy":
      return t("home.conciergeResume.task.pharmacy", "pharmacy request");
    case "homeService":
      return t("home.conciergeResume.task.homeService", "home service");
    case "provider":
      return t("home.conciergeResume.task.provider", "provider search");
    case "providerShortlist":
      return t("home.conciergeResume.task.providerShortlist", "saved options");
    case "admin":
      return t("home.conciergeResume.task.admin", "admin task");
    case "safety":
      return t("home.conciergeResume.task.safety", "safety check");
    default:
      return t("home.conciergeResume.task.default", "request");
  }
}

function conciergeHomeProviderLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  return item.provider_name?.trim()
    || conciergeHomePayloadString(item, ["provider_name", "pharmacy_name"])
    || t("home.conciergeResume.providerFallback", "provider");
}

function conciergeCompletedHomeTaskLabel(item: ConciergeCompletedHomeItem, t: HomeTranslate) {
  switch (conciergeCompletedHomeTaskKind(item)) {
    case "ride":
      return t("home.conciergeResume.task.ride", "ride");
    case "appointment":
      return t("home.conciergeResume.task.appointment", "appointment");
    case "pharmacy":
      return t("home.conciergeResume.task.pharmacy", "pharmacy request");
    case "homeService":
      return t("home.conciergeResume.task.homeService", "home service");
    case "provider":
      return t("home.conciergeResume.task.provider", "provider search");
    case "admin":
      return t("home.conciergeResume.task.admin", "admin task");
    case "safety":
      return t("home.conciergeResume.task.safety", "safety check");
    default:
      return t("home.conciergeResume.task.default", "request");
  }
}

function conciergeHomePayloadString(item: ConciergePendingHomeItem, keys: string[]) {
  const payload = item.action_payload;
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function conciergeHomeExecutionTask(item: ConciergePendingHomeItem): Partial<ConciergeExecutionTask> | null {
  const task = item.action_payload?.execution_task;
  return task && typeof task === "object" && !Array.isArray(task)
    ? task as Partial<ConciergeExecutionTask>
    : null;
}

function conciergeHomePayloadBoolean(item: ConciergePendingHomeItem, keys: string[]) {
  const payload = item.action_payload;
  if (!payload) return false;
  return keys.some((key) => payload[key] === true);
}

function conciergeHomeHasMissingDetails(item: ConciergePendingHomeItem) {
  const task = conciergeHomeExecutionTask(item);
  const missingRequirements = Array.isArray(task?.missing_requirements)
    ? task.missing_requirements
    : [];
  const missingDetails = item.action_payload?.missingDetails ?? item.action_payload?.missing_details;
  return missingRequirements.length > 0
    || (Array.isArray(missingDetails) && missingDetails.length > 0);
}

function conciergeHomeCanvasState(item: ConciergePendingHomeItem): ConciergeCanvasStateSummary {
  const executionTask = conciergeHomeExecutionTask(item);
  const hasMissingDetails = conciergeHomeHasMissingDetails(item);
  const requiresConfirmation = conciergeHomePayloadBoolean(item, [
    "confirmation_required_before_action",
    "no_external_action_without_confirmation",
  ]);
  const status = conciergeHomeStatus(item);

  return deriveConciergeCanvasState({
    status,
    useCase: item.use_case,
    flowReference: executionTask?.flow_reference
      ?? conciergeHomePayloadString(item, ["flow_reference"]),
    actionType: executionTask?.action_type
      ?? conciergeHomePayloadString(item, ["action_type", "task_type"]),
    executionTask,
    hasMissingDetails,
    hasReviewSummary: !hasMissingDetails,
    reviewPresented: status === "pending" && !hasMissingDetails && (requiresConfirmation || Boolean(executionTask)),
    waitingForProvider: conciergeHomeIsWaitingOnProvider(item),
    missionStatus: conciergeHomePayloadString(item, ["mission_status", "status", "current_step"]),
  });
}

function conciergeCompletedPayloadString(item: ConciergeCompletedHomeItem, keys: string[]) {
  const payload = item.outcome_payload;
  if (!payload) return "";
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function conciergeCompletedHomeItems(completed: ConciergeCompletedHomeSignal | null | undefined) {
  return completed?.items?.filter((item) => {
    if (!item?.id || !item.use_case) return false;
    if (item.outcome !== "completed" && !item.completed_at) return false;
    return conciergeCompletedHomeTaskKind(item) !== "default";
  }) ?? [];
}

function conciergeCompletedHomeProvider(item: ConciergeCompletedHomeItem, t: HomeTranslate) {
  return item.provider_name?.trim()
    || conciergeCompletedPayloadString(item, ["provider_name", "pharmacy_name"])
    || t("home.conciergeReuse.providerFallback", "VYVA");
}

function conciergeCompletedHomeTemplate(item: ConciergeCompletedHomeItem) {
  return {
    id: item.id ?? "home-completed-template",
    pending_id: item.pending_id ?? null,
    use_case: item.use_case ?? "concierge_task",
    provider_name: item.provider_name ?? null,
    outcome: item.outcome ?? "completed",
    outcome_summary: item.outcome_summary ?? null,
    completed_at: item.completed_at ?? null,
    outcome_payload: item.outcome_payload ?? {},
  };
}

function conciergeHomeIsWaitingOnProvider(item: ConciergePendingHomeItem) {
  const missionStatus = conciergeHomePayloadString(item, ["mission_status", "status", "current_step"]).toLowerCase();
  const liveHandoffStatus = conciergeHomePayloadString(item, ["live_handoff_status", "provider_follow_up_status"]).toLowerCase();
  const status = conciergeHomeStatus(item);
  return status === "calling"
    || status === "in_progress"
    || missionStatus.includes("awaiting_provider")
    || liveHandoffStatus === "waiting"
    || liveHandoffStatus === "sent_or_called";
}

function conciergeHomeWaitingLabel(
  item: ConciergePendingHomeItem,
  nowMs: number,
  language: string,
  t: HomeTranslate,
) {
  const raw = conciergeHomePayloadString(item, [
    "provider_waiting_since",
    "waiting_since",
    "provider_last_contact_at",
    "contacted_at",
  ]) || item.confirmed_at || "";
  const waitingSince = raw ? new Date(raw) : null;
  if (!waitingSince || Number.isNaN(waitingSince.getTime())) {
    return t("home.conciergeResume.step.waiting", "Waiting for reply");
  }

  const elapsedMinutes = Math.max(0, Math.floor((nowMs - waitingSince.getTime()) / 60_000));
  if (elapsedMinutes < 1) return t("home.conciergeResume.waitingNow", "Sent just now");
  if (elapsedMinutes < 60) {
    return t("home.conciergeResume.waitingMinutes", "{{count}} min waiting", { count: elapsedMinutes });
  }
  if (elapsedMinutes < 24 * 60) {
    const hours = Math.floor(elapsedMinutes / 60);
    return t("home.conciergeResume.waitingHours", "{{count}} hr waiting", { count: hours });
  }

  const time = new Intl.DateTimeFormat(language || "en", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(waitingSince);
  return t("home.conciergeResume.waitingSince", "Waiting since {{time}}", { time });
}

function conciergeHomeStepLabel(item: ConciergePendingHomeItem, t: HomeTranslate, isSpanish = false) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.step.providerShortlist", "Review saved options");
  if (isShowVyvaPreparedTask(item.action_payload)) {
    return t("home.showVyvaResume.step", "Review first");
  }
  return conciergeCanvasStateLabel(conciergeHomeCanvasState(item).state, isSpanish);
}

function conciergeHomeKickerLabel(item: ConciergePendingHomeItem, t: HomeTranslate, isSpanish = false) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.kickerProviderShortlist", "Saved shortlist");
  if (isShowVyvaPreparedTask(item.action_payload)) return t("home.showVyvaResume.kicker", "VYVA prepared this");
  return conciergeCanvasStateLabel(conciergeHomeCanvasState(item).state, isSpanish);
}

function conciergeHomeTitlePrefix(item: ConciergePendingHomeItem, t: HomeTranslate) {
  if (conciergeHomeTaskKind(item) === "providerShortlist") return t("home.conciergeResume.titleProviderShortlistPrefix", "Review your");
  const state = conciergeHomeCanvasState(item).state;
  if (state === "collecting") return t("home.conciergeResume.titleCollectPrefix", "Add detail for your");
  if (state === "ready_to_review") return t("home.conciergeResume.titleReviewPrefix", "Review your");
  if (state === "awaiting_confirmation") return t("home.conciergeResume.titleConfirmPrefix", "Confirm your");
  if (state === "failed") return t("home.conciergeResume.titleTryAgainPrefix", "Try another way for your");
  return t("home.conciergeResume.titlePrefix", "VYVA is working on your");
}

function conciergeCompletedCanvasLabel(isSpanish: boolean) {
  return conciergeCanvasStateLabel("completed", isSpanish);
}

const HOME_AGENT_THEMES: Record<HomeAgentCard["theme"], {
  iconBg: string;
  iconColor: string;
  glow: string;
}> = {
  pink: {
    iconBg: "linear-gradient(135deg, #FFE7E7 0%, #FFF7F2 100%)",
    iconColor: "#E74C43",
    glow: "rgba(231,76,67,0.12)",
  },
  purple: {
    iconBg: "linear-gradient(135deg, #ECE4FF 0%, #F8F2FF 100%)",
    iconColor: "#7C3AED",
    glow: "rgba(124,58,237,0.13)",
  },
  blue: {
    iconBg: "linear-gradient(135deg, #E6F0FF 0%, #F3F8FF 100%)",
    iconColor: "#2F66D0",
    glow: "rgba(47,102,208,0.12)",
  },
  green: {
    iconBg: "linear-gradient(135deg, #DDF8EA 0%, #F1FBF5 100%)",
    iconColor: "#149A63",
    glow: "rgba(20,154,99,0.12)",
  },
};

const HOME_FAST_ACTION_THEMES: Record<HomeFastAction["tone"], {
  iconBg: string;
  iconColor: string;
  border: string;
  shadow: string;
}> = {
  call: {
    iconBg: "#ECFDF5",
    iconColor: "#047857",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
  email: {
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
    border: "#BFDBFE",
    shadow: "rgba(37,99,235,0.10)",
  },
  doctor: {
    iconBg: "#EEF6FF",
    iconColor: "#2563EB",
    border: "#BFDBFE",
    shadow: "rgba(37,99,235,0.10)",
  },
  appointment: {
    iconBg: "#F5F3FF",
    iconColor: "#6B21A8",
    border: "#D8B4FE",
    shadow: "rgba(107,33,168,0.11)",
  },
  ride: {
    iconBg: "#ECFDF5",
    iconColor: "#047857",
    border: "#BBF7D0",
    shadow: "rgba(4,120,87,0.10)",
  },
};

const HomeScreen = () => {
  const { guardPath, readiness, canUseService } = useServiceGate();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { isDark: isHomeMasterDark } = useHomeMasterTheme();
  const voice = useOptionalVyvaVoice();
  const { firstName: profileFirstName, profile } = useProfile();
  const activeFastHelpImpressionIdRef = useRef<string | null>(null);
  const fastHelpImpressionIdsByFingerprintRef = useRef(new Map<string, string>());
  const [fastHelpStartIndex, setFastHelpStartIndex] = useState(0);
  const [conciergeClockMs, setConciergeClockMs] = useState(() => Date.now());
  const homeFastHelpHistoryKey = homeFastHelpHistoryStorageKey(profile?.profileId);
  const homeFastHelpJourneyKey = homeFastHelpJourneyStorageKey(profile?.profileId);
  const [homeFastHelpHistory, setHomeFastHelpHistory] = useState<HomeFastHelpActivity[]>(() => (
    readHomeFastHelpHistory(homeFastHelpHistoryKey)
  ));
  const [homeFastHelpJourneys, setHomeFastHelpJourneys] = useState<HomeFastHelpJourney[]>(() => (
    readHomeFastHelpJourneys(homeFastHelpJourneyKey)
  ));
  const [showVyvaReviewHistory, setShowVyvaReviewHistory] = useState<ShowVyvaReviewHistoryItem[]>(() => (
    readShowVyvaReviewHistory()
  ));
  const [homeIntentLayer, setHomeIntentLayer] = useState<HomeIntentLayer>("home");
  const [conciergeReceiptDetailsOpen, setConciergeReceiptDetailsOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setConciergeClockMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setHomeFastHelpHistory(readHomeFastHelpHistory(homeFastHelpHistoryKey));
  }, [homeFastHelpHistoryKey]);

  useEffect(() => {
    activeFastHelpImpressionIdRef.current = null;
    fastHelpImpressionIdsByFingerprintRef.current.clear();
  }, [profile?.profileId]);

  useEffect(() => {
    const syncJourneys = () => setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
    setHomeFastHelpJourneys(abandonOpenedHomeFastHelpJourneys(homeFastHelpJourneyKey));

    const handleJourneyChange = (event: Event) => {
      const changedKey = event instanceof CustomEvent && typeof event.detail?.storageKey === "string"
        ? event.detail.storageKey
        : null;
      if (changedKey && changedKey !== homeFastHelpJourneyKey) return;
      syncJourneys();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === homeFastHelpJourneyKey) syncJourneys();
    };
    window.addEventListener(HOME_FAST_HELP_JOURNEY_EVENT, handleJourneyChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(HOME_FAST_HELP_JOURNEY_EVENT, handleJourneyChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [homeFastHelpJourneyKey]);

  useEffect(() => {
    const refresh = () => setShowVyvaReviewHistory(readShowVyvaReviewHistory());
    window.addEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SHOW_VYVA_REVIEW_HISTORY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const firstName = displayFirstName(profileFirstName);
  const homeDoctorContext = t("home.fastHelp.doctorContext", "Home quick doctor help request. Ask what is happening and help prepare a safe next step.");
  const gpName = profile?.gpName?.trim();
  const gpPhoneHref = sanitizePhoneHref(profile?.gpPhone);
  const gpEmailHref = homeDoctorMailto(
    profile?.gpEmail,
    t("health.symptomCheck.report.actions.emailSubject", "VYVA symptom report"),
    homeDoctorContext,
  );

  const {
    data: profileWeatherData,
    isError: profileWeatherError,
    error: profileWeatherRawError,
  } = useQuery<WeatherData>({
    queryKey: ["/api/weather"],
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: true,
    retry: false,
  });

  const [coordsWeatherData, setCoordsWeatherData] = useState<WeatherData | null>(() => readCoordsWeatherCache());
  const geoAttemptedRef = useRef(false);

  const noCityInProfile =
    profileWeatherError &&
    profileWeatherRawError instanceof Error &&
    profileWeatherRawError.message.startsWith("404");

  const fetchIpWeather = useCallback(async () => {
    try {
      const res = await fetch("/api/weather/by-ip");
      if (res.ok) {
        const data = await res.json();
        writeCoordsWeatherCache(data);
        setCoordsWeatherData(data);
      }
    } catch (err) {
      console.warn("[home] IP weather lookup failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!noCityInProfile) return;
    if (geoAttemptedRef.current) return;
    geoAttemptedRef.current = true;

    if (readCoordsWeatherCache()) {
      return;
    }

    if (!navigator.geolocation) {
      fetchIpWeather();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/weather/by-coords?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            writeCoordsWeatherCache(data);
            setCoordsWeatherData(data);
          }
        } catch (err) {
          console.warn("[home] coordinate weather lookup failed:", err);
        }
      },
      () => {
        fetchIpWeather();
      },
      { timeout: 8000 }
    );
  }, [fetchIpWeather, noCityInProfile]);

  const weatherData = profileWeatherData ?? coordsWeatherData;
  const participationLanguage = baseLanguageCode(language);

  const { data: medicationHomeSignal } = useQuery<MedicationHomeSignal>({
    queryKey: ["/api/meds/adherence-report"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: latestVitalsHomeSignal } = useQuery<LatestVitalsHomeSignal>({
    queryKey: ["/api/vitals-engine/latest"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: preventionHomeSignal } = useQuery<PreventionHomeSignal>({
    queryKey: ["/api/health/prevention"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: checkinHomeSignal } = useQuery<DailyCheckinHomeSignal>({
    queryKey: ["/api/checkins/today"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: brainCoachHomeSignal } = useQuery<BrainCoachHomeSignal>({
    queryKey: ["/api/games/progress"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: participationPulseHomeSignal } = useQuery<ParticipationPulseHomeSignal>({
    queryKey: [`/api/social/participate/pulse?lang=${participationLanguage}`],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: conciergePendingHomeSignal } = useQuery<ConciergePendingHomeSignal>({
    queryKey: ["/api/concierge/actions/pending"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const { data: conciergeCompletedHomeSignal } = useQuery<ConciergeCompletedHomeSignal>({
    queryKey: ["/api/concierge/actions/sessions"],
    staleTime: 60 * 1000,
    retry: false,
  });

  const timeGreetingKey = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour <= 11) return "morning";
    if (hour >= 12 && hour <= 16) return "afternoon";
    return "evening";
  }, []);

  const greetingText = useMemo(() => {
    const period = timeGreetingKey;
    if (firstName) {
      return t(`home.greeting.${period}.withName.1`, { name: firstName });
    }
    return t(`home.greeting.${period}.withoutName.1`);
  }, [firstName, timeGreetingKey, t]);

  const handleNavigate = (path: string, options?: NavigateOptions) => guardPath(path, options);

  const launchHomeFastHelp = (
    actionId: ContextualHomeFastHelpActionId,
    path: string,
    options?: NavigateOptions,
  ) => {
    const { context } = startHomeFastHelpJourney({
      actionId,
      destinationPath: path,
      destinationState: options?.state,
      profileId: profile?.profileId,
      impressionId: activeFastHelpImpressionIdRef.current,
    });
    const allowed = handleNavigate(path, {
      ...options,
      state: withHomeFastHelpContextState(context, options?.state),
    });
    if (allowed === false) {
      markHomeFastHelpJourney(context, "blocked", { reason: "service_not_ready" });
    }
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(context.storageKey));
  };

  const resumedHomeFastHelpState = (actionId: ContextualHomeFastHelpActionId) => {
    if (actionId === "book-ride") return {
      conciergePrefill: {
        kind: "ride",
        message: t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation."),
        flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
        source: "home_quick_action",
      },
    };
    if (actionId === "find-care") {
      const message = t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation.");
      return {
        conciergePrefill: {
          kind: "task",
          message,
          flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
          requestedTool: "operator_review",
          actionLabel: t("home.master.fastHelp.findCareAction", "Prepare care search"),
          summary: t("home.master.fastHelp.findCareSummary", "VYVA prepares options first, then asks before contacting anyone."),
          useCase: "find_provider",
          providerSearchMode: "care",
          providerSearchCriteria: ["nearby", "reputation", "accessible"],
          providerSearchQuery: message,
          source: "home_quick_action",
        },
      };
    }
    if (actionId === "paperwork-help") return {
      conciergePrefill: {
        kind: "task",
        message: t("home.master.fastHelp.paperworkHelpPrefill", "Help me with paperwork or a form. Prepare answers and stop before submitting so I can confirm."),
        flowReference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
        requestedTool: "operator_review",
        actionLabel: t("home.master.fastHelp.paperworkHelpAction", "Prepare paperwork"),
        summary: t("home.master.fastHelp.paperworkHelpSummary", "VYVA organizes the form, missing details, and safest next step."),
        useCase: "admin_task",
        source: "home_quick_action",
      },
    };
    return null;
  };

  const continueHomeFastHelp = (
    journey: HomeFastHelpJourney,
    stateOverride?: Record<string, unknown>,
    fromRecoveryNudge = false,
  ) => {
    const resumed = resumeHomeFastHelpJourney(
      journey,
      homeFastHelpJourneyKey,
      fromRecoveryNudge
        ? { reason: "recovery_nudge", referenceId: HOME_FAST_HELP_RECOVERY_REFERENCE_ID }
        : undefined,
    );
    const context = homeFastHelpContextForJourney(resumed, homeFastHelpJourneyKey);
    const destinationState = {
      ...(resumed.destinationState ?? resumedHomeFastHelpState(resumed.actionId) ?? {}),
      ...(stateOverride ?? {}),
    };
    const allowed = handleNavigate(resumed.destinationPath, {
      state: withHomeFastHelpContextState(context, destinationState),
    });
    if (allowed === false) {
      markHomeFastHelpJourney(context, "blocked", { reason: "service_not_ready" });
    }
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };

  const rememberHomeFastHelpUse = (actionId: ContextualHomeFastHelpActionId) => {
    setHomeFastHelpHistory((current) => {
      const next = recordHomeFastHelpUse(current, actionId);
      writeHomeFastHelpHistory(homeFastHelpHistoryKey, next);
      return next;
    });
  };

  const handleAgentCardOpen = (card: HomeAgentCard) => {
    if (card.id === "health") {
      setHomeIntentLayer("health");
      return;
    }
    handleNavigate(card.path, SECTION_VOICE_AUTO_START_OPTIONS);
  };

  const handleFastActionOpen = (action: HomeFastAction) => {
    if (action.id === "doctor") {
      handleNavigate("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: homeDoctorContext,
        },
      });
      return;
    }

    const isRide = action.id === "ride";
    handleNavigate("/concierge", {
      state: {
        conciergePrefill: {
          kind: isRide ? "ride" : "appointment",
          message: isRide
            ? t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.")
            : t("home.fastHelp.appointmentPrefill", "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation."),
          source: "home_quick_action",
        },
      },
    });
  };

  const homeFastActions: HomeFastAction[] = useMemo(() => [
    ...(gpPhoneHref
      ? [{
          id: "callGp" as const,
          icon: PhoneCall,
          tone: "call" as const,
          label: gpName ? t("meds.callGpNamed", "Call {{name}}", { name: gpName }) : t("meds.callGp", "Call GP"),
          sub: t("meds.callGpSub", "Speak to your practice now."),
          mobileLabel: t("meds.callGpMobile", "Call GP"),
          mobileSub: t("meds.callGpSubMobile", "Speak now"),
          href: gpPhoneHref,
        }]
      : []),
    ...(gpEmailHref
      ? [{
          id: "emailGp" as const,
          icon: Mail,
          tone: "email" as const,
          label: t("meds.emailGp", "Email GP"),
          sub: t("meds.emailGpSub", "Open an email with context filled in."),
          mobileLabel: t("meds.emailGpMobile", "Email GP"),
          mobileSub: t("meds.emailGpSubMobile", "Send context"),
          href: gpEmailHref,
        }]
      : []),
    ...HOME_FAST_ACTIONS.map((action) => ({
      ...action,
      label: t(`home.fastHelp.${action.id}.label`),
      sub: t(`home.fastHelp.${action.id}.sub`),
      mobileLabel: t(`home.fastHelp.${action.id}.mobileLabel`, HOME_FAST_ACTION_MOBILE_COPY[action.id].label),
      mobileSub: t(`home.fastHelp.${action.id}.mobileSub`, HOME_FAST_ACTION_MOBILE_COPY[action.id].sub),
    })),
  ], [gpEmailHref, gpName, gpPhoneHref, t]);

  useEffect(() => {
    if (fastHelpStartIndex < homeFastActions.length) return;
    setFastHelpStartIndex(0);
  }, [fastHelpStartIndex, homeFastActions.length]);

  const visibleFastActions = useMemo(() => {
    if (homeFastActions.length <= HOME_FAST_HELP_VISIBLE_COUNT) return homeFastActions;
    return Array.from({ length: HOME_FAST_HELP_VISIBLE_COUNT }, (_item, index) => (
      homeFastActions[(fastHelpStartIndex + index) % homeFastActions.length]!
    ));
  }, [fastHelpStartIndex, homeFastActions]);

  const rotateFastHelp = () => {
    if (homeFastActions.length <= HOME_FAST_HELP_VISIBLE_COUNT) return;
    setFastHelpStartIndex((current) => (current + HOME_FAST_HELP_VISIBLE_COUNT) % homeFastActions.length);
  };

  const isSubscriptionLocked = (path: string) => {
    const serviceId = serviceForPath(path);
    if (!serviceId) return false;
    const service = readiness?.services?.[serviceId];
    return Boolean(service && !service.ready && service.missing.some((step) => step.section === "subscription"));
  };

  const homeMasterCards: MasterDashboardCard[] = [
    {
      id: "health",
      icon: Heart,
      title: t("home.master.cards.healthShortTitle", "My Health"),
      detail: t("home.master.cards.healthDetailShort", "Check in and stay on track"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => setHomeIntentLayer("health"),
      testId: "card-home-agent-health",
    },
    {
      id: "mind-memory",
      icon: Brain,
      title: t("home.master.cards.mindMemoryShortTitle", "My Mental"),
      detail: t("home.master.cards.mindMemoryDetailShort", "Memory and focus"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/mind-memory"),
      testId: "card-home-agent-cognitive",
    },
    {
      id: "social",
      icon: Users,
      title: t("home.master.cards.communityShortTitle", "My Community"),
      detail: t("home.master.cards.communityDetailShort", "Rooms and chats"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2F66D0", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms"),
      testId: "card-home-agent-social",
    },
    {
      id: "concierge",
      icon: ConciergeBell,
      title: t("home.master.cards.conciergeShortTitle", "My Concierge"),
      detail: t("home.master.cards.conciergeDetailShort", "Help and errands"),
      tone: { iconBg: "#ECFDF5", iconColor: "#149A63", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/concierge"),
      testId: "card-home-agent-concierge",
    },
  ];

  const openHealthPath = (path: string, options?: NavigateOptions) => {
    handleNavigate(path, options);
  };

  const homeMasterHealthCards: MasterDashboardCard[] = [
    {
      id: "health-symptoms",
      icon: HeartPulse,
      title: t("home.master.healthIntent.symptoms", "Symptoms"),
      detail: t("home.master.healthIntent.symptomsDetail", "Say what you feel"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/symptom-check", SECTION_VOICE_AUTO_START_OPTIONS),
      testId: "card-home-health-symptoms",
    },
    {
      id: "health-vitals",
      icon: Activity,
      title: t("home.master.healthIntent.vitals", "Vitals"),
      detail: t("home.master.healthIntent.vitalsDetail", "Blood pressure and readings"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2F66D0", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/vitals"),
      testId: "card-home-health-vitals",
    },
    {
      id: "health-meds",
      icon: Pill,
      title: t("home.master.healthIntent.meds", "Medications"),
      detail: t("home.master.healthIntent.medsDetail", "Doses and reminders"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/meds"),
      testId: "card-home-health-meds",
    },
    {
      id: "health-doctor",
      icon: Stethoscope,
      title: t("home.master.healthIntent.doctor", "Doctor next step"),
      detail: t("home.master.healthIntent.doctorDetail", "Prepare what to say"),
      tone: { iconBg: "#ECFDF5", iconColor: "#149A63", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: homeDoctorContext,
        },
      }),
      testId: "card-home-health-doctor",
    },
    {
      id: "health-prevention",
      icon: ShieldCheck,
      title: t("home.master.healthIntent.prevention", "Prevention"),
      detail: t("home.master.healthIntent.preventionDetail", "Stay well today"),
      tone: { iconBg: "#FFF7ED", iconColor: "#C15B08", border: "#FED7AA", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health/prevention"),
      testId: "card-home-health-prevention",
    },
    {
      id: "health-visual-scan",
      icon: Camera,
      title: t("home.master.healthIntent.visualScan", "Visual scan"),
      detail: t("home.master.healthIntent.visualScanDetail", "Show VYVA a concern"),
      tone: { iconBg: "#F0FDFA", iconColor: "#0F766E", border: "#99F6E4", surface: "#FFFFFF" },
      onClick: () => openHealthPath("/health", {
        state: {
          openVisualScan: true,
          source: "home_health_intent",
        },
      }),
      testId: "card-home-health-visual-scan",
    },
  ];

  const remainingMedicineCount = medicationHomeSignal?.todaySummary?.remaining ?? 0;
  const nextMedicineName = medicationHomeSignal?.nextDose?.name?.trim();
  const nextMedicineMinutes = medicationHomeSignal?.nextDose?.minutesUntil;
  const isHomeMasterVoiceAlive = Boolean(voice && (voice.status === "connected" || voice.isConnecting));
  const homeMasterScheduledSubtitle = nextMedicineName && typeof nextMedicineMinutes === "number" && nextMedicineMinutes >= 0
    ? t(
        "home.master.nextMedicationNudge",
        "In {{minutes}} min: {{name}}.",
        { minutes: nextMedicineMinutes, name: nextMedicineName },
      )
    : remainingMedicineCount > 0
    ? t(
        "home.master.medicationNudge",
        remainingMedicineCount === 1 ? "1 dose left today." : "{{count}} doses left today.",
        { count: remainingMedicineCount },
      )
    : t("home.master.heroSubtitle", "VYVA is ready when you are.");
  const homeMasterHealthSubtitle = isHomeMasterVoiceAlive
    ? t("home.master.healthIntent.voiceSubtitle", "Okay, health. Choose one, or tell VYVA.")
    : t("home.master.healthIntent.dormantSubtitle", "Choose a health option, or touch the orb and speak.");
  const homeMasterHeroSubtitle = homeIntentLayer === "health"
    ? homeMasterHealthSubtitle
    : isHomeMasterVoiceAlive
      ? homeMasterScheduledSubtitle
      : t("home.master.touchOrbToBegin", "Touch the orb to begin.");
  const homeMasterGreetingText = homeIntentLayer === "health"
    ? t("home.master.healthIntent.title", "Are you OK?")
    : greetingText.replace(/[.]$/, "");
  const homeMasterVisibleCards = homeIntentLayer === "health" ? homeMasterHealthCards : homeMasterCards;
  const homeMasterCardSectionTitle = homeIntentLayer === "health"
    ? t("home.master.healthIntent.sectionTitle", "What do you need?")
    : t("home.master.chooseCategory", "App shortcuts");
  const homeMasterCardSectionDescription = homeIntentLayer === "health"
    ? t("home.master.healthIntent.sectionDescription", "Choose a card, or keep talking to VYVA.")
    : undefined;

  const homeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "feel-better",
      icon: HeartPulse,
      label: t("home.master.fastHelp.feelBetter", "Symptoms Check"),
      detail: t("home.master.fastHelp.feelBetterDetail", "Symptoms or worries"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => launchHomeFastHelp("feel-better", "/health/symptom-check"),
      testId: "button-home-fast-feel-better",
    },
    {
      id: "stay-well",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.stayWell", "Age Well"),
      detail: t("home.master.fastHelp.stayWellDetail", "Prevention tips"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => launchHomeFastHelp("stay-well", "/health/prevention"),
      testId: "button-home-fast-stay-well",
    },
    {
      id: "find-care",
      icon: HeartHandshake,
      label: t("home.master.fastHelp.findCare", "Find Care"),
      detail: t("home.master.fastHelp.findCareDetail", "Support options"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => launchHomeFastHelp("find-care", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation."),
            flowReference: CONCIERGE_FLOW_REFERENCES.careNavigation,
            requestedTool: "operator_review",
            actionLabel: t("home.master.fastHelp.findCareAction", "Prepare care search"),
            summary: t("home.master.fastHelp.findCareSummary", "VYVA prepares options first, then asks before contacting anyone."),
            useCase: "find_provider",
            providerSearchMode: "care",
            providerSearchCriteria: ["nearby", "reputation", "accessible"],
            providerSearchQuery: t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation."),
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-find-care",
    },
    {
      id: "book-ride",
      icon: Car,
      label: t("home.master.fastHelp.bookRide", "Book Ride"),
      detail: t("home.master.fastHelp.bookRideDetail", "Transport help"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => launchHomeFastHelp("book-ride", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "ride",
            message: t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation."),
            flowReference: CONCIERGE_FLOW_REFERENCES.transportBooking,
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-book-ride",
    },
    {
      id: "paperwork-help",
      icon: FileText,
      label: t("home.master.fastHelp.paperworkHelp", "Paperwork Help"),
      detail: t("home.master.fastHelp.paperworkHelpDetail", "Forms and admin"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => launchHomeFastHelp("paperwork-help", "/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.paperworkHelpPrefill", "Help me with paperwork or a form. Prepare answers and stop before submitting so I can confirm."),
            flowReference: CONCIERGE_FLOW_REFERENCES.insuranceAdmin,
            requestedTool: "operator_review",
            actionLabel: t("home.master.fastHelp.paperworkHelpAction", "Prepare paperwork"),
            summary: t("home.master.fastHelp.paperworkHelpSummary", "VYVA organizes the form, missing details, and safest next step."),
            useCase: "admin_task",
            source: "home_quick_action",
          },
        },
      }),
      testId: "button-home-fast-paperwork-help",
    },
    {
      id: "safe-home",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.safeHome", "Safe Home"),
      detail: t("home.master.fastHelp.safeHomeDetail", "Home or scam worry"),
      tone: { iconBg: "#FEF2F2", iconColor: "#B91C1C", border: "#FECACA" },
      onClick: () => launchHomeFastHelp("safe-home", "/safe-home"),
      testId: "button-home-fast-safe-home",
    },
  ];

  const conciergeResumeItems = conciergeHomeItems(conciergePendingHomeSignal);
  const reusableConciergeHomeTask = conciergeCompletedHomeItems(conciergeCompletedHomeSignal)[0] ?? null;
  const reusableConciergeReceipt = reusableConciergeHomeTask
    ? buildConciergeConfirmationReceipt({
        useCase: reusableConciergeHomeTask.use_case,
        providerName: reusableConciergeHomeTask.provider_name,
        outcome: reusableConciergeHomeTask.outcome,
        outcomeSummary: reusableConciergeHomeTask.outcome_summary,
        completedAt: reusableConciergeHomeTask.completed_at,
        payload: reusableConciergeHomeTask.outcome_payload,
      }, language === "es")
    : null;
  const remoteFastHelpActivityFingerprint = JSON.stringify(
    contextualFastHelpRemoteActivity(conciergeCompletedHomeSignal),
  );
  const remoteFastHelpActivity = useMemo<HomeFastHelpActivity[]>(
    () => JSON.parse(remoteFastHelpActivityFingerprint) as HomeFastHelpActivity[],
    [remoteFastHelpActivityFingerprint],
  );
  useEffect(() => {
    setHomeFastHelpJourneys(reconcileHomeFastHelpJourneys(
      homeFastHelpJourneyKey,
      remoteFastHelpActivity,
    ));
  }, [homeFastHelpJourneyKey, remoteFastHelpActivity]);
  const journeyFastHelpActivity = homeFastHelpActivityFromJourneys(homeFastHelpJourneys);
  const latestBlockedJourney = latestBlockedHomeFastHelpJourney(homeFastHelpJourneys, conciergeClockMs);
  const rawRecoveryNudge = selectHomeFastHelpRecoveryNudge(homeFastHelpJourneys, {
    nowMs: conciergeClockMs,
    hasSavedTransportProvider: profile?.serviceReadiness?.hasSavedTransportProvider,
  });
  const homeResumeCandidate = selectHomeResumeCandidate({
    conciergeItems: conciergeResumeItems,
    fastHelpRecovery: rawRecoveryNudge,
  });
  const activeConciergeHomeTask = homeResumeCandidate?.source === "concierge"
    ? homeResumeCandidate.item
    : null;
  const recoveryNudge = homeResumeCandidate?.source === "fast_help"
    ? homeResumeCandidate.nudge
    : null;
  const activeConciergeShowVyvaTask = activeConciergeHomeTask ? isShowVyvaPreparedTask(activeConciergeHomeTask.action_payload) : false;
  const activeConciergeTaskText = activeConciergeHomeTask
    ? activeConciergeShowVyvaTask
      ? showVyvaResumeActionLabel(activeConciergeHomeTask.action_payload, language)
      : conciergeHomeTaskLabel(activeConciergeHomeTask, t)
    : "";
  const conciergeHomeStepText = activeConciergeHomeTask ? conciergeHomeStepLabel(activeConciergeHomeTask, t, language === "es") : "";
  const conciergeHomeKickerText = activeConciergeHomeTask ? conciergeHomeKickerLabel(activeConciergeHomeTask, t, language === "es") : "";
  const conciergeHomeTitlePrefixText = activeConciergeHomeTask ? conciergeHomeTitlePrefix(activeConciergeHomeTask, t) : "";
  const activeConciergeWaitingOnProvider = activeConciergeHomeTask ? conciergeHomeIsWaitingOnProvider(activeConciergeHomeTask) : false;
  const activeConciergeWaitingText = activeConciergeHomeTask && activeConciergeWaitingOnProvider
    ? conciergeHomeWaitingLabel(activeConciergeHomeTask, conciergeClockMs, language, t)
    : conciergeHomeStepText;
  const activeConciergeCanvasState = activeConciergeHomeTask
    ? conciergeHomeCanvasState(activeConciergeHomeTask)
    : null;
  const activeConciergeProviderText = activeConciergeHomeTask ? conciergeHomeProviderLabel(activeConciergeHomeTask, t) : "";
  const activeConciergeCanvasCopy = activeConciergeCanvasState
    ? conciergeCanvasExplainability(activeConciergeCanvasState, language === "es", {
        providerName: activeConciergeProviderText,
      })
    : null;
  const activeConciergeShowVyvaSourceText = activeConciergeHomeTask && activeConciergeShowVyvaTask
    ? showVyvaResumeSourceLabel(activeConciergeHomeTask.action_payload, language)
    : "";
  const activeConciergeShowVyvaSummary = activeConciergeHomeTask && activeConciergeShowVyvaTask
    ? showVyvaResumeSummary(activeConciergeHomeTask.action_payload, activeConciergeHomeTask.action_summary)
    : "";
  const activeConciergeTitleText = activeConciergeHomeTask
    ? activeConciergeShowVyvaTask
      ? t("home.showVyvaResume.title", "VYVA prepared this")
      : activeConciergeWaitingOnProvider
      ? t("home.conciergeResume.waitingTitle", "Waiting for {{provider}}", { provider: activeConciergeProviderText })
      : `${conciergeHomeTitlePrefixText} ${activeConciergeTaskText}`
    : "";
  const openActiveConciergeTask = (mode?: "follow_up" | "reply") => {
    if (!activeConciergeHomeTask?.id) return;
    handleNavigate(activeConciergeHomeTask.task_path || conciergeTaskPath(activeConciergeHomeTask.id), {
      state: mode
        ? {
            focusRightNow: true,
            conciergeProviderAction: {
              pendingId: activeConciergeHomeTask.id,
              mode,
            },
          }
        : { focusRightNow: true, conciergePendingId: activeConciergeHomeTask.id },
    });
  };
  const activeContextualFastHelpActionId = activeConciergeHomeTask
    ? contextualFastHelpActionForConciergeKind(conciergeHomeTaskKind(activeConciergeHomeTask))
    : recoveryNudge?.journey.actionId ?? null;
  const unfinishedContextualFastHelpActionIds = [...new Set(
    conciergeResumeItems.flatMap((item) => {
      const actionId = contextualFastHelpActionForConciergeKind(conciergeHomeTaskKind(item));
      return actionId ? [actionId] : [];
    }),
  )];
  const contextualFastHelpRanking = rankContextualHomeFastHelp({
    activeTaskActionId: activeContextualFastHelpActionId,
    activity: [...homeFastHelpHistory, ...remoteFastHelpActivity, ...journeyFastHelpActivity],
    nowMs: conciergeClockMs,
    profile: profile?.serviceReadiness,
    rotationKey: profile?.profileId,
    signals: {
      alertSeverity: latestVitalsHomeSignal?.latest_alert?.severity,
      checkinStatus: checkinHomeSignal?.status,
      preventionFocus: preventionHomeSignal?.focus,
      recommendedAction: latestVitalsHomeSignal?.analysis?.recommended_action,
      safetyStatus: latestVitalsHomeSignal?.analysis?.safety_status,
    },
    unfinishedTaskActionIds: unfinishedContextualFastHelpActionIds,
    visibleCount: 3,
  });
  const homeMasterFastHelpActionById = new Map(
    homeMasterFastHelpActions.map((action) => [action.id as ContextualHomeFastHelpActionId, action]),
  );
  const contextualHomeMasterFastHelpActions = contextualFastHelpRanking.flatMap((ranked) => {
    const action = homeMasterFastHelpActionById.get(ranked.id);
    if (!action) return [];
    return [{
      ...action,
      detail: latestBlockedJourney && ranked.id !== latestBlockedJourney.actionId
        ? t("home.contextualFastHelp.outcome.blockedAlternative", "Try this useful next step instead")
        : t(
            `home.contextualFastHelp.reasons.${ranked.reason}`,
            HOME_FAST_HELP_REASON_FALLBACKS[ranked.reason],
          ),
      onClick: () => {
        rememberHomeFastHelpUse(ranked.id);
        action.onClick();
      },
    }];
  });
  const contextualFastHelpImpressionFingerprint = [
    profile?.profileId ?? "browser",
    HOME_FAST_HELP_RANKING_VERSION,
    ...contextualFastHelpRanking.map((ranked) => ranked.id),
  ].join(":");

  useEffect(() => {
    const existingId = fastHelpImpressionIdsByFingerprintRef.current.get(contextualFastHelpImpressionFingerprint);
    if (existingId) {
      activeFastHelpImpressionIdRef.current = existingId;
      return;
    }
    const impression = recordHomeFastHelpImpression({
      actionIds: contextualFastHelpRanking.map((ranked) => ranked.id),
      rankingVersion: HOME_FAST_HELP_RANKING_VERSION,
      profileId: profile?.profileId,
    });
    activeFastHelpImpressionIdRef.current = impression?.id ?? null;
    if (impression) {
      fastHelpImpressionIdsByFingerprintRef.current.set(contextualFastHelpImpressionFingerprint, impression.id);
    }
  }, [contextualFastHelpImpressionFingerprint, contextualFastHelpRanking, profile?.profileId]);
  const homeMasterFastHelpActionsWithStatus = contextualHomeMasterFastHelpActions;
  const conciergeCompletedCanvasCopy = conciergeCanvasExplainability("completed", language === "es");
  const conciergeRightNowNudge = activeConciergeHomeTask ? (
    <div
      data-testid="card-home-concierge-resume"
      data-resume-kind={homeResumeCandidate?.kind}
      className="w-full min-w-0 rounded-[22px] border border-[#BBF7D0] bg-[linear-gradient(135deg,#F8FFFC_0%,#FFFFFF_52%,#F4FDF8_100%)] p-3 text-left shadow-[0_12px_28px_rgba(4,120,87,0.08)] min-[390px]:p-4"
      aria-label={`${conciergeHomeKickerText}: ${activeConciergeTitleText}. ${activeConciergeShowVyvaTask ? activeConciergeTaskText : activeConciergeWaitingText}`}
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#ECFDF5] text-[#047857] min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <ConciergeBell size={24} strokeWidth={2.55} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-[#047857]">
            {conciergeHomeKickerText}
          </span>
          <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {activeConciergeTitleText}
          </span>
          <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
            {activeConciergeShowVyvaTask
              ? `${activeConciergeShowVyvaSourceText} · ${activeConciergeTaskText}`
              : activeConciergeWaitingText}
          </span>
          {activeConciergeCanvasCopy ? (
            <span
              className="mt-1 block line-clamp-2 font-body text-[12px] font-bold leading-tight text-[#115E59]"
              data-testid="text-home-concierge-state-explanation"
            >
              {activeConciergeCanvasCopy.stateExplanation}
            </span>
          ) : null}
          {activeConciergeCanvasCopy && activeConciergeCanvasState?.state !== "completed" ? (
            <span
              className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#0F766E]"
              data-testid="text-home-concierge-safety-rule"
            >
              {activeConciergeCanvasCopy.safetyRule}
            </span>
          ) : null}
          {activeConciergeShowVyvaSummary ? (
            <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-vyva-text-3">
              {activeConciergeShowVyvaSummary}
            </span>
          ) : null}
        </span>
      </div>
      <div className={`mt-3 grid gap-2 ${activeConciergeWaitingOnProvider ? "grid-cols-3" : "grid-cols-1"}`}>
        <button
          type="button"
          data-testid="button-home-concierge-open"
          onClick={() => openActiveConciergeTask()}
          className="vyva-tap min-h-[42px] rounded-full bg-white px-3 font-body text-[12px] font-black text-[#047857] shadow-[0_8px_18px_rgba(4,120,87,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {t("home.conciergeResume.openShort", "Open")}
        </button>
        {activeConciergeWaitingOnProvider ? (
          <>
            <button
              type="button"
              data-testid="button-home-concierge-follow-up"
              onClick={() => openActiveConciergeTask("follow_up")}
              className="vyva-tap min-h-[42px] rounded-full bg-[#ECFDF5] px-3 font-body text-[12px] font-black text-[#047857] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
            >
              {t("home.conciergeResume.followUp", "Follow up")}
            </button>
            <button
              type="button"
              data-testid="button-home-concierge-got-reply"
              onClick={() => openActiveConciergeTask("reply")}
              className="vyva-tap min-h-[42px] rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-vyva-purple transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
            >
              {t("home.conciergeResume.gotReply", "I got a reply")}
            </button>
          </>
        ) : null}
      </div>
    </div>
  ) : null;
  const conciergeReuseNudge = reusableConciergeHomeTask && reusableConciergeReceipt ? (
    <div
      data-testid="card-home-concierge-reuse"
      className="w-full min-w-0 rounded-[22px] border border-[#DDD6FE] bg-[linear-gradient(135deg,#FFFFFF_0%,#FBF8FF_100%)] p-3 text-left shadow-[0_12px_28px_rgba(107,33,168,0.07)] min-[390px]:p-4"
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F5F3FF] text-vyva-purple min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <PackageCheck size={24} strokeWidth={2.55} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-vyva-purple">
            {t("home.conciergeReuse.kicker", "Useful again")}
          </span>
          <span
            className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 font-body text-[10px] font-black uppercase tracking-[0.08em] text-[#047857]"
            data-testid="badge-home-concierge-completed-state"
          >
            {conciergeCompletedCanvasLabel(language === "es")}
          </span>
          <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {t("home.conciergeReuse.title", "Use last {{task}} again", {
              task: conciergeCompletedHomeTaskLabel(reusableConciergeHomeTask, t),
            })}
          </span>
          <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
            {reusableConciergeReceipt.subjectValue}
          </span>
          <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#115E59]" data-testid="text-home-concierge-reuse-explanation">
            {conciergeCompletedCanvasCopy.stateExplanation}
          </span>
          <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-[#115E59]" data-testid="text-home-concierge-receipt-status">
            {t("home.conciergeReuse.receiptStatus", "Receipt: {{status}}", { status: reusableConciergeReceipt.statusLabel })}
          </span>
        </span>
      </div>

      {conciergeReceiptDetailsOpen ? (
        <div className="mt-3 rounded-[18px] border border-[#E9D5FF] bg-white px-3 py-2" data-testid="panel-home-concierge-receipt-details">
          <p className="font-body text-[12px] font-black text-vyva-text-1">
            {reusableConciergeReceipt.whatVyvaDid}
          </p>
          <p className="mt-1 font-body text-[12px] font-bold text-vyva-text-2">
            {reusableConciergeReceipt.nextStep}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reusableConciergeReceipt.details.slice(0, 3).map((detail) => (
              <span key={detail.key} className="rounded-full bg-[#F8F5FF] px-2 py-1 font-body text-[11px] font-black text-vyva-text-2">
                {detail.label}: {detail.value}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-testid="button-home-concierge-use-template"
          onClick={() => handleNavigate("/concierge", {
            state: {
              conciergeCompletedTemplate: conciergeCompletedHomeTemplate(reusableConciergeHomeTask),
            },
          })}
          className="vyva-tap inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-white px-3 font-body text-[12px] font-black text-vyva-purple shadow-[0_8px_18px_rgba(107,33,168,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {t("home.conciergeReuse.action", "Use template")}
          <ChevronRight size={16} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          data-testid="button-home-concierge-show-receipt"
          onClick={() => setConciergeReceiptDetailsOpen((open) => !open)}
          className="vyva-tap inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[#F5F3FF] px-3 font-body text-[12px] font-black text-vyva-purple transition-transform hover:-translate-y-0.5 min-[390px]:text-[13px]"
        >
          {conciergeReceiptDetailsOpen
            ? t("home.conciergeReuse.hideDetails", "Hide details")
            : t("home.conciergeReuse.showDetails", "Show details")}
          {conciergeReceiptDetailsOpen
            ? <ChevronUp size={16} strokeWidth={2.6} aria-hidden="true" />
            : <ChevronDown size={16} strokeWidth={2.6} aria-hidden="true" />}
        </button>
      </div>
    </div>
  ) : null;
  const latestPendingShowVyvaReview = showVyvaReviewHistory.find((item) => !item.actionSaved) ?? null;
  const showVyvaReviewNudge = latestPendingShowVyvaReview ? (
    <button
      type="button"
      data-testid="card-home-show-vyva-review-resume"
      onClick={() => handleNavigate(latestPendingShowVyvaReview.resumeRoute, {
        state: {
          showVyvaReviewHistoryId: latestPendingShowVyvaReview.id,
          showVyvaResume: true,
        },
      })}
      className="vyva-tap flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[#BFE7E1] bg-[linear-gradient(135deg,#F8FFFC_0%,#FFFFFF_58%,#F7FBFF_100%)] p-3 text-left shadow-[0_12px_28px_rgba(15,118,110,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:gap-4 min-[390px]:p-4"
      aria-label={`${t("home.showVyvaReviewResume.kicker", "Recent Show VYVA")}: ${latestPendingShowVyvaReview.decision}`}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F0FDFA] text-[#0F766E] min-[390px]:h-[54px] min-[390px]:w-[54px]">
        <ShieldCheck size={24} strokeWidth={2.45} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-[#0F766E]">
          {t("home.showVyvaReviewResume.kicker", "Recent Show VYVA")}
        </span>
        <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
          {t("home.showVyvaReviewResume.title", "Continue this review")}
        </span>
        <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
          {latestPendingShowVyvaReview.decision}
        </span>
        <span className="mt-1 block line-clamp-1 font-body text-[12px] font-bold leading-tight text-vyva-text-3">
          {latestPendingShowVyvaReview.summary}
        </span>
      </span>
      <span className="hidden flex-shrink-0 rounded-full bg-white px-3 py-2 font-body text-[12px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)] min-[390px]:inline-flex">
        {t("home.showVyvaReviewResume.action", "Open")}
      </span>
      <ChevronRight size={24} strokeWidth={2.6} className="flex-shrink-0 text-[#0F766E]" aria-hidden="true" />
    </button>
  ) : null;
  const recoveryAction = recoveryNudge
    ? homeMasterFastHelpActionById.get(recoveryNudge.journey.actionId)
    : null;
  const continueRecoveryNudge = () => {
    if (!recoveryNudge) return;
    if (recoveryNudge.kind !== "transport_provider") {
      continueHomeFastHelp(recoveryNudge.journey, undefined, true);
      return;
    }

    const resumed = resumeHomeFastHelpJourney(recoveryNudge.journey, homeFastHelpJourneyKey, {
      reason: "recovery_nudge",
      referenceId: HOME_FAST_HELP_RECOVERY_REFERENCE_ID,
    });
    const context = homeFastHelpContextForJourney(resumed, homeFastHelpJourneyKey);
    const destinationState = resumed.destinationState ?? resumedHomeFastHelpState(resumed.actionId) ?? {};
    const conciergePrefill = destinationState.conciergePrefill && typeof destinationState.conciergePrefill === "object"
      ? destinationState.conciergePrefill as Record<string, unknown>
      : {};
    const message = typeof conciergePrefill.message === "string"
      ? conciergePrefill.message
      : t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation.");
    handleNavigate("/onboarding/profile/providers", {
      state: {
        returnTo: "/concierge",
        returnState: withHomeFastHelpContextState(context, destinationState),
        setupFocus: "transport",
        setupFlow: CONCIERGE_FLOW_REFERENCES.transportBooking,
        setupReason: "Add a saved transport provider",
        conciergeResume: {
          kind: "transport",
          message,
          pickup: "",
          destination: "",
          time: "now",
          mobilityNeeds: [],
        },
        notice: t(
          "home.recoveryNudge.transportSetupNotice",
          "Save a trusted taxi or transport provider, then continue your ride.",
        ),
      },
    });
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const deferRecoveryNudge = () => {
    if (!recoveryNudge) return;
    markHomeFastHelpJourney(
      homeFastHelpContextForJourney(recoveryNudge.journey, homeFastHelpJourneyKey),
      "abandoned",
      { reason: "recovery_later" },
    );
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const dismissRecoveryNudge = () => {
    if (!recoveryNudge) return;
    markHomeFastHelpJourney(
      homeFastHelpContextForJourney(recoveryNudge.journey, homeFastHelpJourneyKey),
      "dismissed",
      { reason: "recovery_dismissed" },
    );
    setHomeFastHelpJourneys(readHomeFastHelpJourneys(homeFastHelpJourneyKey));
  };
  const fastHelpRecoveryNudge = recoveryNudge && recoveryAction ? (
    <div
      data-testid="card-home-fast-help-recovery"
      data-resume-kind={homeResumeCandidate?.kind}
      className="w-full min-w-0 rounded-[22px] border border-[#DDD6FE] bg-white p-3 shadow-[0_12px_28px_rgba(107,33,168,0.07)] min-[390px]:p-4"
    >
      <div className="flex min-w-0 items-center gap-3 min-[390px]:gap-4">
        <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#F5F3FF] text-vyva-purple min-[390px]:h-[54px] min-[390px]:w-[54px]">
          <History size={25} strokeWidth={2.45} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
            {recoveryNudge.kind === "transport_provider"
              ? t("home.recoveryNudge.transportSetupTitle", "One quick setup first")
              : recoveryNudge.kind === "blocked"
                ? t("home.recoveryNudge.blockedTitle", "One quick step first")
                : t("home.recoveryNudge.title", "Continue where you left off")}
          </span>
          <span className="mt-1 block font-body text-[13px] font-bold leading-snug text-vyva-text-2 min-[390px]:text-[14px]">
            {recoveryNudge.kind === "transport_provider"
              ? t("home.recoveryNudge.transportSetupDetail", "Add a trusted transport provider to continue your ride.")
              : recoveryNudge.kind === "blocked"
                ? t("home.recoveryNudge.blockedDetail", "Open {{action}} to see what is needed.", { action: recoveryAction.label })
                : t("home.recoveryNudge.detail", "Continue {{action}} when you are ready.", { action: recoveryAction.label })}
          </span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-continue"
          onClick={continueRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full bg-vyva-purple px-2 font-body text-[12px] font-black text-white shadow-[0_8px_18px_rgba(107,33,168,0.14)] min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.continue", "Continue")}
        </button>
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-later"
          onClick={deferRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full border border-[#DDD6FE] bg-[#F8F6FF] px-2 font-body text-[12px] font-black text-vyva-purple min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.later", "Later")}
        </button>
        <button
          type="button"
          data-testid="button-home-fast-help-recovery-dismiss"
          onClick={dismissRecoveryNudge}
          className="vyva-tap min-h-[44px] rounded-full border border-[#E9E3DE] bg-white px-2 font-body text-[12px] font-black text-vyva-text-2 min-[390px]:text-[13px]"
        >
          {t("home.recoveryNudge.dismiss", "Dismiss")}
        </button>
      </div>
    </div>
  ) : null;
  // Home master design: latest VYVA wordmark header, greeting, dormant voice orb, four app-mode
  // shortcuts, and no extra Fast Help/nudge blocks on the landing screen.
  return (
    <MasterDashboardLayout
      testId="home-master-layout"
      cardGridTestId="home-pillar-cards"
      fastHelpTestId="home-fast-help"
      launcherVariant="homeMaster"
      isDarkMode={isHomeMasterDark}
      cardSectionTitle={homeMasterCardSectionTitle}
      cardSectionDescription={homeMasterCardSectionDescription}
      cardSectionBackLabel={t("home.master.intentBack", "Back")}
      onCardSectionBack={homeIntentLayer === "health" ? () => setHomeIntentLayer("home") : undefined}
      cardSectionMoreLabel={homeIntentLayer === "health" ? t("home.master.healthIntent.more", "More health options") : undefined}
      onCardSectionMore={homeIntentLayer === "health" ? () => openHealthPath("/health") : undefined}
      cardSectionMoreTestId={homeIntentLayer === "health" ? "button-home-health-more" : undefined}
      fastHelpTitle={t("home.fastHelp.kicker", "Fast help")}
      hero={{
        icon: MessageCircle,
        eyebrow: t("home.master.heroEyebrow", "Today"),
        title: homeMasterGreetingText,
        subtitle: homeMasterHeroSubtitle,
        action: {
          kind: "voice",
          label: t("home.mode.voiceCta", "Talk to VYVA"),
          supportingLabel: t("home.master.voiceSupport", "Tell VYVA what you need."),
          contextHint: t("home.master.voiceContext", "Home screen. Ask what the user needs and help them choose the safest next step."),
          voiceAgentSlug: "main-vyva",
          voiceDynamicVariables: { app_entrypoint: "home_master_hero" },
          autoStartListening: true,
          testId: "button-home-hero-talk",
        },
        testId: "home-master-hero",
        tone: {
          iconBg: "#F5F3FF",
          iconColor: "#6B21A8",
          border: "#DDD6FE",
          surface: "#FFFFFF",
        },
      }}
      cards={homeMasterVisibleCards}
      fastHelpActions={homeMasterFastHelpActionsWithStatus}
      beforeFastHelp={null}
    />
  );
};

export default HomeScreen;
