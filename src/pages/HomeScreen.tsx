import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { NavigateOptions } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Brain, Users, ConciergeBell, Lock, Stethoscope, Calendar, Car, PhoneCall, Mail, Activity, CheckCircle2, ChevronRight, Clock3, type LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import VoiceHero from "@/components/VoiceHero";
import { ActionCard, ResponsiveGrid, SectionTitle } from "@/components/vyva-ui";
import { useProfile } from "@/contexts/ProfileContext";
import { SECTION_VOICE_AUTO_START_KEY } from "@/hooks/useRouteVoiceAutoStart";
import { serviceForPath, useServiceGate } from "@/hooks/useServiceGate";
import { incrementChatNavigationCount } from "@/lib/personaliseCards";
import chairYogaImage from "@/assets/senior-activities/chair-yoga.jpg";
import ankleMobilityImage from "@/assets/senior-activities/ankle-mobility.jpg";
import chestOpenerImage from "@/assets/senior-activities/chest-opener.jpg";
import sitToStandImage from "@/assets/senior-activities/sit-to-stand.jpg";
import heelRaisesImage from "@/assets/senior-activities/heel-raises.jpg";
import sideStepsImage from "@/assets/senior-activities/side-steps.jpg";
import seatedStrengthImage from "@/assets/senior-activities/seated-strength.jpg";
import shoulderReleaseImage from "@/assets/senior-activities/shoulder-release.jpg";
import handBreathingImage from "@/assets/senior-activities/hand-breathing.jpg";
import calmBreathingImage from "@/assets/senior-activities/calm-breathing.jpg";

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
  href?: string;
};

type HomeRoutineComfort = "seated" | "supported" | "standing";

type HomeRoutineFeedback = "easy" | "justRight" | "tooMuch";

type HomeGentleExercisePreview = {
  id: string;
  titleKey: string;
  title: string;
  image: string;
};

type HomeGentleRoutine = {
  id: string;
  titleKey: string;
  title: string;
  subtitleKey: string;
  subtitle: string;
  exerciseIds: [string, string, string];
  comfortExerciseIds?: Partial<Record<HomeRoutineComfort, [string, string, string]>>;
  duration: number;
  accent: string;
  softBg: string;
  border: string;
};

type HomeActivitySummary = {
  entries?: Array<{
    activity_type: string;
    logged_at?: string;
  }>;
};

const COORDS_WEATHER_CACHE_KEY = "vyva_coords_weather_cache";
const COORDS_WEATHER_TTL_MS = 30 * 60 * 1000;
const ROUTINE_COMFORT_STORAGE_KEY = "vyva_activity_routine_comfort";
const ROUTINE_FEEDBACK_STORAGE_KEY = "vyva_activity_routine_feedback";

const HOME_GENTLE_EXERCISE_PREVIEWS: HomeGentleExercisePreview[] = [
  { id: "chair-yoga", titleKey: "activity.gentleExercises.chairYoga.title", title: "Chair yoga", image: chairYogaImage },
  { id: "chest-opener", titleKey: "activity.gentleExercises.chestOpener.title", title: "Chest opener", image: chestOpenerImage },
  { id: "ankle-mobility", titleKey: "activity.gentleExercises.ankleMobility.title", title: "Ankle mobility", image: ankleMobilityImage },
  { id: "sit-to-stand", titleKey: "activity.gentleExercises.sitToStand.title", title: "Sit-to-stand", image: sitToStandImage },
  { id: "heel-raises", titleKey: "activity.gentleExercises.heelRaises.title", title: "Heel raises", image: heelRaisesImage },
  { id: "side-steps", titleKey: "activity.gentleExercises.sideSteps.title", title: "Side steps", image: sideStepsImage },
  { id: "seated-strength", titleKey: "activity.gentleExercises.seatedStrength.title", title: "Seated strength", image: seatedStrengthImage },
  { id: "shoulder-release", titleKey: "activity.gentleExercises.shoulderRelease.title", title: "Shoulder release", image: shoulderReleaseImage },
  { id: "hand-breathing", titleKey: "activity.gentleExercises.handBreathing.title", title: "Hand breathing", image: handBreathingImage },
  { id: "calm-breathing", titleKey: "activity.gentleExercises.calmBreathing.title", title: "Calm breathing", image: calmBreathingImage },
];

