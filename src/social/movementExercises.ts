import chairYogaImage from "@/assets/senior-activities/chair-yoga.jpg";
import taiChiImage from "@/assets/senior-activities/tai-chi.jpg";
import seatedStrengthImage from "@/assets/senior-activities/seated-strength.jpg";
import calmBreathingImage from "@/assets/senior-activities/calm-breathing.jpg";
import sitToStandImage from "@/assets/senior-activities/sit-to-stand.jpg";
import heelRaisesImage from "@/assets/senior-activities/heel-raises.jpg";
import wallPushUpsImage from "@/assets/senior-activities/wall-push-ups.jpg";
import ankleMobilityImage from "@/assets/senior-activities/ankle-mobility.jpg";
import chestOpenerImage from "@/assets/senior-activities/chest-opener.jpg";
import sideStepsImage from "@/assets/senior-activities/side-steps.jpg";
import handBreathingImage from "@/assets/senior-activities/hand-breathing.jpg";
import shoulderReleaseImage from "@/assets/senior-activities/shoulder-release.jpg";

const MOVEMENT_STEP_IMAGE_MODULES = import.meta.glob("../assets/senior-activities/steps/**/*.jpg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function getMovementStepImage(exerciseId: MovementExerciseCardId, stepIndex: number, motion: MovementStepMotion) {
  const stepNumber = `${stepIndex + 1}`.padStart(2, "0");
  return MOVEMENT_STEP_IMAGE_MODULES[`../assets/senior-activities/steps/${exerciseId}/${stepNumber}-${motion}.jpg`];
}

export const MOVEMENT_EXERCISE_VISUALS: Record<MovementExerciseCardId, { image: string; accent: string; softBg: string; border: string }> = {
  "chair-yoga":      { image: chairYogaImage,      accent: "#6B21A8", softBg: "#F5F3FF", border: "#D8B4FE" },
  "tai-chi":         { image: taiChiImage,         accent: "#33691E", softBg: "#EEF8DF", border: "#CFE8B8" },
  "seated-strength": { image: seatedStrengthImage, accent: "#0F766E", softBg: "#F0FDFA", border: "#99F6E4" },
  "calm-breathing":  { image: calmBreathingImage,  accent: "#2F66D0", softBg: "#EFF6FF", border: "#BFDBFE" },
  "sit-to-stand":    { image: sitToStandImage,     accent: "#B45309", softBg: "#FFF7ED", border: "#FED7AA" },
  "heel-raises":     { image: heelRaisesImage,     accent: "#047857", softBg: "#ECFDF5", border: "#A7F3D0" },
  "wall-push-ups":   { image: wallPushUpsImage,    accent: "#BE185D", softBg: "#FFF1F2", border: "#FECDD3" },
  "ankle-mobility":  { image: ankleMobilityImage,  accent: "#0E7490", softBg: "#ECFEFF", border: "#A5F3FC" },
  "chest-opener":    { image: chestOpenerImage,    accent: "#7C3AED", softBg: "#F5F3FF", border: "#DDD6FE" },
  "side-steps":      { image: sideStepsImage,      accent: "#33691E", softBg: "#EEF8DF", border: "#CFE8B8" },
  "hand-breathing":  { image: handBreathingImage,  accent: "#2F66D0", softBg: "#EFF6FF", border: "#BFDBFE" },
  "shoulder-release": { image: shoulderReleaseImage, accent: "#9D174D", softBg: "#FDF2F8", border: "#FBCFE8" },
};

export type MovementExerciseCardId =
  | "chair-yoga"
  | "tai-chi"
  | "seated-strength"
  | "calm-breathing"
  | "sit-to-stand"
  | "heel-raises"
  | "wall-push-ups"
  | "ankle-mobility"
  | "chest-opener"
  | "side-steps"
  | "hand-breathing"
  | "shoulder-release";
export type MovementExerciseGroupId = "mobility" | "balance" | "strength" | "calm";
export type MovementExerciseCard = {
  id: MovementExerciseCardId;
  group: MovementExerciseGroupId;
  title: string;
  benefit: string;
  focus: string;
};
export type MovementExerciseGroupCopy = {
  id: MovementExerciseGroupId;
  title: string;
  subtitle: string;
};
export type MovementExerciseLogStatus = "idle" | "saving" | "saved" | "error";
export type MovementExerciseLanguage = "es" | "en" | "fr" | "de" | "it" | "pt";
export type MovementComfortLevelId = "seated" | "supported" | "active";
export type MovementSwapIntent = "easier" | "calm" | "legs";
export type MovementStepMotion =
  | "seated-tall"
  | "shoulder-roll"
  | "overhead-reach"
  | "side-change"
  | "standing-support"
  | "soft-knees"
  | "weight-shift"
  | "hand-flow"
  | "chair-front"
  | "chair-hold"
  | "knee-lift"
  | "leg-lower"
  | "calm-seat"
  | "hands-belly"
  | "inhale"
  | "exhale"
  | "sit-ready"
  | "feet-under"
  | "stand-up"
  | "sit-down"
  | "chair-behind"
  | "toe-rise"
  | "heel-lower"
  | "wall-ready"
  | "hands-wall"
  | "wall-lean"
  | "wall-press"
  | "ankle-seat"
  | "foot-lift"
  | "toe-flex"
  | "foot-change"
  | "arms-open"
  | "breathe-open"
  | "hands-return"
  | "side-support"
  | "side-step"
  | "feet-together"
  | "step-return"
  | "hand-open"
  | "finger-up"
  | "finger-down"
  | "next-finger"
  | "shoulders-rest"
  | "shoulders-lift"
  | "shoulders-back"
  | "shoulders-drop";

export const MOVEMENT_FEATURED_EXERCISE_IDS: MovementExerciseCardId[] = ["chair-yoga", "tai-chi", "seated-strength", "calm-breathing"];
const MOVEMENT_EXERCISE_CARD_BASE: Array<Pick<MovementExerciseCard, "id" | "group">> = [
  { id: "chair-yoga", group: "mobility" },
  { id: "tai-chi", group: "balance" },
  { id: "seated-strength", group: "strength" },
  { id: "calm-breathing", group: "calm" },
  { id: "sit-to-stand", group: "strength" },
  { id: "heel-raises", group: "balance" },
  { id: "wall-push-ups", group: "strength" },
  { id: "ankle-mobility", group: "mobility" },
  { id: "chest-opener", group: "mobility" },
  { id: "side-steps", group: "balance" },
  { id: "hand-breathing", group: "calm" },
  { id: "shoulder-release", group: "calm" },
];
const MOVEMENT_EXERCISE_CARD_IDS = new Set<MovementExerciseCardId>(MOVEMENT_EXERCISE_CARD_BASE.map((card) => card.id));
const MOVEMENT_LAST_USED_EXERCISE_KEY = "vyva_movement_last_exercise_id";
const MOVEMENT_WEEK_LOG_DATES_KEY = "vyva_movement_week_log_dates";
const MOVEMENT_COMFORT_LEVEL_KEY = "vyva_movement_comfort_level";
const MOVEMENT_COMFORT_LEVEL_IDS: MovementComfortLevelId[] = ["seated", "supported", "active"];

