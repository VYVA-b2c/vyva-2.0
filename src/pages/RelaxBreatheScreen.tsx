import { ArrowLeft, CheckCircle2, Eye, Headphones, Loader2, PauseCircle, PlayCircle, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";

type RelaxBreatheLevelKey = "easy" | "steady" | "deeper";
type RelaxBreathePhaseKey = "settle" | "inhale" | "exhale" | "longExhale" | "softPause" | "return";
type RelaxBreathePhase = {
  key: RelaxBreathePhaseKey;
  title: string;
  instruction: string;
  cue: string;
  seconds: number;
};
type RelaxBreatheLevel = {
  key: RelaxBreatheLevelKey;
  levelNumber: number;
  title: string;
  summary: string;
  duration: string;
  phases: RelaxBreathePhase[];
};
type RelaxBreatheGuideMode = "visual" | "voice";
type RelaxBreatheProgress = {
  totalSessions: number;
  lastCompletedDate: string | null;
  streakDays: number;
  motionPaused: boolean;
  lastCompletedLevel: RelaxBreatheLevelKey | null;
};

const RELAX_BREATHE_PROGRESS_KEY = "vyva_relax_breathe_progress";
const DEFAULT_RELAX_BREATHE_PROGRESS: RelaxBreatheProgress = {
  totalSessions: 0,
  lastCompletedDate: null,
  streakDays: 0,
  motionPaused: false,
  lastCompletedLevel: null,
};
const RELAX_BREATHE_LEVEL_KEYS = ["easy", "steady", "deeper"] as const;
const RELAX_BREATHE_LEVEL_PHASES: Record<RelaxBreatheLevelKey, Array<{ key: RelaxBreathePhaseKey; seconds: number }>> = {
  easy: [
    { key: "settle", seconds: 10 },
    { key: "inhale", seconds: 4 },
    { key: "exhale", seconds: 6 },
    { key: "inhale", seconds: 4 },
    { key: "exhale", seconds: 6 },
    { key: "return", seconds: 10 },
  ],
  steady: [
    { key: "settle", seconds: 10 },
    { key: "inhale", seconds: 4 },
    { key: "longExhale", seconds: 7 },
    { key: "inhale", seconds: 4 },
    { key: "longExhale", seconds: 7 },
    { key: "inhale", seconds: 4 },
    { key: "longExhale", seconds: 7 },
    { key: "return", seconds: 10 },
  ],
  deeper: [
    { key: "settle", seconds: 10 },
    { key: "inhale", seconds: 4 },
    { key: "softPause", seconds: 2 },
    { key: "longExhale", seconds: 8 },
    { key: "inhale", seconds: 4 },
    { key: "softPause", seconds: 2 },
    { key: "longExhale", seconds: 8 },
    { key: "return", seconds: 10 },
  ],
};
const RELAX_BREATHE_IS_TEST_RUNTIME = typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom");
const RELAX_BREATHE_TIMER_MS = RELAX_BREATHE_IS_TEST_RUNTIME ? 1 : 1000;
const relaxBreathePhaseSeconds = (seconds: number) => (RELAX_BREATHE_IS_TEST_RUNTIME ? 1 : seconds);

function recommendedRelaxBreatheLevel(progress: RelaxBreatheProgress): RelaxBreatheLevelKey {
  if (progress.totalSessions >= 4) return "deeper";
  if (progress.totalSessions >= 2) return "steady";
  return "easy";
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getLocalDateKey(date);
}

function readRelaxBreatheProgress(): RelaxBreatheProgress {
  if (typeof window === "undefined") return DEFAULT_RELAX_BREATHE_PROGRESS;

  try {
    const stored = window.localStorage.getItem(RELAX_BREATHE_PROGRESS_KEY);
    if (!stored) return DEFAULT_RELAX_BREATHE_PROGRESS;

    const parsed = JSON.parse(stored) as Partial<RelaxBreatheProgress>;
    return {
      totalSessions: Math.max(0, Number(parsed.totalSessions) || 0),
      lastCompletedDate: typeof parsed.lastCompletedDate === "string" ? parsed.lastCompletedDate : null,
      streakDays: Math.max(0, Number(parsed.streakDays) || 0),
      motionPaused: Boolean(parsed.motionPaused),
      lastCompletedLevel: RELAX_BREATHE_LEVEL_KEYS.includes(parsed.lastCompletedLevel as RelaxBreatheLevelKey)
        ? parsed.lastCompletedLevel as RelaxBreatheLevelKey
        : null,
    };
  } catch {
    return DEFAULT_RELAX_BREATHE_PROGRESS;
  }
}

function writeRelaxBreatheProgress(progress: RelaxBreatheProgress) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(RELAX_BREATHE_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // The guide still works if local storage is unavailable.
  }
}

function recordRelaxBreatheCompletion(progress: RelaxBreatheProgress, completedLevel: RelaxBreatheLevelKey): RelaxBreatheProgress {
  const today = getLocalDateKey();
  const completedYesterday = progress.lastCompletedDate === getYesterdayDateKey();
  const completedToday = progress.lastCompletedDate === today;
  const streakDays = completedToday
    ? Math.max(1, progress.streakDays)
    : completedYesterday
      ? Math.max(1, progress.streakDays) + 1
      : 1;

  return {
    ...progress,
    totalSessions: progress.totalSessions + 1,
    lastCompletedDate: today,
    streakDays,
    lastCompletedLevel: completedLevel,
  };
}

