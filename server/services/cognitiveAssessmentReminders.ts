import { pool } from "../db.js";
import { computeNextAssessmentRunAt } from "../lib/cognitiveAssessmentProgram.js";
import { languageText, normalizeAppLanguage } from "../../shared/language.js";
import type { CognitiveAssessmentProgramFrequency } from "../../shared/cognitiveAssessmentProgram.js";

const REMINDER_PURPOSE = "cognitive_assessment_reminder";
const REMINDER_ROUTE = "/mind-memory/cognitive-assessment";
const VALID_FREQUENCIES = new Set<CognitiveAssessmentProgramFrequency>(["weekly", "every_2_weeks", "monthly"]);

type Queryable = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }>;
};

type DueReminderRow = {
  id: string;
  user_id: string;
  next_run_at: Date | string | null;
  start_date: Date | string | null;
  frequency: string | null;
  reminder_time: string | null;
  timezone: string | null;
  preferred_language: string | null;
  preferred_name: string | null;
  full_name: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  email: string | null;
  channel_notifications: string | null;
  preferred_reminder_channel: string | null;
};

type CompletionScheduleRow = {
  id: string;
  user_id: string;
  next_run_at: Date | string | null;
  start_date: Date | string | null;
  frequency: string | null;
  reminder_time: string | null;
  timezone: string | null;
};

type DeliveryTarget = {
  channel: "whatsapp" | "sms" | "voice" | "email";
  recipient: string;
};

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toDateString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeFrequency(value: string | null | undefined): CognitiveAssessmentProgramFrequency {
  return VALID_FREQUENCIES.has(value as CognitiveAssessmentProgramFrequency)
    ? value as CognitiveAssessmentProgramFrequency
    : "monthly";
}

function appUrl(path: string) {
  const base = [
    process.env.PUBLIC_APP_URL,
    process.env.APP_URL,
    "https://v2.vyva.life",
  ].map((value) => value?.trim()).find(Boolean);
  if (!base) return path;

  try {
    return new URL(path, base.endsWith("/") ? base : `${base}/`).toString();
  } catch {
    return path;
  }
}

function deliveryTargetFor(row: DueReminderRow): DeliveryTarget | null {
  const preferred = cleanString(row.preferred_reminder_channel)?.toLowerCase();
  const profileChannel = cleanString(row.channel_notifications)?.toLowerCase();
  const whatsapp = cleanString(row.whatsapp_number) ?? cleanString(row.phone_number);
  const phone = cleanString(row.phone_number) ?? cleanString(row.whatsapp_number);
  const email = cleanString(row.email);

  if (preferred?.startsWith("whatsapp")) {
    if (whatsapp) return { channel: "whatsapp", recipient: whatsapp };
  }
  if (preferred === "voice_outbound") {
    if (phone) return { channel: "voice", recipient: phone };
  }
  if (preferred === "voice_app") {
    return null;
  }
  if (profileChannel === "email" && email) {
    return { channel: "email", recipient: email };
  }
  if (profileChannel === "sms" && phone) {
    return { channel: "sms", recipient: phone };
  }
  if (profileChannel === "whatsapp" && whatsapp) {
    return { channel: "whatsapp", recipient: whatsapp };
  }
  if (whatsapp) return { channel: "whatsapp", recipient: whatsapp };
  if (phone) return { channel: "sms", recipient: phone };
  if (email) return { channel: "email", recipient: email };
  return null;
}

function reminderBody(row: DueReminderRow, url: string) {
  const language = normalizeAppLanguage(row.preferred_language, "en");
  const name = cleanString(row.preferred_name) ?? cleanString(row.full_name);
  const greeting = name
    ? languageText(language, {
      en: `Hi ${name}.`,
      es: `Hola ${name}.`,
      fr: `Bonjour ${name}.`,
      de: `Hallo ${name}.`,
      pt: `Ola ${name}.`,
    })
    : "VYVA.";

  return languageText(language, {
    en: `${greeting} It is time for your Cognitive Assessment. Open your check: ${url}`,
    es: `${greeting} Es hora de tu Evaluacion Cognitiva. Abre tu chequeo: ${url}`,
    fr: `${greeting} C'est le moment de votre evaluation cognitive. Ouvrez votre bilan: ${url}`,
    de: `${greeting} Es ist Zeit fuer Ihre kognitive Bewertung. Oeffnen Sie Ihren Check: ${url}`,
    pt: `${greeting} Esta na hora da sua Avaliacao Cognitiva. Abra o seu check: ${url}`,
  });
}

