export type HealthInsightsCronAction = "weekly" | "monthly" | "outcomes";

type ZonedTime = {
  weekday: string;
  day: number;
  hour: number;
};

function getZonedTime(now: Date, timeZone: string): ZonedTime {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return {
    weekday: value("weekday") ?? "",
    day: Number(value("day") ?? Number.NaN),
    hour: Number(value("hour") ?? Number.NaN),
  };
}

export function getHealthInsightsCronActions(
  now = new Date(),
  timeZone = "Europe/Madrid",
): HealthInsightsCronAction[] {
  const local = getZonedTime(now, timeZone);
  const actions: HealthInsightsCronAction[] = [];

  if (local.weekday === "Mon" && local.hour === 3) {
    actions.push("weekly");
    if (local.day <= 7) actions.push("monthly");
  }
  if (local.hour === 4) actions.push("outcomes");

  return actions;
}