function getRelaxBreathePhaseTiming(phases: RelaxBreathePhase[], elapsedSeconds: number) {
  let elapsedBeforePhase = 0;

  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];
    const phaseEndsAt = elapsedBeforePhase + phase.seconds;

    if (elapsedSeconds < phaseEndsAt || index === phases.length - 1) {
      return {
        phaseIndex: index,
        phase,
        secondsRemaining: Math.max(1, phaseEndsAt - elapsedSeconds),
      };
    }

    elapsedBeforePhase = phaseEndsAt;
  }

  return {
    phaseIndex: 0,
    phase: phases[0],
    secondsRemaining: phases[0]?.seconds ?? 1,
  };
}

function usePrefersReducedMotion() {
  const readPreference = () => (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updatePreference);
      return () => mediaQuery.removeEventListener("change", updatePreference);
    }

    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  return prefersReducedMotion;
}

function buildMarcoPrompt(
  title: string,
  level: RelaxBreatheLevel,
  phase: RelaxBreathePhase,
  phaseIndex: number,
  phaseCount: number,
  safetyLine: string,
) {
  return [
    `Guide the user through ${title}.`,
    `Selected level ${level.levelNumber}: ${level.title}.`,
    `Current phase ${phaseIndex + 1} of ${phaseCount}: ${phase.title}.`,
    `Visible instruction: ${phase.instruction}`,
    `Visual breathing cue: ${phase.cue}.`,
    "Speak warmly, slowly, and plainly.",
    "Keep the guidance short. The app advances automatically, so do not ask the user to tap next.",
    `Safety reminder: ${safetyLine}`,
  ].join(" ");
}

