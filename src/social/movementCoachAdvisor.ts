import { getMovementExerciseLanguage, type MovementExerciseLanguage } from "./movementExercises";

export const MOVEMENT_COACH_SLUG = "amara";

export type MovementCoachSlug = typeof MOVEMENT_COACH_SLUG;

type MovementCoachCopy = {
  name: string;
  role: string;
  shortRole: string;
  intro: string;
  starter: string;
  disclaimerText: string;
  recencyLabel: string;
  routineTitle: string;
  routineBody: string;
  allRoutines: string;
  openRoutine: string;
  localReply: string;
};

const movementCoachCopy: Record<MovementExerciseLanguage, MovementCoachCopy> = {
  en: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Movement and calm",
    intro: "Movement, breathing, energy, and balance.",
    starter: "Pick a gentle wellness routine.",
    disclaimerText: "Stop if you feel pain, dizzy, or short of breath.",
    recencyLabel: "Wellness routines",
    routineTitle: "Pick a routine",
    routineBody: "Choose one, or ask VYVA by voice.",
    allRoutines: "See all gentle activities",
    openRoutine: "Open",
    localReply: "I can help you choose a gentle routine. Try chair yoga if you want seated movement, Tai chi for balance, or sit-to-stand for everyday strength.",
  },
  es: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Movimiento y calma",
    intro: "Movimiento, respiracion, energia y equilibrio.",
    starter: "Elige una rutina suave de bienestar.",
    disclaimerText: "Para si sientes dolor, mareo o falta de aire.",
    recencyLabel: "Rutinas de bienestar",
    routineTitle: "Elige una rutina",
    routineBody: "Elige una, o pregunta a VYVA por voz.",
    allRoutines: "Ver todas las actividades suaves",
    openRoutine: "Abrir",
    localReply: "Puedo ayudarte a elegir una rutina suave. Prueba yoga en silla si quieres algo sentado, Tai chi para equilibrio, o sentarse y levantarse para fuerza diaria.",
  },
  de: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Bewegung und Ruhe",
    intro: "Bewegung, Atmung, Energie und Balance.",
    starter: "Waehle eine sanfte Wellness-Routine.",
    disclaimerText: "Stopp bei Schmerzen, Schwindel oder Atemnot.",
    recencyLabel: "Wellness-Routinen",
    routineTitle: "Uebung waehlen",
    routineBody: "Waehle eine, oder frage VYVA per Stimme.",
    allRoutines: "Alle sanften Aktivitaeten ansehen",
    openRoutine: "Oeffnen",
    localReply: "Ich kann eine sanfte Uebung vorschlagen. Stuhl-Yoga passt fuer Bewegung im Sitzen, Tai Chi fuer Balance, und Aufstehen und Setzen fuer Alltagskraft.",
  },
  fr: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Mouvement et calme",
    intro: "Mouvement, respiration, energie et equilibre.",
    starter: "Choisissez une routine bien-etre douce.",
    disclaimerText: "Arretez si vous avez mal, des vertiges ou le souffle court.",
    recencyLabel: "Routines bien-etre",
    routineTitle: "Choisir une routine",
    routineBody: "Choisissez-en une, ou demandez a VYVA par voix.",
    allRoutines: "Voir toutes les activites douces",
    openRoutine: "Ouvrir",
    localReply: "Je peux aider a choisir une routine douce. Essayez le yoga sur chaise pour bouger assis, le Tai chi pour l'equilibre, ou assis-debout pour la force du quotidien.",
  },
  it: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Movimento e calma",
    intro: "Movimento, respiro, energia ed equilibrio.",
    starter: "Scegli una routine dolce di benessere.",
    disclaimerText: "Fermati se senti dolore, capogiri o mancanza di respiro.",
    recencyLabel: "Routine di benessere",
    routineTitle: "Scegli una routine",
    routineBody: "Scegline una, o chiedi a VYVA a voce.",
    allRoutines: "Vedi tutte le attivita dolci",
    openRoutine: "Apri",
    localReply: "Posso aiutarti a scegliere una routine dolce. Prova yoga sulla sedia per movimento seduto, Tai chi per equilibrio, o sedersi e alzarsi per forza quotidiana.",
  },
  pt: {
    name: "Wellness",
    role: "Coach",
    shortRole: "Movimento e calma",
    intro: "Movimento, respiracao, energia e equilibrio.",
    starter: "Escolha uma rotina suave de bem-estar.",
    disclaimerText: "Pare se sentir dor, tonturas ou falta de ar.",
    recencyLabel: "Rotinas de bem-estar",
    routineTitle: "Escolha uma rotina",
    routineBody: "Escolha uma, ou pergunte a VYVA por voz.",
    allRoutines: "Ver todas as atividades suaves",
    openRoutine: "Abrir",
    localReply: "Posso ajudar a escolher uma rotina suave. Experimente ioga na cadeira para movimento sentado, Tai chi para equilibrio, ou sentar e levantar para forca diaria.",
  },
};

export function getMovementCoachLanguage(language?: string | null): MovementExerciseLanguage {
  return getMovementExerciseLanguage(language);
}

export function getMovementCoachCopy(language?: string | null): MovementCoachCopy {
  return movementCoachCopy[getMovementCoachLanguage(language)];
}

export function isMovementCoachSlug(value: string | null | undefined): value is MovementCoachSlug {
  return value === MOVEMENT_COACH_SLUG;
}
