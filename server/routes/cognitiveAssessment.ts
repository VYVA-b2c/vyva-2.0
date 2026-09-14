import { Router } from "express";
import type { Request, Response } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import type {
  CognitiveAssessmentHistoryItem,
  CognitiveAssessmentHistoryResponse,
  CognitiveAssessmentReport,
  CognitiveAssessmentTaskSummary,
} from "../../shared/cognitiveAssessmentReport.js";
import type {
  CognitiveAssessmentProgramEnrollment,
  CognitiveAssessmentProgramFrequency,
  CognitiveAssessmentProgramJoinResponse,
  CognitiveAssessmentProgramReminderStatus,
  CognitiveAssessmentProgramSessionSummary,
  CognitiveAssessmentProgramStatusResponse,
} from "../../shared/cognitiveAssessmentProgram.js";
import {
  buildCognitiveAssessmentTrendPayload,
  type CognitiveTrendResponseRow,
} from "../lib/cognitiveAssessmentTrends.js";
import {
  computeNextAssessmentRunAt,
  scheduledInteractionDaysOfWeek,
  scheduledInteractionFrequencyType,
} from "../lib/cognitiveAssessmentProgram.js";
import { markCognitiveAssessmentReminderCompleted } from "../services/cognitiveAssessmentReminders.js";
import {
  cognitiveReadinessBlockersForLanguage,
  loadCognitiveAssessmentReadiness,
} from "../lib/cognitiveAssessmentReadiness.js";
import {
  COGNITIVE_ASSESSMENT_LANGUAGES,
  type CognitiveAssessmentCompleteSessionResponse,
  type CognitiveAssessmentLanguage,
  type CognitiveAssessmentLoadSessionResponse,
  type CognitiveAssessmentRunnerSession,
  type CognitiveAssessmentRunnerTask,
  type CognitiveAssessmentSaveResponseResponse,
  type CognitiveAssessmentStartSessionResponse,
} from "../../shared/cognitiveAssessmentRunner.js";

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

type TaskDefinitionRow = {
  id: string;
  display_order: number;
  domain: string;
  task_type: string;
  content_source: "item_bank" | "rotation" | "static";
  expected_duration_sec: number;
  content_static: unknown;
};

type ItemBankRow = {
  id: string;
  task_definition_id: string;
  content: unknown;
  difficulty_tier: number;
};

type RotationFormRow = {
  id: string;
  task_definition_id: string;
  form_number: number;
  content: unknown;
};

type SessionWithResponseCountRow = SessionRow & { response_count: string };
type HistoryResponseRow = ResponseRow & { session_id: string };
type ProgramEnrollmentRow = {
  user_id: string;
  status: "active" | "paused" | "cancelled";
  start_date: Date | string;
  frequency: string;
  reminder_time: string;
  timezone: string;
  scheduled_interaction_id: string | null;
  joined_at: Date | string | null;
  updated_at: Date | string | null;
  next_run_at: Date | string | null;
  latest_reminder_at: Date | string | null;
};
type ProgramSessionRow = {
  id: string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  response_count: number | string;
};
type CountRow = { count: number | string };
type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

const router = Router();

const ASSESSMENT_TASK_TOTAL = 12;
const languageSchema = z.enum(COGNITIVE_ASSESSMENT_LANGUAGES);
const startSessionSchema = z.object({
  language: languageSchema.optional(),
  inputMode: z.literal("wizard").optional(),
});
const programFrequencySchema = z.enum(["weekly", "every_2_weeks", "monthly"]);
const joinProgramSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frequency: programFrequencySchema.optional().default("monthly"),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().min(1).max(100),
});
const saveResponseSchema = z.object({
  taskDefinitionId: z.string().min(1),
  responseData: z.record(z.unknown()),
  itemBankId: z.string().uuid().nullable().optional(),
  rotationFormId: z.string().uuid().nullable().optional(),
});

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

