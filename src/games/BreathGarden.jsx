import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Headphones, Loader2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "@/i18n";
import { VyvaIcon } from "@/components/brand/VyvaIcon";
import { BrainCoachActivityShell, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import { apiFetch } from "@/lib/queryClient";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  ink: "#2B2233",
  muted: "#67586D",
  border: "#E9E2EC",
  teal: "#0F766E",
};

export const BREATH_GARDEN_DURATIONS = [60, 120, 300];
export const BREATH_GARDEN_PATTERN = {
  id: "gentle_4_6",
  inhaleSeconds: 4,
  exhaleSeconds: 6,
  cycleSeconds: 10,
};

const DEFAULT_STATE = {
  total_sessions: 0,
  streak_days: 0,
  last_streak_date: null,
  last_played_at: null,
  preferred_theme: "garden",
  preferred_duration_seconds: 120,
};

const GUIDANCE_CUES = {
  inhale: "Breathe in, gently.",
  exhale: "Breathe out, slowly.",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function isDuration(value) {
  return BREATH_GARDEN_DURATIONS.includes(Number(value));
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

export function getNextBreathGardenStateAfterSession(previousState, preferredDurationSeconds, now = new Date()) {
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
    preferred_theme: "garden",
    preferred_duration_seconds: isDuration(preferredDurationSeconds) ? Number(preferredDurationSeconds) : 120,
    updated_at: now.toISOString(),
  };
}

export function getGuidedBreathPhase(elapsedMs) {
  const cycleMs = BREATH_GARDEN_PATTERN.cycleSeconds * 1000;
  const positionMs = Math.max(0, elapsedMs) % cycleMs;
  const inhaleMs = BREATH_GARDEN_PATTERN.inhaleSeconds * 1000;
  if (positionMs < inhaleMs) {
    return { phase: "inhale", progress: positionMs / inhaleMs };
  }
  return {
    phase: "exhale",
    progress: (positionMs - inhaleMs) / (BREATH_GARDEN_PATTERN.exhaleSeconds * 1000),
  };
}

export function getGuidedCycleCount(elapsedSeconds) {
  return Math.max(0, Math.floor(Number(elapsedSeconds || 0) / BREATH_GARDEN_PATTERN.cycleSeconds));
}

export function buildGuidedBreathResult({ reason, durationSeconds, targetDurationSeconds, language }) {
  return {
    breathTaps: [],
    sessionDurationSeconds: durationSeconds,
    breathCycleCount: 0,
    avgBreathCycleSeconds: null,
    breathConsistencyIndex: null,
    finalPaceBreathsPerMin: null,
    gardenTheme: "garden",
    bloomLevelReached: clamp(Math.ceil((durationSeconds / Math.max(1, targetDurationSeconds)) * 5), 1, 5),
    targetDurationSeconds,
    guidedCycleCount: getGuidedCycleCount(durationSeconds),
    guidedPatternId: BREATH_GARDEN_PATTERN.id,
    completionReason: reason,
    completed: reason !== "exited",
    abandoned: reason === "exited",
    language,
  };
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatCompletedTime(totalSeconds, t) {
  const seconds = Math.max(1, Math.round(totalSeconds));
  if (seconds < 60) return t("games.breathGarden.secondsComplete", "{n} seconds", { n: seconds });
  const minutes = Math.max(1, Math.round(seconds / 60));
  return t("games.breathGarden.minutesComplete", "{n} minutes", { n: minutes });
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  return reduced;
}

function GardenVisual({ phase = "rest", phaseProgress = 0, reducedMotion = false, complete = false }) {
  const inhale = phase === "inhale";
  const exhale = phase === "exhale";
  const breathAmount = complete ? 1 : inhale ? phaseProgress : exhale ? 1 - phaseProgress : 0.45;
  const easedBreath = 0.5 - Math.cos(clamp(breathAmount, 0, 1) * Math.PI) / 2;
  const orbScale = reducedMotion ? 1 : 0.72 + easedBreath * 0.28;
  const glowOpacity = reducedMotion ? (inhale ? 0.5 : 0.28) : 0.2 + easedBreath * 0.34;
  const phaseProgressValue = phase === "rest" ? 0 : clamp(phaseProgress, 0, 1);
  const ringRadius = 118;
  const ringCircumference = 2 * Math.PI * ringRadius;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#F2FAF7_0%,#FAF7FC_100%)]" aria-hidden="true">
      <div
        className="absolute left-1/2 top-1/2 h-[230px] w-[230px] rounded-full bg-[#CDEEE3] blur-[10px]"
        style={{ opacity: glowOpacity, transform: `translate(-50%, -50%) scale(${0.9 + easedBreath * 0.2})` }}
      />
      <svg
        viewBox="0 0 520 340"
        className="relative h-full w-full"
        style={{ opacity: reducedMotion ? (inhale ? 1 : 0.88) : 1, transition: "opacity 500ms ease" }}
      >
        <defs>
          <radialGradient id="breathOrbInhale" cx="38%" cy="34%" r="68%">
            <stop offset="0" stopColor="#F9F3FF" />
            <stop offset="0.62" stopColor="#D9B7EE" />
            <stop offset="1" stopColor="#B879DA" />
          </radialGradient>
          <radialGradient id="breathOrbExhale" cx="38%" cy="34%" r="68%">
            <stop offset="0" stopColor="#F2FCF8" />
            <stop offset="0.62" stopColor="#B9E8D8" />
            <stop offset="1" stopColor="#72C7AE" />
          </radialGradient>
          <filter id="breathOrbShadow" x="-50%" y="-50%" width="200%" height="210%">
            <feDropShadow dx="0" dy="14" stdDeviation="16" floodColor="#59366C" floodOpacity="0.13" />
          </filter>
        </defs>
        <circle cx="260" cy="170" r="146" fill="#FFFFFF" opacity="0.34" />
        <circle
          cx="260"
          cy="170"
          r={ringRadius}
          fill="none"
          stroke="#E7DFEA"
          strokeWidth="5"
          opacity="0.8"
        />
        <circle
          cx="260"
          cy="170"
          r={ringRadius}
          fill="none"
          stroke={inhale ? "#6B21A8" : exhale ? "#0F766E" : "#BFA9CB"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - phaseProgressValue)}
          transform="rotate(-90 260 170)"
          opacity={phase === "rest" ? 0.28 : 0.9}
          style={{ transition: reducedMotion ? "stroke 500ms ease" : "stroke-dashoffset 180ms linear, stroke 500ms ease" }}
        />
        <g
          filter="url(#breathOrbShadow)"
          transform={`translate(260 170) scale(${orbScale})`}
          style={{ transition: reducedMotion ? "opacity 500ms ease" : "transform 180ms linear" }}
        >
          <circle cx="0" cy="0" r="90" fill={exhale ? "url(#breathOrbExhale)" : "url(#breathOrbInhale)"} />
          <circle cx="0" cy="0" r="72" fill="none" stroke="#FFFFFF" strokeWidth="2" opacity="0.4" />
          <circle cx="0" cy="0" r="10" fill="#FFFFFF" opacity="0.88" />
        </g>
      </svg>
    </div>
  );
}

