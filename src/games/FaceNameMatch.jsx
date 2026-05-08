import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, RotateCcw, Square, Users } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../i18n";
import FaceAvatar from "./FaceAvatar";
import {
  clampFaceNameTier,
  computeFaceNameScore,
  getFaceNameDistractorCount,
  getFaceNameFaceCount,
  getFaceNamePersonaOutcomes,
  getFaceNameRecallModes,
  getFaceNameStudySeconds,
} from "./faceNameLogic";

const PURPLE = "#6B21A8";
const GOLD = "#F59E0B";
const BACKGROUND = "#FAF9F6";
const GREEN = "#16A34A";
const TEAL_SOFT = "#D5F5F5";
const BORDER = "#EDE5DB";
const SCREEN_STYLE = {
  background: `radial-gradient(circle at top, #FFFFFF 0%, ${BACKGROUND} 52%, #F4EFE7 100%)`,
  minHeight: "100dvh",
  paddingTop: "max(12px, env(safe-area-inset-top))",
  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
};

function FaceNameScreen({ children }) {
  return (
    <div className="px-4 sm:px-6" style={SCREEN_STYLE}>
      <div className="mx-auto flex min-h-[calc(100dvh-24px)] w-full max-w-[760px] flex-col">
        {children}
      </div>
    </div>
  );
}

