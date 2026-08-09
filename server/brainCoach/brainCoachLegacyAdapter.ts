import { getBrainCoachActivityCatalog } from "../lib/brainCoachPlan.js";

export type BrainCoachLegacyActionType =
  | "brain.activity"
  | "brain.memory_game"
  | "brain.relax_breathe"
  | "brain.focus"
  | "brain.learn"
  | "brain.senses";

export type BrainCoachActivityFamily =
  | "hub"
  | "memory"
  | "attention"
  | "executive_function"
  | "language"
  | "senses"
  | "relaxation"
  | "learning";

export type BrainCoachLegacyOutcome =
  | {
      kind: "supported_action";
      actionType: BrainCoachLegacyActionType;
      route: string;
      title: string;
      summary: string;
      activityFamily: BrainCoachActivityFamily;
      activityType?: string;
      activityTitle?: string;
      parityReference: "voice_action_registry" | "brain_coach_activity_catalog";
    }
  | {
      kind: "fallback_to_legacy";
      reasonCode:
        | "brain_coach_unsupported_activity"
        | "brain_coach_not_recognized"
        | "brain_coach_client_only";
      parityReference: "legacy_brain_coach_agent";
    };

function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function supportedCatalogActivityByType(activityType: string) {
  return getBrainCoachActivityCatalog().find((activity) =>
    normalizeText(activity.activityType) === normalizeText(activityType));
}

function supportedCatalogActivityByText(normalized: string) {
  return getBrainCoachActivityCatalog().find((activity) => {
    const title = normalizeText(activity.title);
    const activityType = normalizeText(activity.activityType);
    return normalized.includes(title) || normalized.includes(activityType);
  });
}

function activityActionTypeForRoute(route: string): BrainCoachLegacyActionType {
  if (route.startsWith("/memory-games")) return "brain.memory_game";
  if (route.startsWith("/attention-boosters")) return "brain.focus";
  if (route.startsWith("/senses")) return "brain.senses";
  if (route === "/activities/relax-breathe") return "brain.relax_breathe";
  if (route === "/learn") return "brain.learn";
  return "brain.activity";
}

function activityFamilyForDomain(domain: string, secondaryDomain?: string): BrainCoachActivityFamily {
  const combined = `${domain} ${secondaryDomain ?? ""}`;
  if (combined.includes("executive")) return "executive_function";
  if (combined.includes("attention") || combined.includes("processing_speed")) return "attention";
  if (combined.includes("language")) return "language";
  if (combined.includes("arousal")) return "relaxation";
  if (combined.includes("episodic") || combined.includes("memory")) return "memory";
  return "hub";
}

function catalogOutcome(activityType: string): BrainCoachLegacyOutcome | null {
  const activity = supportedCatalogActivityByType(activityType);
  if (!activity) return null;
  return {
    kind: "supported_action",
    actionType: activityActionTypeForRoute(activity.route),
    route: activity.route,
    title: activity.title,
    summary: `Opening ${activity.title} from the existing Brain Coach activity catalog.`,
    activityFamily: activityFamilyForDomain(activity.domain, activity.secondaryDomain),
    activityType: activity.activityType,
    activityTitle: activity.title,
    parityReference: "brain_coach_activity_catalog",
  };
}

export function resolveBrainCoachLegacyOutcome(utterance: string): BrainCoachLegacyOutcome {
  const normalized = normalizeText(utterance);
  if (!normalized) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "brain_coach_not_recognized",
      parityReference: "legacy_brain_coach_agent",
    };
  }

  if (hasAny(normalized, ["scrabble", "trivia", "crossword", "sudoku", "chess"])) {
    return {
      kind: "fallback_to_legacy",
      reasonCode: "brain_coach_unsupported_activity",
      parityReference: "legacy_brain_coach_agent",
    };
  }

  const explicitCatalogMatch = supportedCatalogActivityByText(normalized);
  if (explicitCatalogMatch) {
    return catalogOutcome(explicitCatalogMatch.activityType)!;
  }

  if (hasAny(normalized, ["memory game", "test my memory", "memory practice", "memoria", "juego de memoria"])) {
    return {
      kind: "supported_action",
      actionType: "brain.memory_game",
      route: "/memory-games",
      title: "Memory games",
      summary: "Opening memory games so the Brain Coach can keep the user company while playing.",
      activityFamily: "memory",
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, ["focus", "attention", "concentrate", "reflex", "concentracion", "atencion"])) {
    return {
      kind: "supported_action",
      actionType: "brain.focus",
      route: "/attention-boosters",
      title: "Focus practice",
      summary: "Opening attention boosters for a short focus exercise.",
      activityFamily: "attention",
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, ["relax", "breathe", "breathing", "calm", "relaj", "respirar", "calma"])) {
    return {
      kind: "supported_action",
      actionType: "brain.relax_breathe",
      route: "/activities/relax-breathe",
      title: "Relax and breathe",
      summary: "Opening a calm breathing activity with VYVA as a gentle coach.",
      activityFamily: "relaxation",
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, ["learn", "teach me", "learning", "aprender", "ensenar"])) {
    return {
      kind: "supported_action",
      actionType: "brain.learn",
      route: "/learn",
      title: "Learning",
      summary: "Opening learning activities so VYVA can suggest a topic.",
      activityFamily: "learning",
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, ["senses", "sensory", "smell", "sound", "listen closely", "sentidos", "sensorial", "olfato", "sonido"])) {
    return {
      kind: "supported_action",
      actionType: "brain.senses",
      route: "/senses",
      title: "Senses practice",
      summary: "Opening sensory activities for gentle smell, sound, and association practice.",
      activityFamily: "senses",
      parityReference: "voice_action_registry",
    };
  }

  if (hasAny(normalized, ["brain", "cognitive", "cognition", "mind exercise", "mental exercise", "brain exercise", "activity", "activities", "exercise", "quiz", "game", "juego", "actividad"])) {
    return {
      kind: "supported_action",
      actionType: "brain.activity",
      route: "/mind-memory",
      title: "Mind & Memory",
      summary: "Opening Mind & Memory for games, practice, and friendly brain-coach support.",
      activityFamily: "hub",
      parityReference: "voice_action_registry",
    };
  }

  return {
    kind: "fallback_to_legacy",
    reasonCode: "brain_coach_not_recognized",
    parityReference: "legacy_brain_coach_agent",
  };
}
