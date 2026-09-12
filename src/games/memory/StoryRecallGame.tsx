import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ArrowLeft, Headphones, Loader2, Pause, Play, RotateCcw, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { LanguageCode } from "@/i18n/languages";
import { useAIScoring } from "@/games/shared/useAIScoring";
import { useTTS } from "@/games/shared/useTTS";
import { BRAIN_COACH_MAX_LEVEL, getBrainCoachLevelBand, getBrainCoachProgressLabel, getBrainCoachSupportiveProgressCopy } from "@/games/shared/brainCoachProgression";
import BrainGameCompletionDialog from "../shared/BrainGameCompletionDialog";
import { getGameHistory, saveGameResult } from "./gameStorage";
import { getVariantContent } from "./memoryGameRegistry";
import { applyStoryDifficultyChoice, pickStoryVariantForTheme } from "./progressionEngine";
import { getStoryTheme, STORY_THEMES, type StoryRecallPayload, type StoryRecallQuestion } from "./storyRecallData";
import { STORY_THEME_IDS, type CognitiveDomain, type MemoryGameVariantContent, type Recommendation, type StoryDifficultyChoice, type StoryThemeChoice, type StoryThemeId } from "./types";

export type StoryChoiceQuestion = StoryRecallQuestion;
export type StoryPayload = StoryRecallPayload;

type RetellScore = { covered: number[]; not_covered: number[]; covered_count: number; total_count: number; error: string | null };
type StoryRecallResult = { score: number; accuracy: number; mistakes: number; durationSeconds: number; correctAnswers: number; totalQuestions: number; coveredFacts: string[]; missedFacts: string[]; scoringError: string | null; scoringMode: "composite" | "quiz_fallback" };
type Props = { plan: Recommendation; localizedVariant: MemoryGameVariantContent; gamePrompt: string; cognitiveDomain: CognitiveDomain; userId: string; language: LanguageCode; t: (path: string, fallback?: string) => string; onBack: () => void; showBackButton?: boolean; onOpenRecommended: () => void; onOpenNextLevel: () => void | Promise<void>; onOpenSameGame: (levelOverride?: number) => void | Promise<void>; actionLoading: "recommended" | "repeat" | "nextLevel" | null };
type StoryCopy = Record<string, string>;
type Translate = Props["t"];

