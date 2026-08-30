import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CircleHelp,
  Clock3,
  Grid2x2,
  Hash,
  Layers3,
  Link2,
  Mic,
  NotebookPen,
  RotateCcw,
  Route,
  Type,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/i18n";
import { useTtsReadout } from "@/hooks/useVyvaVoice";
import { BrainCoachFullscreenActivity, BrainCoachLoadingState } from "@/components/brain/BrainCoachFlowShell";
import VoiceActionFulfillmentPanel from "@/components/VoiceActionFulfillmentPanel";
import {
  cognitiveAssessmentPracticeStateFromRoute,
  completeCognitiveAssessmentPractice,
} from "@/lib/cognitiveAssessmentPracticeBridge";
import BrainGameCompletionDialog from "../shared/BrainGameCompletionDialog";
import {
  getBrainCoachProgressLabel,
  getBrainCoachSupportiveProgressCopy,
} from "../shared/brainCoachProgression";
import { saveGameResult } from "./gameStorage";
import {
  getGameDefinition,
  getGameDescription,
  getGameLevel,
  getGameTitle,
  getVariantContent,
  memoryGameRegistry,
} from "./memoryGameRegistry";
import {
  selectGamePlan,
  selectNextMemoryGame,
  selectNextVariantForSameGame,
} from "./progressionEngine";
import type { MemoryGameType, Recommendation } from "./types";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { isSequenceTileMatch } from "./sequenceScoring";
import StoryRecallGame from "./StoryRecallGame";

const FALLBACK_USER_ID = "vyva-local-user";
const MEMORY_AUDIO_STORAGE_KEY = "vyva_memory_audio_muted";
const SEQUENCE_TUTORIAL_KEY = "sequenceMemory:tutorialSeen:v1";

function getMemoryRunnerBrainSceneId(gameType: MemoryGameType | null | undefined) {
  if (gameType === "sequence_memory") {
    return "brain_coach.activity_session.train_reflexes.rhythm_tap";
  }

  return `brain_coach.activity_session.memory.${gameType ?? "unknown"}`;
}

function getMemoryRunnerBrainTestId(gameType: MemoryGameType | null | undefined) {
  return gameType === "sequence_memory" ? "rhythm-tap-flow-shell" : "memory-game-runner-flow-shell";
}

function sequenceTutorialStorageKey(userId: string) {
  return userId ? `${SEQUENCE_TUTORIAL_KEY}:${userId}` : SEQUENCE_TUTORIAL_KEY;
}

function readSequenceTutorialSeen(userId: string) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(sequenceTutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
}

function writeSequenceTutorialSeen(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(sequenceTutorialStorageKey(userId), "true");
  } catch {
    // Local tutorial persistence is helpful, but play should not depend on it.
  }
}

type MemoryCard = {
  deckId: string;
  pairId: string;
  label: string;
  emoji: string;
};

type SequenceTile = {
  id: string;
  emoji: string;
  color: string;
};

type CompletionMetrics = {
  score: number;
  accuracy: number;
  mistakes: number;
  durationSeconds: number;
};

type CompletionDetails = {
  rememberedWords?: string[];
  correctWords?: string[];
  missedWords?: string[];
  expectedAnswer?: string;
  givenAnswer?: string;
  cueLabel?: string;
};

type WordRecallDistractionType = "count_backwards" | "choose_blue" | "breathe_continue";
type MemoryCompanionMessageKind =
  | "start"
  | "keepGoing"
  | "match"
  | "mismatch"
  | "sequenceGood"
  | "sequenceWrong"
  | "recall"
  | "complete";

type MemoryCompanionCopy = {
  mute: string;
  unmute: string;
  onStatus: string;
  offStatus: string;
} & Record<MemoryCompanionMessageKind, string[]>;