const MOVEMENT_EXERCISE_CARD_COPY: Record<MovementExerciseLanguage, Record<MovementExerciseCardId, Pick<MovementExerciseCard, "title" | "benefit" | "focus">>> = {
  en: {
    "chair-yoga": { title: "Chair yoga", benefit: "Loosen shoulders", focus: "Mobility" },
    "tai-chi": { title: "Tai chi", benefit: "Balance practice", focus: "Balance" },
    "seated-strength": { title: "Seated strength", benefit: "Build leg strength", focus: "Strength" },
    "calm-breathing": { title: "Calm breathing", benefit: "Settle your breath", focus: "Calm" },
    "sit-to-stand": { title: "Sit-to-stand", benefit: "Stand with confidence", focus: "Strength" },
    "heel-raises": { title: "Heel raises", benefit: "Steady ankles", focus: "Balance" },
    "wall-push-ups": { title: "Wall push-ups", benefit: "Upper-body strength", focus: "Strength" },
    "ankle-mobility": { title: "Ankle mobility", benefit: "Wake up feet", focus: "Mobility" },
    "chest-opener": { title: "Chest opener", benefit: "Open posture", focus: "Mobility" },
    "side-steps": { title: "Side steps", benefit: "Practice balance", focus: "Balance" },
    "hand-breathing": { title: "Hand breathing", benefit: "Slow your pace", focus: "Calm" },
    "shoulder-release": { title: "Shoulder release", benefit: "Relax shoulders", focus: "Calm" },
  },
  es: {
    "chair-yoga": { title: "Yoga en silla", benefit: "Soltar hombros", focus: "Movilidad" },
    "tai-chi": { title: "Tai chi", benefit: "Practicar equilibrio", focus: "Equilibrio" },
    "seated-strength": { title: "Fuerza sentada", benefit: "Fortalecer piernas", focus: "Fuerza" },
    "calm-breathing": { title: "Respiracion tranquila", benefit: "Calmar la respiracion", focus: "Calma" },
    "sit-to-stand": { title: "Sentarse y levantarse", benefit: "Levantarse con confianza", focus: "Fuerza" },
    "heel-raises": { title: "Elevacion de talones", benefit: "Tobillos estables", focus: "Equilibrio" },
    "wall-push-ups": { title: "Flexiones en pared", benefit: "Fuerza de brazos", focus: "Fuerza" },
    "ankle-mobility": { title: "Movilidad de tobillos", benefit: "Despertar los pies", focus: "Movilidad" },
    "chest-opener": { title: "Apertura de pecho", benefit: "Postura abierta", focus: "Movilidad" },
    "side-steps": { title: "Pasos laterales", benefit: "Practicar equilibrio", focus: "Equilibrio" },
    "hand-breathing": { title: "Respiracion con la mano", benefit: "Bajar el ritmo", focus: "Calma" },
    "shoulder-release": { title: "Relajar hombros", benefit: "Soltar los hombros", focus: "Calma" },
  },
  de: {
    "chair-yoga": { title: "Stuhl-Yoga", benefit: "Schultern lockern", focus: "Beweglichkeit" },
    "tai-chi": { title: "Tai Chi", benefit: "Gleichgewicht ueben", focus: "Balance" },
    "seated-strength": { title: "Kraft im Sitzen", benefit: "Beine kraeftigen", focus: "Kraft" },
    "calm-breathing": { title: "Ruhiges Atmen", benefit: "Atem beruhigen", focus: "Ruhe" },
    "sit-to-stand": { title: "Aufstehen und setzen", benefit: "Sicher aufstehen", focus: "Kraft" },
    "heel-raises": { title: "Fersenheben", benefit: "Stabile Knoechel", focus: "Balance" },
    "wall-push-ups": { title: "Wand-Liegestuetze", benefit: "Kraft fuer Arme", focus: "Kraft" },
    "ankle-mobility": { title: "Knoechel bewegen", benefit: "Fuesse wecken", focus: "Beweglichkeit" },
    "chest-opener": { title: "Brust oeffnen", benefit: "Aufrechte Haltung", focus: "Beweglichkeit" },
    "side-steps": { title: "Seitliche Schritte", benefit: "Balance ueben", focus: "Balance" },
    "hand-breathing": { title: "Hand-Atmung", benefit: "Tempo verlangsamen", focus: "Ruhe" },
    "shoulder-release": { title: "Schultern loesen", benefit: "Schultern entspannen", focus: "Ruhe" },
  },
  fr: {
    "chair-yoga": { title: "Yoga sur chaise", benefit: "Detendre les epaules", focus: "Mobilite" },
    "tai-chi": { title: "Tai chi", benefit: "Pratiquer l'equilibre", focus: "Equilibre" },
    "seated-strength": { title: "Renforcement assis", benefit: "Renforcer les jambes", focus: "Force" },
    "calm-breathing": { title: "Respiration calme", benefit: "Apaiser le souffle", focus: "Calme" },
    "sit-to-stand": { title: "Assis-debout", benefit: "Se lever avec confiance", focus: "Force" },
    "heel-raises": { title: "Montees sur pointes", benefit: "Chevilles stables", focus: "Equilibre" },
    "wall-push-ups": { title: "Pompes au mur", benefit: "Force du haut du corps", focus: "Force" },
    "ankle-mobility": { title: "Mobilite des chevilles", benefit: "Reveiller les pieds", focus: "Mobilite" },
    "chest-opener": { title: "Ouverture de poitrine", benefit: "Ouvrir la posture", focus: "Mobilite" },
    "side-steps": { title: "Pas de cote", benefit: "Pratiquer l'equilibre", focus: "Equilibre" },
    "hand-breathing": { title: "Respiration avec la main", benefit: "Ralentir le rythme", focus: "Calme" },
    "shoulder-release": { title: "Detente des epaules", benefit: "Relacher les epaules", focus: "Calme" },
  },
  it: {
    "chair-yoga": { title: "Yoga sulla sedia", benefit: "Sciogliere le spalle", focus: "Mobilita" },
    "tai-chi": { title: "Tai chi", benefit: "Pratica dell'equilibrio", focus: "Equilibrio" },
    "seated-strength": { title: "Forza da seduti", benefit: "Rafforzare le gambe", focus: "Forza" },
    "calm-breathing": { title: "Respiro calmo", benefit: "Calmare il respiro", focus: "Calma" },
    "sit-to-stand": { title: "Sedersi e alzarsi", benefit: "Alzarsi con fiducia", focus: "Forza" },
    "heel-raises": { title: "Sollevamenti sui talloni", benefit: "Caviglie stabili", focus: "Equilibrio" },
    "wall-push-ups": { title: "Piegamenti al muro", benefit: "Forza per braccia e petto", focus: "Forza" },
    "ankle-mobility": { title: "Mobilita delle caviglie", benefit: "Risvegliare i piedi", focus: "Mobilita" },
    "chest-opener": { title: "Apertura del petto", benefit: "Postura piu aperta", focus: "Mobilita" },
    "side-steps": { title: "Passi laterali", benefit: "Praticare l'equilibrio", focus: "Equilibrio" },
    "hand-breathing": { title: "Respiro con la mano", benefit: "Rallentare il ritmo", focus: "Calma" },
    "shoulder-release": { title: "Rilascio delle spalle", benefit: "Rilassare le spalle", focus: "Calma" },
  },
  pt: {
    "chair-yoga": { title: "Ioga na cadeira", benefit: "Soltar os ombros", focus: "Mobilidade" },
    "tai-chi": { title: "Tai chi", benefit: "Praticar equilibrio", focus: "Equilibrio" },
    "seated-strength": { title: "Forca sentada", benefit: "Fortalecer as pernas", focus: "Forca" },
    "calm-breathing": { title: "Respiracao calma", benefit: "Acalmar a respiracao", focus: "Calma" },
    "sit-to-stand": { title: "Sentar e levantar", benefit: "Levantar com confianca", focus: "Forca" },
    "heel-raises": { title: "Elevar calcanhares", benefit: "Tornozelos estaveis", focus: "Equilibrio" },
    "wall-push-ups": { title: "Flexoes na parede", benefit: "Forca na parte superior", focus: "Forca" },
    "ankle-mobility": { title: "Mobilidade dos tornozelos", benefit: "Acordar os pes", focus: "Mobilidade" },
    "chest-opener": { title: "Abrir o peito", benefit: "Postura mais aberta", focus: "Mobilidade" },
    "side-steps": { title: "Passos laterais", benefit: "Praticar equilibrio", focus: "Equilibrio" },
    "hand-breathing": { title: "Respirar com a mao", benefit: "Abrandar o ritmo", focus: "Calma" },
    "shoulder-release": { title: "Soltar os ombros", benefit: "Relaxar os ombros", focus: "Calma" },
  },
};

