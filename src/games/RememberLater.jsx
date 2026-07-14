import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Check,
  Circle,
  CircleHelp,
  Flag,
  Heart,
  KeyRound,
  Leaf,
  Loader2,
  Moon,
  Music,
  Play,
  Sparkles,
  Square,
  Star,
  Triangle,
} from "lucide-react";
import { useLanguage } from "@/i18n";
import vyvaLogo from "@/assets/vyva-logo.png";
import { gameData } from "./shared/gameDataApi";
import { recordCognitiveSession } from "./shared/brainCoachSessions";
import { normalizeGameLanguage } from "./shared/language";

const BRAND = {
  purple: "#6B21A8",
  gold: "#F59E0B",
  bg: "#FAF9F6",
  ink: "#2B2233",
  muted: "#5B4A61",
  border: "#E7D8F3",
  softPurple: "#F3E8FF",
  teal: "#0F766E",
  tealPale: "#DDF7F1",
};

const MAX_TIER = 10;
const LEVEL_LOSS_ACCURACY_PCT = 30;
const LEVEL_REQUIREMENTS = [
  { maxTier: 1, combinedAccuracyPct: 60, matchingAccuracyPct: 50 },
  { maxTier: 2, combinedAccuracyPct: 65, matchingAccuracyPct: 60 },
  { maxTier: MAX_TIER, combinedAccuracyPct: 70, matchingAccuracyPct: 65 },
];
const ROUND_TUNING = [
  { maxTier: 1, minIntervalMs: 2000, maxItems: 6, tailSeconds: 2 },
  { maxTier: 2, minIntervalMs: 1750, maxItems: 8, tailSeconds: 2 },
  { maxTier: 3, minIntervalMs: 1550, maxItems: 10, tailSeconds: 2 },
  { maxTier: MAX_TIER, minIntervalMs: 0, maxItems: Infinity, tailSeconds: 0 },
];
const LOCAL_TUTORIAL_KEY = "rememberLater:tutorialSeen:v1";

const COLOR_HEX = {
  red: "#DC2626",
  blue: "#2563EB",
  yellow: "#F59E0B",
};

const CUE_ICON_COMPONENTS = {
  bell: Bell,
  moon: Moon,
  key: KeyRound,
  leaf: Leaf,
  heart: Heart,
  sparkle: Sparkles,
  flag: Flag,
  music: Music,
};