const uiCopy: Record<LanguageCode, Record<string, string>> = {
  en: { choose: "Choose your story", chooseHint: "Pick a theme and the amount of challenge that feels right today.", surprise: "Surprise me", challenge: "Challenge", gentle: "Gentle", recommended: "Recommended", stretch: "Stretch", start: "Start story", step: "Step", of: "of", themes: "themes explored", listen: "Listen", pause: "Pause", resume: "Resume", restart: "Restart", noRecall: "I can't recall", allRemember: "That's all I remember", prompts: "Helpful prompts", newTheme: "Choose a new theme", sameTheme: "Another in this theme", stamp: "Theme stamp collected", calm: "Take your time. This practice is untimed." },
  es: { choose: "Elige tu historia", chooseHint: "Escoge un tema y el reto que te resulte cómodo hoy.", surprise: "Sorpréndeme", challenge: "Dificultad", gentle: "Suave", recommended: "Recomendada", stretch: "Un reto", start: "Empezar historia", step: "Paso", of: "de", themes: "temas explorados", listen: "Escuchar", pause: "Pausar", resume: "Continuar", restart: "Reiniciar", noRecall: "No lo recuerdo", allRemember: "Eso es todo lo que recuerdo", prompts: "Pistas útiles", newTheme: "Elegir otro tema", sameTheme: "Otra de este tema", stamp: "Sello de tema conseguido", calm: "Tómate tu tiempo. Esta práctica no tiene reloj." },
  fr: { choose: "Choisissez votre histoire", chooseHint: "Choisissez un thème et le niveau d'effort qui vous convient aujourd'hui.", surprise: "Surprenez-moi", challenge: "Difficulté", gentle: "Douce", recommended: "Recommandée", stretch: "Défi", start: "Commencer", step: "Étape", of: "sur", themes: "thèmes explorés", listen: "Écouter", pause: "Pause", resume: "Reprendre", restart: "Recommencer", noRecall: "Je ne me souviens pas", allRemember: "C'est tout ce dont je me souviens", prompts: "Repères utiles", newTheme: "Choisir un autre thème", sameTheme: "Une autre de ce thème", stamp: "Tampon de thème obtenu", calm: "Prenez votre temps. Cet exercice n'est pas chronométré." },
  de: { choose: "Wählen Sie Ihre Geschichte", chooseHint: "Wählen Sie ein Thema und die Herausforderung, die heute gut passt.", surprise: "Überraschen Sie mich", challenge: "Schwierigkeit", gentle: "Sanft", recommended: "Empfohlen", stretch: "Herausfordernd", start: "Geschichte starten", step: "Schritt", of: "von", themes: "Themen entdeckt", listen: "Anhören", pause: "Pause", resume: "Fortsetzen", restart: "Neu starten", noRecall: "Ich kann mich nicht erinnern", allRemember: "Das ist alles, woran ich mich erinnere", prompts: "Hilfreiche Hinweise", newTheme: "Anderes Thema wählen", sameTheme: "Noch eine zu diesem Thema", stamp: "Themenstempel gesammelt", calm: "Nehmen Sie sich Zeit. Es gibt keine Uhr." },
  it: { choose: "Scegli la tua storia", chooseHint: "Scegli un tema e la difficoltà più adatta a oggi.", surprise: "Sorprendimi", challenge: "Difficoltà", gentle: "Dolce", recommended: "Consigliata", stretch: "Sfida", start: "Inizia la storia", step: "Passo", of: "di", themes: "temi esplorati", listen: "Ascolta", pause: "Pausa", resume: "Continua", restart: "Ricomincia", noRecall: "Non ricordo", allRemember: "Questo è tutto ciò che ricordo", prompts: "Suggerimenti utili", newTheme: "Scegli un altro tema", sameTheme: "Un'altra di questo tema", stamp: "Timbro del tema ottenuto", calm: "Prenditi il tuo tempo. Non c'è un timer." },
  pt: { choose: "Escolha a sua história", chooseHint: "Escolha um tema e o desafio que lhe pareça certo hoje.", surprise: "Surpreenda-me", challenge: "Dificuldade", gentle: "Suave", recommended: "Recomendada", stretch: "Desafio", start: "Começar história", step: "Passo", of: "de", themes: "temas explorados", listen: "Ouvir", pause: "Pausar", resume: "Continuar", restart: "Reiniciar", noRecall: "Não me lembro", allRemember: "É tudo o que me lembro", prompts: "Pistas úteis", newTheme: "Escolher outro tema", sameTheme: "Outra deste tema", stamp: "Selo do tema conquistado", calm: "Leve o tempo que precisar. Não há relógio." },
};

function getDurationSeconds(startedAt: number) { return Math.max(1, Math.round((Date.now() - startedAt) / 1000)); }
function asStrings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []; }
function isQuestion(value: unknown): value is StoryRecallQuestion {
  if (!value || typeof value !== "object") return false;
  const question = value as Partial<StoryRecallQuestion>;
  return typeof question.prompt === "string" && Array.isArray(question.options) && question.options.length >= 2 && question.options.every((option) => typeof option === "string" && option.trim()) && Number.isInteger(question.answerIndex) && question.answerIndex! >= 0 && question.answerIndex! < question.options.length;
}

