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
  frequency?: string | null;
  durationWeeks?: number | string | null;
  dailyTime?: string | null;
  lessonLengthMinutes?: number | null;
  language?: string | null;
};

export type LearningProgramFrequency = "daily" | "three_times_week" | "weekly";
export type LearningProgramDurationWeeks = 1 | 4 | 12;

export type NormalizedLearningProgramPreferences = {
  interests: string[];
  pace: "gentle" | "steady" | "curious";
  frequency: LearningProgramFrequency;
  durationWeeks: LearningProgramDurationWeeks;
  dailyTime: string;
  lessonLengthMinutes: number;
  language: string;
};

const defaultInterestSet = new Set<string>(DEFAULT_LEARNING_INTERESTS);
const supportedProgramLanguages = new Set(["en", "es", "fr", "de", "it", "pt"]);
const fallbackInterest = "general_knowledge";
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeLearningFrequency(value: unknown, fallback: LearningProgramFrequency = "three_times_week"): LearningProgramFrequency {
  if (value === "daily" || value === "three_times_week" || value === "weekly") return value;
  return fallback;
}

export function normalizeLearningDurationWeeks(value: unknown): LearningProgramDurationWeeks {
  const weeks = Number(value);
  if (weeks === 1) return 1;
  if (weeks === 4) return 4;
  if (weeks === 12) return 12;
  return 4;
}

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
  const recommendedFrequency: LearningProgramFrequency = pace === "curious" && lessonLengthMinutes <= 4 ? "daily" : "three_times_week";
  const frequency = normalizeLearningFrequency(input.frequency, recommendedFrequency);
  const durationWeeks = normalizeLearningDurationWeeks(input.durationWeeks);

  return {
    interests: normalizeLearningInterests(input.interests, allowedInterests),
    pace,
    frequency,
    durationWeeks,
    dailyTime,
    lessonLengthMinutes,
    language: normalizeLearningLanguage(input.language),
  };
}

export function learningProgramSessionOffsets(
  frequency: LearningProgramFrequency,
  durationWeeks: LearningProgramDurationWeeks,
): number[] {
  if (frequency === "weekly") {
    return Array.from({ length: durationWeeks }, (_, index) => index * 7);
  }

  if (frequency === "three_times_week") {
    return Array.from({ length: durationWeeks }, (_, weekIndex) => weekIndex)
      .flatMap((weekIndex) => [weekIndex * 7, weekIndex * 7 + 2, weekIndex * 7 + 4]);
  }

  return Array.from({ length: durationWeeks * 7 }, (_, index) => index);
}

export function inferLearningProgramRhythm(scheduledDates: string[]): {
  frequency: LearningProgramFrequency;
  durationWeeks: LearningProgramDurationWeeks;
} {
  const ordered = [...scheduledDates]
    .filter((value) => typeof value === "string" && value.length >= 10)
    .sort();
  if (ordered.length === 0) return { frequency: "daily", durationWeeks: 1 };
  if (ordered.length === 1) return { frequency: "weekly", durationWeeks: 1 };

  const start = utcDateFromKey(ordered[0]);
  const offsets = ordered.map((value) => {
    const diffMs = utcDateFromKey(value).getTime() - start.getTime();
    return Math.round(diffMs / (24 * 60 * 60 * 1000));
  });
  const lastOffset = offsets[offsets.length - 1] ?? 0;
  const durationWeeks = lastOffset >= 56 ? 12 : lastOffset >= 21 ? 4 : 1;

  const candidates: LearningProgramFrequency[] = ["daily", "three_times_week", "weekly"];
  const matched = candidates.find((frequency) => {
    const expected = learningProgramSessionOffsets(frequency, durationWeeks).slice(0, offsets.length);
    return expected.length === offsets.length && expected.every((value, index) => value === offsets[index]);
  });

  return {
    frequency: matched ?? "daily",
    durationWeeks,
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
  repeatWhenExhausted?: boolean;
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
    let lesson = pickBestLesson({
      lessons: publishedLessons,
      selectedIds,
      recentIds,
      categorySlug,
      language,
    });
    if (!lesson && input.repeatWhenExhausted && selectedIds.size > 0) {
      selectedIds.clear();
      lesson = pickBestLesson({
        lessons: publishedLessons,
        selectedIds,
        recentIds,
        categorySlug,
        language,
      });
    }
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
