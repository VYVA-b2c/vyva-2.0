import { Router } from "express";
import type { Request, Response } from "express";
import { pool } from "../db.js";
import type {
  CognitiveAssessmentHistoryItem,
  CognitiveAssessmentReport,
  CognitiveAssessmentTaskSummary,
} from "../../shared/cognitiveAssessmentReport.js";

type SessionRow = {
  id: string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  input_mode: string;
  language: string;
};

type ResponseRow = {
  id: string;
  task_definition_id: string;
  completed_at: Date | string | null;
  response_data: unknown;
  domain: string | null;
  task_type: string | null;
  display_order: number | null;
};

const router = Router();

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
  awareness: "Awareness",
  episodic_memory: "Memory",
  language_executive: "Language",
  executive_language: "Language",
  working_memory: "Attention",
  abstract_reasoning: "Reasoning",
  visuospatial_executive: "Visual thinking",
  mood: "Mood",
  sleep: "Sleep",
  function: "Daily function",
  insight: "Self concern",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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

function scoreLabel(data: Record<string, unknown>) {
  const score = numberValue(data, ["score", "raw_score", "total_score", "correct_count", "sum"]);
  const max = numberValue(data, ["max_score", "maxScore", "possible_score"]);
  if (score === null) return null;
  return max === null ? `${score}` : `${score}/${max}`;
}

function taskDetail(row: ResponseRow) {
  const data = objectData(row.response_data);
  const taskId = row.task_definition_id;

  if (taskId.includes("story_recall")) {
    const units = arrayLength(data, ["idea_units_recalled", "recalled_idea_units", "matched_idea_units"]);
    return units === null ? "Story response saved." : `${units} story details recalled.`;
  }

  if (taskId.includes("fluency")) {
    const words = arrayLength(data, ["words", "responses", "valid_responses", "unique_responses"]);
    return words === null ? "Fluency response saved." : `${words} responses saved.`;
  }

  if (taskId === "digit_span") {
    const forward = numberValue(data, ["longest_span_forward", "forward_span"]);
    const backward = numberValue(data, ["longest_span_backward", "backward_span"]);
    if (forward !== null || backward !== null) {
      return [`Forward ${forward ?? "-"}`, `Backward ${backward ?? "-"}`].join("; ");
    }
    return "Digit span response saved.";
  }

  if (["mood_screen", "sleep_energy", "function_iadl", "subjective_concern"].includes(taskId)) {
    const answers = arrayLength(data, ["answers", "responses", "items"]);
    const total = numberValue(data, ["score", "sum", "total_score"]);
    if (answers !== null && total !== null) return `${answers} answers saved; total ${total}.`;
    if (answers !== null) return `${answers} answers saved.`;
    return "Questionnaire response saved.";
  }

  return "Response saved.";
}

function buildTaskSummary(row: ResponseRow): CognitiveAssessmentTaskSummary {
  const data = objectData(row.response_data);
  return {
    taskId: row.task_definition_id,
    label: TASK_LABELS[row.task_definition_id] ?? row.task_definition_id.replace(/_/g, " "),
    domain: DOMAIN_LABELS[row.domain ?? ""] ?? row.domain ?? "Assessment",
    status: row.completed_at ? "completed" : "started",
    detail: taskDetail(row),
    scoreLabel: scoreLabel(data),
  };
}

function reportOverview(tasksCompleted: number, totalTasks: number) {
  if (tasksCompleted === 0) {
    return "No completed assessment steps are saved yet.";
  }
  return `${tasksCompleted} of ${totalTasks} assessment steps are saved in the latest Mind & Memory check.`;
}

function buildTrend(latest: CognitiveAssessmentReport | CognitiveAssessmentHistoryItem, previous?: CognitiveAssessmentHistoryItem | null) {
  if (!previous) {
    return "This is the first saved Cognitive Assessment report for this member.";
  }
  const delta = latest.tasksCompleted - previous.tasksCompleted;
  if (delta > 0) return `This check has ${delta} more completed step${delta === 1 ? "" : "s"} than the previous report.`;
  if (delta < 0) return `This check has ${Math.abs(delta)} fewer completed step${delta === -1 ? "" : "s"} than the previous report.`;
  return "Completion is steady compared with the previous saved report.";
}

function historyItem(session: SessionRow, responseCount: number): CognitiveAssessmentHistoryItem {
  return {
    sessionId: session.id,
    completedAt: iso(session.completed_at),
    language: session.language,
    inputMode: session.input_mode,
    tasksCompleted: responseCount,
    totalTasks: 12,
    overview: reportOverview(responseCount, 12),
  };
}

