import { BRAIN_COACH_MAX_LEVEL } from "./brainCoachProgression";

export const LISTEN_CLOSELY_MODES = ["find_it", "oddball", "count_compare"];

export const LISTEN_CLOSELY_SOUNDS = [
  "chime",
  "chirp",
  "tap",
  "whoosh",
  "drip",
  "hum",
  "click",
  "ring",
];

const MAX_TIER = BRAIN_COACH_MAX_LEVEL;

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

function makeEventTimes({ durationSeconds, count, variant, offsetMs = 1800 }) {
  const safeCount = Math.max(1, Number(count) || 1);
  const availableMs = Math.max(6000, durationSeconds * 1000 - 3600);
  const stepMs = availableMs / safeCount;

  return Array.from({ length: safeCount }, (_, index) => {
    const jitter = ((variant + 3) * (index + 2) * 137) % Math.min(700, Math.max(260, stepMs / 3));
    return Math.round(offsetMs + (index * stepMs) + jitter);
  });
}

function makeDistractorEvents({ durationSeconds, count, variant, targetSound }) {
  const safeCount = Math.max(0, Number(count) || 0);
  if (safeCount === 0) return [];

  const targetIndex = LISTEN_CLOSELY_SOUNDS.indexOf(targetSound);
  return makeEventTimes({
    durationSeconds,
    count: safeCount,
    variant: variant + 7,
    offsetMs: 2600,
  }).map((timeMs, index) => ({
    sound_character: LISTEN_CLOSELY_SOUNDS[(targetIndex + index + 2) % LISTEN_CLOSELY_SOUNDS.length],
    time_ms: timeMs,
  }));
}

function getTierDurationSeconds(tier) {
  if (tier <= 4) return 18;
  if (tier <= 8) return 24;
  if (tier <= 12) return 30;
  if (tier <= 16) return 34;
  return 38;
}

function buildSoundscape(tier, variant) {
  const mode = LISTEN_CLOSELY_MODES[(tier + variant) % LISTEN_CLOSELY_MODES.length];
  const durationSeconds = getTierDurationSeconds(tier);
  const targetSound = LISTEN_CLOSELY_SOUNDS[(tier + variant - 2) % LISTEN_CLOSELY_SOUNDS.length];
  const secondSound = LISTEN_CLOSELY_SOUNDS[(tier + variant + 2) % LISTEN_CLOSELY_SOUNDS.length];
  const responseWindowMs = clamp(1950 - (tier * 55), 760, 1900);
  const baseTargetCount = clamp(2 + Math.floor((tier + variant) / 5), 2, 9);
  const firstCount = mode === "count_compare" ? clamp(2 + Math.floor(tier / 4) + (variant % 2), 2, 8) : baseTargetCount;
  const secondCount = mode === "count_compare"
    ? clamp(firstCount + (variant % 2 === 0 ? 1 : -1), 1, 7)
    : 0;
  const targetEventTimes = makeEventTimes({
    durationSeconds,
    count: firstCount,
    variant,
    offsetMs: mode === "oddball" ? 3800 : 2100,
  });
  const secondTargetEventTimes = mode === "count_compare"
    ? makeEventTimes({ durationSeconds, count: secondCount, variant: variant + 4, offsetMs: 3100 })
    : [];
  const distractorEvents = mode === "count_compare"
    ? []
    : makeDistractorEvents({
        durationSeconds,
        count: clamp(2 + Math.floor(tier / 2), 2, 11),
        variant,
        targetSound,
      });

  return normalizeListenCloselySoundscape({
    id: `local-listen-${tier}-${String(variant).padStart(2, "0")}`,
    mode,
    difficulty_tier: tier,
    duration_seconds: durationSeconds,
    ambient_layer: {
      type: "soft_room",
      intensity: tier <= 5 ? "low" : tier <= 10 ? "medium" : tier <= 15 ? "busy" : "layered",
    },
    target_sound_character: targetSound,
    target_event_times: targetEventTimes,
    distractor_events: distractorEvents,
    oddball_intro_time_ms: mode === "oddball" ? 1500 : null,
    second_target_sound_character: mode === "count_compare" ? secondSound : null,
    second_target_event_times: secondTargetEventTimes,
    response_window_ms: responseWindowMs,
    is_active: true,
    is_local_practice: true,
  });
}

