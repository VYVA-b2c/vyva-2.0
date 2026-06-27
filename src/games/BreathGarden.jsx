import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Droplets,
  Flower2,
  Info,
  Leaf,
  Loader2,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import vyvaLogo from "@/assets/vyva-logo.png";
import { apiFetch } from "@/lib/queryClient";
import { GARDEN_THEMES, getBreathGardenTheme, isBreathGardenTheme } from "./shared/breathGardenThemes";
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

function TutorialGardenVisual({ theme, inLabel, outLabel }) {
  return (
    <div className="relative mx-auto h-[210px] w-full max-w-[520px] overflow-hidden rounded-[28px] border sm:h-[260px] sm:rounded-[34px]" style={{ borderColor: theme.accent, background: theme.soft }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.95),rgba(255,255,255,0.3))]" />
      <div className="absolute left-1/2 top-1/2 h-[160px] w-[160px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[16px] border-white/85 shadow-vyva-card" style={{ background: theme.soft }} />
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: 190 + ring * 42,
            height: 190 + ring * 42,
            transform: "translate(-50%, -50%)",
            borderColor: ring % 2 ? "#FFFFFF" : theme.accent,
            opacity: ring === 0 ? 0.22 : 0.15,
          }}
        />
      ))}
      <div className="absolute left-[18%] top-[34%] rounded-full bg-white px-4 py-3 text-[19px] font-black shadow-vyva-card" style={{ color: theme.accent }}>
        <Waves size={24} className="mr-2 inline" aria-hidden="true" />
        {inLabel}
      </div>
      <div className="absolute right-[12%] top-[48%] rounded-full bg-white px-4 py-3 text-[19px] font-black shadow-vyva-card" style={{ color: theme.accent }}>
        {outLabel}
      </div>
      <div className="absolute bottom-[20px] left-1/2 flex -translate-x-1/2 items-end justify-center gap-2">
        {[26, 44, 64].map((height, index) => (
          <div key={height} className="flex flex-col items-center">
            <div className="w-2 rounded-full" style={{ height, background: theme.accent, opacity: 0.55 + index * 0.15 }} />
            <Flower2 size={26 + index * 6} style={{ color: theme.accent }} aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function safeRound(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

export default function BreathGarden({ userId, onExit }) {
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

  if (screen === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
        <section className="text-center">
          <Loader2 className="mx-auto h-14 w-14 animate-spin" style={{ color: BRAND.purple }} />
          <p className="mt-5 text-[26px] font-black">{t("games.breathGarden.preparing", "Preparing your garden...")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
      <div className="mx-auto w-full max-w-[780px]">
        <header className="flex items-center justify-between gap-4">
          <img src={vyvaLogo} alt="VYVA" className="h-12 w-12 rounded-2xl" />
          {screen !== "close" ? (
            <button
              type="button"
              onClick={() => void exitGame()}
              disabled={saving}
              className="inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 text-[22px] font-extrabold shadow-vyva-card disabled:opacity-50"
            >
              <ArrowLeft size={24} aria-hidden="true" />
              {t("common.exit", "Exit")}
            </button>
          ) : null}
        </header>

        {screen === "theme" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: BRAND.softGold, color: BRAND.gold }}>
              <Leaf size={54} aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{t("games.breathGarden.pickTheme", "Choose your garden")}</h1>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {GARDEN_THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleThemePick(item.id)}
                  className="min-h-[136px] rounded-[24px] border-2 p-4 text-center transition-transform active:scale-[0.98]"
                  style={{
                    borderColor: theme === item.id ? item.accent : "#E7D8F3",
                    background: item.soft,
                    color: item.accent,
                  }}
                >
                  <span className="mx-auto flex h-[56px] w-[56px] items-center justify-center rounded-[18px] bg-white/70">
                    <ThemeIcon themeId={item.id} />
                  </span>
                  <span className="mt-3 block text-[22px] font-black">{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
            <p className="mt-5 text-[22px] font-bold" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.canChangeAnytime", "You can change it anytime")}
            </p>
          </section>
        ) : null}

        {screen === "intro" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={openInstructions}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full border bg-white px-4 text-[18px] font-extrabold"
                style={{ borderColor: BRAND.border, color: BRAND.purple }}
              >
                <Info size={22} aria-hidden="true" />
                {t("games.breathGarden.instructions", "Instructions")}
              </button>
            </div>
            <div className="mx-auto flex h-[96px] w-[96px] items-center justify-center rounded-[28px]" style={{ background: selectedTheme.soft, color: selectedTheme.accent }}>
              <ThemeIcon themeId={theme} size={54} />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{t("games.breathGarden.title", "Breath Garden")}</h1>
            <p className="mx-auto mt-6 max-w-[650px] text-[26px] font-bold leading-snug" style={{ color: BRAND.ink }}>
              {t("games.breathGarden.howItWorks", "Tap once as you breathe in, and once as you breathe out. There is no correct rhythm - just breathe your way.")}
            </p>
            <button
              type="button"
              onClick={startSession}
              className="mt-7 flex min-h-[76px] w-full items-center justify-center gap-3 rounded-full px-6 text-[25px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              <Play size={28} aria-hidden="true" />
              {t("common.start", "Start")}
            </button>
            <button
              type="button"
              onClick={() => setScreen("theme")}
              className="mt-4 min-h-[64px] rounded-full px-5 text-[22px] font-extrabold underline underline-offset-4"
              style={{ color: BRAND.purple }}
            >
              {t("games.breathGarden.changeTheme", "Change garden")}
            </button>
          </section>
        ) : null}

        {screen === "tutorial" ? (
          <section className="mt-4 rounded-[28px] border bg-white p-4 text-center shadow-vyva-card sm:mt-6 sm:p-6" style={{ borderColor: BRAND.border }}>
            <TutorialGardenVisual
              theme={selectedTheme}
              inLabel={t("games.breathGarden.tutorialIn", "In")}
              outLabel={t("games.breathGarden.tutorialOut", "Out")}
            />
            <h1 className="mt-5 font-display text-[34px] leading-tight sm:mt-6 sm:text-[40px]">{t("games.breathGarden.title", "Breath Garden")}</h1>
            <p className="mt-2 text-[23px] font-black leading-tight sm:mt-3 sm:text-[27px]" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.tutorialSubtitle", "Tap gently as you breathe.")}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
              {[
                { label: t("games.breathGarden.tutorialIn", "In"), Icon: Waves },
                { label: t("games.breathGarden.tutorialOut", "Out"), Icon: Droplets },
                { label: t("games.breathGarden.tutorialGrow", "Garden grows"), Icon: Flower2 },
              ].map(({ label, Icon }) => (
                <div key={label} className="min-h-[90px] rounded-[22px] px-2 py-3 sm:min-h-[104px] sm:py-4" style={{ background: selectedTheme.soft, color: selectedTheme.accent }}>
                  <Icon className="mx-auto" size={28} aria-hidden="true" />
                  <span className="mt-2 block text-[15px] font-black leading-tight sm:mt-3 sm:text-[17px]">{label}</span>
                </div>
              ))}
            </div>

            <p className="mx-auto mt-4 max-w-[560px] text-[19px] font-bold leading-snug sm:mt-5 sm:text-[21px]" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.tutorialPace", "Go at your own pace. There is no right or wrong.")}
            </p>

            <button
              type="button"
              onClick={closeTutorial}
              className="mt-4 min-h-[66px] w-full rounded-full px-6 text-[23px] font-black text-white shadow-vyva-card sm:mt-6 sm:min-h-[76px] sm:text-[25px]"
              style={{ background: BRAND.purple }}
            >
              {t("games.breathGarden.tutorialUnderstand", "I understand")}
            </button>
            <button
              type="button"
              onClick={closeTutorial}
              className="mt-2 min-h-[48px] rounded-full px-5 text-[19px] font-extrabold underline underline-offset-4 sm:mt-3 sm:min-h-[58px] sm:text-[21px]"
              style={{ color: BRAND.purple }}
            >
              {t("common.skip", "Skip")}
            </button>
          </section>
        ) : null}

        {screen === "playing" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-5 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
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
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[24px]" style={{ background: selectedTheme.soft, color: selectedTheme.accent }}>
              <Check size={54} aria-hidden="true" />
            </div>
            <h1 className="mt-6 font-display text-[40px] leading-tight">{t("games.breathGarden.closeTitle", "Today's garden")}</h1>
            <div className="mx-auto mt-5 h-[320px] max-w-[620px] overflow-hidden rounded-[34px]">
              <GardenVisual themeId={theme} bloomLevel={5} complete />
            </div>
            <p className="mt-5 text-[25px] font-bold" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.closeSummary", "You breathed calmly for {n} minutes.", { n: closeMinutes })}
            </p>
            <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[22px] font-black" style={{ background: "#FEF3C7", color: "#92400E" }}>
              <Check size={24} aria-hidden="true" />
              {t("games.breathGarden.streakLabel", "{n} days tending your garden", { n: userState?.streak_days ?? 1 })}
            </p>
            {saveWarning ? <p className="mt-4 text-[20px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            <button
              type="button"
              onClick={onExit}
              className="mt-7 min-h-[72px] w-full rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              {t("common.finish", "Finish")}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}
