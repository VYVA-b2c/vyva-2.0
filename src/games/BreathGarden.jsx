import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Droplets,
  Flower2,
  Info,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { apiFetch } from "@/lib/queryClient";
import { GARDEN_THEMES, getBreathGardenTheme, isBreathGardenTheme } from "./shared/breathGardenThemes";
import BrainGameCompletionDialog from "./shared/BrainGameCompletionDialog";
import { getBrainCoachMilestoneJourney } from "./shared/brainCoachProgression";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#5B4A61",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  softGold: "#FFF7ED",
  teal: "#0F766E",
};

const DEFAULT_STATE = {
  total_sessions: 0,
  streak_days: 0,
  last_streak_date: null,
  last_played_at: null,
  preferred_theme: "garden",
};

const BREATH_GARDEN_TUTORIAL_KEY = "breathGarden:tutorialSeen:v1";

function tutorialStorageKey(userId) {
  return userId ? `${BREATH_GARDEN_TUTORIAL_KEY}:${userId}` : BREATH_GARDEN_TUTORIAL_KEY;
}

function readBreathGardenTutorialSeen(userId) {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeBreathGardenTutorialSeen(userId) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(tutorialStorageKey(userId), "true");
  } catch {
    // Local tutorial persistence is a convenience; the game should still work.
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getDefaultBreathGardenUserState(userId) {
  return {
    user_id: userId,
    ...DEFAULT_STATE,
    updated_at: new Date().toISOString(),
  };
}

export function getNextBreathGardenStateAfterSession(previousState, preferredTheme, now = new Date()) {
  const previous = previousState ?? DEFAULT_STATE;
  const today = todayKey(now);
  const yesterday = todayKey(addDays(now, -1));
  const lastStreakDate = previous.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Math.max(1, Number(previous.streak_days ?? 1))
      : lastStreakDate === yesterday
        ? Number(previous.streak_days ?? 0) + 1
        : 1;

  return {
    ...previous,
    total_sessions: Number(previous.total_sessions ?? 0) + 1,
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    preferred_theme: preferredTheme,
    updated_at: now.toISOString(),
  };
}

export function nextBreathTap(existingTaps, timestampMs) {
  return {
    timestamp_ms: Math.max(0, Math.round(timestampMs)),
    phase: existingTaps.length % 2 === 0 ? "inhale_peak" : "exhale_peak",
  };
}

export function cycleDurationsFromTaps(taps) {
  const lastByPhase = {};
  const durations = [];

  taps.forEach((tap) => {
    const previous = lastByPhase[tap.phase];
    if (typeof previous === "number") {
      durations.push((tap.timestamp_ms - previous) / 1000);
    }
    lastByPhase[tap.phase] = tap.timestamp_ms;
  });

  return durations.filter((duration) => Number.isFinite(duration) && duration >= 0);
}

export function computeBreathGardenMetrics(taps, sessionDurationSeconds = 0) {
  const durations = cycleDurationsFromTaps(taps);
  const avgBreathCycleSeconds = durations.length
    ? durations.reduce((total, duration) => total + duration, 0) / durations.length
    : null;

  const variance = avgBreathCycleSeconds === null
    ? null
    : durations.reduce((total, duration) => total + ((duration - avgBreathCycleSeconds) ** 2), 0) / Math.max(1, durations.length);
  const breathConsistencyIndex = variance === null
    ? null
    : clamp(100 - (variance * 10), 0, 100);
  const finalPaceBreathsPerMin = avgBreathCycleSeconds && avgBreathCycleSeconds > 0
    ? 60 / avgBreathCycleSeconds
    : null;

  return {
    sessionDurationSeconds: Math.max(0, Math.round(sessionDurationSeconds)),
    breathCycleCount: durations.length,
    avgBreathCycleSeconds,
    breathConsistencyIndex,
    finalPaceBreathsPerMin,
  };
}

export function bloomLevelForMetrics(metrics) {
  const avg = Number(metrics.avgBreathCycleSeconds ?? 0);
  const consistency = Number(metrics.breathConsistencyIndex ?? 0);
  let level = 1;
  if (avg >= 5) level = 2;
  if (avg >= 5 && consistency >= 50) level = 3;
  if (avg >= 8 && consistency >= 70) level = 4;
  if (avg >= 10 && consistency >= 85) level = 5;
  return level;
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function ThemeIcon({ themeId, size = 34 }) {
  if (themeId === "tide") return <Waves size={size} aria-hidden="true" />;
  if (themeId === "stars") return <Sparkles size={size} aria-hidden="true" />;
  if (themeId === "ripples") return <Droplets size={size} aria-hidden="true" />;
  return <Flower2 size={size} aria-hidden="true" />;
}

function GardenThemeChoice({ item, selected, label, onSelect }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      className="group relative min-h-[138px] overflow-hidden rounded-[22px] border bg-white text-left shadow-[0_10px_28px_rgba(54,35,78,0.065)] transition duration-200 hover:-translate-y-px hover:shadow-[0_14px_30px_rgba(54,35,78,0.10)] active:translate-y-0 active:scale-[0.995]"
      style={{
        borderColor: selected ? item.accent : "#E8E2EB",
        boxShadow: selected
          ? `0 0 0 1px ${item.accent}12, 0 14px 30px rgba(54,35,78,0.10)`
          : undefined,
      }}
    >
      <div
        className="absolute inset-x-2 top-2 h-[84px] overflow-hidden rounded-[17px]"
        style={{ filter: selected ? "saturate(0.9)" : "saturate(0.72)", opacity: selected ? 1 : 0.88 }}
        aria-hidden="true"
      >
        <GardenVisual themeId={item.id} bloomLevel={4} complete />
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white/20" />
      </div>

      {selected ? (
        <span
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border-2 border-white text-white shadow-[0_6px_16px_rgba(54,35,78,0.16)]"
          style={{ background: item.accent }}
          aria-hidden="true"
        >
          <Check size={15} strokeWidth={3} />
        </span>
      ) : null}

      <span className="absolute inset-x-0 bottom-0 flex h-[44px] items-center justify-center border-t border-[#F0EBF2] bg-white px-3 text-center">
        <span className="text-[16px] font-extrabold" style={{ color: item.accent }}>{label}</span>
      </span>
    </button>
  );
}

function GardenVisual({ themeId, bloomLevel, complete = false }) {
  const level = complete ? 5 : bloomLevel;
  const growth = level / 5;
  const theme = getBreathGardenTheme(themeId);

  if (themeId === "tide") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" role="img" aria-label="Calm tide visual">
        <rect width="420" height="280" rx="34" fill="#EFF6FF" />
        {[0, 1, 2, 3].map((wave) => (
          <path
            key={wave}
            d={`M${20 + wave * 4} ${122 + wave * 30} C 78 ${88 + wave * 28}, 132 ${160 + wave * 18}, 190 ${124 + wave * 30} S 310 ${110 + wave * 20}, 400 ${132 + wave * 24}`}
            fill="none"
            stroke={wave % 2 ? "#93C5FD" : theme.accent}
            strokeLinecap="round"
            strokeWidth={8 + growth * 4}
            opacity={0.28 + growth * 0.13 + wave * 0.04}
            style={{ transition: "all 700ms ease" }}
          />
        ))}
        <circle cx="328" cy="78" r={18 + growth * 16} fill="#FEF3C7" opacity="0.95" />
      </svg>
    );
  }

  if (themeId === "stars") {
    const stars = [
      [92, 94], [142, 138], [198, 86], [252, 140], [316, 96], [226, 196], [124, 210],
    ];
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" role="img" aria-label="Constellation visual">
        <rect width="420" height="280" rx="34" fill="#F8F5FF" />
        <path
          d="M92 94 L142 138 L198 86 L252 140 L316 96 M142 138 L226 196 L124 210"
          fill="none"
          stroke="#C4B5FD"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="420"
          strokeDashoffset={420 - growth * 420}
          opacity="0.9"
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        {stars.map(([cx, cy], index) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r={6 + Math.max(0, growth - index * 0.08) * 10}
            fill={index % 2 ? "#F59E0B" : theme.accent}
            opacity={0.45 + growth * 0.5}
            style={{ transition: "all 700ms ease" }}
          />
        ))}
      </svg>
    );
  }

  if (themeId === "ripples") {
    return (
      <svg viewBox="0 0 420 280" className="h-full w-full" role="img" aria-label="Water ripples visual">
        <rect width="420" height="280" rx="34" fill="#ECFEFF" />
        {[0, 1, 2, 3, 4].map((ring) => (
          <circle
            key={ring}
            cx="210"
            cy="140"
            r={30 + ring * 25 + growth * 18}
            fill="none"
            stroke={ring % 2 ? "#99F6E4" : theme.accent}
            strokeWidth={5 - ring * 0.4}
            opacity={0.16 + growth * 0.12}
            style={{ transition: "all 700ms ease" }}
          />
        ))}
        <circle cx="210" cy="140" r={16 + growth * 12} fill={theme.accent} opacity="0.72" />
      </svg>
    );
  }

  const flowerScale = 0.72 + growth * 0.42;
  return (
    <svg viewBox="0 0 420 280" className="h-full w-full" role="img" aria-label="Blooming garden visual">
      <rect width="420" height="280" rx="34" fill="#F0FDF4" />
      <path d="M72 238 C130 216, 286 218, 354 236" fill="none" stroke="#BBF7D0" strokeWidth="18" strokeLinecap="round" opacity="0.85" />
      {[105, 165, 230, 295].map((x, index) => {
        const stemHeight = 52 + growth * (70 + index * 6);
        const cy = 222 - stemHeight;
        return (
          <g key={x} style={{ transition: "all 700ms ease" }}>
            <path d={`M${x} 226 C ${x - 12} ${204 - growth * 20}, ${x + 18} ${190 - growth * 28}, ${x} ${cy}`} fill="none" stroke="#0F766E" strokeWidth="7" strokeLinecap="round" />
            <ellipse cx={x - 20} cy={198 - growth * 22} rx={18 * growth + 4} ry={8 * growth + 3} fill="#86EFAC" opacity="0.82" transform={`rotate(-28 ${x - 20} ${198 - growth * 22})`} />
            <ellipse cx={x + 22} cy={188 - growth * 26} rx={16 * growth + 4} ry={8 * growth + 3} fill="#A7F3D0" opacity="0.82" transform={`rotate(24 ${x + 22} ${188 - growth * 26})`} />
            <g transform={`translate(${x} ${cy}) scale(${flowerScale})`}>
              {[0, 72, 144, 216, 288].map((angle) => (
                <ellipse
                  key={angle}
                  cx="0"
                  cy="-18"
                  rx={10 + growth * 4}
                  ry={22 + growth * 7}
                  fill={index % 2 ? "#F59E0B" : "#C084FC"}
                  opacity={0.42 + growth * 0.5}
                  transform={`rotate(${angle})`}
                />
              ))}
              <circle cx="0" cy="0" r={9 + growth * 4} fill="#7C2D12" opacity="0.8" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}

function TutorialGardenVisual({ themeId, theme, inLabel, outLabel, growLabel }) {
  return (
    <div className="relative mx-auto h-[190px] w-full max-w-[600px] overflow-hidden rounded-[24px] border border-black/[0.04] bg-white shadow-[0_14px_36px_rgba(54,35,78,0.08)] sm:h-[220px]">
      <GardenVisual themeId={themeId} bloomLevel={4} complete />
      <div className="absolute inset-0 bg-gradient-to-t from-[#241C30]/30 via-transparent to-white/10" aria-hidden="true" />

      <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 sm:gap-3">
        <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-[14px] font-black shadow-[0_8px_24px_rgba(54,35,78,0.12)] sm:text-[15px]" style={{ color: theme.accent }}>
          <Waves size={18} aria-hidden="true" />
          {inLabel}
        </div>
        <span className="h-px min-w-5 flex-1 bg-white/80 sm:max-w-12" aria-hidden="true" />
        <div className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-[14px] font-black shadow-[0_8px_24px_rgba(54,35,78,0.12)] sm:text-[15px]" style={{ color: theme.accent }}>
          <Droplets size={18} aria-hidden="true" />
          {outLabel}
        </div>
        <span className="hidden h-px w-8 bg-white/80 sm:block" aria-hidden="true" />
        <div className="hidden min-h-10 items-center gap-2 rounded-full bg-white/95 px-4 text-[15px] font-black shadow-[0_8px_24px_rgba(54,35,78,0.12)] sm:inline-flex" style={{ color: theme.accent }}>
          <Flower2 size={18} aria-hidden="true" />
          {growLabel}
        </div>
      </div>
    </div>
  );
}

function safeRound(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export default function BreathGarden({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [theme, setTheme] = useState("garden");
  const [userState, setUserState] = useState(null);
  const [breathTaps, setBreathTaps] = useState([]);
  const [bloomLevel, setBloomLevel] = useState(1);
  const [saving, setSaving] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [encouragement, setEncouragement] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [finalMetrics, setFinalMetrics] = useState(null);
  const [tutorialSeen, setTutorialSeen] = useState(() => readBreathGardenTutorialSeen(userId));
  const [tutorialReturnScreen, setTutorialReturnScreen] = useState("intro");

  const sessionStartRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const audioRef = useRef({ ctx: null, oscillator: null, gain: null });
  const screenRef = useLatestRef(screen);
  const breathTapsRef = useLatestRef(breathTaps);
  const bloomLevelRef = useLatestRef(bloomLevel);
  const themeRef = useLatestRef(theme);

  const selectedTheme = getBreathGardenTheme(theme);
  const encouragements = useMemo(() => [
    t("games.breathGarden.gentleEncouragement.one", "Very good"),
    t("games.breathGarden.gentleEncouragement.two", "Keep going"),
    t("games.breathGarden.gentleEncouragement.three", "Breathe calmly"),
    t("games.breathGarden.gentleEncouragement.four", "That's it"),
  ], [t]);

  const loadState = useCallback(async () => {
    const hasSeenTutorial = readBreathGardenTutorialSeen(userId);
    setTutorialSeen(hasSeenTutorial);

    if (!userId) {
      const fallback = getDefaultBreathGardenUserState("local");
      setUserState(fallback);
      setTheme(fallback.preferred_theme);
      setScreen("theme");
      return;
    }

    const response = await apiFetch("/api/games/breath-garden/state");
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error ?? t("games.breathGarden.stateUnavailable", "Breath Garden could not be prepared."));
    }

    const state = payload.state ?? getDefaultBreathGardenUserState(userId);
    const preferredTheme = isBreathGardenTheme(state.preferred_theme) ? state.preferred_theme : "garden";
    setUserState(state);
    setTheme(preferredTheme);
    setTutorialReturnScreen("intro");
    setScreen(Number(state.total_sessions ?? 0) > 0 ? (hasSeenTutorial ? "intro" : "tutorial") : "theme");
  }, [t, userId]);

  useEffect(() => {
    setScreen("loading");
    void loadState().catch((error) => {
      console.warn("Breath Garden could not load.", error);
      const fallback = getDefaultBreathGardenUserState(userId || "local");
      setUserState(fallback);
      setTheme("garden");
      setScreen("theme");
    });
  }, [loadState, userId]);

  const stopAmbientTone = useCallback(() => {
    const current = audioRef.current;
    try {
      current.oscillator?.stop();
      current.oscillator?.disconnect();
      current.gain?.disconnect();
      void current.ctx?.close();
    } catch {
      // Audio cleanup can throw if the oscillator already stopped.
    }
    audioRef.current = { ctx: null, oscillator: null, gain: null };
  }, []);

  const startAmbientTone = useCallback(() => {
    if (audioRef.current.ctx || typeof window === "undefined") return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = themeRef.current === "stars" ? 174 : themeRef.current === "tide" ? 132 : 146;
    gain.gain.value = 0.018;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    audioRef.current = { ctx, oscillator, gain };
  }, [themeRef]);

  useEffect(() => {
    if (screen !== "playing" || !soundOn) {
      stopAmbientTone();
      return undefined;
    }
    startAmbientTone();
    return stopAmbientTone;
  }, [screen, soundOn, startAmbientTone, stopAmbientTone]);

  const startSession = () => {
    sessionStartRef.current = Date.now();
    sessionSavedRef.current = false;
    setBreathTaps([]);
    setBloomLevel(1);
    setEncouragement("");
    setSaveWarning("");
    setFinalMetrics(null);
    setScreen("playing");
  };

  const handleThemePick = (themeId) => {
    setTheme(themeId);
    setTutorialReturnScreen("intro");
    setScreen(tutorialSeen ? "intro" : "tutorial");
  };

  const closeTutorial = () => {
    writeBreathGardenTutorialSeen(userId);
    setTutorialSeen(true);
    setScreen(tutorialReturnScreen || "intro");
  };

  const openInstructions = () => {
    setTutorialReturnScreen("intro");
    setScreen("tutorial");
  };

  const handleTap = () => {
    if (screenRef.current !== "playing") return;
    const start = sessionStartRef.current ?? Date.now();
    const timestampMs = Date.now() - start;
    setBreathTaps((current) => {
      const next = [...current, nextBreathTap(current, timestampMs)];
      const metrics = computeBreathGardenMetrics(next, timestampMs / 1000);
      const nextBloom = Math.max(bloomLevelRef.current, bloomLevelForMetrics(metrics));
      setBloomLevel(nextBloom);

      if (metrics.breathCycleCount >= 3 && metrics.breathCycleCount % 2 === 1) {
        setEncouragement(encouragements[metrics.breathCycleCount % encouragements.length]);
      }

      return next;
    });
  };

  const buildResult = useCallback((completed, abandoned) => {
    const durationSeconds = sessionStartRef.current
      ? Math.max(0, Math.round((Date.now() - sessionStartRef.current) / 1000))
      : 0;
    const metrics = computeBreathGardenMetrics(breathTapsRef.current, durationSeconds);
    const result = {
      breathTaps: breathTapsRef.current,
      sessionDurationSeconds: metrics.sessionDurationSeconds,
      breathCycleCount: metrics.breathCycleCount,
      avgBreathCycleSeconds: safeRound(metrics.avgBreathCycleSeconds, 2),
      breathConsistencyIndex: safeRound(metrics.breathConsistencyIndex, 2),
      finalPaceBreathsPerMin: safeRound(metrics.finalPaceBreathsPerMin, 1),
      gardenTheme: themeRef.current,
      bloomLevelReached: bloomLevelRef.current,
      completed,
      abandoned,
      language: gameLanguage,
    };
    return { result, metrics };
  }, [bloomLevelRef, breathTapsRef, gameLanguage, themeRef]);

  const saveSession = useCallback(async ({ completed, abandoned }) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;
    const { result, metrics } = buildResult(completed, abandoned);
    setFinalMetrics(metrics);

    if (!userId) {
      if (completed) {
        setUserState((current) => getNextBreathGardenStateAfterSession(current ?? getDefaultBreathGardenUserState("local"), themeRef.current));
      }
      return null;
    }

    const response = await apiFetch("/api/games/breath-garden/sessions", {
      method: "POST",
      body: JSON.stringify(result),
    });
    const saved = await response.json().catch(() => ({}));

    if (!response.ok) {
      sessionSavedRef.current = false;
      throw new Error(saved?.error ?? "Breath Garden session could not be saved.");
    }

    if (saved.state) setUserState(saved.state);
    return saved.session ?? null;
  }, [buildResult, themeRef, userId]);

  const completeSession = async () => {
    setSaving(true);
    setSaveWarning("");
    try {
      await saveSession({ completed: true, abandoned: false });
      onAssessmentPracticeComplete?.({
        practiceTitle: assessmentPractice?.practiceTitle,
        bloomLevel,
      });
    } catch (error) {
      console.warn("Breath Garden could not save the completed session.", error);
      setSaveWarning(t("games.breathGarden.saveWarning", "Your garden is shown here, but saving may need to be retried."));
    } finally {
      setSaving(false);
      setSoundOn(false);
      setScreen("close");
    }
  };

  const exitGame = async () => {
    if (screenRef.current === "playing") {
      setSaving(true);
      try {
        await saveSession({ completed: false, abandoned: true });
      } catch (error) {
        console.warn("Breath Garden could not save the abandoned session.", error);
      } finally {
        setSaving(false);
        setSoundOn(false);
      }
    }
    onExit?.();
  };

  const closeMinutes = Math.max(1, Math.round((finalMetrics?.sessionDurationSeconds ?? 0) / 60));
  const milestoneJourney = getBrainCoachMilestoneJourney(userState?.streak_days ?? 1);
  const nextMilestoneValue = milestoneJourney.next
    ? `${milestoneJourney.next.label} (${milestoneJourney.next.count} days)`
    : t("brainCoach.progression.monthlyPracticeHeld", "Monthly practice held");

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.breathGarden.title", "Breath Garden")}
        label={t("games.breathGarden.preparing", "Preparing your garden...")}
        testId="breath-garden-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.breath_garden.loading.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.breath_garden"
      />
    );
  }

  return (
    <BrainCoachActivityShell
      title={t("games.breathGarden.title", "Breath Garden")}
      backLabel={t("common.exit", "Exit")}
      onBack={() => void exitGame()}
      showHeader={screen !== "close"}
      testId="breath-garden-flow-shell"
      presentationId={`brain_coach.activity_session.sharpen_senses.breath_garden.${screen}.touch`}
      sceneId="brain_coach.activity_session.sharpen_senses.breath_garden"
      sceneKind={screen === "close" ? "completion" : screen}
      sceneLayout={screen === "playing" ? "breathing_tap" : screen === "close" ? "modal_actions" : "activity_panel"}
      state={screen === "close" ? "complete" : "default"}
    >
      <div className="mx-auto w-full max-w-[780px]" style={{ color: BRAND.ink }}>
        {screen === "theme" ? (
          <section className="relative isolate overflow-hidden rounded-[28px] border bg-[linear-gradient(160deg,#FFFFFF_38%,#FCF9FD_100%)] p-5 text-center shadow-[0_18px_44px_rgba(54,35,78,0.09)] sm:p-6" style={{ borderColor: "#EEE8F1" }}>
            <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">{t("games.breathGarden.pickTheme", "Choose your garden")}</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
              {GARDEN_THEMES.map((item) => (
                <GardenThemeChoice
                  key={item.id}
                  item={item}
                  selected={theme === item.id}
                  label={t(item.labelKey)}
                  onSelect={() => handleThemePick(item.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {screen === "intro" ? (
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)] sm:p-6" style={{ borderColor: "#EEE8F1" }}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openInstructions}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border bg-white px-4 text-[14px] font-extrabold"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Info size={18} aria-hidden="true" />
                {t("games.breathGarden.instructions", "Instructions")}
              </button>
            </div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px]" style={{ background: selectedTheme.soft, color: selectedTheme.accent }}>
              <ThemeIcon themeId={theme} size={36} />
            </div>
            <h2 className="mt-4 font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] sm:text-[32px]">{t("games.breathGarden.title", "Breath Garden")}</h2>
            <p className="mx-auto mt-3 max-w-[560px] text-[17px] font-semibold leading-relaxed sm:text-[18px]" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.howItWorks", "Tap once as you breathe in, and once as you breathe out. There is no correct rhythm - just breathe your way.")}
            </p>
            <button
              type="button"
              onClick={startSession}
              className="mt-6 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-full px-6 text-[18px] font-extrabold text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <Play size={20} aria-hidden="true" />
              {t("common.start", "Start")}
            </button>
            <button
              type="button"
              onClick={() => setScreen("theme")}
              className="mt-2 min-h-11 rounded-full px-5 text-[15px] font-extrabold underline underline-offset-4"
              style={{ color: BRAND.purple }}
            >
              {t("games.breathGarden.changeTheme", "Change garden")}
            </button>
          </section>
        ) : null}

        {screen === "tutorial" ? (
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.09)] sm:p-7" style={{ borderColor: "#EEE8F1" }}>
            <h2 className="font-display text-[27px] font-semibold leading-tight tracking-[-0.03em] sm:text-[31px]">
              {t("games.breathGarden.tutorialSubtitle", "Tap gently as you breathe.")}
            </h2>
            <p className="mx-auto mt-2 max-w-[520px] text-[15px] font-semibold leading-relaxed sm:text-[16px]" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.howItWorks", "Tap once as you breathe in, and once as you breathe out. There is no correct rhythm - just breathe your way.")}
            </p>

            <div className="mt-5">
            <TutorialGardenVisual
              themeId={theme}
              theme={selectedTheme}
              inLabel={t("games.breathGarden.tutorialIn", "In")}
              outLabel={t("games.breathGarden.tutorialOut", "Out")}
              growLabel={t("games.breathGarden.tutorialGrow", "Garden grows")}
            />
            </div>

            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-[#F7F3F8] px-4 py-2 text-[13px] font-bold sm:text-[14px]" style={{ color: BRAND.muted }}>
              <Flower2 size={16} style={{ color: selectedTheme.accent }} aria-hidden="true" />
              {t("games.breathGarden.tutorialPace", "Go at your own pace. There is no right or wrong.")}
            </div>

            <button
              type="button"
              onClick={closeTutorial}
              className="mt-5 min-h-[56px] w-full rounded-full px-6 text-[18px] font-extrabold text-white shadow-vyva-card transition-transform active:scale-[0.99]"
              style={{ background: BRAND.purple }}
            >
              {t("common.continue", "Continue")}
            </button>
          </section>
        ) : null}

        {screen === "playing" ? (
          <section className="rounded-[28px] border bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.10)]" style={{ borderColor: "#EEE8F1" }}>
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSoundOn((current) => !current)}
                className="flex min-h-[64px] items-center justify-center rounded-full border bg-white px-5"
                style={{ borderColor: BRAND.border, color: soundOn ? selectedTheme.accent : BRAND.muted }}
                aria-label={soundOn ? t("games.breathGarden.muteSound", "Mute sound") : t("games.breathGarden.enableSound", "Enable sound")}
              >
                {soundOn ? <Volume2 size={27} aria-hidden="true" /> : <VolumeX size={27} aria-hidden="true" />}
              </button>
            </div>

            <div className="mx-auto mt-2 h-[330px] max-w-[620px] overflow-hidden rounded-[34px]">
              <GardenVisual themeId={theme} bloomLevel={bloomLevel} />
            </div>

            {encouragement ? (
              <p className="mt-5 text-[25px] font-black" style={{ color: selectedTheme.accent }} aria-live="polite">
                {encouragement}
              </p>
            ) : (
              <p className="mt-5 text-[25px] font-black" style={{ color: BRAND.muted }}>
                {t("games.breathGarden.tapPrompt", "Tap as you inhale... and exhale")}
              </p>
            )}

            <button
              type="button"
              onClick={handleTap}
              className="mt-4 flex min-h-[220px] w-full items-center justify-center rounded-[34px] border-2 px-6 text-[29px] font-black shadow-vyva-card transition-transform active:scale-[0.99]"
              style={{ borderColor: selectedTheme.accent, background: selectedTheme.soft, color: selectedTheme.accent }}
            >
              {t("games.breathGarden.tapPrompt", "Tap as you inhale... and exhale")}
            </button>

            <button
              type="button"
              onClick={() => void completeSession()}
              disabled={saving}
              className="mt-5 min-h-[64px] rounded-full px-5 text-[23px] font-extrabold underline underline-offset-4 disabled:opacity-50"
              style={{ color: BRAND.purple }}
            >
              {saving ? t("common.saving", "Saving...") : t("common.finish", "Finish")}
            </button>
          </section>
        ) : null}

        {screen === "close" ? (
          <BrainGameCompletionDialog
            title={t("games.breathGarden.closeTitle", "Today's garden")}
            summary={t("games.breathGarden.closeSummary", "You breathed calmly for {n} minutes.", { n: closeMinutes })}
            metrics={[
              { label: t("games.breathGarden.streak", "Streak"), value: t("games.breathGarden.streakLabel", "{n} days tending your garden", { n: userState?.streak_days ?? 1 }) },
              { label: t("brainCoach.progression.milestone", "Milestone"), value: milestoneJourney.current.label },
              { label: t("brainCoach.progression.nextMilestone", "Next milestone"), value: nextMilestoneValue },
            ]}
            details={saveWarning ? <p className="text-[15px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            continueLabel={t("common.finish", "Finish")}
            replayLabel={t("common.playAgain", "Play again")}
            assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
            assessmentReturnHint={
              assessmentPractice
                ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
                : undefined
            }
            onContinue={onExit}
            onReplay={() => {
              setSoundOn(false);
              setScreen("intro");
            }}
            onAssessmentReturn={assessmentPractice ? onAssessmentPracticeReturn : undefined}
            disabled={saving}
          />
        ) : null}
      </div>
    </BrainCoachActivityShell>
  );
}
