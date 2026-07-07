import type { BreathingExerciseRow, BreathingSessionRow, BreathingUserPreferenceRow } from "../../shared/breathingSchema.js";

export type BreathingIntent = {
  mood?: string;
  purpose?: string;
  difficulty?: number | "easy" | "medium" | "harder";
  durationMinutes?: number;
  mode?: "voice" | "visual";
  safetyFlags?: string[];
  freeText?: string;
};

export type BreathingPhase = {
  key: string;
  title: string;
  instruction: string;
  cue: string;
  seconds: number;
};

export type BreathingExercise = {
  id?: string;
  slug: string;
  name: string;
  description: string;
  purposes: string[];
  moodTags: string[];
  difficulty: number;
  durationOptions: number[];
  defaultDurationMinutes: number;
  pattern: Record<string, unknown>;
  safetyNotes: string[];
  contraindications: string[];
  voiceStyle: string;
  phases: BreathingPhase[];
  progression: Record<string, unknown>;
  language: string;
};

export type BreathingPreferenceSnapshot = Partial<Pick<
  BreathingUserPreferenceRow,
  | "preferred_difficulty"
  | "preferred_duration_minutes"
  | "preferred_voice_style"
  | "preferred_mode"
  | "favorite_exercises"
  | "disliked_exercises"
  | "safety_flags"
  | "last_completed_exercise_slug"
  | "last_mood"
>>;

export type BreathingPlan = {
  exerciseSlug: string;
  title: string;
  description: string;
  purpose: string;
  difficulty: number;
  durationMinutes: number;
  pattern: Record<string, unknown>;
  phases: BreathingPhase[];
  safetyNotes: string[];
  voiceStyle: string;
  voicePrompt: string;
};

export type BreathingRecommendationOption = {
  exerciseSlug: string;
  name: string;
  description: string;
  difficulty: number;
  durationMinutes: number;
  why: string;
  plan: BreathingPlan;
};

export type BreathingRecommendation = {
  options: BreathingRecommendationOption[];
  recommended: BreathingRecommendationOption | null;
  safetyBlock: boolean;
  safetyMessage?: string;
};

const SAFETY_STOP_TERMS = [
  "chest pain",
  "chest tightness",
  "severe dizziness",
  "dizzy",
  "faint",
  "shortness of breath",
  "cannot breathe",
  "painful breathing",
  "blue lips",
];

