import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Brain, Heart, Users, ConciergeBell, Lock, Stethoscope, Calendar, Car, PhoneCall, Mail, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
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
  { id: "cognitive", icon: Brain, path: "/activities", theme: "purple" },
  { id: "social", icon: Users, path: "/social-rooms", theme: "blue" },
  { id: "concierge", icon: ConciergeBell, path: "/concierge", theme: "green" },
];

const HOME_FAST_ACTIONS: Array<Pick<HomeFastAction, "id" | "icon" | "tone">> = [
  { id: "doctor", icon: Stethoscope, tone: "doctor" },
  { id: "appointment", icon: Calendar, tone: "appointment" },
  { id: "ride", icon: Car, tone: "ride" },
];

const HOME_AGENT_MOBILE_COPY: Record<HomeAgentCard["id"], { title: string; subtitle: string }> = {
  health: { title: "Health", subtitle: "Symptoms and care" },
  cognitive: { title: "My Brain", subtitle: "Memory and focus" },
  social: { title: "Community", subtitle: "Rooms and chats" },
  concierge: { title: "Concierge", subtitle: "Help and errands" },
};

const HOME_FAST_ACTION_MOBILE_COPY: Record<"doctor" | "appointment" | "ride", { label: string; sub: string }> = {
  doctor: { label: "Doctor help", sub: "Talk through a concern" },
  appointment: { label: "Appointment", sub: "Prepare a request" },
  ride: { label: "Find transport", sub: "Compare safe options" },
};

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
  const { guardPath, readiness } = useServiceGate();
  const { t } = useTranslation();
  const { firstName: profileFirstName, profile } = useProfile();

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
    if (hour >= 17 && hour <= 20) return "evening";
    return "night";
  }, []);

  const greetingText = useMemo(() => {
    const period = timeGreetingKey;
    const SESSION_KEY = "home.greetingVariant";
    let variant = parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10);
    if (!variant || variant < 1 || variant > 5) {
      variant = Math.floor(Math.random() * 5) + 1;
      sessionStorage.setItem(SESSION_KEY, String(variant));
    }
    if (firstName) {
      return t(`home.greeting.${period}.withName.${variant}`, { name: firstName });
    }
    return t(`home.greeting.${period}.withoutName.${variant}`);
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

  const homeFastActions: HomeFastAction[] = [
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
  ];

  const isSubscriptionLocked = (path: string) => {
    const serviceId = serviceForPath(path);
    if (!serviceId) return false;
    const service = readiness?.services?.[serviceId];
    return Boolean(service && !service.ready && service.missing.some((step) => step.section === "subscription"));
  };

  return (
    <div className="vyva-page">
      <VoiceHero
        heroSurface="home"
        headline={
          <span className="block">{greetingText}</span>
        }
        weatherData={weatherData}
        contextHint="app_open"
        voiceAgentSlug="main-vyva"
        voiceDynamicVariables={{ app_entrypoint: "home_open" }}
        autoStartListening
        showVoiceOverlay
        talkLabel={t("home.mode.voiceCta", "Talk to VYVA")}
      />

      <div className="mt-[22px]">
        <ResponsiveGrid columns="two" gap="sm" className="min-[340px]:grid-cols-2">
          {HOME_AGENT_CARDS.map((card) => {
            const theme = HOME_AGENT_THEMES[card.theme];
            const Icon = card.icon;
            const locked = isSubscriptionLocked(card.path);
            return (
              <ActionCard
                key={card.id}
                data-testid={`card-home-agent-${card.id}`}
                aria-label={t(`home.voiceCards.${card.id}.micLabel`)}
                onClick={() => handleAgentCardOpen(card)}
                title={
                  <>
                    <span className="sm:hidden">
                      {t(`home.voiceCards.${card.id}.mobileTitle`, HOME_AGENT_MOBILE_COPY[card.id].title)}
                    </span>
                    <span className="hidden sm:inline">
                      {t(`home.voiceCards.${card.id}.title`)}
                    </span>
                  </>
                }
                description={
                  <>
                    <span className="sm:hidden">
                      {t(`home.voiceCards.${card.id}.mobileSubtitle`, HOME_AGENT_MOBILE_COPY[card.id].subtitle)}
                    </span>
                    <span className="hidden sm:inline">
                      {t(`home.voiceCards.${card.id}.subtitle`)}
                    </span>
                  </>
                }
                icon={Icon}
                iconBg={theme.iconBg}
                iconColor={theme.iconColor}
                size="standard"
                contentClassName="justify-start"
                locked={locked}
                style={{
                  borderColor: "#EDE2D1",
                  boxShadow: `0 16px 34px ${theme.glow}, 0 2px 10px rgba(43,31,24,0.05)`,
                }}
                badge={locked ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F4EAFE] px-2.5 py-1 font-body text-[11px] font-bold text-[#6B21A8]">
                    <Lock size={12} strokeWidth={2.5} />
                    Plan
                  </span>
                ) : null}
              />
            );
          })}
        </ResponsiveGrid>
      </div>

      <section
        className="mt-[18px] rounded-[28px] border border-[#EDE2D1] bg-[#FFFCF8] p-5 shadow-[0_14px_32px_rgba(60,38,20,0.07)]"
        data-testid="home-fast-help"
      >
        <div className="mb-4">
          <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-vyva-purple">
            {t("home.fastHelp.kicker", "Fast help")}
          </p>
          <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-vyva-text-1">
            <span className="sm:hidden">{t("home.fastHelp.titleMobile", "Need help now?")}</span>
            <span className="hidden sm:inline">{t("home.fastHelp.title", "What do you need now?")}</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {homeFastActions.map((action) => {
            const theme = HOME_FAST_ACTION_THEMES[action.tone];
            const Icon = action.icon;
            const content = (
              <>
                <span
                  className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[18px]"
                  style={{ background: theme.iconBg, color: theme.iconColor }}
                >
                  <Icon size={24} strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-[18px] font-black leading-tight text-vyva-text-1">
                    <span className="sm:hidden">{action.mobileLabel ?? action.label}</span>
                    <span className="hidden sm:inline">{action.label}</span>
                  </span>
                  <span className="mt-1 block max-w-[24rem] font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    <span className="sm:hidden">{action.mobileSub ?? action.sub}</span>
                    <span className="hidden sm:inline">{action.sub}</span>
                  </span>
                </span>
              </>
            );
            const className = "vyva-tap flex min-h-[86px] w-full items-center gap-4 rounded-[22px] border bg-white px-4 py-4 text-left transition-transform hover:-translate-y-0.5";
            const style = {
              borderColor: theme.border,
              boxShadow: `0 10px 24px ${theme.shadow}`,
            };

            if (action.href) {
              return (
                <a
                  key={action.id}
                  data-testid={`button-home-fast-${action.id}`}
                  href={action.href}
                  aria-label={action.label}
                  className={className}
                  style={style}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={action.id}
                type="button"
                data-testid={`button-home-fast-${action.id}`}
                aria-label={action.label}
                onClick={() => handleFastActionOpen(action)}
                className={className}
                style={style}
              >
                {content}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default HomeScreen;
