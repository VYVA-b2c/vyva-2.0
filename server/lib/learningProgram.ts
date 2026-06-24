export const LEARNING_PROGRAM_DAYS = 7;

export const DEFAULT_LEARNING_INTERESTS = [
  "science",
  "language",
  "arts",
  "general_knowledge",
  "music",
  "history",
  "nature",
  "technology",
] as const;

export type LearningInterest = string;

export type LearningLessonCandidate = {
  id: string;
  categorySlug: string;
  language: string;
  status: string;
  isActive: boolean;
  estimatedMinutes?: number | null;
  title?: string;
};

export type LearningProgramPreferenceInput = {
  interests?: string[] | null;
  pace?: string | null;
  dailyTime?: string | null;
  lessonLengthMinutes?: number | null;
  language?: string | null;
};

export type NormalizedLearningProgramPreferences = {
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  dailyTime: string;
  lessonLengthMinutes: number;
  language: string;
};

const defaultInterestSet = new Set<string>(DEFAULT_LEARNING_INTERESTS);
const supportedProgramLanguages = new Set(["en", "es", "fr", "de", "it", "pt"]);
const fallbackInterest = "general_knowledge";
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalizeAllowedInterests(allowedInterests?: string[] | null): string[] {
  if (!Array.isArray(allowedInterests) || allowedInterests.length === 0) {
    return [...DEFAULT_LEARNING_INTERESTS];
  }
  const normalized = allowedInterests
    .map((value) => typeof value === "string" ? value.trim().toLowerCase() : "")
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function normalizeLearningLanguage(value: unknown): string {
  if (typeof value !== "string") return "en";
  const language = value.trim().toLowerCase().split("-")[0];
  return supportedProgramLanguages.has(language) ? language : "en";
}

export function normalizeLearningInterests(values: unknown, allowedInterests?: string[] | null): string[] {
  const allowed = normalizeAllowedInterests(allowedInterests);
  const allowedSet = new Set(allowed.length ? allowed : [...defaultInterestSet]);
  const fallback = allowedSet.has(fallbackInterest) ? fallbackInterest : allowed[0] ?? fallbackInterest;
  if (!Array.isArray(values)) return [fallback];

  const selected = values
    .map((value) => typeof value === "string" ? value.trim().toLowerCase() : "")
    .filter((value) => allowedSet.has(value));
  const unique = [...new Set(selected)];
  return unique.length > 0 ? unique : [fallback];
}

export function normalizeLearningPreferences(input: LearningProgramPreferenceInput, allowedInterests?: string[] | null): NormalizedLearningProgramPreferences {
  const pace = input.pace === "steady" || input.pace === "curious" ? input.pace : "gentle";
  const minutes = Number(input.lessonLengthMinutes);
  const lessonLengthMinutes = Number.isFinite(minutes) ? Math.min(8, Math.max(1, Math.round(minutes))) : 3;
  const dailyTime = typeof input.dailyTime === "string" && timePattern.test(input.dailyTime) ? input.dailyTime : "09:00";

  return {
    interests: normalizeLearningInterests(input.interests, allowedInterests),
    pace,
    dailyTime,
    lessonLengthMinutes,
    language: normalizeLearningLanguage(input.language),
  };
}

function isPublishedLesson(lesson: LearningLessonCandidate) {
  return lesson.status === "published" && lesson.isActive;
}

function lessonLanguageMatches(lesson: LearningLessonCandidate, language: string) {
  return normalizeLearningLanguage(lesson.language) === language;
}

function pickBestLesson(input: {
  lessons: LearningLessonCandidate[];
  selectedIds: Set<string>;
  recentIds: Set<string>;
  categorySlug: string;
  language: string;
}): LearningLessonCandidate | null {
  const { lessons, selectedIds, recentIds, categorySlug, language } = input;
  const phases = [
    (lesson: LearningLessonCandidate) => lesson.categorySlug === categorySlug && lessonLanguageMatches(lesson, language) && !recentIds.has(lesson.id),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === categorySlug && lessonLanguageMatches(lesson, "en") && !recentIds.has(lesson.id),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === fallbackInterest && lessonLanguageMatches(lesson, language) && !recentIds.has(lesson.id),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === fallbackInterest && lessonLanguageMatches(lesson, "en") && !recentIds.has(lesson.id),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === categorySlug && lessonLanguageMatches(lesson, language),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === categorySlug && lessonLanguageMatches(lesson, "en"),
    (lesson: LearningLessonCandidate) => lesson.categorySlug === fallbackInterest && (lessonLanguageMatches(lesson, language) || lessonLanguageMatches(lesson, "en")),
    () => true,
  ];

  for (const phase of phases) {
    const match = lessons.find((lesson) => !selectedIds.has(lesson.id) && phase(lesson));
    if (match) return match;
  }

  return null;
}

export function selectLessonsForLearningProgram(input: {
  lessons: LearningLessonCandidate[];
  interests: string[];
  language: string;
  allowedInterests?: string[] | null;
  recentlyCompletedLessonIds?: string[];
  days?: number;
}): LearningLessonCandidate[] {
  const interests = normalizeLearningInterests(input.interests, input.allowedInterests);
  const language = normalizeLearningLanguage(input.language);
  const recentIds = new Set(input.recentlyCompletedLessonIds ?? []);
  const selectedIds = new Set<string>();
  const publishedLessons = input.lessons.filter(isPublishedLesson);
  const days = Math.max(1, input.days ?? LEARNING_PROGRAM_DAYS);
  const selected: LearningLessonCandidate[] = [];

  for (let index = 0; index < days; index += 1) {
    const categorySlug = interests[index % interests.length];
    const lesson = pickBestLesson({
      lessons: publishedLessons,
      selectedIds,
      recentIds,
      categorySlug,
      language,
    });
    if (!lesson) break;
    selected.push(lesson);
    selectedIds.add(lesson.id);
  }

  return selected;
}

export function isoDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function utcDateFromKey(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