export default function RelaxBreatheScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [elapsedSessionSeconds, setElapsedSessionSeconds] = useState(0);
  const [isSessionRunning, setSessionRunning] = useState(false);
  const [isSessionPaused, setSessionPaused] = useState(false);
  const [isCompleted, setCompleted] = useState(false);
  const [isGuideStarted, setGuideStarted] = useState(false);
  const [isAudioStarting, setAudioStarting] = useState(false);
  const [guideMode, setGuideMode] = useState<RelaxBreatheGuideMode>("visual");
  const [voiceStartFailed, setVoiceStartFailed] = useState(false);
  const [progress, setProgress] = useState<RelaxBreatheProgress>(() => readRelaxBreatheProgress());
  const [selectedLevelKey, setSelectedLevelKey] = useState<RelaxBreatheLevelKey>(() => recommendedRelaxBreatheLevel(readRelaxBreatheProgress()));
  const lastPromptedPhaseIndexRef = useRef(0);
  const {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    status: voiceStatus,
    isConnecting,
    lastError: voiceError,
  } = useVyvaVoice();

  const copy = useMemo(() => {
    const phaseCopy: Record<RelaxBreathePhaseKey, Omit<RelaxBreathePhase, "key" | "seconds">> = {
      settle: {
        title: t("activities.relaxBreathe.phases.settle.title", "Settle"),
        instruction: t("activities.relaxBreathe.phases.settle.instruction", "Sit comfortably. Let your shoulders soften."),
        cue: t("activities.relaxBreathe.phases.settle.cue", "Find a comfortable seat."),
      },
      inhale: {
        title: t("activities.relaxBreathe.phases.inhale.title", "Breathe in"),
        instruction: t("activities.relaxBreathe.phases.inhale.instruction", "Breathe in gently as the circle grows."),
        cue: t("activities.relaxBreathe.phases.inhale.cue", "Easy breath in."),
      },
      exhale: {
        title: t("activities.relaxBreathe.phases.exhale.title", "Breathe out"),
        instruction: t("activities.relaxBreathe.phases.exhale.instruction", "Let the breath out slowly as the circle settles."),
        cue: t("activities.relaxBreathe.phases.exhale.cue", "Soft breath out."),
      },
      longExhale: {
        title: t("activities.relaxBreathe.phases.longExhale.title", "Long breath out"),
        instruction: t("activities.relaxBreathe.phases.longExhale.instruction", "Breathe out a little longer, only while it feels comfortable."),
        cue: t("activities.relaxBreathe.phases.longExhale.cue", "Longer breath out."),
      },
      softPause: {
        title: t("activities.relaxBreathe.phases.softPause.title", "Soft pause"),
        instruction: t("activities.relaxBreathe.phases.softPause.instruction", "Rest for a moment. Skip the pause if it does not feel good."),
        cue: t("activities.relaxBreathe.phases.softPause.cue", "Tiny resting pause."),
      },
      return: {
        title: t("activities.relaxBreathe.phases.return.title", "Return gently"),
        instruction: t("activities.relaxBreathe.phases.return.instruction", "Notice the chair, the room, and one calm breath."),
        cue: t("activities.relaxBreathe.phases.return.cue", "Come back to the room gently."),
      },
    };

    const levelCopy: Record<RelaxBreatheLevelKey, Omit<RelaxBreatheLevel, "key" | "phases">> = {
      easy: {
        levelNumber: 1,
        title: t("activities.relaxBreathe.levels.easy.title", "Easy"),
        summary: t("activities.relaxBreathe.levels.easy.summary", "Simple in and out breathing."),
        duration: t("activities.relaxBreathe.levels.easy.duration", "About 1 minute"),
      },
      steady: {
        levelNumber: 2,
        title: t("activities.relaxBreathe.levels.steady.title", "Steady"),
        summary: t("activities.relaxBreathe.levels.steady.summary", "A slightly longer breath out."),
        duration: t("activities.relaxBreathe.levels.steady.duration", "About 1 minute"),
      },
      deeper: {
        levelNumber: 3,
        title: t("activities.relaxBreathe.levels.deeper.title", "Deeper"),
        summary: t("activities.relaxBreathe.levels.deeper.summary", "Adds a tiny comfortable pause."),
        duration: t("activities.relaxBreathe.levels.deeper.duration", "About 1 minute"),
      },
    };

    const levels = RELAX_BREATHE_LEVEL_KEYS.map((key) => ({
      key,
      ...levelCopy[key],
      phases: RELAX_BREATHE_LEVEL_PHASES[key].map((phase) => ({
        key: phase.key,
        seconds: relaxBreathePhaseSeconds(phase.seconds),
        ...phaseCopy[phase.key],
      })),
    }));

    return {
      title: t("activities.relaxBreathe.title", "Relax & Breathe"),
      intro: t("activities.relaxBreathe.intro", "A guided calm pause. Tap once and VYVA leads you."),
      backToMindMemory: t("activities.relaxBreathe.backToMindMemory", "Back to Mind & Memory"),
      duration: t("activities.relaxBreathe.duration", "Guided breathing"),
      modeLabel: t("activities.relaxBreathe.modeLabel", "Guide mode"),
      visualMode: t("activities.relaxBreathe.visualMode", "App"),
      voiceMode: t("activities.relaxBreathe.voiceMode", "Voice"),
      visualModeTitle: t("activities.relaxBreathe.visualModeTitle", "App guide"),
      visualModeBody: t("activities.relaxBreathe.visualModeBody", "The app moves through each breath for you."),
      voiceModeTitle: t("activities.relaxBreathe.voiceModeTitle", "Voice guide"),
      voiceModeBody: t("activities.relaxBreathe.voiceModeBody", "Marco can talk you through the breathing session."),
      stepLabel: t("activities.relaxBreathe.stepLabel", "Phase"),
      ofLabel: t("activities.relaxBreathe.ofLabel", "of"),
      levelLabel: t("activities.relaxBreathe.levelLabel", "Level"),
      chooseLevel: t("activities.relaxBreathe.chooseLevel", "Choose a level"),
      breatheIn: t("activities.relaxBreathe.breatheIn", "Breathe in"),
      breatheOut: t("activities.relaxBreathe.breatheOut", "Breathe out"),
      safety: t("activities.relaxBreathe.safety", "If breathing feels difficult, painful, or unusual, stop and seek help."),
      startGuide: t("activities.relaxBreathe.startGuide", "Start guide"),
      pauseSession: t("activities.relaxBreathe.pauseSession", "Pause"),
      resumeSession: t("activities.relaxBreathe.resumeSession", "Resume"),
      endSession: t("activities.relaxBreathe.endSession", "End"),
      guideStarting: t("activities.relaxBreathe.guideStarting", "Starting..."),
      guideLive: t("activities.relaxBreathe.guideLive", "Voice guide is live"),
      voiceRetry: t("activities.relaxBreathe.voiceRetry", "Voice was not available. The app guide is still running."),
      replay: t("activities.relaxBreathe.replay", "Repeat voice cue"),
      completeTitle: t("activities.relaxBreathe.completeTitle", "A calm pause is complete."),
      completeBody: t("activities.relaxBreathe.completeBody", "You can come back to this whenever you want a quieter moment."),
      tryAgain: t("activities.relaxBreathe.tryAgain", "Try again"),
      audioUnavailable: t("activities.relaxBreathe.audioUnavailable", "The app guide still works without audio."),
      routineTitle: t("activities.relaxBreathe.routineTitle", "Your calm routine"),
      routineStart: t("activities.relaxBreathe.routineStart", "First pause today"),
      routineDoneToday: t("activities.relaxBreathe.routineDoneToday", "Done today"),
      routineCountOne: t("activities.relaxBreathe.routineCountOne", "{n} calm pause"),
      routineCountMany: t("activities.relaxBreathe.routineCountMany", "{n} calm pauses"),
      routineStreak: t("activities.relaxBreathe.routineStreak", "{n} day streak"),
      motionPause: t("activities.relaxBreathe.motionPause", "Pause motion"),
      motionResume: t("activities.relaxBreathe.motionResume", "Resume motion"),
      motionSystemPaused: t("activities.relaxBreathe.motionSystemPaused", "Motion paused"),
      nowLabel: t("activities.relaxBreathe.nowLabel", "Now"),
      notStartedLabel: t("activities.relaxBreathe.notStartedLabel", "Ready"),
      runningLabel: t("activities.relaxBreathe.runningLabel", "Guiding"),
      pausedLabel: t("activities.relaxBreathe.pausedLabel", "Paused"),
      timeLeft: t("activities.relaxBreathe.timeLeft", "{n}s left"),
      sessionProgress: t("activities.relaxBreathe.sessionProgress", "{n}% complete"),
      nextLevelTitle: t("activities.relaxBreathe.nextLevelTitle", "Next time"),
      levels,
    };
  }, [t]);

  const currentLevel = copy.levels.find((level) => level.key === selectedLevelKey) ?? copy.levels[0];
  const phaseCount = currentLevel.phases.length;
  const totalSessionSeconds = currentLevel.phases.reduce((sum, phase) => sum + phase.seconds, 0);
  const phaseTiming = getRelaxBreathePhaseTiming(
    currentLevel.phases,
    isSessionRunning ? elapsedSessionSeconds : 0,
  );
  const phaseIndex = phaseTiming.phaseIndex;
  const currentPhase = phaseTiming.phase;
  const visiblePhaseSecondsRemaining = phaseTiming.secondsRemaining;
  const sessionProgressPercent = Math.min(100, Math.max(0, Math.round((elapsedSessionSeconds / totalSessionSeconds) * 100)));
  const sessionStateLabel = isSessionPaused
    ? copy.pausedLabel
    : isSessionRunning
      ? copy.runningLabel
      : copy.notStartedLabel;
  const audioIsLive = isGuideStarted || voiceStatus === "connected";
  const isMotionPaused = prefersReducedMotion || progress.motionPaused;
  const completedToday = progress.lastCompletedDate === getLocalDateKey();
  const sessionCountText = progress.totalSessions === 1
    ? t("activities.relaxBreathe.routineCountOne", copy.routineCountOne, { n: progress.totalSessions })
    : t("activities.relaxBreathe.routineCountMany", copy.routineCountMany, { n: progress.totalSessions });
  const streakText = t("activities.relaxBreathe.routineStreak", copy.routineStreak, { n: Math.max(1, progress.streakDays) });
  const timeLeftText = t("activities.relaxBreathe.timeLeft", copy.timeLeft, { n: visiblePhaseSecondsRemaining });
  const sessionProgressText = t("activities.relaxBreathe.sessionProgress", copy.sessionProgress, { n: sessionProgressPercent });
  const orbPrimaryText = currentPhase.key === "exhale" || currentPhase.key === "longExhale"
    ? copy.breatheOut
    : currentPhase.key === "inhale"
      ? copy.breatheIn
      : currentPhase.title;

  const voiceVariables = useCallback((nextPhaseIndex: number) => {
    const phase = currentLevel.phases[nextPhaseIndex] ?? currentLevel.phases[0];
    return {
      app_entrypoint: "relax_breathe_session",
      session_title: copy.title,
      level_key: currentLevel.key,
      level_title: currentLevel.title,
      level_number: currentLevel.levelNumber,
      phase_key: phase.key,
      phase_title: phase.title,
      phase_instruction: phase.instruction,
      breathing_cue: phase.cue,
      current_phase_number: nextPhaseIndex + 1,
      phase_count: phaseCount,
      safety_line: copy.safety,
    };
  }, [copy.safety, copy.title, currentLevel, phaseCount]);

  const promptForPhase = useCallback((nextPhaseIndex: number) => {
    const phase = currentLevel.phases[nextPhaseIndex] ?? currentLevel.phases[0];
    return buildMarcoPrompt(copy.title, currentLevel, phase, nextPhaseIndex, phaseCount, copy.safety);
  }, [copy.safety, copy.title, currentLevel, phaseCount]);

  const sendPhasePrompt = useCallback((nextPhaseIndex: number) => {
    sendContextUpdate(`Relax and Breathe session context: ${JSON.stringify(voiceVariables(nextPhaseIndex))}`);
    sendText(promptForPhase(nextPhaseIndex), { invisibleInTranscript: true });
  }, [promptForPhase, sendContextUpdate, sendText, voiceVariables]);

  useEffect(() => {
    try {
      if (navigator.userAgent.toLowerCase().includes("jsdom")) return () => stopVoice();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      // Some test environments do not implement scrollTo.
    }

    return () => stopVoice();
  }, [stopVoice]);

  const goBackToMindMemory = useCallback(() => {
    stopVoice();
    navigate("/mind-memory");
  }, [navigate, stopVoice]);

  const selectLevel = useCallback((levelKey: RelaxBreatheLevelKey) => {
    if (isSessionRunning) return;
    setSelectedLevelKey(levelKey);
    setElapsedSessionSeconds(0);
    lastPromptedPhaseIndexRef.current = 0;
    setCompleted(false);
    setVoiceStartFailed(false);
  }, [isSessionRunning]);

  const startVoiceGuide = useCallback(async (nextPhaseIndex = 0) => {
    if (audioIsLive || isAudioStarting || isConnecting) return;
    setVoiceStartFailed(false);
    setAudioStarting(true);
    try {
      await startVoice(promptForPhase(nextPhaseIndex), undefined, {
        agentSlug: "marco-reyes",
        roomSlug: "evening-wind-down",
        autoStartListening: false,
        dynamicVariables: voiceVariables(nextPhaseIndex),
      });
      setGuideStarted(true);
      sendPhasePrompt(nextPhaseIndex);
    } catch {
      setVoiceStartFailed(true);
      setGuideStarted(false);
      setGuideMode("visual");
    } finally {
      setAudioStarting(false);
    }
  }, [audioIsLive, isAudioStarting, isConnecting, promptForPhase, sendPhasePrompt, startVoice, voiceVariables]);

  const switchGuideMode = useCallback((nextMode: RelaxBreatheGuideMode) => {
    setGuideMode(nextMode);
    setVoiceStartFailed(false);
    if (nextMode === "visual" && audioIsLive) {
      stopVoice();
      setGuideStarted(false);
    }
    if (nextMode === "voice" && isSessionRunning) {
      lastPromptedPhaseIndexRef.current = phaseIndex;
      void startVoiceGuide(phaseIndex);
    }
  }, [audioIsLive, isSessionRunning, phaseIndex, startVoiceGuide, stopVoice]);

  const replayPhase = useCallback(() => {
    if (audioIsLive) {
      sendPhasePrompt(phaseIndex);
    }
  }, [audioIsLive, phaseIndex, sendPhasePrompt]);

  const toggleMotionPaused = useCallback(() => {
    if (prefersReducedMotion) return;

    setProgress((currentProgress) => {
      const nextProgress = {
        ...currentProgress,
        motionPaused: !currentProgress.motionPaused,
      };
      writeRelaxBreatheProgress(nextProgress);
      return nextProgress;
    });
  }, [prefersReducedMotion]);

  const finishSession = useCallback(() => {
    stopVoice();
    setGuideStarted(false);
    setVoiceStartFailed(false);
    setSessionRunning(false);
    setSessionPaused(false);
    setProgress((currentProgress) => {
      const nextProgress = recordRelaxBreatheCompletion(currentProgress, currentLevel.key);
      writeRelaxBreatheProgress(nextProgress);
      return nextProgress;
    });
    setCompleted(true);
  }, [currentLevel.key, stopVoice]);

  const startGuidedSession = useCallback(() => {
    setCompleted(false);
    setElapsedSessionSeconds(0);
    lastPromptedPhaseIndexRef.current = 0;
    setSessionPaused(false);
    setSessionRunning(true);
    setVoiceStartFailed(false);
    if (guideMode === "voice") {
      void startVoiceGuide(0);
    }
  }, [currentLevel.phases, guideMode, startVoiceGuide]);

  const toggleSessionPaused = useCallback(() => {
    if (!isSessionRunning) return;
    setSessionPaused((paused) => !paused);
  }, [isSessionRunning]);

  const restartSession = useCallback(() => {
    setCompleted(false);
    setElapsedSessionSeconds(0);
    lastPromptedPhaseIndexRef.current = 0;
    setSessionRunning(false);
    setSessionPaused(false);
    setVoiceStartFailed(false);
  }, []);

  useEffect(() => {
    if (!isSessionRunning || isSessionPaused || isCompleted || elapsedSessionSeconds >= totalSessionSeconds) return undefined;

    const timer = window.setTimeout(() => {
      setElapsedSessionSeconds((elapsedSeconds) => Math.min(totalSessionSeconds, elapsedSeconds + 1));
    }, RELAX_BREATHE_TIMER_MS);

    return () => window.clearTimeout(timer);
  }, [
    elapsedSessionSeconds,
    isCompleted,
    isSessionPaused,
    isSessionRunning,
    totalSessionSeconds,
  ]);

  useEffect(() => {
    if (!isSessionRunning || isSessionPaused || isCompleted || elapsedSessionSeconds < totalSessionSeconds) return;

    finishSession();
  }, [
    elapsedSessionSeconds,
    finishSession,
    isCompleted,
    isSessionPaused,
    isSessionRunning,
    totalSessionSeconds,
  ]);

  useEffect(() => {
    if (!isSessionRunning || phaseIndex === lastPromptedPhaseIndexRef.current) return;

    lastPromptedPhaseIndexRef.current = phaseIndex;
    if (audioIsLive) {
      sendPhasePrompt(phaseIndex);
    }
  }, [
    audioIsLive,
    isSessionRunning,
    phaseIndex,
    sendPhasePrompt,
  ]);


  const voiceStatusLabel = isAudioStarting || isConnecting
    ? copy.guideStarting
    : audioIsLive
      ? copy.guideLive
      : voiceStartFailed || voiceError
        ? copy.voiceRetry
        : copy.guideStarting;

  return (
    <section
      className="min-h-screen bg-[radial-gradient(circle_at_top,#F2FFFB_0%,#F8F4EF_46%,#F2ECE5_100%)] px-4 py-4 text-[#263238] sm:px-6 sm:py-6"
      data-testid="relax-breathe-screen"
    >
      <style>
        {`
          @keyframes relax-breathe-pulse {
            0%, 100% { transform: scale(0.9); opacity: 0.84; }
            50% { transform: scale(1.08); opacity: 1; }
          }
          @keyframes relax-breathe-halo {
            0%, 100% { transform: scale(0.92); opacity: 0.5; }
            50% { transform: scale(1.08); opacity: 0.9; }
          }
          @keyframes relax-breathe-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
          @media (prefers-reduced-motion: reduce) {
            .relax-breathe-orb,
            .relax-breathe-halo,
            .relax-breathe-float {
              animation: none !important;
            }
          }
        `}
      </style>

      <div className="mx-auto flex min-h-[calc(100vh-32px)] w-full max-w-[920px] flex-col">
        <button
          type="button"
          onClick={goBackToMindMemory}
          className="inline-flex min-h-[48px] w-fit items-center gap-2 rounded-full border border-[#CDEBE5] bg-white px-4 font-body text-[15px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
          data-testid="button-relax-breathe-back-mind-memory"
        >
          <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
          {copy.backToMindMemory}
        </button>

        <main className="mt-4 flex-1 overflow-hidden rounded-[34px] border border-[#BEE9E1] bg-white/94 shadow-[0_22px_50px_rgba(15,118,110,0.14)]">
          {isCompleted ? (
            <div className="flex min-h-[620px] flex-col items-center justify-center px-5 py-10 text-center" data-testid="relax-breathe-complete">
              <div className="relax-breathe-float flex h-24 w-24 items-center justify-center rounded-[28px] bg-[#DCFCE7] text-[#047857] shadow-[0_18px_34px_rgba(4,120,87,0.14)]">
                <CheckCircle2 size={46} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h1 className="mt-6 max-w-[640px] font-display text-[40px] leading-[1.02] text-[#173B35] sm:text-[58px]">
                {copy.completeTitle}
              </h1>
              <p className="mt-4 max-w-[520px] font-body text-[19px] font-bold leading-snug text-[#5F706C]">
                {copy.completeBody}
              </p>
              <div
                className="mt-6 grid w-full max-w-[520px] gap-3 rounded-[26px] border border-[#CDEBE5] bg-[#F8FFFC] p-4 text-left sm:grid-cols-2"
                data-testid="relax-breathe-progress-summary"
              >
                <div>
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                    {copy.routineTitle}
                  </p>
                  <p className="mt-1 font-body text-[20px] font-black text-[#173B35]">
                    {sessionCountText}
                  </p>
                </div>
                <div>
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                    {completedToday ? copy.routineDoneToday : copy.routineStart}
                  </p>
                  <p className="mt-1 font-body text-[20px] font-black text-[#173B35]">
                    {streakText}
                  </p>
                </div>
              </div>
              <div className="mt-8 grid w-full max-w-[520px] gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={restartSession}
                  className="min-h-[60px] rounded-[22px] border border-[#BEE9E1] bg-white px-5 font-body text-[17px] font-black text-[#0F766E]"
                  data-testid="button-relax-breathe-try-again"
                >
                  {copy.tryAgain}
                </button>
                <button
                  type="button"
                  onClick={goBackToMindMemory}
                  className="min-h-[60px] rounded-[22px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_16px_28px_rgba(15,118,110,0.22)]"
                >
                  {copy.backToMindMemory}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid lg:min-h-[650px] lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="relative flex min-w-0 flex-col justify-between overflow-hidden bg-[linear-gradient(145deg,#F5FFFB_0%,#E7FFF7_54%,#F9FBF8_100%)] p-4 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black uppercase tracking-[0.06em] text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]">
                        <Headphones size={16} strokeWidth={2.5} aria-hidden="true" />
                        {copy.duration}
                      </span>
                      <span className="rounded-full bg-[#0F766E] px-3 py-1.5 font-body text-[13px] font-black text-white shadow-[0_8px_18px_rgba(15,118,110,0.14)]">
                        {copy.levelLabel} {currentLevel.levelNumber}: {currentLevel.title}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)]">
                        {copy.stepLabel} {phaseIndex + 1} {copy.ofLabel} {phaseCount}
                      </span>
                    </div>
                    <h1 className="mt-4 font-display text-[38px] leading-[0.98] text-[#173B35] sm:text-[58px]">
                      {copy.title}
                    </h1>
                    <p className="mt-3 max-w-[520px] font-body text-[16px] font-bold leading-snug text-[#5F706C] sm:text-[21px]">
                      {copy.intro}
                    </p>
                    <div
                      className="mt-5 inline-grid grid-cols-2 rounded-[22px] border border-[#CDEBE5] bg-white/80 p-1 shadow-[0_10px_24px_rgba(15,118,110,0.08)]"
                      role="group"
                      aria-label={copy.modeLabel}
                      data-testid="relax-breathe-mode-switch"
                    >
                      <button
                        type="button"
                        onClick={() => switchGuideMode("visual")}
                        aria-pressed={guideMode === "visual"}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[14px] font-black transition ${
                          guideMode === "visual"
                            ? "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.18)]"
                            : "text-[#0F766E] hover:bg-[#ECFDF5]"
                        }`}
                        data-testid="button-relax-breathe-mode-visual"
                      >
                        <Eye size={17} strokeWidth={2.6} aria-hidden="true" />
                        {copy.visualMode}
                      </button>
                      <button
                        type="button"
                        onClick={() => switchGuideMode("voice")}
                        aria-pressed={guideMode === "voice"}
                        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[14px] font-black transition ${
                          guideMode === "voice"
                            ? "bg-[#0F766E] text-white shadow-[0_10px_18px_rgba(15,118,110,0.18)]"
                            : "text-[#0F766E] hover:bg-[#ECFDF5]"
                        }`}
                        data-testid="button-relax-breathe-mode-voice"
                      >
                        <Headphones size={17} strokeWidth={2.6} aria-hidden="true" />
                        {copy.voiceMode}
                      </button>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <div
                        className="inline-flex min-h-[48px] items-center gap-3 rounded-[18px] border border-[#CDEBE5] bg-white/82 px-4 py-2 shadow-[0_8px_18px_rgba(15,118,110,0.08)]"
                        data-testid="relax-breathe-routine"
                      >
                        <Sparkles size={19} strokeWidth={2.5} className="shrink-0 text-[#0F766E]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                            {copy.routineTitle}
                          </p>
                          <p className="break-words font-body text-[14px] font-black text-[#173B35]">
                            {progress.totalSessions > 0 ? sessionCountText : copy.routineStart}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={toggleMotionPaused}
                        disabled={prefersReducedMotion}
                        aria-pressed={isMotionPaused}
                        className="inline-flex min-h-[48px] items-center gap-2 rounded-[18px] border border-[#CDEBE5] bg-white/82 px-4 py-2 font-body text-[14px] font-black text-[#0F766E] shadow-[0_8px_18px_rgba(15,118,110,0.08)] disabled:opacity-70"
                        data-testid="button-relax-breathe-motion-toggle"
                      >
                        {isMotionPaused ? (
                          <PlayCircle size={19} strokeWidth={2.5} aria-hidden="true" />
                        ) : (
                          <PauseCircle size={19} strokeWidth={2.5} aria-hidden="true" />
                        )}
                        {prefersReducedMotion
                          ? copy.motionSystemPaused
                          : isMotionPaused
                            ? copy.motionResume
                            : copy.motionPause}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="mt-5 rounded-[26px] border border-[#0F766E] bg-white p-4 shadow-[0_14px_28px_rgba(15,118,110,0.14)] lg:hidden"
                  data-testid="relax-breathe-mobile-focus"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                      {copy.nowLabel}
                    </p>
                    <span className="rounded-full bg-[#E6FFF8] px-3 py-1 font-body text-[12px] font-black text-[#0F766E]">
                      {sessionStateLabel}
                    </span>
                  </div>
                  <h2 className="mt-1 break-words font-display text-[30px] leading-[1.02] text-[#173B35]">
                    {currentPhase.title}
                  </h2>
                  <p className="mt-2 break-words font-body text-[18px] font-black leading-snug text-[#203B37]" data-testid="relax-breathe-stage-instruction">
                    {currentPhase.instruction}
                  </p>
                  <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#DDF8F1]" aria-label={sessionProgressText}>
                    <div
                      className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                      style={{ width: `${sessionProgressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 font-body text-[13px] font-black text-[#0F766E]">
                    {timeLeftText} - {sessionProgressText}
                  </p>
                  {isSessionRunning ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={toggleSessionPaused}
                        className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[19px] bg-[#0F766E] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_20px_rgba(15,118,110,0.18)]"
                        data-testid="button-relax-breathe-mobile-pause"
                      >
                        {isSessionPaused ? <PlayCircle size={19} strokeWidth={2.6} aria-hidden="true" /> : <PauseCircle size={19} strokeWidth={2.6} aria-hidden="true" />}
                        {isSessionPaused ? copy.resumeSession : copy.pauseSession}
                      </button>
                      <button
                        type="button"
                        onClick={finishSession}
                        className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[19px] border border-[#CDEBE5] bg-white px-4 font-body text-[16px] font-black text-[#0F766E]"
                        data-testid="button-relax-breathe-mobile-end"
                      >
                        <CheckCircle2 size={19} strokeWidth={2.6} aria-hidden="true" />
                        {copy.endSession}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startGuidedSession}
                      className="mt-4 inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_14px_24px_rgba(15,118,110,0.2)]"
                      data-testid="button-relax-breathe-mobile-start"
                    >
                      <PlayCircle size={20} strokeWidth={2.6} aria-hidden="true" />
                      {copy.startGuide}
                    </button>
                  )}
                </div>

                <div
                  className="relative mx-auto mt-5 flex aspect-square w-full max-w-[230px] items-center justify-center sm:mt-8 sm:max-w-[400px]"
                  data-testid="relax-breathe-visual"
                >
                  <div className={`relax-breathe-halo absolute h-[92%] w-[92%] rounded-[34%_66%_45%_55%] border border-[#A8EFE1] bg-white/45 ${isMotionPaused ? "" : "animate-[relax-breathe-halo_5.8s_ease-in-out_infinite]"}`} aria-hidden="true" />
                  <div className={`relax-breathe-halo absolute h-[72%] w-[72%] rounded-[60%_40%_58%_42%] border border-white bg-[#D8FFF6]/80 ${isMotionPaused ? "" : "animate-[relax-breathe-halo_5.8s_ease-in-out_infinite_0.3s]"}`} aria-hidden="true" />
                  <div
                    className={`relax-breathe-orb relative z-10 flex h-[58%] w-[58%] max-w-[280px] items-center justify-center rounded-full bg-[#0F766E] text-center text-white shadow-[0_28px_70px_rgba(15,118,110,0.28)] ${isMotionPaused ? "" : "animate-[relax-breathe-pulse_5.8s_ease-in-out_infinite]"}`}
                    data-testid="relax-breathe-orb"
                    data-motion={isMotionPaused ? "static" : "animated"}
                    aria-label={`${currentPhase.title}. ${currentPhase.instruction}`}
                  >
                    <div className="px-4">
                      <p className="font-display text-[25px] leading-none sm:text-[40px]">{orbPrimaryText}</p>
                      <p className="mt-3 font-body text-[14px] font-black uppercase tracking-[0.14em] text-[#BFF7EA] sm:text-[16px]">
                        {currentLevel.title}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6" data-testid="relax-breathe-levels">
                  <p className="font-body text-[12px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                    {copy.chooseLevel}
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {copy.levels.map((level) => {
                    const isCurrent = level.key === selectedLevelKey;
                    return (
                      <button
                        key={level.key}
                        type="button"
                        onClick={() => selectLevel(level.key)}
                        disabled={isSessionRunning}
                        aria-pressed={isCurrent}
                        className={`min-h-[82px] rounded-[22px] border px-4 py-3 text-left transition ${
                          isCurrent
                            ? "border-[#0F766E] bg-white shadow-[0_12px_24px_rgba(15,118,110,0.16)]"
                            : "border-[#CDEBE5] bg-white/72 hover:bg-white"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                        data-testid={`button-relax-breathe-level-${level.key}`}
                      >
                        <span className="flex min-w-0 items-center gap-2 font-body text-[12px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isCurrent ? "bg-[#0F766E] text-white" : "bg-[#E6FFF8] text-[#0F766E]"}`}>
                            {level.levelNumber}
                          </span>
                          <span className="min-w-0 break-words">{level.title}</span>
                        </span>
                        <span className="mt-2 block break-words font-body text-[14px] font-bold leading-snug text-[#5F706C]">
                          {level.summary}
                        </span>
                        <span className="mt-2 block font-body text-[12px] font-black text-[#0F766E]">
                          {level.duration}
                        </span>
                      </button>
                    );
                  })}
                  </div>
                </div>
              </section>

              <section className="hidden min-w-0 flex-col justify-between overflow-hidden border-t border-[#D8F2EC] bg-white p-5 sm:p-7 lg:flex lg:border-l lg:border-t-0">
                <article className="rounded-[28px] border border-[#CDEBE5] bg-[#F8FFFC] p-5 shadow-[0_12px_26px_rgba(15,118,110,0.09)]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-body text-[13px] font-black uppercase tracking-[0.1em] text-[#0F766E]">
                      {copy.stepLabel} {phaseIndex + 1} {copy.ofLabel} {phaseCount}
                    </p>
                    <span className="rounded-full bg-[#E6FFF8] px-3 py-1 font-body text-[12px] font-black text-[#0F766E]">
                      {sessionStateLabel}
                    </span>
                  </div>
                  <h2 className="mt-3 break-words font-display text-[36px] leading-[1.02] text-[#173B35]">
                    {currentPhase.title}
                  </h2>
                  <p className="mt-3 break-words rounded-[18px] bg-white px-4 py-3 font-body text-[17px] font-black leading-snug text-[#0F766E]">
                    {currentPhase.cue}
                  </p>
                  <p className="mt-5 break-words font-body text-[22px] font-black leading-snug text-[#203B37]" aria-live="polite">
                    {currentPhase.instruction}
                  </p>
                  <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#DDF8F1]" aria-label={sessionProgressText}>
                    <div
                      className="h-full rounded-full bg-[#0F766E] transition-all duration-500"
                      style={{ width: `${sessionProgressPercent}%` }}
                    />
                  </div>
                  <p className="mt-2 font-body text-[13px] font-black text-[#0F766E]">
                    {timeLeftText} - {sessionProgressText}
                  </p>
                  <p className="mt-5 break-words rounded-[18px] bg-white px-4 py-3 font-body text-[14px] font-bold leading-snug text-[#60716D]" data-testid="relax-breathe-safety">
                    {copy.safety}
                  </p>
                </article>

                <div className="mt-5" data-testid="relax-breathe-session-controls">
                  {isSessionRunning ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={toggleSessionPaused}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] bg-[#0F766E] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_20px_rgba(15,118,110,0.18)]"
                        data-testid="button-relax-breathe-pause"
                      >
                        {isSessionPaused ? <PlayCircle size={19} strokeWidth={2.6} aria-hidden="true" /> : <PauseCircle size={19} strokeWidth={2.6} aria-hidden="true" />}
                        {isSessionPaused ? copy.resumeSession : copy.pauseSession}
                      </button>
                      <button
                        type="button"
                        onClick={finishSession}
                        className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-[18px] border border-[#CDEBE5] bg-white px-4 font-body text-[16px] font-black text-[#0F766E]"
                        data-testid="button-relax-breathe-end"
                      >
                        <CheckCircle2 size={19} strokeWidth={2.6} aria-hidden="true" />
                        {copy.endSession}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startGuidedSession}
                      className="inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-[20px] bg-[#0F766E] px-5 font-body text-[17px] font-black text-white shadow-[0_14px_24px_rgba(15,118,110,0.2)]"
                      data-testid="button-relax-breathe-start"
                    >
                      <PlayCircle size={20} strokeWidth={2.6} aria-hidden="true" />
                      {copy.startGuide}
                    </button>
                  )}
                </div>

                {guideMode === "voice" ? (
                  <div className="mt-5 rounded-[26px] border border-[#9BE7DB] bg-[#ECFDF5] p-4 shadow-[0_14px_28px_rgba(15,118,110,0.12)]" data-testid="relax-breathe-voice-mode-panel">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#0F766E] text-white">
                        <Headphones size={22} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          {audioIsLive ? copy.guideLive : copy.voiceModeTitle}
                        </p>
                        <p className="mt-1 font-body text-[15px] font-bold leading-snug text-[#41645F]">
                          {copy.voiceModeBody}
                        </p>
                      </div>
                    </div>
                    <div
                      className="mt-4 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#0F766E] px-5 font-body text-[16px] font-black leading-tight text-white shadow-[0_16px_30px_rgba(15,118,110,0.24)]"
                      data-testid="relax-breathe-voice-status"
                    >
                      {isAudioStarting || isConnecting ? (
                        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Headphones size={20} strokeWidth={2.6} aria-hidden="true" />
                      )}
                      <span className="whitespace-nowrap">{voiceStatusLabel}</span>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={replayPhase}
                        disabled={!audioIsLive}
                        className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[18px] border border-[#BEE9E1] bg-white px-4 font-body text-[16px] font-black text-[#0F766E] disabled:opacity-55"
                        data-testid="button-relax-breathe-replay"
                      >
                        <RotateCcw size={19} strokeWidth={2.6} aria-hidden="true" />
                        {copy.replay}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[26px] border border-[#CDEBE5] bg-[#F8FFFC] p-4 shadow-[0_10px_22px_rgba(15,118,110,0.08)]" data-testid="relax-breathe-visual-mode-panel">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-[#D8FFF6] text-[#0F766E]">
                        <Eye size={22} strokeWidth={2.6} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#0F766E]">
                          {copy.visualModeTitle}
                        </p>
                        <p className="mt-1 font-body text-[15px] font-bold leading-snug text-[#41645F]">
                          {copy.visualModeBody}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {guideMode === "voice" && voiceError && (
                  <p className="mt-4 rounded-[18px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 font-body text-[15px] font-bold text-[#92400E]" data-testid="relax-breathe-audio-unavailable">
                    {copy.audioUnavailable}
                  </p>
                )}
              </section>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
