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

export type CognitiveAssessmentTrendPoint = {
  sessionId: string;
  completedAt: string | null;
  completionPercent: number;
  completedSteps: number;
  totalSteps: number;
  domainCount: number;
};

export type CognitiveAssessmentDomainTrendDirection = "up" | "down" | "flat" | "new" | "none";

export type CognitiveAssessmentDomainTrend = {
  domainId: string;
  label: string;
  latestRawValue: number | null;
  previousRawValue: number | null;
  direction: CognitiveAssessmentDomainTrendDirection;
  valueLabel: string;
};

export type CognitiveAssessmentTaskSignal = {
  taskId: string;
  label: string;
  domain: string;
  kind: "score" | "count" | "saved";
  rawValue: number | null;
  maxValue?: number | null;
  valueLabel: string;
};

export type CognitiveAssessmentLatestReportResponse = {
  report: CognitiveAssessmentReport | null;
};

export type CognitiveAssessmentHistoryResponse = {
  history: CognitiveAssessmentHistoryItem[];
  trendPoints: CognitiveAssessmentTrendPoint[];
  domainTrends: CognitiveAssessmentDomainTrend[];
  taskSignals: CognitiveAssessmentTaskSignal[];
};
