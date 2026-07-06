export type CognitiveAssessmentPracticeStatus = "opened" | "completed";

export type CognitiveAssessmentPracticeIntent = {
  source: "cognitive_assessment_report";
  reportSessionId: string;
  recommendedDomain: string;
  practiceTitle: string;
  route: string;
  returnTo: string;
  status: CognitiveAssessmentPracticeStatus;
  startedAt: string;
  completedAt?: string;
};

const STORAGE_KEY = "cognitiveAssessment:recommendedPractice:v1";
const REPORT_RETURN_PATH = "/mind-memory/cognitive-assessment";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function isCognitiveAssessmentPracticeIntent(value: unknown): value is CognitiveAssessmentPracticeIntent {
  if (!isRecord(value)) return false;
  return (
    value.source === "cognitive_assessment_report"
    && typeof value.reportSessionId === "string"
    && typeof value.recommendedDomain === "string"
    && typeof value.practiceTitle === "string"
    && typeof value.route === "string"
  );
}

export function readCognitiveAssessmentPracticeIntent() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isCognitiveAssessmentPracticeIntent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCognitiveAssessmentPracticeIntent(intent: CognitiveAssessmentPracticeIntent) {
  if (typeof window === "undefined") return intent;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Local storage is only used for the visible nudge. The practice still works without it.
  }
  return intent;
}

export function startCognitiveAssessmentPractice(input: {
  reportSessionId: string;
  recommendedDomain: string;
  practiceTitle: string;
  route: string;
  returnTo?: string;
}) {
  return writeCognitiveAssessmentPracticeIntent({
    source: "cognitive_assessment_report",
    reportSessionId: input.reportSessionId,
    recommendedDomain: input.recommendedDomain,
    practiceTitle: input.practiceTitle,
    route: input.route,
    returnTo: input.returnTo || REPORT_RETURN_PATH,
    status: "opened",
    startedAt: new Date().toISOString(),
  });
}

export function completeCognitiveAssessmentPractice(routeState: unknown) {
  const state = isCognitiveAssessmentPracticeIntent(routeState)
    ? routeState
    : readCognitiveAssessmentPracticeIntent();

  if (!state) return null;

  return writeCognitiveAssessmentPracticeIntent({
    ...state,
    status: "completed",
    completedAt: new Date().toISOString(),
  });
}

export function cognitiveAssessmentPracticeStateFromRoute(value: unknown) {
  if (!isRecord(value)) return null;
  if (isCognitiveAssessmentPracticeIntent(value)) return value;

  const reportSessionId = optionalString(value.reportSessionId);
  const recommendedDomain = optionalString(value.recommendedDomain);
  const practiceTitle = optionalString(value.practiceTitle);
  const route = optionalString(value.route);

  if (value.source !== "cognitive_assessment_report" || !reportSessionId || !recommendedDomain || !practiceTitle || !route) {
    return null;
  }

  return {
    source: "cognitive_assessment_report",
    reportSessionId,
    recommendedDomain,
    practiceTitle,
    route,
    returnTo: optionalString(value.returnTo) || REPORT_RETURN_PATH,
    status: value.status === "completed" ? "completed" : "opened",
    startedAt: optionalString(value.startedAt) || new Date().toISOString(),
    completedAt: optionalString(value.completedAt) || undefined,
  } satisfies CognitiveAssessmentPracticeIntent;
}

export function cognitiveAssessmentPracticeStatusForReport(reportSessionId: string) {
  const intent = readCognitiveAssessmentPracticeIntent();
  if (!intent || intent.reportSessionId !== reportSessionId) return null;
  return intent;
}