export function getMovementExerciseCards(language: MovementExerciseLanguage): MovementExerciseCard[] {
  return MOVEMENT_EXERCISE_CARD_BASE.map((card) => ({
    ...card,
    ...MOVEMENT_EXERCISE_CARD_COPY[language][card.id],
  }));
}

export function isMovementExerciseCardId(value: string | null | undefined): value is MovementExerciseCardId {
  return Boolean(value && MOVEMENT_EXERCISE_CARD_IDS.has(value as MovementExerciseCardId));
}

function isMovementComfortLevelId(value: string | null | undefined): value is MovementComfortLevelId {
  return Boolean(value && MOVEMENT_COMFORT_LEVEL_IDS.includes(value as MovementComfortLevelId));
}

export function loadLastMovementExerciseId(): MovementExerciseCardId | null {
  if (typeof window === "undefined") return null;

  try {
    const storedExerciseId = window.localStorage.getItem(MOVEMENT_LAST_USED_EXERCISE_KEY);
    return isMovementExerciseCardId(storedExerciseId) ? storedExerciseId : null;
  } catch {
    return null;
  }
}

export function saveLastMovementExerciseId(exerciseId: MovementExerciseCardId) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MOVEMENT_LAST_USED_EXERCISE_KEY, exerciseId);
  } catch {
    // Ignore storage failures so exercise logging still completes.
  }
}

export function loadMovementComfortLevel(): MovementComfortLevelId {
  if (typeof window === "undefined") return "supported";

  try {
    const storedComfortLevel = window.localStorage.getItem(MOVEMENT_COMFORT_LEVEL_KEY);
    return isMovementComfortLevelId(storedComfortLevel) ? storedComfortLevel : "supported";
  } catch {
    return "supported";
  }
}

export function saveMovementComfortLevel(comfortLevel: MovementComfortLevelId) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MOVEMENT_COMFORT_LEVEL_KEY, comfortLevel);
  } catch {
    // Ignore storage failures so choosing a comfort level still works.
  }
}

function getMovementDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMovementDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeMovementWeekLogDates(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter(isMovementDateKey))).slice(-21);
}

export function loadMovementWeekLogDates(): string[] {
  if (typeof window === "undefined") return [];

  try {
    return normalizeMovementWeekLogDates(JSON.parse(window.localStorage.getItem(MOVEMENT_WEEK_LOG_DATES_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveMovementWeekLogDates(dateKeys: string[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MOVEMENT_WEEK_LOG_DATES_KEY, JSON.stringify(normalizeMovementWeekLogDates(dateKeys)));
  } catch {
    // Local week progress should never block exercise logging.
  }
}

export function addMovementWeekLogDate(dateKeys: string[], dateKey = getMovementDateKey()) {
  return normalizeMovementWeekLogDates([...dateKeys, dateKey]);
}

export function getMovementWeekDays(language: MovementExerciseLanguage, today = new Date()) {
  const formatter = new Intl.DateTimeFormat(language, { weekday: "narrow" });
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - index));
    return {
      dateKey: getMovementDateKey(date),
      isToday: index === 6,
      label: formatter.format(date).slice(0, 2),
    };
  });
}

export function getRecommendedMovementExerciseId(date = new Date(), comfortLevel: MovementComfortLevelId = "supported"): MovementExerciseCardId {
  const hour = date.getHours();
  if (comfortLevel === "seated") {
    if (hour < 12) return "chair-yoga";
    if (hour < 17) return "seated-strength";
    return "calm-breathing";
  }
  if (comfortLevel === "active") {
    if (hour < 12) return "sit-to-stand";
    if (hour < 17) return "side-steps";
    return "calm-breathing";
  }
  if (hour < 12) return "ankle-mobility";
  if (hour < 17) return "tai-chi";
  return "calm-breathing";
}

export function getMovementSwapExerciseId(
  intent: MovementSwapIntent,
  comfortLevel: MovementComfortLevelId,
  currentExerciseId?: MovementExerciseCardId | null,
): MovementExerciseCardId {
  const options: Record<MovementSwapIntent, Record<MovementComfortLevelId, MovementExerciseCardId[]>> = {
    easier: {
      seated: ["chair-yoga", "ankle-mobility", "calm-breathing"],
      supported: ["chair-yoga", "chest-opener", "calm-breathing"],
      active: ["tai-chi", "side-steps", "chair-yoga"],
    },
    calm: {
      seated: ["calm-breathing", "hand-breathing", "shoulder-release"],
      supported: ["calm-breathing", "shoulder-release", "hand-breathing"],
      active: ["calm-breathing", "tai-chi", "shoulder-release"],
    },
    legs: {
      seated: ["seated-strength", "ankle-mobility", "heel-raises"],
      supported: ["sit-to-stand", "heel-raises", "side-steps"],
      active: ["side-steps", "sit-to-stand", "heel-raises"],
    },
  };
  const candidates = options[intent][comfortLevel];
  return candidates.find((exerciseId) => exerciseId !== currentExerciseId) ?? candidates[0];
}

