export const COGNITIVE_ASSESSMENT_LANGUAGES = ["es", "de", "en", "fr", "pt"] as const;

export type CognitiveAssessmentLanguage = typeof COGNITIVE_ASSESSMENT_LANGUAGES[number];

export type CognitiveAssessmentRunnerTask = {
  id: string;
  displayOrder: number;
  label: string;
  domain: string;
  taskType: string;
  contentSource: "item_bank" | "rotation" | "static";
  expectedDurationSec: number;
  content: Record<string, unknown>;
  itemBankId?: string | null;
  itemBankIds?: string[];
  rotationFormId?: string | null;
};

export type CognitiveAssessmentRunnerSession = {
  sessionId: string;
  startedAt: string | null;
  completedAt: string | null;
  language: CognitiveAssessmentLanguage;
  inputMode: "wizard";
  tasks: CognitiveAssessmentRunnerTask[];
  completedTaskIds: string[];
};

export type CognitiveAssessmentStartSessionResponse = {
  session: CognitiveAssessmentRunnerSession;
};

export type CognitiveAssessmentLoadSessionResponse = {
  session: CognitiveAssessmentRunnerSession | null;
};

export type CognitiveAssessmentSaveResponseRequest = {
  taskDefinitionId: string;
  responseData: Record<string, unknown>;
  itemBankId?: string | null;
  rotationFormId?: string | null;
};

export type CognitiveAssessmentSaveResponseResponse = {
  saved: true;
  completedTaskIds: string[];
};

export type CognitiveAssessmentCompleteSessionResponse = {
  sessionId: string;
  reportUrl: string;
};