export const DEFAULT_BREATHING_EXERCISES: BreathingExercise[] = [
  {
    slug: "gentle-calm-breath",
    name: "Gentle Calm Breath",
    description: "A simple calming session with a longer exhale.",
    purposes: ["calm", "stress", "anxiety", "settle"],
    moodTags: ["worried", "tense", "overwhelmed", "restless"],
    difficulty: 1,
    durationOptions: [2, 3, 5],
    defaultDurationMinutes: 3,
    pattern: { inhale: 4, exhale: 6, rounds: 8, label: "Longer exhale" },
    safetyNotes: ["Stop if breathing feels painful, difficult, dizzy, or unusual."],
    contraindications: ["acute shortness of breath", "chest pain", "severe dizziness"],
    voiceStyle: "gentle",
    phases: [
      { key: "arrive", title: "Arrive", instruction: "Sit comfortably and feel the chair supporting you.", cue: "Settle in.", seconds: 30 },
      { key: "breathe", title: "Breathe slowly", instruction: "Breathe in gently. Breathe out a little longer.", cue: "In 4, out 6.", seconds: 120 },
      { key: "return", title: "Return", instruction: "Notice the room and take one normal breath.", cue: "Come back gently.", seconds: 30 },
    ],
    progression: { afterComfortableCompletions: 3, offerDifficulty: 2 },
    language: "en",
  },
  {
    slug: "sleep-soft-breath",
    name: "Sleep Soft Breath",
    description: "A slower wind-down session for bedtime.",
    purposes: ["sleep", "rest", "wind_down"],
    moodTags: ["tired", "restless", "awake", "wired"],
    difficulty: 1,
    durationOptions: [3, 5, 8],
    defaultDurationMinutes: 5,
    pattern: { inhale: 4, exhale: 7, rounds: 10, label: "Soft bedtime exhale" },
    safetyNotes: ["Keep the breath comfortable. Do not hold your breath if it feels unpleasant."],
    contraindications: ["acute shortness of breath", "chest pain", "severe dizziness"],
    voiceStyle: "soft",
    phases: [
      { key: "settle", title: "Settle", instruction: "Let your eyes rest and soften your jaw.", cue: "Quiet body.", seconds: 45 },
      { key: "breathe", title: "Slow down", instruction: "Breathe in softly. Let the breath leave slowly.", cue: "In 4, out 7.", seconds: 210 },
      { key: "rest", title: "Rest", instruction: "Let the breath return to normal.", cue: "No effort now.", seconds: 45 },
    ],
    progression: { afterComfortableCompletions: 4, offerDuration: 8 },
    language: "en",
  },
  {
    slug: "focus-reset-breath",
    name: "Focus Reset Breath",
    description: "A short, steady breathing reset before a task.",
    purposes: ["focus", "reset", "clarity"],
    moodTags: ["scattered", "foggy", "busy", "distracted"],
    difficulty: 2,
    durationOptions: [2, 3, 4],
    defaultDurationMinutes: 3,
    pattern: { inhale: 4, exhale: 4, rounds: 8, label: "Even breathing" },
    safetyNotes: ["Stay easy. If the rhythm feels uncomfortable, return to normal breathing."],
    contraindications: ["acute shortness of breath", "chest pain", "severe dizziness"],
    voiceStyle: "clear",
    phases: [
      { key: "orient", title: "Orient", instruction: "Choose one point to rest your eyes on.", cue: "One calm point.", seconds: 30 },
      { key: "breathe", title: "Even breath", instruction: "Breathe in and out evenly, without strain.", cue: "In 4, out 4.", seconds: 120 },
      { key: "choose", title: "Choose next", instruction: "Name the next small thing you will do.", cue: "One next step.", seconds: 30 },
    ],
    progression: { afterComfortableCompletions: 3, offerDifficulty: 3 },
    language: "en",
  },
  {
    slug: "steady-box-breath",
    name: "Steady Box Breath",
    description: "A more structured breathing pattern for users who like clear rhythm.",
    purposes: ["steady", "focus", "control"],
    moodTags: ["tense", "busy", "scattered"],
    difficulty: 3,
    durationOptions: [3, 5],
    defaultDurationMinutes: 3,
    pattern: { inhale: 4, holdAfterInhale: 2, exhale: 4, holdAfterExhale: 2, rounds: 6, label: "Box breath, gentle holds" },
    safetyNotes: ["Skip the holds if they feel uncomfortable. Never force the breath."],
    contraindications: ["acute shortness of breath", "chest pain", "severe dizziness", "breath holding discomfort"],
    voiceStyle: "steady",
    phases: [
      { key: "prepare", title: "Prepare", instruction: "We will use a gentle rhythm. You can skip any hold.", cue: "Easy rhythm.", seconds: 30 },
      { key: "box", title: "Steady rhythm", instruction: "Breathe in, small pause, breathe out, small pause.", cue: "In, pause, out, pause.", seconds: 120 },
      { key: "release", title: "Release", instruction: "Let your breathing become natural again.", cue: "Natural breath.", seconds: 30 },
    ],
    progression: { requiresComfortableCompletions: 3 },
    language: "en",
  },
];

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
    : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function phasesFromContent(value: unknown, fallback: BreathingExercise): BreathingPhase[] {
  const content = objectValue(value);
  const phases = Array.isArray(content.phases) ? content.phases : [];
  const normalized = phases.map((phase, index): BreathingPhase | null => {
    const item = objectValue(phase);
    const title = typeof item.title === "string" ? item.title : "";
    const instruction = typeof item.instruction === "string" ? item.instruction : "";
    if (!title || !instruction) return null;
    return {
      key: typeof item.key === "string" ? item.key : `phase-${index + 1}`,
      title,
      instruction,
      cue: typeof item.cue === "string" ? item.cue : title,
      seconds: Math.max(15, Math.round(Number(item.seconds) || fallback.phases[index]?.seconds || 60)),
    };
  }).filter((phase): phase is BreathingPhase => Boolean(phase));

  return normalized.length > 0 ? normalized : fallback.phases;
}

