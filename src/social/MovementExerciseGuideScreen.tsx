import { ArrowLeft, Loader2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/i18n";
import { apiFetch } from "@/lib/queryClient";
import { useVyvaVoice } from "@/hooks/useVyvaVoice";
import { recordAgentContextUpdate } from "@/lib/agentAppContext";
import {
  routineIdFromWellnessToolParameters,
  subscribeWellnessVoiceTools,
  type WellnessVoiceToolName,
  type WellnessVoiceToolResult,
} from "@/lib/wellnessVoiceBridge";
import MovementStepAnimation from "./MovementStepAnimation";
import {
  MOVEMENT_EXERCISE_SESSIONS,
  MOVEMENT_EXERCISE_VISUALS,
  addMovementWeekLogDate,
  getMovementExerciseCards,
  getMovementExerciseLanguage,
  getMovementSessionUiCopy,
  getMovementStepImage,
  getMovementStepVideo,
  isMovementExerciseCardId,
  loadMovementWeekLogDates,
  saveLastMovementExerciseId,
  saveMovementWeekLogDates,
  type MovementExerciseLanguage,
  type MovementStepMotion,
} from "./movementExercises";

const MOVEMENT_ROOM_PATH = "/social-rooms/morning-movement";
const DEFAULT_MOVEMENT_STEP_MOTION: MovementStepMotion = "seated-tall";
const EMPTY_MOVEMENT_STEPS: string[] = [];
const MOVEMENT_GUIDE_TOTAL_DURATION_MS = 10 * 60 * 1000;
const MOVEMENT_GUIDE_TICK_MS = 1000;
const MOVEMENT_STEP_INSTRUCTION_INTRO_MS = 10_000;

type GuideRunState = "starting" | "guiding" | "paused" | "blocked" | "saving";

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
      currentStepTitle: "Aktueller Hinweis von VYVA",
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
      startSession: "VYVA-Guide starten",
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
      currentStepTitle: "Consigne actuelle de VYVA",
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
      startSession: "Demarrer le guide VYVA",
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
      currentStepTitle: "Indicazione attuale di VYVA",
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
      startSession: "Avvia guida VYVA",
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
      currentStepTitle: "Indicacao atual da VYVA",
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
      startSession: "Iniciar guia VYVA",
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
      currentStepTitle: "Indicacion actual de VYVA",
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
      startSession: "Iniciar guia VYVA",
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
    currentStepTitle: "VYVA's current cue",
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
    startSession: "Start VYVA guide",
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

function formatGuideTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function MovementExerciseGuideScreen() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const movementLanguage = getMovementExerciseLanguage(language);
  const guideCopy = useMemo(() => getMovementGuideCopy(movementLanguage), [movementLanguage]);
  const sessionCopy = useMemo(() => getMovementSessionUiCopy(movementLanguage), [movementLanguage]);
  const [stepIndex, setStepIndex] = useState(0);
  const [logStatus, setLogStatus] = useState<"idle" | "saving" | "error">("idle");
  const [runState, setRunState] = useState<GuideRunState>("starting");
  const [autoStartAttempted, setAutoStartAttempted] = useState(false);
  const [isAudioStarting, setAudioStarting] = useState(false);
  const [elapsedInStepMs, setElapsedInStepMs] = useState(0);
  const {
    startVoice,
    stopVoice,
    sendText,
    sendContextUpdate,
    isConnecting,
    lastError: voiceError,
  } = useVyvaVoice();

  const exercise = useMemo(() => {
    if (!isMovementExerciseCardId(exerciseId)) return null;
    return getMovementExerciseCards(movementLanguage).find((card) => card.id === exerciseId) ?? null;
  }, [exerciseId, movementLanguage]);
  const session = exercise ? MOVEMENT_EXERCISE_SESSIONS[exercise.id] : null;
  const visual = exercise ? MOVEMENT_EXERCISE_VISUALS[exercise.id] : null;
  const steps = useMemo(
    () => session?.steps[movementLanguage] ?? EMPTY_MOVEMENT_STEPS,
    [movementLanguage, session],
  );
  const currentStep = steps[stepIndex] ?? steps[0] ?? "";
  const totalSteps = Math.max(steps.length, 1);
  const isLastStep = stepIndex >= steps.length - 1;
  const progressPercent = Math.max(0, Math.min(100, ((stepIndex + 1) / totalSteps) * 100));
  const stepDurationMs = Math.max(15_000, Math.round(MOVEMENT_GUIDE_TOTAL_DURATION_MS / totalSteps));
  const stepElapsedPercent = Math.max(0, Math.min(100, (elapsedInStepMs / stepDurationMs) * 100));
  const stepRemainingMs = Math.max(0, stepDurationMs - elapsedInStepMs);
  const stepRemainingText = formatGuideTime(stepRemainingMs);
  const showStepInstructionIntro = elapsedInStepMs < MOVEMENT_STEP_INSTRUCTION_INTRO_MS;
  const isVisualGuideRunning = runState === "guiding" || runState === "blocked";
  const isVisualGuidePresent = isVisualGuideRunning || runState === "starting";
  const motionForStep = useCallback((nextStepIndex: number): MovementStepMotion => (
    session?.visuals[nextStepIndex] ?? DEFAULT_MOVEMENT_STEP_MOTION
  ), [session]);
  const sceneForStep = useCallback((nextStepIndex: number) => (
    session?.sceneLabels[nextStepIndex] ?? steps[nextStepIndex] ?? ""
  ), [session, steps]);
  const currentStepMotion = motionForStep(stepIndex);
  const currentSceneLabel = sceneForStep(stepIndex);
  const currentStepImage = exercise && visual ? getMovementStepImage(exercise.id, stepIndex, currentStepMotion) ?? visual.image : "";
  const currentStepVideo = exercise ? getMovementStepVideo(exercise.id, stepIndex, currentStepMotion) : undefined;
  const routeState = location.state as { autoStartVoiceGuide?: unknown } | null;
  const hasAutoStartIntent = routeState?.autoStartVoiceGuide === true;
  const browserHasUserActivation = (() => {
    if (typeof navigator === "undefined") return true;
    const userActivation = (navigator as Navigator & { userActivation?: { hasBeenActive?: boolean } }).userActivation;
    if (!userActivation) return true;
    return userActivation.hasBeenActive ?? hasAutoStartIntent;
  })();

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
    setElapsedInStepMs(0);
    setLogStatus("idle");
    setRunState("starting");
    setAutoStartAttempted(false);
  }, [exerciseId]);

  const goBackToRoom = useCallback(() => {
    stopVoice();
    navigate(MOVEMENT_ROOM_PATH);
  }, [navigate, stopVoice]);

  const startVyvaGuide = useCallback(async (nextStepIndex = stepIndex) => {
    if (!exercise || !session) return;
    setAudioStarting(true);
    setRunState("starting");
    try {
      await startVoice(promptForStep(nextStepIndex), undefined, {
        agentSlug: "wellness",
        roomSlug: "morning-movement",
        autoStartListening: true,
        dynamicVariables: voiceVariables(nextStepIndex),
      });
      sendStepPrompt(nextStepIndex);
      setRunState("guiding");
    } catch {
      setRunState("blocked");
    } finally {
      setAudioStarting(false);
    }
  }, [exercise, promptForStep, sendStepPrompt, session, startVoice, stepIndex, voiceVariables]);

  useEffect(() => {
    if (!exercise || !session || autoStartAttempted) return;
    setAutoStartAttempted(true);
    if (!hasAutoStartIntent && !browserHasUserActivation) {
      setRunState("blocked");
      return;
    }
    void startVyvaGuide(0);
  }, [autoStartAttempted, browserHasUserActivation, exercise, hasAutoStartIntent, session, startVyvaGuide]);

  const pauseGuide = useCallback(() => {
    setRunState("paused");
    stopVoice();
  }, [stopVoice]);

  const resumeGuide = useCallback(() => {
    void startVyvaGuide(stepIndex);
  }, [startVyvaGuide, stepIndex]);

  const handleWellnessVoiceTool = useCallback((name: WellnessVoiceToolName, parameters: Record<string, unknown>): WellnessVoiceToolResult => {
    if (!exercise) return { ok: false, code: "wellness_routine_unavailable", activity: "wellness_routine" };

    if (name === "pause_wellness_routine") {
      stopVoice();
      setRunState("paused");
      recordAgentContextUpdate({
        summary: `Wellness routine paused by voice: ${exercise.title} (${exercise.id}).`,
        path: `/social-rooms/morning-movement/exercises/${exercise.id}`,
      });
      return {
        ok: true,
        code: "routine_paused",
        activity: "wellness_routine",
        routine_id: exercise.id,
        routine_title: exercise.title,
        session_state: "paused",
      };
    }

    if (name === "resume_wellness_routine") {
      void startVyvaGuide(stepIndex);
      return {
        ok: true,
        code: "routine_resuming",
        activity: "wellness_routine",
        routine_id: exercise.id,
        routine_title: exercise.title,
        session_state: "running",
      };
    }

    if (name === "stop_wellness_routine") {
      stopVoice();
      navigate("/social-rooms/experts/amara");
      return {
        ok: true,
        code: "routine_stopped",
        activity: "wellness_routine",
        routine_id: exercise.id,
        routine_title: exercise.title,
        session_state: "stopped",
      };
    }

    let routineId = routineIdFromWellnessToolParameters(parameters, language);
    const adaptation = typeof parameters.adaptation === "string" ? parameters.adaptation.trim().toLowerCase() : "";
    if (!routineId && name === "adapt_wellness_routine") {
      if (adaptation.includes("calm") || adaptation.includes("breath")) routineId = "calm-breathing";
      else if (adaptation.includes("seated") || adaptation.includes("easy") || adaptation.includes("easier")) routineId = "chair-yoga";
    }

    if (!routineId) {
      return {
        ok: false,
        code: "routine_not_recognized",
        activity: "wellness_routine",
        routine_id: exercise.id,
        routine_title: exercise.title,
        session_state: "running",
      };
    }

    const target = getMovementExerciseCards(movementLanguage).find((card) => card.id === routineId);
    stopVoice();
    setRunState("starting");
    recordAgentContextUpdate({
      summary: `Wellness routine changed by voice: ${target?.title ?? routineId} (${routineId}).`,
      path: `/social-rooms/morning-movement/exercises/${routineId}`,
    });
    navigate(`/social-rooms/morning-movement/exercises/${routineId}`, { state: { autoStartVoiceGuide: true } });
    return {
      ok: true,
      code: name === "adapt_wellness_routine" ? "routine_adapted" : "routine_started",
      activity: "wellness_routine",
      routine_id: routineId,
      routine_title: target?.title ?? routineId,
      session_state: "routine_opening",
      ...(adaptation ? { adaptation } : {}),
    };
  }, [exercise, language, movementLanguage, navigate, startVyvaGuide, stepIndex, stopVoice]);

  useEffect(() => subscribeWellnessVoiceTools(handleWellnessVoiceTool), [handleWellnessVoiceTool]);

  const finishAndLog = useCallback(async () => {
    if (!exercise || !session || logStatus === "saving") return;
    setLogStatus("saving");
    setRunState("saving");
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
      setRunState("paused");
    }
  }, [exercise, logStatus, navigate, session, stopVoice]);

  useEffect(() => {
    if (!exercise || !session || !isVisualGuideRunning || logStatus === "saving") return undefined;
    const timer = window.setInterval(() => {
      setElapsedInStepMs((currentElapsed) => {
        const nextElapsed = Math.min(stepDurationMs, currentElapsed + MOVEMENT_GUIDE_TICK_MS);
        if (nextElapsed < stepDurationMs) return nextElapsed;

        if (stepIndex >= steps.length - 1) {
          void finishAndLog();
          return stepDurationMs;
        }

        const nextStepIndex = stepIndex + 1;
        setStepIndex(nextStepIndex);
        sendStepPrompt(nextStepIndex);
        return 0;
      });
    }, MOVEMENT_GUIDE_TICK_MS);
    return () => window.clearInterval(timer);
  }, [exercise, finishAndLog, isVisualGuideRunning, logStatus, sendStepPrompt, session, stepDurationMs, stepIndex, steps.length]);

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

  const statusText = logStatus === "saving" || runState === "saving"
    ? guideCopy.saving
    : runState === "blocked"
      ? guideCopy.audioUnavailable
      : runState === "paused"
        ? guideCopy.sessionPaused
        : isAudioStarting || isConnecting || runState === "starting"
          ? guideCopy.audioStarting
          : guideCopy.audioLive;

  return (
    <section
      className="mx-auto flex min-h-[calc(100svh-92px)] w-full max-w-[820px] flex-col px-4 pb-28 pt-4 sm:px-6"
      data-testid="movement-exercise-guide"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBackToRoom}
          className="vyva-tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#CFEAF2] bg-white text-[#0369A1] shadow-[0_8px_18px_rgba(2,132,199,0.06)]"
          data-testid="button-movement-guide-back-room"
          aria-label={guideCopy.backToRoom}
        >
          <ArrowLeft size={20} strokeWidth={2.7} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-body text-[22px] font-black leading-tight text-[#123047] sm:text-[28px]">
            {exercise.title}
          </h1>
          <p
            className="mt-0.5 font-body text-[13px] font-black leading-tight"
            style={{ color: visual.accent }}
            data-testid="movement-guide-status"
          >
            {statusText}
          </p>
        </div>
        {runState !== "saving" ? (
          <button
            type="button"
            onClick={runState === "paused" ? resumeGuide : pauseGuide}
            disabled={logStatus === "saving" || runState === "saving" || isAudioStarting}
            className="vyva-tap inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 font-body text-[14px] font-black text-white shadow-[0_10px_20px_rgba(18,48,71,0.12)] disabled:opacity-65"
            style={{ background: visual.accent }}
            data-testid="button-movement-guide-pause"
          >
            {runState === "paused" ? (
              <Play size={18} strokeWidth={2.7} aria-hidden="true" />
            ) : (
              <Pause size={18} strokeWidth={2.7} aria-hidden="true" />
            )}
            {runState === "paused" ? guideCopy.resumeSession : guideCopy.pauseSession}
          </button>
        ) : null}
      </div>

      <div
        aria-label={guideCopy.stepLabel(stepIndex + 1, totalSteps)}
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={totalSteps}
        aria-valuenow={stepIndex + 1}
        className="mt-4"
      >
        <div className="flex items-center justify-between gap-3 pb-2">
          <span className="font-body text-[13px] font-black text-[#55707D]">
            {guideCopy.stepLabel(stepIndex + 1, totalSteps)}
          </span>
          <span
            className="font-body text-[15px] font-black tabular-nums text-[#123047]"
            data-testid="movement-guide-countdown"
            aria-live="polite"
          >
            {guideCopy.timeRemaining(stepRemainingText)}
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-[#E8F3F7]">
          <div
            className="absolute inset-y-0 left-0 rounded-full opacity-25 transition-[width] duration-300"
            style={{ width: `${progressPercent}%`, background: visual.accent }}
            aria-hidden="true"
          />
          <div
            className="relative h-full rounded-full transition-[width] duration-300"
            style={{ width: `${stepElapsedPercent}%`, background: visual.accent }}
            data-testid="movement-guide-step-countdown-progress"
          />
        </div>
      </div>

      <main className="mt-5 flex flex-1 flex-col justify-center">
        {showStepInstructionIntro ? (
          <section
            className="grid min-h-[520px] place-items-center rounded-[28px] border border-white/20 bg-[radial-gradient(circle_at_50%_18%,#8B3DCE_0%,#6B21A8_56%,#581C87_100%)] px-7 py-10 text-center text-white shadow-[0_20px_44px_rgba(107,33,168,0.24)]"
            data-testid="movement-guide-step-intro"
            aria-live="polite"
          >
            <div className="mx-auto max-w-[680px]">
              <p className="font-body text-[18px] font-black uppercase tracking-[0.08em] text-white/75">
                {guideCopy.stepLabel(stepIndex + 1, totalSteps)}
              </p>
              <h2
                className="mt-8 font-body text-[40px] font-black leading-[1.05] tracking-normal sm:text-[56px]"
                data-testid="movement-exercise-guide-step"
              >
                {currentStep}
              </h2>
            </div>
          </section>
        ) : (
          <MovementStepAnimation
            motion={currentStepMotion}
            image={currentStepImage}
            imageAlt={`${exercise.title}: ${currentSceneLabel}`}
            video={currentStepVideo}
            accent={visual.accent}
            softBg={visual.softBg}
            border={visual.border}
            stepLabel={guideCopy.stepLabel(stepIndex + 1, totalSteps)}
            instruction={currentStep}
            isGuiding={isVisualGuidePresent}
          />
        )}

        {runState === "blocked" ? (
          <div className="mt-4 rounded-[22px] border border-[#FECDD3] bg-[#FFF1F2] p-4 text-center" data-testid="movement-guide-audio-fallback">
            <p className="font-body text-[15px] font-bold leading-snug text-[#BE185D]">
              {voiceError ? `${voiceError} ` : ""}{guideCopy.audioUnavailable}
            </p>
            <button
              type="button"
              onClick={resumeGuide}
              className="vyva-tap mt-3 inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full px-6 font-body text-[16px] font-black text-white"
              style={{ background: visual.accent }}
              data-testid="button-movement-guide-begin-fallback"
            >
              <Play size={20} strokeWidth={2.7} aria-hidden="true" />
              {guideCopy.startAudio}
            </button>
          </div>
        ) : null}

        {logStatus === "error" ? (
          <p
            className="mt-4 rounded-[18px] border border-[#FECDD3] bg-[#FFF1F2] px-4 py-3 text-center font-body text-[14px] font-bold leading-snug text-[#BE185D]"
            data-testid="movement-exercise-guide-log-error"
          >
            {guideCopy.error}
          </p>
        ) : null}
      </main>
    </section>
  );
}