export function getStoryPayload(content: MemoryGameVariantContent): StoryPayload {
  const payload = content.payload;
  const themeId = STORY_THEME_IDS.includes(payload.themeId as StoryThemeId) ? payload.themeId as StoryThemeId : "home";
  const theme = getStoryTheme(themeId);
  return {
    storyId: typeof payload.storyId === "string" ? payload.storyId : "legacy-story",
    themeId,
    story: typeof payload.story === "string" ? payload.story : "",
    keyFacts: asStrings(payload.keyFacts),
    choiceQuestions: Array.isArray(payload.choiceQuestions) ? payload.choiceQuestions.filter(isQuestion).map((question) => ({ ...question, kind: question.kind ?? "detail" })) : [],
    levelBand: typeof payload.levelBand === "string" ? payload.levelBand : "Foundation",
    bandStep: Number.isFinite(Number(payload.bandStep)) ? Number(payload.bandStep) : 1,
    retellMode: payload.retellMode === "open" || payload.retellMode === "light" ? payload.retellMode : "guided",
    retellPrompts: asStrings(payload.retellPrompts),
    theme: payload.theme && typeof payload.theme === "object" ? payload.theme as StoryRecallPayload["theme"] : { emoji: theme.emoji, accent: theme.accent, surface: theme.surface, border: theme.border, motif: theme.motif },
  };
}

export function calculateStoryRecallMetrics(params: { level: number; startedAt: number; questionCount: number; correctQuestionCount: number; retellScore: RetellScore }) {
  const choiceAccuracy = params.questionCount > 0 ? params.correctQuestionCount / params.questionCount : 1;
  const fallback = Boolean(params.retellScore.error);
  const retellAccuracy = params.retellScore.total_count > 0 ? params.retellScore.covered_count / params.retellScore.total_count : 0;
  const accuracy = Math.round((fallback ? choiceAccuracy : choiceAccuracy * 0.4 + retellAccuracy * 0.6) * 100);
  const mistakes = Math.max(0, params.questionCount - params.correctQuestionCount) + (fallback ? 0 : Math.max(0, params.retellScore.total_count - params.retellScore.covered_count));
  const durationSeconds = getDurationSeconds(params.startedAt);
  const score = Math.max(60, Math.round(accuracy + params.level * 12 - mistakes * 2 + Math.max(0, 45 - durationSeconds)));
  return { score, accuracy, mistakes, durationSeconds };
}

function factList(indices: number[], facts: string[]) { return indices.map((index) => facts[index - 1]).filter((fact): fact is string => Boolean(fact)); }