export function breathingExerciseFromRow(row: BreathingExerciseRow): BreathingExercise {
  const fallback = DEFAULT_BREATHING_EXERCISES.find((exercise) => exercise.slug === row.slug) ?? DEFAULT_BREATHING_EXERCISES[0];
  const durationOptions = numberArray(row.duration_options);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    purposes: stringArray(row.purposes),
    moodTags: stringArray(row.mood_tags),
    difficulty: Math.max(1, Math.min(5, Number(row.difficulty) || 1)),
    durationOptions: durationOptions.length > 0 ? durationOptions : fallback.durationOptions,
    defaultDurationMinutes: Math.max(1, Math.round(Number(row.default_duration_minutes) || fallback.defaultDurationMinutes)),
    pattern: objectValue(row.pattern),
    safetyNotes: stringArray(row.safety_notes),
    contraindications: stringArray(row.contraindications),
    voiceStyle: row.voice_style || fallback.voiceStyle,
    phases: phasesFromContent(row.content, fallback),
    progression: objectValue(row.progression),
    language: row.language || "en",
  };
}

function normalizedTerms(...values: Array<unknown>): string[] {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string") return value.split(/[\s,;/]+/);
      return [];
    })
    .map((value) => String(value).trim().toLowerCase().replace(/[_-]+/g, " "))
    .filter(Boolean);
}

function requestedDifficulty(intent: BreathingIntent, preferences?: BreathingPreferenceSnapshot | null) {
  if (typeof intent.difficulty === "number") return Math.max(1, Math.min(5, Math.round(intent.difficulty)));
  if (intent.difficulty === "medium") return 2;
  if (intent.difficulty === "harder") return 3;
  return Math.max(1, Math.min(5, Number(preferences?.preferred_difficulty) || 1));
}

function requestedDuration(intent: BreathingIntent, preferences?: BreathingPreferenceSnapshot | null) {
  return Math.max(1, Math.min(20, Math.round(Number(intent.durationMinutes || preferences?.preferred_duration_minutes || 3))));
}

function closestDuration(exercise: BreathingExercise, requestedMinutes: number) {
  return [...exercise.durationOptions].sort((a, b) => Math.abs(a - requestedMinutes) - Math.abs(b - requestedMinutes))[0]
    ?? exercise.defaultDurationMinutes
    ?? requestedMinutes;
}

function scalePhases(phases: BreathingPhase[], targetMinutes: number): BreathingPhase[] {
  const targetSeconds = Math.max(60, targetMinutes * 60);
  const currentSeconds = phases.reduce((sum, phase) => sum + phase.seconds, 0) || targetSeconds;
  const scale = targetSeconds / currentSeconds;
  return phases.map((phase) => ({
    ...phase,
    seconds: Math.max(15, Math.round(phase.seconds * scale)),
  }));
}

function hasTermOverlap(left: string[], right: string[]) {
  return left.some((term) => right.some((candidate) => candidate.includes(term) || term.includes(candidate)));
}

function safetyStopReason(intent: BreathingIntent, preferences?: BreathingPreferenceSnapshot | null) {
  const terms = normalizedTerms(intent.freeText, intent.safetyFlags, preferences?.safety_flags);
  const matched = SAFETY_STOP_TERMS.find((term) => hasTermOverlap([term], terms));
  return matched ?? null;
}

