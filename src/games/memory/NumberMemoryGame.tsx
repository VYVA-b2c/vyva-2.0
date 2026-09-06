import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Delete, Eye, RotateCcw } from "lucide-react";
import type { LanguageCode } from "@/i18n/languages";
import { useHomeMasterTheme } from "@/hooks/useHomeMasterTheme";
import { cn } from "@/lib/utils";
import BrainGameCompletionDialog from "../shared/BrainGameCompletionDialog";
import { saveGameResult } from "./gameStorage";
import {
  getNumberMemoryExpectedAnswer,
  NUMBER_MEMORY_MAX_LEVEL,
  scoreNumberMemoryRounds,
  type NumberMemoryMode,
  type NumberMemoryPayload,
} from "./numberMemoryData";
import type { CognitiveDomain, MemoryGameVariantContent, Recommendation } from "./types";

type Phase = "guidance" | "ready" | "countdown" | "presentation" | "recall" | "review" | "complete";

type NumberMemoryGameProps = {
  plan: Recommendation;
  localizedVariant: MemoryGameVariantContent;
  cognitiveDomain: CognitiveDomain;
  userId: string;
  language: LanguageCode;
  onBack: () => void;
  onOpenSameGame: (levelOverride?: number) => void | Promise<void>;
  actionLoading: "recommended" | "repeat" | "nextLevel" | null;
  onVoiceContextChange?: (context: Record<string, string | number | boolean>) => void;
};

type Copy = {
  level: string; round: string; of: string; showNumbers: string; ready: string; enterAnswer: string;
  forward: string; reverse: string; ascending: string; forwardGuide: string; reverseGuide: string; ascendingGuide: string;
  forwardExample: string; reverseExample: string; ascendingExample: string; begin: string; delete: string; clear: string;
  submit: string; notSure: string; review: string; expected: string; yourAnswer: string; noAnswer: string;
  seeResults: string; complete: string; passed: string; keepPractising: string; exactRounds: string; accuracy: string;
  time: string; nextLevel: string; tryAgain: string; moreActivities: string;
};

