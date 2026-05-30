export const DAILY_CHECKIN_ALERT_TYPE = "daily_checkin_no_response";
export const DAILY_CHECKIN_GRACE_MINUTES = 120;

export type DailyCheckinState = "completed" | "upcoming" | "due_now" | "overdue" | "not_scheduled";

export type DailyCheckinScheduleInput = {
  now?: Date;
  timezone?: string | null;
  scheduledTimes?: string[] | null;
  latestCompletedAt?: Date | string | null;
  graceMinutes?: number;
};

export type DailyCheckinScheduleStatus = {
  state: DailyCheckinState;
  date_key: string;
  timezone: string;
  scheduled_for: string | null;
  next_scheduled_for: string | null;
  latest_completed_at: string | null;
  minutes_until_due: number | null;
  minutes_overdue: number | null;
  grace_minutes: number;
  day_start: Date;
  day_end: Date;
};

type ZoneDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function normalizeCheckinTimes(values: string[] | null | undefined): string[] {
  const normalized = (values ?? [])
    .map((value) => {
      const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
      }
      return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    })
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(normalized)).sort();
}

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

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const local = zoneDateParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(local: Pick<ZoneDateParts, "year" | "month" | "day">, hour: number, minute: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function localDateAfterDays(base: Date, offsetDays: number, timeZone: string): Pick<ZoneDateParts, "year" | "month" | "day"> {
  const local = zoneDateParts(base, timeZone);
  const noonUtc = new Date(Date.UTC(local.year, local.month - 1, local.day + offsetDays, 12, 0, 0));
  const shifted = zoneDateParts(noonUtc, timeZone);
  return { year: shifted.year, month: shifted.month, day: shifted.day };
}

function dateKey(parts: Pick<ZoneDateParts, "year" | "month" | "day">): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function localDayWindow(now: Date, timezone = "Europe/Madrid") {
  const today = localDateAfterDays(now, 0, timezone);
  const tomorrow = localDateAfterDays(now, 1, timezone);
  return {
    date_key: dateKey(today),
    start: zonedDateTimeToUtc(today, 0, 0, timezone),
    end: zonedDateTimeToUtc(tomorrow, 0, 0, timezone),
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function scheduledInstantsForLocalDay(now: Date, timezone: string, scheduledTimes: string[]): Date[] {
  const today = localDateAfterDays(now, 0, timezone);
  return scheduledTimes.map((time) => {
    const [hour, minute] = time.split(":").map(Number);
    return zonedDateTimeToUtc(today, hour, minute, timezone);
  });
}

export function nextCheckinRunAt(input: {
  now?: Date;
  timezone?: string | null;
  scheduledTimes?: string[] | null;
  status?: string | null;
  isPaused?: boolean | null;
}): Date | null {
  if (input.status && input.status !== "ACTIVE") return null;
  if (input.isPaused) return null;
  const now = input.now ?? new Date();
  const timezone = input.timezone || "Europe/Madrid";
  const times = normalizeCheckinTimes(input.scheduledTimes);
  const safeTimes = times.length ? times : ["10:00"];

  for (let offset = 0; offset <= 30; offset += 1) {
    const localDay = localDateAfterDays(now, offset, timezone);
    for (const time of safeTimes) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = zonedDateTimeToUtc(localDay, hour, minute, timezone);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  return null;
}

export function evaluateDailyCheckinSchedule(input: DailyCheckinScheduleInput): DailyCheckinScheduleStatus {
  const now = input.now ?? new Date();
  const timezone = input.timezone || "Europe/Madrid";
  const graceMinutes = input.graceMinutes ?? DAILY_CHECKIN_GRACE_MINUTES;
  const times = normalizeCheckinTimes(input.scheduledTimes);
  const latestCompleted = toDate(input.latestCompletedAt);
  const day = localDayWindow(now, timezone);
  const completedToday = latestCompleted
    ? latestCompleted.getTime() >= day.start.getTime() && latestCompleted.getTime() < day.end.getTime()
    : false;

  if (completedToday) {
    return {
      state: "completed",
      date_key: day.date_key,
      timezone,
      scheduled_for: null,
      next_scheduled_for: nextCheckinRunAt({ now, timezone, scheduledTimes: times })?.toISOString() ?? null,
      latest_completed_at: latestCompleted?.toISOString() ?? null,
      minutes_until_due: null,
      minutes_overdue: null,
      grace_minutes: graceMinutes,
      day_start: day.start,
      day_end: day.end,
    };
  }

  if (times.length === 0) {
    return {
      state: "not_scheduled",
      date_key: day.date_key,
      timezone,
      scheduled_for: null,
      next_scheduled_for: null,
      latest_completed_at: latestCompleted?.toISOString() ?? null,
      minutes_until_due: null,
      minutes_overdue: null,
      grace_minutes: graceMinutes,
      day_start: day.start,
      day_end: day.end,
    };
  }

  const scheduledToday = scheduledInstantsForLocalDay(now, timezone, times).sort((a, b) => a.getTime() - b.getTime());
  const dueInstants = scheduledToday.filter((candidate) => candidate.getTime() <= now.getTime());
  const nextInstant = scheduledToday.find((candidate) => candidate.getTime() > now.getTime()) ?? nextCheckinRunAt({ now, timezone, scheduledTimes: times });
  const latestDue = dueInstants[dueInstants.length - 1] ?? null;

  if (!latestDue) {
    const minutesUntilDue = nextInstant ? Math.max(0, Math.round((nextInstant.getTime() - now.getTime()) / 60000)) : null;
    return {
      state: "upcoming",
      date_key: day.date_key,
      timezone,
      scheduled_for: null,
      next_scheduled_for: nextInstant?.toISOString() ?? null,
      latest_completed_at: latestCompleted?.toISOString() ?? null,
      minutes_until_due: minutesUntilDue,
      minutes_overdue: null,
      grace_minutes: graceMinutes,
      day_start: day.start,
      day_end: day.end,
    };
  }

  const minutesSinceDue = Math.max(0, Math.round((now.getTime() - latestDue.getTime()) / 60000));
  const overdueMinutes = Math.max(0, minutesSinceDue - graceMinutes);
  const state: DailyCheckinState = overdueMinutes > 0 ? "overdue" : "due_now";

  return {
    state,
    date_key: day.date_key,
    timezone,
    scheduled_for: latestDue.toISOString(),
    next_scheduled_for: nextInstant?.toISOString() ?? null,
    latest_completed_at: latestCompleted?.toISOString() ?? null,
    minutes_until_due: null,
    minutes_overdue: state === "overdue" ? overdueMinutes : null,
    grace_minutes: graceMinutes,
    day_start: day.start,
    day_end: day.end,
  };
}