function nextRunFromSchedule(
  row: Pick<DueReminderRow | CompletionScheduleRow, "start_date" | "frequency" | "reminder_time" | "timezone">,
  now: Date,
) {
  const startDate = toDateString(row.start_date) ?? now.toISOString().slice(0, 10);
  const reminderTime = cleanString(row.reminder_time) ?? "10:00";
  const timezone = cleanString(row.timezone) ?? "Europe/Madrid";
  return computeNextAssessmentRunAt({
    startDate,
    reminderTime,
    timezone,
    frequency: normalizeFrequency(row.frequency),
    now,
  });
}

async function communicationAlreadyQueued(
  database: Queryable,
  userId: string,
  scheduleId: string,
  scheduledFor: string,
) {
  const existing = await database.query<{ id: string }>(`
    select id::text
    from public.communications_log
    where user_id = $1
      and purpose = $2
      and metadata->>'schedule_id' = $3
      and metadata->>'scheduled_for' = $4
      and status in ('queued', 'sending', 'sent')
    limit 1
  `, [userId, REMINDER_PURPOSE, scheduleId, scheduledFor]);
  return existing.rows[0]?.id ?? null;
}

async function recordReminderLog(input: {
  database: Queryable;
  row: DueReminderRow | CompletionScheduleRow;
  scheduledFor: string | null;
  outcome: string;
  summary: string;
  riskFlags?: string[];
}) {
  await input.database.query(`
    insert into public.interaction_logs (
      user_id, scheduled_interaction_id, interaction_type, scheduled_for,
      started_at, completed_at, outcome, summary, sentiment, risk_flags
    ) values ($1, $2::uuid, 'BRAIN_COACH', $3::timestamptz, now(), now(), $4, $5, $6, $7::jsonb)
  `, [
    input.row.user_id,
    input.row.id,
    input.scheduledFor,
    input.outcome,
    input.summary,
    input.outcome === "COMPLETED" ? "responded" : "neutral",
    JSON.stringify(input.riskFlags ?? []),
  ]);
}

async function advanceReminderSchedule(input: {
  database: Queryable;
  scheduleId: string;
  result: string;
  nextRunAt: Date | null;
  completedAt?: Date | null;
}) {
  await input.database.query(`
    update public.scheduled_interactions
    set
      last_result = $1,
      next_run_at = $2::timestamptz,
      last_completed_at = coalesce($3::timestamptz, last_completed_at),
      updated_at = now()
    where id = $4::uuid
  `, [
    input.result,
    input.nextRunAt,
    input.completedAt ?? null,
    input.scheduleId,
  ]);
}

