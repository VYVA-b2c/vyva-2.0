import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Brain, Heart, Users, ConciergeBell, Stethoscope, Calendar, Car, PhoneCall, Mail, Mic, ShieldCheck, MessageCircle, FileText, HeartHandshake, HeartPulse, ChevronRight, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import MasterDashboardLayout, {
  type MasterDashboardCard,
  type MasterFastHelpAction,
} from "@/components/MasterDashboardLayout";
import { ActionCard, ResponsiveGrid } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { serviceForPath, useServiceGate } from "@/hooks/useServiceGate";
import { displayFirstName } from "@/lib/displayIdentity";

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

type ConciergePendingHomeItem = {
  id?: string | null;
  use_case?: string | null;
  provider_name?: string | null;
  action_summary?: string | null;
  status?: "pending" | "calling" | "completed" | "failed" | "cancelled" | string | null;
  action_payload?: Record<string, unknown> | null;
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
  health: { title: "Health Plan", subtitle: "Care today" },
  cognitive: { title: "Mind & Memory", subtitle: "Memory and reflexes" },
  social: { title: "Community", subtitle: "Rooms and chats" },
  concierge: { title: "Concierge", subtitle: "Help and errands" },
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

function homeDueBadge(count: number, t: HomeTranslate) {
  return count === 1
    ? t("home.master.badges.oneDue", "1 due")
    : t("home.master.badges.due", "{{count}} due", { count });
}

function homeCountBadge(count: number, one: string, manyKey: string, manyFallback: string, t: HomeTranslate) {
  return count === 1 ? one : t(manyKey, manyFallback, { count });
}

function healthCardAccent(input: {
  checkin?: DailyCheckinHomeSignal | null;
  medication?: MedicationHomeSignal | null;
  prevention?: PreventionHomeSignal | null;
  vitals?: LatestVitalsHomeSignal | null;
}, t: HomeTranslate) {
  const status = input.vitals?.analysis?.recommended_action || input.vitals?.analysis?.safety_status || "";
  const alertSeverity = input.vitals?.latest_alert?.severity || "";
  const vitalsNeedsAttention = Boolean(
    (status && status !== "steady") ||
    (alertSeverity && alertSeverity !== "info"),
  );
  if (vitalsNeedsAttention) return t("home.master.badges.vitals", "Vitals");
  if (input.checkin?.status === "overdue") return t("home.master.badges.checkIn", "Check-in");

  const remaining = input.medication?.todaySummary?.remaining ?? 0;
  if (remaining > 0) return homeDueBadge(remaining, t);

  if (input.checkin?.status === "due_now") return t("home.master.badges.checkIn", "Check-in");
  const focus = input.prevention?.focus;
  if (focus && focus !== "Plan") return focus;
  if ((input.medication?.todaySummary?.scheduled ?? 0) > 0) return t("home.master.badges.allSet", "All set");
  return t("home.master.badges.today", "Today");
}

function mindMemoryCardAccent(progress: BrainCoachHomeSignal | null | undefined, t: HomeTranslate) {
  if ((progress?.today?.completedCount ?? 0) > 0) return t("home.master.badges.done", "Done");
  const streakDays = progress?.summary?.streakDays ?? 0;
  if (streakDays > 1) {
    return homeCountBadge(
      streakDays,
      t("home.master.badges.oneDay", "1 day"),
      "home.master.badges.streakDays",
      "{{count}} days",
      t,
    );
  }
  return t("home.master.badges.fiveMin", "5 min");
}

function communityCardAccent(pulse: ParticipationPulseHomeSignal | null | undefined, t: HomeTranslate) {
  const notifications = pulse?.pulse?.notifications?.length ?? 0;
  if (notifications > 0) return t("home.master.badges.new", "New");
  const saved = pulse?.pulse?.savedEvents?.length ?? 0;
  if (saved > 0) {
    return homeCountBadge(
      saved,
      t("home.master.badges.saved", "Saved"),
      "home.master.badges.savedCount",
      "{{count}} saved",
      t,
    );
  }
  const format = pulse?.pulse?.featuredEvent?.format;
  if (format === "online") return t("home.master.badges.online", "Online");
  if (format === "nearby" || format === "hybrid") return t("home.master.badges.nearby", "Nearby");
  if (pulse?.pulse?.emptyProfileNudge) return t("home.master.badges.interests", "Interests");
  return t("home.master.badges.join", "Join");
}

function conciergeCardAccent(pending: ConciergePendingHomeSignal | null | undefined, t: HomeTranslate) {
  const count = pending?.items?.length ?? 0;
  if (count > 0) {
    return homeCountBadge(
      count,
      t("home.master.badges.oneTask", "1 task"),
      "home.master.badges.tasks",
      "{{count}} tasks",
      t,
    );
  }
  return t("home.master.badges.help", "Help");
}

function conciergeHomeItems(pending: ConciergePendingHomeSignal | null | undefined) {
  return pending?.items?.filter((item) => item?.id && item.status !== "completed" && item.status !== "cancelled") ?? [];
}

function conciergeHomeTaskLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  switch (item.use_case) {
    case "book_ride":
      return t("home.conciergeResume.task.ride", "ride");
    case "book_appointment":
      return t("home.conciergeResume.task.appointment", "appointment");
    case "order_medicine":
      return t("home.conciergeResume.task.pharmacy", "pharmacy request");
    case "home_service":
      return t("home.conciergeResume.task.homeService", "home service");
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

function conciergeHomeStepLabel(item: ConciergePendingHomeItem, t: HomeTranslate) {
  const missionStatus = conciergeHomePayloadString(item, ["mission_status", "status", "current_step"]).toLowerCase();
  if (item.status === "calling") return t("home.conciergeResume.step.contacting", "Contacting provider");
  if (missionStatus.includes("awaiting_provider")) return t("home.conciergeResume.step.waiting", "Waiting for reply");
  if (missionStatus.includes("form")) return t("home.conciergeResume.step.form", "Preparing form");
  if (missionStatus.includes("save") || missionStatus.includes("booked")) return t("home.conciergeResume.step.save", "Ready to save");
  if (item.status === "failed") return t("home.conciergeResume.step.attention", "Needs your review");
  return t("home.conciergeResume.step.confirm", "Waiting for your confirmation");
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
  const { t, i18n } = useTranslation();
  const { firstName: profileFirstName, profile } = useProfile();
  const [fastHelpStartIndex, setFastHelpStartIndex] = useState(0);

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
  const participationLanguage = baseLanguageCode(i18n?.language);

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

  const handleNavigate = (path: string, options?: NavigateOptions) => {
    guardPath(path, options);
  };

  const handleAgentCardOpen = (card: HomeAgentCard) => {
    if (card.id === "health") {
      handleNavigate(card.path);
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

  const homeMasterCardAccents = useMemo(() => ({
    health: healthCardAccent({
      checkin: checkinHomeSignal,
      medication: medicationHomeSignal,
      prevention: preventionHomeSignal,
      vitals: latestVitalsHomeSignal,
    }, t),
    mindMemory: mindMemoryCardAccent(brainCoachHomeSignal, t),
    community: communityCardAccent(participationPulseHomeSignal, t),
    concierge: conciergeCardAccent(conciergePendingHomeSignal, t),
  }), [
    brainCoachHomeSignal,
    checkinHomeSignal,
    conciergePendingHomeSignal,
    latestVitalsHomeSignal,
    medicationHomeSignal,
    participationPulseHomeSignal,
    preventionHomeSignal,
    t,
  ]);

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
      title: t("home.master.cards.health", "My Health"),
      detail: t("home.master.cards.healthDetailShort", ""),
      accent: homeMasterCardAccents.health,
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/health"),
      testId: "card-home-agent-health",
    },
    {
      id: "mind-memory",
      icon: Brain,
      title: t("home.master.cards.mindMemory", "My Mind"),
      detail: t("home.master.cards.mindMemoryDetailShort", ""),
      accent: homeMasterCardAccents.mindMemory,
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/mind-memory"),
      testId: "card-home-agent-cognitive",
    },
    {
      id: "community",
      icon: Users,
      title: t("home.master.cards.community", "My Community"),
      detail: t("home.master.cards.communityDetailShort", ""),
      accent: homeMasterCardAccents.community,
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms"),
      testId: "card-home-agent-social",
    },
    {
      id: "concierge",
      icon: ConciergeBell,
      title: t("home.master.cards.concierge", "My Concierge"),
      detail: t("home.master.cards.conciergeDetailShort", ""),
      accent: homeMasterCardAccents.concierge,
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/concierge"),
      testId: "card-home-agent-concierge",
    },
  ];

  const homeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "feel-better",
      icon: HeartPulse,
      label: t("home.master.fastHelp.feelBetter", "Symptoms Check"),
      detail: t("home.master.fastHelp.feelBetterDetail", "Symptoms or worries"),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA" },
      onClick: () => handleNavigate("/health/symptom-check"),
      testId: "button-home-fast-feel-better",
    },
    {
      id: "stay-well",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.stayWell", "Age Well"),
      detail: t("home.master.fastHelp.stayWellDetail", "Prevention tips"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => handleNavigate("/health/prevention"),
      testId: "button-home-fast-stay-well",
    },
    {
      id: "find-care",
      icon: HeartHandshake,
      label: t("home.master.fastHelp.findCare", "Find Care"),
      detail: t("home.master.fastHelp.findCareDetail", "Support options"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => handleNavigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.findCarePrefill", "Help me find care or support options. Ask what kind of care I need and do not contact anyone without my confirmation."),
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
      onClick: () => handleNavigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "ride",
            message: t("home.fastHelp.ridePrefill", "Please help me find safe transport options. Ask for destination and timing, and do not book anything without my confirmation."),
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
      onClick: () => handleNavigate("/concierge", {
        state: {
          conciergePrefill: {
            kind: "task",
            message: t("home.master.fastHelp.paperworkHelpPrefill", "Help me with paperwork or a form. Prepare answers and stop before submitting so I can confirm."),
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
      onClick: () => handleNavigate("/safe-home"),
      testId: "button-home-fast-safe-home",
    },
  ];

  const activeConciergeHomeTask = conciergeHomeItems(conciergePendingHomeSignal)[0] ?? null;
  const activeConciergeTaskText = activeConciergeHomeTask ? conciergeHomeTaskLabel(activeConciergeHomeTask, t) : "";
  const conciergeHomeStepText = activeConciergeHomeTask ? conciergeHomeStepLabel(activeConciergeHomeTask, t) : "";
  const conciergeRightNowNudge = activeConciergeHomeTask ? (
    <button
      type="button"
      data-testid="card-home-concierge-resume"
      onClick={() => handleNavigate("/concierge", { state: { focusRightNow: true } })}
      className="vyva-tap flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-[#BBF7D0] bg-[linear-gradient(135deg,#F8FFFC_0%,#FFFFFF_52%,#F4FDF8_100%)] p-3 text-left shadow-[0_12px_28px_rgba(4,120,87,0.08)] transition-transform hover:-translate-y-0.5 min-[390px]:gap-4 min-[390px]:p-4"
      aria-label={`${t("home.conciergeResume.kicker", "Right now")}: ${t("home.conciergeResume.titlePrefix", "VYVA is working on your")} ${activeConciergeTaskText}. ${conciergeHomeStepText}`}
    >
      <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[17px] bg-[#ECFDF5] text-[#047857] min-[390px]:h-[54px] min-[390px]:w-[54px]">
        <ConciergeBell size={24} strokeWidth={2.55} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-body text-[11px] font-black uppercase tracking-[0.13em] text-[#047857]">
          {t("home.conciergeResume.kicker", "Right now")}
        </span>
        <span className="mt-0.5 block truncate font-body text-[16px] font-black leading-tight text-vyva-text-1 min-[390px]:text-[18px]">
          {t("home.conciergeResume.titlePrefix", "VYVA is working on your")} {activeConciergeTaskText}
        </span>
        <span className="mt-0.5 block truncate font-body text-[13px] font-bold leading-tight text-vyva-text-2 min-[390px]:text-[14px]">
          {conciergeHomeStepText}
        </span>
      </span>
      <span className="hidden flex-shrink-0 rounded-full bg-white px-3 py-2 font-body text-[12px] font-black text-[#047857] shadow-[0_8px_18px_rgba(4,120,87,0.08)] min-[390px]:inline-flex">
        {t("home.conciergeResume.open", "Open Right Now")}
      </span>
      <ChevronRight size={24} strokeWidth={2.6} className="flex-shrink-0 text-[#047857]" aria-hidden="true" />
    </button>
  ) : null;

  return (
    <MasterDashboardLayout
      testId="home-master-layout"
      cardGridTestId="home-pillar-cards"
      fastHelpTestId="home-fast-help"
      fastHelpTitle={t("home.fastHelp.kicker", "Fast help")}
      hero={{
        icon: MessageCircle,
        eyebrow: t("home.master.heroEyebrow", "Today"),
        title: greetingText,
        action: {
          kind: "voice",
          label: t("home.mode.voiceCta", "Talk to VYVA"),
          supportingLabel: t("home.master.voiceSupport", "Speak anytime"),
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
      cards={homeMasterCards}
      fastHelpActions={homeMasterFastHelpActions}
      beforeFastHelp={conciergeRightNowNudge}
    />
  );
};

export default HomeScreen;