export function buildBreathingPlan(
  exercise: BreathingExercise,
  intent: BreathingIntent = {},
  preferences?: BreathingPreferenceSnapshot | null,
): BreathingPlan {
  const durationMinutes = closestDuration(exercise, requestedDuration(intent, preferences));
  const purpose = normalizedTerms(intent.purpose)[0] ?? exercise.purposes[0] ?? "calm";
  const phases = scalePhases(exercise.phases, durationMinutes);
  const voicePrompt = [
    `Guide a ${durationMinutes} minute ${exercise.name} breathing session.`,
    `Purpose: ${purpose}. Difficulty ${exercise.difficulty}.`,
    `Use a ${exercise.voiceStyle} voice style.`,
    "Start by confirming the user is comfortable.",
    "Guide each phase slowly and leave quiet space.",
    "The user may interrupt at any time to slow down, stop, or change the plan.",
    `Safety: ${exercise.safetyNotes.join(" ")}`,
  ].join(" ");

  return {
    exerciseSlug: exercise.slug,
    title: exercise.name,
    description: exercise.description,
    purpose,
    difficulty: exercise.difficulty,
    durationMinutes,
    pattern: exercise.pattern,
    phases,
    safetyNotes: exercise.safetyNotes,
    voiceStyle: exercise.voiceStyle,
    voicePrompt,
  };
}

export function recommendBreathingExercises(input: {
  intent?: BreathingIntent;
  preferences?: BreathingPreferenceSnapshot | null;
  recentSessions?: BreathingSessionRow[];
  exercises?: BreathingExercise[];
  limit?: number;
}): BreathingRecommendation {
  const intent = input.intent ?? {};
  const preferences = input.preferences ?? null;
  const safetyReason = safetyStopReason(intent, preferences);

  if (safetyReason) {
    return {
      options: [],
      recommended: null,
      safetyBlock: true,
      safetyMessage: "Breathing practice is not the right next step if breathing feels painful, difficult, dizzy, or unusual. Stop and seek help.",
    };
  }

  const desiredDifficulty = requestedDifficulty(intent, preferences);
  const desiredDuration = requestedDuration(intent, preferences);
  const terms = normalizedTerms(intent.purpose, intent.mood, intent.freeText);
  const favorite = new Set(stringArray(preferences?.favorite_exercises));
  const disliked = new Set(stringArray(preferences?.disliked_exercises));
  const recent = new Set((input.recentSessions ?? []).slice(0, 3).map((session) => session.exercise_slug));
  const limit = Math.max(1, Math.min(input.limit ?? 3, 5));

  const options = (input.exercises?.length ? input.exercises : DEFAULT_BREATHING_EXERCISES)
    .filter((exercise) => !disliked.has(exercise.slug))
    .map((exercise) => {
      let score = 0;
      const purposeTerms = normalizedTerms(exercise.purposes);
      const moodTerms = normalizedTerms(exercise.moodTags);
      if (terms.length === 0) score += exercise.slug === preferences?.last_completed_exercise_slug ? 1 : 0.5;
      if (hasTermOverlap(terms, purposeTerms)) score += 5;
      if (hasTermOverlap(terms, moodTerms)) score += 4;
      score += Math.max(0, 3 - Math.abs(exercise.difficulty - desiredDifficulty));
      score += Math.max(0, 2 - Math.abs(closestDuration(exercise, desiredDuration) - desiredDuration));
      if (favorite.has(exercise.slug)) score += 2;
      if (recent.has(exercise.slug)) score -= 0.5;
      if (exercise.difficulty > desiredDifficulty + 1) score -= 2;

      const plan = buildBreathingPlan(exercise, intent, preferences);
      const why = hasTermOverlap(terms, purposeTerms)
        ? `Matches ${plan.purpose}`
        : exercise.difficulty <= desiredDifficulty
          ? "Gentle fit for today"
          : "A slightly stronger option";

      return {
        score,
        option: {
          exerciseSlug: exercise.slug,
          name: exercise.name,
          description: exercise.description,
          difficulty: exercise.difficulty,
          durationMinutes: plan.durationMinutes,
          why,
          plan,
        },
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.option);

  return {
    options,
    recommended: options[0] ?? null,
    safetyBlock: false,
  };
}
