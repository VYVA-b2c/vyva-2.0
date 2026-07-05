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

export type CognitiveAssessmentHistoryInsight = {
  sessionId: string;
  completionPercent: number;
  completedSteps: number;
  totalSteps: number;
  thinkingDomainCount: number;
  biggestChangeLabel: string;
  contextLabel: string;
  comparisonLabel: string;
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

export type CognitiveAssessmentDomainTrendPoint = {
  sessionId: string;
  completedAt: string | null;
  rawValue: number | null;
  valueLabel: string;
};

export type CognitiveAssessmentDomainTrendSeries = {
  domainId: string;
  label: string;
  points: CognitiveAssessmentDomainTrendPoint[];
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

export type CognitiveAssessmentBaselineBandStatus = "usual" | "above" | "below" | "building" | "not_checked";

export type CognitiveAssessmentBaselineBand = {
  domainId: string;
  label: string;
  status: CognitiveAssessmentBaselineBandStatus;
  valueLabel: string;
  rangeLabel: string;
  detail: string;
  sampleSize: number;
};

export type CognitiveAssessmentCheckQualityStatus = "good" | "partial" | "building";

export type CognitiveAssessmentCheckQuality = {
  status: CognitiveAssessmentCheckQualityStatus;
  label: string;
  detail: string;
  factors: string[];
};

export type CognitiveAssessmentContextInsightTone = "steady" | "changed" | "building";

export type CognitiveAssessmentContextInsight = {
  tone: CognitiveAssessmentContextInsightTone;
  label: string;
  detail: string;
  relatedSignals: string[];
};

export type CognitiveAssessmentLatestReportResponse = {
  report: CognitiveAssessmentReport | null;
};

export type CognitiveAssessmentHistoryResponse = {
  history: CognitiveAssessmentHistoryItem[];
  historyInsights: CognitiveAssessmentHistoryInsight[];
  trendPoints: CognitiveAssessmentTrendPoint[];
  domainTrends: CognitiveAssessmentDomainTrend[];
  domainTrendSeries: CognitiveAssessmentDomainTrendSeries[];
  taskSignals: CognitiveAssessmentTaskSignal[];
  baselineBands: CognitiveAssessmentBaselineBand[];
  checkQuality: CognitiveAssessmentCheckQuality;
  contextInsight: CognitiveAssessmentContextInsight;
};