export const MOVEMENT_EXERCISE_SESSIONS: Record<MovementExerciseCardId, {
  logType: string;
  visuals: MovementStepMotion[];
  sceneLabels: string[];
  steps: Record<MovementExerciseLanguage, string[]>;
}> = {
  "chair-yoga": {
    logType: "ChairYoga",
    visuals: ["seated-tall", "shoulder-roll", "overhead-reach", "side-change"],
    sceneLabels: ["Seated tall with feet flat", "Shoulders gently rolling back", "One arm reaching overhead", "Opposite arm reaching overhead"],
    steps: {
      en: ["Sit tall with both feet flat.", "Roll your shoulders back twice.", "Reach one arm overhead and breathe.", "Change sides slowly."],
      de: ["Sitz aufrecht, beide Fuesse flach.", "Rolle die Schultern zweimal zurueck.", "Heb einen Arm langsam nach oben und atme.", "Wechsle die Seite langsam."],
      es: ["Sientate erguido con ambos pies apoyados.", "Rueda los hombros hacia atras dos veces.", "Eleva un brazo despacio y respira.", "Cambia de lado lentamente."],
      fr: ["Asseyez-vous droit, les deux pieds au sol.", "Roulez les epaules deux fois vers l'arriere.", "Levez un bras doucement et respirez.", "Changez de cote lentement."],
      it: ["Siediti diritto con entrambi i piedi a terra.", "Ruota le spalle indietro due volte.", "Alza un braccio lentamente e respira.", "Cambia lato con calma."],
      pt: ["Sente-se direito com os dois pes no chao.", "Rode os ombros para tras duas vezes.", "Levante um braco devagar e respire.", "Troque de lado lentamente."],
    },
  },
  "tai-chi": {
    logType: "TaiChi",
    visuals: ["standing-support", "soft-knees", "weight-shift", "hand-flow"],
    sceneLabels: ["Standing tall with chair nearby", "Knees softly bent", "Weight shifting gently", "Hands floating forward"],
    steps: {
      en: ["Stand tall with a chair nearby if helpful.", "Soften your knees.", "Shift weight gently from one foot to the other.", "Float your hands forward and back slowly."],
      de: ["Steh aufrecht, mit einem Stuhl in der Naehe.", "Beuge die Knie nur leicht.", "Verlagere das Gewicht sanft von einem Fuss zum anderen.", "Fuehre die Haende langsam vor und zurueck."],
      es: ["Ponte de pie con una silla cerca si ayuda.", "Flexiona un poco las rodillas.", "Cambia el peso suavemente de un pie al otro.", "Mueve las manos hacia delante y atras despacio."],
      fr: ["Tenez-vous droit avec une chaise proche si besoin.", "Pliez tres legerement les genoux.", "Deplacez doucement le poids d'un pied a l'autre.", "Faites glisser les mains lentement vers l'avant puis l'arriere."],
      it: ["Stai in piedi con una sedia vicina se aiuta.", "Piega leggermente le ginocchia.", "Sposta il peso con dolcezza da un piede all'altro.", "Muovi lentamente le mani avanti e indietro."],
      pt: ["Fique de pe com uma cadeira perto se ajudar.", "Dobre um pouco os joelhos.", "Mude o peso suavemente de um pe para o outro.", "Mova as maos devagar para a frente e para tras."],
    },
  },
  "seated-strength": {
    logType: "SeatedStrength",
    visuals: ["chair-front", "chair-hold", "knee-lift", "leg-lower"],
    sceneLabels: ["Sitting near the chair front", "Hands lightly holding chair sides", "One knee lifting while seated", "Leg lowering with control"],
    steps: {
      en: ["Sit near the front of the chair.", "Hold the chair sides lightly.", "Lift one knee or straighten one leg.", "Lower slowly and change sides."],
      de: ["Sitz nah an der Stuhlkante.", "Halte den Stuhl leicht an den Seiten.", "Heb ein Knie oder strecke ein Bein.", "Senke langsam und wechsle die Seite."],
      es: ["Sientate cerca del borde de la silla.", "Sujeta los lados de la silla suavemente.", "Levanta una rodilla o estira una pierna.", "Baja despacio y cambia de lado."],
      fr: ["Asseyez-vous pres du bord de la chaise.", "Tenez les cotes de la chaise legerement.", "Levez un genou ou tendez une jambe.", "Redescendez lentement et changez de cote."],
      it: ["Siediti vicino al bordo della sedia.", "Tieni leggermente i lati della sedia.", "Solleva un ginocchio o stendi una gamba.", "Abbassa lentamente e cambia lato."],
      pt: ["Sente-se perto da frente da cadeira.", "Segure levemente os lados da cadeira.", "Levante um joelho ou estique uma perna.", "Baixe devagar e troque de lado."],
    },
  },
  "calm-breathing": {
    logType: "CalmBreathing",
    visuals: ["calm-seat", "hands-belly", "inhale", "exhale"],
    sceneLabels: ["Comfortable seated posture", "Hands resting on chest and belly", "Slow inhale with relaxed shoulders", "Slow exhale with relaxed jaw"],
    steps: {
      en: ["Sit comfortably with shoulders relaxed.", "Place one hand on chest and one on belly.", "Breathe in slowly through your nose.", "Breathe out gently and relax your jaw."],
      de: ["Sitz bequem mit entspannten Schultern.", "Lege eine Hand auf die Brust und eine auf den Bauch.", "Atme langsam durch die Nase ein.", "Atme sanft aus und entspanne den Kiefer."],
      es: ["Sientate comodo con los hombros relajados.", "Pon una mano en el pecho y otra en el abdomen.", "Inspira lentamente por la nariz.", "Suelta el aire suave y relaja la mandibula."],
      fr: ["Asseyez-vous confortablement, epaules relachees.", "Posez une main sur la poitrine et l'autre sur le ventre.", "Inspirez lentement par le nez.", "Expirez doucement et detendez la machoire."],
      it: ["Siediti comodamente con le spalle rilassate.", "Metti una mano sul petto e una sulla pancia.", "Inspira lentamente dal naso.", "Espira piano e rilassa la mandibola."],
      pt: ["Sente-se confortavelmente com os ombros relaxados.", "Coloque uma mao no peito e outra na barriga.", "Inspire lentamente pelo nariz.", "Expire suavemente e relaxe a mandibula."],
    },
  },
  "sit-to-stand": {
    logType: "SitToStand",
    visuals: ["sit-ready", "feet-under", "stand-up", "sit-down"],
    sceneLabels: ["Sitting near the front of a stable chair", "Feet under knees before standing", "Rising slowly from the chair", "Sitting back down with control"],
    steps: {
      en: ["Sit near the front of a stable chair.", "Place your feet under your knees.", "Lean forward and stand slowly.", "Sit back down with control."],
      de: ["Sitz nah an der Vorderkante eines stabilen Stuhls.", "Stell die Fuesse unter die Knie.", "Lehne dich leicht nach vorn und steh langsam auf.", "Setz dich kontrolliert wieder hin."],
      es: ["Sientate cerca del borde de una silla estable.", "Coloca los pies debajo de las rodillas.", "Inclinate un poco hacia delante y levantate despacio.", "Sientate de nuevo con control."],
      fr: ["Asseyez-vous pres du bord d'une chaise stable.", "Placez les pieds sous les genoux.", "Penchez-vous legerement et levez-vous lentement.", "Rasseyez-vous avec controle."],
      it: ["Siediti vicino al bordo di una sedia stabile.", "Metti i piedi sotto le ginocchia.", "Piegati leggermente in avanti e alzati piano.", "Siediti di nuovo con controllo."],
      pt: ["Sente-se perto da frente de uma cadeira estavel.", "Coloque os pes debaixo dos joelhos.", "Incline-se um pouco e levante devagar.", "Sente-se outra vez com controlo."],
    },
  },
  "heel-raises": {
    logType: "HeelRaises",
    visuals: ["chair-behind", "chair-hold", "toe-rise", "heel-lower"],
    sceneLabels: ["Standing behind a stable chair", "Hands lightly holding the chair", "Heels lifted onto toes", "Heels lowering back to the floor"],
    steps: {
      en: ["Stand behind a stable chair.", "Hold the chair lightly.", "Rise onto your toes slowly.", "Lower your heels and repeat."],
      de: ["Steh hinter einem stabilen Stuhl.", "Halte den Stuhl leicht fest.", "Heb die Fersen langsam an.", "Senke die Fersen und wiederhole."],
      es: ["Ponte detras de una silla estable.", "Sujeta la silla suavemente.", "Sube despacio sobre las puntas.", "Baja los talones y repite."],
      fr: ["Placez-vous derriere une chaise stable.", "Tenez la chaise legerement.", "Montez lentement sur la pointe des pieds.", "Redescendez les talons et recommencez."],
      it: ["Stai dietro a una sedia stabile.", "Tieni la sedia con leggerezza.", "Sali lentamente sulle punte.", "Abbassa i talloni e ripeti."],
      pt: ["Fique atras de uma cadeira estavel.", "Segure a cadeira levemente.", "Suba devagar para a ponta dos pes.", "Baixe os calcanhares e repita."],
    },
  },
  "wall-push-ups": {
    logType: "WallPushUps",
    visuals: ["wall-ready", "hands-wall", "wall-lean", "wall-press"],
    sceneLabels: ["Standing an arm's length from a wall", "Hands placed on the wall", "Elbows bending toward the wall", "Pressing back to tall posture"],
    steps: {
      en: ["Stand an arm's length from a wall.", "Place your hands at chest height.", "Bend your elbows slowly toward the wall.", "Press back to tall posture."],
      de: ["Steh eine Armlaenge von der Wand entfernt.", "Lege die Haende auf Brusthoehe an die Wand.", "Beuge die Ellbogen langsam zur Wand.", "Druecke dich sanft wieder aufrecht."],
      es: ["Ponte a un brazo de distancia de la pared.", "Coloca las manos a la altura del pecho.", "Dobla los codos despacio hacia la pared.", "Empuja suavemente para volver erguido."],
      fr: ["Placez-vous a une longueur de bras du mur.", "Posez les mains a hauteur de poitrine.", "Pliez lentement les coudes vers le mur.", "Repoussez doucement pour vous redresser."],
      it: ["Mettiti a un braccio di distanza dal muro.", "Appoggia le mani all'altezza del petto.", "Piega lentamente i gomiti verso il muro.", "Spingi piano per tornare diritto."],
      pt: ["Fique a distancia de um braco da parede.", "Coloque as maos a altura do peito.", "Dobre os cotovelos devagar em direcao a parede.", "Empurre suavemente para voltar a postura direita."],
    },
  },
  "ankle-mobility": {
    logType: "AnkleMobility",
    visuals: ["ankle-seat", "foot-lift", "toe-flex", "foot-change"],
    sceneLabels: ["Seated tall with foot ready", "One foot lifted slightly", "Toes flexing gently", "Switching to the other foot"],
    steps: {
      en: ["Sit tall and hold the chair if helpful.", "Lift one foot slightly.", "Flex your toes up, then point gently.", "Change feet when ready."],
      de: ["Sitz aufrecht und halte den Stuhl, wenn es hilft.", "Heb einen Fuss leicht an.", "Zieh die Zehen hoch und strecke sie sanft.", "Wechsle den Fuss, wenn du bereit bist."],
      es: ["Sientate erguido y sujeta la silla si ayuda.", "Levanta un pie un poco.", "Sube los dedos y luego apuntalos suavemente.", "Cambia de pie cuando estes listo."],
      fr: ["Asseyez-vous droit et tenez la chaise si besoin.", "Levez legerement un pied.", "Relevez les orteils, puis pointez doucement.", "Changez de pied quand vous etes pret."],
      it: ["Siediti diritto e tieni la sedia se aiuta.", "Solleva leggermente un piede.", "Porta le dita verso l'alto, poi punta piano.", "Cambia piede quando sei pronto."],
      pt: ["Sente-se direito e segure a cadeira se ajudar.", "Levante um pe ligeiramente.", "Puxe os dedos para cima e depois aponte suavemente.", "Troque de pe quando estiver pronto."],
    },
  },
  "chest-opener": {
    logType: "ChestOpener",
    visuals: ["seated-tall", "arms-open", "breathe-open", "hands-return"],
    sceneLabels: ["Seated tall with feet flat", "Both arms opening to the sides", "Chest open while breathing in", "Hands returning slowly"],
    steps: {
      en: ["Sit tall with feet flat.", "Open both arms gently to the sides.", "Breathe in and keep shoulders relaxed.", "Bring your hands back slowly."],
      de: ["Sitz aufrecht mit flachen Fuessen.", "Oeffne beide Arme sanft zur Seite.", "Atme ein und lass die Schultern locker.", "Fuehre die Haende langsam zurueck."],
      es: ["Sientate erguido con los pies apoyados.", "Abre ambos brazos suavemente hacia los lados.", "Inspira con los hombros relajados.", "Vuelve las manos despacio."],
      fr: ["Asseyez-vous droit, les pieds a plat.", "Ouvrez doucement les deux bras sur les cotes.", "Inspirez en gardant les epaules relachees.", "Ramenez les mains lentement."],
      it: ["Siediti diritto con i piedi a terra.", "Apri delicatamente le braccia ai lati.", "Inspira tenendo le spalle rilassate.", "Riporta lentamente le mani indietro."],
      pt: ["Sente-se direito com os pes apoiados.", "Abra suavemente os dois bracos para os lados.", "Inspire mantendo os ombros relaxados.", "Traga as maos de volta devagar."],
    },
  },
  "side-steps": {
    logType: "SideSteps",
    visuals: ["side-support", "side-step", "feet-together", "step-return"],
    sceneLabels: ["Standing beside a chair for support", "Small step to one side", "Feet brought together", "Stepping back to start"],
    steps: {
      en: ["Stand beside a stable counter or chair.", "Step slowly to one side.", "Bring the other foot to meet it.", "Step back the other way when ready."],
      de: ["Steh neben einer stabilen Arbeitsflaeche oder einem Stuhl.", "Mach langsam einen Schritt zur Seite.", "Fuehre den anderen Fuss dazu.", "Geh langsam zurueck, wenn du bereit bist."],
      es: ["Ponte junto a una encimera o silla estable.", "Da un paso lento hacia un lado.", "Acerca el otro pie.", "Vuelve hacia el otro lado cuando estes listo."],
      fr: ["Placez-vous pres d'un plan de travail ou d'une chaise stable.", "Faites un pas lent sur le cote.", "Ramenez l'autre pied a cote.", "Revenez dans l'autre sens quand vous etes pret."],
      it: ["Stai vicino a un piano stabile o a una sedia.", "Fai un passo lento di lato.", "Porta l'altro piede vicino.", "Torna dall'altra parte quando sei pronto."],
      pt: ["Fique ao lado de uma bancada ou cadeira estavel.", "De um passo lento para o lado.", "Traga o outro pe para junto.", "Volte para o outro lado quando estiver pronto."],
    },
  },
  "hand-breathing": {
    logType: "HandBreathing",
    visuals: ["hand-open", "finger-up", "finger-down", "next-finger"],
    sceneLabels: ["Open hand in front of the body", "Tracing up one finger", "Tracing down one finger", "Moving to the next finger"],
    steps: {
      en: ["Open one hand in front of you.", "Trace up a finger as you breathe in.", "Trace down as you breathe out.", "Move to the next finger slowly."],
      de: ["Oeffne eine Hand vor dir.", "Fahre beim Einatmen einen Finger hinauf.", "Fahre beim Ausatmen hinunter.", "Geh langsam zum naechsten Finger."],
      es: ["Abre una mano delante de ti.", "Sigue un dedo hacia arriba al inspirar.", "Baja por el dedo al espirar.", "Pasa al siguiente dedo despacio."],
      fr: ["Ouvrez une main devant vous.", "Suivez un doigt vers le haut en inspirant.", "Redescendez en expirant.", "Passez lentement au doigt suivant."],
      it: ["Apri una mano davanti a te.", "Segui un dito verso l'alto mentre inspiri.", "Scendi mentre espiri.", "Passa lentamente al dito successivo."],
      pt: ["Abra uma mao a sua frente.", "Trace um dedo para cima ao inspirar.", "Desca ao expirar.", "Passe devagar para o dedo seguinte."],
    },
  },
  "shoulder-release": {
    logType: "ShoulderRelease",
    visuals: ["shoulders-rest", "shoulders-lift", "shoulders-back", "shoulders-drop"],
    sceneLabels: ["Shoulders relaxed with arms resting", "Shoulders lifted gently", "Shoulders rolling back softly", "Shoulders dropped while breathing out"],
    steps: {
      en: ["Sit tall and let your arms rest.", "Lift your shoulders a little.", "Roll them back softly.", "Let them drop and breathe out."],
      de: ["Sitz aufrecht und lass die Arme ruhen.", "Heb die Schultern ein wenig.", "Rolle sie sanft nach hinten.", "Lass sie sinken und atme aus."],
      es: ["Sientate erguido y deja descansar los brazos.", "Sube un poco los hombros.", "Ruedalos suavemente hacia atras.", "Dejalos caer y espira."],
      fr: ["Asseyez-vous droit et laissez les bras se reposer.", "Levez un peu les epaules.", "Roulez-les doucement vers l'arriere.", "Laissez-les tomber et expirez."],
      it: ["Siediti diritto e lascia riposare le braccia.", "Solleva un poco le spalle.", "Ruotale dolcemente all'indietro.", "Lasciale scendere ed espira."],
      pt: ["Sente-se direito e deixe os bracos descansar.", "Levante um pouco os ombros.", "Rode-os suavemente para tras.", "Deixe-os descer e expire."],
    },
  },
};