const COPY: Record<LanguageCode, Copy> = {
  en: { level: "Level", round: "Round", of: "of", showNumbers: "Show numbers", ready: "Ready", enterAnswer: "Enter your answer", forward: "Same order", reverse: "Reverse order", ascending: "Lowest to highest", forwardGuide: "Remember each number, then enter them in the same order.", reverseGuide: "Remember each number, then enter them in reverse order.", ascendingGuide: "Remember each number, then arrange them from lowest to highest.", forwardExample: "Example: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Example: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Example: 4  ·  7  ·  2  →  2 4 7", begin: "Continue", delete: "Delete", clear: "Clear", submit: "Submit", notSure: "I’m not sure", review: "Review", expected: "Expected", yourAnswer: "Your answer", noAnswer: "Not sure", seeResults: "See results", complete: "Number Memory complete", passed: "Level complete", keepPractising: "Keep practising", exactRounds: "Exact rounds", accuracy: "Accuracy", time: "Time", nextLevel: "Next level", tryAgain: "Try again", moreActivities: "More activities" },
  es: { level: "Nivel", round: "Ronda", of: "de", showNumbers: "Mostrar números", ready: "Prepárate", enterAnswer: "Introduce tu respuesta", forward: "Mismo orden", reverse: "Orden inverso", ascending: "De menor a mayor", forwardGuide: "Recuerda cada número e introdúcelos en el mismo orden.", reverseGuide: "Recuerda cada número e introdúcelos en orden inverso.", ascendingGuide: "Recuerda cada número y ordénalos de menor a mayor.", forwardExample: "Ejemplo: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Ejemplo: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Ejemplo: 4  ·  7  ·  2  →  2 4 7", begin: "Continuar", delete: "Borrar", clear: "Limpiar", submit: "Enviar", notSure: "No estoy seguro", review: "Revisión", expected: "Esperado", yourAnswer: "Tu respuesta", noAnswer: "No estoy seguro", seeResults: "Ver resultados", complete: "Memoria de números completada", passed: "Nivel completado", keepPractising: "Sigue practicando", exactRounds: "Rondas exactas", accuracy: "Precisión", time: "Tiempo", nextLevel: "Siguiente nivel", tryAgain: "Intentar de nuevo", moreActivities: "Más actividades" },
  fr: { level: "Niveau", round: "Manche", of: "sur", showNumbers: "Afficher les nombres", ready: "Prêt", enterAnswer: "Saisissez votre réponse", forward: "Même ordre", reverse: "Ordre inverse", ascending: "Du plus petit au plus grand", forwardGuide: "Retenez chaque nombre, puis saisissez-les dans le même ordre.", reverseGuide: "Retenez chaque nombre, puis saisissez-les dans l’ordre inverse.", ascendingGuide: "Retenez chaque nombre, puis classez-les du plus petit au plus grand.", forwardExample: "Exemple : 4  ·  7  ·  2  →  4 7 2", reverseExample: "Exemple : 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Exemple : 4  ·  7  ·  2  →  2 4 7", begin: "Continuer", delete: "Effacer", clear: "Vider", submit: "Valider", notSure: "Je ne sais pas", review: "Révision", expected: "Attendu", yourAnswer: "Votre réponse", noAnswer: "Je ne sais pas", seeResults: "Voir les résultats", complete: "Mémoire des nombres terminée", passed: "Niveau terminé", keepPractising: "Continuez à vous entraîner", exactRounds: "Manches exactes", accuracy: "Précision", time: "Temps", nextLevel: "Niveau suivant", tryAgain: "Réessayer", moreActivities: "Plus d’activités" },
  de: { level: "Level", round: "Runde", of: "von", showNumbers: "Zahlen zeigen", ready: "Bereit", enterAnswer: "Antwort eingeben", forward: "Gleiche Reihenfolge", reverse: "Umgekehrte Reihenfolge", ascending: "Aufsteigend", forwardGuide: "Merken Sie sich jede Zahl und geben Sie sie in derselben Reihenfolge ein.", reverseGuide: "Merken Sie sich jede Zahl und geben Sie sie in umgekehrter Reihenfolge ein.", ascendingGuide: "Merken Sie sich jede Zahl und ordnen Sie sie von klein nach groß.", forwardExample: "Beispiel: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Beispiel: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Beispiel: 4  ·  7  ·  2  →  2 4 7", begin: "Weiter", delete: "Löschen", clear: "Leeren", submit: "Bestätigen", notSure: "Nicht sicher", review: "Rückblick", expected: "Erwartet", yourAnswer: "Ihre Antwort", noAnswer: "Nicht sicher", seeResults: "Ergebnisse ansehen", complete: "Zahlengedächtnis abgeschlossen", passed: "Level abgeschlossen", keepPractising: "Weiter üben", exactRounds: "Exakte Runden", accuracy: "Genauigkeit", time: "Zeit", nextLevel: "Nächstes Level", tryAgain: "Erneut versuchen", moreActivities: "Mehr Aktivitäten" },
  it: { level: "Livello", round: "Round", of: "di", showNumbers: "Mostra i numeri", ready: "Preparati", enterAnswer: "Inserisci la risposta", forward: "Stesso ordine", reverse: "Ordine inverso", ascending: "Dal più piccolo al più grande", forwardGuide: "Ricorda ogni numero e inseriscili nello stesso ordine.", reverseGuide: "Ricorda ogni numero e inseriscili in ordine inverso.", ascendingGuide: "Ricorda ogni numero e ordinali dal più piccolo al più grande.", forwardExample: "Esempio: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Esempio: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Esempio: 4  ·  7  ·  2  →  2 4 7", begin: "Continua", delete: "Cancella", clear: "Azzera", submit: "Invia", notSure: "Non sono sicuro", review: "Revisione", expected: "Atteso", yourAnswer: "La tua risposta", noAnswer: "Non sono sicuro", seeResults: "Vedi risultati", complete: "Memoria dei numeri completata", passed: "Livello completato", keepPractising: "Continua ad allenarti", exactRounds: "Round esatti", accuracy: "Precisione", time: "Tempo", nextLevel: "Livello successivo", tryAgain: "Riprova", moreActivities: "Altre attività" },
  pt: { level: "Nível", round: "Ronda", of: "de", showNumbers: "Mostrar números", ready: "Prepare-se", enterAnswer: "Introduza a resposta", forward: "Mesma ordem", reverse: "Ordem inversa", ascending: "Do menor para o maior", forwardGuide: "Memorize cada número e introduza-os pela mesma ordem.", reverseGuide: "Memorize cada número e introduza-os pela ordem inversa.", ascendingGuide: "Memorize cada número e ordene-os do menor para o maior.", forwardExample: "Exemplo: 4  ·  7  ·  2  →  4 7 2", reverseExample: "Exemplo: 4  ·  7  ·  2  →  2 7 4", ascendingExample: "Exemplo: 4  ·  7  ·  2  →  2 4 7", begin: "Continuar", delete: "Apagar", clear: "Limpar", submit: "Enviar", notSure: "Não tenho a certeza", review: "Revisão", expected: "Esperado", yourAnswer: "A sua resposta", noAnswer: "Não tenho a certeza", seeResults: "Ver resultados", complete: "Memória de números concluída", passed: "Nível concluído", keepPractising: "Continue a praticar", exactRounds: "Rondas exatas", accuracy: "Precisão", time: "Tempo", nextLevel: "Nível seguinte", tryAgain: "Tentar novamente", moreActivities: "Mais atividades" },
};