export async function queueDueCognitiveAssessmentReminders(options: {
  database?: Queryable;
  now?: Date;
  limit?: number;
} = {}) {
  const database = options.database ?? pool;
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));
  const { rows } = await database.query<DueReminderRow>(`
    select
      si.id::text,
      si.user_id::text,
      si.next_run_at,
      e.start_date,
      e.frequency,
      e.reminder_time::text,
      e.timezone,
      si.preferred_language,
      p.preferred_name,
      p.full_name,
      p.phone_number,
      p.whatsapp_number,
      p.email,
      p.channel_notifications,
      ucp.preferred_reminder_channel::text
    from public.scheduled_interactions si
    join public.cc_program_enrollments e on e.scheduled_interaction_id = si.id
    left join public.profiles p on p.id::text = si.user_id::text
    left join public.user_channel_preferences ucp on ucp.user_id = si.user_id::text
    where si.interaction_type = 'BRAIN_COACH'
      and si.source_ref_id = 'cognitive_assessment'
      and si.status = 'ACTIVE'
      and si.is_paused = false
      and si.next_run_at is not null
      and si.next_run_at <= $1::timestamptz
      and e.status = 'active'
    order by si.next_run_at asc
    limit $2
  `, [now, limit]);

  let queued = 0;
  let skipped = 0;
  let alreadyQueued = 0;

  for (const row of rows) {
    const scheduledFor = iso(row.next_run_at);
    if (!scheduledFor) {
      skipped += 1;
      continue;
    }

    const nextRunAt = nextRunFromSchedule(row, now);
    const existingCommunicationId = await communicationAlreadyQueued(database, row.user_id, row.id, scheduledFor);
    if (existingCommunicationId) {
      alreadyQueued += 1;
      await advanceReminderSchedule({
        database,
        scheduleId: row.id,
        result: "REMINDER_QUEUED",
        nextRunAt,
      });
      continue;
    }

    const delivery = deliveryTargetFor(row);
    if (!delivery) {
      skipped += 1;
      await recordReminderLog({
        database,
        row,
        scheduledFor,
        outcome: "REMINDER_SKIPPED",
        summary: "Cognitive Assessment reminder was due, but no outbound reminder channel was available.",
        riskFlags: ["cognitive_assessment_no_reminder_channel"],
      });
      await advanceReminderSchedule({
        database,
        scheduleId: row.id,
        result: "REMINDER_SKIPPED",
        nextRunAt,
      });
      continue;
    }

    const url = appUrl(REMINDER_ROUTE);
    const body = reminderBody(row, url);
    const communication = await database.query<{ id: string }>(`
      insert into public.communications_log (
        user_id, channel, recipient, purpose, status, body, metadata
      ) values ($1, $2, $3, $4, 'queued', $5, $6::jsonb)
      returning id::text
    `, [
      row.user_id,
      delivery.channel,
      delivery.recipient,
      REMINDER_PURPOSE,
      body,
      JSON.stringify({
        source: "cognitive_assessment",
        route: REMINDER_ROUTE,
        url,
        schedule_id: row.id,
        scheduled_for: scheduledFor,
        next_run_at: nextRunAt?.toISOString() ?? null,
      }),
    ]);

    queued += 1;
    await recordReminderLog({
      database,
      row,
      scheduledFor,
      outcome: "REMINDER_QUEUED",
      summary: `Cognitive Assessment reminder queued via ${delivery.channel}.`,
      riskFlags: communication.rows[0]?.id ? [] : ["cognitive_assessment_reminder_queue_unknown"],
    });
    await advanceReminderSchedule({
      database,
      scheduleId: row.id,
      result: "REMINDER_QUEUED",
      nextRunAt,
    });
  }

  return {
    evaluated: rows.length,
    queued,
    skipped,
    alreadyQueued,
  };
}

export async function markCognitiveAssessmentReminderCompleted(options: {
  userId: string;
  completedAt?: Date;
  database?: Queryable;
}) {
  const database = options.database ?? pool;
  const completedAt = options.completedAt ?? new Date();
  const { rows } = await database.query<CompletionScheduleRow>(`
    select
      si.id::text,
      si.user_id::text,
      si.next_run_at,
      e.start_date,
      e.frequency,
      e.reminder_time::text,
      e.timezone
    from public.cc_program_enrollments e
    join public.scheduled_interactions si on si.id = e.scheduled_interaction_id
    where e.user_id = $1::uuid
      and e.status = 'active'
      and si.interaction_type = 'BRAIN_COACH'
      and si.source_ref_id = 'cognitive_assessment'
      and si.status = 'ACTIVE'
    order by si.updated_at desc
    limit 1
  `, [options.userId]);

  const row = rows[0];
  if (!row) return { updated: false };

  const nextRunAt = nextRunFromSchedule(row, completedAt);
  await recordReminderLog({
    database,
    row,
    scheduledFor: iso(row.next_run_at),
    outcome: "COMPLETED",
    summary: "Cognitive Assessment completed.",
  });
  await advanceReminderSchedule({
    database,
    scheduleId: row.id,
    result: "COMPLETED",
    nextRunAt,
    completedAt,
  });

  return {
    updated: true,
    nextRunAt: nextRunAt?.toISOString() ?? null,
  };
}