function normalizeAssessmentLanguage(value: unknown): CognitiveAssessmentLanguage {
  return COGNITIVE_ASSESSMENT_LANGUAGES.includes(value as CognitiveAssessmentLanguage)
    ? value as CognitiveAssessmentLanguage
    : "en";
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function requireUuidUser(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId || !isUuid(userId)) {
    res.status(400).json({ error: "Cognitive Assessment requires a UUID-backed user account." });
    return null;
  }
  return userId;
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timeOnly(value: string | null | undefined) {
  return String(value ?? "10:00").slice(0, 5);
}

function countNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeProgramFrequency(value: string): CognitiveAssessmentProgramFrequency {
  return value === "weekly" || value === "every_2_weeks" ? value : "monthly";
}

function objectData(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayData(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stableIndex(length: number, seed: string) {
  if (length <= 0) return -1;
  const hash = createHash("sha256").update(seed).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % length;
}

function stablePick<T>(items: T[], seed: string) {
  const index = stableIndex(items.length, seed);
  return index >= 0 ? items[index] : null;
}

function stableList<T extends { id: string }>(items: T[], seed: string, limit: number) {
  return [...items]
    .sort((left, right) => {
      const leftHash = createHash("sha256").update(`${seed}:${left.id}`).digest("hex");
      const rightHash = createHash("sha256").update(`${seed}:${right.id}`).digest("hex");
      return leftHash.localeCompare(rightHash);
    })
    .slice(0, limit);
}

function localizedStaticContent(contentStatic: unknown, language: CognitiveAssessmentLanguage) {
  const content = objectData(contentStatic);
  const languages = objectData(content.languages);
  const localized = objectData(languages[language] ?? languages.en);
  const withoutLanguages = { ...content };
  delete withoutLanguages.languages;
  return { ...withoutLanguages, ...localized };
}

function currentWeekAndYear(now = new Date()) {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: date.getUTCFullYear() };
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

function taskScoreLabel(row: ResponseRow) {
  const data = objectData(row.response_data);
  if (row.task_definition_id.includes("story_recall")) return null;
  return scoreLabel(data);
}

function taskDetail(row: ResponseRow) {
  const data = objectData(row.response_data);
  const taskId = row.task_definition_id;

  if (taskId.includes("story_recall")) {
    const scoringMethod = typeof data.scoring_method === "string" ? data.scoring_method : "";
    const units = scoringMethod === "word_count_fallback"
      ? null
      : numberValue(data, ["idea_units_recalled"])
        ?? arrayLength(data, ["recalled_idea_units", "matched_idea_units"]);
    const words = numberValue(data, ["word_count"]);
    if (units !== null) return `${units} ${units === 1 ? "story detail" : "story details"} recalled.`;
    if (words !== null) return `${words} words recalled in free text.`;
    return "Story recall response captured.";
  }

  if (taskId === "orientation") {
    const answered = numberValue(data, ["answered_count", "score"]);
    const max = numberValue(data, ["max_score"]);
    if (answered !== null && max !== null) return `${answered} of ${max} orientation answers saved.`;
    return "Orientation response saved.";
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

  if (taskId === "similarities") {
    const answered = numberValue(data, ["answered_count"]);
    const responses = arrayLength(data, ["responses"]);
    if (answered !== null && responses !== null) return `${answered} of ${responses} answers saved.`;
    return "Similarities response saved.";
  }

  if (taskId === "clock_drawing") {
    const targetTime = data.target_time;
    return typeof targetTime === "string" && targetTime.trim()
      ? `Clock response saved for ${targetTime}.`
      : "Clock response saved.";
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
  return {
    taskId: row.task_definition_id,
    label: TASK_LABELS[row.task_definition_id] ?? row.task_definition_id.replace(/_/g, " "),
    domain: DOMAIN_LABELS[row.domain ?? ""] ?? row.domain ?? "Assessment",
    status: row.completed_at ? "completed" : "started",
    detail: taskDetail(row),
    scoreLabel: taskScoreLabel(row),
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
    totalTasks: ASSESSMENT_TASK_TOTAL,
    overview: reportOverview(responseCount, ASSESSMENT_TASK_TOTAL),
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
    totalTasks: ASSESSMENT_TASK_TOTAL,
    overview: reportOverview(tasksCompleted, ASSESSMENT_TASK_TOTAL),
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

async function loadTaskDefinitions() {
  const { rows } = await pool.query<TaskDefinitionRow>(`
    select
      id,
      display_order,
      domain,
      task_type,
      content_source,
      expected_duration_sec,
      content_static
    from public.cc_task_definitions
    where is_active = true
      and supports_wizard = true
    order by display_order asc
  `);
  return rows;
}

async function loadSessionForUser(userId: string, sessionId: string) {
  const { rows } = await pool.query<SessionRow>(`
    select
      id::text,
      started_at,
      completed_at,
      input_mode,
      language
    from public.cc_sessions
    where id = $1::uuid
      and user_id = $2::uuid
    limit 1
  `, [sessionId, userId]);
  return rows[0] ?? null;
}

async function loadCompletedTaskIds(sessionId: string) {
  const { rows } = await pool.query<{ task_definition_id: string }>(`
    select distinct task_definition_id
    from public.cc_task_responses
    where session_id = $1::uuid
      and completed_at is not null
  `, [sessionId]);
  return rows.map((row) => row.task_definition_id);
}

async function loadResponseRefs(sessionId: string) {
  const { rows } = await pool.query<{
    task_definition_id: string;
    item_bank_id: string | null;
    rotation_form_id: string | null;
  }>(`
    select
      task_definition_id,
      item_bank_id::text,
      rotation_form_id::text
    from public.cc_task_responses
    where session_id = $1::uuid
    order by started_at asc
  `, [sessionId]);
  return new Map(rows.map((row) => [row.task_definition_id, row]));
}

async function loadRunnerItemBank(language: CognitiveAssessmentLanguage) {
  const { rows } = await pool.query<ItemBankRow>(`
    select
      id::text,
      task_definition_id,
      content,
      difficulty_tier
    from public.cc_item_bank
    where language = $1
      and is_active = true
      and rejected = false
    order by task_definition_id asc, created_at asc
  `, [language]);
  return rows;
}

async function loadRunnerRotationForms(language: CognitiveAssessmentLanguage) {
  const { rows } = await pool.query<RotationFormRow>(`
    select
      id::text,
      task_definition_id,
      form_number,
      content
    from public.cc_rotation_forms
    where language = $1
      and is_active = true
    order by task_definition_id asc, form_number asc
  `, [language]);
  return rows;
}

function groupByTask<T extends { task_definition_id: string }>(rows: T[]) {
  return rows.reduce<Record<string, T[]>>((groups, row) => {
    const group = groups[row.task_definition_id] ?? [];
    group.push(row);
    groups[row.task_definition_id] = group;
    return groups;
  }, {});
}

function runnerTaskBase(definition: TaskDefinitionRow): Omit<CognitiveAssessmentRunnerTask, "content"> {
  return {
    id: definition.id,
    displayOrder: definition.display_order,
    label: TASK_LABELS[definition.id] ?? definition.id.replace(/_/g, " "),
    domain: DOMAIN_LABELS[definition.domain] ?? definition.domain,
    taskType: definition.task_type,
    contentSource: definition.content_source,
    expectedDurationSec: definition.expected_duration_sec,
  };
}

function buildRunnerTask(
  definition: TaskDefinitionRow,
  sessionId: string,
  language: CognitiveAssessmentLanguage,
  itemBankByTask: Record<string, ItemBankRow[]>,
  rotationFormsByTask: Record<string, RotationFormRow[]>,
  responseRefsByTask: Map<string, { item_bank_id: string | null; rotation_form_id: string | null }>,
): CognitiveAssessmentRunnerTask {
  const base = runnerTaskBase(definition);
  const seed = `${sessionId}:${definition.id}:${language}`;

  if (definition.content_source === "rotation") {
    const form = stablePick(rotationFormsByTask[definition.id] ?? [], seed);
    return {
      ...base,
      content: {
        ...objectData(form?.content),
        formNumber: form?.form_number ?? null,
      },
      rotationFormId: form?.id ?? null,
    };
  }

  if (definition.content_source === "static") {
    const content = localizedStaticContent(definition.content_static, language);
    const targetTimes = arrayData(content.target_times).map(String);
    const targetTime = definition.id === "clock_drawing" && targetTimes.length > 0
      ? targetTimes[stableIndex(targetTimes.length, seed)]
      : null;
    return {
      ...base,
      content: {
        ...content,
        ...(targetTime ? { target_time: targetTime } : {}),
      },
    };
  }

  if (definition.id === "similarities") {
    const items = stableList(itemBankByTask[definition.id] ?? [], seed, 4);
    return {
      ...base,
      content: {
        items: items.map((item) => ({
          id: item.id,
          difficultyTier: item.difficulty_tier,
          content: objectData(item.content),
        })),
      },
      itemBankIds: items.map((item) => item.id),
      itemBankId: null,
    };
  }

  if (definition.id === "story_recall_delayed") {
    const immediateItems = itemBankByTask.story_recall_immediate ?? [];
    const linkedId = responseRefsByTask.get("story_recall_immediate")?.item_bank_id ?? null;
    const linkedItem = linkedId
      ? immediateItems.find((item) => item.id === linkedId) ?? null
      : stablePick(immediateItems, `${sessionId}:story_recall_immediate:${language}`);
    const linkedContent = objectData(linkedItem?.content);
    return {
      ...base,
      content: {
        delayed: true,
        title: String(linkedContent.title ?? "Earlier story"),
        idea_units: arrayData(linkedContent.idea_units),
        prompt: "Without looking back, write as much as you remember from the story.",
      },
      itemBankId: linkedItem?.id ?? null,
    };
  }

  const item = stablePick(itemBankByTask[definition.id] ?? [], seed);
  return {
    ...base,
    content: objectData(item?.content),
    itemBankId: item?.id ?? null,
  };
}

async function buildRunnerSession(session: SessionRow): Promise<CognitiveAssessmentRunnerSession> {
  const language = normalizeAssessmentLanguage(session.language);
  const [definitions, itemBankRows, rotationFormRows, completedTaskIds, responseRefsByTask] = await Promise.all([
    loadTaskDefinitions(),
    loadRunnerItemBank(language),
    loadRunnerRotationForms(language),
    loadCompletedTaskIds(session.id),
    loadResponseRefs(session.id),
  ]);
  const itemBankByTask = groupByTask(itemBankRows);
  const rotationFormsByTask = groupByTask(rotationFormRows);

  return {
    sessionId: session.id,
    startedAt: iso(session.started_at),
    completedAt: iso(session.completed_at),
    language,
    inputMode: "wizard",
    completedTaskIds,
    tasks: definitions.map((definition) => buildRunnerTask(
      definition,
      session.id,
      language,
      itemBankByTask,
      rotationFormsByTask,
      responseRefsByTask,
    )),
  };
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

async function loadResponsesForSessions(sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, CognitiveTrendResponseRow[]>();

  const { rows } = await pool.query<HistoryResponseRow>(`
    select
      r.session_id::text,
      r.id::text,
      r.task_definition_id,
      r.completed_at,
      r.response_data,
      td.domain,
      td.task_type,
      td.display_order
    from public.cc_task_responses r
    left join public.cc_task_definitions td on td.id = r.task_definition_id
    where r.session_id = any($1::uuid[])
    order by r.session_id asc, td.display_order asc nulls last, r.started_at asc
  `, [sessionIds]);

  return rows.reduce((groups, row) => {
    const group = groups.get(row.session_id) ?? [];
    group.push(row);
    groups.set(row.session_id, group);
    return groups;
  }, new Map<string, CognitiveTrendResponseRow[]>());
}

function programEnrollmentFromRow(row: ProgramEnrollmentRow | null): CognitiveAssessmentProgramEnrollment | null {
  if (!row || row.status !== "active") return null;
  return {
    status: row.status,
    startDate: dateOnly(row.start_date),
    frequency: normalizeProgramFrequency(row.frequency),
    reminderTime: timeOnly(row.reminder_time),
    timezone: row.timezone || "Europe/Madrid",
    joinedAt: iso(row.joined_at),
    updatedAt: iso(row.updated_at),
    nextRunAt: iso(row.next_run_at),
    scheduledInteractionId: row.scheduled_interaction_id,
  };
}

function programSessionSummary(
  row: ProgramSessionRow | null,
  includeStartedAt: boolean,
): CognitiveAssessmentProgramSessionSummary | null {
  if (!row) return null;
  return {
    sessionId: row.id,
    startedAt: includeStartedAt ? iso(row.started_at) : undefined,
    completedAt: includeStartedAt ? undefined : iso(row.completed_at),
    tasksCompleted: countNumber(row.response_count),
    totalTasks: ASSESSMENT_TASK_TOTAL,
  };
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function programReminderStatus(
  enrollment: CognitiveAssessmentProgramEnrollment | null,
  enrollmentRow: ProgramEnrollmentRow | null,
  latestReport: CognitiveAssessmentProgramSessionSummary | null,
): CognitiveAssessmentProgramReminderStatus {
  if (!enrollment) {
    return {
      state: "not_scheduled",
      nextRunAt: null,
      dueSince: null,
    };
  }

  const nextRunAt = enrollment?.nextRunAt ?? null;
  const latestReminderAt = iso(enrollmentRow?.latest_reminder_at);
  const latestReportCompletedAt = latestReport?.completedAt ?? null;
  const latestReminderDate = parseIsoDate(latestReminderAt);
  const latestReportDate = parseIsoDate(latestReportCompletedAt);
  const hasPendingReminder = Boolean(
    latestReminderDate && (!latestReportDate || latestReportDate.getTime() < latestReminderDate.getTime()),
  );
  const nextRunDate = parseIsoDate(nextRunAt);
  const dueBySchedule = Boolean(nextRunDate && nextRunDate.getTime() <= Date.now());

  if (hasPendingReminder || dueBySchedule) {
    return {
      state: "due",
      nextRunAt,
      dueSince: latestReminderAt ?? nextRunAt,
    };
  }

  return {
    state: nextRunAt ? "upcoming" : "not_scheduled",
    nextRunAt,
    dueSince: null,
  };
}

async function loadProgramStatus(
  userId: string,
  database: Queryable = pool,
): Promise<CognitiveAssessmentProgramStatusResponse> {
  const [enrollmentResult, unfinishedResult, latestReportResult, countResult] = await Promise.all([
    database.query<ProgramEnrollmentRow>(`
      select
        e.user_id::text,
        e.status,
        e.start_date,
        e.frequency,
        e.reminder_time::text,
        e.timezone,
        e.scheduled_interaction_id::text,
        e.joined_at,
        e.updated_at,
        si.next_run_at,
        (
          select il.scheduled_for
          from public.interaction_logs il
          where il.user_id = e.user_id::text
            and il.scheduled_interaction_id = e.scheduled_interaction_id
            and il.interaction_type = 'BRAIN_COACH'
            and il.outcome in ('REMINDER_QUEUED', 'REMINDER_SKIPPED')
          order by il.scheduled_for desc nulls last, il.created_at desc
          limit 1
        ) as latest_reminder_at
      from public.cc_program_enrollments e
      left join public.scheduled_interactions si on si.id = e.scheduled_interaction_id
      where e.user_id = $1::uuid
      limit 1
    `, [userId]),
    database.query<ProgramSessionRow>(`
      select
        s.id::text,
        s.started_at,
        s.completed_at,
        count(r.id)::int as response_count
      from public.cc_sessions s
      left join public.cc_task_responses r on r.session_id = s.id
      where s.user_id = $1::uuid
        and s.completed_at is null
        and s.abandoned = false
      group by s.id, s.started_at, s.completed_at
      order by s.started_at desc
      limit 1
    `, [userId]),
    database.query<ProgramSessionRow>(`
      select
        s.id::text,
        s.started_at,
        s.completed_at,
        count(r.id)::int as response_count
      from public.cc_sessions s
      left join public.cc_task_responses r on r.session_id = s.id
      where s.user_id = $1::uuid
        and s.completed_at is not null
        and s.abandoned = false
      group by s.id, s.started_at, s.completed_at
      order by s.completed_at desc
      limit 1
    `, [userId]),
    database.query<CountRow>(`
      select count(*)::int as count
      from public.cc_sessions
      where user_id = $1::uuid
        and completed_at is not null
        and abandoned = false
    `, [userId]),
  ]);

  const enrollmentRow = enrollmentResult.rows[0] ?? null;
  const enrollment = programEnrollmentFromRow(enrollmentRow);
  const latestReport = programSessionSummary(latestReportResult.rows[0] ?? null, false);
  return {
    joined: Boolean(enrollment),
    enrollment,
    reminderStatus: programReminderStatus(enrollment, enrollmentRow, latestReport),
    latestUnfinishedSession: programSessionSummary(unfinishedResult.rows[0] ?? null, true),
    latestReport,
    completedReportCount: countNumber(countResult.rows[0]?.count),
    totalTasks: ASSESSMENT_TASK_TOTAL,
  };
}

async function upsertProgramReminder(input: {
  userId: string;
  actorUserId: string;
  startDate: string;
  frequency: CognitiveAssessmentProgramFrequency;
  reminderTime: string;
  timezone: string;
  preferredLanguage: CognitiveAssessmentLanguage;
  existingScheduleId?: string | null;
  database: Queryable;
}) {
  const nextRunAt = computeNextAssessmentRunAt({
    startDate: input.startDate,
    reminderTime: input.reminderTime,
    timezone: input.timezone,
    frequency: input.frequency,
  });
  const frequencyType = scheduledInteractionFrequencyType(input.frequency);
  const daysOfWeek = scheduledInteractionDaysOfWeek(input.startDate);
  const frequencyValue = {
    source: "cognitive_assessment",
    cadence: input.frequency,
    start_date: input.startDate,
    reminder_time: input.reminderTime,
  };

  const existingResult = input.existingScheduleId
    ? await input.database.query<{ id: string }>(`
        select id::text
        from public.scheduled_interactions
        where id = $1::uuid
          and user_id = $2
        limit 1
      `, [input.existingScheduleId, input.userId])
    : await input.database.query<{ id: string }>(`
        select id::text
        from public.scheduled_interactions
        where user_id = $1
          and interaction_type = 'BRAIN_COACH'
          and source_ref_id = 'cognitive_assessment'
          and status <> 'CANCELLED'
        order by updated_at desc
        limit 1
      `, [input.userId]);

  const existingId = existingResult.rows[0]?.id ?? null;
  if (existingId) {
    const { rows } = await input.database.query<{ id: string }>(`
      update public.scheduled_interactions
      set
        friendly_label = 'Cognitive Assessment',
        user_description = 'A gentle reminder to complete your Cognitive Assessment.',
        status = 'ACTIVE',
        frequency_type = $1,
        frequency_value = $2::jsonb,
        days_of_week = $3::text[],
        times_of_day = $4::text[],
        timezone = $5,
        preferred_language = $6,
        next_run_at = $7::timestamptz,
        is_paused = false,
        pause_until = null,
        pause_reason = null,
        updated_by = $8,
        updated_at = now()
      where id = $9::uuid
      returning id::text
    `, [
      frequencyType,
      JSON.stringify(frequencyValue),
      daysOfWeek,
      [input.reminderTime],
      input.timezone,
      input.preferredLanguage,
      nextRunAt,
      input.actorUserId,
      existingId,
    ]);
    return rows[0]?.id ?? existingId;
  }

  const { rows } = await input.database.query<{ id: string }>(`
    insert into public.scheduled_interactions
      (user_id, interaction_type, friendly_label, user_description, source_ref_id,
       status, frequency_type, frequency_value, days_of_week, times_of_day, timezone,
       preferred_language, next_run_at, consent_required, consent_status,
       admin_edit_allowed, created_by, updated_by)
    values
      ($1, 'BRAIN_COACH', 'Cognitive Assessment', 'A gentle reminder to complete your Cognitive Assessment.',
       'cognitive_assessment', 'ACTIVE', $2, $3::jsonb, $4::text[], $5::text[], $6,
       $7, $8::timestamptz, false, 'not_required', false, $9, $9)
    returning id::text
  `, [
    input.userId,
    frequencyType,
    JSON.stringify(frequencyValue),
    daysOfWeek,
    [input.reminderTime],
    input.timezone,
    input.preferredLanguage,
    nextRunAt,
    input.actorUserId,
  ]);
  return rows[0]?.id ?? null;
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

router.get("/program", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  try {
    return res.json(await loadProgramStatus(userId));
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Program status failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment program could not be loaded." });
  }
});

router.post("/program/join", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  const parsed = joinProgramSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid Cognitive Assessment program setup.", details: parsed.error.flatten() });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const existing = await client.query<{ scheduled_interaction_id: string | null }>(`
      select scheduled_interaction_id::text
      from public.cc_program_enrollments
      where user_id = $1::uuid
      limit 1
    `, [userId]);
    const scheduledInteractionId = await upsertProgramReminder({
      userId,
      actorUserId: userId,
      startDate: parsed.data.startDate,
      frequency: parsed.data.frequency,
      reminderTime: parsed.data.reminderTime,
      timezone: parsed.data.timezone,
      preferredLanguage: normalizeAssessmentLanguage(req.headers["x-vyva-language"]),
      existingScheduleId: existing.rows[0]?.scheduled_interaction_id ?? null,
      database: client,
    });

    await client.query(`
      insert into public.cc_program_enrollments
        (user_id, status, start_date, frequency, reminder_time, timezone, scheduled_interaction_id, joined_at, updated_at)
      values
        ($1::uuid, 'active', $2::date, $3, $4::time, $5, $6::uuid, now(), now())
      on conflict (user_id) do update set
        status = 'active',
        start_date = excluded.start_date,
        frequency = excluded.frequency,
        reminder_time = excluded.reminder_time,
        timezone = excluded.timezone,
        scheduled_interaction_id = excluded.scheduled_interaction_id,
        updated_at = now()
    `, [
      userId,
      parsed.data.startDate,
      parsed.data.frequency,
      parsed.data.reminderTime,
      parsed.data.timezone,
      scheduledInteractionId,
    ]);

    await client.query("commit");
    const response: CognitiveAssessmentProgramJoinResponse = {
      program: await loadProgramStatus(userId),
    };
    return res.status(201).json(response);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Program join failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment program could not be joined." });
  } finally {
    client.release();
  }
});

router.post("/sessions", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  const parsed = startSessionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid assessment start request.", details: parsed.error.flatten() });
  }

  const language = parsed.data.language ?? normalizeAssessmentLanguage(req.headers["x-vyva-language"]);
  const { week, year } = currentWeekAndYear();

  try {
    const readiness = await loadCognitiveAssessmentReadiness();
    const languageStatus = readiness.languages.find((item) => item.language === language);
    if (!readiness.taskDefinitions.ready || !languageStatus?.ready) {
      return res.status(409).json({
        error: "Cognitive Assessment is not ready for this language yet.",
        code: "COGNITIVE_ASSESSMENT_NOT_READY",
        language,
        blockers: cognitiveReadinessBlockersForLanguage(readiness, language),
      });
    }

    const { rows } = await pool.query<SessionRow>(`
      insert into public.cc_sessions
        (user_id, input_mode, language, week_of_year, year)
      values
        ($1::uuid, 'wizard', $2, $3, $4)
      returning
        id::text,
        started_at,
        completed_at,
        input_mode,
        language
    `, [userId, language, week, year]);
    const session = await buildRunnerSession(rows[0]);
    const response: CognitiveAssessmentStartSessionResponse = { session };
    return res.json(response);
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Start session failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment could not be started." });
  }
});

router.get("/sessions/:sessionId", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  const { sessionId } = req.params;
  if (!sessionId || !isUuid(sessionId)) return res.status(400).json({ error: "Invalid assessment session." });

  try {
    const session = await loadSessionForUser(userId, sessionId);
    const response: CognitiveAssessmentLoadSessionResponse = {
      session: session ? await buildRunnerSession(session) : null,
    };
    return res.json(response);
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Load session failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment session could not be loaded." });
  }
});

router.post("/sessions/:sessionId/responses", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  const { sessionId } = req.params;
  if (!sessionId || !isUuid(sessionId)) return res.status(400).json({ error: "Invalid assessment session." });

  const parsed = saveResponseSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid assessment response.", details: parsed.error.flatten() });
  }

  const { taskDefinitionId, responseData, itemBankId = null, rotationFormId = null } = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("begin");
    const sessionResult = await client.query<SessionRow>(`
      select
        id::text,
        started_at,
        completed_at,
        input_mode,
        language
      from public.cc_sessions
      where id = $1::uuid
        and user_id = $2::uuid
      for update
    `, [sessionId, userId]);
    const session = sessionResult.rows[0];
    if (!session) {
      await client.query("rollback");
      return res.status(404).json({ error: "Assessment session not found." });
    }
    if (session.completed_at) {
      await client.query("rollback");
      return res.status(409).json({ error: "This assessment has already been completed." });
    }

    const taskResult = await client.query<{ id: string }>(`
      select id
      from public.cc_task_definitions
      where id = $1
        and is_active = true
        and supports_wizard = true
      limit 1
    `, [taskDefinitionId]);
    if (!taskResult.rows[0]) {
      await client.query("rollback");
      return res.status(400).json({ error: "Assessment step is not available." });
    }

    if (itemBankId) {
      const itemResult = await client.query<{ task_definition_id: string }>(`
        select task_definition_id
        from public.cc_item_bank
        where id = $1::uuid
          and language = $2
          and is_active = true
          and rejected = false
        limit 1
      `, [itemBankId, session.language]);
      const itemTaskId = itemResult.rows[0]?.task_definition_id;
      const allowedItemTasks = taskDefinitionId === "story_recall_delayed"
        ? ["story_recall_immediate", "story_recall_delayed"]
        : [taskDefinitionId];
      if (!itemTaskId || !allowedItemTasks.includes(itemTaskId)) {
        await client.query("rollback");
        return res.status(400).json({ error: "Assessment content is no longer available." });
      }
    }

    if (rotationFormId) {
      const formResult = await client.query<{ task_definition_id: string }>(`
        select task_definition_id
        from public.cc_rotation_forms
        where id = $1::uuid
          and language = $2
          and is_active = true
        limit 1
      `, [rotationFormId, session.language]);
      if (formResult.rows[0]?.task_definition_id !== taskDefinitionId) {
        await client.query("rollback");
        return res.status(400).json({ error: "Assessment form is no longer available." });
      }
    }

    await client.query(`
      delete from public.cc_task_responses
      where session_id = $1::uuid
        and task_definition_id = $2
    `, [sessionId, taskDefinitionId]);

    await client.query(`
      insert into public.cc_task_responses
        (session_id, task_definition_id, item_bank_id, rotation_form_id, started_at, completed_at, input_mode, response_data)
      values
        ($1::uuid, $2, $3::uuid, $4::uuid, now(), now(), 'wizard', $5::jsonb)
    `, [
      sessionId,
      taskDefinitionId,
      itemBankId,
      rotationFormId,
      JSON.stringify(responseData),
    ]);

    await client.query("commit");
    const completedTaskIds = await loadCompletedTaskIds(sessionId);
    const response: CognitiveAssessmentSaveResponseResponse = { saved: true, completedTaskIds };
    return res.json(response);
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Save response failed:", error);
    return res.status(500).json({ error: "Assessment response could not be saved." });
  } finally {
    client.release();
  }
});

router.post("/sessions/:sessionId/complete", async (req: Request, res: Response) => {
  const userId = requireUuidUser(req, res);
  if (!userId) return;

  const { sessionId } = req.params;
  if (!sessionId || !isUuid(sessionId)) return res.status(400).json({ error: "Invalid assessment session." });

  try {
    const { rows } = await pool.query<{ id: string }>(`
      update public.cc_sessions
      set completed_at = coalesce(completed_at, now())
      where id = $1::uuid
        and user_id = $2::uuid
        and abandoned = false
      returning id::text
    `, [sessionId, userId]);
    if (!rows[0]) return res.status(404).json({ error: "Assessment session not found." });

    await markCognitiveAssessmentReminderCompleted({ userId }).catch((error) => {
      console.error("[cognitive-assessment] Schedule completion update failed:", error);
    });

    const response: CognitiveAssessmentCompleteSessionResponse = {
      sessionId: rows[0].id,
      reportUrl: `/mind-memory/cognitive-assessment/report/${rows[0].id}`,
    };
    return res.json(response);
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] Complete session failed:", error);
    return res.status(500).json({ error: "Assessment session could not be completed." });
  }
});

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
  if (!userId || !isUuid(userId)) {
    return res.json({
      history: [],
      historyInsights: [],
      trendPoints: [],
      domainTrends: [],
      domainTrendSeries: [],
      taskSignals: [],
      baselineBands: [],
      checkQuality: {
        status: "building",
        label: "No comparison yet",
        detail: "Complete a check to start tracking.",
        factors: [],
      },
      contextInsight: {
        tone: "building",
        label: "Context not saved",
        detail: "Mood, sleep, and daily function make comparisons clearer.",
        relatedSignals: [],
      },
    });
  }

  try {
    const sessions = await loadCompletedSessions(userId, 12);
    const responsesBySession = await loadResponsesForSessions(sessions.map((session) => session.id));
    const trends = buildCognitiveAssessmentTrendPayload(sessions, responsesBySession, ASSESSMENT_TASK_TOTAL);
    const response: CognitiveAssessmentHistoryResponse = {
      history: sessions.map((session) => historyItem(session, Number(session.response_count ?? 0))),
      ...trends,
    };
    return res.json({
      ...response,
    });
  } catch (error) {
    const handled = schemaMissingResponse(error, res);
    if (handled) return handled;
    console.error("[cognitive-assessment] History failed:", error);
    return res.status(500).json({ error: "Cognitive Assessment history could not be loaded." });
  }
});

export default router;