export default function StoryRecallGame({ plan, localizedVariant, cognitiveDomain, userId, language, t, onBack, showBackButton = true, onOpenRecommended, onOpenSameGame, actionLoading }: Props) {
  const [searchParams] = useSearchParams();
  const requestedTheme = searchParams.get("theme");
  const requestedChallenge = searchParams.get("challenge");
  const initialTheme: StoryThemeChoice = requestedTheme === "surprise" || STORY_THEME_IDS.includes(requestedTheme as StoryThemeId) ? requestedTheme as StoryThemeChoice : "surprise";
  const initialDifficulty: StoryDifficultyChoice = requestedChallenge === "gentle" || requestedChallenge === "stretch" ? requestedChallenge : "recommended";
  const copy = uiCopy[language];
  const [phase, setPhase] = useState<"setup" | "read" | "quiz" | "retell" | "result">("setup");
  const [themeChoice, setThemeChoice] = useState<StoryThemeChoice>(initialTheme);
  const [difficultyChoice, setDifficultyChoice] = useState<StoryDifficultyChoice>(initialDifficulty);
  const [activePlan, setActivePlan] = useState(plan);
  const [activeContent, setActiveContent] = useState(localizedVariant);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [retellText, setRetellText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [result, setResult] = useState<StoryRecallResult | null>(null);
  const [themesExplored, setThemesExplored] = useState<StoryThemeId[]>([]);
  const { scoreRetell } = useAIScoring();
  const { speak, stop, pause, resume, isSpeaking, isLoading: audioLoading, error: audioError } = useTTS();
  const payload = useMemo(() => getStoryPayload(activeContent), [activeContent]);
  const questions = payload.choiceQuestions;
  const selectedAnswer = answers[questionIndex];
  const currentQuestion = questions[questionIndex] ?? null;
  const correctQuestionCount = questions.reduce((total, question, index) => total + (answers[index] === question.answerIndex ? 1 : 0), 0);
  const previewLevel = applyStoryDifficultyChoice(plan.level, difficultyChoice);
  const displayedBand = getBrainCoachLevelBand(previewLevel);
  const displayedStep = ((previewLevel - 1) % 5) + 1;
  const activeTheme = getStoryTheme(payload.themeId);
  useEffect(() => () => stop(), [stop]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [phase]);

  const beginStory = async () => {
    setSetupLoading(true);
    try {
      const history = await getGameHistory(userId);
      const selectedLevel = applyStoryDifficultyChoice(plan.level, difficultyChoice);
      const variant = pickStoryVariantForTheme(history, selectedLevel, themeChoice);
      setActivePlan({ ...plan, level: selectedLevel, variantId: variant.id });
      setActiveContent(getVariantContent(variant, language));
      setThemesExplored(Array.from(new Set(history.filter((entry) => entry.gameType === "story_recall").map((entry) => entry.metadata?.themeId).filter((id): id is StoryThemeId => STORY_THEME_IDS.includes(id as StoryThemeId)))));
      setStartedAt(Date.now());
      setPhase("read");
    } finally { setSetupLoading(false); }
  };

  const resetToSetup = (choice: StoryThemeChoice) => {
    stop(); setThemeChoice(choice); setAnswers([]); setQuestionIndex(0); setRetellText(""); setMessage(null); setResult(null); setPhase("setup");
  };

  const submitRetell = async (noMoreRecall = false) => {
    const trimmed = noMoreRecall ? "" : retellText.trim();
    setSaving(true);
    const retellScore: RetellScore = trimmed ? await scoreRetell(trimmed, payload.keyFacts, language) : { covered: [], not_covered: payload.keyFacts.map((_, index) => index + 1), covered_count: 0, total_count: payload.keyFacts.length, error: null };
    const metrics = calculateStoryRecallMetrics({ level: activePlan.level, startedAt, questionCount: questions.length, correctQuestionCount, retellScore });
    const scoringMode = retellScore.error ? "quiz_fallback" : "composite";
    const coveredFacts = retellScore.error ? [] : factList(retellScore.covered, payload.keyFacts);
    const missedFacts = retellScore.error ? [] : factList(retellScore.not_covered, payload.keyFacts);
    try {
      await saveGameResult({ userId, gameType: activePlan.gameType, cognitiveDomain, variantId: activePlan.variantId, level: activePlan.level, score: metrics.score, accuracy: metrics.accuracy, mistakes: metrics.mistakes, durationSeconds: metrics.durationSeconds, completedAt: new Date().toISOString(), language, metadata: { storyId: payload.storyId, themeId: payload.themeId, adaptiveBaseline: plan.level, playedLevel: activePlan.level, difficultyChoice, questionKinds: questions.map((question, index) => ({ kind: question.kind, correct: answers[index] === question.answerIndex })), recalledFactCount: coveredFacts.length, totalFactCount: payload.keyFacts.length, scoringMode, retellInput: noMoreRecall ? "no_more_recall" : "typed" } });
      setThemesExplored((current) => Array.from(new Set([...current, payload.themeId])));
      setResult({ ...metrics, correctAnswers: correctQuestionCount, totalQuestions: questions.length, coveredFacts, missedFacts, scoringError: retellScore.error, scoringMode });
      setPhase("result");
    } finally { setSaving(false); }
  };

  if (phase === "setup") return <SetupScreen language={language} copy={copy} t={t} themeChoice={themeChoice} setThemeChoice={setThemeChoice} difficultyChoice={difficultyChoice} setDifficultyChoice={setDifficultyChoice} band={displayedBand.label} step={displayedStep} loading={setupLoading} onStart={() => void beginStory()} onBack={showBackButton ? onBack : undefined} />;
  if (!payload.story) return <div className="p-6 text-vyva-text-1">{t("memory.exerciseNotFound")}</div>;

  if (phase === "result" && result) {
    const canAdvance = result.scoringMode === "composite" && result.accuracy >= 80 && activePlan.level < BRAIN_COACH_MAX_LEVEL;
    return <div className="min-h-[100dvh] bg-[#FFF9F1]"><BrainGameCompletionDialog title={t("storyRecall.completionTitle")} summary={`${activeTheme.emoji} ${copy.stamp}. ${getBrainCoachSupportiveProgressCopy({ advanced: canAdvance, level: activePlan.level })}`} metrics={[{ label: t("storyRecall.recall"), value: `${result.coveredFacts.length}/${payload.keyFacts.length}` }, { label: t("storyRecall.questions"), value: `${result.correctAnswers}/${result.totalQuestions}` }, { label: copy.themes, value: `${themesExplored.length}/8` }]} continueLabel={t("brainGames.resultActions.continue")} nextLevelLabel={canAdvance ? t("brainGames.resultActions.continueToLevel").replace("{level}", String(activePlan.level + 1)) : undefined} nextLevelDisplayLabel={canAdvance ? getBrainCoachProgressLabel(activePlan.level + 1) : undefined} replayLabel={copy.sameTheme} anotherLabel={t("brainGames.resultActions.moreGames", "More games")} onContinue={onOpenRecommended} onNextLevel={canAdvance ? () => void onOpenSameGame(activePlan.level + 1) : undefined} onReplay={() => resetToSetup(payload.themeId)} onAnother={onBack} disabled={actionLoading !== null} details={<ResultDetails result={result} payload={payload} copy={copy} t={t} onNewTheme={() => resetToSetup("surprise")} />} /></div>;
  }

  const hint = phase === "read" ? t("storyRecall.readStoryHint", "Read, then hide the story.") : phase === "quiz" ? t("storyRecall.quizHint", "Answer from memory.") : t("storyRecall.retellHint", "Tell the story in your own words.");
  const header = <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><span className="rounded-full px-3 py-1.5 text-[13px] font-black" style={{ background: activeTheme.surface, color: activeTheme.accent }}>{activeTheme.emoji} {activeTheme.label[language]} · {getBrainCoachLevelBand(activePlan.level).label} {((activePlan.level - 1) % 5) + 1}/5</span><p className="text-[14px] font-semibold text-vyva-text-2">{hint}</p></div>;

  return <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2">
    {phase === "read" ? <section className="rounded-[28px] border bg-white p-5 shadow-vyva-card sm:p-6" style={{ borderColor: activeTheme.border }}>{header}<h2 className="font-display text-[30px] leading-tight text-vyva-text-1">{activeContent.title}</h2><div className="mt-4 rounded-[22px] px-5 py-5" style={{ background: activeTheme.surface }}><p className="text-[19px] font-semibold leading-[1.7] text-vyva-text-1">{payload.story}</p></div><AudioControls copy={copy} story={payload.story} language={language} isSpeaking={isSpeaking} isLoading={audioLoading} speak={speak} pause={pause} resume={resume} stop={stop} border={activeTheme.border} accent={activeTheme.accent} />{audioError ? <p className="mt-2 text-[14px] text-vyva-text-2">{t("storyRecall.audioUnavailable")}</p> : null}<button type="button" onClick={() => { stop(); setPhase(questions.length ? "quiz" : "retell"); }} className="mt-5 min-h-[64px] w-full rounded-full bg-vyva-purple px-5 text-[20px] font-black text-white shadow-vyva-card">{questions.length ? t("storyRecall.startQuestions") : t("storyRecall.startRecall", "Hide story and retell")}</button></section> : null}
    {phase === "quiz" && currentQuestion ? <QuizScreen header={header} question={currentQuestion} questionIndex={questionIndex} questionCount={questions.length} selectedAnswer={selectedAnswer} answers={answers} setAnswers={setAnswers} message={message} setMessage={setMessage} accent={activeTheme.accent} surface={activeTheme.surface} t={t} onContinue={() => questionIndex < questions.length - 1 ? setQuestionIndex((value) => value + 1) : setPhase("retell")} /> : null}
    {phase === "retell" ? <RetellScreen header={header} payload={payload} copy={copy} t={t} retellText={retellText} setRetellText={setRetellText} saving={saving} surface={activeTheme.surface} accent={activeTheme.accent} onSubmit={() => void submitRetell(false)} onNoRecall={() => void submitRetell(retellText.trim().length === 0)} /> : null}
  </div>;
}

function SetupScreen({ language, copy, t, themeChoice, setThemeChoice, difficultyChoice, setDifficultyChoice, band, step, loading, onStart, onBack }: {
  language: LanguageCode; copy: StoryCopy; t: Translate; themeChoice: StoryThemeChoice; setThemeChoice: Dispatch<SetStateAction<StoryThemeChoice>>;
  difficultyChoice: StoryDifficultyChoice; setDifficultyChoice: Dispatch<SetStateAction<StoryDifficultyChoice>>; band: string; step: number;
  loading: boolean; onStart: () => void; onBack?: () => void;
}) {
  return <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2">{onBack ? <button onClick={onBack} className="mb-3 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-4 text-[16px] font-bold shadow-vyva-card"><ArrowLeft size={18} />{t("common.back")}</button> : null}<section className="rounded-[30px] border border-[#E9DDF4] bg-white p-5 shadow-vyva-card sm:p-7"><div className="flex items-start gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#F5EEFF] text-[28px]" aria-hidden="true">📖</span><div><h1 className="font-display text-[30px] leading-tight text-vyva-text-1">{copy.choose}</h1><p className="mt-1 text-[16px] leading-relaxed text-vyva-text-2">{copy.chooseHint}</p></div></div><fieldset className="mt-6"><legend className="text-[14px] font-black uppercase tracking-[0.06em] text-vyva-text-2">{t("storyRecall.readLabel", "Story theme")}</legend><div className="mt-3 grid grid-cols-2 gap-3"><button type="button" aria-pressed={themeChoice === "surprise"} onClick={() => setThemeChoice("surprise")} className={`min-h-[60px] rounded-[18px] border-2 px-3 text-[16px] font-black ${themeChoice === "surprise" ? "border-vyva-purple bg-[#F5EEFF] text-vyva-purple" : "border-vyva-border bg-white text-vyva-text-1"}`}><Sparkles className="mr-2 inline" size={19} />{copy.surprise}</button>{STORY_THEMES.map((theme) => <button key={theme.id} type="button" aria-pressed={themeChoice === theme.id} onClick={() => setThemeChoice(theme.id)} className="min-h-[60px] rounded-[18px] border-2 px-3 text-[16px] font-black" style={{ borderColor: themeChoice === theme.id ? theme.accent : theme.border, background: themeChoice === theme.id ? theme.surface : "white", color: theme.accent }}><span className="mr-2" aria-hidden="true">{theme.emoji}</span>{theme.label[language]}</button>)}</div></fieldset><fieldset className="mt-6"><legend className="text-[14px] font-black uppercase tracking-[0.06em] text-vyva-text-2">{copy.challenge}</legend><div className="mt-3 grid grid-cols-3 gap-2 rounded-[20px] bg-[#F7F2FA] p-2">{(["gentle", "recommended", "stretch"] as const).map((choice) => <button key={choice} type="button" aria-pressed={difficultyChoice === choice} onClick={() => setDifficultyChoice(choice)} className={`min-h-[54px] rounded-[15px] px-1 text-[14px] font-black ${difficultyChoice === choice ? "bg-white text-vyva-purple shadow-sm" : "text-vyva-text-2"}`}>{copy[choice]}</button>)}</div><div className="mt-3 rounded-[18px] bg-[#FFF9F1] px-4 py-3 text-center"><p className="text-[18px] font-black text-vyva-text-1">{band} · {copy.step} {step} {copy.of} 5</p><p className="mt-1 text-[14px] text-vyva-text-2">{copy.calm}</p></div></fieldset><button type="button" onClick={onStart} disabled={loading} className="mt-6 inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 text-[20px] font-black text-white shadow-vyva-card disabled:opacity-60">{loading ? <Loader2 className="animate-spin" size={21} /> : <Play size={21} fill="currentColor" />}{copy.start}</button></section></div>;
}

function AudioControls({ copy, story, language, isSpeaking, isLoading, speak, pause, resume, stop, border, accent }: {
  copy: StoryCopy; story: string; language: LanguageCode; isSpeaking: boolean; isLoading: boolean;
  speak: (text: string, language?: string) => Promise<void>; pause: () => void; resume: () => void; stop: () => void; border: string; accent: string;
}) {
  return <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => isSpeaking ? pause() : void (isLoading ? undefined : speak(story, language))} disabled={isLoading} className="inline-flex min-h-[50px] items-center gap-2 rounded-full border-2 px-4 text-[16px] font-black" style={{ borderColor: border, color: accent }}>{isLoading ? <Loader2 className="animate-spin" size={19} /> : isSpeaking ? <Pause size={19} /> : <Headphones size={19} />}{isSpeaking ? copy.pause : copy.listen}</button><button type="button" onClick={resume} className="inline-flex min-h-[50px] items-center gap-2 rounded-full border border-vyva-border px-4 text-[16px] font-bold text-vyva-text-2"><Play size={18} />{copy.resume}</button><button type="button" onClick={() => { stop(); void speak(story, language); }} className="inline-flex min-h-[50px] items-center gap-2 rounded-full border border-vyva-border px-4 text-[16px] font-bold text-vyva-text-2"><RotateCcw size={18} />{copy.restart}</button></div>;
}

function QuizScreen({ header, question, questionIndex, questionCount, selectedAnswer, answers, setAnswers, message, setMessage, accent, surface, t, onContinue }: {
  header: ReactNode; question: StoryRecallQuestion; questionIndex: number; questionCount: number; selectedAnswer?: number; answers: number[];
  setAnswers: Dispatch<SetStateAction<number[]>>; message: string | null; setMessage: Dispatch<SetStateAction<string | null>>;
  accent: string; surface: string; t: Translate; onContinue: () => void;
}) {
  return <section className="rounded-[28px] border border-[#EEE8F1] bg-white p-5 shadow-vyva-card sm:p-6">{header}<p className="text-[13px] font-black uppercase text-vyva-text-2">{t("storyRecall.questionProgress")} {questionIndex + 1}/{questionCount}</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F3E8D5]"><div className="h-full rounded-full transition-[width] motion-reduce:transition-none" style={{ width: `${((questionIndex + 1) / questionCount) * 100}%`, background: accent }} /></div><h2 className="mt-4 font-display text-[29px] leading-tight text-vyva-text-1">{question.prompt}</h2><div className="mt-5 grid gap-3">{question.options.map((option: string, index: number) => <button key={option} type="button" aria-pressed={selectedAnswer === index} onClick={() => { const next = [...answers]; next[questionIndex] = index; setAnswers(next); setMessage(null); }} className="min-h-[60px] rounded-[18px] border-2 px-4 py-3 text-left text-[17px] font-bold" style={{ borderColor: selectedAnswer === index ? accent : "#E7DEE9", background: selectedAnswer === index ? surface : "white" }}>{option}</button>)}</div>{message ? <p className="mt-3 text-[14px] font-bold text-[#A3470D]">{message}</p> : null}<button type="button" onClick={() => { if (typeof selectedAnswer !== "number") { setMessage(t("storyRecall.answerMissing")); return; } onContinue(); }} className="mt-5 min-h-[62px] w-full rounded-full bg-vyva-purple px-5 text-[20px] font-black text-white">{questionIndex < questionCount - 1 ? t("storyRecall.nextQuestion") : t("storyRecall.continueToRetell")}</button></section>;
}

