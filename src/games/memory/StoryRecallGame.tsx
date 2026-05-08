import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LanguageCode } from "@/i18n/languages";
import { useAIScoring } from "@/games/shared/useAIScoring";
import { useTTS } from "@/games/shared/useTTS";
import { saveGameResult } from "./gameStorage";
import type { CognitiveDomain, MemoryGameVariantContent, Recommendation } from "./types";

export type StoryChoiceQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
};

export type StoryPayload = {
  story: string;
  keyFacts: string[];
  choiceQuestions: StoryChoiceQuestion[];
};

type StoryRecallResult = {
  score: number;
  accuracy: number;
  mistakes: number;
  durationSeconds: number;
  correctAnswers: number;
  totalQuestions: number;
  coveredFacts: string[];
  missedFacts: string[];
  scoringError: string | null;
};

type StoryRecallGameProps = {
  plan: Recommendation;
  localizedVariant: MemoryGameVariantContent;
  gameTitle: string;
  gamePrompt: string;
  accentColor: string;
  iconBg: string;
  cognitiveDomain: CognitiveDomain;
  userId: string;
  language: LanguageCode;
  t: (path: string, fallback?: string) => string;
  onBack: () => void;
  onOpenRecommended: () => void;
  onOpenSameGame: () => void;
  actionLoading: "recommended" | "repeat" | null;
};

type RetellScore = {
  covered: number[];
  not_covered: number[];
  covered_count: number;
  total_count: number;
  error: string | null;
};

function getDurationSeconds(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

function getScore(level: number, accuracy: number, mistakes: number, durationSeconds: number) {
  return Math.max(60, Math.round(accuracy + level * 12 - mistakes * 2 + Math.max(0, 45 - durationSeconds)));
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0) : [];
}

function isStoryQuestion(value: unknown): value is StoryChoiceQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<StoryChoiceQuestion>;
  return (
    typeof question.prompt === "string" &&
    Array.isArray(question.options) &&
    question.options.length >= 2 &&
    question.options.every((option) => typeof option === "string" && option.trim().length > 0) &&
    Number.isInteger(question.answerIndex) &&
    question.answerIndex >= 0 &&
    question.answerIndex < question.options.length
  );
}

export function getStoryPayload(content: MemoryGameVariantContent): StoryPayload {
  const payload = content.payload;
  const story = typeof payload.story === "string" ? payload.story : "";
  const keyFacts = asStringArray(payload.keyFacts);
  const choiceQuestions = Array.isArray(payload.choiceQuestions)
    ? payload.choiceQuestions.filter(isStoryQuestion)
    : [];

  return { story, keyFacts, choiceQuestions };
}

export function calculateStoryRecallMetrics(params: {
  level: number;
  startedAt: number;
  questionCount: number;
  correctQuestionCount: number;
  retellScore: RetellScore;
}) {
  const choiceAccuracy = params.questionCount > 0 ? params.correctQuestionCount / params.questionCount : 1;
  const retellAccuracy = params.retellScore.total_count > 0
    ? params.retellScore.covered_count / params.retellScore.total_count
    : 0;
  const accuracy = Math.round((choiceAccuracy * 0.4 + retellAccuracy * 0.6) * 100);
  const mistakes = Math.max(0, params.questionCount - params.correctQuestionCount)
    + Math.max(0, params.retellScore.total_count - params.retellScore.covered_count);
  const durationSeconds = getDurationSeconds(params.startedAt);
  const score = getScore(params.level, accuracy, mistakes, durationSeconds);

  return { score, accuracy, mistakes, durationSeconds };
}

function countWords(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function getFactList(indices: number[], facts: string[]) {
  return indices
    .map((index) => facts[index - 1])
    .filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0);
}