function GameHeader({ title, meta, timer, pulse = false, exitLabel, onExit }) {
  return (
    <header className="rounded-[24px] border bg-white/90 px-4 py-3 shadow-vyva-card backdrop-blur" style={{ borderColor: BORDER }}>
      <div className="flex min-h-[64px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.08em]" style={{ color: PURPLE }}>Face-Name Match</p>
          <h1 className="mt-1 truncate font-display text-[25px] font-bold leading-tight text-vyva-text-1">{title}</h1>
          {meta && <p className="mt-1 truncate text-[17px] font-semibold text-vyva-text-2">{meta}</p>}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {timer && (
            <div className="rounded-full px-4 py-3 text-[21px] font-extrabold" style={{ background: pulse ? "#FEF3C7" : "#F3E8FF", color: pulse ? "#92400E" : PURPLE }}>
              {timer}
            </div>
          )}
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-[64px] items-center gap-2 rounded-[20px] px-4 text-[20px] font-extrabold shadow-sm"
            style={{ background: "#FFF7ED", color: "#9A3412" }}
          >
            <Square size={21} />
            {exitLabel}
          </button>
        </div>
      </div>
    </header>
  );
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

function localDayStart(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function buildRecallQueue(personas, previousPersonaId = null) {
  const queue = shuffle(personas);
  if (previousPersonaId && queue.length > 1 && queue[0]?.id === previousPersonaId) {
    const swapIndex = queue.findIndex((persona) => persona.id !== previousPersonaId);
    if (swapIndex > 0) [queue[0], queue[swapIndex]] = [queue[swapIndex], queue[0]];
  }
  return queue;
}

function normalizeFaceLanguage(language) {
  if (language === "de") return "de";
  if (language === "en") return "en";
  return "es";
}

function getPersonaName(persona, language) {
  const key = `name_${normalizeFaceLanguage(language)}`;
  return persona?.[key] ?? persona?.name_es ?? persona?.name_en ?? persona?.name_de ?? "";
}

function defaultUserState(userId) {
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

const PRACTICE_PERSONAS = [
  {
    id: "practice-rosa",
    name_es: "Rosa",
    name_de: "Rosa",
    name_en: "Rose",
    avatar_config: {
      skinTone: "light",
      hairColor: "white",
      hairStyle: "bun",
      eyeColor: "blue",
      eyeShape: "round",
      hasGlasses: true,
      glassStyle: "round",
      facialHair: "none",
      faceShape: "oval",
      wrinkles: "moderate",
      accessory: "earrings",
      bgColor: "#E8D5F5",
    },
  },
  {
    id: "practice-antonio",
    name_es: "Antonio",
    name_de: "Anton",
    name_en: "Anthony",
    avatar_config: {
      skinTone: "medium",
      hairColor: "grey",
      hairStyle: "short_straight",
      eyeColor: "brown",
      eyeShape: "hooded",
      hasGlasses: false,
      glassStyle: "none",
      facialHair: "moustache",
      faceShape: "square",
      wrinkles: "moderate",
      accessory: "none",
      bgColor: "#D5E8F5",
    },
  },
  {
    id: "practice-carmen",
    name_es: "Carmen",
    name_de: "Karmen",
    name_en: "Carmen",
    avatar_config: {
      skinTone: "tan",
      hairColor: "brown",
      hairStyle: "medium_wavy",
      eyeColor: "hazel",
      eyeShape: "almond",
      hasGlasses: false,
      glassStyle: "none",
      facialHair: "none",
      faceShape: "round",
      wrinkles: "light",
      accessory: "necklace",
      bgColor: "#D5F5E0",
    },
  },
  {
    id: "practice-luis",
    name_es: "Luis",
    name_de: "Ludwig",
    name_en: "Lewis",
    avatar_config: {
      skinTone: "light",
      hairColor: "blonde",
      hairStyle: "short_textured",
      eyeColor: "blue",
      eyeShape: "round",
      hasGlasses: true,
      glassStyle: "rectangle",
      facialHair: "stubble",
      faceShape: "oval",
      wrinkles: "none",
      accessory: "none",
      bgColor: "#F5E8D5",
    },
  },
  {
    id: "practice-fatima",
    name_es: "Fatima",
    name_de: "Fatima",
    name_en: "Fatima",
    avatar_config: {
      skinTone: "dark",
      hairColor: "black",
      hairStyle: "long_straight",
      eyeColor: "brown",
      eyeShape: "almond",
      hasGlasses: false,
      glassStyle: "none",
      facialHair: "none",
      faceShape: "oval",
      wrinkles: "none",
      accessory: "earrings",
      bgColor: "#F5D5E8",
    },
  },
  {
    id: "practice-jorge",
    name_es: "Jorge",
    name_de: "Georg",
    name_en: "George",
    avatar_config: {
      skinTone: "deep",
      hairColor: "black",
      hairStyle: "short_curly",
      eyeColor: "brown",
      eyeShape: "round",
      hasGlasses: false,
      glassStyle: "none",
      facialHair: "full_beard",
      faceShape: "round",
      wrinkles: "light",
      accessory: "none",
      bgColor: "#E8F5D5",
    },
  },
  {
    id: "practice-elena",
    name_es: "Elena",
    name_de: "Elena",
    name_en: "Helen",
    avatar_config: {
      skinTone: "medium",
      hairColor: "red",
      hairStyle: "long_straight",
      eyeColor: "green",
      eyeShape: "almond",
      hasGlasses: false,
      glassStyle: "none",
      facialHair: "none",
      faceShape: "oval",
      wrinkles: "none",
      accessory: "necklace",
      bgColor: "#F5F5D5",
    },
  },
  {
    id: "practice-manuel",
    name_es: "Manuel",
    name_de: "Manfred",
    name_en: "Manuel",
    avatar_config: {
      skinTone: "tan",
      hairColor: "grey",
      hairStyle: "bald",
      eyeColor: "hazel",
      eyeShape: "hooded",
      hasGlasses: true,
      glassStyle: "rectangle",
      facialHair: "stubble",
      faceShape: "square",
      wrinkles: "moderate",
      accessory: "none",
      bgColor: "#D5F5F5",
    },
  },
];

function practiceSet(language, tier = 1) {
  const currentTier = clampFaceNameTier(Number(tier) || 1);
  const faceCount = getFaceNameFaceCount(currentTier);
  return {
    selectedSet: {
      id: null,
      persona_ids: PRACTICE_PERSONAS.slice(0, faceCount).map((persona) => persona.id),
      face_count: faceCount,
      difficulty_tier: currentTier,
      recall_modes: getFaceNameRecallModes(currentTier),
      study_seconds: getFaceNameStudySeconds(currentTier),
      language: normalizeFaceLanguage(language),
      is_active: true,
    },
    selectedPersonas: PRACTICE_PERSONAS.slice(0, faceCount),
    distractorPersonas: PRACTICE_PERSONAS.slice(faceCount),
    note: "practice",
  };
}

function normalizeSet(row) {
  return {
    ...row,
    persona_ids: asArray(row.persona_ids),
    recall_modes: asArray(row.recall_modes),
  };
}

function pct(value) {
  return `${Math.round(value)}%`;
}

export default function FaceNameMatch({ userId, onExit }) {
  const { language, t } = useLanguage();
  const faceLanguage = normalizeFaceLanguage(language);
  const text = useMemo(() => ({
    loading: t("brainGames.faceName.loading"),
    practiceNote: t("brainGames.faceName.practiceNote"),
    title: t("brainGames.faceName.title"),
    subtitle: t("brainGames.faceName.subtitle"),
    level: t("common.level"),
    people: t("brainGames.faceName.people"),
    start: t("brainGames.faceName.start"),
    introHint: t("brainGames.faceName.introHint"),
    studyTitle: t("brainGames.faceName.studyTitle"),
    ready: t("brainGames.faceName.ready"),
    exit: t("brainGames.faceName.exit"),
    question: t("brainGames.faceName.question"),
    of: t("brainGames.faceName.of"),
    whichFace: t("brainGames.faceName.whichFace"),
    faceQuestion: t("brainGames.faceName.faceQuestion"),
    correct: t("brainGames.faceName.correct"),
    answerShown: t("brainGames.faceName.answerShown"),
    resultGreat: t("brainGames.faceName.resultGreat"),
    resultTry: t("brainGames.faceName.resultTry"),
    n2f: t("brainGames.faceName.n2f"),
    f2n: t("brainGames.faceName.f2n"),
    score: t("brainGames.faceName.score"),
    streak: t("brainGames.faceName.streak"),
    days: t("brainGames.faceName.days"),
    progressNext: t("brainGames.faceName.progressNext"),
    newLevel: t("brainGames.faceName.newLevel"),
    replay: t("brainGames.faceName.replay"),
    finish: t("brainGames.faceName.finish"),
  }), [t]);

  const [screen, setScreen] = useState("loading");
  const [selectedSet, setSelectedSet] = useState(null);
  const [personas, setPersonas] = useState([]);
  const [distractors, setDistractors] = useState([]);
  const [userState, setUserState] = useState(null);
  const [loadNote, setLoadNote] = useState("");
  const [studyCountdown, setStudyCountdown] = useState(0);
  const [recallModeIndex, setRecallModeIndex] = useState(0);
  const [recallQueue, setRecallQueue] = useState([]);
  const [recallIndex, setRecallIndex] = useState(0);
  const [recallLog, setRecallLog] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [sessionResult, setSessionResult] = useState(null);

  const studyTimerRef = useRef(null);
  const feedbackTimerRef = useRef(null);
  const sessionSavedRef = useRef(false);
  const startedAtRef = useRef(Date.now());

  const recallModes = useMemo(() => {
    const modes = asArray(selectedSet?.recall_modes);
    return modes.length ? modes : getFaceNameRecallModes(Number(selectedSet?.difficulty_tier ?? 1));
  }, [selectedSet]);

  const currentMode = recallModes[recallModeIndex] ?? "name_to_face";
  const currentPersona = recallQueue[recallIndex] ?? null;
  const currentTier = Number(selectedSet?.difficulty_tier ?? userState?.current_tier ?? 1);
  const faceCount = Number(selectedSet?.face_count ?? personas.length);
  const totalQuestions = recallModes.length * Math.max(1, faceCount);
  const questionNumber = recallModeIndex * Math.max(1, faceCount) + recallIndex + 1;

  const loadUserState = useCallback(async () => {
    if (!userId) return defaultUserState(userId);

    const { data, error } = await supabase
      .from("face_name_user_state")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (data) return data;

    const initial = defaultUserState(userId);
    const { data: created, error: upsertError } = await supabase
      .from("face_name_user_state")
      .upsert(initial, { onConflict: "user_id" })
      .single();

    if (upsertError) throw upsertError;
    return created ?? initial;
  }, [userId]);

  const loadSet = useCallback(async (state) => {
    if (!userId) return practiceSet(faceLanguage, state?.current_tier ?? 1);

    const tier = clampFaceNameTier(Number(state?.current_tier ?? 1));
    const start = localDayStart();
    const languageOrder = [...new Set([faceLanguage, "es", "en", "de"])];

    const { data: todaySessions, error: todayError } = await supabase
      .from("face_name_sessions")
      .select("set_id")
      .eq("user_id", userId)
      .gte("played_at", start.toISOString())
      .limit(400);

    if (todayError) throw todayError;

    const playedToday = new Set((todaySessions ?? []).map((session) => session.set_id).filter(Boolean));

    for (const setLanguage of languageOrder) {
      const { data: rows, error: setError } = await supabase
        .from("face_name_sets")
        .select("*")
        .eq("difficulty_tier", tier)
        .eq("is_active", true)
        .eq("language", setLanguage)
        .limit(100);

      if (setError) throw setError;
      const sets = (rows ?? []).map(normalizeSet);
      const unused = sets.filter((entry) => !playedToday.has(entry.id));
      if (unused.length) return resolveSetData(unused[Math.floor(Math.random() * unused.length)]);

      if (sets.length) {
        const { data: history, error: historyError } = await supabase
          .from("face_name_sessions")
          .select("set_id,played_at")
          .eq("user_id", userId)
          .eq("difficulty_tier", tier)
          .order("played_at", { ascending: false })
          .limit(600);

        if (historyError) throw historyError;
        const lastPlayed = new Map();
        for (const session of history ?? []) {
          if (session.set_id && !lastPlayed.has(session.set_id)) {
            lastPlayed.set(session.set_id, new Date(session.played_at).getTime());
          }
        }
        return resolveSetData([...sets].sort((a, b) => (lastPlayed.get(a.id) ?? 0) - (lastPlayed.get(b.id) ?? 0))[0]);
      }
    }

    return practiceSet(faceLanguage, tier);
  }, [faceLanguage, userId]);

  const resolveSetData = useCallback(async (setRow) => {
    const setPersonaIds = asArray(setRow.persona_ids);
    const { data, error } = await supabase
      .from("face_name_personas")
      .select("*")
      .eq("is_active", true)
      .limit(100);

    if (error) throw error;
    const allPersonas = data ?? [];
    const byId = new Map(allPersonas.map((persona) => [persona.id, persona]));
    const selectedPersonas = setPersonaIds.map((id) => byId.get(id)).filter(Boolean);
    const idSet = new Set(setPersonaIds);
    const distractorPersonas = shuffle(allPersonas.filter((persona) => !idSet.has(persona.id)));

    if (selectedPersonas.length < Number(setRow.face_count ?? 4)) {
      return practiceSet(setRow.language ?? faceLanguage, setRow.difficulty_tier ?? 1);
    }

    return {
      selectedSet: setRow,
      selectedPersonas,
      distractorPersonas,
      note: "",
    };
  }, [faceLanguage]);

  const loadGame = useCallback(async () => {
    setScreen("loading");
    setLoadNote("");
    setRecallLog([]);
    setFeedback(null);
    setSessionResult(null);
    setRecallModeIndex(0);
    setRecallIndex(0);
    setRecallQueue([]);
    sessionSavedRef.current = false;
    startedAtRef.current = Date.now();

    try {
      const state = await loadUserState();
      const data = await loadSet(state);
      setUserState(state);
      setSelectedSet(data.selectedSet);
      setPersonas(data.selectedPersonas);
      setDistractors(data.distractorPersonas);
      setLoadNote(data.note === "practice" ? text.practiceNote : "");
      setScreen("intro");
    } catch {
      const fallbackState = defaultUserState(userId);
      const data = practiceSet(faceLanguage, fallbackState.current_tier);
      setUserState(fallbackState);
      setSelectedSet(data.selectedSet);
      setPersonas(data.selectedPersonas);
      setDistractors(data.distractorPersonas);
      setLoadNote(text.practiceNote);
      setScreen("intro");
    }
  }, [faceLanguage, loadSet, loadUserState, text.practiceNote, userId]);

  useEffect(() => {
    void loadGame();
    return () => {
      window.clearInterval(studyTimerRef.current);
      window.clearTimeout(feedbackTimerRef.current);
    };
  }, [loadGame]);

  const beginRecall = useCallback(() => {
    window.clearInterval(studyTimerRef.current);
    const firstQueue = buildRecallQueue(personas);
    setRecallModeIndex(0);
    setRecallIndex(0);
    setRecallQueue(firstQueue);
    setFeedback(null);
    setScreen("recall");
  }, [personas]);

  useEffect(() => {
    if (screen !== "study" || !selectedSet) return undefined;

    const seconds = Number(selectedSet.study_seconds ?? getFaceNameStudySeconds(currentTier));
    const startedAt = Date.now();
    const durationMs = seconds * 1000;
    setStudyCountdown(seconds);

    studyTimerRef.current = window.setInterval(() => {
      const remaining = Math.max(0, (durationMs - (Date.now() - startedAt)) / 1000);
      setStudyCountdown(remaining);
      if (remaining <= 0) beginRecall();
    }, 200);

    return () => window.clearInterval(studyTimerRef.current);
  }, [beginRecall, currentTier, screen, selectedSet]);

  const beginStudy = () => {
    startedAtRef.current = Date.now();
    setScreen("study");
  };

  const saveSession = useCallback(async (result, abandoned = false) => {
    if (!selectedSet || !userId || sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    const payload = {
      user_id: userId,
      set_id: selectedSet.id ?? null,
      difficulty_tier: Number(selectedSet.difficulty_tier ?? 1),
      face_count: Number(selectedSet.face_count ?? personas.length),
      n2f_attempts: result?.n2fAttempts ?? 0,
      n2f_correct: result?.n2fCorrect ?? 0,
      n2f_accuracy_pct: result?.n2fAccuracyPct ?? 0,
      f2n_attempts: result?.f2nAttempts ?? 0,
      f2n_correct: result?.f2nCorrect ?? 0,
      f2n_accuracy_pct: result?.f2nAccuracyPct ?? 0,
      overall_accuracy_pct: result?.overallAccuracyPct ?? 0,
      score: result?.score ?? 0,
      completed: !abandoned,
      abandoned,
      duration_seconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)),
    };

    await supabase.from("face_name_sessions").insert(payload);
  }, [personas.length, selectedSet, userId]);

  const updateUserState = useCallback(async (result) => {
    const previous = userState ?? defaultUserState(userId);
    const today = todayKey();
    const yesterday = todayKey(addDays(new Date(), -1));

    let streakDays = 1;
    if (previous.last_streak_date === today) streakDays = previous.streak_days || 1;
    else if (previous.last_streak_date === yesterday) streakDays = (previous.streak_days || 0) + 1;

    let currentTierValue = Number(previous.current_tier ?? 1);
    let sessionsAtTier = Number(previous.sessions_at_tier ?? 0) + 1;
    let consecutiveWins = 0;
    let consecutiveLosses = 0;

    if (result.overallAccuracyPct >= 80) {
      consecutiveWins = Number(previous.consecutive_wins ?? 0) + 1;
      consecutiveLosses = 0;
    } else if (result.overallAccuracyPct < 50) {
      consecutiveWins = 0;
      consecutiveLosses = Number(previous.consecutive_losses ?? 0) + 1;
    }

    if (consecutiveWins >= 3 && currentTierValue < 10) {
      currentTierValue += 1;
      sessionsAtTier = 0;
      consecutiveWins = 0;
      consecutiveLosses = 0;
    } else if (consecutiveLosses >= 3 && currentTierValue > 1) {
      currentTierValue -= 1;
      sessionsAtTier = 0;
      consecutiveWins = 0;
      consecutiveLosses = 0;
    } else if (result.overallAccuracyPct >= 50 && result.overallAccuracyPct < 80) {
      consecutiveWins = 0;
      consecutiveLosses = 0;
    }

    const next = {
      ...previous,
      user_id: userId,
      current_tier: clampFaceNameTier(currentTierValue),
      sessions_at_tier: sessionsAtTier,
      consecutive_wins: consecutiveWins,
      consecutive_losses: consecutiveLosses,
      total_sessions: Number(previous.total_sessions ?? 0) + 1,
      best_score: Math.max(Number(previous.best_score ?? 0), result.score),
      last_played_at: new Date().toISOString(),
      streak_days: streakDays,
      last_streak_date: today,
      updated_at: new Date().toISOString(),
    };

    setUserState(next);
    if (userId && selectedSet?.id) {
      await supabase.from("face_name_user_state").upsert(next, { onConflict: "user_id" });
    }
    return next;
  }, [selectedSet?.id, userId, userState]);

  const completeSession = useCallback(async (nextLog) => {
    const result = computeFaceNameScore(nextLog, faceCount, recallModes);
    await saveSession(result, false);
    const nextState = await updateUserState(result);
    setSessionResult({
      ...result,
      personaOutcomes: getFaceNamePersonaOutcomes(nextLog, personas.map((persona) => persona.id)),
      streakDays: nextState.streak_days ?? 1,
      nextTier: clampFaceNameTier(Number(nextState.current_tier ?? currentTier) + 1),
      currentTier: Number(nextState.current_tier ?? currentTier),
    });
    setScreen("result");
  }, [currentTier, faceCount, personas, recallModes, saveSession, updateUserState]);

  const advanceAfterAnswer = useCallback((nextLog) => {
    const hasNextQuestion = recallIndex + 1 < recallQueue.length;
    if (hasNextQuestion) {
      setRecallIndex((current) => current + 1);
      setFeedback(null);
      return;
    }

    const nextModeIndex = recallModeIndex + 1;
    if (nextModeIndex < recallModes.length) {
      const previousPersonaId = recallQueue[recallQueue.length - 1]?.id;
      setRecallModeIndex(nextModeIndex);
      setRecallQueue(buildRecallQueue(personas, previousPersonaId));
      setRecallIndex(0);
      setFeedback(null);
      return;
    }

    setFeedback(null);
    void completeSession(nextLog);
  }, [completeSession, personas, recallIndex, recallModeIndex, recallModes.length, recallQueue]);

  const handleRecallAnswer = (selectedId) => {
    if (!currentPersona || feedback) return;
    const correct = selectedId === currentPersona.id;
    const nextLog = [...recallLog, { persona_id: currentPersona.id, mode: currentMode, correct }];
    setRecallLog(nextLog);
    setFeedback({ selectedId, correctId: currentPersona.id, correct });
    window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => advanceAfterAnswer(nextLog), correct ? 800 : 1200);
  };

  const handleExit = async () => {
    window.clearInterval(studyTimerRef.current);
    window.clearTimeout(feedbackTimerRef.current);
    if ((screen === "study" || screen === "recall") && !sessionSavedRef.current) {
      const result = computeFaceNameScore(recallLog, faceCount || personas.length, recallModes);
      await saveSession(result, true);
    }
    onExit?.();
  };

  const handleReplay = () => {
    void loadGame();
  };

  const faceOptions = useMemo(() => {
    if (!currentPersona || currentMode !== "name_to_face") return [];
    const distractorCount = getFaceNameDistractorCount(currentTier);
    return shuffle([...personas, ...shuffle(distractors).slice(0, distractorCount)]);
  }, [currentMode, currentPersona, currentTier, distractors, personas]);

  const nameOptions = useMemo(() => {
    if (!currentPersona || currentMode !== "face_to_name") return [];
    const pool = shuffle(distractors.filter((persona) => persona.id !== currentPersona.id)).slice(0, 2);
    if (pool.length < 2) {
      const extra = shuffle(personas.filter((persona) => persona.id !== currentPersona.id)).slice(0, 2 - pool.length);
      pool.push(...extra);
    }
    return shuffle([currentPersona, ...pool]);
  }, [currentMode, currentPersona, distractors, personas]);

  if (screen === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center" style={{ background: BACKGROUND, color: PURPLE }}>
        <Loader2 className="h-16 w-16 animate-spin" />
        <p className="text-[26px] font-bold">{text.loading}</p>
      </div>
    );
  }

  if (!selectedSet) return null;

  if (screen === "intro") {
    return (
      <FaceNameScreen>
        <GameHeader
          title={text.title}
          meta={`${text.level} ${currentTier} | ${faceCount} ${text.people}`}
          exitLabel={text.exit}
          onExit={handleExit}
        />

        <main className="flex min-h-0 flex-1 flex-col py-4">
          <section className="rounded-[28px] border bg-white p-5 shadow-vyva-card" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-4">
              <div className="flex h-[76px] w-[76px] flex-shrink-0 items-center justify-center rounded-[24px]" style={{ background: "#F3E8FF", color: PURPLE }}>
                <Users size={38} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-[37px] font-bold leading-[1.04] text-vyva-text-1">{text.title}</h1>
                <p className="mt-2 text-[22px] font-medium leading-[1.25] text-vyva-text-2">{text.subtitle}</p>
              </div>
            </div>

            {loadNote && (
              <div className="mt-4 rounded-[20px] px-4 py-3 text-[20px] font-extrabold" style={{ background: "#FEF3C7", color: "#92400E" }}>
                {loadNote}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <span className="rounded-full px-5 py-3 text-[21px] font-extrabold text-white" style={{ background: GOLD }}>
                {text.level} {currentTier}
              </span>
              <span className="rounded-full px-5 py-3 text-[21px] font-extrabold" style={{ background: TEAL_SOFT, color: "#0F766E" }}>
                {faceCount} {text.people}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border bg-[#FFFDF9] p-3" style={{ borderColor: BORDER }}>
              <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar">
              {personas.map((persona) => (
                <div key={persona.id} className="flex-shrink-0">
                  <FaceAvatar config={persona.avatar_config} size={72} />
                </div>
              ))}
              </div>
            </div>
          </section>
        </main>

        <div className="mt-auto pb-1">
          <button
            type="button"
            onClick={beginStudy}
            className="min-h-[72px] w-full rounded-[22px] px-8 text-[27px] font-extrabold text-white shadow-vyva-card"
            style={{ background: PURPLE }}
          >
            {text.start}
          </button>
          <p className="mt-3 text-center text-[19px] font-medium leading-[1.35] text-vyva-text-2">{text.introHint}</p>
        </div>
      </FaceNameScreen>
    );
  }

  if (screen === "study") {
    const progress = Math.max(0, Math.min(100, (studyCountdown / Number(selectedSet.study_seconds ?? 45)) * 100));
    const pulse = studyCountdown <= 5;

    return (
      <FaceNameScreen>
        <GameHeader
          title={text.studyTitle}
          meta={`${faceCount} ${text.people}`}
          timer={`${Math.ceil(studyCountdown)}s`}
          pulse={pulse}
          exitLabel={text.exit}
          onExit={handleExit}
        />
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div
                className={`h-full ${pulse ? "animate-pulse" : ""}`}
                style={{ width: `${progress}%`, background: pulse ? GOLD : PURPLE }}
              />
            </div>

          <main className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {personas.map((persona) => (
                <div key={persona.id} className="rounded-[22px] border bg-white p-3 text-center shadow-vyva-card" style={{ borderColor: BORDER }}>
                  <div className="flex justify-center">
                    <FaceAvatar config={persona.avatar_config} size={120} />
                  </div>
                  <p className="mt-2 text-[23px] font-extrabold leading-tight text-vyva-text-1">{getPersonaName(persona, language)}</p>
                </div>
              ))}
            </div>
          </main>

          <button
            type="button"
            onClick={beginRecall}
            className="min-h-[72px] w-full rounded-[22px] px-8 text-[25px] font-extrabold text-white shadow-vyva-card"
            style={{ background: PURPLE }}
          >
            {text.ready}
          </button>
      </FaceNameScreen>
    );
  }

  if (screen === "recall" && currentPersona) {
    const isNameToFace = currentMode === "name_to_face";
    const options = isNameToFace ? faceOptions : nameOptions;

    return (
      <FaceNameScreen>
        <GameHeader
          title={`${text.question} ${questionNumber} ${text.of} ${totalQuestions}`}
          meta={isNameToFace ? text.whichFace : text.faceQuestion}
          exitLabel={text.exit}
          onExit={handleExit}
        />

          <main className="relative flex min-h-0 flex-1 flex-col py-3">
            {feedback && (
              <div
                className="absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-full px-5 py-3 text-[22px] font-extrabold text-white shadow-vyva-card"
                style={{ background: feedback.correct ? GREEN : GOLD }}
              >
                {feedback.correct ? text.correct : text.answerShown}
              </div>
            )}

            {isNameToFace ? (
              <>
                <section className="rounded-[24px] border bg-white p-4 text-center shadow-vyva-card" style={{ borderColor: BORDER }}>
                  <p className="text-[22px] font-bold text-vyva-text-2">{text.whichFace}</p>
                  <p className="mt-2 text-[39px] font-extrabold uppercase leading-none" style={{ color: PURPLE }}>
                    {getPersonaName(currentPersona, language)}
                  </p>
                </section>

                <section className="mt-3 grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 md:grid-cols-3">
                  {options.map((persona) => {
                    const isCorrect = feedback?.correctId === persona.id;
                    const isSelected = feedback?.selectedId === persona.id;
                    const borderColor = isCorrect ? GREEN : isSelected && !feedback?.correct ? GOLD : "#E5E3DF";
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        disabled={Boolean(feedback)}
                        onClick={() => handleRecallAnswer(persona.id)}
                        className="min-h-[136px] rounded-[22px] border-[3px] bg-white p-3 shadow-vyva-card transition-transform active:scale-[0.99]"
                        style={{ borderColor }}
                      >
                        <div className="flex justify-center">
                          <FaceAvatar config={persona.avatar_config} size={104} />
                        </div>
                      </button>
                    );
                  })}
                </section>
              </>
            ) : (
              <>
                <section className="rounded-[24px] border bg-white p-4 text-center shadow-vyva-card" style={{ borderColor: BORDER }}>
                  <p className="text-[22px] font-bold text-vyva-text-2">{text.faceQuestion}</p>
                  <div className="mt-3 flex justify-center">
                    <FaceAvatar config={currentPersona.avatar_config} size={142} />
                  </div>
                </section>

                <section className="mt-3 flex flex-col gap-3">
                  {options.map((persona) => {
                    const isCorrect = feedback?.correctId === persona.id;
                    const isSelected = feedback?.selectedId === persona.id;
                    const borderColor = isCorrect ? GREEN : isSelected && !feedback?.correct ? GOLD : "#E5E3DF";
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        disabled={Boolean(feedback)}
                        onClick={() => handleRecallAnswer(persona.id)}
                        className="min-h-[72px] rounded-[22px] border-[3px] bg-white px-6 text-center text-[27px] font-extrabold shadow-vyva-card transition-transform active:scale-[0.99]"
                        style={{ borderColor, color: isCorrect ? GREEN : PURPLE }}
                      >
                        {getPersonaName(persona, language)}
                      </button>
                    );
                  })}
                </section>
              </>
            )}
          </main>
      </FaceNameScreen>
    );
  }

  const result = sessionResult ?? computeFaceNameScore(recallLog, faceCount, recallModes);
  const personaOutcomes = result.personaOutcomes ?? getFaceNamePersonaOutcomes(recallLog, personas.map((persona) => persona.id));
  const outcomeMap = new Map(personaOutcomes.map((entry) => [entry.personaId, entry.mastered]));
  const resultToneGreat = result.score >= 600;
  const hasFaceToName = result.f2nAttempts > 0;
  const nextTier = result.nextTier ?? clampFaceNameTier(currentTier + 1);
  const progressWidth = Math.min(100, Math.max(0, ((userState?.consecutive_wins ?? 0) / 3) * 100));

  return (
    <FaceNameScreen>
      <GameHeader
        title={resultToneGreat ? text.resultGreat : text.resultTry}
        meta={`${text.score}: ${result.score}`}
        exitLabel={text.exit}
        onExit={handleExit}
      />
        <main className="min-h-0 flex-1 overflow-y-auto py-3 pr-1">
          <section className="rounded-[24px] border bg-white p-4 shadow-vyva-card" style={{ borderColor: BORDER }}>
            <div className="flex items-center gap-3">
              <div className="flex h-[58px] w-[58px] flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#ECFDF5", color: GREEN }}>
                <Check size={32} />
              </div>
              <div>
                <h1 className="font-display text-[30px] font-bold leading-tight text-vyva-text-1">{resultToneGreat ? text.resultGreat : text.resultTry}</h1>
                <p className="mt-1 text-[19px] font-semibold text-vyva-text-2">{`${text.score}: ${result.score}`}</p>
              </div>
            </div>
          </section>

          <section className="mt-3 grid grid-cols-2 gap-3 rounded-[24px] border bg-white p-3 shadow-vyva-card md:grid-cols-4" style={{ borderColor: BORDER }}>
            {personas.map((persona) => (
              <div key={persona.id} className="text-center">
                <div className="flex justify-center">
                  <FaceAvatar config={persona.avatar_config} size={58} />
                </div>
                <p className="mt-1 inline-flex items-center justify-center gap-1 text-[18px] font-bold leading-tight text-vyva-text-1 [&>span:nth-child(2)]:hidden">
                  {outcomeMap.get(persona.id) ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "#FEF3C7", color: "#92400E" }}>
                      <Check size={13} />
                    </span>
                  ) : (
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#9CA3AF]" />
                  )}
                  <span style={{ color: outcomeMap.get(persona.id) ? GOLD : "#9CA3AF" }}>{outcomeMap.get(persona.id) ? "✓" : "·"}</span>{" "}
                  {getPersonaName(persona, language)}
                </p>
              </div>
            ))}
          </section>

          <section className="mt-3 rounded-[24px] border bg-white p-4 shadow-vyva-card" style={{ borderColor: BORDER }}>
            <div className={`grid gap-4 text-center ${hasFaceToName ? "grid-cols-2" : "grid-cols-1"}`}>
              <div>
                <p className="text-[19px] font-bold text-vyva-text-2">{text.n2f}</p>
                <p className="mt-1 text-[34px] font-extrabold" style={{ color: PURPLE }}>{pct(result.n2fAccuracyPct)}</p>
              </div>
              {hasFaceToName && (
                <div>
                  <p className="text-[19px] font-bold text-vyva-text-2">{text.f2n}</p>
                  <p className="mt-1 text-[34px] font-extrabold" style={{ color: GOLD }}>{pct(result.f2nAccuracyPct)}</p>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-[19px] font-bold text-vyva-text-2">{text.score}</p>
                <p className="mt-1 text-[33px] font-extrabold text-vyva-text-1">{result.score}</p>
              </div>
              <div>
                <p className="text-[19px] font-bold text-vyva-text-2">{text.streak}</p>
                <p className="mt-1 text-[33px] font-extrabold text-vyva-text-1">
                  {result.streakDays ?? userState?.streak_days ?? 1} {text.days}
                </p>
              </div>
            </div>
          </section>

          <div className="mt-3 rounded-[24px] border bg-white p-4" style={{ borderColor: BORDER }}>
            <div className="h-4 overflow-hidden rounded-full bg-[#EDE6F4]">
              <div className="h-full" style={{ width: `${progressWidth}%`, background: PURPLE }} />
            </div>
            <p className="mt-3 text-center text-[19px] font-bold text-vyva-text-2">
              {result.currentTier && result.currentTier > currentTier ? text.newLevel : `${text.progressNext} ${nextTier}`}
            </p>
          </div>
        </main>

        <div className="grid grid-cols-1 gap-3 pb-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex min-h-[72px] items-center justify-center gap-3 rounded-[22px] px-6 text-[24px] font-extrabold text-white shadow-vyva-card"
            style={{ background: PURPLE }}
          >
            <RotateCcw size={30} />
            {text.replay}
          </button>
          <button
            type="button"
            onClick={handleExit}
            className="inline-flex min-h-[72px] items-center justify-center gap-3 rounded-[22px] bg-white px-6 text-[24px] font-extrabold shadow-vyva-card"
            style={{ color: PURPLE }}
          >
            <Check size={30} />
            {text.finish}
          </button>
        </div>
    </FaceNameScreen>
  );
}
