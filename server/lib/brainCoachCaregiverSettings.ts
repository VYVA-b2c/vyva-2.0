import type { BrainCoachPlanPreferences } from "./brainCoachPlan.js";

export type BrainCoachCaregiverSettingsLike = {
  preferredDomains?: string[] | null;
  excludedActivityTypes?: string[] | null;
  preferredTrainingTimes?: string[] | null;
  weeklyTargetDays?: number | null;
  sessionLengthMinutes?: number | null;
  paused?: boolean | null;
};

export type NormalizedBrainCoachCaregiverSettings = {
  preferredDomains: string[];
  excludedActivityTypes: string[];
  preferredTrainingTimes: string[];
  weeklyTargetDays: number;
  sessionLengthMinutes: number;
  paused: boolean;
};

const DOMAIN_PATTERN = /^[a-z0-9_:-]{2,80}$/i;
const ACTIVITY_PATTERN = /^[a-z0-9_:-]{2,80}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function uniqueClean(values: unknown, pattern: RegExp, max = 12) {
  if (!Array.isArray(values)) return [];
  const cleaned = values
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => pattern.test(entry));
  return Array.from(new Set(cleaned)).slice(0, max);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

export function normalizeBrainCoachCaregiverSettings(input: BrainCoachCaregiverSettingsLike | null | undefined): NormalizedBrainCoachCaregiverSettings {
  return {
    preferredDomains: uniqueClean(input?.preferredDomains, DOMAIN_PATTERN),
    excludedActivityTypes: uniqueClean(input?.excludedActivityTypes, ACTIVITY_PATTERN),
    preferredTrainingTimes: uniqueClean(input?.preferredTrainingTimes, TIME_PATTERN, 5),
    weeklyTargetDays: clampNumber(input?.weeklyTargetDays, 3, 1, 7),
    sessionLengthMinutes: clampNumber(input?.sessionLengthMinutes, 7, 5, 10),
    paused: input?.paused === true,
  };
}

export function mergeCaregiverSettingsIntoPreferences(
  preferences: BrainCoachPlanPreferences,
  settings: BrainCoachCaregiverSettingsLike | null | undefined,
): BrainCoachPlanPreferences {
  const normalized = normalizeBrainCoachCaregiverSettings(settings);
  return {
    ...preferences,
    sessionLengthMins: normalized.sessionLengthMinutes || preferences.sessionLengthMins,
    trainingTime: normalized.preferredTrainingTimes[0] ?? preferences.trainingTime,
    preferredDomains: normalized.preferredDomains,
    excludedActivityTypes: normalized.excludedActivityTypes,
    weeklyTargetDays: normalized.weeklyTargetDays,
    caregiverPaused: normalized.paused,
  };
}