const HOME_GENTLE_EXERCISE_BY_ID = new Map(HOME_GENTLE_EXERCISE_PREVIEWS.map((exercise) => [exercise.id, exercise]));

const HOME_GENTLE_ROUTINES: HomeGentleRoutine[] = [
  {
    id: "morning-mobility",
    titleKey: "activity.gentleRoutines.morningMobility.title",
    title: "Morning mobility",
    subtitleKey: "activity.gentleRoutines.morningMobility.subtitle",
    subtitle: "Loosen shoulders, chest, and ankles before the day gets going.",
    exerciseIds: ["chair-yoga", "chest-opener", "ankle-mobility"],
    duration: 10,
    accent: "#6B21A8",
    softBg: "#F5F3FF",
    border: "#D8B4FE",
  },
  {
    id: "steady-legs",
    titleKey: "activity.gentleRoutines.steadyLegs.title",
    title: "Steady legs",
    subtitleKey: "activity.gentleRoutines.steadyLegs.subtitle",
    subtitle: "Practice supported leg strength and balance in small steps.",
    exerciseIds: ["sit-to-stand", "heel-raises", "side-steps"],
    comfortExerciseIds: {
      seated: ["seated-strength", "heel-raises", "side-steps"],
      standing: ["sit-to-stand", "heel-raises", "side-steps"],
    },
    duration: 10,
    accent: "#33691E",
    softBg: "#EEF8DF",
    border: "#CFE8B8",
  },
  {
    id: "calm-reset",
    titleKey: "activity.gentleRoutines.calmReset.title",
    title: "Calm reset",
    subtitleKey: "activity.gentleRoutines.calmReset.subtitle",
    subtitle: "Release the shoulders, slow the breath, and finish softly.",
    exerciseIds: ["shoulder-release", "hand-breathing", "calm-breathing"],
    duration: 10,
    accent: "#2F66D0",
    softBg: "#EFF6FF",
    border: "#BFDBFE",
  },
];

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

function isRoutineComfort(value: string | null): value is HomeRoutineComfort {
  return value === "seated" || value === "supported" || value === "standing";
}

function readHomeRoutineComfort(): HomeRoutineComfort {
  try {
    const stored = window.localStorage.getItem(ROUTINE_COMFORT_STORAGE_KEY);
    return isRoutineComfort(stored) ? stored : "supported";
  } catch {
    return "supported";
  }
}

