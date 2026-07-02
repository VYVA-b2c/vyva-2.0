import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Brain, Heart, Users, ConciergeBell, Stethoscope, Calendar, Car, PhoneCall, Mail, Mic, ShieldCheck, ClipboardCheck, MessageCircle, Sparkles, type LucideIcon } from "lucide-react";
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
import { incrementChatNavigationCount } from "@/lib/personaliseCards";

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
    if (path === "/chat") incrementChatNavigationCount();
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
      title: t("home.master.cards.health", "Health Plan"),
      detail: t("home.master.cards.healthDetailShort", ""),
      tone: { iconBg: "#FFF1F2", iconColor: "#E74C43", border: "#FECACA", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/health"),
      testId: "card-home-agent-health",
    },
    {
      id: "mind-memory",
      icon: Brain,
      title: t("home.master.cards.mindMemory", "Mind & Memory"),
      detail: t("home.master.cards.mindMemoryDetailShort", ""),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/mind-memory"),
      testId: "card-home-agent-cognitive",
    },
    {
      id: "community",
      icon: Users,
      title: t("home.master.cards.community", "Community"),
      detail: t("home.master.cards.communityDetailShort", ""),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/social-rooms"),
      testId: "card-home-agent-social",
    },
    {
      id: "concierge",
      icon: ConciergeBell,
      title: t("home.master.cards.concierge", "Concierge"),
      detail: t("home.master.cards.conciergeDetailShort", ""),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0", surface: "#FFFFFF" },
      onClick: () => handleNavigate("/concierge"),
      testId: "card-home-agent-concierge",
    },
  ];

  const homeMasterFastHelpActions: MasterFastHelpAction[] = [
    {
      id: "ask-vyva",
      icon: Mic,
      label: t("home.master.fastHelp.askVyva", "Ask VYVA"),
      detail: t("home.master.fastHelp.askVyvaDetail", "Talk through anything"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => handleNavigate("/chat", SECTION_VOICE_AUTO_START_OPTIONS),
      testId: "button-home-fast-ask-vyva",
    },
    {
      id: "review-today",
      icon: ClipboardCheck,
      label: t("home.master.fastHelp.reviewToday", "Review today"),
      detail: t("home.master.fastHelp.reviewTodayDetail", "Open your plan"),
      tone: { iconBg: "#FFF7ED", iconColor: "#B45309", border: "#FED7AA" },
      onClick: () => handleNavigate("/health"),
      testId: "button-home-fast-review-today",
    },
    {
      id: "mind-check",
      icon: Brain,
      label: t("home.master.fastHelp.mindCheck", "Mind check"),
      detail: t("home.master.fastHelp.mindCheckDetail", "Memory or mood"),
      tone: { iconBg: "#F5F3FF", iconColor: "#6B21A8", border: "#DDD6FE" },
      onClick: () => handleNavigate("/mind-memory"),
      testId: "button-home-fast-mind-check",
    },
    {
      id: "join-community",
      icon: Users,
      label: t("home.master.fastHelp.joinCommunity", "Join community"),
      detail: t("home.master.fastHelp.joinCommunityDetail", "Rooms and activities"),
      tone: { iconBg: "#EFF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => handleNavigate("/social-rooms"),
      testId: "button-home-fast-join-community",
    },
    {
      id: "concierge-help",
      icon: ConciergeBell,
      label: t("home.master.fastHelp.conciergeHelp", "Concierge help"),
      detail: t("home.master.fastHelp.conciergeHelpDetail", "Errands or booking"),
      tone: { iconBg: "#ECFDF5", iconColor: "#047857", border: "#BBF7D0" },
      onClick: () => handleNavigate("/concierge"),
      testId: "button-home-fast-concierge-help",
    },
    {
      id: "call-doctor",
      icon: Stethoscope,
      label: t("home.master.fastHelp.callDoctor", "Call doctor"),
      detail: t("home.master.fastHelp.callDoctorDetail", "Prepare next step"),
      tone: { iconBg: "#EEF6FF", iconColor: "#2563EB", border: "#BFDBFE" },
      onClick: () => handleNavigate("/health/doctor", {
        state: {
          autoStartVoice: true,
          latestSymptomReport: homeDoctorContext,
        },
      }),
      testId: "button-home-fast-call-doctor",
    },
    {
      id: "safety-help",
      icon: ShieldCheck,
      label: t("home.master.fastHelp.safetyHelp", "Safety help"),
      detail: t("home.master.fastHelp.safetyHelpDetail", "Home or scam worry"),
      tone: { iconBg: "#FEF2F2", iconColor: "#B91C1C", border: "#FECACA" },
      onClick: () => handleNavigate("/safe-home"),
      testId: "button-home-fast-safety-help",
      pinned: true,
    },
  ];

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
          label: t("home.mode.voiceCta", "Talk to VYVA"),
          onClick: () => handleNavigate("/chat", SECTION_VOICE_AUTO_START_OPTIONS),
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
    >
      <button
        type="button"
        data-testid="home-start-nudge"
        aria-label={t("home.nudge.aria", "Ask VYVA where to start")}
        onClick={() => handleNavigate("/chat")}
        className="vyva-tap mt-4 flex min-h-[58px] w-full items-center gap-3 rounded-[22px] border border-[#E4D7F4] bg-white px-4 text-left shadow-[0_12px_28px_rgba(107,33,168,0.08)] transition-transform active:scale-[0.99]"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#F3E8FF] text-[#6B21A8]">
          <Sparkles size={22} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1 font-body text-[16px] font-black leading-tight text-vyva-text-1">
          {t("home.nudge.text", "Not sure where to start?")}
        </span>
        <span className="shrink-0 rounded-full bg-[#6B21A8] px-3 py-2 font-body text-[13px] font-black text-white">
          {t("home.nudge.action", "Ask VYVA")}
        </span>
      </button>
    </MasterDashboardLayout>
  );
};

export default HomeScreen;
