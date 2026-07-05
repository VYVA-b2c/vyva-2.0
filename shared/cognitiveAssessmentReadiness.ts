import {
  COGNITIVE_ASSESSMENT_LANGUAGES,
  type CognitiveAssessmentLanguage,
} from "./cognitiveAssessmentRunner.js";

export const COGNITIVE_ASSESSMENT_EXPECTED_TASK_IDS = [
  "orientation",
  "story_recall_immediate",
  "fluency_semantic",
  "fluency_phonemic",
  "digit_span",
  "similarities",
  "clock_drawing",
  "story_recall_delayed",
  "mood_screen",
  "sleep_energy",
  "function_iadl",
  "subjective_concern",
] as const;

export const COGNITIVE_ASSESSMENT_STATIC_TASK_IDS = [
  "digit_span",
  "clock_drawing",
  "mood_screen",
  "sleep_energy",
  "function_iadl",
  "subjective_concern",
] as const;

export const COGNITIVE_ASSESSMENT_LANGUAGE_REQUIREMENTS = [
  {
    key: "orientation_forms",
    label: "Orientation forms",
    expectedCount: 4,
  },
  {
    key: "story_recall",
    label: "Story Recall",
    taskDefinitionId: "story_recall_immediate",
    expectedCount: 1,
  },
  {
    key: "similarities",
    label: "Similarities",
    taskDefinitionId: "similarities",
    expectedCount: 4,
  },
  {
    key: "fluency_semantic",
    label: "Semantic fluency",
    taskDefinitionId: "fluency_semantic",
    expectedCount: 4,
  },
  {
    key: "fluency_phonemic",
    label: "Phonemic fluency",
    taskDefinitionId: "fluency_phonemic",
    expectedCount: 3,
  },
  {
    key: "static_content",
    label: "Static prompts",
    expectedCount: COGNITIVE_ASSESSMENT_STATIC_TASK_IDS.length,
  },
] as const;

export type CognitiveAssessmentReadinessRequirement = {
  key: string;
  label: string;
  expectedCount: number;
  activeCount: number;
  ready: boolean;
};

export type CognitiveAssessmentLanguageReadiness = {
  language: CognitiveAssessmentLanguage;
  ready: boolean;
  blockers: string[];
  requirements: CognitiveAssessmentReadinessRequirement[];
};

export type CognitiveAssessmentTaskDefinitionReadiness = {
  ready: boolean;
  activeCount: number;
  expectedCount: number;
  missingIds: string[];
  unexpectedIds: string[];
};

export type CognitiveAssessmentReadinessResponse = {
  ready: boolean;
  generatedAt: string;
  taskDefinitions: CognitiveAssessmentTaskDefinitionReadiness;
  languages: CognitiveAssessmentLanguageReadiness[];
  blockers: string[];
};

export function cognitiveAssessmentLanguageLabel(language: CognitiveAssessmentLanguage) {
  const labels: Record<CognitiveAssessmentLanguage, string> = {
    es: "Spanish",
    de: "German",
    en: "English",
    fr: "French",
    pt: "Portuguese",
  };
  return labels[language];
}

export { COGNITIVE_ASSESSMENT_LANGUAGES };
