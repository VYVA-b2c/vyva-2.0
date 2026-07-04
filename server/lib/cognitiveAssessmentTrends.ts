import type {
  CognitiveAssessmentDomainTrend,
  CognitiveAssessmentTaskSignal,
  CognitiveAssessmentTrendPoint,
} from "../../shared/cognitiveAssessmentReport.js";

export type CognitiveTrendSession = {
  id: string;
  completed_at: Date | string | null;
  response_count?: number | string | null;
};

export type CognitiveTrendResponseRow = {
  session_id?: string;
  task_definition_id: string;
  completed_at: Date | string | null;
  response_data: unknown;
  domain: string | null;
  display_order?: number | null;
};

export type CognitiveAssessmentTrendPayload = {
  trendPoints: CognitiveAssessmentTrendPoint[];
  domainTrends: CognitiveAssessmentDomainTrend[];
  taskSignals: CognitiveAssessmentTaskSignal[];
};

type TrendDomain = {
  id: string;
  label: string;
  taskIds: string[];
};

const TASK_LABELS: Record<string, string> = {
  orientation: "Orientation",
  story_recall_immediate: "Story recall",
  fluency_semantic: "Category fluency",
  fluency_phonemic: "Letter fluency",
  digit_span: "Digit span",
  similarities: "Similarities",
  clock_drawing: "Clock drawing",
  story_recall_delayed: "Delayed story recall",
  mood_screen: "Mood check",
  sleep_energy: "Sleep and energy",
  function_iadl: "Daily function",
  subjective_concern: "Memory concern",
};

const DOMAIN_LABELS: Record<string, string> = {
  awareness: "Daily context",
  episodic_memory: "Memory",
  language_executive: "Language",
  executive_language: "Language",
  working_memory: "Attention",
  abstract_reasoning: "Reasoning",
  visuospatial_executive: "Visual/Clock",
  mood: "Daily context",
  sleep: "Daily context",
  function: "Daily context",
  insight: "Daily context",
};

const TREND_DOMAINS: TrendDomain[] = [
  {
    id: "memory",
    label: "Memory",
    taskIds: ["story_recall_immediate", "story_recall_delayed"],
  },
  {
    id: "language",
    label: "Language",
    taskIds: ["fluency_semantic", "fluency_phonemic"],
  },
  {
    id: "attention",
    label: "Attention",
    taskIds: ["digit_span"],
  },
  {
    id: "reasoning",
    label: "Reasoning",
    taskIds: ["similarities"],
  },
  {
    id: "visual_clock",
    label: "Visual/Clock",
    taskIds: ["clock_drawing"],
  },
  {
    id: "daily_context",
    label: "Mood/Sleep/Daily Context",
    taskIds: ["orientation", "mood_screen", "sleep_energy", "function_iadl", "subjective_concern"],
  },
];

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function objectData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function arrayLength(data: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
  }
  return null;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function trendDomainForTaskId(taskId: string) {
  return TREND_DOMAINS.find((domain) => domain.taskIds.includes(taskId)) ?? null;
}

function scoreSignal(data: Record<string, unknown>, scoreKeys = ["score", "raw_score", "total_score", "correct_count", "sum"]) {
  const score = numberValue(data, scoreKeys);
  const max = numberValue(data, ["max_score", "maxScore", "possible_score"]);
  if (score === null) return null;
  return {
    rawValue: score,
    maxValue: max,
    valueLabel: max === null ? formatNumber(score) : `${formatNumber(score)}/${formatNumber(max)}`,
  };
}

export function cognitiveTaskSignal(row: CognitiveTrendResponseRow): CognitiveAssessmentTaskSignal {
  const taskId = row.task_definition_id;
  const data = objectData(row.response_data);
  const trendDomain = trendDomainForTaskId(taskId);
  const label = TASK_LABELS[taskId] ?? taskId.replace(/_/g, " ");
  const domain = trendDomain?.label ?? DOMAIN_LABELS[row.domain ?? ""] ?? row.domain ?? "Assessment";

  if (taskId.includes("story_recall")) {
    const ideaUnits = arrayLength(data, ["idea_units_recalled", "recalled_idea_units", "matched_idea_units"]);
    if (ideaUnits !== null) {
      return {
        taskId,
        label,
        domain,
        kind: "count",
        rawValue: ideaUnits,
        valueLabel: `${formatNumber(ideaUnits)} details`,
      };
    }
    const words = numberValue(data, ["word_count"]);
    return {
      taskId,
      label,
      domain,
      kind: words === null ? "saved" : "count",
      rawValue: words,
      valueLabel: words === null ? "saved" : `${formatNumber(words)} words`,
    };
  }

  if (taskId.includes("fluency")) {
    const uniqueResponses = arrayLength(data, ["unique_responses", "valid_responses", "responses", "words"]);
    if (uniqueResponses !== null) {
      return {
        taskId,
        label,
        domain,
        kind: "count",
        rawValue: uniqueResponses,
        valueLabel: `${formatNumber(uniqueResponses)} unique`,
      };
    }
    const score = scoreSignal(data);
    if (score) {
      return { taskId, label, domain, kind: "count", ...score };
    }
  }

  if (taskId === "digit_span") {
    const forward = numberValue(data, ["longest_span_forward", "forward_span"]);
    const backward = numberValue(data, ["longest_span_backward", "backward_span"]);
    const total = forward !== null || backward !== null ? (forward ?? 0) + (backward ?? 0) : null;
    if (total !== null) {
      return {
        taskId,
        label,
        domain,
        kind: "score",
        rawValue: total,
        maxValue: numberValue(data, ["max_score", "maxScore", "possible_score"]) ?? 17,
        valueLabel: `${formatNumber(total)} span total`,
      };
    }
  }

  if (taskId === "clock_drawing") {
    const score = scoreSignal(data, ["clock_score", "raw_score", "total_score", "correct_count"]);
    if (score) {
      return { taskId, label, domain, kind: "score", ...score };
    }
    return { taskId, label, domain, kind: "saved", rawValue: null, valueLabel: "saved" };
  }

  const score = scoreSignal(data);
  if (score) {
    return { taskId, label, domain, kind: "score", ...score };
  }

  return { taskId, label, domain, kind: "saved", rawValue: null, valueLabel: "saved" };
}