const FALLBACK_ROUND = {
  id: null,
  round_type: "event_based",
  difficulty_tier: 1,
  round_duration_seconds: 24,
  ongoing_task_rule: "shape_circle",
  filler_stream: [
    { type: "shape", value: "circle", matches_rule: true },
    { type: "shape", value: "square", matches_rule: false },
    { type: "shape", value: "triangle", matches_rule: false },
    { type: "shape", value: "circle", matches_rule: true },
    { type: "icon", value: "cue", icon: "cue", matches_rule: false, cue: true },
    { type: "shape", value: "square", matches_rule: false },
    { type: "shape", value: "circle", matches_rule: true },
    { type: "shape", value: "triangle", matches_rule: false },
  ],
  filler_item_count: 8,
  filler_item_interval_ms: 1600,
  intentions: [{ type: "event", cue_icon: "bell", cue_position_index: 4, response_window_items: 3 }],
  is_local_practice: true,
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
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

function localDayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

function getTierProfile(profiles, tier) {
  return profiles.find((profile) => tier <= profile.maxTier) ?? profiles[profiles.length - 1];
}

export function getRememberLaterLevelRequirements(tier = 1) {
  return getTierProfile(LEVEL_REQUIREMENTS, clamp(Number(tier ?? 1), 1, MAX_TIER));
}

function getRememberLaterRoundTuning(tier = 1) {
  return getTierProfile(ROUND_TUNING, clamp(Number(tier ?? 1), 1, MAX_TIER));
}

export function isRememberLaterCountedRound(result) {
  if (!result || result.abandoned || result.pm_hits < 1) return false;
  const requirements = getRememberLaterLevelRequirements(result.difficulty_tier);
  return (
    Number(result.combined_accuracy_pct ?? 0) >= requirements.combinedAccuracyPct
    && Number(result.ongoing_accuracy_pct ?? 0) >= requirements.matchingAccuracyPct
  );
}

function tuneFillerStreamForTier(fillerStream, intentions, tier) {
  const tuning = getRememberLaterRoundTuning(tier);
  if (!Number.isFinite(tuning.maxItems) || fillerStream.length <= tuning.maxItems) return fillerStream;

  const lastRequiredCueIndex = intentions.reduce((lastIndex, intention) => {
    if (intention?.type !== "event") return lastIndex;
    return Math.max(lastIndex, Number(intention.cue_position_index ?? 0));
  }, 0);
  const targetCount = Math.min(
    fillerStream.length,
    Math.max(tuning.maxItems, lastRequiredCueIndex + 1),
  );

  return fillerStream.slice(0, targetCount);
}

export function getDefaultRememberLaterUserState(userId) {
  return {
    user_id: userId,
    current_tier: 1,
    sessions_at_tier: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    total_sessions: 0,
    best_score: 0,
    has_seen_tutorial: false,
    last_played_at: null,
    streak_days: 0,
    last_streak_date: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeRememberLaterRound(row) {
  const fillerStream = asArray(row?.filler_stream);
  const intentions = asArray(row?.intentions);
  const difficultyTier = clamp(Number(row?.difficulty_tier ?? 1), 1, MAX_TIER);
  const tuning = getRememberLaterRoundTuning(difficultyTier);
  const tunedFillerStream = tuneFillerStreamForTier(fillerStream, intentions, difficultyTier);
  const intervalMs = Math.max(Number(row?.filler_item_interval_ms ?? 1600), tuning.minIntervalMs);
  const suppliedDurationSeconds = Number(row?.round_duration_seconds ?? 30);
  const durationSeconds = tuning.tailSeconds > 0
    ? Math.max(suppliedDurationSeconds, Math.ceil((tunedFillerStream.length * intervalMs) / 1000) + tuning.tailSeconds)
    : suppliedDurationSeconds;

  return {
    ...row,
    round_type: row?.round_type ?? "event_based",
    difficulty_tier: difficultyTier,
    round_duration_seconds: durationSeconds,
    ongoing_task_rule: row?.ongoing_task_rule ?? "shape_circle",
    filler_stream: tunedFillerStream,
    filler_item_count: tunedFillerStream.length,
    filler_item_interval_ms: intervalMs,
    intentions,
  };
}

export function pickRememberLaterRound(rounds, todaySessions = [], historySessions = [], random = Math.random) {
  const normalizedRounds = rounds.map(normalizeRememberLaterRound).filter((round) => round.filler_stream.length > 0);
  const usedToday = new Set(todaySessions.map((session) => session.round_id).filter(Boolean));
  const unusedToday = normalizedRounds.filter((round) => !usedToday.has(round.id));

  if (unusedToday.length > 0) {
    return unusedToday[Math.floor(random() * unusedToday.length)];
  }

  const lastPlayed = new Map();
  historySessions.forEach((session) => {
    if (!session.round_id || !session.played_at) return;
    const previous = lastPlayed.get(session.round_id);
    if (!previous || session.played_at > previous) {
      lastPlayed.set(session.round_id, session.played_at);
    }
  });

  return [...normalizedRounds].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0] ?? null;
}

export function computeRememberLaterScore(input) {
  const round = normalizeRememberLaterRound(input.round ?? FALLBACK_ROUND);
  const seenItemCount = clamp(Number(input.seenItemCount ?? round.filler_stream.length), 0, round.filler_stream.length);
  const seenItems = round.filler_stream.slice(0, seenItemCount);
  const tapped = new Set(input.ongoingTappedIndices ?? []);
  const matchingIndices = seenItems
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item.matches_rule))
    .map(({ index }) => index);
  const ongoingTotal = matchingIndices.length;
  const ongoingCorrect = matchingIndices.filter((index) => tapped.has(index)).length;
  const ongoingAccuracyPct = ongoingTotal > 0 ? (ongoingCorrect / ongoingTotal) * 100 : 0;
  const intentionResults = (input.intentionStates ?? round.intentions.map((intention) => ({ intention, hit: false }))).map((state) => ({
    type: state.intention?.type ?? state.type,
    cue_icon: state.intention?.cue_icon,
    hit: Boolean(state.hit),
    response_delay_items: state.response_delay_items ?? null,
    timing_error_seconds: state.timing_error_seconds ?? null,
  }));
  const pmTotal = Math.max(1, round.intentions.length);
  const pmHits = intentionResults.filter((entry) => entry.hit).length;
  const pmAccuracyPct = (pmHits / pmTotal) * 100;
  const score = Math.round((ongoingAccuracyPct * 4) + (pmAccuracyPct * 6));
  const timingErrors = intentionResults
    .map((entry) => entry.timing_error_seconds)
    .filter((value) => Number.isFinite(value));

  return {
    round_id: round.id ?? null,
    difficulty_tier: round.difficulty_tier,
    round_type: round.round_type,
    ongoing_correct: ongoingCorrect,
    ongoing_total: ongoingTotal,
    ongoing_false_alarms: Number(input.ongoingFalseAlarms ?? 0),
    ongoing_accuracy_pct: Number(ongoingAccuracyPct.toFixed(2)),
    intention_results: intentionResults,
    pm_hits: pmHits,
    pm_total: pmTotal,
    pm_false_alarms: Number(input.pmFalseAlarms ?? 0),
    pm_accuracy_pct: Number(pmAccuracyPct.toFixed(2)),
    avg_timing_error_seconds: timingErrors.length
      ? Number((timingErrors.reduce((total, value) => total + Math.abs(value), 0) / timingErrors.length).toFixed(2))
      : null,
    combined_accuracy_pct: Number(((ongoingAccuracyPct * 0.4) + (pmAccuracyPct * 0.6)).toFixed(2)),
    score,
    completed: !input.abandoned,
    abandoned: Boolean(input.abandoned),
    duration_seconds: Number(input.durationSeconds ?? 0),
  };
}

export function getNextRememberLaterStateAfterSession(previousState, result, now = new Date()) {
  if (result.abandoned) return previousState;

  const previous = previousState ?? getDefaultRememberLaterUserState(result.user_id ?? "");
  const today = todayKey(now);
  const yesterday = todayKey(addDays(now, -1));
  const isWin = isRememberLaterCountedRound(result);
  const isLoss = result.combined_accuracy_pct < LEVEL_LOSS_ACCURACY_PCT;
  let consecutiveWins = isWin ? Number(previous.consecutive_wins ?? 0) + 1 : 0;
  let consecutiveLosses = isLoss ? Number(previous.consecutive_losses ?? 0) + 1 : 0;
  let currentTier = clamp(Number(previous.current_tier ?? 1), 1, MAX_TIER);
  let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;

  if (consecutiveWins >= 3) {
    currentTier = clamp(currentTier + 1, 1, MAX_TIER);
    sessionsAtTier = 0;
    consecutiveWins = 0;
    consecutiveLosses = 0;
  } else if (consecutiveLosses >= 3) {
    currentTier = clamp(currentTier - 1, 1, MAX_TIER);
    sessionsAtTier = 0;
    consecutiveWins = 0;
    consecutiveLosses = 0;
  }

  const lastStreakDate = previous.last_streak_date;
  const streakDays =
    lastStreakDate === today
      ? Number(previous.streak_days ?? 1)
      : lastStreakDate === yesterday
        ? Number(previous.streak_days ?? 0) + 1
        : 1;

  return {
    ...previous,
    current_tier: currentTier,
    sessions_at_tier: sessionsAtTier,
    consecutive_wins: consecutiveWins,
    consecutive_losses: consecutiveLosses,
    total_sessions: Number(previous.total_sessions ?? 0) + 1,
    best_score: Math.max(Number(previous.best_score ?? 0), Number(result.score ?? 0)),
    last_played_at: now.toISOString(),
    streak_days: streakDays,
    last_streak_date: today,
    updated_at: now.toISOString(),
  };
}

