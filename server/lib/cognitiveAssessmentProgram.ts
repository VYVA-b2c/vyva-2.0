import type { CognitiveAssessmentProgramFrequency } from "../../shared/cognitiveAssessmentProgram.js";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

function parseDate(value: string): LocalDate | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseTime(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function zoneDateParts(date: Date, timeZone: string): DateParts {
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
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    };
  }
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const local = zoneDateParts(date, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(local: LocalDate, hour: number, minute: number, timeZone: string) {
  const guess = new Date(Date.UTC(local.year, local.month - 1, local.day, hour, minute, 0));
  const offset = timeZoneOffsetMs(guess, timeZone);
  return new Date(guess.getTime() - offset);
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addDays(local: LocalDate, days: number): LocalDate {
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days, 12, 0, 0));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function addMonths(local: LocalDate, months: number): LocalDate {
  const targetMonthIndex = local.month - 1 + months;
  const year = local.year + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12 + 1;
  return {
    year,
    month,
    day: Math.min(local.day, daysInMonth(year, month)),
  };
}

function incrementDate(local: LocalDate, frequency: CognitiveAssessmentProgramFrequency) {
  if (frequency === "weekly") return addDays(local, 7);
  if (frequency === "every_2_weeks") return addDays(local, 14);
  return addMonths(local, 1);
}

export function scheduledInteractionFrequencyType(frequency: CognitiveAssessmentProgramFrequency) {
  return frequency === "weekly" ? "WEEKLY" : "CUSTOM";
}

export function scheduledInteractionDaysOfWeek(startDate: string): string[] {
  const parsed = parseDate(startDate);
  if (!parsed) return [];
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  return [WEEKDAYS[date.getUTCDay()]];
}

export function computeNextAssessmentRunAt(input: {
  startDate: string;
  reminderTime: string;
  timezone: string;
  frequency: CognitiveAssessmentProgramFrequency;
  now?: Date;
}) {
  const time = parseTime(input.reminderTime);
  let local = parseDate(input.startDate);
  if (!time || !local) return null;

  const now = input.now ?? new Date();
  for (let index = 0; index < 96; index += 1) {
    const candidate = zonedDateTimeToUtc(local, time.hour, time.minute, input.timezone);
    if (candidate.getTime() > now.getTime()) return candidate;
    local = incrementDate(local, input.frequency);
  }
  return null;
}
