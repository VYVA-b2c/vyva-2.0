export const BRAIN_COACH_SCHEDULE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type BrainCoachScheduleDay = typeof BRAIN_COACH_SCHEDULE_DAYS[number];

export type BrainCoachScheduleInput = {
  daysOfWeek?: string[] | null;
  timesOfDay?: string[] | null;
  timezone?: string | null;
  paused?: boolean | null;
};

export type NormalizedBrainCoachSchedule = {
  daysOfWeek: BrainCoachScheduleDay[];
  timesOfDay: string[];
  timezone: string;
  paused: boolean;
};

const DEFAULT_DAYS: BrainCoachScheduleDay[] = ["MON", "WED", "FRI"];
const DEFAULT_TIMES = ["11:00"];
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeTime(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function normalizeBrainCoachSchedule(input: BrainCoachScheduleInput | null | undefined): NormalizedBrainCoachSchedule {
  const days = Array.isArray(input?.daysOfWeek)
    ? input.daysOfWeek
        .map((day) => day.trim().slice(0, 3).toUpperCase())
        .filter((day): day is BrainCoachScheduleDay => BRAIN_COACH_SCHEDULE_DAYS.includes(day as BrainCoachScheduleDay))
    : [];
  const times = Array.isArray(input?.timesOfDay)
    ? input.timesOfDay
        .map((time) => normalizeTime(time))
        .filter((time): time is string => Boolean(time))
    : [];
  const timezone = typeof input?.timezone === "string" && input.timezone.trim().length > 0
    ? input.timezone.trim().slice(0, 100)
    : "Europe/Madrid";

  return {
    daysOfWeek: Array.from(new Set(days)).length ? Array.from(new Set(days)) : [...DEFAULT_DAYS],
    timesOfDay: Array.from(new Set(times)).sort().slice(0, 5).length ? Array.from(new Set(times)).sort().slice(0, 5) : [...DEFAULT_TIMES],
    timezone,
    paused: input?.paused === true,
  };
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

function dayKeyFromLocalParts(local: ZoneDateParts): BrainCoachScheduleDay {
  return BRAIN_COACH_SCHEDULE_DAYS[(new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay() + 6) % 7];
}

export function computeBrainCoachNextRunAt(input: NormalizedBrainCoachSchedule & { status?: string }, now = new Date()): Date | null {
  if (input.status === "PAUSED" || input.paused) return null;
  const allowedDays = new Set(input.daysOfWeek);

  for (let offset = 0; offset <= 30; offset += 1) {
    const localDay = localDateAfterDays(now, offset, input.timezone);
    if (!allowedDays.has(dayKeyFromLocalParts(localDay))) continue;

    for (const time of input.timesOfDay) {
      const [hour, minute] = time.split(":").map(Number);
      const candidate = zonedDateTimeToUtc(localDay, hour, minute, input.timezone);
      if (candidate.getTime() > now.getTime()) return candidate;
    }
  }

  return null;
}
