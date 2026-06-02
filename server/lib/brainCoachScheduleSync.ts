import { and, desc, eq } from "drizzle-orm";
import { db } from "../db.js";
import { profiles, scheduledInteractions } from "../../shared/schema.js";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DEFAULT_BRAIN_COACH_TIMES = ["11:00"];
const DEFAULT_BRAIN_COACH_DAYS = ["MON", "WED", "FRI"];

export type BrainCoachScheduleRow = typeof scheduledInteractions.$inferSelect;

export type BrainCoachScheduleSyncResult = {
  previousSchedule: BrainCoachScheduleRow | null;
  schedule: BrainCoachScheduleRow;
  created: boolean;
};

function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeBrainCoachScheduleTimes(values: string[] | null | undefined) {
  const result = (values ?? [])
    .map((value) => normalizeTime(value))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(result)).sort();
}

function normalizeDays(values: string[] | null | undefined) {
  const result = (values ?? [])
    .map((value) => value.trim().slice(0, 3).toUpperCase())
    .filter((value): value is typeof DAYS[number] => DAYS.includes(value as typeof DAYS[number]));
  return Array.from(new Set(result));
}

type ZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zoneDateParts(date: Date, timeZone: string): ZoneDateParts {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return {
      year: value("year"),
      month: value("month"),
      day: value("day"),
      hour: value("hour"),
      minute: value("minute"),
      second: value("second"),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

function localDateAfterDays(base: Date, offsetDays: number, timeZone: string): ZoneDateParts {
  const local = zoneDateParts(base, timeZone);
  const noonUtc = new Date(Date.UTC(local.year, local.month - 1, local.day + offsetDays, 12, 0, 0));
  return zoneDateParts(noonUtc, timeZone);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const local = zoneDateParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(local: ZoneDateParts, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function dayKeyFromLocalParts(local: ZoneDateParts): typeof DAYS[number] {
  return DAYS[(new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() + 6) % 7];
}

export function computeBrainCoachNextRunAt(input: {
  status: string;
  isPaused: boolean;
  frequencyType: string;
  daysOfWeek: string[];
  timesOfDay: string[];
  timezone: string;
  now?: Date;
}): Date | null {
  if (input.status !== "ACTIVE" || input.isPaused) return null;
  const times = input.timesOfDay.length ? input.timesOfDay : DEFAULT_BRAIN_COACH_TIMES;
  const weeklyDays = input.frequencyType === "WEEKLY" || input.frequencyType === "CUSTOM"
    ? new Set(normalizeDays(input.daysOfWeek))
    : null;
  const now = input.now ?? new Date();

  for (let offset = 0; offset <= 30; offset += 1) {
    const localDay = localDateAfterDays(now, offset, input.timezone);
    if (weeklyDays && !weeklyDays.has(dayKeyFromLocalParts(localDay))) continue;

    for (const time of times) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = zonedDateTimeToUtc(localDay, hour, minute, input.timezone);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  return null;
}

async function loadBrainCoachSchedule(userId: string) {
  const rows = await db
    .select()
    .from(scheduledInteractions)
    .where(and(
      eq(scheduledInteractions.user_id, userId),
      eq(scheduledInteractions.interaction_type, "BRAIN_COACH"),
    ))
    .orderBy(desc(scheduledInteractions.updated_at))
    .limit(10);

  return rows.find((row) => row.status !== "CANCELLED") ?? rows[0] ?? null;
}

function defaultLabel() {
  return "Entrenador de memoria";
}

function defaultDescription() {
  return "Sesiones suaves para memoria, atencion y compania.";
}

export function brainCoachScheduleAuditSnapshot(schedule: BrainCoachScheduleRow | null | undefined) {
  if (!schedule) return null;
  return {
    id: schedule.id,
    status: schedule.status,
    is_paused: schedule.is_paused,
    times_of_day: schedule.times_of_day,
    days_of_week: schedule.days_of_week,
    timezone: schedule.timezone,
    next_run_at: schedule.next_run_at instanceof Date ? schedule.next_run_at.toISOString() : schedule.next_run_at ?? null,
  };
}

export async function syncBrainCoachScheduledInteraction(input: {
  userId: string;
  actorUserId: string;
  preferredTrainingTimes: string[];
  paused: boolean;
}): Promise<BrainCoachScheduleSyncResult> {
  const [[profile], existing] = await Promise.all([
    db
      .select({ timezone: profiles.timezone, language: profiles.language })
      .from(profiles)
      .where(eq(profiles.id, input.userId))
      .limit(1),
    loadBrainCoachSchedule(input.userId),
  ]);

  const normalizedTimes = normalizeBrainCoachScheduleTimes(input.preferredTrainingTimes);
  const timesOfDay = normalizedTimes.length > 0
    ? normalizedTimes
    : existing?.times_of_day?.length
      ? existing.times_of_day
      : DEFAULT_BRAIN_COACH_TIMES;
  const daysOfWeek = normalizeDays(existing?.days_of_week).length > 0
    ? normalizeDays(existing?.days_of_week)
    : DEFAULT_BRAIN_COACH_DAYS;
  const timezone = existing?.timezone || profile?.timezone || "Europe/Madrid";
  const frequencyType = existing?.frequency_type || "WEEKLY";
  const status = input.paused ? "PAUSED" : "ACTIVE";
  const nextRunAt = computeBrainCoachNextRunAt({
    status,
    isPaused: input.paused,
    frequencyType,
    daysOfWeek,
    timesOfDay,
    timezone,
  });
  const timestamp = new Date();
  const schedulePatch = {
    status,
    frequency_type: frequencyType,
    days_of_week: daysOfWeek,
    times_of_day: timesOfDay,
    timezone,
    preferred_language: existing?.preferred_language || profile?.language || "es",
    is_paused: input.paused,
    pause_until: null,
    pause_reason: input.paused ? "Paused from Brain Coach caregiver settings." : null,
    next_run_at: nextRunAt,
    updated_by: input.actorUserId,
    updated_at: timestamp,
  };

  if (existing) {
    const [updated] = await db
      .update(scheduledInteractions)
      .set(schedulePatch)
      .where(eq(scheduledInteractions.id, existing.id))
      .returning();
    return { previousSchedule: existing, schedule: updated, created: false };
  }

  const [created] = await db
    .insert(scheduledInteractions)
    .values({
      ...schedulePatch,
      user_id: input.userId,
      interaction_type: "BRAIN_COACH",
      friendly_label: defaultLabel(),
      user_description: defaultDescription(),
      frequency_value: { session_type: "memory" },
      created_by: input.actorUserId,
      created_at: timestamp,
    })
    .returning();

  return { previousSchedule: null, schedule: created, created: true };
}