export function getMovementExerciseLanguage(language?: string | null): MovementExerciseLanguage {
  const base = language?.split("-")[0]?.toLowerCase();
  if (base === "es" || base === "en" || base === "fr" || base === "de" || base === "it" || base === "pt") return base;
  return "en";
}

export function getMovementExerciseLibraryCopy(language: MovementExerciseLanguage) {
  if (language === "en") {
    return {
      eyebrow: "Movement room",
      title: "Choose a gentle activity",
      body: "Tap a photo to start.",
      recommendedTitle: "Recommended today",
      recommendedBody: "A simple place to start.",
      recommendedAction: "Start",
      weekTitle: "My gentle week",
      weekBody: "Small movement days count.",
      weekProgress: (count: number) => count === 1 ? "1 day moved" : `${count} days moved`,
      todayPill: "Today",
      doneDayLabel: "Done",
      openDayLabel: "Open",
      lastUsedLine: (title: string) => `Last time: ${title}`,
      noLastUsed: "No favorite yet",
      repeatCta: "Do this again",
      todayPickCta: "Do today's pick",
      comfortTitle: "Comfort level",
      comfortLevels: [
        { id: "seated" as MovementComfortLevelId, label: "Seated only" },
        { id: "supported" as MovementComfortLevelId, label: "Chair support" },
        { id: "active" as MovementComfortLevelId, label: "A little active" },
      ],
      swapPrompt: "Need a different feel?",
      swapEasier: "Something easier",
      swapCalm: "Something calmer",
      swapLegs: "For legs",
      moreTitle: "More gentle exercises",
      detail: "Browse all 12 photo-led routines here.",
      cta: "Show all exercises",
      collapseCta: "Show fewer",
      lastUsedBadge: "Last used",
      groupPrompt: "Pick a focus",
      groupCount: (count: number) => `${count} choices`,
      cards: getMovementExerciseCards(language),
      groups: [
        { id: "mobility" as MovementExerciseGroupId, title: "Mobility", subtitle: "Loosen stiff areas with small comfortable motions." },
        { id: "balance" as MovementExerciseGroupId, title: "Balance", subtitle: "Practice steady, supported movement around the home." },
        { id: "strength" as MovementExerciseGroupId, title: "Strength", subtitle: "Build confidence for standing, reaching, and daily movement." },
        { id: "calm" as MovementExerciseGroupId, title: "Calm", subtitle: "Settle the breath and finish gently." },
      ],
    };
  }

  if (language === "de") {
    return {
      eyebrow: "Bewegungsraum",
      title: "Sanfte Aktivitaet waehlen",
      body: "Tippe auf ein Foto zum Starten.",
      recommendedTitle: "Heute empfohlen",
      recommendedBody: "Ein einfacher Start.",
      recommendedAction: "Starten",
      weekTitle: "Meine sanfte Woche",
      weekBody: "Kleine Bewegungstage zaehlen.",
      weekProgress: (count: number) => count === 1 ? "1 Tag bewegt" : `${count} Tage bewegt`,
      todayPill: "Heute",
      doneDayLabel: "Fertig",
      openDayLabel: "Offen",
      lastUsedLine: (title: string) => `Zuletzt: ${title}`,
      noLastUsed: "Noch kein Favorit",
      repeatCta: "Noch einmal",
      todayPickCta: "Heutigen Tipp starten",
      comfortTitle: "Komfort",
      comfortLevels: [
        { id: "seated" as MovementComfortLevelId, label: "Nur sitzend" },
        { id: "supported" as MovementComfortLevelId, label: "Stuhlstuetze" },
        { id: "active" as MovementComfortLevelId, label: "Etwas aktiver" },
      ],
      swapPrompt: "Anderes Gefuehl?",
      swapEasier: "Etwas leichter",
      swapCalm: "Etwas ruhiger",
      swapLegs: "Fuer Beine",
      moreTitle: "Mehr sanfte Uebungen",
      detail: "Alle 12 Foto-Uebungen direkt hier ansehen.",
      cta: "Alle Uebungen zeigen",
      collapseCta: "Weniger zeigen",
      lastUsedBadge: "Zuletzt",
      groupPrompt: "Fokus waehlen",
      groupCount: (count: number) => `${count} Optionen`,
      cards: getMovementExerciseCards(language),
      groups: [
        { id: "mobility" as MovementExerciseGroupId, title: "Beweglichkeit", subtitle: "Steife Bereiche mit kleinen, bequemen Bewegungen lockern." },
        { id: "balance" as MovementExerciseGroupId, title: "Balance", subtitle: "Ruhige, gestuetzte Bewegung fuer zuhause ueben." },
        { id: "strength" as MovementExerciseGroupId, title: "Kraft", subtitle: "Sicherheit beim Aufstehen, Greifen und Bewegen staerken." },
        { id: "calm" as MovementExerciseGroupId, title: "Ruhe", subtitle: "Atem beruhigen und sanft abschliessen." },
      ],
    };
  }

  if (language === "fr") {
    return {
      eyebrow: "Salle de mouvement",
      title: "Choisir une activite douce",
      body: "Touchez une photo pour commencer.",
      recommendedTitle: "Recommande aujourd'hui",
      recommendedBody: "Un depart simple.",
      recommendedAction: "Commencer",
      weekTitle: "Ma semaine douce",
      weekBody: "Les petits jours de mouvement comptent.",
      weekProgress: (count: number) => count === 1 ? "1 jour bouge" : `${count} jours bouges`,
      todayPill: "Aujourd'hui",
      doneDayLabel: "Fait",
      openDayLabel: "Ouvert",
      lastUsedLine: (title: string) => `Derniere fois : ${title}`,
      noLastUsed: "Pas encore de favori",
      repeatCta: "Refaire celui-ci",
      todayPickCta: "Faire le choix du jour",
      comfortTitle: "Niveau de confort",
      comfortLevels: [
        { id: "seated" as MovementComfortLevelId, label: "Assis seulement" },
        { id: "supported" as MovementComfortLevelId, label: "Avec chaise" },
        { id: "active" as MovementComfortLevelId, label: "Un peu actif" },
      ],
      swapPrompt: "Envie d'autre chose ?",
      swapEasier: "Plus facile",
      swapCalm: "Plus calme",
      swapLegs: "Pour les jambes",
      moreTitle: "Plus d'exercices doux",
      detail: "Parcourez ici les 12 routines guidees par photo.",
      cta: "Afficher tous les exercices",
      collapseCta: "Afficher moins",
      lastUsedBadge: "Dernier",
      groupPrompt: "Choisissez un objectif",
      groupCount: (count: number) => `${count} choix`,
      cards: getMovementExerciseCards(language),
      groups: [
        { id: "mobility" as MovementExerciseGroupId, title: "Mobilite", subtitle: "Assouplir les zones raides avec de petits mouvements confortables." },
        { id: "balance" as MovementExerciseGroupId, title: "Equilibre", subtitle: "Pratiquer des mouvements stables et soutenus a la maison." },
        { id: "strength" as MovementExerciseGroupId, title: "Force", subtitle: "Gagner en confiance pour se lever, atteindre et bouger." },
        { id: "calm" as MovementExerciseGroupId, title: "Calme", subtitle: "Apaiser le souffle et finir en douceur." },
      ],
    };
  }

  if (language === "it") {
    return {
      eyebrow: "Stanza movimento",
      title: "Scegli un'attivita dolce",
      body: "Tocca una foto per iniziare.",
      recommendedTitle: "Consigliato oggi",
      recommendedBody: "Un inizio semplice.",
      recommendedAction: "Inizia",
      weekTitle: "La mia settimana dolce",
      weekBody: "I piccoli giorni di movimento contano.",
      weekProgress: (count: number) => count === 1 ? "1 giorno mosso" : `${count} giorni mossi`,
      todayPill: "Oggi",
      doneDayLabel: "Fatto",
      openDayLabel: "Aperto",
      lastUsedLine: (title: string) => `Ultima volta: ${title}`,
      noLastUsed: "Nessun preferito ancora",
      repeatCta: "Rifallo",
      todayPickCta: "Fai la scelta di oggi",
      comfortTitle: "Livello di comfort",
      comfortLevels: [
        { id: "seated" as MovementComfortLevelId, label: "Solo seduti" },
        { id: "supported" as MovementComfortLevelId, label: "Con sedia" },
        { id: "active" as MovementComfortLevelId, label: "Un po' attivo" },
      ],
      swapPrompt: "Vuoi cambiare?",
      swapEasier: "Piu facile",
      swapCalm: "Piu calmo",
      swapLegs: "Per le gambe",
      moreTitle: "Altri esercizi dolci",
      detail: "Sfoglia qui tutte le 12 routine con foto.",
      cta: "Mostra tutti gli esercizi",
      collapseCta: "Mostra meno",
      lastUsedBadge: "Ultimo",
      groupPrompt: "Scegli un focus",
      groupCount: (count: number) => `${count} scelte`,
      cards: getMovementExerciseCards(language),
      groups: [
        { id: "mobility" as MovementExerciseGroupId, title: "Mobilita", subtitle: "Sciogli le zone rigide con piccoli movimenti comodi." },
        { id: "balance" as MovementExerciseGroupId, title: "Equilibrio", subtitle: "Pratica movimenti stabili e con supporto in casa." },
        { id: "strength" as MovementExerciseGroupId, title: "Forza", subtitle: "Aumenta la fiducia per alzarti, raggiungere e muoverti." },
        { id: "calm" as MovementExerciseGroupId, title: "Calma", subtitle: "Calma il respiro e concludi dolcemente." },
      ],
    };
  }

  if (language === "pt") {
    return {
      eyebrow: "Sala de movimento",
      title: "Escolha uma atividade suave",
      body: "Toque numa foto para comecar.",
      recommendedTitle: "Recomendado hoje",
      recommendedBody: "Um comeco simples.",
      recommendedAction: "Comecar",
      weekTitle: "A minha semana suave",
      weekBody: "Pequenos dias de movimento contam.",
      weekProgress: (count: number) => count === 1 ? "1 dia mexido" : `${count} dias mexidos`,
      todayPill: "Hoje",
      doneDayLabel: "Feito",
      openDayLabel: "Aberto",
      lastUsedLine: (title: string) => `Ultima vez: ${title}`,
      noLastUsed: "Ainda sem favorito",
      repeatCta: "Fazer outra vez",
      todayPickCta: "Fazer a escolha de hoje",
      comfortTitle: "Nivel de conforto",
      comfortLevels: [
        { id: "seated" as MovementComfortLevelId, label: "So sentado" },
        { id: "supported" as MovementComfortLevelId, label: "Com cadeira" },
        { id: "active" as MovementComfortLevelId, label: "Um pouco ativo" },
      ],
      swapPrompt: "Quer outra sensacao?",
      swapEasier: "Algo mais facil",
      swapCalm: "Algo mais calmo",
      swapLegs: "Para pernas",
      moreTitle: "Mais exercicios suaves",
      detail: "Veja aqui as 12 rotinas guiadas por foto.",
      cta: "Mostrar todos os exercicios",
      collapseCta: "Mostrar menos",
      lastUsedBadge: "Ultimo",
      groupPrompt: "Escolha um foco",
      groupCount: (count: number) => `${count} opcoes`,
      cards: getMovementExerciseCards(language),
      groups: [
        { id: "mobility" as MovementExerciseGroupId, title: "Mobilidade", subtitle: "Solte zonas rigidas com movimentos pequenos e confortaveis." },
        { id: "balance" as MovementExerciseGroupId, title: "Equilibrio", subtitle: "Pratique movimentos estaveis e apoiados em casa." },
        { id: "strength" as MovementExerciseGroupId, title: "Forca", subtitle: "Ganhe confianca para levantar, alcancar e mover-se." },
        { id: "calm" as MovementExerciseGroupId, title: "Calma", subtitle: "Acalme a respiracao e termine suavemente." },
      ],
    };
  }

  return {
    eyebrow: "Sala de movimiento",
    title: "Elige una actividad suave",
    body: "Toca una foto para empezar.",
    recommendedTitle: "Recomendado hoy",
    recommendedBody: "Un comienzo sencillo.",
    recommendedAction: "Empezar",
    weekTitle: "Mi semana suave",
    weekBody: "Los dias de movimiento pequeno cuentan.",
    weekProgress: (count: number) => count === 1 ? "1 dia con movimiento" : `${count} dias con movimiento`,
    todayPill: "Hoy",
    doneDayLabel: "Hecho",
    openDayLabel: "Abierto",
    lastUsedLine: (title: string) => `Ultima vez: ${title}`,
    noLastUsed: "Aun sin favorito",
    repeatCta: "Hacerlo otra vez",
    todayPickCta: "Hacer la eleccion de hoy",
    comfortTitle: "Nivel de comodidad",
    comfortLevels: [
      { id: "seated" as MovementComfortLevelId, label: "Solo sentado" },
      { id: "supported" as MovementComfortLevelId, label: "Con silla" },
      { id: "active" as MovementComfortLevelId, label: "Un poco activo" },
    ],
    swapPrompt: "Quieres otra sensacion?",
    swapEasier: "Algo mas facil",
    swapCalm: "Algo mas calmado",
    swapLegs: "Para piernas",
    moreTitle: "Mas ejercicios suaves",
    detail: "Mira las 12 rutinas con foto aqui mismo.",
    cta: "Mostrar todos",
    collapseCta: "Mostrar menos",
    lastUsedBadge: "Ultimo",
    groupPrompt: "Elige un enfoque",
    groupCount: (count: number) => `${count} opciones`,
    cards: getMovementExerciseCards(language),
    groups: [
      { id: "mobility" as MovementExerciseGroupId, title: "Movilidad", subtitle: "Suelta zonas rigidas con movimientos pequenos y comodos." },
      { id: "balance" as MovementExerciseGroupId, title: "Equilibrio", subtitle: "Practica movimientos estables y con apoyo en casa." },
      { id: "strength" as MovementExerciseGroupId, title: "Fuerza", subtitle: "Gana confianza para levantarte, alcanzar y moverte." },
      { id: "calm" as MovementExerciseGroupId, title: "Calma", subtitle: "Calma la respiracion y termina suavemente." },
    ],
  };
}