function shuffleCards(cards: MemoryCard[]) {
  const copy = [...cards];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function getDurationSeconds(startedAt: number) {
  return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
}

function getMemoryMatchAccuracy(matches: number, attempts: number) {
  if (attempts === 0) return 100;
  return Math.round((matches / attempts) * 100);
}

function getSequenceAccuracy(totalSteps: number, mistakes: number) {
  const attempts = totalSteps + mistakes;
  if (attempts <= 0) return 100;
  return Math.round((totalSteps / attempts) * 100);
}

function getScore(level: number, accuracy: number, mistakes: number, durationSeconds: number) {
  return Math.max(60, Math.round(accuracy + level * 12 - mistakes * 2 + Math.max(0, 45 - durationSeconds)));
}

function getMirroredSequenceIndex(index: number) {
  if (index < 0 || index > 3) return index;
  return index < 2 ? index + 2 : index - 2;
}

function seededShuffleValue(seed: number) {
  const value = Math.sin(seed) * 10000;
  return value - Math.floor(value);
}

function shuffleItems<T>(items: T[], seed = 1) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(seededShuffleValue(seed + index * 997) * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function normalizeRecallWord(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeWord(value: string) {
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function wordsMatch(candidate: string, target: string) {
  const normalizedCandidate = singularizeWord(normalizeRecallWord(candidate));
  const normalizedTarget = singularizeWord(normalizeRecallWord(target));
  if (!normalizedCandidate || !normalizedTarget) return false;
  return (
    normalizedCandidate === normalizedTarget ||
    normalizedCandidate.includes(normalizedTarget) ||
    normalizedTarget.includes(normalizedCandidate)
  );
}

function splitRecallText(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function dedupeWords(words: string[]) {
  const unique: string[] = [];
  words.forEach((word) => {
    if (!unique.some((entry) => wordsMatch(entry, word))) {
      unique.push(word);
    }
  });
  return unique;
}

function getNumberRecallScore(expected: string, actual: string) {
  const normalizedExpected = expected.replace(/\D/g, "");
  const normalizedActual = actual.replace(/\D/g, "");
  if (!normalizedExpected) return 0;

  const correctDigits = normalizedExpected
    .split("")
    .filter((digit, index) => normalizedActual[index] === digit).length;
  return Math.round((correctDigits / normalizedExpected.length) * 100);
}

function getAssociationPrompt(payload: Record<string, unknown>) {
  const pair = Array.isArray(payload.pair) ? payload.pair.map(String) : null;

  if (pair && pair.length >= 2) {
    return {
      cueLabel: "Remember this pair",
      cueValue: pair[0],
      answer: pair[1],
      icon: typeof payload.icon === "string" ? payload.icon : "",
    };
  }

  if (typeof payload.name === "string" && typeof payload.object === "string") {
    return {
      cueLabel: "Who had this object?",
      cueValue: payload.object,
      answer: payload.name,
      icon: typeof payload.icon === "string" ? payload.icon : "",
    };
  }

  if (typeof payload.person === "string" && typeof payload.routine === "string") {
    return {
      cueLabel: "Who follows this routine?",
      cueValue: payload.routine,
      answer: payload.person,
      icon: typeof payload.icon === "string" ? payload.icon : "",
    };
  }

  if (typeof payload.icon === "string" && typeof payload.name === "string") {
    return {
      cueLabel: "Who matches this symbol?",
      cueValue: payload.icon,
      answer: payload.name,
      icon: payload.icon,
    };
  }

  return {
    cueLabel: "What goes with this?",
    cueValue: String(payload.left ?? ""),
    answer: String(payload.right ?? ""),
    icon: typeof payload.icon === "string" ? payload.icon : "",
  };
}

function getPayloadString(payload: Record<string, unknown>, key: string, fallback = "") {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getPayloadNumber(payload: Record<string, unknown>, key: string, fallback: number) {
  const value = Number(payload[key]);
  return Number.isFinite(value) ? value : fallback;
}

function getAssociationChoiceCount(payload: Record<string, unknown>) {
  return Math.max(2, Math.min(4, Math.round(getPayloadNumber(payload, "choiceCount", 4))));
}

function getMemoryGameIcon(gameType: MemoryGameType) {
  switch (gameType) {
    case "memory_match":
      return Grid2x2;
    case "sequence_memory":
      return Route;
    case "word_recall":
      return NotebookPen;
    case "number_memory":
      return Hash;
    case "routine_memory":
      return Clock3;
    case "association_memory":
      return Link2;
    case "story_recall":
      return BookOpen;
    default:
      return Layers3;
  }
}

function getSpeechLanguage(language: string) {
  switch (language) {
    case "en":
      return "en-US";
    case "fr":
      return "fr-FR";
    case "de":
      return "de-DE";
    case "it":
      return "it-IT";
    case "pt":
      return "pt-PT";
    case "es":
    default:
      return "es-ES";
  }
}

function getWordRecallCommandTerms(language: string) {
  switch (language) {
    case "en":
      return {
        ready: ["ready", "continue", "go on"],
        repeat: ["repeat", "again", "say again"],
      };
    case "fr":
      return {
        ready: ["je suis pret", "pret", "continuer"],
        repeat: ["repeter", "encore", "redis"],
      };
    case "de":
      return {
        ready: ["ich bin bereit", "bereit", "weiter"],
        repeat: ["wiederholen", "nochmal", "erneut"],
      };
    case "it":
      return {
        ready: ["sono pronto", "pronto", "continua"],
        repeat: ["ripeti", "di nuovo", "ripetere"],
      };
    case "pt":
      return {
        ready: ["estou pronto", "pronto", "continuar"],
        repeat: ["repetir", "outra vez", "de novo"],
      };
    case "es":
    default:
      return {
        ready: ["estoy listo", "lista", "listo", "continuar", "seguir"],
        repeat: ["repetir", "otra vez", "repite"],
      };
  }
}

function getMemoryCompanionCopy(language: string): MemoryCompanionCopy {
  const englishCopy: MemoryCompanionCopy = {
    mute: "Pause VYVA's voice",
    unmute: "Let VYVA encourage me",
    onStatus: "VYVA is keeping you company",
    offStatus: "Voice encouragement is off",
    start: ["I am here with you. Take your time and enjoy this one.", "Let's do this together. Slow and steady is perfect."],
    keepGoing: ["You are doing well. Keep going at your own pace.", "Nice focus. I am right here with you."],
    match: ["Good match.", "Yes, that pair belongs together.", "Lovely, you found it."],
    mismatch: ["That is okay. Have another look and try again.", "No rush. Each try gives you a little more information."],
    sequenceGood: ["Good step.", "That is it.", "You have the pattern."],
    sequenceWrong: ["No problem. Watch it once more and we will try again.", "Almost. Let's reset and take it step by step."],
    recall: ["Now bring back the words you remember. Anything you recall helps.", "Take a breath and say or choose the words that come back."],
    complete: ["Well done. You finished the exercise.", "Great work. That was a good brain session."],
  };

  switch (language) {
    case "es":
      return {
        mute: "Pausar la voz de VYVA",
        unmute: "Que VYVA me anime",
        onStatus: "VYVA te acompana",
        offStatus: "Animo por voz apagado",
        start: ["Estoy contigo. Hazlo con calma y disfruta.", "Vamos juntos. Despacio y seguro esta perfecto."],
        keepGoing: ["Lo estas haciendo bien. Sigue a tu ritmo.", "Buena concentracion. Estoy aqui contigo."],
        match: ["Buena pareja.", "Si, esas dos van juntas.", "Muy bien, la encontraste."],
        mismatch: ["No pasa nada. Mira otra vez y prueba de nuevo.", "Sin prisa. Cada intento te da mas pistas."],
        sequenceGood: ["Buen paso.", "Eso es.", "Ya tienes el patron."],
        sequenceWrong: ["No pasa nada. Lo vemos otra vez y probamos de nuevo.", "Casi. Reiniciamos y vamos paso a paso."],
        recall: ["Ahora recuerda las palabras que puedas. Todo lo que vuelva ayuda.", "Respira y elige o di las palabras que recuerdes."],
        complete: ["Muy bien. Terminaste el ejercicio.", "Gran trabajo. Buena sesion para la mente."],
      };
    case "fr":
      return {
        mute: "Mettre la voix de VYVA en pause",
        unmute: "Laisser VYVA m'encourager",
        onStatus: "VYVA reste avec vous",
        offStatus: "Encouragement vocal arrete",
        start: ["Je suis avec vous. Prenez votre temps.", "On le fait ensemble. Doucement, c'est tres bien."],
        keepGoing: ["Vous faites bien. Continuez a votre rythme.", "Belle concentration. Je reste avec vous."],
        match: ["Bonne paire.", "Oui, ces deux vont ensemble.", "Tres bien, vous l'avez trouvee."],
        mismatch: ["Ce n'est pas grave. Regardez encore et reessayez.", "Sans pression. Chaque essai donne un indice."],
        sequenceGood: ["Bonne etape.", "C'est ca.", "Vous tenez le rythme."],
        sequenceWrong: ["Aucun souci. Regardons encore et reessayons.", "Presque. On reprend pas a pas."],
        recall: ["Maintenant, retrouvez les mots dont vous vous souvenez.", "Respirez et choisissez les mots qui reviennent."],
        complete: ["Bravo. Vous avez termine l'exercice.", "Tres beau travail. Bonne seance pour l'esprit."],
      };
    case "de":
      return {
        mute: "VYVAs Stimme pausieren",
        unmute: "VYVA soll mich ermutigen",
        onStatus: "VYVA bleibt bei dir",
        offStatus: "Sprachliche Ermutigung ist aus",
        start: ["Ich bin bei dir. Nimm dir Zeit.", "Wir machen das zusammen. Ruhig und Schritt fuer Schritt."],
        keepGoing: ["Das machst du gut. Bleib bei deinem Tempo.", "Gute Konzentration. Ich bin hier bei dir."],
        match: ["Gutes Paar.", "Ja, die zwei gehoeren zusammen.", "Sehr gut, du hast es gefunden."],
        mismatch: ["Kein Problem. Schau noch einmal und versuch es wieder.", "Keine Eile. Jeder Versuch gibt dir mehr Hinweise."],
        sequenceGood: ["Guter Schritt.", "Genau so.", "Du hast das Muster."],
        sequenceWrong: ["Kein Problem. Wir schauen es noch einmal an.", "Fast. Wir starten neu und gehen Schritt fuer Schritt."],
        recall: ["Jetzt erinnere dich an die Woerter, die zurueckkommen.", "Atme kurz und waehle die Woerter, die dir einfallen."],
        complete: ["Gut gemacht. Du hast die Uebung beendet.", "Sehr gute Arbeit. Das war eine gute Einheit fuer den Kopf."],
      };
    case "it":
      return {
        mute: "Metti in pausa la voce di VYVA",
        unmute: "Lascia che VYVA mi incoraggi",
        onStatus: "VYVA ti fa compagnia",
        offStatus: "Incoraggiamento vocale spento",
        start: ["Sono qui con te. Prenditi il tuo tempo.", "Lo facciamo insieme. Piano e con calma va benissimo."],
        keepGoing: ["Stai andando bene. Continua al tuo ritmo.", "Bella concentrazione. Sono qui con te."],
        match: ["Bella coppia.", "Si, queste due stanno insieme.", "Molto bene, l'hai trovata."],
        mismatch: ["Non fa niente. Guarda ancora e riprova.", "Senza fretta. Ogni tentativo ti da piu indizi."],
        sequenceGood: ["Bel passo.", "Ecco, cosi.", "Hai preso il ritmo."],
        sequenceWrong: ["Nessun problema. Guardiamolo ancora e riproviamo.", "Quasi. Ripartiamo e andiamo passo per passo."],
        recall: ["Ora richiama le parole che ricordi.", "Respira e scegli o di le parole che ti tornano in mente."],
        complete: ["Ben fatto. Hai finito l'esercizio.", "Ottimo lavoro. Bella sessione per la mente."],
      };
    case "pt":
      return {
        mute: "Pausar a voz da VYVA",
        unmute: "Deixar a VYVA encorajar-me",
        onStatus: "A VYVA esta consigo",
        offStatus: "Incentivo por voz desligado",
        start: ["Estou consigo. Leve o tempo que precisar.", "Vamos fazer isto juntos. Devagar esta perfeito."],
        keepGoing: ["Esta a ir bem. Continue ao seu ritmo.", "Boa concentracao. Estou aqui consigo."],
        match: ["Boa dupla.", "Sim, essas duas combinam.", "Muito bem, encontrou."],
        mismatch: ["Nao faz mal. Veja outra vez e tente de novo.", "Sem pressa. Cada tentativa da mais pistas."],
        sequenceGood: ["Bom passo.", "E isso.", "Ja tem o padrao."],
        sequenceWrong: ["Sem problema. Vamos ver outra vez e tentar de novo.", "Quase. Recomecamos e vamos passo a passo."],
        recall: ["Agora lembre-se das palavras que conseguir.", "Respire e escolha ou diga as palavras que voltarem."],
        complete: ["Muito bem. Terminou o exercicio.", "Excelente trabalho. Foi uma boa sessao para a mente."],
      };
    case "en":
    default:
      return englishCopy;
  }
}

function pickCompanionLine(lines: string[], key: string) {
  if (lines.length === 0) return "";
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return lines[hash % lines.length] ?? lines[0];
}

function MemoryAudioToggle({
  isMuted,
  onToggle,
  copy,
}: {
  isMuted: boolean;
  onToggle: () => void;
  copy: MemoryCompanionCopy;
}) {
  const Icon = isMuted ? VolumeX : Volume2;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!isMuted}
      aria-label={isMuted ? copy.unmute : copy.mute}
      title={isMuted ? copy.unmute : copy.mute}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D8C7F3] bg-white text-vyva-text-1 shadow-vyva-card"
    >
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#FAF7FF] text-vyva-purple">
        <Icon size={19} />
      </span>
    </button>
  );
}

type MemoryGameRunnerProps = {
  forcedGameType?: MemoryGameType;
  returnPath?: string;
};

const MemoryGameRunner = ({ forcedGameType, returnPath = "/memory-games" }: MemoryGameRunnerProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameType } = useParams<{ gameType: MemoryGameType }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { speakSequence, stopTts, isTtsSpeaking } = useTtsReadout();
  const userId = user?.id ?? FALLBACK_USER_ID;
  const assessmentPractice = cognitiveAssessmentPracticeStateFromRoute(location.state);

  const routeGameType = forcedGameType ?? gameType;
  const validGameType = routeGameType && routeGameType in memoryGameRegistry ? (routeGameType as MemoryGameType) : null;
  const brainSceneId = getMemoryRunnerBrainSceneId(validGameType);
  const brainTestId = getMemoryRunnerBrainTestId(validGameType);
  const renderBrainRunnerScreen = (
    screenKey: string,
    sceneKind: string,
    sceneLayout: string,
    children: ReactNode,
    state: "default" | "loading" | "complete" = "default",
  ) => (
    <BrainCoachFullscreenActivity
      title="Brain Coach"
      testId={brainTestId}
      presentationId={`${brainSceneId}.${screenKey}.touch`}
      sceneId={brainSceneId}
      sceneKind={sceneKind}
      sceneLayout={sceneLayout}
      state={state}
    >
      {children}
    </BrainCoachFullscreenActivity>
  );
  const initialLevel = Number(searchParams.get("level") ?? "1");
  const initialVariantId = searchParams.get("variant") ?? "";

  const [plan, setPlan] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [memoryAttempts, setMemoryAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completionMetrics, setCompletionMetrics] = useState<CompletionMetrics | null>(null);
  const [completionDetails, setCompletionDetails] = useState<CompletionDetails | null>(null);
  const [actionLoading, setActionLoading] = useState<"recommended" | "repeat" | "nextLevel" | null>(null);
  const [sequencePhase, setSequencePhase] = useState<"countdown" | "watching" | "input">("countdown");
  const [sequenceProgress, setSequenceProgress] = useState(0);
  const [activeSequenceTile, setActiveSequenceTile] = useState<string | null>(null);
  const [sequenceReady, setSequenceReady] = useState(false);
  const [sequenceTotalMistakes, setSequenceTotalMistakes] = useState(0);
  const [sequenceRun, setSequenceRun] = useState(0);
  const [sequenceCountdown, setSequenceCountdown] = useState(3);
  const [sequenceStatus, setSequenceStatus] = useState<"idle" | "wrong" | "wait">("idle");
  const [sequencePreviewStep, setSequencePreviewStep] = useState(0);
  const [wordRecallPhase, setWordRecallPhase] = useState<"memorize" | "distraction" | "recall">("memorize");
  const [wordRecallSelectedWords, setWordRecallSelectedWords] = useState<string[]>([]);
  const [wordRecallTypedWords, setWordRecallTypedWords] = useState<string[]>([]);
  const [wordRecallInput, setWordRecallInput] = useState("");
  const [wordRecallChoicesSeed, setWordRecallChoicesSeed] = useState(0);
  const [wordRecallMessage, setWordRecallMessage] = useState<string | null>(null);
  const [wordRecallVoiceMessage, setWordRecallVoiceMessage] = useState<string | null>(null);
  const [numberMemoryPhase, setNumberMemoryPhase] = useState<"study" | "recall">("study");
  const [numberMemoryInput, setNumberMemoryInput] = useState("");
  const [associationPhase, setAssociationPhase] = useState<"study" | "recall">("study");
  const [associationChoice, setAssociationChoice] = useState<string | null>(null);
  const [associationOptionsSeed, setAssociationOptionsSeed] = useState(0);
  const [isMemoryAudioMuted, setIsMemoryAudioMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MEMORY_AUDIO_STORAGE_KEY) === "true";
  });
  const [sequenceTutorialSeen, setSequenceTutorialSeen] = useState(() => readSequenceTutorialSeen(userId));
  const [showSequenceTutorial, setShowSequenceTutorial] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const sequenceStatusTimeoutRef = useRef<number | null>(null);
  const sequenceProgressRef = useRef(0);
  const lastSequenceTapRef = useRef<{ tileId: string; at: number } | null>(null);
  const latestWordRecallWordsRef = useRef<string[]>([]);
  const wordRecallNarrationKeyRef = useRef<string>("");
  const wordRecallCommandCooldownRef = useRef(0);
  const isMemoryAudioMutedRef = useRef(isMemoryAudioMuted);
  const isTtsSpeakingRef = useRef(isTtsSpeaking);
  const assessmentPracticeCompletedRef = useRef(false);
  const companionLineKeyRef = useRef("");
  const wordRecallRepeatTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const stopWordRecallAudio = () => {
    if (wordRecallRepeatTimerRef.current) {
      window.clearTimeout(wordRecallRepeatTimerRef.current);
      wordRecallRepeatTimerRef.current = null;
    }
    stopTts();
    wordRecallNarrationKeyRef.current = "";
  };

  const backToList = () => {
    stopWordRecallAudio();
    navigate(returnPath);
  };
  const buildGameRoute = (recommendation: Recommendation) => {
    const query = `level=${recommendation.level}&variant=${recommendation.variantId}`;
    if (recommendation.gameType === "sequence_memory") {
      return `/attention-boosters/rhythm-tap?${query}`;
    }
    return `/memory-games/${recommendation.gameType}?${query}`;
  };

  useEffect(() => {
    if (!forcedGameType && gameType === "sequence_memory") {
      navigate(`/attention-boosters/rhythm-tap${location.search}`, { replace: true });
    }
  }, [forcedGameType, gameType, location.search, navigate]);

  useEffect(() => {
    let active = true;

    async function resolvePlan() {
      if (!validGameType) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const directDefinition = getGameDefinition(validGameType);
      const directMaxLevel = directDefinition.levels.reduce((highest, levelConfig) => Math.max(highest, levelConfig.level), 1);
      const nextPlan =
        initialVariantId && Number.isFinite(initialLevel)
          ? {
              gameType: validGameType,
              level: Math.min(directMaxLevel, Math.max(1, initialLevel)),
              variantId: initialVariantId,
              reasonLabel: "",
            }
          : await selectGamePlan(userId, validGameType, language);

      if (!active) return;

      setPlan(nextPlan);
      setMatchedIds([]);
      setRevealed([]);
      setMemoryAttempts(0);
      setMistakes(0);
      setFinished(false);
      setSaving(false);
      setCompletionMetrics(null);
      setCompletionDetails(null);
      setActionLoading(null);
      setStartedAt(Date.now());
      setSequencePhase("countdown");
      setSequenceProgress(0);
      sequenceProgressRef.current = 0;
      setActiveSequenceTile(null);
      setSequenceReady(false);
      setSequenceTotalMistakes(0);
      setSequenceRun(0);
      setSequenceCountdown(3);
      setSequenceStatus("idle");
      setWordRecallPhase("memorize");
      setWordRecallSelectedWords([]);
      setWordRecallTypedWords([]);
      setWordRecallInput("");
      setWordRecallChoicesSeed((current) => current + 1);
      setWordRecallMessage(null);
      setWordRecallVoiceMessage(null);
      setNumberMemoryPhase("study");
      setNumberMemoryInput("");
      setAssociationPhase("study");
      setAssociationChoice(null);
      setAssociationOptionsSeed((current) => current + 1);
      setShowSequenceTutorial(nextPlan.gameType === "sequence_memory" && !readSequenceTutorialSeen(userId));
      setLoading(false);
    }

    void resolvePlan();

    return () => {
      active = false;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (sequenceStatusTimeoutRef.current) {
        window.clearTimeout(sequenceStatusTimeoutRef.current);
      }
      if (wordRecallRepeatTimerRef.current) {
        window.clearTimeout(wordRecallRepeatTimerRef.current);
        wordRecallRepeatTimerRef.current = null;
      }
      stopTts();
      wordRecallNarrationKeyRef.current = "";
    };
  }, [initialLevel, initialVariantId, language, location.key, stopTts, userId, validGameType]);

  useEffect(() => {
    return () => {
      if (wordRecallRepeatTimerRef.current) {
        window.clearTimeout(wordRecallRepeatTimerRef.current);
        wordRecallRepeatTimerRef.current = null;
      }
      stopTts();
      wordRecallNarrationKeyRef.current = "";
    };
  }, [stopTts]);

  const definition = plan ? getGameDefinition(plan.gameType) : null;
  const variant = useMemo(() => {
    if (!plan) return null;
    const levelConfig = getGameLevel(plan.gameType, plan.level);
    return levelConfig.variants.find((entry) => entry.id === plan.variantId) ?? levelConfig.variants[0];
  }, [plan]);

  const localizedVariant = useMemo(() => {
    if (!variant) return null;
    return getVariantContent(variant, language);
  }, [language, variant]);

  const wordRecallWords = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return [];
    return ((localizedVariant.payload.words as string[]) ?? []).filter(Boolean);
  }, [localizedVariant, plan]);

  const wordRecallDistractors = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return [];
    return ((localizedVariant.payload.distractors as string[]) ?? []).filter(Boolean);
  }, [localizedVariant, plan]);

  const wordRecallDistractionType = useMemo(() => {
    if (!plan || plan.gameType !== "word_recall" || !localizedVariant) return null;
    return (localizedVariant.payload.distractionType as WordRecallDistractionType | null) ?? null;
  }, [localizedVariant, plan]);

  const wordRecallChoiceWords = useMemo(() => {
    void wordRecallChoicesSeed;
    if (plan?.gameType !== "word_recall") return [];
    return shuffleItems([...wordRecallWords, ...wordRecallDistractors], wordRecallChoicesSeed);
  }, [plan?.gameType, wordRecallChoicesSeed, wordRecallDistractors, wordRecallWords]);

  const numberMemoryDigits = useMemo(() => {
    if (!plan || plan.gameType !== "number_memory" || !localizedVariant) return "";
    return String(localizedVariant.payload.digits ?? "");
  }, [localizedVariant, plan]);

  const numberMemoryTarget = useMemo(() => {
    if (!numberMemoryDigits) return "";
    return localizedVariant?.payload.reverse
      ? numberMemoryDigits.split("").reverse().join("")
      : numberMemoryDigits;
  }, [localizedVariant, numberMemoryDigits]);

  const associationPrompt = useMemo(() => {
    if (!plan || plan.gameType !== "association_memory" || !localizedVariant) return null;
    return getAssociationPrompt(localizedVariant.payload);
  }, [localizedVariant, plan]);

  const associationOptions = useMemo(() => {
    void associationOptionsSeed;
    if (!plan || plan.gameType !== "association_memory" || !associationPrompt || !definition) return [];

    const candidateAnswers = definition.levels
      .flatMap((levelConfig) => levelConfig.variants)
      .map((entry) => getAssociationPrompt(getVariantContent(entry, language).payload).answer)
      .filter((answer) => answer && answer !== associationPrompt.answer);
    const choiceCount = getAssociationChoiceCount(localizedVariant.payload);
    const shuffledDistractors = shuffleItems([...new Set(candidateAnswers)], associationOptionsSeed).slice(0, choiceCount - 1);
    return shuffleItems([associationPrompt.answer, ...shuffledDistractors], associationOptionsSeed + 11);
  }, [associationOptionsSeed, associationPrompt, definition, language, localizedVariant?.payload, plan]);

  const wordRecallCoachSegments = useMemo(() => {
    if (plan?.gameType !== "word_recall") return [];

    if (wordRecallPhase === "memorize") {
      return [
        { text: t("wordRecall.coachIntro"), delayMs: 500 },
        { text: localizedVariant?.prompt ?? "", delayMs: 450 },
        { text: t("wordRecall.coachMemorize"), delayMs: 500 },
        ...wordRecallWords.map((word) => ({ text: word, delayMs: 800, rate: 0.82 })),
        { text: t("wordRecall.coachReady"), delayMs: 450 },
      ];
    }

    if (wordRecallPhase === "distraction") {
      const distractionLine =
        wordRecallDistractionType === "choose_blue"
          ? t("wordRecall.distractionChooseBlue")
          : wordRecallDistractionType === "breathe_continue"
            ? t("wordRecall.distractionBreathe")
            : t("wordRecall.distractionCountBackwards");

      return [
        { text: t("wordRecall.coachDistraction"), delayMs: 500 },
        { text: distractionLine, delayMs: 450 },
      ];
    }

    return [
      { text: t("wordRecall.coachRecall"), delayMs: 450 },
      { text: t("wordRecall.selectRememberedWords"), delayMs: 350 },
    ];
  }, [localizedVariant?.prompt, plan?.gameType, t, wordRecallDistractionType, wordRecallPhase, wordRecallWords]);

  const wordRecallCommandTerms = useMemo(() => getWordRecallCommandTerms(language), [language]);
  const companionCopy = useMemo(() => getMemoryCompanionCopy(language), [language]);

  useEffect(() => {
    isMemoryAudioMutedRef.current = isMemoryAudioMuted;
  }, [isMemoryAudioMuted]);

  useEffect(() => {
    isTtsSpeakingRef.current = isTtsSpeaking;
  }, [isTtsSpeaking]);

  const speakCompanion = useCallback(
    (kind: MemoryCompanionMessageKind, key: string) => {
      if (!plan || loading || saving) return;
      if (finished && kind !== "complete") return;
      if (isMemoryAudioMutedRef.current || isTtsSpeakingRef.current) return;

      const lineKey = `${kind}:${key}`;
      if (companionLineKeyRef.current === lineKey) return;
      companionLineKeyRef.current = lineKey;

      const text = pickCompanionLine(companionCopy[kind], lineKey);
      if (!text) return;

      speakSequence([{ text, lang: getSpeechLanguage(language), rate: 0.88 }]);
    },
    [companionCopy, finished, language, loading, plan, saving, speakSequence],
  );

  const { isSupported: wordRecallVoiceSupported, isListening: wordRecallListening, startListening: startWordRecallListening } =
    useSpeechRecognition({
      language,
      onTranscript: (transcript) => {
        const transcriptParts = splitRecallText(transcript.replace(/\s+y\s+|\s+and\s+|\s+et\s+|\s+und\s+|\s+e\s+|\s+ou\s+/gi, ","));
        const matchedWords = latestWordRecallWordsRef.current.filter((word) =>
          transcriptParts.some((part) => wordsMatch(part, word)) || wordsMatch(transcript, word),
        );

        if (matchedWords.length === 0) {
          setWordRecallVoiceMessage(t("wordRecall.tryAgain"));
          return;
        }

        setWordRecallVoiceMessage(dedupeWords(matchedWords).join(", "));
        setWordRecallSelectedWords((current) => dedupeWords([...current, ...matchedWords]));
      },
    });

  const {
    isSupported: wordRecallCommandSupported,
    isListening: wordRecallCommandListening,
    startListening: startWordRecallCommandListening,
    stopListening: stopWordRecallCommandListening,
  } = useSpeechRecognition({
    language,
    onTranscript: (transcript) => {
      const now = Date.now();
      if (now - wordRecallCommandCooldownRef.current < 1200) return;

      const normalizedTranscript = normalizeRecallWord(transcript);
      const saidReady = wordRecallCommandTerms.ready.some((term) => normalizedTranscript.includes(normalizeRecallWord(term)));
      const saidRepeat = wordRecallCommandTerms.repeat.some((term) => normalizedTranscript.includes(normalizeRecallWord(term)));

      if (saidRepeat) {
        wordRecallCommandCooldownRef.current = now;
        wordRecallNarrationKeyRef.current = "";
        setWordRecallMessage(t("wordRecall.commandRepeatHeard"));
        stopTts();
        if (wordRecallRepeatTimerRef.current) {
          window.clearTimeout(wordRecallRepeatTimerRef.current);
        }
        wordRecallRepeatTimerRef.current = window.setTimeout(() => {
          wordRecallRepeatTimerRef.current = null;
          speakSequence(
            wordRecallCoachSegments.map((segment) => ({
              ...segment,
              lang: getSpeechLanguage(language),
            })),
          );
        }, 180);
        return;
      }

      if (!saidReady) return;

      wordRecallCommandCooldownRef.current = now;
      setWordRecallMessage(t("wordRecall.commandReadyHeard"));

      if (wordRecallPhase === "memorize") {
        continueWordRecall();
        return;
      }

      if (wordRecallPhase === "distraction") {
        completeWordRecallDistraction();
      }
    },
  });

  useEffect(() => {
    latestWordRecallWordsRef.current = wordRecallWords;
  }, [wordRecallWords]);

  useEffect(() => {
    if (plan?.gameType !== "word_recall") return;
    if (isMemoryAudioMuted) {
      stopTts();
      return;
    }
    if (wordRecallCoachSegments.length === 0) return;

    const narrationKey = `${variant?.id ?? "word"}-${wordRecallPhase}-${wordRecallDistractionType ?? "none"}`;
    if (wordRecallNarrationKeyRef.current === narrationKey) return;
    wordRecallNarrationKeyRef.current = narrationKey;

    const timer = window.setTimeout(() => {
      speakSequence(
        wordRecallCoachSegments.map((segment) => ({
          ...segment,
          lang: getSpeechLanguage(language),
        })),
      );
    }, 450);

    return () => {
      window.clearTimeout(timer);
      stopTts();
    };
  }, [
    isMemoryAudioMuted,
    language,
    plan?.gameType,
    speakSequence,
    stopTts,
    variant?.id,
    wordRecallCoachSegments,
    wordRecallDistractionType,
    wordRecallPhase,
  ]);

  useEffect(() => {
    if (plan?.gameType !== "word_recall") {
      if (wordRecallRepeatTimerRef.current) {
        window.clearTimeout(wordRecallRepeatTimerRef.current);
        wordRecallRepeatTimerRef.current = null;
      }
      stopTts();
      wordRecallNarrationKeyRef.current = "";
      return;
    }
  }, [plan?.gameType, stopTts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MEMORY_AUDIO_STORAGE_KEY, String(isMemoryAudioMuted));
    if (isMemoryAudioMuted) {
      stopTts();
    }
  }, [isMemoryAudioMuted, stopTts]);

  useEffect(() => {
    if (!plan || loading || saving || finished || isMemoryAudioMuted) return;

    const canSpeakDuringCurrentPhase =
      plan.gameType === "memory_match" ||
      (plan.gameType === "sequence_memory" && sequencePhase === "input") ||
      (plan.gameType === "word_recall" && wordRecallPhase === "recall");

    if (!canSpeakDuringCurrentPhase) return;

    const openingTimer = window.setTimeout(() => {
      const openingKind: MemoryCompanionMessageKind = plan.gameType === "word_recall" ? "recall" : "start";
      speakCompanion(openingKind, `${plan.variantId}-${plan.gameType}-opening`);
    }, plan.gameType === "sequence_memory" ? 900 : 1400);

    const encouragementTimer = window.setInterval(() => {
      speakCompanion("keepGoing", `${plan.variantId}-${plan.gameType}-${Date.now()}`);
    }, 22000);

    return () => {
      window.clearTimeout(openingTimer);
      window.clearInterval(encouragementTimer);
    };
  }, [
    finished,
    isMemoryAudioMuted,
    loading,
    plan,
    saving,
    sequencePhase,
    speakCompanion,
    wordRecallPhase,
  ]);

  useEffect(() => {
    if (!finished || !completionMetrics || isMemoryAudioMuted) return;

    const timer = window.setTimeout(() => {
      speakCompanion("complete", `${plan?.variantId ?? "memory"}-${completionMetrics.score}-${completionMetrics.accuracy}`);
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    completionMetrics,
    finished,
    isMemoryAudioMuted,
    plan?.variantId,
    speakCompanion,
  ]);

  useEffect(() => {
    const canListenForCommands =
      plan?.gameType === "word_recall" &&
      wordRecallCommandSupported &&
      !isMemoryAudioMuted &&
      !isTtsSpeaking &&
      (wordRecallPhase === "memorize" || wordRecallPhase === "distraction");

    if (!canListenForCommands) {
      stopWordRecallCommandListening();
      return;
    }

    if (!wordRecallCommandListening) {
      const timer = window.setTimeout(() => {
        startWordRecallCommandListening();
      }, 350);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [
    isMemoryAudioMuted,
    isTtsSpeaking,
    plan?.gameType,
    startWordRecallCommandListening,
    stopWordRecallCommandListening,
    wordRecallCommandListening,
    wordRecallCommandSupported,
    wordRecallPhase,
  ]);

  const memoryDeck = useMemo(() => {
    if (!plan || plan.gameType !== "memory_match" || !localizedVariant) return [];
    const pairItems = (localizedVariant.payload.pairItems as { label: string; emoji: string }[]) ?? [];

    return shuffleCards(
      pairItems.flatMap((item, index) => [
        { deckId: `${variant?.id}-${index}-a`, pairId: `${variant?.id}-${index}`, label: item.label, emoji: item.emoji },
        { deckId: `${variant?.id}-${index}-b`, pairId: `${variant?.id}-${index}`, label: item.label, emoji: item.emoji },
      ]),
    );
  }, [localizedVariant, plan, variant?.id]);

  const sequenceTiles = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    return ((localizedVariant.payload.tiles as SequenceTile[]) ?? []).slice(0, 4);
  }, [localizedVariant, plan]);

  const expectedSequence = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    const baseSequence = (localizedVariant.payload.sequence as string[]) ?? [];
    const reverse = Boolean(localizedVariant.payload.reverse);
    return reverse ? [...baseSequence].reverse() : baseSequence;
  }, [localizedVariant, plan]);

  const previewSequence = useMemo(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !localizedVariant) return [];
    return (localizedVariant.payload.sequence as string[]) ?? [];
  }, [localizedVariant, plan]);
  const sequenceStepMs = useMemo(() => {
    const rawStepMs = Number(localizedVariant?.payload.tempoMs ?? 900);
    return Math.max(680, Math.min(1200, rawStepMs));
  }, [localizedVariant]);

  const sequenceTileMap = useMemo(
    () => new Map(sequenceTiles.map((tile) => [tile.id, tile])),
    [sequenceTiles],
  );
  const sequenceTileRows = useMemo(
    () => [sequenceTiles.slice(0, 2), sequenceTiles.slice(2, 4)],
    [sequenceTiles],
  );
  const previewSequencePositions = useMemo(
    () => previewSequence.map((tileId) => sequenceTiles.findIndex((tile) => tile.id === tileId)).filter((index) => index >= 0),
    [previewSequence, sequenceTiles],
  );
  const expectedSequencePositions = useMemo(
    () => expectedSequence.map((tileId) => sequenceTiles.findIndex((tile) => tile.id === tileId)).filter((index) => index >= 0),
    [expectedSequence, sequenceTiles],
  );

  const replaySequence = () => {
    setSequencePhase("countdown");
    setSequenceReady(false);
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    lastSequenceTapRef.current = null;
    setActiveSequenceTile(null);
    setSequenceCountdown(3);
    setSequenceStatus("idle");
    setSequencePreviewStep(0);
    setSequenceRun((current) => current + 1);
  };

  const markSequenceTutorialSeen = useCallback(() => {
    writeSequenceTutorialSeen(userId);
    setSequenceTutorialSeen(true);
  }, [userId]);

  const openSequenceInstructions = useCallback(() => {
    stopTts();
    setShowSequenceTutorial(true);
  }, [stopTts]);

  const closeSequenceTutorial = useCallback(() => {
    markSequenceTutorialSeen();
    setShowSequenceTutorial(false);
    setSequenceRun((current) => current + 1);
  }, [markSequenceTutorialSeen]);

  useEffect(() => {
    if (!plan || plan.gameType !== "sequence_memory" || !sequenceTiles.length || !expectedSequence.length || finished || showSequenceTutorial) return;

    setSequenceReady(false);
    setSequencePhase("countdown");
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    lastSequenceTapRef.current = null;
    setActiveSequenceTile(null);
    setSequenceCountdown(3);
    setSequenceStatus("idle");
    setSequencePreviewStep(0);

    let cancelled = false;
    const previewSteps = [...previewSequence];
    const timeouts: number[] = [];

    [3, 2, 1].forEach((count, index) => {
      timeouts.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setSequencePhase("countdown");
          setSequenceCountdown(count);
        }, index * 1000),
      );
    });

    previewSteps.forEach((tileId, index) => {
      timeouts.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setSequencePhase("watching");
          setSequenceCountdown(0);
          setSequencePreviewStep(index + 1);
          setActiveSequenceTile(tileId);
        }, index * sequenceStepMs + 3400),
      );
      timeouts.push(
        window.setTimeout(() => {
          if (!cancelled) setActiveSequenceTile(null);
        }, index * sequenceStepMs + 3400 + Math.min(580, sequenceStepMs - 120)),
      );
    });

    timeouts.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setSequencePhase("input");
        setSequenceReady(true);
        lastSequenceTapRef.current = null;
        setActiveSequenceTile(null);
        setStartedAt(Date.now());
      }, previewSteps.length * sequenceStepMs + 3600),
    );

    return () => {
      cancelled = true;
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [expectedSequence, finished, plan, previewSequence, sequenceRun, sequenceStepMs, sequenceTiles.length, showSequenceTutorial]);

  useEffect(() => {
    if (!plan || finished || saving) return;

    if (plan.gameType === "memory_match") {
      if (matchedIds.length !== memoryDeck.length || memoryDeck.length === 0) return;
      const durationSeconds = getDurationSeconds(startedAt);
      const accuracy = getMemoryMatchAccuracy(memoryDeck.length / 2, memoryAttempts);
      const score = getScore(plan.level, accuracy, mistakes, durationSeconds);
      setCompletionMetrics({ score, accuracy, mistakes, durationSeconds });
      setCompletionDetails(null);

      let active = true;
      async function completeGame() {
        setSaving(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "visual_memory",
            variantId: plan.variantId,
            level: plan.level,
            score,
            accuracy,
            mistakes,
            durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (active) {
            setSaving(false);
            setFinished(true);
          }
        }
      }
      void completeGame();
      return () => {
        active = false;
      };
    }

    if (plan.gameType === "sequence_memory") {
      if (!sequenceReady || sequenceProgress !== expectedSequence.length || expectedSequence.length === 0) return;
      const durationSeconds = getDurationSeconds(startedAt);
      const accuracy = getSequenceAccuracy(expectedSequence.length, sequenceTotalMistakes);
      const score = getScore(plan.level, accuracy, sequenceTotalMistakes, durationSeconds);
      setCompletionMetrics({ score, accuracy, mistakes: sequenceTotalMistakes, durationSeconds });
      setCompletionDetails(null);

      let active = true;
      async function completeGame() {
        setSaving(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "working_memory",
            variantId: plan.variantId,
            level: plan.level,
            score,
            accuracy,
            mistakes: sequenceTotalMistakes,
            durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (active) {
            setSaving(false);
            setFinished(true);
          }
        }
      }
      void completeGame();
      return () => {
        active = false;
      };
    }

    if (["word_recall", "number_memory", "association_memory"].includes(plan.gameType) && completionMetrics && !finished) {
      async function completeGame() {
        setSaving(true);
        setFinished(true);
        try {
          await saveGameResult({
            userId,
            gameType: plan.gameType,
            cognitiveDomain: definition?.cognitiveDomain ?? "episodic_memory",
            variantId: plan.variantId,
            level: plan.level,
            score: completionMetrics.score,
            accuracy: completionMetrics.accuracy,
            mistakes: completionMetrics.mistakes,
            durationSeconds: completionMetrics.durationSeconds,
            completedAt: new Date().toISOString(),
            language,
          });
        } finally {
          if (isMountedRef.current) {
            setSaving(false);
          }
        }
      }
      void completeGame();
    }
  }, [
    completionMetrics,
    definition?.cognitiveDomain,
    expectedSequence.length,
    finished,
    language,
    matchedIds.length,
    memoryAttempts,
    memoryDeck.length,
    mistakes,
    plan,
    saving,
    sequenceProgress,
    sequenceReady,
    sequenceTotalMistakes,
    startedAt,
    userId,
  ]);

  useEffect(() => {
    if (!finished) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [finished]);

  const openRecommended = async () => {
    if (!plan) return;
    stopWordRecallAudio();
    setActionLoading("recommended");
    try {
      const nextRecommendation = await selectNextMemoryGame(userId, language);
      navigate(buildGameRoute(nextRecommendation), {
        state: { sessionToken: Date.now() },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const openSameGame = async (levelOverride?: number) => {
    if (!plan) return;
    stopWordRecallAudio();
    setActionLoading("repeat");
    try {
      const requestedLevel = typeof levelOverride === "number" ? levelOverride : undefined;
      const repeatLevel = requestedLevel ?? plan.level;
      const sameGameRecommendation = await selectNextVariantForSameGame(userId, plan.gameType, language, repeatLevel, plan.variantId);
      navigate(buildGameRoute(sameGameRecommendation), {
        state: { sessionToken: Date.now() },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getNextPlayableLevel = () => {
    if (!plan) return 1;
    const maxLevel = definition?.levels.reduce((highest, levelConfig) => Math.max(highest, levelConfig.level), 1) ?? 5;
    return Math.min(maxLevel, plan.level + 1);
  };

  const openNextLevel = async () => {
    if (!plan) return;
    const nextLevel = getNextPlayableLevel();
    if (nextLevel <= plan.level) return;

    stopWordRecallAudio();
    setActionLoading("nextLevel");
    try {
      const nextRecommendation = await selectNextVariantForSameGame(userId, plan.gameType, language, nextLevel);
      navigate(buildGameRoute(nextRecommendation), {
        state: { sessionToken: Date.now() },
      });
    } finally {
      setActionLoading(null);
    }
  };

  const memoryComplete = Boolean(plan?.gameType === "memory_match" && memoryDeck.length > 0 && matchedIds.length === memoryDeck.length);

  const completeAssessmentPractice = useCallback(() => {
    if (!assessmentPractice || assessmentPracticeCompletedRef.current) return;
    assessmentPracticeCompletedRef.current = true;
    completeCognitiveAssessmentPractice(assessmentPractice);
  }, [assessmentPractice]);

  const returnToAssessment = useCallback(() => {
    if (!assessmentPractice) return;
    completeAssessmentPractice();
    navigate(assessmentPractice.returnTo, {
      state: {
        assessmentPracticeCompleted: true,
        recommendedDomain: assessmentPractice.recommendedDomain,
      },
    });
  }, [assessmentPractice, completeAssessmentPractice, navigate]);

  useEffect(() => {
    if (memoryComplete) completeAssessmentPractice();
  }, [completeAssessmentPractice, memoryComplete]);

  if (!validGameType) {
    return renderBrainRunnerScreen("not_found", "error", "message", (
      <div className="px-[22px] py-8">
        <button
          onClick={backToList}
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
    ));
  }

  if (loading || !plan || !definition || !variant || !localizedVariant) {
    return (
      <BrainCoachLoadingState
        title="Brain Coach"
        label={t("memory.loading", "Loading memory game...")}
        testId={brainTestId}
        presentationId={`${brainSceneId}.loading.touch`}
        sceneId={brainSceneId}
      />
    );
  }

  const durationSeconds = completionMetrics?.durationSeconds ?? getDurationSeconds(startedAt);
  const memoryAccuracy = getMemoryMatchAccuracy(matchedIds.length / 2, memoryAttempts);
  const sequenceAccuracy = getSequenceAccuracy(expectedSequence.length, sequenceTotalMistakes);
  const summaryAccuracy = plan.gameType === "sequence_memory" ? sequenceAccuracy : memoryAccuracy;
  const summaryMistakes = plan.gameType === "sequence_memory" ? sequenceTotalMistakes : mistakes;
  const gameTitle = getGameTitle(plan.gameType, language);
  const gamePrompt = localizedVariant?.prompt ?? getGameDescription(plan.gameType, language);
  const GameIcon = getMemoryGameIcon(plan.gameType);
  const gameIconStyle = { background: definition.iconBg, color: definition.accentColor };
  const currentLevelLabel = getBrainCoachProgressLabel(plan.level);
  const voiceGameContextPanel = (
    <VoiceActionFulfillmentPanel
      domain="brain_coach"
      actionTypes={["brain.memory_game"]}
      title="Game context ready"
      description="VYVA can use the current game, level, progress, and encouragement setting while keeping the user company."
      highlights={[
        { label: "Game", value: gameTitle, tone: "good" as const },
        { label: "Level", value: plan.level, tone: "neutral" as const },
        { label: "Companion", value: isMemoryAudioMuted ? "Off" : "On", tone: isMemoryAudioMuted ? "warning" as const : "good" as const },
      ]}
      className="mt-4 hidden sm:block"
    />
  );

  if (plan.gameType === "story_recall") {
    return renderBrainRunnerScreen("story_recall", "playing", "story_recall", (
      <StoryRecallGame
        plan={plan}
        localizedVariant={localizedVariant}
        gameTitle={gameTitle}
        gamePrompt={gamePrompt}
        accentColor={definition.accentColor}
        iconBg={definition.iconBg}
        cognitiveDomain={definition.cognitiveDomain}
        userId={userId}
        language={language}
        t={t}
        onBack={backToList}
        onOpenRecommended={openRecommended}
        onOpenNextLevel={openNextLevel}
        onOpenSameGame={openSameGame}
        actionLoading={actionLoading}
      />
    ));
  }

  if (
    plan.gameType !== "memory_match"
    && plan.gameType !== "sequence_memory"
    && plan.gameType !== "word_recall"
    && plan.gameType !== "number_memory"
    && plan.gameType !== "association_memory"
  ) {
    return renderBrainRunnerScreen("stub", "stub", "message", (
      <div className="px-[22px] pb-6">
        <button
          onClick={backToList}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={18} />
          {t("common.back")}
        </button>
        <div className="mt-4 rounded-[26px] bg-white p-6 shadow-vyva-card">
          <div
            className="inline-flex h-[64px] w-[64px] items-center justify-center rounded-[20px]"
            style={gameIconStyle}
          >
            <GameIcon size={28} />
          </div>
          <h1 className="mt-4 font-display text-[30px] text-vyva-text-1">{gameTitle}</h1>
          <p className="mt-2 text-[17px] leading-[1.6] text-vyva-text-2">{getGameDescription(plan.gameType, language)}</p>
          <div className="mt-5 rounded-[20px] border border-vyva-border bg-vyva-cream p-5">
            <p className="text-[18px] font-semibold text-vyva-text-1">{t("common.comingSoon")}</p>
            <p className="mt-2 text-[15px] leading-[1.6] text-vyva-text-2">{t("memory.stubBody")}</p>
          </div>
          <button
            onClick={backToList}
            className="mt-5 w-full rounded-[18px] bg-vyva-purple px-5 py-4 text-[17px] font-semibold text-white"
          >
            {t("memory.backToMemory")}
          </button>
        </div>
      </div>
    ));
  }

  if (plan.gameType === "sequence_memory" && showSequenceTutorial) {
    const previewTiles = sequenceTiles.length > 0
      ? sequenceTiles
      : [
          { id: "one", emoji: "1", color: "#6B21A8" },
          { id: "two", emoji: "2", color: "#0F766E" },
          { id: "three", emoji: "3", color: "#B45309" },
          { id: "four", emoji: "4", color: "#2563EB" },
        ];

    return renderBrainRunnerScreen("tutorial", "tutorial", "sequence_example", (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2">
        <button
          onClick={backToList}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-[14px] font-semibold text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={17} />
          {t("common.back")}
        </button>

        <section className="mt-3 rounded-[22px] border border-[#EFE7DB] bg-white p-4 text-center shadow-vyva-card sm:rounded-[26px] sm:p-5">
          <div className="mx-auto flex h-[68px] w-[68px] items-center justify-center rounded-[20px] bg-[#FFF9F1] shadow-vyva-card sm:h-[76px] sm:w-[76px] sm:rounded-[22px]">
            <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[17px] sm:h-[54px] sm:w-[54px]" style={gameIconStyle}>
              <GameIcon size={26} />
            </div>
          </div>
          <h1 className="mt-3 font-display text-[30px] leading-tight text-vyva-text-1 sm:text-[36px]">{t("memory.sequenceTutorialTitle", "How it works")}</h1>

          <div className="mx-auto mt-4 grid max-w-[360px] grid-cols-2 gap-3">
            {previewTiles.map((tile, index) => (
              <div
                key={tile.id}
                className="flex min-h-[88px] flex-col items-center justify-center rounded-[18px] text-white shadow-vyva-card sm:min-h-[104px] sm:rounded-[22px]"
                style={{ background: tile.color }}
              >
                <span className="text-[28px] leading-none sm:text-[34px]">{tile.emoji}</span>
                <span className="mt-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-[14px] font-black">
                  {index + 1}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              t("memory.sequenceTutorialWatch", "Watch the order"),
              t("memory.sequenceTutorialRepeat", "Tap it back"),
              t("memory.sequenceTutorialPace", "Try again if needed"),
            ].map((label, index) => (
              <div key={label} className="flex min-h-[58px] items-center gap-3 rounded-[18px] bg-[#FFF9F1] px-4 py-3 text-left sm:min-h-[72px]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vyva-purple text-[15px] font-black text-white">
                  {index + 1}
                </span>
                <p className="text-[16px] font-black leading-tight text-vyva-text-1 sm:text-[17px]">{label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={closeSequenceTutorial}
            className="mt-4 min-h-[58px] w-full rounded-full bg-vyva-purple px-6 text-[20px] font-black text-white shadow-vyva-card sm:mt-6 sm:min-h-[66px] sm:text-[22px]"
          >
            {t("memory.sequenceTutorialUnderstand", "I understand")}
          </button>
        </section>
      </div>
    ));
  }

  if (finished && plan.gameType !== "memory_match") {
    const score = completionMetrics?.score ?? getScore(plan.level, summaryAccuracy, summaryMistakes, durationSeconds);
    const finishedAccuracy = completionMetrics?.accuracy ?? summaryAccuracy;
    const finishedMistakes = completionMetrics?.mistakes ?? summaryMistakes;
    const nextPlayableLevel = getNextPlayableLevel();
    const canOpenNextLevel = nextPlayableLevel > plan.level && finishedAccuracy >= 80;
    const nextLevelLabel = t("brainGames.resultActions.continueToLevel").replace("{level}", String(nextPlayableLevel));

    return renderBrainRunnerScreen("result", "completion", "modal_actions", (
      <div className="min-h-[100dvh] bg-[#FFF9F1]">
        <BrainGameCompletionDialog
          title={t("memory.wellDone")}
          summary={getBrainCoachSupportiveProgressCopy({ advanced: canOpenNextLevel, level: plan.level })}
          metrics={[
            { label: t("memory.score"), value: `${score}` },
            { label: t("memory.accuracy"), value: `${finishedAccuracy}%` },
            { label: t("memory.mistakes"), value: `${finishedMistakes}` },
            { label: t("memory.duration"), value: `${durationSeconds}s` },
          ]}
          continueLabel={t("brainGames.resultActions.continue")}
          nextLevelLabel={canOpenNextLevel ? nextLevelLabel : undefined}
          nextLevelDisplayLabel={canOpenNextLevel ? `${t("common.level")} ${nextPlayableLevel}` : undefined}
          replayLabel={t("brainGames.resultActions.playAgain")}
          anotherLabel={t("brainGames.resultActions.moreGames", "More games")}
          assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
          assessmentReturnHint={
            assessmentPractice
              ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
              : undefined
          }
          onContinue={openRecommended}
          onNextLevel={canOpenNextLevel ? () => void openNextLevel() : undefined}
          onReplay={() => void openSameGame()}
          onAnother={backToList}
          onAssessmentReturn={assessmentPractice ? returnToAssessment : undefined}
          disabled={actionLoading !== null}
          details={completionDetails && (
            <div className="grid gap-2">
                {completionDetails.rememberedWords && completionDetails.rememberedWords.length > 0 && (
                  <div className="rounded-[16px] border border-vyva-border bg-[#F8FAFC] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.remembered")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {completionDetails.rememberedWords.map((word) => (
                        <span key={`remembered-${word}`} className="rounded-full bg-white px-2.5 py-1.5 text-[13px] font-medium text-vyva-text-1 shadow-sm">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {completionDetails.correctWords && completionDetails.correctWords.length > 0 && (
                  <div className="rounded-[16px] border border-[#CFE9D9] bg-[#F0FDF4] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.correctWords")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {completionDetails.correctWords.map((word) => (
                        <span key={`correct-${word}`} className="rounded-full bg-white px-2.5 py-1.5 text-[13px] font-medium text-vyva-text-1 shadow-sm">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {completionDetails.missedWords && completionDetails.missedWords.length > 0 && (
                  <div className="rounded-[16px] border border-[#F3E0BD] bg-[#FFF7ED] p-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.missedWords")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {completionDetails.missedWords.map((word) => (
                        <span key={`missed-${word}`} className="rounded-full bg-white px-2.5 py-1.5 text-[13px] font-medium text-vyva-text-1 shadow-sm">
                          {word}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {(completionDetails.expectedAnswer || completionDetails.givenAnswer) && (
                  <div className="rounded-[16px] border border-[#D8C7F3] bg-white p-3">
                    {completionDetails.cueLabel ? (
                      <p className="text-[13px] font-bold leading-snug text-vyva-text-2">{completionDetails.cueLabel}</p>
                    ) : null}
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[14px] bg-[#F8FAFC] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("memory.yourAnswer", "Your answer")}</p>
                        <p className="mt-1 text-[18px] font-black text-vyva-text-1">{completionDetails.givenAnswer}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#F0FDF4] px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("memory.correctAnswer", "Correct answer")}</p>
                        <p className="mt-1 text-[18px] font-black text-vyva-text-1">{completionDetails.expectedAnswer}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
          )}
        />
      </div>
    ), "complete");
  }

  const onMemoryCardClick = (card: MemoryCard) => {
    if (finished || saving) return;
    if (matchedIds.includes(card.deckId) || revealed.includes(card.deckId) || revealed.length === 2) return;

    const nextRevealed = [...revealed, card.deckId];
    setRevealed(nextRevealed);

    if (nextRevealed.length < 2) return;

    setMemoryAttempts((current) => current + 1);

    const [firstId, secondId] = nextRevealed;
    const firstCard = memoryDeck.find((entry) => entry.deckId === firstId);
    const secondCard = memoryDeck.find((entry) => entry.deckId === secondId);

    if (!firstCard || !secondCard) {
      setRevealed([]);
      return;
    }

    if (firstCard.pairId === secondCard.pairId) {
      timeoutRef.current = window.setTimeout(() => {
        setMatchedIds((current) => [...current, firstId, secondId]);
        setRevealed([]);
        speakCompanion("match", `${firstCard.pairId}-${secondCard.deckId}`);
      }, 450);
      return;
    }

    setMistakes((current) => current + 1);
    speakCompanion("mismatch", `${firstCard.deckId}-${secondCard.deckId}-${memoryAttempts}`);
    timeoutRef.current = window.setTimeout(() => {
      setRevealed([]);
    }, 850);
  };

  const onSequenceTileClick = (tileId: string, tileIndex: number) => {
    if (finished || saving) return;

    if (!sequenceReady || sequencePhase !== "input") {
      setSequenceStatus("wait");
      if (sequenceStatusTimeoutRef.current) {
        window.clearTimeout(sequenceStatusTimeoutRef.current);
      }
      sequenceStatusTimeoutRef.current = window.setTimeout(() => {
        setSequenceStatus((current) => (current === "wait" ? "idle" : current));
      }, 1200);
      return;
    }

    const now = Date.now();
    if (lastSequenceTapRef.current?.tileId === tileId && now - lastSequenceTapRef.current.at < 180) {
      return;
    }
    lastSequenceTapRef.current = { tileId, at: now };

    const currentProgress = sequenceProgressRef.current;
    const expectedPosition = expectedSequencePositions[currentProgress];
    if (expectedPosition === undefined) return;

    const isMatchingPosition = isSequenceTileMatch(tileIndex, expectedPosition);

    if (isMatchingPosition) {
      setSequenceStatus("idle");
      setActiveSequenceTile(tileId);
      window.setTimeout(() => {
        setActiveSequenceTile(null);
      }, 220);
      const nextProgress = currentProgress + 1;
      sequenceProgressRef.current = nextProgress;
      setSequenceProgress(nextProgress);
      if (nextProgress < expectedSequence.length) {
        speakCompanion("sequenceGood", `${plan.variantId}-${nextProgress}`);
      }
      return;
    }

    setSequenceTotalMistakes((current) => current + 1);
    speakCompanion("sequenceWrong", `${plan.variantId}-${currentProgress}-${tileId}`);
    setSequenceStatus("wrong");
    setSequenceReady(false);
    setSequencePhase("countdown");
    setSequenceCountdown(3);
    setSequenceProgress(0);
    sequenceProgressRef.current = 0;
    setSequencePreviewStep(0);
    setActiveSequenceTile(tileId);
    window.setTimeout(() => {
      setActiveSequenceTile(null);
      lastSequenceTapRef.current = null;
      setSequenceRun((current) => current + 1);
    }, 700);
  };

  const onWordRecallChipToggle = (word: string) => {
    setWordRecallMessage(null);
    setWordRecallVoiceMessage(null);
    setWordRecallSelectedWords((current) =>
      current.some((entry) => wordsMatch(entry, word))
        ? current.filter((entry) => !wordsMatch(entry, word))
        : dedupeWords([...current, word]),
    );
  };

  const addTypedRecallWords = () => {
    const newWords = splitRecallText(wordRecallInput);
    if (newWords.length === 0) return;
    setWordRecallTypedWords((current) => dedupeWords([...current, ...newWords]));
    setWordRecallInput("");
    setWordRecallMessage(null);
  };

  const finishWordRecall = () => {
    stopWordRecallAudio();
    const pendingWords = splitRecallText(wordRecallInput);
    const rememberedWords = dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords, ...pendingWords]);
    const correctWords = wordRecallWords.filter((targetWord) =>
      rememberedWords.some((candidate) => wordsMatch(candidate, targetWord)),
    );
    const wrongWords = rememberedWords.filter(
      (candidate) => !wordRecallWords.some((targetWord) => wordsMatch(candidate, targetWord)),
    );
    const missedWords = wordRecallWords.filter(
      (targetWord) => !rememberedWords.some((candidate) => wordsMatch(candidate, targetWord)),
    );
    const accuracy = Math.round((correctWords.length / Math.max(1, wordRecallWords.length)) * 100);
    const score = Math.round((correctWords.length / Math.max(1, wordRecallWords.length)) * 100);
    const nextDurationSeconds = getDurationSeconds(startedAt);

    setCompletionDetails({
      rememberedWords,
      correctWords,
      missedWords,
    });
    setCompletionMetrics({
      score,
      accuracy,
      mistakes: wrongWords.length,
      durationSeconds: nextDurationSeconds,
    });
  };

  const continueWordRecall = () => {
    stopWordRecallAudio();
    setWordRecallMessage(null);
    if (plan.level >= 4 && wordRecallDistractionType) {
      setWordRecallPhase("distraction");
      return;
    }
    setWordRecallPhase("recall");
    speakCompanion("recall", `${plan.variantId}-direct`);
  };

  const completeWordRecallDistraction = () => {
    stopWordRecallAudio();
    setWordRecallMessage(null);
    setWordRecallPhase("recall");
    speakCompanion("recall", `${plan.variantId}-distraction`);
  };

  const startWordRecallVoice = () => {
    setWordRecallVoiceMessage(null);
    if (!wordRecallVoiceSupported) {
      setWordRecallVoiceMessage(t("wordRecall.voiceNotSupported"));
      return;
    }
    const started = startWordRecallListening();
    if (!started) {
      setWordRecallVoiceMessage(t("wordRecall.voiceNotSupported"));
    }
  };

  const toggleMemoryAudio = () => {
    setIsMemoryAudioMuted((current) => {
      const next = !current;
      if (!next) {
        wordRecallNarrationKeyRef.current = "";
      }
      return next;
    });
  };

  const onWordRecallBlueChoice = (choice: "blue" | "other") => {
    if (choice === "blue") {
      completeWordRecallDistraction();
      return;
    }
    setWordRecallMessage(t("wordRecall.tryAgain"));
  };

  const continueNumberMemory = () => {
    setStartedAt(Date.now());
    setNumberMemoryPhase("recall");
  };

  const finishNumberMemory = () => {
    const givenAnswer = numberMemoryInput.trim();
    const accuracy = getNumberRecallScore(numberMemoryTarget, givenAnswer);
    const nextDurationSeconds = getDurationSeconds(startedAt);
    setCompletionDetails({
      expectedAnswer: numberMemoryTarget,
      givenAnswer: givenAnswer || t("memory.noAnswerGiven", "No answer given"),
    });
    setCompletionMetrics({
      score: getScore(plan.level, accuracy, accuracy === 100 ? 0 : 1, nextDurationSeconds),
      accuracy,
      mistakes: accuracy === 100 ? 0 : 1,
      durationSeconds: nextDurationSeconds,
    });
  };

  const continueAssociationMemory = () => {
    setStartedAt(Date.now());
    setAssociationPhase("recall");
  };

  const finishAssociationMemory = (choice: string) => {
    if (!associationPrompt) return;
    const correct = choice === associationPrompt.answer;
    const accuracy = correct ? 100 : 0;
    const nextDurationSeconds = getDurationSeconds(startedAt);
    setAssociationChoice(choice);
    setCompletionDetails({
      cueLabel: `${associationPrompt.cueLabel}: ${associationPrompt.cueValue}`,
      expectedAnswer: associationPrompt.answer,
      givenAnswer: choice,
    });
    setCompletionMetrics({
      score: getScore(plan.level, accuracy, correct ? 0 : 1, nextDurationSeconds),
      accuracy,
      mistakes: correct ? 0 : 1,
      durationSeconds: nextDurationSeconds,
    });
  };

  if (plan.gameType === "number_memory") {
    return renderBrainRunnerScreen(`number_memory_${numberMemoryPhase}`, "playing", `number_memory_${numberMemoryPhase}`, (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2">
        <button
          onClick={backToList}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-[14px] font-semibold text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={17} />
          {t("common.back")}
        </button>

        <section className="mt-3 overflow-hidden rounded-[24px] border border-[#BFDBFE] bg-[#F3F8FF] p-4 shadow-vyva-card sm:rounded-[28px] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-[#2563EB] shadow-sm">
                {currentLevelLabel}
              </p>
              <h1 className="mt-3 font-display text-[32px] leading-tight text-vyva-text-1 sm:text-[38px]">{gameTitle}</h1>
              <p className="mt-2 max-w-[34ch] text-[17px] font-semibold leading-[1.45] text-vyva-text-2 sm:text-[19px]">
                {numberMemoryPhase === "study"
                  ? t("memory.numberStudyGoal", "Study the digits, then hide them.")
                  : localizedVariant.payload.reverse
                    ? t("memory.numberRecallReverseGoal", "Enter the digits backwards.")
                    : t("memory.numberRecallGoal", "Enter the digits in the same order.")}
              </p>
            </div>
            <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[22px] bg-white text-[#2563EB] shadow-vyva-card">
              <Hash size={32} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-vyva-text-1 shadow-sm">
              {localizedVariant.payload.reverse ? t("memory.reverseOrder", "Reverse order") : t("memory.sameOrder", "Same order")}
            </span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-vyva-text-1 shadow-sm">
              {`${numberMemoryDigits.length} ${t("memory.digits", "digits")}`}
            </span>
          </div>

          {numberMemoryPhase === "study" ? (
            <>
              <div className="mx-auto mt-5 max-w-[560px] rounded-[22px] border border-[#BFDBFE] bg-white px-5 py-8 shadow-sm">
                <p className="text-[15px] font-black uppercase tracking-[0.06em] text-vyva-text-2">{t("memory.rememberThis", "Remember this")}</p>
                <p className="mt-3 font-mono text-[42px] font-black tracking-[0.14em] text-vyva-text-1 sm:text-[58px]">{numberMemoryDigits}</p>
              </div>
              <button
                type="button"
                onClick={continueNumberMemory}
                className="mt-5 min-h-[62px] w-full rounded-full bg-vyva-purple px-6 text-[22px] font-black text-white shadow-vyva-card"
              >
                {t("memory.hideDigits", "Hide digits")}
              </button>
            </>
          ) : (
            <form
              className="mx-auto mt-5 max-w-[560px]"
              onSubmit={(event) => {
                event.preventDefault();
                finishNumberMemory();
              }}
            >
              <label className="block text-left text-[15px] font-black uppercase tracking-[0.06em] text-vyva-text-2" htmlFor="number-memory-answer">
                {localizedVariant.payload.reverse
                  ? t("memory.typeReverseDigits", "Type the digits in reverse")
                  : t("memory.typeDigits", "Type the digits")}
              </label>
              <div className="mt-3 flex min-h-[70px] items-center gap-3 rounded-[22px] border border-[#BFDBFE] bg-white px-4 shadow-sm">
                <Type size={24} className="shrink-0 text-[#2563EB]" />
                <input
                  id="number-memory-answer"
                  value={numberMemoryInput}
                  onChange={(event) => setNumberMemoryInput(event.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent font-mono text-[32px] font-black tracking-[0.12em] text-vyva-text-1 outline-none"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="mt-5 inline-flex min-h-[62px] w-full items-center justify-center gap-3 rounded-full bg-vyva-purple px-6 text-[22px] font-black text-white shadow-vyva-card"
              >
                <Check size={24} />
                {t("memory.checkAnswer", "Check answer")}
              </button>
            </form>
          )}
        </section>
      </div>
    ));
  }

  if (plan.gameType === "association_memory" && associationPrompt) {
    return renderBrainRunnerScreen(`association_memory_${associationPhase}`, "playing", `association_memory_${associationPhase}`, (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2">
        <button
          onClick={backToList}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-[14px] font-semibold text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={17} />
          {t("common.back")}
        </button>

        <section className="mt-3 overflow-hidden rounded-[24px] border border-[#F8C4D0] bg-[#FFF8FA] p-4 shadow-vyva-card sm:rounded-[28px] sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="inline-flex rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-[#BE185D] shadow-sm">
                {currentLevelLabel}
              </p>
              <h1 className="mt-3 font-display text-[32px] leading-tight text-vyva-text-1 sm:text-[38px]">{gameTitle}</h1>
              <p className="mt-2 max-w-[34ch] text-[17px] font-semibold leading-[1.45] text-vyva-text-2 sm:text-[19px]">
                {associationPhase === "study" ? t("memory.associationStudyGoal", "Remember one link.") : t("memory.associationRecallGoal", "Choose what belongs with the cue.")}
              </p>
            </div>
            <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-[22px] bg-white text-[#BE185D] shadow-vyva-card">
              <Link2 size={32} />
            </div>
          </div>

          {associationPhase === "study" ? (
            <>
              <div className="mx-auto mt-5 max-w-[620px] rounded-[24px] border border-[#F8C4D0] bg-white p-4 shadow-sm sm:p-5">
                <p className="text-[14px] font-black uppercase tracking-[0.06em] text-vyva-text-2">{t("memory.studyLink", "Study this link")}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                  <div className="flex min-h-[124px] flex-col justify-center rounded-[20px] bg-[#FFF1F2] px-5 py-4">
                    <p className="text-[13px] font-black uppercase tracking-[0.06em] text-[#9F1239]">{associationPrompt.cueLabel}</p>
                    <p className="mt-2 text-[29px] font-black leading-tight text-vyva-text-1">{associationPrompt.cueValue}</p>
                  </div>
                  <div className="grid min-h-14 place-items-center text-[38px] font-black text-[#BE185D]">
                    {associationPrompt.icon || "+"}
                  </div>
                  <div className="flex min-h-[124px] flex-col justify-center rounded-[20px] bg-[#FFF7ED] px-5 py-4">
                    <p className="text-[13px] font-black uppercase tracking-[0.06em] text-[#9A3412]">{t("memory.rememberAnswer", "Remember")}</p>
                    <p className="mt-2 text-[29px] font-black leading-tight text-vyva-text-1">{associationPrompt.answer}</p>
                  </div>
                </div>
                <p className="mt-4 text-[15px] font-semibold leading-snug text-vyva-text-2">
                  {t("memory.associationNoRush", "Take a moment, then hide the answer.")}
                </p>
              </div>
              <button
                type="button"
                onClick={continueAssociationMemory}
                className="mt-5 min-h-[62px] w-full rounded-full bg-vyva-purple px-6 text-[22px] font-black text-white shadow-vyva-card"
              >
                {t("memory.readyToChoose", "Ready to choose")}
              </button>
            </>
          ) : (
            <div className="mx-auto mt-5 max-w-[620px]">
              <div className="rounded-[22px] border border-[#F8C4D0] bg-white px-5 py-5 shadow-sm">
                <p className="text-[15px] font-black uppercase tracking-[0.06em] text-vyva-text-2">{t("memory.whatMatches", "What matches this?")}</p>
                <p className="mt-2 text-[30px] font-black leading-tight text-vyva-text-1">{associationPrompt.cueValue}</p>
              </div>
              <div className={`mt-3 grid gap-3 ${associationOptions.length > 2 ? "sm:grid-cols-2" : ""}`}>
                {associationOptions.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => finishAssociationMemory(choice)}
                    className="min-h-[84px] rounded-[20px] border border-[#F8C4D0] bg-white px-4 text-[22px] font-black leading-tight text-vyva-text-1 shadow-sm transition active:scale-[0.99]"
                    aria-pressed={associationChoice === choice}
                    data-testid="association-choice"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    ));
  }

  if (plan.gameType === "word_recall") {
    const rememberedCount = dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords]).length;

    return renderBrainRunnerScreen(`word_recall_${wordRecallPhase}`, "playing", `word_recall_${wordRecallPhase}`, (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2">
        <button
          onClick={backToList}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-[14px] font-semibold text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={17} />
          {t("common.back")}
        </button>

        <section className="mt-3 overflow-hidden rounded-[22px] border border-[#EFE7DB] bg-[#FFF9F1] p-4 shadow-vyva-card sm:rounded-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-vyva-purple shadow-sm sm:text-[12px]">
                <NotebookPen size={14} />
                <span>{wordRecallPhase === "memorize" ? t("wordRecall.memorizeLabel", "Remember words") : t("wordRecall.recall", "Recall")}</span>
              </div>
              <h1 className="mt-3 font-display text-[28px] leading-[1.02] text-vyva-text-1 sm:text-[30px]">{gameTitle}</h1>
              <p className="mt-2 max-w-[28ch] text-[14px] font-semibold leading-[1.45] text-vyva-text-2 sm:text-[15px]">
                {wordRecallPhase === "memorize"
                  ? t("wordRecall.studyHint", "Study the words. Hide them when you are ready.")
                  : wordRecallPhase === "distraction"
                    ? t("wordRecall.distractionInstruction", "Take a short pause before recalling the words.")
                    : t("wordRecall.recallInstruction", "Recall as many words as you can.")}
              </p>
            </div>
            <div className="flex h-[64px] w-[64px] flex-shrink-0 items-center justify-center rounded-[20px] bg-white shadow-vyva-card sm:h-[76px] sm:w-[76px] sm:rounded-[22px]">
              <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[16px] sm:h-[54px] sm:w-[54px]" style={gameIconStyle}>
                <GameIcon size={24} />
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-vyva-text-1 shadow-sm">{currentLevelLabel}</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-black text-vyva-text-1 shadow-sm">
              {wordRecallPhase === "recall"
                ? `${t("wordRecall.remembered")} ${rememberedCount}/${wordRecallWords.length}`
                : `${wordRecallWords.length} ${t("memory.words", "words")}`}
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <MemoryAudioToggle isMuted={isMemoryAudioMuted} onToggle={toggleMemoryAudio} copy={companionCopy} />
          </div>

          {voiceGameContextPanel}

          {wordRecallPhase === "memorize" && (
            <>
              <div className="relative z-10 mt-3 rounded-[18px] border border-[#EADFF8] bg-white p-4">
                <p className="text-[16px] font-semibold leading-snug text-vyva-text-1">
                  {t("wordRecall.studyListHint", "Read each word once or twice. No rush.")}
                </p>
                {wordRecallMessage && (
                  <div className="mt-3 rounded-[16px] border border-[#D8C7F3] bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                    {wordRecallMessage}
                  </div>
                )}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {wordRecallWords.map((word, index) => (
                  <div
                    key={word}
                    className="rounded-[18px] border border-white/70 px-4 py-4 text-center shadow-vyva-card sm:rounded-[22px] sm:py-6"
                    style={{
                      background: index % 2 === 0 ? "#FFFFFF" : "#FAF7FF",
                    }}
                  >
                    <span className="text-[24px] font-semibold leading-tight text-vyva-text-1 sm:text-[28px]">{word}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={continueWordRecall}
                className="mt-4 min-h-[56px] w-full rounded-[18px] bg-vyva-purple px-5 text-[18px] font-semibold text-white shadow-vyva-card sm:rounded-[22px] sm:text-[20px]"
              >
                {t("wordRecall.hideWords", "Hide words")}
              </button>
            </>
          )}

          {wordRecallPhase === "distraction" && (
            <div className="mt-4 rounded-[20px] border border-vyva-border bg-[#FFF7ED] p-4 sm:p-5">
              <p className="text-[17px] font-semibold text-vyva-text-1">{t("wordRecall.distractionTitle")}</p>
              <p className="mt-2 text-[15px] leading-[1.5] text-vyva-text-2">
                {wordRecallDistractionType === "choose_blue"
                  ? t("wordRecall.distractionChooseBlue")
                  : wordRecallDistractionType === "breathe_continue"
                    ? t("wordRecall.distractionBreathe")
                    : t("wordRecall.distractionCountBackwards")}
              </p>
              {wordRecallDistractionType === "choose_blue" ? (
                <div className="mt-4 grid grid-cols-3 gap-3">
                  {[
                    { key: "other", color: "#F97316" },
                    { key: "blue", color: "#2563EB" },
                    { key: "other-2", color: "#16A34A" },
                  ].map((choice) => (
                    <button
                      key={choice.key}
                      onClick={() => onWordRecallBlueChoice(choice.key === "blue" ? "blue" : "other")}
                      className="min-h-[72px] rounded-[18px] shadow-vyva-card sm:min-h-[86px] sm:rounded-[20px]"
                      style={{ background: choice.color }}
                    />
                  ))}
                </div>
              ) : (
                <button
                  onClick={completeWordRecallDistraction}
                  className="mt-4 min-h-[54px] w-full rounded-[18px] bg-vyva-purple px-5 text-[17px] font-semibold text-white shadow-vyva-card sm:rounded-[20px] sm:text-[18px]"
                >
                  {t("wordRecall.continueButton")}
                </button>
              )}

              {wordRecallMessage && (
                <div className="mt-3 rounded-[16px] border border-[#F3E0BD] bg-white px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                  {wordRecallMessage}
                </div>
              )}
            </div>
          )}

          {wordRecallPhase === "recall" && (
            <>
              <div className="mt-4 rounded-[18px] border border-vyva-border bg-vyva-purple-light p-4 sm:p-5">
                <p className="text-[17px] font-semibold text-vyva-text-1">{t("wordRecall.recallInstruction")}</p>
                <p className="mt-2 text-[15px] leading-[1.5] text-vyva-text-2">{t("wordRecall.selectRememberedWords")}</p>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                <button
                  onClick={startWordRecallVoice}
                  disabled={wordRecallListening}
                  className="flex w-full items-center justify-between rounded-[20px] bg-vyva-purple px-4 py-4 text-left text-white shadow-vyva-card sm:px-5 sm:py-5"
                >
                  <div>
                    <p className="text-[18px] font-semibold sm:text-[20px]">{t("wordRecall.speakWords")}</p>
                    <p className="mt-1 text-[15px] text-white/85">
                      {wordRecallListening ? t("wordRecall.listening") : t("wordRecall.speakWordsHint", "Tap to speak remembered words.")}
                    </p>
                  </div>
                  <Mic size={24} />
                </button>

                {!wordRecallVoiceSupported && (
                  <div className="rounded-[16px] border border-vyva-border bg-white px-4 py-3 text-[15px] text-vyva-text-2">
                    {t("wordRecall.voiceNotSupported")}
                  </div>
                )}

                {wordRecallVoiceMessage && (
                  <div className="rounded-[16px] border border-[#D8C7F3] bg-[#FAF7FF] px-4 py-3 text-[15px] font-medium text-vyva-text-1">
                    {wordRecallVoiceMessage}
                  </div>
                )}

                <div className="rounded-[18px] border border-vyva-border bg-white p-4 shadow-vyva-card sm:rounded-[20px]">
                  <div className="flex items-center gap-2 text-vyva-text-1">
                    <Type size={18} />
                    <span className="text-[16px] font-semibold">{t("wordRecall.remembered")}</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={wordRecallInput}
                      onChange={(event) => setWordRecallInput(event.target.value)}
                      placeholder={t("wordRecall.typeWordsPlaceholder")}
                      className="min-h-[56px] flex-1 rounded-[16px] border border-vyva-border px-4 text-[17px] text-vyva-text-1 outline-none"
                    />
                    <button
                      onClick={addTypedRecallWords}
                      className="min-h-[52px] rounded-[16px] border border-[#D8C7F3] bg-[#FAF7FF] px-5 text-[16px] font-semibold text-vyva-purple"
                    >
                      {t("wordRecall.addWord")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2.5">
                {wordRecallChoiceWords.map((word) => {
                  const selected = wordRecallSelectedWords.some((entry) => wordsMatch(entry, word));
                  return (
                    <button
                      key={word}
                      onClick={() => onWordRecallChipToggle(word)}
                      className="rounded-full border px-4 py-2.5 text-[16px] font-medium shadow-sm transition-all"
                      style={{
                        background: selected ? "#6B21A8" : "#FFFFFF",
                        color: selected ? "#FFFFFF" : "#2B2233",
                        borderColor: selected ? "#6B21A8" : "#D8C7F3",
                      }}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>

              {(wordRecallSelectedWords.length > 0 || wordRecallTypedWords.length > 0) && (
                <div className="mt-5 rounded-[20px] border border-vyva-border bg-[#F8FAFC] p-4">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-vyva-text-2">{t("wordRecall.remembered")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dedupeWords([...wordRecallSelectedWords, ...wordRecallTypedWords]).map((word) => (
                      <span key={`selected-${word}`} className="rounded-full bg-white px-3 py-2 text-[15px] font-medium text-vyva-text-1 shadow-sm">
                        {word}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={finishWordRecall}
                disabled={saving}
                className="mt-4 min-h-[56px] w-full rounded-[18px] bg-vyva-purple px-5 text-[18px] font-semibold text-white shadow-vyva-card disabled:opacity-60 sm:rounded-[22px] sm:text-[20px]"
              >
                {t("wordRecall.continueButton")}
              </button>
            </>
          )}
        </section>
      </div>
    ));
  }

  if (plan.gameType === "sequence_memory") {
    const reverseMode = Boolean(localizedVariant.payload.reverse);
    const sequenceInstruction =
      sequencePhase === "countdown"
        ? `${t("memory.sequenceCountdown")} ${sequenceCountdown}...`
        : sequencePhase === "watching"
        ? t("memory.sequenceWatch")
        : reverseMode
          ? t("memory.sequenceReverse")
          : t("memory.sequenceRepeatShort", "Your turn");
    const sequenceSupportText =
      sequenceStatus === "wait"
        ? t("memory.sequenceWaitTurnHint")
        : sequenceStatus === "wrong"
        ? t("memory.sequenceTryAgain")
        : sequencePhase === "countdown"
          ? t("memory.sequenceCountdownHint")
          : sequencePhase === "watching"
            ? t("memory.sequenceReady")
            : t("memory.sequenceTapHintShort", "Tap the order. No time pressure.");
    const currentStepIndex = Math.min(sequenceProgress + 1, expectedSequence.length);

    return renderBrainRunnerScreen(`sequence_${sequencePhase}`, "playing", "sequence_grid", (
      <div className="mx-auto w-full max-w-[760px] px-4 pb-4 pt-2">
        <button
          onClick={backToList}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-[14px] font-semibold text-vyva-text-1 shadow-vyva-card"
        >
          <ArrowLeft size={17} />
          {t("common.back")}
        </button>

        <section className="mt-3 overflow-hidden rounded-[22px] border border-[#EFE7DB] bg-[#FFF9F1] p-4 shadow-vyva-card sm:rounded-[26px] sm:p-5">
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-vyva-purple shadow-sm sm:text-[12px]">
                <Route size={14} />
                {t("memory.sequenceWatchShort", "Watch order")}
              </div>
              <h1 className="mt-3 font-display text-[28px] leading-[1.02] text-vyva-text-1 sm:text-[30px]">{gameTitle}</h1>
              <p className="mt-2 max-w-[28ch] text-[14px] leading-[1.45] text-vyva-text-2 sm:text-[15px]">{gamePrompt}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {sequenceTutorialSeen ? (
                <button
                  type="button"
                  onClick={openSequenceInstructions}
                  aria-label={t("memory.instructions", "Instructions")}
                  title={t("memory.instructions", "Instructions")}
                  className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-white text-vyva-purple shadow-vyva-card sm:h-[56px] sm:w-[56px]"
                >
                  <CircleHelp size={23} aria-hidden="true" />
                </button>
              ) : null}
              <div className="flex h-[64px] w-[64px] items-center justify-center rounded-[20px] bg-white shadow-vyva-card sm:h-[76px] sm:w-[76px] sm:rounded-[22px]">
                <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[16px] sm:h-[54px] sm:w-[54px]" style={gameIconStyle}>
                  <GameIcon size={24} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-vyva-text-1 shadow-sm">{`${t("common.level")} ${plan.level}`}</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-vyva-text-1 shadow-sm">{`${sequenceProgress}/${expectedSequence.length}`}</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-vyva-text-1 shadow-sm">{`${t("memory.mistakes")} ${sequenceTotalMistakes}`}</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-medium text-vyva-text-1 shadow-sm">{`${durationSeconds}s`}</span>
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <MemoryAudioToggle isMuted={isMemoryAudioMuted} onToggle={toggleMemoryAudio} copy={companionCopy} />
          </div>

          {voiceGameContextPanel}

          <div className="mt-3 rounded-[18px] border border-[#EADFF8] bg-white p-4 sm:rounded-[22px]">
            <p className="text-[17px] font-semibold leading-snug text-vyva-text-1 sm:text-[18px]">{sequenceInstruction}</p>
            <p className="mt-1.5 text-[14px] leading-[1.45] text-vyva-text-2 sm:text-[15px]">{sequenceSupportText}</p>
            {sequenceStatus === "wrong" && (
              <div className="mt-3 rounded-[16px] border border-[#F3C6CE] bg-[#FFF2F4] px-4 py-3 text-[15px] font-medium text-[#9F1239]">
                {t("memory.sequenceWrong")}
              </div>
            )}
            {sequenceStatus === "wait" && (
              <div className="mt-3 rounded-[16px] border border-[#CFE0FF] bg-[#EFF6FF] px-4 py-3 text-[15px] font-medium text-[#1D4ED8]">
                {t("memory.sequenceWaitTurn")}
              </div>
            )}
            {sequenceReady && (
              <button
                onClick={replaySequence}
                className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#D8C7F3] bg-white px-4 py-2.5 text-[14px] font-semibold text-vyva-purple shadow-vyva-card sm:text-[15px]"
              >
                <RotateCcw size={16} />
                {t("memory.sequenceWatchAgain")}
              </button>
            )}
          </div>

          <div className="mt-3 rounded-[18px] border border-[#EADFF8] bg-[#FFFCF8] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:rounded-[20px] sm:p-4">
            <div className="flex flex-wrap gap-2">
              {sequencePhase === "input"
                ? expectedSequencePositions.map((tileIndex, index) => {
                    const isDone = index < sequenceProgress;
                    const isCurrent = index === sequenceProgress;
                    return (
                      <div
                        key={`progress-${index}`}
                        className="flex h-[40px] min-w-[40px] items-center justify-center rounded-full border text-[14px] font-semibold sm:h-[44px] sm:min-w-[44px] sm:text-[15px]"
                        style={{
                          background: isDone ? "#6B21A8" : isCurrent ? "#F3E8FF" : "#FAF7FF",
                          color: isDone ? "#FFFFFF" : "#5B4B71",
                          borderColor: isDone ? "#6B21A8" : "#D8C7F3",
                        }}
                      >
                        {tileIndex + 1}
                      </div>
                    );
                  })
                : previewSequencePositions.map((tileIndex, index) => {
                    const tile = sequenceTiles[tileIndex];
                    const revealed = index < sequencePreviewStep && tile;
                    return (
                      <div
                        key={`preview-${index}`}
                        className="flex h-[42px] min-w-[42px] items-center justify-center rounded-[14px] border text-[19px] shadow-sm sm:h-[50px] sm:min-w-[50px] sm:rounded-[16px] sm:text-[22px]"
                        style={{
                          background: revealed ? tile.color : "#FAF7FF",
                          color: revealed ? "#FFFFFF" : "#7C6D94",
                          borderColor: revealed ? tile.color : "#D8C7F3",
                          transform: revealed && index + 1 === sequencePreviewStep ? "translateY(-2px) scale(1.02)" : "none",
                        }}
                      >
                        {tileIndex + 1}
                      </div>
                    );
                  })}
            </div>
            <p className="mt-2 text-[13px] font-medium text-vyva-text-2 sm:text-[14px]">
              {sequencePhase === "input" ? `${currentStepIndex}/${expectedSequence.length}` : `${sequencePreviewStep}/${previewSequencePositions.length}`}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:mt-5 sm:gap-4">
            {sequenceTileRows.map((row, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-2 gap-3 sm:gap-4">
                {row.map((tile, columnIndex) => {
                  const index = rowIndex * 2 + columnIndex;
                  const isActive = activeSequenceTile === tile.id;
                  const isWatching = sequencePhase === "watching";
                  const shouldDim = isWatching && !isActive;
                  return (
                    <button
                      key={tile.id}
                      onClick={() => onSequenceTileClick(tile.id, index)}
                      aria-disabled={!sequenceReady}
                      className="min-h-[112px] rounded-[20px] border border-vyva-border px-4 py-4 text-white shadow-vyva-card transition-transform sm:min-h-[148px] sm:rounded-[24px] sm:py-5"
                      style={{
                        background: isActive ? "#111827" : tile.color,
                        transform: isActive ? "scale(1.02)" : shouldDim ? "scale(0.98)" : "scale(1)",
                        opacity: sequenceReady ? 1 : shouldDim ? 0.5 : 0.82,
                        borderColor: isActive ? "#FFFFFF" : "#E9DDF8",
                        boxShadow: isActive ? "0 0 0 6px rgba(255,255,255,0.88), 0 18px 36px rgba(17,24,39,0.25)" : undefined,
                      }}
                    >
                      <div className="flex h-full flex-col items-center justify-center">
                        <span className="mb-2 inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-white/18 px-2 text-[12px] font-semibold text-white sm:mb-3 sm:h-[28px] sm:min-w-[28px] sm:text-[13px]">
                          {index + 1}
                        </span>
                        <span className="text-[34px] leading-none sm:text-[42px]">{tile.emoji}</span>
                        {isWatching && isActive && (
                          <span className="mt-2 rounded-full bg-white/18 px-3 py-1 text-[14px] font-semibold text-white sm:mt-3 sm:text-[15px]">
                            {index + 1}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

        </section>
      </div>
    ));
  }

  const matchedPairs = matchedIds.length / 2;
  const totalPairs = memoryDeck.length / 2;
  const nextPlayableLevel = getNextPlayableLevel();
  const canOpenNextLevel = nextPlayableLevel > plan.level && (completionMetrics?.accuracy ?? memoryAccuracy) >= 80;
  const nextLevelLabel = t("brainGames.resultActions.continueToLevel").replace("{level}", String(nextPlayableLevel));
  const memoryGridClassName =
    memoryDeck.length <= 4
      ? "grid-cols-2 max-w-[540px] sm:max-w-[620px]"
      : memoryDeck.length <= 6
        ? "grid-cols-3 max-w-[620px] sm:max-w-[680px]"
        : "grid-cols-4 max-w-[760px] sm:max-w-[860px]";
  const memoryCardHeight =
    memoryComplete
      ? "clamp(108px, 16dvh, 132px)"
      : memoryDeck.length <= 4
        ? "clamp(118px, 19dvh, 152px)"
        : memoryDeck.length <= 6
          ? "clamp(100px, 15dvh, 136px)"
          : "clamp(88px, 13dvh, 124px)";
  const memoryStats = [
    getBrainCoachProgressLabel(plan.level),
    `${matchedPairs}/${totalPairs} ${t("memory.pairs")}`,
    `${memoryAccuracy}%`,
    `${durationSeconds}s`,
  ];

  if (memoryComplete) {
    return renderBrainRunnerScreen(
      "result",
      "completion",
      "modal_actions",
      (
        <div className="min-h-[100dvh] bg-[#FFF9F1]">
          <BrainGameCompletionDialog
            title={t("memory.wellDone")}
            summary={
              completionMetrics
                ? `${getBrainCoachSupportiveProgressCopy({ advanced: canOpenNextLevel, level: plan.level })}`
                : t("memory.exerciseCompleted")
            }
            metrics={[
              { label: t("memory.score"), value: completionMetrics?.score ?? "-" },
              { label: t("memory.accuracy"), value: completionMetrics ? `${completionMetrics.accuracy}%` : "-" },
            ]}
            continueLabel={t("brainGames.resultActions.continue")}
            nextLevelLabel={canOpenNextLevel ? nextLevelLabel : undefined}
            nextLevelDisplayLabel={canOpenNextLevel ? getBrainCoachProgressLabel(nextPlayableLevel) : undefined}
            replayLabel={t("brainGames.resultActions.playAgain")}
            anotherLabel={t("brainGames.resultActions.moreGames", "More games")}
            assessmentReturnLabel={assessmentPractice ? t("brainGames.resultActions.backToResults", "Back to my results") : undefined}
            assessmentReturnHint={
              assessmentPractice
                ? t("brainGames.resultActions.assessmentPracticeComplete", "Good. You practiced the area VYVA noticed.")
                : undefined
            }
            onContinue={openRecommended}
            onNextLevel={canOpenNextLevel ? () => void openNextLevel() : undefined}
            onReplay={() => void openSameGame()}
            onAnother={backToList}
            onAssessmentReturn={assessmentPractice ? returnToAssessment : undefined}
            disabled={actionLoading !== null}
            details={
              <div className="rounded-[18px] border border-[#EADFF8] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3 text-[15px] font-black text-vyva-text-1">
                  <span>{t("memory.pairs")}</span>
                  <span>{matchedPairs}/{totalPairs}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EDE6F4]">
                  <div className="h-full rounded-full bg-vyva-purple" style={{ width: `${(matchedPairs / Math.max(1, totalPairs)) * 100}%` }} />
                </div>
              </div>
            }
          />
        </div>
      ),
      "complete",
    );
  }

  return renderBrainRunnerScreen(
    "playing",
    "playing",
    "card_grid",
    (
    <div className="mx-auto w-full max-w-[1120px] px-3 pb-3 sm:px-4 sm:pb-4">
      <section className="mt-2 overflow-hidden rounded-[20px] border border-[#EFE7DB] bg-[#FFF9F1] p-4 shadow-vyva-card sm:rounded-[24px] sm:p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
          <button
            onClick={backToList}
            aria-label={t("common.back")}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#EADFD5] bg-white/95 px-3 text-[14px] font-semibold text-vyva-text-1 shadow-sm"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">{t("common.back")}</span>
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] border border-[#EEE5FA] bg-white shadow-sm" style={gameIconStyle}>
                <GameIcon size={19} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate font-display text-[23px] leading-none text-vyva-text-1 sm:text-[30px]">{gameTitle}</h1>
                <p className="mt-1 hidden truncate text-[13px] font-semibold text-vyva-text-2 sm:block">{t("memory.matchInstruction")}</p>
              </div>
            </div>
          </div>

          <div className="hidden min-w-[390px] grid-cols-4 overflow-hidden rounded-full border border-[#E7DCEB] bg-white/95 shadow-sm sm:grid">
            {memoryStats.map((item, index) => (
              <span
                key={`desktop-${item}`}
                className={`flex min-h-8 items-center justify-center px-3 text-center text-[12px] font-semibold leading-none text-vyva-text-1 ${
                  index === 0 ? "" : "border-l border-[#EFE7DB]"
                }`}
              >
                {item}
              </span>
            ))}
          </div>

          <MemoryAudioToggle isMuted={isMemoryAudioMuted} onToggle={toggleMemoryAudio} copy={companionCopy} />
        </div>

        <div className="mt-3 grid gap-2 sm:hidden">
          <div className="min-w-0 rounded-full border border-[#EADFF8] bg-white/95 px-3 py-2 text-[12px] font-semibold leading-none text-vyva-text-1 shadow-sm sm:hidden">
            <span className="block truncate">{t("memory.matchInstruction")}</span>
          </div>
          <div className="grid grid-cols-4 overflow-hidden rounded-full border border-[#E7DCEB] bg-white/95 shadow-sm">
            {memoryStats.map((item, index) => (
              <span
                key={`mobile-${item}`}
                className={`flex min-h-8 items-center justify-center px-2 text-center text-[11px] font-semibold leading-none text-vyva-text-1 sm:px-3 sm:text-[12px] ${
                  index === 0 ? "" : "border-l border-[#EFE7DB]"
                }`}
              >
                {item}
              </span>
            ))}
          </div>
        </div>

        {voiceGameContextPanel}

        <div className={`mx-auto mt-4 grid w-full gap-2 sm:mt-5 sm:gap-3 ${memoryGridClassName}`}>
          {memoryDeck.map((card) => {
            const isOpen = revealed.includes(card.deckId) || matchedIds.includes(card.deckId);
            return (
              <button
                key={card.deckId}
                onClick={() => onMemoryCardClick(card)}
                className="rounded-[16px] border border-vyva-border p-2 text-center shadow-vyva-card transition-all sm:rounded-[20px] sm:p-3"
                style={
                  isOpen
                    ? { height: memoryCardHeight, background: "#FFFFFF", borderColor: "#C4B5FD", transform: "translateY(-1px)" }
                    : { height: memoryCardHeight, background: "linear-gradient(145deg, #6B21A8 0%, #8B3FC8 100%)", color: "#FFFFFF" }
                }
              >
                <div className="flex h-full flex-col items-center justify-center">
                  {isOpen ? (
                    <>
                      <span className="text-[28px] leading-none sm:text-[36px]">{card.emoji}</span>
                      <span className="mt-1 text-[12px] font-semibold leading-tight text-vyva-text-1 [overflow-wrap:anywhere] sm:mt-2 sm:text-[17px]">{card.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[30px] font-semibold sm:text-[34px]">?</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

      </section>
    </div>
    ),
    "default",
  );
};

export default MemoryGameRunner;