const MODE_ACCENT: Record<NumberMemoryMode, string> = { forward: "#6D28D9", reverse: "#2563EB", ascending: "#0F766E" };

function readPayload(content: MemoryGameVariantContent): NumberMemoryPayload | null {
  const payload = content.payload as Partial<NumberMemoryPayload>;
  return payload.roundVersion === "number_memory_v2" && Array.isArray(payload.rounds) && payload.rounds.length === 3
    ? payload as NumberMemoryPayload
    : null;
}

function guidanceKey(userId: string, mode: NumberMemoryMode) {
  return `numberMemory:guidance:v2:${userId}:${mode}`;
}

function hasSeenMode(userId: string, mode: NumberMemoryMode) {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(guidanceKey(userId, mode)) === "true"; } catch { return false; }
}

function markModesSeen(userId: string, modes: NumberMemoryMode[]) {
  if (typeof window === "undefined") return;
  try { modes.forEach((mode) => window.localStorage.setItem(guidanceKey(userId, mode), "true")); } catch { /* Play does not depend on local storage. */ }
}

export default function NumberMemoryGame({ plan, localizedVariant, cognitiveDomain, userId, language, onBack, onOpenSameGame, actionLoading, onVoiceContextChange }: NumberMemoryGameProps) {
  const { isDark } = useHomeMasterTheme();
  const copy = COPY[language] ?? COPY.en;
  const payload = useMemo(() => readPayload(localizedVariant), [localizedVariant]);
  const modes = useMemo(() => [...new Set(payload?.rounds.map((round) => round.mode) ?? [])], [payload]);
  const unseenModes = useMemo(() => modes.filter((mode) => !hasSeenMode(userId, mode)), [modes, userId]);
  const [phase, setPhase] = useState<Phase>(() => unseenModes.length > 0 ? "guidance" : "ready");
  const [guidanceIndex, setGuidanceIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [digitIndex, setDigitIndex] = useState(-1);
  const [answer, setAnswer] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [startedAt] = useState(() => Date.now());
  const [completedDurationSeconds, setCompletedDurationSeconds] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const savedRef = useRef(false);

  const currentRound = payload?.rounds[roundIndex];
  const result = useMemo(() => payload && answers.length === 3 ? scoreNumberMemoryRounds(payload.rounds, answers) : null, [answers, payload]);
  const modeLabel = currentRound ? copy[currentRound.mode] : "";

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    onVoiceContextChange?.({ activity: "number_memory", level: plan.level, round: roundIndex + 1, mode: currentRound?.mode ?? "forward", phase });
  }, [currentRound?.mode, onVoiceContextChange, phase, plan.level, roundIndex]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden && (phase === "countdown" || phase === "presentation")) {
        clearTimer();
        setDigitIndex(-1);
        setPhase("ready");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [clearTimer, phase]);

  useEffect(() => {
    if (!currentRound) return;
    if (phase === "countdown") {
      clearTimer();
      timerRef.current = window.setTimeout(() => { setDigitIndex(0); setPhase("presentation"); }, 700);
      return clearTimer;
    }
    if (phase === "presentation") {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (digitIndex + 1 < currentRound.digits.length) setDigitIndex((current) => current + 1);
        else { setDigitIndex(-1); setPhase("recall"); }
      }, currentRound.presentationMsPerDigit);
      return clearTimer;
    }
  }, [clearTimer, currentRound, digitIndex, phase]);

  const finishAnswer = useCallback((value: string) => {
    if (!payload || phase !== "recall") return;
    const nextAnswers = [...answers, value];
    setAnswers(nextAnswers);
    setAnswer("");
    if (roundIndex < 2) { setRoundIndex((current) => current + 1); setPhase("ready"); }
    else { setCompletedDurationSeconds(Math.max(1, Math.round((Date.now() - startedAt) / 1000))); setPhase("review"); }
  }, [answers, payload, phase, roundIndex, startedAt]);

  useEffect(() => {
    if (phase !== "recall" || !currentRound) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) { event.preventDefault(); setAnswer((current) => current.length < getNumberMemoryExpectedAnswer(currentRound).length ? current + event.key : current); }
      else if (event.key === "Backspace") { event.preventDefault(); setAnswer((current) => current.slice(0, -1)); }
      else if (event.key === "Delete") { event.preventDefault(); setAnswer(""); }
      else if (event.key === "Enter" && answer.length > 0) { event.preventDefault(); finishAnswer(answer); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [answer, currentRound, finishAnswer, phase]);

  useEffect(() => {
    if (!payload || !result || savedRef.current) return;
    savedRef.current = true;
    const durationSeconds = completedDurationSeconds ?? Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    void saveGameResult({
      userId, gameType: plan.gameType, cognitiveDomain, variantId: plan.variantId, level: plan.level,
      score: result.accuracy, accuracy: result.accuracy, mistakes: result.mistakes, durationSeconds,
      completedAt: new Date().toISOString(), language,
      metadata: {
        roundVersion: "number_memory_v2", roundCount: 3, exactRoundCount: result.exactRoundCount,
        correctDigitCount: result.correctDigitCount, totalDigitCount: result.totalDigitCount,
        modeSequence: payload.rounds.map((round) => round.mode),
        sequenceLengths: payload.rounds.map((round) => round.digits.length),
        presentationMsPerDigit: payload.rounds.map((round) => round.presentationMsPerDigit),
        levelPassed: result.levelPassed,
      },
    });
  }, [cognitiveDomain, completedDurationSeconds, language, payload, plan, result, startedAt, userId]);

  if (!payload || !currentRound) return null;

  const durationSeconds = completedDurationSeconds ?? Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  const guidanceMode = unseenModes[guidanceIndex] ?? currentRound.mode;
  const answerLength = getNumberMemoryExpectedAnswer(currentRound).length;
  const startAfterGuidance = () => {
    markModesSeen(userId, [guidanceMode]);
    if (guidanceIndex < unseenModes.length - 1) setGuidanceIndex((current) => current + 1);
    else setPhase("ready");
  };
  const appendDigit = (digit: string) => setAnswer((current) => current.length < answerLength ? current + digit : current);

  if (phase === "complete" && result) {
    const canAdvance = result.levelPassed && plan.level < NUMBER_MEMORY_MAX_LEVEL;
    return (
      <div className={cn("min-h-[100dvh]", isDark ? "bg-[#100A18]" : "bg-[#FFF9F3]")}> 
        <BrainGameCompletionDialog
          title={copy.complete}
          summary={result.levelPassed ? copy.passed : copy.keepPractising}
          metrics={[
            { label: copy.exactRounds, value: `${result.exactRoundCount}/3` },
            { label: copy.accuracy, value: `${result.accuracy}%` },
            { label: copy.time, value: `${durationSeconds}s` },
          ]}
          nextLevelLabel={canAdvance ? `${copy.nextLevel} ${plan.level + 1}` : undefined}
          nextLevelDisplayLabel={canAdvance ? copy.nextLevel : undefined}
          replayLabel={copy.tryAgain}
          anotherLabel={copy.moreActivities}
          onNextLevel={canAdvance ? () => void onOpenSameGame(plan.level + 1) : undefined}
          onReplay={() => void onOpenSameGame(plan.level)}
          onAnother={onBack}
          disabled={actionLoading !== null}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[720px] px-1 pb-5 pt-2 sm:px-4">
      <section className={cn("overflow-hidden rounded-[28px] border p-5 shadow-vyva-card sm:p-7", isDark ? "border-white/10 bg-white/[0.07]" : "border-[#EEE8F1] bg-white")}>
        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-[13px] font-black uppercase tracking-[0.05em]", isDark ? "text-[#DCC8F8]" : "text-vyva-purple")}>{copy.level} {plan.level}</p>
          {phase !== "guidance" && phase !== "review" ? <p className={cn("text-[14px] font-bold", isDark ? "text-[#CFC5D8]" : "text-vyva-text-2")}>{copy.round} {roundIndex + 1} {copy.of} 3</p> : null}
        </div>

        {phase === "guidance" ? (
          <div className="pb-5 pt-3 text-center">
            <h2 className="font-display text-[28px] font-semibold">{copy[guidanceMode]}</h2>
            <p className={cn("mx-auto mt-3 max-w-[34rem] text-[18px] font-semibold leading-relaxed", isDark ? "text-[#D8CDDF]" : "text-vyva-text-2")}>{copy[`${guidanceMode}Guide` as const]}</p>
            <p className={cn("mx-auto mt-5 rounded-[18px] px-4 py-4 font-mono text-[17px] font-bold", isDark ? "bg-white/[0.08]" : "bg-[#FAF6FF]")}>{copy[`${guidanceMode}Example` as const]}</p>
            <button type="button" onClick={startAfterGuidance} className="mt-6 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card">{copy.begin}</button>
          </div>
        ) : null}

        {phase === "ready" ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#F1E8FF] text-vyva-purple"><Eye size={29} /></span>
            <h2 className="mt-5 font-display text-[30px] font-semibold">{modeLabel}</h2>
            <div className="mt-3 flex justify-center gap-2">
              {Array.from({ length: currentRound.digits.length }, (_, index) => <span key={index} className={cn("h-3 w-3 rounded-full", isDark ? "bg-white/30" : "bg-[#DCCAF0]")} />)}
            </div>
            <button type="button" onClick={() => setPhase("countdown")} className="mt-7 min-h-[62px] w-full rounded-full bg-vyva-purple px-6 text-[21px] font-black text-white shadow-vyva-card">{copy.showNumbers}</button>
          </div>
        ) : null}

        {phase === "countdown" || phase === "presentation" ? (
          <div aria-live="polite" className="grid min-h-[390px] place-items-center text-center">
            {phase === "countdown" ? <p className="font-display text-[34px] font-semibold">{copy.ready}</p> : <p key={digitIndex} className="font-mono text-[112px] font-black leading-none text-vyva-purple motion-safe:transition-opacity motion-reduce:animate-none">{currentRound.digits[digitIndex]}</p>}
          </div>
        ) : null}

        {phase === "recall" ? (
          <div className="pt-5 text-center">
            <p className="text-[16px] font-black" style={{ color: MODE_ACCENT[currentRound.mode] }}>{modeLabel}</p>
            <h2 className="mt-2 font-display text-[28px] font-semibold">{copy.enterAnswer}</h2>
            <div aria-label={copy.enterAnswer} className="mt-5 flex min-h-[72px] items-center justify-center gap-2 rounded-[20px] border border-[#DCCDED] bg-[#FBF8FF] px-3">
              {Array.from({ length: answerLength }, (_, index) => <span key={index} className={cn("grid h-11 min-w-8 place-items-center border-b-2 font-mono text-[28px] font-black text-[#241C30]", answer[index] ? "border-vyva-purple" : "border-[#CFC1DB]")}>{answer[index] ?? ""}</span>)}
            </div>
            <div className="mx-auto mt-5 grid max-w-[430px] grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => <button key={digit} type="button" onClick={() => appendDigit(digit)} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-white text-[25px] font-black text-[#241C30] shadow-sm active:bg-[#F4EAFF]">{digit}</button>)}
              <button type="button" aria-label={copy.clear} onClick={() => setAnswer("")} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-[#FAF7FC] text-[14px] font-black text-vyva-text-2">{copy.clear}</button>
              <button type="button" onClick={() => appendDigit("0")} className="min-h-[58px] rounded-[17px] border border-[#E4D9ED] bg-white text-[25px] font-black text-[#241C30] shadow-sm">0</button>
              <button type="button" aria-label={copy.delete} onClick={() => setAnswer((current) => current.slice(0, -1))} className="grid min-h-[58px] place-items-center rounded-[17px] border border-[#E4D9ED] bg-[#FAF7FC] text-vyva-purple"><Delete size={23} /></button>
            </div>
            <button type="button" disabled={!answer} onClick={() => finishAnswer(answer)} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card disabled:cursor-not-allowed disabled:opacity-40">{copy.submit}</button>
            <button type="button" onClick={() => finishAnswer("")} className={cn("mt-2 min-h-[48px] px-5 text-[16px] font-black underline underline-offset-4", isDark ? "text-[#DCC8F8]" : "text-vyva-purple")}>{copy.notSure}</button>
          </div>
        ) : null}

        {phase === "review" && result ? (
          <div className="pt-5">
            <div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-full bg-[#E9F7F1] text-[#0F766E]"><Check size={24} /></span><div><p className="text-[13px] font-black uppercase tracking-[0.05em] text-vyva-text-2">{copy.review}</p><h2 className="font-display text-[26px] font-semibold">{result.exactRoundCount}/3 {copy.exactRounds.toLowerCase()}</h2></div></div>
            <div className="mt-5 grid gap-3">
              {payload.rounds.map((round, index) => {
                const exact = result.editDistances[index] === 0;
                return <article key={round.id} className={cn("rounded-[18px] border p-4", exact ? "border-[#CBE9DC] bg-[#F3FBF7]" : "border-[#F0DFC2] bg-[#FFF9F1]")}><div className="flex items-center justify-between gap-3"><p className="font-black text-[#241C30]">{copy.round} {index + 1} · {copy[round.mode]}</p>{exact ? <Check size={20} className="text-[#0F766E]" /> : <RotateCcw size={19} className="text-[#A45B00]" />}</div><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-[11px] font-black uppercase text-vyva-text-2">{copy.yourAnswer}</p><p className="mt-1 font-mono text-[20px] font-black text-[#241C30]">{answers[index] || copy.noAnswer}</p></div><div><p className="text-[11px] font-black uppercase text-vyva-text-2">{copy.expected}</p><p className="mt-1 font-mono text-[20px] font-black text-[#0F766E]">{result.expectedAnswers[index]}</p></div></div></article>;
              })}
            </div>
            <button type="button" onClick={() => setPhase("complete")} className="mt-5 min-h-[60px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card">{copy.seeResults}</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
