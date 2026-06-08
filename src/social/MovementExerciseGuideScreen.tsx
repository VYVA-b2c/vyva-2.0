import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, Headphones, Loader2, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import MovementStepAnimation from "./MovementStepAnimation";
import {
  MOVEMENT_EXERCISE_SESSIONS,
  MOVEMENT_EXERCISE_VISUALS,
  addMovementWeekLogDate,
  getMovementExerciseCards,
  getMovementExerciseLanguage,
  getMovementSessionUiCopy,
  getMovementStepImage,
  isMovementExerciseCardId,
  loadMovementWeekLogDates,
  saveLastMovementExerciseId,
  saveMovementWeekLogDates,
  type MovementExerciseLanguage,
  type MovementStepMotion,
} from "./movementExercises";

const MOVEMENT_ROOM_PATH = "/social-rooms/morning-movement";
const DEFAULT_MOVEMENT_STEP_MOTION: MovementStepMotion = "seated-tall";

type GuideCopy = {
  backToRoom: string;
  guideLabel: string;
  tenMinutes: string;
  stepLabel: (current: number, total: number) => string;
  progressLabel: (current: number, total: number) => string;
  currentStepTitle: string;
  stepListTitle: string;
  stepListBody: string;
  completedStep: string;
  currentStep: string;
  nextStepStatus: string;
  audioTitle: string;
  audioBody: string;
  audioSync: string;
  audioUnavailable: string;
  startAudio: string;
  stopAudio: string;
  audioStarting: string;
  audioLive: string;
  startSession: string;
  pauseSession: string;
  resumeSession: string;
  replayCue: string;
  sessionReady: string;
  sessionPaused: string;
  sessionComplete: string;
  timeRemaining: (time: string) => string;
  previousStep: string;
  nextStep: string;
  nextHint: string;
  finishHint: string;
  finish: string;
  saving: string;
  error: string;
  notFoundTitle: string;
  notFoundBody: string;
};