function readHomeRoutineFeedbackFeeling(): HomeRoutineFeedback | null {
  try {
    const raw = window.localStorage.getItem(ROUTINE_FEEDBACK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { feeling?: HomeRoutineFeedback };
    if (parsed.feeling === "easy" || parsed.feeling === "justRight" || parsed.feeling === "tooMuch") {
      return parsed.feeling;
    }
    return null;
  } catch {
    return null;
  }
}

function getHomeDailyGentleRoutine(date = new Date()): HomeGentleRoutine {
  const localDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayNumber = Math.floor(localDayStart / 86_400_000);
  return HOME_GENTLE_ROUTINES[dayNumber % HOME_GENTLE_ROUTINES.length];
}

function getHomeRoutineExercises(routine: HomeGentleRoutine, comfort: HomeRoutineComfort): HomeGentleExercisePreview[] {
  const exerciseIds = routine.comfortExerciseIds?.[comfort] ?? routine.exerciseIds;
  return exerciseIds
    .map((id) => HOME_GENTLE_EXERCISE_BY_ID.get(id))
    .filter((exercise): exercise is HomeGentleExercisePreview => Boolean(exercise));
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

  const firstName = profileFirstName || "";
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

  const { data: activitySummary } = useQuery<HomeActivitySummary>({
    queryKey: ["/api/activity"],
    staleTime: 0,
    refetchOnMount: true,
    retry: false,
  });

  const [coordsWeatherData, setCoordsWeatherData] = useState<WeatherData | null>(() => readCoordsWeatherCache());
  const [homeRoutineComfort] = useState<HomeRoutineComfort>(() => readHomeRoutineComfort());
  const [homeRoutineFeedback] = useState<HomeRoutineFeedback | null>(() => readHomeRoutineFeedbackFeeling());
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
  const homeGentleRoutine = getHomeDailyGentleRoutine();
  const homeGentleRoutineExercises = getHomeRoutineExercises(homeGentleRoutine, homeRoutineComfort);
  const gentleRoutineDoneToday = Boolean(activitySummary?.entries?.some((entry) => entry.activity_type === "GentleRoutine"));
  const homeRoutineComfortCopy = homeRoutineFeedback === "tooMuch"
    ? t("home.gentleRoutine.gentlerMode", "Gentler seated mode ready")
    : homeRoutineComfort === "seated"
      ? t("home.gentleRoutine.seatedMode", "Seated mode ready")
      : t("home.gentleRoutine.comfortHint", "Chair support is okay");

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
            ? t("home.fastHelp.ridePrefill", "Please help me arrange safe transport. Ask for destination and timing, and do not book anything without my confirmation.")
            : t("home.fastHelp.appointmentPrefill", "Please help me schedule an appointment. Ask what kind of appointment I need and do not book anything without my confirmation."),
          source: "home_quick_action",
        },
      },
    });
  };

  const handleHomeGentleRoutineOpen = () => {
    handleNavigate("/activity", {
      state: gentleRoutineDoneToday
        ? { highlightGentleRoutine: true, routineSource: "home" }
        : { startGentleRoutine: true, routineSource: "home" },
    });
  };

  const handleHomeGentleExerciseBrowse = () => {
    handleNavigate("/activity", {
      state: {
        scrollToGentleExercises: true,
        routineSource: "home",
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
          href: gpEmailHref,
        }]
      : []),
    ...HOME_FAST_ACTIONS.map((action) => ({
      ...action,
      label: t(`home.fastHelp.${action.id}.label`),
      sub: t(`home.fastHelp.${action.id}.sub`),
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
        voiceDynamicVariables={{ app_entrypoint: "home_open" }}
        onChatClick={() => handleNavigate("/chat")}
      />

      <section className="mt-[22px]" data-testid="home-gentle-routine-card">
        <SectionTitle
          className="mb-3"
          title={t("home.gentleRoutine.sectionTitle", "Today's movement")}
          titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
        />
        <div
          className="overflow-hidden rounded-[28px] border bg-[#FFFCF8] shadow-[0_18px_40px_rgba(60,38,20,0.09)]"
          style={{ borderColor: homeGentleRoutine.border }}
        >
          <div className="grid grid-cols-1 min-[760px]:grid-cols-[1fr_220px]">
            <div className="min-w-0 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-extrabold"
                  style={{ background: homeGentleRoutine.softBg, color: homeGentleRoutine.accent }}
                >
                  <Clock3 size={15} />
                  {homeGentleRoutine.duration} {t("activity.min", "min")}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-extrabold"
                  style={{
                    background: gentleRoutineDoneToday ? "#ECFDF5" : "#FFF7ED",
                    color: gentleRoutineDoneToday ? "#047857" : "#92400E",
                  }}
                >
                  {gentleRoutineDoneToday ? <CheckCircle2 size={15} /> : <Activity size={15} />}
                  {gentleRoutineDoneToday
                    ? t("home.gentleRoutine.done", "Well done today")
                    : t("activity.gentleRoutines.threeMoves", "3 gentle moves")}
                </span>
              </div>

              <h2 className="mt-3 font-display text-[31px] leading-tight text-vyva-text-1 [overflow-wrap:anywhere]">
                {t(homeGentleRoutine.titleKey, homeGentleRoutine.title)}
              </h2>
              <p className="mt-1 max-w-[520px] font-body text-[16px] font-semibold leading-snug text-vyva-text-2 [overflow-wrap:anywhere]">
                {gentleRoutineDoneToday
                  ? t("home.gentleRoutine.doneSub", "Your gentle routine is logged. Come back tomorrow for a fresh one.")
                  : t(homeGentleRoutine.subtitleKey, homeGentleRoutine.subtitle)}
              </p>

              <div className="mt-4 flex max-w-[420px] flex-col gap-2">
                <button
                  type="button"
                  data-testid="button-home-start-gentle-routine"
                  onClick={handleHomeGentleRoutineOpen}
                  className="vyva-tap flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] px-5 py-3 font-body text-[16px] font-extrabold text-white"
                  style={{
                    background: homeGentleRoutine.accent,
                    boxShadow: `0 12px 24px ${homeGentleRoutine.accent}30`,
                  }}
                >
                  {gentleRoutineDoneToday
                    ? t("home.gentleRoutine.viewActivity", "View activity")
                    : t("home.gentleRoutine.start", "Start")}
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  data-testid="button-home-browse-gentle-exercises"
                  onClick={handleHomeGentleExerciseBrowse}
                  className="vyva-tap flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] border bg-white px-5 py-3 font-body text-[15px] font-extrabold"
                  style={{
                    borderColor: homeGentleRoutine.border,
                    color: homeGentleRoutine.accent,
                  }}
                >
                  {t("home.gentleRoutine.browseExercises", "Browse all exercises")}
                  <ChevronRight size={18} />
                </button>
                <p
                  className="rounded-[16px] px-3 py-2 font-body text-[13px] font-black uppercase leading-snug [overflow-wrap:anywhere] min-[760px]:hidden"
                  style={{ background: homeGentleRoutine.softBg, color: homeGentleRoutine.accent }}
                >
                  {homeRoutineComfortCopy}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5" data-testid="home-gentle-routine-previews">
                {homeGentleRoutineExercises.map((exercise) => (
                  <div key={exercise.id} className="min-w-0" data-testid={`home-routine-preview-${exercise.id}`}>
                    <div className="aspect-square overflow-hidden rounded-[18px] bg-[#F5EFE4]">
                      <img src={exercise.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <p className="mt-1.5 truncate font-body text-[12px] font-extrabold text-vyva-text-1">
                      {t(exercise.titleKey, exercise.title)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="flex min-h-[130px] flex-col justify-start gap-3 border-t p-5 min-[760px]:border-l min-[760px]:border-t-0"
              style={{ background: homeGentleRoutine.softBg, borderColor: homeGentleRoutine.border }}
            >
              <div className="min-w-0">
                <p className="font-body text-[13px] font-black uppercase text-vyva-text-2">
                  {homeRoutineComfortCopy}
                </p>
                <p className="mt-1 font-body text-[15px] font-semibold leading-snug text-vyva-text-1">
                  {gentleRoutineDoneToday
                    ? t("home.gentleRoutine.doneHint", "Vyva saved this as 10 minutes of movement.")
                    : t("home.gentleRoutine.startHint", "Vyva will guide one move at a time.")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-[22px]">
        <SectionTitle
          className="mb-4"
          title={t("home.whatNow")}
          titleClassName="font-body text-[16px] font-semibold not-italic text-vyva-text-2"
        />
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
                title={t(`home.voiceCards.${card.id}.title`)}
                description={t(`home.voiceCards.${card.id}.subtitle`)}
                icon={Icon}
                iconBg={theme.iconBg}
                iconColor={theme.iconColor}
                size="standard"
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
            {t("home.fastHelp.title", "What do you need now?")}
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
                    {action.label}
                  </span>
                  <span className="mt-1 block max-w-[24rem] font-body text-[14px] font-semibold leading-snug text-vyva-text-2">
                    {action.sub}
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