export default function StoryRecallGame({
  plan,
  localizedVariant,
  gameTitle,
  gamePrompt,
  accentColor,
  iconBg,
  cognitiveDomain,
  userId,
  language,
  t,
  onBack,
  onOpenRecommended,
  onOpenSameGame,
  actionLoading,
}: StoryRecallGameProps) {
  const payload = useMemo(() => getStoryPayload(localizedVariant), [localizedVariant]);
  const questions = payload.choiceQuestions;
  const [phase, setPhase] = useState<"read" | "quiz" | "retell" | "result">("read");
  const [startedAt] = useState(Date.now());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [retellText, setRetellText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [audioPaused, setAudioPaused] = useState(false);
  const [result, setResult] = useState<StoryRecallResult | null>(null);
  const { speak, stop, pause, resume, isSpeaking, isLoading: isAudioLoading, error: ttsError } = useTTS();
  const { scoreRetell } = useAIScoring();

  useEffect(() => () => stop(), [stop]);

  const selectedAnswer = answers[questionIndex];
  const currentQuestion = questions[questionIndex] ?? null;
  const correctQuestionCount = questions.reduce((total, question, index) => {
    return total + (answers[index] === question.answerIndex ? 1 : 0);
  }, 0);
  const wordCount = countWords(retellText);

  const handleListen = () => {
    setMessage(null);
    if (audioPaused) {
      resume();
      setAudioPaused(false);
      return;
    }
    void speak(payload.story, language);
  };

  const handlePause = () => {
    pause();
    setAudioPaused(true);
  };

  const handleStop = () => {
    stop();
    setAudioPaused(false);
  };

  const startQuestions = () => {
    stop();
    setAudioPaused(false);
    setPhase(questions.length > 0 ? "quiz" : "retell");
  };

  const chooseAnswer = (answerIndex: number) => {
    setMessage(null);
    setAnswers((current) => {
      const next = [...current];
      next[questionIndex] = answerIndex;
      return next;
    });
  };

  const continueQuestion = () => {
    if (typeof selectedAnswer !== "number") {
      setMessage(t("storyRecall.answerMissing"));
      return;
    }

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      return;
    }

    setPhase("retell");
  };

  const submitRetell = async () => {
    const trimmed = retellText.trim();
    if (!trimmed) {
      setMessage(t("storyRecall.retellMissing"));
      return;
    }

    setMessage(null);
    setSaving(true);
    stop();
    setAudioPaused(false);

    const retellScore = await scoreRetell(trimmed, payload.keyFacts, language);
    const metrics = calculateStoryRecallMetrics({
      level: plan.level,
      startedAt,
      questionCount: questions.length,
      correctQuestionCount,
      retellScore,
    });

    const coveredFacts = retellScore.error ? [] : getFactList(retellScore.covered, payload.keyFacts);
    const missedFacts = retellScore.error ? [] : getFactList(retellScore.not_covered, payload.keyFacts);

    try {
      await saveGameResult({
        userId,
        gameType: plan.gameType,
        cognitiveDomain,
        variantId: plan.variantId,
        level: plan.level,
        score: metrics.score,
        accuracy: metrics.accuracy,
        mistakes: metrics.mistakes,
        durationSeconds: metrics.durationSeconds,
        completedAt: new Date().toISOString(),
        language,
      });

      setResult({
        ...metrics,
        correctAnswers: correctQuestionCount,
        totalQuestions: questions.length,
        coveredFacts,
        missedFacts,
        scoringError: retellScore.error,
      });
      setPhase("result");
    } finally {
      setSaving(false);
    }
  };

  if (!payload.story) {
    return (
      <div className="px-[22px] py-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
        <div className="mt-5 rounded-[24px] border border-vyva-border bg-white p-6 shadow-vyva-card">
          <h1 className="font-display text-[28px] text-vyva-text-1">{t("memory.exerciseNotFound")}</h1>
          <p className="mt-3 text-[16px] text-vyva-text-2">{t("memory.exerciseNotFoundBody")}</p>
        </div>
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="px-[22px] pb-6">
        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-vyva-card">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full bg-[#ECFDF5] text-[#0A7C4E]">
            <CheckCircle2 size={34} />
          </div>
          <h1 className="mt-5 font-display text-[34px] text-vyva-text-1">{t("storyRecall.completionTitle")}</h1>
          <p className="mt-2 text-[18px] leading-[1.6] text-vyva-text-2">{t("storyRecall.completionBody")}</p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { label: t("memory.score"), value: `${result.score}` },
              { label: t("memory.accuracy"), value: `${result.accuracy}%` },
              { label: t("storyRecall.questions"), value: `${result.correctAnswers}/${result.totalQuestions}` },
              { label: t("storyRecall.recall"), value: `${result.coveredFacts.length}/${payload.keyFacts.length}` },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-vyva-border bg-vyva-cream p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{item.label}</p>
                <p className="mt-2 text-[26px] font-semibold text-vyva-text-1">{item.value}</p>
              </div>
            ))}
          </div>

          {result.scoringError && (
            <div className="mt-5 rounded-[20px] border border-[#CFE9D9] bg-[#F0FDF4] p-4 text-[15px] leading-[1.55] text-vyva-text-2">
              {t("storyRecall.scoringFallback")}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {result.coveredFacts.length > 0 && (
              <div className="rounded-[20px] border border-[#CFE9D9] bg-[#F0FDF4] p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("storyRecall.remembered")}</p>
                <div className="mt-3 grid gap-2">
                  {result.coveredFacts.map((fact) => (
                    <p key={`covered-${fact}`} className="rounded-[16px] bg-white px-4 py-3 text-[15px] leading-[1.45] text-vyva-text-1 shadow-sm">
                      {fact}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {result.missedFacts.length > 0 && (
              <div className="rounded-[20px] border border-[#F3E0BD] bg-[#FFF7ED] p-4">
                <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("storyRecall.alsoInStory")}</p>
                <div className="mt-3 grid gap-2">
                  {result.missedFacts.map((fact) => (
                    <p key={`missed-${fact}`} className="rounded-[16px] bg-white px-4 py-3 text-[15px] leading-[1.45] text-vyva-text-1 shadow-sm">
                      {fact}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button
              onClick={onOpenRecommended}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] bg-vyva-purple px-5 py-5 text-left text-[18px] font-semibold text-white shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.continueRecommended")}</span>
              <span className="mt-1 block text-[14px] font-medium text-white/82">{t("memory.nextRecommended")}</span>
            </button>
            <button
              onClick={onOpenSameGame}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] border border-[#D8C7F3] bg-[#FAF7FF] px-5 py-5 text-left text-[18px] font-semibold text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.repeatSameGame")}</span>
              <span className="mt-1 block text-[14px] font-medium text-vyva-text-2">{t("memory.currentLevel")}</span>
            </button>
            <button
              onClick={onBack}
              disabled={actionLoading !== null}
              className="w-full rounded-[20px] border border-vyva-border bg-white px-5 py-5 text-left text-[18px] font-semibold text-vyva-text-1 shadow-vyva-card disabled:opacity-60"
            >
              <span className="block">{t("memory.chooseAnotherExercise")}</span>
              <span className="mt-1 block text-[14px] font-medium text-vyva-text-2">{t("memory.chooseAnother")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-[22px] pb-6">
      <button
        onClick={onBack}
        className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
      >
        <ArrowLeft size={18} />
        {t("common.back")}
      </button>

      <section className="mt-4 overflow-hidden rounded-[28px] border border-[#EFE7DB] bg-[#FFF9F1] p-5 shadow-vyva-card">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-vyva-purple shadow-sm">
              <BookOpen size={14} />
              {t("storyRecall.readLabel")}
            </div>
            <h1 className="mt-4 font-display text-[30px] leading-[1.06] text-vyva-text-1">{gameTitle}</h1>
            <p className="mt-3 max-w-[26ch] text-[15px] leading-[1.55] text-vyva-text-2">{gamePrompt}</p>
          </div>
          <div className="flex h-[84px] w-[84px] flex-shrink-0 items-center justify-center rounded-[24px] bg-white shadow-vyva-card">
            <div className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px]" style={{ background: iconBg, color: accentColor }}>
              <BookOpen size={28} />
            </div>
          </div>
        </div>
      </section>

      {phase === "read" && (
        <section className="mt-4 rounded-[28px] bg-white p-5 shadow-vyva-card">
          <h2 className="font-display text-[28px] leading-tight text-vyva-text-1">{localizedVariant.title}</h2>
          <p className="mt-4 text-[19px] leading-[1.7] text-vyva-text-1">{payload.story}</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={handleListen}
              disabled={isAudioLoading}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-vyva-purple px-4 py-4 text-[16px] font-semibold text-white disabled:opacity-60"
            >
              {isAudioLoading ? <Loader2 size={18} className="animate-spin" /> : audioPaused ? <Play size={18} /> : <Volume2 size={18} />}
              {audioPaused ? t("storyRecall.resumeAudio") : t("storyRecall.listen")}
            </button>
            <button
              onClick={handlePause}
              disabled={!isSpeaking}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-vyva-border bg-white px-4 py-4 text-[16px] font-semibold text-vyva-text-1 disabled:opacity-50"
            >
              <Pause size={18} />
              {t("storyRecall.pauseAudio")}
            </button>
            <button
              onClick={handleStop}
              disabled={!isSpeaking && !audioPaused && !isAudioLoading}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] border border-vyva-border bg-white px-4 py-4 text-[16px] font-semibold text-vyva-text-1 disabled:opacity-50"
            >
              <VolumeX size={18} />
              {t("storyRecall.stopAudio")}
            </button>
          </div>

          {ttsError && (
            <p className="mt-3 rounded-[16px] bg-[#FFF7ED] px-4 py-3 text-[14px] leading-[1.45] text-vyva-text-2">
              {t("storyRecall.audioUnavailable")}
            </p>
          )}

          <button
            onClick={startQuestions}
            className="mt-5 w-full rounded-[20px] bg-[#A3470D] px-5 py-5 text-[18px] font-semibold text-white shadow-vyva-card"
          >
            {t("storyRecall.startQuestions")}
          </button>
        </section>
      )}

      {phase === "quiz" && currentQuestion && (
        <section className="mt-4 rounded-[28px] bg-white p-5 shadow-vyva-card">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-vyva-text-2">
            {t("storyRecall.questionProgress")} {questionIndex + 1}/{questions.length}
          </p>
          <h2 className="mt-3 font-display text-[28px] leading-tight text-vyva-text-1">{currentQuestion.prompt}</h2>
          <p className="mt-2 text-[15px] text-vyva-text-2">{t("storyRecall.chooseAnswer")}</p>

          <div className="mt-5 grid gap-3">
            {currentQuestion.options.map((option, index) => {
              const selected = selectedAnswer === index;
              return (
                <button
                  key={`${currentQuestion.prompt}-${option}`}
                  onClick={() => chooseAnswer(index)}
                  className={`min-h-[58px] rounded-[18px] border px-4 py-4 text-left text-[17px] font-semibold shadow-sm transition ${
                    selected
                      ? "border-[#A3470D] bg-[#FFF7ED] text-vyva-text-1"
                      : "border-vyva-border bg-white text-vyva-text-2"
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>

          {message && <p className="mt-3 text-[14px] font-medium text-[#A3470D]">{message}</p>}

          <button
            onClick={continueQuestion}
            className="mt-5 w-full rounded-[20px] bg-vyva-purple px-5 py-5 text-[18px] font-semibold text-white shadow-vyva-card"
          >
            {questionIndex < questions.length - 1 ? t("storyRecall.nextQuestion") : t("storyRecall.continueToRetell")}
          </button>
        </section>
      )}

      {phase === "retell" && (
        <section className="mt-4 rounded-[28px] bg-white p-5 shadow-vyva-card">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-vyva-text-2">{t("storyRecall.recall")}</p>
          <h2 className="mt-3 font-display text-[28px] leading-tight text-vyva-text-1">{t("storyRecall.retellTitle")}</h2>
          <p className="mt-2 text-[16px] leading-[1.55] text-vyva-text-2">{t("storyRecall.retellInstruction")}</p>

          <textarea
            value={retellText}
            onChange={(event) => {
              setRetellText(event.target.value);
              setMessage(null);
            }}
            placeholder={t("storyRecall.retellPlaceholder")}
            className="mt-5 min-h-[180px] w-full resize-none rounded-[20px] border border-vyva-border bg-[#FFFDF9] px-4 py-4 text-[17px] leading-[1.55] text-vyva-text-1 outline-none focus:border-vyva-purple"
          />
          <p className="mt-2 text-[14px] font-medium text-vyva-text-2">
            {wordCount} {t("storyRecall.words")}
          </p>

          {message && <p className="mt-3 text-[14px] font-medium text-[#A3470D]">{message}</p>}

          <button
            onClick={submitRetell}
            disabled={saving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[20px] bg-vyva-purple px-5 py-5 text-[18px] font-semibold text-white shadow-vyva-card disabled:opacity-60"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
            {saving ? t("storyRecall.scoring") : t("storyRecall.submitRetell")}
          </button>
        </section>
      )}
    </div>
  );
}
