export type CognitiveAssessmentTaskSummary = {
  taskId: string;
  label: string;
  domain: string;
  status: "completed" | "started";
  detail: string;
  scoreLabel?: string | null;
};

export type CognitiveAssessmentReport = {
  sessionId: string;
  startedAt: string | null;
  completedAt: string | null;
  language: string;
  inputMode: string;
  tasksCompleted: number;
  totalTasks: number;
  overview: string;
  trend: string;
  sections: CognitiveAssessmentTaskSummary[];
  recommendations: string[];
  disclaimer: string;
};

export type CognitiveAssessmentHistoryItem = {
  sessionId: string;
  completedAt: string | null;
  language: string;
  inputMode: string;
  tasksCompleted: number;
  totalTasks: number;
  overview: string;
};

export type CognitiveAssessmentLatestReportResponse = {
  report: CognitiveAssessmentReport | null;
};

export type CognitiveAssessmentHistoryResponse = {
  history: CognitiveAssessmentHistoryItem[];
};