function DurationChoice({ seconds, selected, onSelect, t }) {
  const minutes = seconds / 60;
  const unit = minutes === 1 ? t("games.breathGarden.minute", "minute") : t("games.breathGarden.minutes", "minutes");
  return (
    <button
      type="button"
      aria-label={`${minutes} ${unit}`}
      aria-pressed={selected}
      onClick={onSelect}
      className="vyva-tap relative min-h-[64px] rounded-[20px] border px-3 text-center transition-transform active:scale-[0.98]"
      style={{
        borderColor: selected ? BRAND.purple : BRAND.border,
        background: selected ? "#F4EAFF" : "#FFFFFF",
        color: selected ? BRAND.purple : BRAND.ink,
        boxShadow: selected ? "0 8px 22px rgba(107,33,168,0.10)" : "none",
      }}
    >
      {selected ? (
        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#6B21A8] text-white">
          <Check size={12} strokeWidth={3} aria-hidden="true" />
        </span>
      ) : null}
      <span className="block text-[20px] font-black leading-none">{minutes}</span>
      <span className="mt-1 block text-[12px] font-bold leading-none">{unit}</span>
    </button>
  );
}

function GuidanceChoice({ mode, selected, onSelect, title, description, icon }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className="vyva-tap flex min-h-[78px] items-center gap-3 rounded-[20px] border px-4 text-left transition-transform active:scale-[0.98]"
      style={{
        borderColor: selected ? BRAND.purple : BRAND.border,
        background: selected ? "#F4EAFF" : "#FFFFFF",
        boxShadow: selected ? "0 8px 22px rgba(107,33,168,0.10)" : "none",
      }}
      data-guidance-mode={mode}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-white text-[#6B21A8] shadow-sm">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-extrabold leading-tight" style={{ color: BRAND.ink }}>{title}</span>
        <span className="mt-1 block text-[12px] font-semibold leading-snug" style={{ color: BRAND.muted }}>{description}</span>
      </span>
      {selected ? <Check className="ml-auto shrink-0 text-[#6B21A8]" size={18} strokeWidth={3} aria-hidden="true" /> : null}
    </button>
  );
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
  const reducedMotion = useReducedMotion();
  const [screen, setScreen] = useState("loading");
  const [userState, setUserState] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(120);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [paused, setPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [guidanceMode, setGuidanceMode] = useState("silent");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [audioWarning, setAudioWarning] = useState("");
  const [saveWarning, setSaveWarning] = useState("");
  const [completionReason, setCompletionReason] = useState(null);

  const accumulatedMsRef = useRef(0);
  const segmentStartRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const finishingRef = useRef(false);
  const guidanceUrlsRef = useRef({ inhale: null, exhale: null });
  const guidanceAudioRef = useRef(null);
  const screenRef = useRef(screen);
  const durationRef = useRef(selectedDuration);

  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { durationRef.current = selectedDuration; }, [selectedDuration]);

  const stopGuidanceAudio = useCallback(() => {
    if (!guidanceAudioRef.current) return;
    guidanceAudioRef.current.pause();
    guidanceAudioRef.current.currentTime = 0;
    guidanceAudioRef.current = null;
  }, []);

  const playGuidanceCue = useCallback((nextPhase) => {
    const url = guidanceUrlsRef.current[nextPhase];
    if (!url || voiceMuted) return;
    stopGuidanceAudio();
    const audio = new Audio(url);
    audio.volume = 0.82;
    guidanceAudioRef.current = audio;
    void audio.play().catch(() => {
      setAudioWarning(t("games.breathGarden.audioUnavailable", "Voice guidance is unavailable. Continuing audio-free."));
      setVoiceMuted(true);
    });
  }, [stopGuidanceAudio, t, voiceMuted]);

  const prepareGuidanceAudio = useCallback(async () => {
    if (guidanceUrlsRef.current.inhale && guidanceUrlsRef.current.exhale) return true;
    setAudioStatus("loading");
    setAudioWarning("");
    try {
      const entries = await Promise.all(Object.entries(GUIDANCE_CUES).map(async ([cue, text]) => {
        const response = await apiFetch("/api/games/tts", {
          method: "POST",
          body: JSON.stringify({ text, language: gameLanguage, voiceProfile: "meditation" }),
        });
        if (!response.ok) throw new Error("Voice guidance unavailable");
        return [cue, URL.createObjectURL(await response.blob())];
      }));
      guidanceUrlsRef.current = Object.fromEntries(entries);
      setAudioStatus("ready");
      return true;
    } catch (error) {
      console.warn("Breath Garden voice guidance could not load.", error);
      setAudioStatus("error");
      setAudioWarning(t("games.breathGarden.audioUnavailable", "Voice guidance is unavailable. Continuing audio-free."));
      return false;
    }
  }, [gameLanguage, t]);

  useEffect(() => () => {
    stopGuidanceAudio();
    Object.values(guidanceUrlsRef.current).forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }, [stopGuidanceAudio]);

  const loadState = useCallback(async () => {
    if (!userId) {
      const fallback = getDefaultBreathGardenUserState("local");
      setUserState(fallback);
      setSelectedDuration(fallback.preferred_duration_seconds);
      setScreen("setup");
      return;
    }

    const response = await apiFetch("/api/games/breath-garden/state");
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error ?? t("games.breathGarden.stateUnavailable", "Breathing could not be prepared."));

    const state = payload.state ?? getDefaultBreathGardenUserState(userId);
    setUserState(state);
    setSelectedDuration(isDuration(state.preferred_duration_seconds) ? Number(state.preferred_duration_seconds) : 120);
    setScreen("setup");
  }, [t, userId]);

  useEffect(() => {
    setScreen("loading");
    void loadState().catch((error) => {
      console.warn("Breath Garden could not load.", error);
      const fallback = getDefaultBreathGardenUserState(userId || "local");
      setUserState(fallback);
      setSelectedDuration(120);
      setScreen("setup");
    });
  }, [loadState, userId]);

  const actualElapsedMs = useCallback(() => {
    if (screenRef.current !== "playing" || paused || segmentStartRef.current === null) return accumulatedMsRef.current;
    return accumulatedMsRef.current + (Date.now() - segmentStartRef.current);
  }, [paused]);

  const buildResult = useCallback((reason, elapsedOverride) => {
    const durationSeconds = Math.max(0, Math.round((elapsedOverride ?? actualElapsedMs()) / 1000));
    return buildGuidedBreathResult({ reason, durationSeconds, targetDurationSeconds: durationRef.current, language: gameLanguage });
  }, [actualElapsedMs, gameLanguage]);

  const saveSession = useCallback(async (reason, elapsedOverride) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;
    const result = buildResult(reason, elapsedOverride);

    if (!userId) {
      if (result.completed) {
        setUserState((current) => getNextBreathGardenStateAfterSession(current ?? getDefaultBreathGardenUserState("local"), result.targetDurationSeconds));
      }
      return result;
    }

    const response = await apiFetch("/api/games/breath-garden/sessions", { method: "POST", body: JSON.stringify(result) });
    const saved = await response.json().catch(() => ({}));
    if (!response.ok) {
      sessionSavedRef.current = false;
      throw new Error(saved?.error ?? "Breathing session could not be saved.");
    }
    if (saved.state) setUserState(saved.state);
    return result;
  }, [buildResult, userId]);

  const finishSession = useCallback(async (reason, elapsedOverride) => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const finalElapsed = Math.min(elapsedOverride ?? actualElapsedMs(), durationRef.current * 1000);
    accumulatedMsRef.current = finalElapsed;
    segmentStartRef.current = null;
    setElapsedMs(finalElapsed);
    setPaused(false);
    setSaving(true);
    setSaveWarning("");

    try {
      const result = await saveSession(reason, finalElapsed);
      if (reason !== "exited") {
        onAssessmentPracticeComplete?.({
          practiceTitle: assessmentPractice?.practiceTitle,
          durationSeconds: result?.sessionDurationSeconds ?? Math.round(finalElapsed / 1000),
        });
      }
    } catch (error) {
      console.warn("Breathing session could not be saved.", error);
      setSaveWarning(t("games.breathGarden.saveWarning", "Your session is complete. Saving may need to be retried."));
    } finally {
      setSaving(false);
      stopGuidanceAudio();
      finishingRef.current = false;
      if (reason === "exited") onExit?.();
      else {
        setCompletionReason(reason);
        setScreen("completion");
      }
    }
  }, [actualElapsedMs, assessmentPractice, onAssessmentPracticeComplete, onExit, saveSession, stopGuidanceAudio, t]);

  useEffect(() => {
    if (screen !== "playing" || paused) return undefined;
    const update = () => {
      const nextElapsed = Math.min(accumulatedMsRef.current + (Date.now() - (segmentStartRef.current ?? Date.now())), durationRef.current * 1000);
      setElapsedMs(nextElapsed);
      if (nextElapsed >= durationRef.current * 1000) void finishSession("timer_complete", nextElapsed);
    };
    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [finishSession, paused, screen]);

  const phase = useMemo(() => getGuidedBreathPhase(elapsedMs), [elapsedMs]);

  const previousPhaseRef = useRef(null);
  useEffect(() => {
    if (screen !== "playing" || paused || guidanceMode !== "guided" || voiceMuted || audioStatus !== "ready") {
      previousPhaseRef.current = null;
      return;
    }
    if (previousPhaseRef.current !== phase.phase) {
      previousPhaseRef.current = phase.phase;
      playGuidanceCue(phase.phase);
    }
  }, [audioStatus, guidanceMode, paused, phase.phase, playGuidanceCue, screen, voiceMuted]);

  const startSession = () => {
    accumulatedMsRef.current = 0;
    segmentStartRef.current = Date.now();
    sessionSavedRef.current = false;
    finishingRef.current = false;
    previousPhaseRef.current = null;
    setElapsedMs(0);
    setPaused(false);
    setVoiceMuted(false);
    setAudioWarning("");
    setSaveWarning("");
    setCompletionReason(null);
    setScreen("playing");
    if (guidanceMode === "guided") void prepareGuidanceAudio();
  };

  const togglePause = () => {
    if (paused) {
      segmentStartRef.current = Date.now();
      setPaused(false);
      return;
    }
    stopGuidanceAudio();
    const nextElapsed = actualElapsedMs();
    accumulatedMsRef.current = nextElapsed;
    segmentStartRef.current = null;
    setElapsedMs(nextElapsed);
    setPaused(true);
  };

  const exitActivity = async () => {
    if (screenRef.current === "playing") await finishSession("exited");
    else onExit?.();
  };

  const breatheAgain = () => {
    stopGuidanceAudio();
    setCompletionReason(null);
    setElapsedMs(0);
    accumulatedMsRef.current = 0;
    segmentStartRef.current = null;
    setScreen("setup");
  };

  if (screen === "loading") {
    return (
      <BrainCoachLoadingState
        title={t("games.breathGarden.title", "Breath Garden")}
        label={t("games.breathGarden.preparing", "Preparing your breathing exercise...")}
        testId="breath-garden-flow-shell"
        presentationId="brain_coach.activity_session.sharpen_senses.breath_garden.loading.touch"
        sceneId="brain_coach.activity_session.sharpen_senses.breath_garden"
      />
    );
  }

  const remainingSeconds = Math.max(0, selectedDuration - elapsedMs / 1000);
  const completedSeconds = Math.max(1, Math.round(elapsedMs / 1000));
  const phaseLabel = paused ? t("games.breathGarden.paused", "Paused") : phase.phase === "inhale" ? t("games.breathGarden.breatheIn", "Breathe in") : t("games.breathGarden.breatheOut", "Breathe out");

  return (
    <BrainCoachActivityShell
      title={t("games.breathGarden.title", "Breath Garden")}
      backLabel={t("common.exit", "Exit")}
      onBack={() => void exitActivity()}
      action={screen === "playing" && guidanceMode === "guided" ? (
        <button
          type="button"
          onClick={() => {
            if (voiceMuted) {
              setVoiceMuted(false);
              previousPhaseRef.current = null;
            } else {
              stopGuidanceAudio();
              setVoiceMuted(true);
            }
          }}
          disabled={audioStatus === "loading"}
          className="vyva-tap grid h-10 w-10 place-items-center rounded-full bg-white text-[#6B21A8] shadow-[0_10px_24px_rgba(80,52,109,0.10)] ring-1 ring-black/[0.05]"
          aria-label={voiceMuted ? t("games.breathGarden.unmuteGuidance", "Unmute voice guidance") : t("games.breathGarden.muteGuidance", "Mute voice guidance")}
        >
          <VyvaIcon icon={audioStatus === "loading" ? Loader2 : voiceMuted ? VolumeX : Volume2} size={20} strokeWidth={2.45} tone="brand" className={audioStatus === "loading" ? "animate-spin" : ""} />
        </button>
      ) : undefined}
      showHeader={screen !== "completion"}
      testId="breath-garden-flow-shell"
      presentationId={`brain_coach.activity_session.sharpen_senses.breath_garden.${screen}.touch`}
      sceneId="brain_coach.activity_session.sharpen_senses.breath_garden"
      sceneKind={screen === "completion" ? "completion" : screen}
      sceneLayout={screen === "playing" ? "guided_breathing" : screen === "completion" ? "modal_actions" : "activity_panel"}
      state={screen === "completion" ? "complete" : "default"}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-1 flex-col" style={{ color: BRAND.ink }}>
        {screen === "setup" ? (
          <section className="rounded-[28px] border border-[#EEE8F1] bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.09)] sm:p-7">
            <div className="mx-auto h-[220px] w-full max-w-[590px] overflow-hidden rounded-[26px] sm:h-[270px]">
              <GardenVisual />
            </div>
            <h2 className="mt-5 font-display text-[27px] font-semibold leading-tight tracking-[-0.03em] sm:text-[31px]">
              {t("games.breathGarden.setupTitle", "A quiet moment to breathe")}
            </h2>
            <p className="mx-auto mt-2 max-w-[500px] text-[15px] font-semibold leading-relaxed sm:text-[16px]" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.setupGuidance", "Follow the circle. Breathe in as it expands, and out as it settles.")}
            </p>
            <fieldset className="mx-auto mt-5 max-w-[420px]">
              <legend className="mb-3 text-[14px] font-extrabold" style={{ color: BRAND.muted }}>
                {t("games.breathGarden.chooseDuration", "Choose your time")}
              </legend>
              <div className="grid grid-cols-3 gap-3">
                {BREATH_GARDEN_DURATIONS.map((seconds) => (
                  <DurationChoice key={seconds} seconds={seconds} selected={selectedDuration === seconds} onSelect={() => setSelectedDuration(seconds)} t={t} />
                ))}
              </div>
            </fieldset>
            <fieldset className="mx-auto mt-5 max-w-[520px]">
              <legend className="mb-3 text-[14px] font-extrabold" style={{ color: BRAND.muted }}>
                {t("games.breathGarden.chooseGuidance", "Choose your guidance")}
              </legend>
              <div className="grid grid-cols-2 gap-3">
                <GuidanceChoice
                  mode="guided"
                  selected={guidanceMode === "guided"}
                  onSelect={() => {
                    setGuidanceMode("guided");
                    setVoiceMuted(false);
                    void prepareGuidanceAudio();
                  }}
                  title={t("games.breathGarden.guidedAudio", "Guided audio")}
                  description={t("games.breathGarden.guidedAudioDescription", "Breathe with Marco")}
                  icon={<Headphones size={21} strokeWidth={2.4} aria-hidden="true" />}
                />
                <GuidanceChoice
                  mode="silent"
                  selected={guidanceMode === "silent"}
                  onSelect={() => {
                    setGuidanceMode("silent");
                    stopGuidanceAudio();
                  }}
                  title={t("games.breathGarden.audioFree", "Audio-free")}
                  description={t("games.breathGarden.audioFreeDescription", "Follow the visual")}
                  icon={<VolumeX size={21} strokeWidth={2.4} aria-hidden="true" />}
                />
              </div>
            </fieldset>
            {audioWarning ? <p className="mx-auto mt-3 max-w-[500px] text-[13px] font-bold text-[#92400E]" role="status">{audioWarning}</p> : null}
            <button type="button" onClick={startSession} className="vyva-tap mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full bg-[#6B21A8] px-6 text-[18px] font-extrabold text-white shadow-[0_14px_28px_rgba(107,33,168,0.22)] transition-transform active:scale-[0.99]">
              <Play size={20} fill="currentColor" aria-hidden="true" />
              {t("common.start", "Start")}
            </button>
          </section>
        ) : null}

        {screen === "playing" ? (
          <section className="flex flex-1 flex-col rounded-[28px] border border-[#EEE8F1] bg-white p-5 text-center shadow-[0_18px_46px_rgba(54,35,78,0.09)] sm:p-7">
            <div className="flex items-center justify-between gap-4 px-1">
              <span className="rounded-full bg-[#F6F1F8] px-3.5 py-2 text-[14px] font-extrabold" style={{ color: BRAND.muted }}>{formatClock(remainingSeconds)}</span>
              <span className="text-[13px] font-bold" style={{ color: BRAND.muted }}>
                {selectedDuration / 60} {selectedDuration === 60 ? t("games.breathGarden.minute", "minute") : t("games.breathGarden.minutes", "minutes")}
              </span>
            </div>
            <div className="mx-auto mt-4 h-[300px] w-full max-w-[610px] overflow-hidden rounded-[28px] sm:h-[360px]">
              <GardenVisual phase={paused ? "rest" : phase.phase} phaseProgress={phase.progress} reducedMotion={reducedMotion} />
            </div>
            <div className="mt-5" aria-live="polite" aria-atomic="true">
              <p className="font-display text-[31px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]" style={{ color: paused ? BRAND.muted : BRAND.teal }}>{phaseLabel}</p>
              <div className="mx-auto mt-3 h-1.5 max-w-[320px] overflow-hidden rounded-full bg-[#EEE8F1]">
                <div className="h-full rounded-full bg-[#6B21A8] transition-[width] duration-300 ease-linear" style={{ width: `${clamp((elapsedMs / (selectedDuration * 1000)) * 100, 0, 100)}%` }} />
              </div>
            </div>
            {guidanceMode === "guided" ? (
              <p className="mt-3 text-[13px] font-bold" style={{ color: audioWarning ? "#92400E" : BRAND.muted }} role="status">
                {audioWarning || (voiceMuted
                  ? t("games.breathGarden.guidanceMuted", "Voice guidance muted")
                  : audioStatus === "loading"
                    ? t("games.breathGarden.preparingGuidance", "Preparing Marco's guidance...")
                    : t("games.breathGarden.guidedByMarco", "Guided by Marco"))}
              </p>
            ) : null}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={togglePause} className="vyva-tap inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full border border-[#DCCBE9] bg-white px-5 text-[16px] font-extrabold text-[#6B21A8]">
                {paused ? <Play size={19} fill="currentColor" aria-hidden="true" /> : <Pause size={19} fill="currentColor" aria-hidden="true" />}
                {paused ? t("games.breathGarden.resume", "Resume") : t("games.breathGarden.pause", "Pause")}
              </button>
              <button type="button" onClick={() => void finishSession("finished_early")} disabled={saving} className="vyva-tap min-h-[54px] rounded-full bg-[#6B21A8] px-5 text-[16px] font-extrabold text-white disabled:opacity-50">
                {saving ? t("common.saving", "Saving...") : t("common.finish", "Finish")}
              </button>
            </div>
          </section>
        ) : null}

        {screen === "completion" ? (
          <section className="flex min-h-[520px] flex-1 flex-col items-center justify-center rounded-[28px] border border-[#EEE8F1] bg-white p-6 text-center shadow-[0_18px_46px_rgba(54,35,78,0.09)] sm:p-9">
            <div className="grid h-[76px] w-[76px] place-items-center rounded-[24px] bg-[#E8F8F3] text-[#0F766E] shadow-[0_12px_28px_rgba(15,118,110,0.12)]"><Check size={38} strokeWidth={2.6} aria-hidden="true" /></div>
            <h2 className="mt-6 font-display text-[31px] font-semibold leading-tight tracking-[-0.03em] sm:text-[36px]">{t("games.breathGarden.completionTitle", "Breathing complete")}</h2>
            <p className="mt-2 text-[17px] font-semibold" style={{ color: BRAND.muted }}>
              {t("games.breathGarden.completionSummary", "{time} of calm breathing.", { time: formatCompletedTime(completedSeconds, t) })}
            </p>
            {completionReason === "finished_early" ? <p className="mt-2 text-[14px] font-bold" style={{ color: BRAND.teal }}>{t("games.breathGarden.earlyFinishNote", "A shorter pause still counts.")}</p> : null}
            {saveWarning ? <p className="mt-4 text-[14px] font-bold text-[#92400E]">{saveWarning}</p> : null}
            <div className="mt-8 w-full max-w-[520px] space-y-3">
              <button type="button" onClick={onExit} className="vyva-tap min-h-[56px] w-full rounded-full bg-[#6B21A8] px-6 text-[18px] font-extrabold text-white shadow-[0_14px_28px_rgba(107,33,168,0.20)]">
                {assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : t("common.done", "Done")}
              </button>
              {!assessmentPractice ? (
                <button type="button" onClick={breatheAgain} className="vyva-tap min-h-[52px] w-full rounded-full border border-[#DCCBE9] bg-white px-6 text-[17px] font-extrabold text-[#6B21A8]">{t("games.breathGarden.breatheAgain", "Breathe again")}</button>
              ) : onAssessmentPracticeReturn ? (
                <button type="button" onClick={onAssessmentPracticeReturn} className="vyva-tap min-h-[52px] w-full rounded-full border border-[#DCCBE9] bg-white px-6 text-[17px] font-extrabold text-[#6B21A8]">{t("common.done", "Done")}</button>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </BrainCoachActivityShell>
  );
}