export function createListenCloselyFallbackSoundscapes() {
  const rows = [];
  for (let tier = 1; tier <= MAX_TIER; tier += 1) {
    for (let variant = 1; variant <= 20; variant += 1) {
      rows.push(buildSoundscape(tier, variant));
    }
  }
  return rows;
}

export const LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES = createListenCloselyFallbackSoundscapes();

export function normalizeListenCloselySoundscape(row) {
  return {
    ...row,
    mode: LISTEN_CLOSELY_MODES.includes(row?.mode) ? row.mode : "find_it",
    difficulty_tier: clamp(Number(row?.difficulty_tier ?? 1), 1, MAX_TIER),
    duration_seconds: Math.max(8, Number(row?.duration_seconds ?? 18)),
    ambient_layer: row?.ambient_layer && typeof row.ambient_layer === "object" ? row.ambient_layer : {},
    target_sound_character: LISTEN_CLOSELY_SOUNDS.includes(row?.target_sound_character) ? row.target_sound_character : "chime",
    target_event_times: asArray(row?.target_event_times).map(Number).filter(Number.isFinite),
    distractor_events: asArray(row?.distractor_events).map((event) => ({
      sound_character: LISTEN_CLOSELY_SOUNDS.includes(event?.sound_character) ? event.sound_character : "tap",
      time_ms: Number(event?.time_ms ?? 0),
    })).filter((event) => Number.isFinite(event.time_ms) && event.time_ms >= 0),
    oddball_intro_time_ms: row?.oddball_intro_time_ms === null || row?.oddball_intro_time_ms === undefined
      ? null
      : Number(row.oddball_intro_time_ms),
    second_target_sound_character: LISTEN_CLOSELY_SOUNDS.includes(row?.second_target_sound_character)
      ? row.second_target_sound_character
      : null,
    second_target_event_times: asArray(row?.second_target_event_times).map(Number).filter(Number.isFinite),
    response_window_ms: clamp(Number(row?.response_window_ms ?? 1600), 600, 2500),
  };
}

export function selectListenCloselySoundscape(rows, tier = 1, todaySessions = [], historySessions = [], random = Math.random) {
  const safeTier = clamp(Number(tier) || 1, 1, MAX_TIER);
  const normalized = rows
    .map(normalizeListenCloselySoundscape)
    .filter((row) => row.difficulty_tier === safeTier && row.target_event_times.length > 0);

  if (!normalized.length) {
    return LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES.find((row) => row.difficulty_tier === safeTier) ?? LISTEN_CLOSELY_FALLBACK_SOUNDSCAPES[0];
  }

  const usedToday = new Set(todaySessions.map((session) => session.soundscape_id).filter(Boolean));
  const freshRows = normalized.filter((row) => !row.id || !usedToday.has(row.id));
  if (freshRows.length > 0) return freshRows[Math.floor(random() * freshRows.length)];

  const lastPlayed = new Map();
  historySessions.forEach((session) => {
    if (!session.soundscape_id || !session.played_at) return;
    const previous = lastPlayed.get(session.soundscape_id);
    if (!previous || session.played_at > previous) {
      lastPlayed.set(session.soundscape_id, session.played_at);
    }
  });

  return [...normalized].sort((a, b) => {
    const aPlayed = lastPlayed.get(a.id) ?? "";
    const bPlayed = lastPlayed.get(b.id) ?? "";
    return aPlayed.localeCompare(bPlayed);
  })[0];
}

export function getListenCloselyTimeline(soundscape) {
  const row = normalizeListenCloselySoundscape(soundscape);
  const targetEvents = row.target_event_times.map((timeMs) => ({
    role: "target",
    sound_character: row.target_sound_character,
    time_ms: timeMs,
  }));
  const secondTargetEvents = row.second_target_event_times.map((timeMs) => ({
    role: "second_target",
    sound_character: row.second_target_sound_character,
    time_ms: timeMs,
  }));
  const distractorEvents = row.distractor_events.map((event) => ({
    role: "distractor",
    sound_character: event.sound_character,
    time_ms: event.time_ms,
  }));

  return [...targetEvents, ...secondTargetEvents, ...distractorEvents]
    .filter((event) => event.sound_character && Number.isFinite(event.time_ms))
    .sort((a, b) => a.time_ms - b.time_ms);
}

export function getDefaultListenCloselyUserState(userId) {
  return {
    user_id: userId,
    current_tier: 1,
    sessions_at_tier: 0,
    consecutive_wins: 0,
    consecutive_losses: 0,
    total_sessions: 0,
    best_score: 0,
    last_played_at: null,
    streak_days: 0,
    last_streak_date: null,
    updated_at: new Date().toISOString(),
  };
}