function readLocalTutorialSeen() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(LOCAL_TUTORIAL_KEY) === "true";
}

function writeLocalTutorialSeen() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_TUTORIAL_KEY, "true");
}

function CueIcon({ icon = "bell", size = 72, className = "" }) {
  const Icon = CUE_ICON_COMPONENTS[icon] ?? Bell;
  return <Icon aria-hidden="true" size={size} strokeWidth={2.5} className={className} />;
}

function readableKey(value) {
  return String(value ?? "").replaceAll("_", " ");
}

function ruleLabel(rule, t) {
  return t(`games.rememberLater.rules.${rule}`, readableKey(rule));
}

function shortRuleLabel(rule, t) {
  return t(`games.rememberLater.shortRules.${rule}`, ruleLabel(rule, t));
}

function cueLabel(icon, t) {
  return t(`games.rememberLater.cueLabels.${icon}`, readableKey(icon));
}

function sentenceCase(value) {
  const text = String(value ?? "").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

function RuleVisual({ rule, size = 52 }) {
  if (rule === "shape_square") return <Square size={size} strokeWidth={2.5} />;
  if (rule === "shape_triangle") return <Triangle size={size} strokeWidth={2.5} />;
  if (rule === "color_red" || rule === "color_blue" || rule === "color_yellow") {
    const color = COLOR_HEX[rule.replace("color_", "")] ?? BRAND.purple;
    return <Circle size={size} strokeWidth={2.5} fill={color} color={color} />;
  }
  if (rule === "number_even" || rule === "number_odd") {
    return <span className="font-display text-[42px] leading-none">{rule === "number_even" ? "2" : "3"}</span>;
  }
  return <Circle size={size} strokeWidth={2.5} />;
}

function Stimulus({ item, cueIcon }) {
  if (!item) return null;
  if (item.cue) {
    return (
      <div className="flex h-[132px] w-[132px] items-center justify-center rounded-[36px] bg-[#FFF7ED] text-[#B45309] shadow-vyva-card">
        <CueIcon icon={cueIcon} size={76} />
      </div>
    );
  }

  if (item.type === "number") {
    return (
      <div className="flex h-[132px] w-[132px] items-center justify-center rounded-[34px] bg-[#F8FAFC] text-[64px] font-black text-[#2B2233] shadow-vyva-card">
        {item.value}
      </div>
    );
  }

  if (item.type === "color") {
    return (
      <div
        className="h-[132px] w-[132px] rounded-[34px] border-[10px] border-white shadow-vyva-card"
        style={{ background: COLOR_HEX[item.value] ?? BRAND.purple }}
      />
    );
  }

  const shapeClass = "h-[116px] w-[116px] text-[#6B21A8]";
  if (item.value === "square") return <Square aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
  if (item.value === "triangle") return <Triangle aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
  return <Circle aria-hidden="true" className={shapeClass} strokeWidth={2.2} />;
}

function useLatestRef(value) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export default function RememberLater({
  userId,
  onExit,
  assessmentPractice = null,
  onAssessmentPracticeComplete,
  onAssessmentPracticeReturn,
}) {
  const { language, t } = useLanguage();
  const gameLanguage = normalizeGameLanguage(language);
  const [screen, setScreen] = useState("loading");
  const [round, setRound] = useState(null);
  const [userState, setUserState] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionResult, setSessionResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const roundRef = useLatestRef(round);
  const screenRef = useLatestRef(screen);
  const userStateRef = useLatestRef(userState);
  const intervalRef = useRef(null);
  const durationTimerRef = useRef(null);
  const roundStartRef = useRef(null);
  const streamDoneRef = useRef(false);
  const durationDoneRef = useRef(false);
  const finalizingRef = useRef(false);
  const sessionSavedRef = useRef(false);
  const ongoingTappedRef = useRef(new Set());
  const ongoingFalseAlarmsRef = useRef(0);
  const pmFalseAlarmsRef = useRef(0);
  const intentionStatesRef = useRef([]);
  const seenItemCountRef = useRef(0);

  const normalizedRound = useMemo(() => round ? normalizeRememberLaterRound(round) : null, [round]);
  const currentItem = normalizedRound?.filler_stream[currentIndex] ?? null;
  const firstCueIcon = normalizedRound?.intentions.find((intention) => intention.type === "event")?.cue_icon ?? "bell";

  const stopTimers = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (durationTimerRef.current) window.clearTimeout(durationTimerRef.current);
    intervalRef.current = null;
    durationTimerRef.current = null;
  }, []);

  const loadUserState = useCallback(async () => {
    if (!userId) {
      return {
        ...getDefaultRememberLaterUserState(""),
        has_seen_tutorial: readLocalTutorialSeen(),
      };
    }

    const { data, error } = await gameData
      .table("remember_later_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) return data;
    if (error) {
      console.warn("Remember Later could not load progress state.", error);
    }

    const fallback = getDefaultRememberLaterUserState(userId);
    const saved = await gameData
      .table("remember_later_user_state")
      .upsert(fallback, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) return saved.data;
    if (saved.error) {
      console.warn("Remember Later could not create progress state.", saved.error);
    }
    return fallback;
  }, [userId]);

  const loadRound = useCallback(async (tier) => {
    if (!userId) return normalizeRememberLaterRound(FALLBACK_ROUND);

    const { start, end } = localDayBounds();
    const [todaySessionsResult, roundsResult] = await Promise.all([
      gameData
        .table("remember_later_sessions")
        .select("round_id")
        .eq("user_id", userId)
        .gte("played_at", start.toISOString())
        .lt("played_at", end.toISOString()),
      gameData
        .table("remember_later_rounds")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true),
    ]);

    if (roundsResult.error) throw roundsResult.error;
    if (todaySessionsResult.error) {
      console.warn("Remember Later could not load today's rounds.", todaySessionsResult.error);
    }

    const freshRound = pickRememberLaterRound(roundsResult.data ?? [], todaySessionsResult.data ?? []);
    if (freshRound && !(todaySessionsResult.data ?? []).some((session) => session.round_id === freshRound.id)) {
      return freshRound;
    }

    const historyResult = await gameData
      .table("remember_later_sessions")
      .select("round_id, played_at")
      .eq("user_id", userId)
      .not("round_id", "is", null)
      .order("played_at", { ascending: false })
      .limit(500);

    if (historyResult.error) {
      console.warn("Remember Later could not load round history.", historyResult.error);
    }

    return pickRememberLaterRound(roundsResult.data ?? [], todaySessionsResult.data ?? [], historyResult.data ?? []) ?? normalizeRememberLaterRound(FALLBACK_ROUND);
  }, [userId]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadError("");
    stopTimers();
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    try {
      const state = await loadUserState();
      const nextRound = await loadRound(Number(state.current_tier ?? 1));
      setUserState(state);
      setRound(nextRound);
      setCurrentIndex(0);
      setSessionResult(null);
      setScreen("intro");
    } catch (error) {
      console.warn("Remember Later could not load.", error);
      setUserState({
        ...getDefaultRememberLaterUserState(userId ?? ""),
        has_seen_tutorial: readLocalTutorialSeen(),
      });
      setRound(normalizeRememberLaterRound(FALLBACK_ROUND));
      setLoadError(t("games.rememberLater.practiceFallback", "We will use a short practice round."));
      setScreen("intro");
    }
  }, [loadRound, loadUserState, stopTimers, t, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      stopTimers();
    };
  }, [loadGame, stopTimers]);

  const saveSession = useCallback(async (result) => {
    if (sessionSavedRef.current) return null;
    sessionSavedRef.current = true;

    if (!userId) return null;

    const payload = {
      user_id: userId,
      round_id: result.round_id,
      difficulty_tier: result.difficulty_tier,
      round_type: result.round_type,
      ongoing_correct: result.ongoing_correct,
      ongoing_total: result.ongoing_total,
      ongoing_false_alarms: result.ongoing_false_alarms,
      ongoing_accuracy_pct: result.ongoing_accuracy_pct,
      intention_results: result.intention_results,
      pm_hits: result.pm_hits,
      pm_total: result.pm_total,
      pm_false_alarms: result.pm_false_alarms,
      pm_accuracy_pct: result.pm_accuracy_pct,
      avg_timing_error_seconds: result.avg_timing_error_seconds,
      score: result.score,
      completed: result.completed,
      abandoned: result.abandoned,
      duration_seconds: result.duration_seconds,
    };

    const saved = await gameData
      .table("remember_later_sessions")
      .insert(payload)
      .select("*")
      .single();

    if (saved.error) {
      console.warn("Remember Later could not save the session.", saved.error);
      sessionSavedRef.current = false;
    }

    await recordCognitiveSession({
      userId,
      activityType: "remember_later",
      domain: "prospective_memory",
      secondaryDomain: "attention",
      difficulty: result.difficulty_tier,
      difficultyScale: "tier",
      completed: result.completed,
      abandoned: result.abandoned,
      score: result.score,
      accuracyPct: result.pm_accuracy_pct,
      speedPct: result.ongoing_accuracy_pct,
      durationSeconds: result.duration_seconds,
      language: gameLanguage,
      source: "remember_later",
      sourceTable: "remember_later_sessions",
      sourceSessionId: saved.data?.id ?? null,
      metadata: {
        roundId: result.round_id,
        roundType: result.round_type,
        pmHits: result.pm_hits,
        pmTotal: result.pm_total,
        pmFalseAlarms: result.pm_false_alarms,
        ongoingFalseAlarms: result.ongoing_false_alarms,
        avgTimingErrorSeconds: result.avg_timing_error_seconds,
        intentionResults: result.intention_results,
      },
    });

    return saved.data ?? null;
  }, [gameLanguage, userId]);

  const updateUserState = useCallback(async (result) => {
    if (!userId) {
      const next = getNextRememberLaterStateAfterSession(userStateRef.current, result);
      setUserState(next);
      return next;
    }

    const latestState = await loadUserState().catch(() => userStateRef.current);
    const next = getNextRememberLaterStateAfterSession(latestState, result);
    setUserState(next);

    const saved = await gameData
      .table("remember_later_user_state")
      .upsert(next, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) {
      setUserState(saved.data);
      return saved.data;
    }

    if (saved.error) {
      console.warn("Remember Later could not save progress state.", saved.error);
    }

    return next;
  }, [loadUserState, userId, userStateRef]);

  const finishRound = useCallback(async (abandoned = false) => {
    if (finalizingRef.current) return null;
    finalizingRef.current = true;
    stopTimers();
    setSaving(true);

    const currentRound = roundRef.current ? normalizeRememberLaterRound(roundRef.current) : normalizeRememberLaterRound(FALLBACK_ROUND);
    const startedAt = roundStartRef.current ?? Date.now();
    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const result = computeRememberLaterScore({
      round: currentRound,
      ongoingTappedIndices: [...ongoingTappedRef.current],
      ongoingFalseAlarms: ongoingFalseAlarmsRef.current,
      intentionStates: intentionStatesRef.current,
      pmFalseAlarms: pmFalseAlarmsRef.current,
      seenItemCount: abandoned ? Math.max(1, seenItemCountRef.current) : currentRound.filler_stream.length,
      durationSeconds,
      abandoned,
    });

    await saveSession(result);
    if (!abandoned) await updateUserState(result);
    if (!abandoned) {
      onAssessmentPracticeComplete?.({
        score: result.score,
        accuracyPct: result.pm_accuracy_pct,
        practiceTitle: assessmentPractice?.practiceTitle,
      });
    }
    setSessionResult(result);
    setSaving(false);
    if (!abandoned) setScreen("result");
    return result;
  }, [assessmentPractice, onAssessmentPracticeComplete, roundRef, saveSession, stopTimers, updateUserState]);

  const finishRoundRef = useLatestRef(finishRound);

  useEffect(() => {
    return () => {
      if (screenRef.current === "playing" && !finalizingRef.current) {
        void finishRoundRef.current(true);
      }
    };
  }, [finishRoundRef, screenRef]);

  const maybeFinishRound = useCallback(() => {
    if (streamDoneRef.current && durationDoneRef.current) {
      void finishRound(false);
    }
  }, [finishRound]);

  const startRound = useCallback(() => {
    const currentRound = normalizedRound ?? normalizeRememberLaterRound(FALLBACK_ROUND);
    stopTimers();
    setCurrentIndex(0);
    setSessionResult(null);
    setScreen("playing");
    finalizingRef.current = false;
    sessionSavedRef.current = false;
    streamDoneRef.current = currentRound.filler_stream.length <= 1;
    durationDoneRef.current = false;
    ongoingTappedRef.current = new Set();
    ongoingFalseAlarmsRef.current = 0;
    pmFalseAlarmsRef.current = 0;
    seenItemCountRef.current = 1;
    roundStartRef.current = Date.now();
    intentionStatesRef.current = currentRound.intentions.map((intention) => ({ intention, hit: false }));

    intervalRef.current = window.setInterval(() => {
      setCurrentIndex((previous) => {
        const next = previous + 1;
        if (next >= currentRound.filler_stream.length) {
          streamDoneRef.current = true;
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          intervalRef.current = null;
          maybeFinishRound();
          return previous;
        }
        seenItemCountRef.current = next + 1;
        return next;
      });
    }, currentRound.filler_item_interval_ms);

    durationTimerRef.current = window.setTimeout(() => {
      durationDoneRef.current = true;
      maybeFinishRound();
    }, currentRound.round_duration_seconds * 1000);
  }, [maybeFinishRound, normalizedRound, stopTimers]);

  const markTutorialSeen = useCallback(async () => {
    const next = {
      ...(userStateRef.current ?? getDefaultRememberLaterUserState(userId ?? "")),
      has_seen_tutorial: true,
      updated_at: new Date().toISOString(),
    };
    setUserState(next);

    if (!userId) {
      writeLocalTutorialSeen();
      return;
    }

    const saved = await gameData
      .table("remember_later_user_state")
      .upsert(next, { onConflict: "user_id" })
      .select("*")
      .single();

    if (saved.data) setUserState(saved.data);
  }, [userId, userStateRef]);

  const beginAfterIntro = useCallback(() => {
    if (userState?.has_seen_tutorial) {
      startRound();
      return;
    }
    setScreen("tutorial");
  }, [startRound, userState?.has_seen_tutorial]);

  const finishTutorial = useCallback(async () => {
    await markTutorialSeen();
    startRound();
  }, [markTutorialSeen, startRound]);

  const handleOngoingTap = useCallback(() => {
    if (screenRef.current !== "playing" || !roundRef.current) return;
    const currentRound = normalizeRememberLaterRound(roundRef.current);
    const item = currentRound.filler_stream[currentIndex];
    if (!item) return;

    if (item.matches_rule) {
      ongoingTappedRef.current.add(currentIndex);
    } else {
      ongoingFalseAlarmsRef.current += 1;
    }
  }, [currentIndex, roundRef, screenRef]);

  const handleIntentionTap = useCallback(() => {
    if (screenRef.current !== "playing" || !roundRef.current || !roundStartRef.current) return;
    const elapsedSeconds = (Date.now() - roundStartRef.current) / 1000;
    let anyHit = false;

    intentionStatesRef.current = intentionStatesRef.current.map((state) => {
      if (state.hit) return state;
      const intention = state.intention;
      if (intention.type === "event") {
        const start = Number(intention.cue_position_index);
        const end = start + Number(intention.response_window_items ?? 0);
        if (currentIndex >= start && currentIndex <= end) {
          anyHit = true;
          return {
            ...state,
            hit: true,
            response_delay_items: Math.max(0, currentIndex - start),
          };
        }
      }

      if (intention.type === "time") {
        const target = Number(intention.target_delay_seconds);
        const tolerance = Number(intention.tolerance_seconds);
        if (elapsedSeconds >= target - tolerance && elapsedSeconds <= target + tolerance) {
          anyHit = true;
          return {
            ...state,
            hit: true,
            timing_error_seconds: Number((elapsedSeconds - target).toFixed(2)),
          };
        }
      }

      return state;
    });

    if (!anyHit) pmFalseAlarmsRef.current += 1;
  }, [currentIndex, roundRef, screenRef]);

  const exitGame = useCallback(async () => {
    if (screenRef.current === "playing") {
      await finishRound(true);
    }
    onExit?.();
  }, [finishRound, onExit, screenRef]);

  const resultToneHit = (sessionResult?.pm_hits ?? 0) > 0;
  const nextTier = userState?.current_tier ?? normalizedRound?.difficulty_tier ?? 1;
  const progressWins = userState?.consecutive_wins ?? 0;
  const ongoingRuleLabel = normalizedRound ? ruleLabel(normalizedRound.ongoing_task_rule, t) : "";
  const ongoingRuleShortLabel = normalizedRound ? shortRuleLabel(normalizedRound.ongoing_task_rule, t) : "";
  const matchButtonLabel = normalizedRound
    ? t("games.rememberLater.matchButtonLabel", "Tap when you see {rule}", { rule: ongoingRuleLabel })
    : t("games.rememberLater.tapButtonShort", "Tap when it matches");
  const firstIntention = normalizedRound?.intentions[0] ?? null;
  const firstCueLabel = cueLabel(firstCueIcon, t);
  const firstCuePromptLabel = sentenceCase(firstCueLabel);
  const matchActionLabel = normalizedRound
    ? t("games.rememberLater.matchActionLabel", "Tap when you see {rule}", { rule: ongoingRuleLabel })
    : t("games.rememberLater.matchActionFallback", "Target? Tap purple");
  const waitActionLabel = normalizedRound
    ? t("games.rememberLater.waitActionLabel", "No {rule}? Wait", { rule: ongoingRuleShortLabel })
    : t("games.rememberLater.waitActionFallback", "No target? Wait");
  const starActionLabel =
    firstIntention?.type === "event"
      ? t("games.rememberLater.starActionEvent", "{cue}? Tap gold star", { cue: firstCuePromptLabel })
      : t("games.rememberLater.starActionTime", "Later? Tap gold star");
  const starReminderText =
    firstIntention?.type === "event"
      ? t("games.rememberLater.starReminderEvent", "{cue}: tap gold star.", { cue: firstCueLabel })
      : t("games.rememberLater.starReminderTime", "Later: tap gold star.");
  const progressWinsNeeded = Math.max(0, 3 - progressWins);
  const resultCountsForLevel = isRememberLaterCountedRound(sessionResult);
  const promotedThisRound = Boolean(sessionResult && resultCountsForLevel && nextTier > sessionResult.difficulty_tier);
  const resultVerdict = sessionResult
    ? promotedThisRound
      ? t("games.rememberLater.verdictLevelUp", "Level up")
      : resultCountsForLevel
        ? t("games.rememberLater.verdictCounted", "Good round")
        : resultToneHit
          ? t("games.rememberLater.verdictMemoryCredit", "Gold star remembered")
          : t("games.rememberLater.verdictNotCounted", "Try again")
    : "";
  const resultWhy = sessionResult
    ? resultCountsForLevel
      ? t("games.rememberLater.resultWhyCounted", "You used both buttons at the right time.")
      : resultToneHit
        ? t("games.rememberLater.resultWhyMemoryCredit", "You got the gold star. Next time, tap purple for the target too.")
        : t("games.rememberLater.resultWhyNeedsRecall", "To count: tap purple for the target and gold star for the reminder.")
    : "";
  const levelProgressNote = sessionResult
    ? promotedThisRound
      ? t("games.rememberLater.levelProgressPromoted", "Level up. You got 3 counted rounds, so your next round is Level {level}.", { level: nextTier })
      : resultCountsForLevel
        ? t("games.rememberLater.levelProgressCounted", "Good round. {count} more to move up.", { count: progressWinsNeeded })
        : resultToneHit
          ? t("games.rememberLater.levelProgressNeedsBackground", "You remembered the gold star. To count the round, also tap purple for the target.")
          : t("games.rememberLater.levelProgressNeedsRecall", "To count the round, use both buttons: purple for the target and gold star for the reminder.")
    : "";

  if (screen === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
        <section className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin" style={{ color: BRAND.purple }} />
          <p className="mt-5 text-[24px] font-bold">{t("games.rememberLater.preparing", "Preparing the reminder...")}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-6" style={{ background: BRAND.bg, color: BRAND.ink }}>
      <div className="mx-auto w-full max-w-[980px]">
        <header className="flex items-center justify-between gap-4">
          <img src={vyvaLogo} alt="VYVA" className="h-12 w-12 rounded-2xl" />
          <button
            type="button"
            onClick={exitGame}
            className="inline-flex min-h-[64px] items-center gap-2 rounded-full bg-white px-6 text-[22px] font-extrabold shadow-vyva-card"
          >
            <ArrowLeft size={24} />
            {t("common.exit", "Exit")}
          </button>
        </header>

        {screen === "intro" && normalizedRound ? (
          <section className="mt-5 overflow-hidden rounded-[28px] border bg-white shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            {loadError ? <p className="m-5 rounded-2xl bg-[#FFF7ED] px-4 py-3 text-[20px] font-bold text-[#92400E]">{loadError}</p> : null}
            <div className="grid gap-0 md:grid-cols-[1.08fr_0.92fr]">
              <div className="p-5 text-left sm:p-6">
                <p className="inline-flex rounded-full px-4 py-2 text-[17px] font-black sm:text-[18px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  {t("common.level", "Level")} {normalizedRound.difficulty_tier}
                </p>
                <h1 className="mt-3 font-display text-[38px] leading-tight sm:text-[42px]">{t("games.rememberLater.title", "Remember Later")}</h1>
                <p className="mt-2 max-w-[540px] text-[22px] font-extrabold leading-snug sm:text-[24px]" style={{ color: BRAND.muted }}>
                  {t("games.rememberLater.subtitle", "Use two buttons during the round.")}
                </p>

                <div className="mt-5 grid gap-3">
                  <div className="rounded-[24px] border p-3 sm:p-4" style={{ borderColor: BRAND.border, background: BRAND.softPurple }}>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-white sm:h-[76px] sm:w-[76px] sm:rounded-[22px]" style={{ color: BRAND.purple }}>
                        <RuleVisual rule={normalizedRound.ongoing_task_rule} size={48} />
                      </div>
                      <div>
                        <p className="text-[16px] font-black uppercase tracking-[0.04em] sm:text-[18px]" style={{ color: BRAND.muted }}>
                          {t("games.rememberLater.matchButtonHeading", "Purple button")}
                        </p>
                        <p className="mt-1 text-[23px] font-black leading-tight sm:text-[26px]">{matchActionLabel}</p>
                        <p className="text-[17px] font-extrabold sm:text-[19px]" style={{ color: BRAND.muted }}>{waitActionLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border p-3 sm:p-4" style={{ borderColor: "#FDE68A", background: "#FFF7ED" }}>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-[20px] bg-white sm:h-[76px] sm:w-[76px] sm:rounded-[22px]" style={{ color: "#B45309" }}>
                        {firstIntention?.type === "event" ? <CueIcon icon={firstIntention.cue_icon} size={48} /> : <Star size={48} fill="currentColor" />}
                      </div>
                      <div>
                        <p className="text-[16px] font-black uppercase tracking-[0.04em] sm:text-[18px]" style={{ color: BRAND.muted }}>
                          {t("games.rememberLater.starButtonHeading", "Gold star")}
                        </p>
                        <p className="mt-1 text-[23px] font-black leading-tight sm:text-[26px]">{starActionLabel}</p>
                        <p className="text-[17px] font-extrabold sm:text-[19px]" style={{ color: BRAND.muted }}>
                          {t("games.rememberLater.keepInMind", "No reminder during the round.")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t p-5 sm:p-6 md:border-l md:border-t-0" style={{ borderColor: BRAND.border, background: "#FFFEFC" }}>
                <div className="flex h-full min-h-[320px] flex-col justify-between rounded-[26px] border p-5" style={{ borderColor: BRAND.border, background: "#FFFFFF" }}>
                  <div>
                    <p className="text-[18px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>
                      {t("games.rememberLater.roundGoalHeading", "Round goal")}
                    </p>
                    <p className="mt-2 text-[24px] font-black leading-snug">
                      {t("games.rememberLater.countedRoundIntro", "3 good rounds = next level.")}
                    </p>
                  </div>

                  <div className="my-5 grid grid-cols-3 items-center gap-3">
                    <div className="flex min-h-[98px] items-center justify-center rounded-[24px]" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
                      <RuleVisual rule={normalizedRound.ongoing_task_rule} size={54} />
                    </div>
                    <div className="text-center text-[34px] font-black" style={{ color: BRAND.muted }}>+</div>
                    <div className="flex min-h-[98px] items-center justify-center rounded-[24px]" style={{ background: "#FFF7ED", color: BRAND.gold }}>
                      <Star size={54} fill="currentColor" />
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <button
                      type="button"
                      onClick={beginAfterIntro}
                      className="inline-flex min-h-[78px] w-full items-center justify-center gap-3 rounded-full px-6 text-[26px] font-black text-white shadow-vyva-card"
                      style={{ background: BRAND.purple }}
                    >
                      <Play size={30} fill="currentColor" />
                      {t("games.rememberLater.startRound", "Start round")}
                    </button>
                    <p className="text-center text-[18px] font-extrabold leading-snug" style={{ color: BRAND.muted }}>
                      {t("games.rememberLater.noReminder", "Remember both rules after you start.")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "tutorial" ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-between gap-4">
              <h1 className="font-display text-[36px] leading-tight">{t("common.example", "Example")}</h1>
              <button type="button" onClick={finishTutorial} className="min-h-[64px] rounded-full border px-6 text-[22px] font-black" style={{ borderColor: BRAND.border, color: BRAND.purple }}>
                {t("common.skip", "Skip")}
              </button>
            </div>
            <p className="mt-5 text-[24px] font-bold leading-snug" style={{ color: BRAND.muted }}>
              {t("games.rememberLater.tutorialBody", "Tap when you see {rule}. {cue}: tap gold star. Anything else: wait. This is the only example.", { rule: ongoingRuleLabel || "a circle", cue: firstCueLabel })}
            </p>
            <div className="mt-6 grid grid-cols-4 gap-3">
              {[Circle, Square, Bell, Triangle].map((Icon, index) => (
                <div key={index} className="flex min-h-[96px] items-center justify-center rounded-[22px] border bg-[#FFFEFC]" style={{ borderColor: index === 2 ? BRAND.gold : BRAND.border, color: index === 2 ? "#B45309" : BRAND.purple }}>
                  <Icon size={48} />
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-[26px] font-black">{t("games.rememberLater.tutorialReady", "Ready to try it for real?")}</p>
            <button
              type="button"
              onClick={finishTutorial}
              className="mt-5 min-h-[76px] w-full rounded-full px-6 text-[26px] font-black text-white shadow-vyva-card"
              style={{ background: BRAND.purple }}
            >
              {t("games.rememberLater.tryForReal", "Try it for real")}
            </button>
          </section>
        ) : null}

        {screen === "playing" && normalizedRound ? (
          <section className="relative mt-5 rounded-[28px] border bg-white p-5 shadow-vyva-card sm:p-6" style={{ borderColor: BRAND.border }}>
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-[34px] leading-tight">{t("games.rememberLater.title", "Remember Later")}</h1>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[18px] font-black" style={{ background: BRAND.softPurple, color: BRAND.purple }}>
                      <RuleVisual rule={normalizedRound.ongoing_task_rule} size={24} />
                      {matchActionLabel}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[18px] font-black" style={{ background: "#FFF7ED", color: "#B45309" }}>
                      <Star size={24} fill="currentColor" />
                      {starActionLabel}
                    </span>
                  </div>
                </div>
              </div>

              {normalizedRound.round_type === "event_based" ? (
                <div className="h-3 overflow-hidden rounded-full bg-[#EDE9FE]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, ((currentIndex + 1) / normalizedRound.filler_stream.length) * 100)}%`,
                      background: BRAND.purple,
                    }}
                  />
                </div>
              ) : null}

              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[26px] border bg-[#FFFEFC] sm:min-h-[320px]" style={{ borderColor: BRAND.border }}>
                <Stimulus item={currentItem} cueIcon={firstCueIcon} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleOngoingTap}
                  aria-label={matchButtonLabel}
                  className="min-h-[88px] rounded-[26px] px-5 text-left text-white shadow-vyva-card active:scale-[0.99]"
                  style={{ background: BRAND.purple }}
                >
                  <span className="block text-[26px] font-black leading-tight">{matchActionLabel}</span>
                  <span className="mt-1 block text-[17px] font-extrabold opacity-90">{waitActionLabel}</span>
                </button>
                <button
                  type="button"
                  onClick={handleIntentionTap}
                  aria-label={t("games.rememberLater.intentionButton", "Gold star")}
                  className="min-h-[88px] rounded-[26px] px-5 text-left text-white shadow-vyva-card active:scale-[0.99]"
                  style={{ background: BRAND.gold }}
                >
                  <span className="flex items-center gap-3 text-[26px] font-black leading-tight">
                    <Star size={30} fill="currentColor" />
                    {starActionLabel}
                  </span>
                  <span className="mt-1 block text-[17px] font-extrabold opacity-90">
                    {t("games.rememberLater.starButtonHint", "Use only for the reminder.")}
                  </span>
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {screen === "result" && sessionResult ? (
          <section className="mt-6 rounded-[28px] border bg-white p-6 text-center shadow-vyva-card" style={{ borderColor: BRAND.border }}>
            <div className="mx-auto flex h-[92px] w-[92px] items-center justify-center rounded-[28px]" style={{ background: resultToneHit ? BRAND.tealPale : BRAND.softPurple, color: resultToneHit ? BRAND.teal : BRAND.purple }}>
              {resultToneHit ? <Check size={52} /> : <CircleHelp size={52} />}
            </div>
            <h1 className="mt-5 font-display text-[36px] leading-tight">
              {resultToneHit
                ? t("games.rememberLater.resultHit", "You remembered without anyone reminding you.")
                : t("games.rememberLater.resultMiss", "You did not remember this time, and that is okay. Let us keep practicing.")}
            </h1>
            <div
              className="mt-4 rounded-[22px] px-4 py-3 text-left"
              style={{
                background: resultCountsForLevel ? BRAND.tealPale : resultToneHit ? "#FEF3C7" : BRAND.softPurple,
                color: resultCountsForLevel ? BRAND.teal : resultToneHit ? "#92400E" : BRAND.purple,
              }}
            >
              <p className="text-[20px] font-black uppercase tracking-[0.04em]">{resultVerdict}</p>
              <p className="mt-1 text-[20px] font-extrabold leading-snug">{resultWhy}</p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-[22px] p-4" style={{ background: BRAND.softPurple }}>
                <p className="text-[18px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>{t("games.rememberLater.matchingTask", "Matching task")}</p>
                <p className="mt-2 text-[34px] font-black">{Math.round(sessionResult.ongoing_accuracy_pct)}%</p>
              </div>
              <div className="rounded-[22px] p-4" style={{ background: BRAND.tealPale }}>
                <p className="text-[18px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>{t("games.rememberLater.remembered", "Recall")}</p>
                <p className="mt-2 text-[34px] font-black">{sessionResult.pm_hits}/{sessionResult.pm_total}</p>
              </div>
              <div className="rounded-[22px] p-4" style={{ background: "#FEF3C7" }}>
                <p className="text-[18px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>{t("games.rememberLater.score", "Score")}</p>
                <p className="mt-2 text-[34px] font-black">{sessionResult.score}</p>
              </div>
              <div className="rounded-[22px] p-4" style={{ background: "#F8FAFC" }}>
                <p className="text-[18px] font-black uppercase tracking-[0.04em]" style={{ color: BRAND.muted }}>{t("games.rememberLater.streak", "Streak")}</p>
                <p className="mt-2 text-[34px] font-black">{userState?.streak_days ?? 1}</p>
              </div>
            </div>

            <div className="mt-6 text-left">
              <div className="flex items-center justify-between text-[20px] font-black">
                <span>{t("games.rememberLater.promotionProgress", "Level progress")}</span>
                <span>{progressWins}/3</span>
              </div>
              <div className="mt-2 h-3 rounded-full bg-[#EDE9FE]">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (progressWins / 3) * 100)}%`, background: BRAND.purple }} />
              </div>
              <p className="mt-2 text-[18px] font-bold" style={{ color: BRAND.muted }}>
                {t("games.rememberLater.currentLevel", "Current level")}: {nextTier}
              </p>
              <p
                className="mt-3 rounded-2xl px-4 py-3 text-[18px] font-extrabold leading-snug"
                style={{
                  background: resultCountsForLevel ? BRAND.tealPale : "#FFF7ED",
                  color: resultCountsForLevel ? BRAND.teal : "#92400E",
                }}
              >
                {levelProgressNote}
              </p>
            </div>

            {assessmentPractice ? (
              <div className="mt-6 rounded-[22px] border px-4 py-4 text-left" style={{ borderColor: "#A7F3D0", background: "#ECFDF5", color: BRAND.teal }}>
                <p className="text-[18px] font-black uppercase tracking-[0.05em]">{t("brainGames.resultActions.assessmentPractice", "Assessment practice")}</p>
                <p className="mt-1 text-[21px] font-extrabold leading-snug" style={{ color: BRAND.ink }}>
                  {t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")}
                </p>
                <button
                  type="button"
                  onClick={onAssessmentPracticeReturn}
                  disabled={saving || !onAssessmentPracticeReturn}
                  className="mt-4 min-h-[62px] w-full rounded-full px-5 text-[21px] font-black text-white shadow-vyva-card disabled:opacity-60"
                  style={{ background: BRAND.teal }}
                >
                  {t("brainGames.resultActions.backToResults", "Back to my results")}
                </button>
              </div>
            ) : null}

            <div className="mt-7 grid gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={loadGame}
                className="min-h-[72px] rounded-full px-6 text-[24px] font-black text-white shadow-vyva-card disabled:opacity-60"
                style={{ background: BRAND.purple }}
              >
                {t("common.playAgain", "Play again")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onExit}
                className="min-h-[72px] rounded-full border bg-white px-6 text-[24px] font-black shadow-vyva-card disabled:opacity-60"
                style={{ borderColor: BRAND.border, color: BRAND.ink }}
              >
                {t("common.finish", "Finish")}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