function getMovementGuideCopy(language: MovementExerciseLanguage): GuideCopy {
  if (language === "de") {
    return {
      backToRoom: "Zurueck zum Bewegungsraum",
      guideLabel: "Gefuehrte Uebung",
      tenMinutes: "10 Min",
      stepLabel: (current, total) => `Schritt ${current} von ${total}`,
      progressLabel: (current, total) => `${current}/${total} Schritte`,
      currentStepTitle: "Amaras aktueller Hinweis",
      stepListTitle: "Sitzungsschritte",
      stepListBody: "Tippe auf einen Schritt, wenn du zurueckgehen oder vorausgehen moechtest.",
      completedStep: "Fertig",
      currentStep: "Jetzt",
      nextStepStatus: "Weiter",
      audioTitle: "Live-Audioguide",
      audioBody: "Vyva fuehrt dich langsam durch diesen Schritt.",
      audioSync: "Das Audio folgt dem Schritt auf dem Bildschirm.",
      audioUnavailable: "Der visuelle Guide funktioniert auch ohne Audio.",
      startAudio: "Audioguide starten",
      stopAudio: "Audioguide stoppen",
      audioStarting: "Startet...",
      audioLive: "Audioguide ist live",
      startSession: "Amara-Guide starten",
      pauseSession: "Pause",
      resumeSession: "Fortsetzen",
      replayCue: "Schritt wiederholen",
      sessionReady: "Bereit fuer die gefuehrte Sitzung",
      sessionPaused: "Sitzung pausiert",
      sessionComplete: "Sitzung bereit zum Speichern",
      timeRemaining: (time) => `${time} uebrig`,
      previousStep: "Zurueck",
      nextStep: "Weiter",
      nextHint: "Tippe Weiter, wenn du bereit bist.",
      finishHint: "Speichere die Sitzung, wenn dieser Schritt fertig ist.",
      finish: "Beenden und 10 Min speichern",
      saving: "Speichern...",
      error: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      notFoundTitle: "Uebung nicht gefunden",
      notFoundBody: "Waehle eine andere sanfte Aktivitaet im Bewegungsraum.",
    };
  }

  if (language === "fr") {
    return {
      backToRoom: "Retour a la salle de mouvement",
      guideLabel: "Exercice guide",
      tenMinutes: "10 min",
      stepLabel: (current, total) => `Etape ${current} sur ${total}`,
      progressLabel: (current, total) => `${current}/${total} etapes`,
      currentStepTitle: "Consigne actuelle d'Amara",
      stepListTitle: "Etapes de la seance",
      stepListBody: "Touchez une etape pour revenir ou avancer doucement.",
      completedStep: "Fait",
      currentStep: "Maintenant",
      nextStepStatus: "Suivant",
      audioTitle: "Guide audio en direct",
      audioBody: "Vyva peut guider cet exercice lentement, une etape a la fois.",
      audioSync: "L'audio suit l'etape affichee a l'ecran.",
      audioUnavailable: "Le guide visuel fonctionne aussi sans audio.",
      startAudio: "Demarrer le guide audio",
      stopAudio: "Arreter le guide audio",
      audioStarting: "Demarrage...",
      audioLive: "Le guide audio est actif",
      startSession: "Demarrer le guide Amara",
      pauseSession: "Pause",
      resumeSession: "Reprendre",
      replayCue: "Rejouer l'etape",
      sessionReady: "Pret pour la seance guidee",
      sessionPaused: "Seance en pause",
      sessionComplete: "Seance prete a enregistrer",
      timeRemaining: (time) => `${time} restantes`,
      previousStep: "Retour",
      nextStep: "Suivant",
      nextHint: "Touchez Suivant quand vous etes pret.",
      finishHint: "Enregistrez la seance quand cette etape est terminee.",
      finish: "Terminer et noter 10 min",
      saving: "Enregistrement...",
      error: "Impossible d'enregistrer. Reessayez.",
      notFoundTitle: "Exercice introuvable",
      notFoundBody: "Choisissez une autre activite douce dans la salle de mouvement.",
    };
  }

  if (language === "it") {
    return {
      backToRoom: "Torna alla stanza movimento",
      guideLabel: "Esercizio guidato",
      tenMinutes: "10 min",
      stepLabel: (current, total) => `Passo ${current} di ${total}`,
      progressLabel: (current, total) => `${current}/${total} passi`,
      currentStepTitle: "Indicazione attuale di Amara",
      stepListTitle: "Passi della sessione",
      stepListBody: "Tocca un passo per tornare indietro o andare avanti con calma.",
      completedStep: "Fatto",
      currentStep: "Ora",
      nextStepStatus: "Avanti",
      audioTitle: "Guida audio dal vivo",
      audioBody: "Vyva puo guidare l'esercizio lentamente, un passo alla volta.",
      audioSync: "L'audio segue il passo mostrato sullo schermo.",
      audioUnavailable: "La guida visiva funziona anche senza audio.",
      startAudio: "Avvia guida audio",
      stopAudio: "Ferma guida audio",
      audioStarting: "Avvio...",
      audioLive: "La guida audio e attiva",
      startSession: "Avvia guida Amara",
      pauseSession: "Pausa",
      resumeSession: "Riprendi",
      replayCue: "Ripeti passo",
      sessionReady: "Pronto per la sessione guidata",
      sessionPaused: "Sessione in pausa",
      sessionComplete: "Sessione pronta da registrare",
      timeRemaining: (time) => `${time} rimasti`,
      previousStep: "Indietro",
      nextStep: "Avanti",
      nextHint: "Tocca Avanti quando sei pronto.",
      finishHint: "Registra la sessione quando questo passo e completato.",
      finish: "Termina e registra 10 min",
      saving: "Salvataggio...",
      error: "Impossibile salvare. Riprova.",
      notFoundTitle: "Esercizio non trovato",
      notFoundBody: "Scegli un'altra attivita dolce nella stanza movimento.",
    };
  }

  if (language === "pt") {
    return {
      backToRoom: "Voltar a sala de movimento",
      guideLabel: "Exercicio guiado",
      tenMinutes: "10 min",
      stepLabel: (current, total) => `Passo ${current} de ${total}`,
      progressLabel: (current, total) => `${current}/${total} passos`,
      currentStepTitle: "Indicacao atual da Amara",
      stepListTitle: "Passos da sessao",
      stepListBody: "Toque num passo para voltar ou avancar devagar.",
      completedStep: "Feito",
      currentStep: "Agora",
      nextStepStatus: "Seguinte",
      audioTitle: "Guia audio ao vivo",
      audioBody: "Vyva pode orientar este exercicio devagar, um passo de cada vez.",
      audioSync: "O audio acompanha o passo mostrado no ecra.",
      audioUnavailable: "O guia visual tambem funciona sem audio.",
      startAudio: "Iniciar guia audio",
      stopAudio: "Parar guia audio",
      audioStarting: "A iniciar...",
      audioLive: "O guia audio esta ativo",
      startSession: "Iniciar guia Amara",
      pauseSession: "Pausa",
      resumeSession: "Continuar",
      replayCue: "Repetir passo",
      sessionReady: "Pronto para a sessao guiada",
      sessionPaused: "Sessao em pausa",
      sessionComplete: "Sessao pronta para registar",
      timeRemaining: (time) => `${time} restantes`,
      previousStep: "Voltar",
      nextStep: "Seguinte",
      nextHint: "Toque em Seguinte quando estiver pronto.",
      finishHint: "Registe a sessao quando este passo estiver concluido.",
      finish: "Terminar e registar 10 min",
      saving: "A guardar...",
      error: "Nao foi possivel guardar. Tente novamente.",
      notFoundTitle: "Exercicio nao encontrado",
      notFoundBody: "Escolha outra atividade suave na sala de movimento.",
    };
  }

  if (language === "es") {
    return {
      backToRoom: "Volver a la sala de Movimiento",
      guideLabel: "Ejercicio guiado",
      tenMinutes: "10 min",
      stepLabel: (current, total) => `Paso ${current} de ${total}`,
      progressLabel: (current, total) => `${current}/${total} pasos`,
      currentStepTitle: "Indicacion actual de Amara",
      stepListTitle: "Pasos de la sesion",
      stepListBody: "Toca un paso para volver o avanzar con calma.",
      completedStep: "Hecho",
      currentStep: "Ahora",
      nextStepStatus: "Siguiente",
      audioTitle: "Guia de audio en vivo",
      audioBody: "Vyva puede guiar este ejercicio despacio, paso a paso.",
      audioSync: "El audio sigue el paso que ves en pantalla.",
      audioUnavailable: "La guia visual tambien funciona sin audio.",
      startAudio: "Iniciar guia de audio",
      stopAudio: "Parar guia de audio",
      audioStarting: "Iniciando...",
      audioLive: "La guia de audio esta activa",
      startSession: "Iniciar guia Amara",
      pauseSession: "Pausa",
      resumeSession: "Continuar",
      replayCue: "Repetir paso",
      sessionReady: "Listo para la sesion guiada",
      sessionPaused: "Sesion en pausa",
      sessionComplete: "Sesion lista para registrar",
      timeRemaining: (time) => `${time} restantes`,
      previousStep: "Atras",
      nextStep: "Siguiente",
      nextHint: "Toca Siguiente cuando estes listo.",
      finishHint: "Registra la sesion cuando este paso este completo.",
      finish: "Terminar y registrar 10 min",
      saving: "Guardando...",
      error: "No se pudo guardar. Intentalo de nuevo.",
      notFoundTitle: "Ejercicio no encontrado",
      notFoundBody: "Elige otra actividad suave en la sala de Movimiento.",
    };
  }

  return {
    backToRoom: "Back to Movement room",
    guideLabel: "Guided exercise",
    tenMinutes: "10 min",
    stepLabel: (current, total) => `Step ${current} of ${total}`,
    progressLabel: (current, total) => `${current}/${total} steps`,
    currentStepTitle: "Amara's current cue",
    stepListTitle: "Session steps",
    stepListBody: "Tap a step if you want to go back or move ahead gently.",
    completedStep: "Done",
    currentStep: "Now",
    nextStepStatus: "Next",
    audioTitle: "Live audio guide",
    audioBody: "Vyva can guide this exercise slowly, one step at a time.",
    audioSync: "Audio follows the step you see on screen.",
    audioUnavailable: "The visual guide still works without audio.",
    startAudio: "Start audio guide",
    stopAudio: "Stop audio guide",
    audioStarting: "Starting...",
    audioLive: "Audio guide is live",
    startSession: "Start Amara guide",
    pauseSession: "Pause",
    resumeSession: "Resume",
    replayCue: "Replay step",
    sessionReady: "Ready for the guided session",
    sessionPaused: "Session paused",
    sessionComplete: "Session ready to log",
    timeRemaining: (time) => `${time} left`,
    previousStep: "Back",
    nextStep: "Next",
    nextHint: "Tap Next when you feel ready.",
    finishHint: "Log the session when this step feels complete.",
    finish: "Finish and log 10 min",
    saving: "Saving...",
    error: "Could not save. Try again.",
    notFoundTitle: "Exercise not found",
    notFoundBody: "Choose another gentle activity from the Movement room.",
  };
}

