export type BrainCoachArea =
  | "memory"
  | "attention"
  | "executive_function"
  | "language"
  | "processing_speed"
  | "spatial_navigation"
  | "sensory"
  | "knowledge";

export const DOMAIN_TO_AREA: Record<string, BrainCoachArea | null> = {
  memory: "memory",
  episodic_memory: "memory",
  visual_memory: "memory",
  associative_memory: "memory",
  working_memory: "memory",
  prospective_memory: "memory",
  social_recognition: "memory",
  attention: "attention",
  auditory_attention: "attention",
  executive_function: "executive_function",
  divergent_thinking: "language",
  language: "language",
  processing_speed: "processing_speed",
  spatial_navigation: "spatial_navigation",
  sensory: "sensory",
  knowledge: "knowledge",
  arousal_regulation: null,
};

export const NON_GAME_ACTIVITY_TYPES = new Set(["breath_garden", "relax_breathe"]);
export const PARTICIPATION_ONLY_ACTIVITY_TYPES = new Set(["scent_memory", "curious_minds"]);

export function areaForDomain(domain?: string | null): BrainCoachArea | null {
  if (!domain || !Object.prototype.hasOwnProperty.call(DOMAIN_TO_AREA, domain)) return null;
  return DOMAIN_TO_AREA[domain] ?? null;
}

export function reportAccuracy(activityType?: string | null, accuracyPct?: number | null): number | null {
  if (!activityType || PARTICIPATION_ONLY_ACTIVITY_TYPES.has(activityType)) return null;
  return typeof accuracyPct === "number" && Number.isFinite(accuracyPct) ? accuracyPct : null;
}