function buildReport(session: SessionRow, responses: ResponseRow[], previous?: CognitiveAssessmentHistoryItem | null): CognitiveAssessmentReport {
  const sections = responses.map(buildTaskSummary);
  const tasksCompleted = sections.filter((section) => section.status === "completed").length;
  const report: CognitiveAssessmentReport = {
    sessionId: session.id,
    startedAt: iso(session.started_at),
    completedAt: iso(session.completed_at),
    language: session.language,
    inputMode: session.input_mode,
    tasksCompleted,
    totalTasks: 12,
    overview: reportOverview(tasksCompleted, 12),
    trend: "",
    sections,
    recommendations: [
      "Repeat the check under similar conditions so changes over time are easier to compare.",
      "Share meaningful changes with a trusted caregiver or clinician if the member is worried.",
      "Use this together with sleep, mood, medicines, and daily function context rather than as a standalone answer.",
    ],
    disclaimer: "This is a wellness check to help notice changes over time. It does not diagnose a medical condition.",
  };
  report.trend = buildTrend(report, previous);
  return report;
}

async function loadCompletedSessions(userId: string, limit: number) {
  const { rows } = await pool.query<SessionRow & { response_count: string }>(`
    select
      s.id::text,
      s.started_at,
      s.completed_at,
      s.input_mode,
      s.language,
      count(r.id)::text as response_count
    from public.cc_sessions s
    left join public.cc_task_responses r on r.session_id = s.id
    where s.user_id = $1::uuid
      and s.completed_at is not null
      and s.abandoned = false
    group by s.id, s.started_at, s.completed_at, s.input_mode, s.language
    order by s.completed_at desc
    limit $2
  `, [userId, limit]);
  return rows;
}

async function loadSession(userId: string, sessionId: string) {
  const { rows } = await pool.query<SessionRow & { response_count: string }>(`
    select
      s.id::text,
      s.started_at,
      s.completed_at,
      s.input_mode,
      s.language,
      count(r.id)::text as response_count
    from public.cc_sessions s
    left join public.cc_task_responses r on r.session_id = s.id
    where s.user_id = $1::uuid
      and s.id = $2::uuid
      and s.completed_at is not null
      and s.abandoned = false
    group by s.id, s.started_at, s.completed_at, s.input_mode, s.language
    limit 1
  `, [userId, sessionId]);
  return rows[0] ?? null;
}

async function loadPreviousSession(userId: string, completedAt: Date | string | null) {
  if (!completedAt) return null;
  const { rows } = await pool.query<SessionRow & { response_count: string }>(`
    select
      s.id::text,
      s.started_at,
      s.completed_at,
      s.input_mode,
      s.language,
      count(r.id)::text as response_count
    from public.cc_sessions s
    left join public.cc_task_responses r on r.session_id = s.id
    where s.user_id = $1::uuid
      and s.completed_at is not null
      and s.completed_at < $2::timestamptz
      and s.abandoned = false
    group by s.id, s.started_at, s.completed_at, s.input_mode, s.language
    order by s.completed_at desc
    limit 1
  `, [userId, completedAt]);
  return rows[0] ? historyItem(rows[0], Number(rows[0].response_count ?? 0)) : null;
}

async function loadResponses(sessionId: string) {
  const { rows } = await pool.query<ResponseRow>(`
    select
      r.id::text,
      r.task_definition_id,
      r.completed_at,
      r.response_data,
      td.domain,
      td.task_type,
      td.display_order
    from public.cc_task_responses r
    left join public.cc_task_definitions td on td.id = r.task_definition_id
    where r.session_id = $1::uuid
    order by td.display_order asc nulls last, r.started_at asc
  `, [sessionId]);
  return rows;
}

function schemaMissingResponse(error: unknown, res: Response) {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "42P01") {
    return res.status(503).json({
      error: "Cognitive Assessment tables are not available in this database yet.",
    });
  }
  return null;
}

router.get("/latest-report", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId || !isUuid(userId)) return res.json({ report: null });

  try {
    const sessions = await loadCompletedSessions(userId, 2);
    const latest = sessions[0];
    if (!latest) return res.json({ report: null });

    const previous = sessions[1]
      ? historyItem(sessions[1], Number(sessions[1].response_count ?? 0))
      : null;
    const responses = await loadResponses(latest.id);
    return res.json({
      report: buildReport(latest, responses, previous),
    });
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Latest report failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment report could not be loaded." });
  }
});

router.get("/reports/:sessionId", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { sessionId } = req.params;
  if (!userId || !isUuid(userId) || !sessionId || !isUuid(sessionId)) return res.json({ report: null });

  try {
    const session = await loadSession(userId, sessionId);
    if (!session) return res.json({ report: null });

    const previous = await loadPreviousSession(userId, session.completed_at);
    const responses = await loadResponses(session.id);
    return res.json({
      report: buildReport(session, responses, previous),
    });
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Report failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment report could not be loaded." });
  }
});

router.get("/history", async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId || !isUuid(userId)) return res.json({ history: [] });

  try {
    const sessions = await loadCompletedSessions(userId, 12);
    return res.json({
      history: sessions.map((session) => historyItem(session, Number(session.response_count ?? 0))),
    });
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] History failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment history could not be loaded." });
  }
});

export default router;