function buildVoicePrompt(
  title: string,
  step: string,
  motion: MovementStepMotion,
  sceneLabel: string,
  stepIndex: number,
  totalSteps: number,
  safety: string,
  readyHint: string,
) {
  return [
    `Guide the user through ${title}.`,
    `Current step ${stepIndex + 1} of ${totalSteps}: ${step}`,
    `The screen shows this photo storyboard scene: ${sceneLabel}.`,
    `Motion cue metadata: ${motion}.`,
    `Do not move to a different step until the app sends new context.`,
    `Speak warmly, slowly, and plainly.`,
    `Keep it short, then pause so the user can move.`,
    `End with this cue: ${readyHint}`,
    `Safety reminder: ${safety}`,
  ].join(" ");
}

function stepStatusFor(index: number, stepIndex: number, copy: GuideCopy) {
  if (index < stepIndex) return copy.completedStep;
  if (index === stepIndex) return copy.currentStep;
  return copy.nextStepStatus;
}

export default function MovementExerciseGuideScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const movementLanguage = getMovementExerciseLanguage(language);
  const guideCopy = useMemo(() => getMovementGuideCopy(movementLanguage), [movementLanguage]);
  const sessionCopy = useMemo(() => getMovementSessionUiCopy(movementLanguage), [movementLanguage]);
  const [stepIndex, setStepIndex] = useState(0);
  const [logStatus, setLogStatus] = useState<"idle" | "saving" | "error">("idle");
  const [isAudioStarting, setAudioStarting] = useState(false);
  const {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    status: voiceStatus,
    isConnecting,
    lastError: voiceError,
  } = useVyvaVoice();

  const exercise = useMemo(() => {
    if (!isMovementExerciseCardId(exerciseId)) return null;
    return getMovementExerciseCards(movementLanguage).find((card) => card.id === exerciseId) ?? null;
  }, [exerciseId, movementLanguage]);
  const session = exercise ? MOVEMENT_EXERCISE_SESSIONS[exercise.id] : null;
  const visual = exercise ? MOVEMENT_EXERCISE_VISUALS[exercise.id] : null;
  const steps = session?.steps[movementLanguage] ?? [];
  const currentStep = steps[stepIndex] ?? steps[0] ?? "";
  const totalSteps = Math.max(steps.length, 1);
  const isLastStep = stepIndex >= steps.length - 1;
  const progressPercent = Math.max(0, Math.min(100, ((stepIndex + 1) / totalSteps) * 100));
  const isAudioLive = voiceStatus === "connected";
  const motionForStep = useCallback((nextStepIndex: number): MovementStepMotion => (
    session?.visuals[nextStepIndex] ?? DEFAULT_MOVEMENT_STEP_MOTION
  ), [session]);
  const sceneForStep = useCallback((nextStepIndex: number) => (
    session?.sceneLabels[nextStepIndex] ?? steps[nextStepIndex] ?? ""
  ), [session, steps]);
  const currentStepMotion = motionForStep(stepIndex);
  const currentSceneLabel = sceneForStep(stepIndex);
  const currentStepImage = exercise && visual ? getMovementStepImage(exercise.id, stepIndex, currentStepMotion) ?? visual.image : "";

  const voiceVariables = useCallback((nextStepIndex: number) => {
    const nextMotion = motionForStep(nextStepIndex);
    return {
      app_entrypoint: "movement_exercise_guide",
      exercise_id: exercise?.id ?? "",
      exercise_title: exercise?.title ?? "",
      exercise_benefit: exercise?.benefit ?? "",
      current_step: steps[nextStepIndex] ?? "",
      current_step_number: nextStepIndex + 1,
      step_count: steps.length,
      exercise_steps: steps.join(" | "),
      safety_line: sessionCopy.safety,
      visual_step_label: guideCopy.stepLabel(nextStepIndex + 1, steps.length),
      visual_step_text: steps[nextStepIndex] ?? "",
      visual_motion: nextMotion,
      visual_scene: sceneForStep(nextStepIndex),
      next_visual_action: nextStepIndex >= steps.length - 1 ? guideCopy.finish : guideCopy.nextStep,
      app_user_instruction: nextStepIndex >= steps.length - 1 ? guideCopy.finishHint : guideCopy.nextHint,
    };
  }, [exercise?.benefit, exercise?.id, exercise?.title, guideCopy, motionForStep, sceneForStep, sessionCopy.safety, steps]);

  const promptForStep = useCallback(
    (nextStepIndex: number) => buildVoicePrompt(
      exercise?.title ?? "this gentle exercise",
      steps[nextStepIndex] ?? "",
      motionForStep(nextStepIndex),
      sceneForStep(nextStepIndex),
      nextStepIndex,
      steps.length,
      sessionCopy.safety,
      nextStepIndex >= steps.length - 1 ? guideCopy.finishHint : guideCopy.nextHint,
    ),
    [exercise?.title, guideCopy.finishHint, guideCopy.nextHint, motionForStep, sceneForStep, sessionCopy.safety, steps],
  );

  const sendStepPrompt = useCallback((nextStepIndex: number) => {
    sendContextUpdate(`Movement exercise guide context: ${JSON.stringify(voiceVariables(nextStepIndex))}`);
    sendText(promptForStep(nextStepIndex), { invisibleInTranscript: true });
  }, [promptForStep, sendContextUpdate, sendText, voiceVariables]);

  useEffect(() => {
    try {
      if (navigator.userAgent.toLowerCase().includes("jsdom")) return () => stopVoice();
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch {
      // Test environments do not always implement scrollTo.
    }
    return () => stopVoice();
  }, [stopVoice]);

  useEffect(() => {
    setStepIndex(0);
    setLogStatus("idle");
  }, [exerciseId]);

  const goBackToRoom = useCallback(() => {
    stopVoice();
    navigate(MOVEMENT_ROOM_PATH);
  }, [navigate, stopVoice]);

  const goToStep = useCallback((nextStepIndex: number) => {
    if (!steps.length) return;
    const boundedStepIndex = Math.max(0, Math.min(nextStepIndex, steps.length - 1));
    setStepIndex(boundedStepIndex);
    if (voiceStatus === "connected") {
      sendStepPrompt(boundedStepIndex);
    }
  }, [sendStepPrompt, steps.length, voiceStatus]);

  const startAmaraGuide = useCallback(async () => {
    if (!exercise || !session) return;
    setAudioStarting(true);
    try {
      await startVoice(promptForStep(stepIndex), undefined, {
        agentSlug: "amara-osei",
        roomSlug: "morning-movement",
        autoStartListening: false,
        dynamicVariables: voiceVariables(stepIndex),
      });
      sendStepPrompt(stepIndex);
    } catch {
      // The visual guide keeps running if live audio is not available.
    } finally {
      setAudioStarting(false);
    }
  }, [exercise, promptForStep, sendStepPrompt, session, startVoice, stepIndex, voiceVariables]);

  const replayStep = useCallback(() => {
    if (voiceStatus === "connected") {
      sendStepPrompt(stepIndex);
    }
  }, [sendStepPrompt, stepIndex, voiceStatus]);

  const finishAndLog = useCallback(async () => {
    if (!exercise || !session || logStatus === "saving") return;
    setLogStatus("saving");
    try {
      const response = await apiFetch("/api/activity/log", {
        method: "POST",
        body: JSON.stringify({
          activity_type: session.logType,
          duration_minutes: 10,
        }),
      });
      if (!response.ok) throw new Error("Failed to log movement exercise");
      saveLastMovementExerciseId(exercise.id);
      saveMovementWeekLogDates(addMovementWeekLogDate(loadMovementWeekLogDates()));
      stopVoice();
      navigate(MOVEMENT_ROOM_PATH, { state: { movementExerciseLoggedId: exercise.id } });
    } catch {
      setLogStatus("error");
    }
  }, [exercise, logStatus, navigate, session, stopVoice]);

  if (!exercise || !session || !visual || !isMovementExerciseCardId(exerciseId)) {
    return (
      <section
        className="mx-auto flex min-h-[72vh] w-full max-w-[760px] flex-col justify-center px-5 py-6"
        data-testid="movement-exercise-guide-invalid"
      >
        <button
          type="button"
          onClick={goBackToRoom}
          className="mb-5 inline-flex min-h-[48px] w-fit items-center gap-2 rounded-full border border-[#CFEAF2] bg-white px-4 font-body text-[15px] font-black text-[#0369A1]"
          data-testid="button-movement-guide-back-room"
        >
          <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
          {guideCopy.backToRoom}
        </button>
        <div className="rounded-[26px] border border-[#D7EEF5] bg-white p-6 text-center shadow-[0_14px_32px_rgba(2,132,199,0.08)]">
          <p className="font-display text-[34px] leading-[1.05] text-[#123047]">{guideCopy.notFoundTitle}</p>
          <p className="mt-3 font-body text-[17px] font-semibold leading-snug text-[#66717B]">{guideCopy.notFoundBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-[980px] px-4 py-4 pb-28 sm:px-6"
      data-testid="movement-exercise-guide"
    >
      <button
        type="button"
        onClick={goBackToRoom}
        className="mb-3 inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#CFEAF2] bg-white px-4 font-body text-[15px] font-black text-[#0369A1] shadow-[0_8px_18px_rgba(2,132,199,0.06)]"
        data-testid="button-movement-guide-back-room"
      >
        <ArrowLeft size={19} strokeWidth={2.6} aria-hidden="true" />
        {guideCopy.backToRoom}
      </button>

      <div className="rounded-[24px] border bg-white p-3 shadow-[0_12px_28px_rgba(18,48,71,0.08)] sm:p-4" style={{ borderColor: visual.border }}>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="grid min-w-0 grid-cols-[76px_minmax(0,1fr)] items-center gap-3">
            <img
              src={visual.image}
              alt=""
              className="h-[76px] w-[76px] rounded-[18px] object-cover"
              data-testid="movement-exercise-guide-image"
              draggable={false}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex rounded-full px-3 py-1.5 font-body text-[12px] font-black uppercase leading-tight"
                  style={{ background: visual.softBg, color: visual.accent }}
                >
                  {guideCopy.guideLabel}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[13px] font-black leading-tight"
                  style={{ background: visual.softBg, color: visual.accent }}
                >
                  <Clock size={15} strokeWidth={2.5} aria-hidden="true" />
                  {guideCopy.tenMinutes}
                </span>
                <span
                  className="inline-flex rounded-full bg-white px-3 py-1.5 font-body text-[13px] font-black leading-tight shadow-[0_6px_16px_rgba(18,48,71,0.08)]"
                  style={{ color: visual.accent }}
                >
                  {guideCopy.progressLabel(stepIndex + 1, totalSteps)}
                </span>
              </div>
              <h1 className="mt-2 font-display text-[27px] leading-[1.04] text-[#123047] sm:text-[40px]">
                {exercise.title}
              </h1>
              <p className="mt-1 font-body text-[14px] font-bold leading-snug text-[#66717B] sm:text-[16px]">
                {exercise.benefit}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:min-w-[230px]">
            <div aria-label={guideCopy.stepLabel(stepIndex + 1, totalSteps)} role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepIndex + 1}>
              <div className="h-2.5 overflow-hidden rounded-full bg-[#E8F3F7]">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${progressPercent}%`, background: visual.accent }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={startAmaraGuide}
              disabled={isAudioStarting || isConnecting || isAudioLive}
              className="inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[16px] font-black text-white shadow-[0_10px_20px_rgba(18,48,71,0.12)] disabled:opacity-75"
              style={{ background: visual.accent }}
              data-testid="button-movement-guide-start-audio"
            >
              {isAudioStarting || isConnecting ? (
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              ) : (
                <Play size={20} strokeWidth={2.6} aria-hidden="true" />
              )}
              {isAudioStarting || isConnecting ? guideCopy.audioStarting : isAudioLive ? guideCopy.audioLive : guideCopy.startSession}
            </button>
            <button
              type="button"
              onClick={replayStep}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[16px] border border-[#CFEAF2] bg-white px-4 font-body text-[15px] font-black text-[#0369A1]"
              data-testid="button-movement-guide-replay-step"
            >
              <RotateCcw size={18} strokeWidth={2.5} aria-hidden="true" />
              {guideCopy.replayCue}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[24px] border border-[#D7EEF5] bg-white p-4 shadow-[0_12px_26px_rgba(2,132,199,0.06)] sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-body text-[13px] font-black uppercase tracking-[0.08em] text-[#0369A1]">
                {guideCopy.stepLabel(stepIndex + 1, totalSteps)}
              </p>
              <h2 className="mt-1 font-body text-[22px] font-black leading-tight text-[#123047]">{guideCopy.currentStepTitle}</h2>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {steps.map((step, index) => (
                <span
                  key={step}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: index === stepIndex ? visual.accent : visual.border }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <MovementStepAnimation
              motion={currentStepMotion}
              image={currentStepImage}
              imageAlt={`${exercise.title}: ${currentSceneLabel}`}
              accent={visual.accent}
              softBg={visual.softBg}
              border={visual.border}
              stepLabel={guideCopy.stepLabel(stepIndex + 1, totalSteps)}
              instruction={currentStep}
            />
          </div>
          <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-3">
            <button
              type="button"
              onClick={() => goToStep(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border border-[#CFEAF2] bg-white px-4 font-body text-[16px] font-black text-[#0369A1] disabled:opacity-45 sm:min-h-[58px] sm:text-[17px]"
              data-testid="button-movement-guide-back-step"
            >
              <ArrowLeft size={20} strokeWidth={2.6} aria-hidden="true" />
              {guideCopy.previousStep}
            </button>
            {isLastStep ? (
              <button
                type="button"
                onClick={finishAndLog}
                disabled={logStatus === "saving"}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[16px] font-black text-white shadow-[0_12px_24px_rgba(2,132,199,0.14)] disabled:opacity-70 sm:min-h-[58px] sm:text-[17px]"
                style={{ background: visual.accent }}
                data-testid="button-movement-guide-finish"
              >
                {logStatus === "saving" ? (
                  <Loader2 size={22} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Check size={22} strokeWidth={2.7} aria-hidden="true" />
                )}
                {logStatus === "saving" ? guideCopy.saving : guideCopy.finish}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToStep(stepIndex + 1)}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] px-4 font-body text-[16px] font-black text-white sm:min-h-[58px] sm:text-[17px]"
                style={{ background: visual.accent }}
                data-testid="button-movement-guide-next"
              >
                {guideCopy.nextStep}
                <ArrowRight size={20} strokeWidth={2.6} aria-hidden="true" />
              </button>
            )}
          </div>
          <div
            className="mt-4 flex items-start gap-2 rounded-[18px] border px-3 py-3 font-body text-[15px] font-bold leading-snug"
            style={{ background: "#FFF7ED", borderColor: "#FED7AA", color: "#7C2D12" }}
            data-testid="movement-exercise-guide-safety"
          >
            <ShieldCheck size={20} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
            {sessionCopy.safety}
          </div>
          {logStatus === "error" ? (
            <p
              className="mt-3 rounded-[16px] border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 font-body text-[14px] font-bold leading-snug text-[#BE185D]"
              data-testid="movement-exercise-guide-log-error"
            >
              {guideCopy.error}
            </p>
          ) : null}
        </section>

        <aside className="grid gap-4">
          <section className="rounded-[24px] border border-[#D7EEF5] bg-white p-4 shadow-[0_12px_26px_rgba(2,132,199,0.06)]" data-testid="movement-exercise-guide-step-list">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: visual.softBg, color: visual.accent }}>
                <CheckCircle2 size={21} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-body text-[19px] font-black leading-tight text-[#123047]">{guideCopy.stepListTitle}</h2>
                <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-[#66717B]">{guideCopy.stepListBody}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              {steps.map((step, index) => {
                const isCurrent = index === stepIndex;
                const isComplete = index < stepIndex;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => goToStep(index)}
                    aria-current={isCurrent ? "step" : undefined}
                    className="grid min-h-[72px] grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-[18px] border px-3 py-2 text-left transition"
                    style={{
                      background: isCurrent ? visual.softBg : "#FFFFFF",
                      borderColor: isCurrent ? visual.border : "#D7EEF5",
                    }}
                    data-testid={`button-movement-guide-step-${index + 1}`}
                  >
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full font-body text-[15px] font-black shadow-[0_5px_12px_rgba(18,48,71,0.08)]"
                      style={{
                        background: isCurrent || isComplete ? visual.accent : "#EFF7FA",
                        color: isCurrent || isComplete ? "#FFFFFF" : "#66717B",
                      }}
                    >
                      {isComplete ? <Check size={18} strokeWidth={2.8} aria-hidden="true" /> : index + 1}
                    </span>
                    <span>
                      <span className="block font-body text-[12px] font-black uppercase tracking-[0.08em]" style={{ color: isCurrent ? visual.accent : "#66717B" }}>
                        {stepStatusFor(index, stepIndex, guideCopy)}
                      </span>
                      <span className="mt-0.5 line-clamp-2 block font-body text-[15px] font-black leading-snug text-[#123047]">
                        {step}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-[24px] border border-[#D7EEF5] bg-[#FBFEFF] p-4 shadow-[0_12px_26px_rgba(2,132,199,0.06)]" data-testid="movement-exercise-guide-audio-panel">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: visual.softBg, color: visual.accent }}>
                <Headphones size={21} strokeWidth={2.6} aria-hidden="true" />
              </span>
              <div>
                <p className="font-body text-[19px] font-black leading-tight text-[#123047]">{guideCopy.audioTitle}</p>
                <p className="mt-1 font-body text-[14px] font-semibold leading-snug text-[#66717B]">{guideCopy.audioBody}</p>
              </div>
            </div>
            <p className="mt-3 rounded-[16px] px-3 py-2 font-body text-[13px] font-black leading-snug" style={{ background: visual.softBg, color: visual.accent }}>
              {isAudioLive ? guideCopy.audioLive : guideCopy.audioSync}
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {voiceError ? (
                <p className="rounded-[14px] bg-[#FFF1F2] px-3 py-2 font-body text-[13px] font-bold text-[#BE185D]">
                  {voiceError} {guideCopy.audioUnavailable}
                </p>
              ) : (
                <p className="rounded-[14px] bg-white px-3 py-2 font-body text-[13px] font-semibold leading-snug text-[#66717B]">
                  {guideCopy.audioUnavailable}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>

    </section>
  );
}