function RetellScreen({ header, payload, copy, t, retellText, setRetellText, saving, surface, accent, onSubmit, onNoRecall }: {
  header: ReactNode; payload: StoryRecallPayload; copy: StoryCopy; t: Translate; retellText: string; setRetellText: Dispatch<SetStateAction<string>>;
  saving: boolean; surface: string; accent: string; onSubmit: () => void; onNoRecall: () => void;
}) {
  return <section className="rounded-[28px] border border-[#EEE8F1] bg-white p-5 shadow-vyva-card sm:p-6">{header}<h2 className="font-display text-[29px] text-vyva-text-1">{t("storyRecall.retellTitle")}</h2><p className="mt-2 text-[16px] leading-relaxed text-vyva-text-2">{t("storyRecall.retellInstruction")}</p>{payload.retellPrompts.length ? <div className="mt-4 rounded-[18px] p-4" style={{ background: surface }}><p className="text-[13px] font-black uppercase" style={{ color: accent }}>{copy.prompts}</p><div className="mt-2 flex flex-wrap gap-2">{payload.retellPrompts.map((prompt: string) => <span key={prompt} className="rounded-full bg-white px-3 py-2 text-[14px] font-bold text-vyva-text-2">{prompt}</span>)}</div></div> : null}<textarea value={retellText} onChange={(event) => setRetellText(event.target.value)} placeholder={t("storyRecall.retellPlaceholder")} className="mt-5 min-h-[180px] w-full resize-none rounded-[20px] border-2 border-vyva-border bg-[#FFFDF9] px-4 py-4 text-[17px] leading-relaxed text-vyva-text-1 outline-none focus:border-vyva-purple" /><button type="button" onClick={onSubmit} disabled={saving || !retellText.trim()} className="mt-5 inline-flex min-h-[62px] w-full items-center justify-center gap-2 rounded-full bg-vyva-purple px-5 text-[20px] font-black text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}{saving ? t("storyRecall.scoring") : t("storyRecall.submitRetell")}</button><button type="button" onClick={onNoRecall} disabled={saving} className="mt-2 min-h-[48px] w-full rounded-full px-4 text-[15px] font-black text-vyva-text-2 underline decoration-[#D8C7F3] underline-offset-4">{retellText.trim() ? copy.allRemember : copy.noRecall}</button></section>;
}

function ResultDetails({ result, payload, copy, t, onNewTheme }: { result: StoryRecallResult; payload: StoryRecallPayload; copy: StoryCopy; t: Translate; onNewTheme: () => void }) {
  return <div className="grid gap-3">{result.scoringError ? <div className="rounded-[18px] border border-[#CFE9D9] bg-[#F0FDF4] p-4 text-[15px] text-vyva-text-2">{t("storyRecall.scoringFallback")}</div> : null}<button type="button" onClick={onNewTheme} className="min-h-[52px] rounded-full border-2 border-[#D8C7F3] bg-white px-4 text-[16px] font-black text-vyva-purple">{copy.newTheme}</button>{result.coveredFacts.length ? <div className="rounded-[18px] border border-[#CFE9D9] bg-[#F0FDF4] p-3"><p className="text-[12px] font-black uppercase text-vyva-text-2">{t("storyRecall.remembered")}</p>{result.coveredFacts.map((fact: string) => <p key={fact} className="mt-2 rounded-[14px] bg-white px-3 py-2 text-[14px] text-vyva-text-1">{fact}</p>)}</div> : null}{result.missedFacts.length ? <div className="rounded-[18px] border border-[#F3E0BD] bg-[#FFF7ED] p-3"><p className="text-[12px] font-black uppercase text-vyva-text-2">{t("storyRecall.alsoInStory")}</p>{result.missedFacts.map((fact: string) => <p key={fact} className="mt-2 rounded-[14px] bg-white px-3 py-2 text-[14px] text-vyva-text-1">{fact}</p>)}</div> : null}</div>;
}