function responseIsCompleted(row: CognitiveTrendResponseRow) {
  return Boolean(row.completed_at);
}

function countCompletedSteps(session: CognitiveTrendSession, responses: CognitiveTrendResponseRow[]) {
  const completedResponses = responses.filter(responseIsCompleted).length;
  if (completedResponses > 0) return completedResponses;
  const fallback = Number(session.response_count ?? 0);
  return Number.isFinite(fallback) ? fallback : 0;
}

function compareDates(left: CognitiveTrendSession, right: CognitiveTrendSession) {
  const leftDate = left.completed_at ? new Date(left.completed_at).getTime() : 0;
  const rightDate = right.completed_at ? new Date(right.completed_at).getTime() : 0;
  if (leftDate !== rightDate) return leftDate - rightDate;
  return left.id.localeCompare(right.id);
}

function domainCount(responses: CognitiveTrendResponseRow[]) {
  const domains = new Set<string>();
  responses.filter(responseIsCompleted).forEach((response) => {
    const trendDomain = trendDomainForTaskId(response.task_definition_id);
    if (trendDomain) domains.add(trendDomain.id);
  });
  return domains.size;
}

function aggregateDomain(responses: CognitiveTrendResponseRow[], trendDomain: TrendDomain) {
  const domainResponses = responses
    .filter(responseIsCompleted)
    .filter((response) => trendDomain.taskIds.includes(response.task_definition_id));
  const signals = domainResponses.map(cognitiveTaskSignal);
  const numericSignals = signals.filter((signal) => signal.rawValue !== null);

  if (numericSignals.length > 0) {
    const rawValue = numericSignals.reduce((sum, signal) => sum + (signal.rawValue ?? 0), 0);
    const valueLabel = numericSignals.length === 1
      ? numericSignals[0].valueLabel
      : `${formatNumber(rawValue)} total signal`;
    return { rawValue, valueLabel };
  }

  if (signals.length > 0) {
    return {
      rawValue: signals.length,
      valueLabel: `${signals.length} saved`,
    };
  }

  return {
    rawValue: null,
    valueLabel: "Not checked",
  };
}

function direction(latest: number | null, previous: number | null): CognitiveAssessmentDomainTrend["direction"] {
  if (latest === null) return "none";
  if (previous === null) return "new";
  if (latest > previous) return "up";
  if (latest < previous) return "down";
  return "flat";
}

export function buildCognitiveAssessmentTrendPayload(
  sessions: CognitiveTrendSession[],
  responsesBySession: Map<string, CognitiveTrendResponseRow[]>,
  totalSteps: number,
): CognitiveAssessmentTrendPayload {
  const chronologicalSessions = [...sessions].sort(compareDates);
  const trendPoints = chronologicalSessions.slice(-6).map((session): CognitiveAssessmentTrendPoint => {
    const responses = responsesBySession.get(session.id) ?? [];
    const completedSteps = countCompletedSteps(session, responses);
    return {
      sessionId: session.id,
      completedAt: iso(session.completed_at),
      completionPercent: totalSteps <= 0 ? 0 : Math.round((completedSteps / totalSteps) * 100),
      completedSteps,
      totalSteps,
      domainCount: domainCount(responses),
    };
  });

  const latestSession = chronologicalSessions[chronologicalSessions.length - 1] ?? null;
  const previousSession = chronologicalSessions[chronologicalSessions.length - 2] ?? null;
  const latestResponses = latestSession ? responsesBySession.get(latestSession.id) ?? [] : [];
  const previousResponses = previousSession ? responsesBySession.get(previousSession.id) ?? [] : [];

  const domainTrends = TREND_DOMAINS.map((trendDomain): CognitiveAssessmentDomainTrend => {
    const latest = aggregateDomain(latestResponses, trendDomain);
    const previous = aggregateDomain(previousResponses, trendDomain);
    return {
      domainId: trendDomain.id,
      label: trendDomain.label,
      latestRawValue: latest.rawValue,
      previousRawValue: previous.rawValue,
      direction: direction(latest.rawValue, previous.rawValue),
      valueLabel: latest.valueLabel,
    };
  });

  const taskSignals = [...latestResponses]
    .filter(responseIsCompleted)
    .sort((left, right) => (left.display_order ?? 999) - (right.display_order ?? 999))
    .map(cognitiveTaskSignal);

  return { trendPoints, domainTrends, taskSignals };
}