export function getMovementSessionUiCopy(language: MovementExerciseLanguage) {
  if (language === "en") {
    return {
      sessionStarted: "Session started",
      stepsTitle: "Move with me",
      safety: "Move gently. Stop if you feel pain, dizzy, or short of breath.",
      done: "Done, log 10 min",
      saving: "Saving...",
      logged: (title: string) => `${title} logged for 10 min.`,
      error: "Could not save. Try again.",
      loggedBadge: "Logged",
    };
  }

  if (language === "de") {
    return {
      sessionStarted: "Sitzung gestartet",
      stepsTitle: "Beweg dich mit mir",
      safety: "Bewege dich sanft. Stopp, wenn du Schmerzen hast, schwindelig wirst oder ausser Atem kommst.",
      done: "Fertig, 10 Min speichern",
      saving: "Speichern...",
      logged: (title: string) => `${title} fuer 10 Min gespeichert.`,
      error: "Speichern fehlgeschlagen. Bitte erneut versuchen.",
      loggedBadge: "Gespeichert",
    };
  }

  if (language === "fr") {
    return {
      sessionStarted: "Seance commencee",
      stepsTitle: "Bougez avec moi",
      safety: "Bougez doucement. Arretez si vous avez mal, si vous avez des vertiges ou si vous etes essouffle.",
      done: "Termine, noter 10 min",
      saving: "Enregistrement...",
      logged: (title: string) => `${title} note pendant 10 min.`,
      error: "Impossible d'enregistrer. Reessayez.",
      loggedBadge: "Note",
    };
  }

  if (language === "it") {
    return {
      sessionStarted: "Sessione iniziata",
      stepsTitle: "Muoviti con me",
      safety: "Muoviti con dolcezza. Fermati se senti dolore, capogiri o mancanza di respiro.",
      done: "Fatto, registra 10 min",
      saving: "Salvataggio...",
      logged: (title: string) => `${title} registrato per 10 min.`,
      error: "Impossibile salvare. Riprova.",
      loggedBadge: "Registrato",
    };
  }

  if (language === "pt") {
    return {
      sessionStarted: "Sessao iniciada",
      stepsTitle: "Mexa-se comigo",
      safety: "Movimente-se suavemente. Pare se sentir dor, tonturas ou falta de ar.",
      done: "Concluido, registar 10 min",
      saving: "A guardar...",
      logged: (title: string) => `${title} registado por 10 min.`,
      error: "Nao foi possivel guardar. Tente novamente.",
      loggedBadge: "Registado",
    };
  }

  return {
    sessionStarted: "Sesion iniciada",
    stepsTitle: "Muevete conmigo",
    safety: "Muevete con suavidad. Para si sientes dolor, mareo o falta de aire.",
    done: "Listo, registrar 10 min",
    saving: "Guardando...",
    logged: (title: string) => `${title} registrado durante 10 min.`,
    error: "No se pudo guardar. Intentalo de nuevo.",
    loggedBadge: "Registrado",
  };
}