function scoreTapMode({ hits, targetTotal, falsePositives, avgReactionTimeMs, responseWindowMs }) {
  const accuracyPct = targetTotal > 0 ? (hits / targetTotal) * 100 : 0;
  const penalty = Math.min(200, falsePositives * 25);
  const base = accuracyPct * 8 - penalty;
  const speedBonus = avgReactionTimeMs === null
    ? 0
    : Math.max(0, 200 * (1 - (avgReactionTimeMs / Math.max(1, responseWindowMs))));
  return clamp(Math.round(base + speedBonus), 0, 1000);
}

export function computeListenCloselyResult({
  soundscape,
  tapTimesMs = [],
  comparisonChoice = null,
  durationSeconds,
  abandoned = false,
}) {
  const row = normalizeListenCloselySoundscape(soundscape);
  const targetTimes = row.target_event_times;

  if (row.mode === "count_compare") {
    const firstCount = row.target_event_times.length;
    const secondCount = row.second_target_event_times.length;
    const correctChoice = firstCount >= secondCount ? row.target_sound_character : row.second_target_sound_character;
    const comparisonCorrect = !abandoned && comparisonChoice === correctChoice;

    return {
      soundscape_id: row.id ?? null,
      difficulty_tier: row.difficulty_tier,
      mode: row.mode,
      target_total: Math.max(firstCount, secondCount),
      hits: comparisonCorrect ? 1 : 0,
      misses: comparisonCorrect ? 0 : 1,
      false_positives: 0,
      avg_reaction_time_ms: null,
      accuracy_pct: comparisonCorrect ? 100 : 0,
      user_comparison_choice: comparisonChoice,
      comparison_correct: comparisonCorrect,
      score: comparisonCorrect ? 700 : 300,
      completed: !abandoned,
      abandoned: Boolean(abandoned),
      duration_seconds: Number(durationSeconds ?? row.duration_seconds),
    };
  }

  const consumed = new Set();
  const reactionTimes = [];
  let falsePositives = 0;

  [...tapTimesMs].sort((a, b) => a - b).forEach((tapTime) => {
    const matchIndex = targetTimes.findIndex((targetTime, index) => (
      !consumed.has(index) &&
      tapTime >= targetTime &&
      tapTime <= targetTime + row.response_window_ms
    ));

    if (matchIndex >= 0) {
      consumed.add(matchIndex);
      reactionTimes.push(tapTime - targetTimes[matchIndex]);
    } else {
      falsePositives += 1;
    }
  });

  const hits = consumed.size;
  const targetTotal = targetTimes.length;
  const misses = Math.max(0, targetTotal - hits);
  const avgReactionTimeMs = reactionTimes.length
    ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
    : null;
  const accuracyPct = targetTotal > 0 ? Number(((hits / targetTotal) * 100).toFixed(2)) : 0;

  return {
    soundscape_id: row.id ?? null,
    difficulty_tier: row.difficulty_tier,
    mode: row.mode,
    target_total: targetTotal,
    hits,
    misses,
    false_positives: falsePositives,
    avg_reaction_time_ms: avgReactionTimeMs,
    accuracy_pct: accuracyPct,
    user_comparison_choice: null,
    comparison_correct: null,
    score: abandoned
      ? 0
      : scoreTapMode({
          hits,
          targetTotal,
          falsePositives,
          avgReactionTimeMs,
          responseWindowMs: row.response_window_ms,
        }),
    completed: !abandoned,
    abandoned: Boolean(abandoned),
    duration_seconds: Number(durationSeconds ?? row.duration_seconds),
  };
}

export function getNextListenCloselyStateAfterSession(previousState, result, now = new Date()) {
  const previous = previousState ?? getDefaultListenCloselyUserState(result.user_id ?? "");
  if (result.abandoned) return previous;

  const today = todayKey(now);
  const yesterday = todayKey(addDays(now, -1));
  const isCompare = result.mode === "count_compare";
  const isWin = isCompare ? Boolean(result.comparison_correct) : Number(result.accuracy_pct ?? 0) >= 75;
  const isLoss = isCompare ? result.comparison_correct === false : Number(result.accuracy_pct ?? 0) < 45;
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

  const streakDays =
    previous.last_streak_date === today
      ? Number(previous.streak_days ?? 1)
      : previous.last_streak_date === yesterday
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
