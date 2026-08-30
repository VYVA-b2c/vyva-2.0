export type RefillInventoryStatus = "setup_needed" | "on_track" | "refill_soon" | "refill_now" | "uncertain";

export type RefillInventoryEvent = {
  eventType: "purchase" | "stock_count" | "correction";
  quantity: number;
  occurredOn: string;
  createdAt?: string;
};

export type RefillInventoryEstimate = {
  estimatedQuantity: number | null;
  daysRemaining: number | null;
  projectedRunOutDate: string | null;
  status: RefillInventoryStatus;
  confidence: "high" | "medium" | "low";
  calculationReason: string;
};

const DAY_MS = 86_400_000;

function dateKey(value: string | Date) {
  return new Date(value instanceof Date ? value : `${value.slice(0, 10)}T00:00:00.000Z`).toISOString().slice(0, 10);
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return Math.floor((new Date(`${end}T00:00:00.000Z`).getTime() - new Date(`${start}T00:00:00.000Z`).getTime()) / DAY_MS) + 1;
}

function addDays(start: string, days: number) {
  const value = new Date(`${start}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function calculateRefillInventory(input: {
  today: string;
  unitsPerDose: number | null;
  dailyFrequency: number | null;
  refillAlertDays: number;
  events: RefillInventoryEvent[];
  missedDosesByDate?: Record<string, number>;
}): RefillInventoryEstimate {
  const today = dateKey(input.today);
  const unitsPerDose = input.unitsPerDose ?? 0;
  const dailyFrequency = input.dailyFrequency ?? 0;
  const events = input.events
    .filter((event) => Number.isFinite(event.quantity) && event.occurredOn <= today)
    .toSorted((left, right) => left.occurredOn.localeCompare(right.occurredOn) || String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")));

  if (unitsPerDose <= 0 || dailyFrequency <= 0 || events.length === 0) {
    return {
      estimatedQuantity: null,
      daysRemaining: null,
      projectedRunOutDate: null,
      status: "setup_needed",
      confidence: "low",
      calculationReason: "Add the quantity, unit, and confirmed daily routine to start tracking.",
    };
  }

  let resetIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].eventType === "stock_count") {
      resetIndex = index;
      break;
    }
  }

  const relevantEvents = resetIndex >= 0 ? events.slice(resetIndex) : events;
  const baselineEvent = relevantEvents[0];
  let quantity = resetIndex >= 0 ? baselineEvent.quantity : 0;
  for (let index = resetIndex >= 0 ? 1 : 0; index < relevantEvents.length; index += 1) {
    const event = relevantEvents[index];
    quantity += event.eventType === "stock_count" ? 0 : event.quantity;
  }

  const consumptionStart = resetIndex >= 0 ? nextDate(baselineEvent.occurredOn) : baselineEvent.occurredOn;
  if (consumptionStart <= today) {
    const scheduledDoses = daysBetween(consumptionStart, today) * dailyFrequency;
    const missedDoses = Object.entries(input.missedDosesByDate ?? {}).reduce((sum, [day, count]) => {
      if (day < consumptionStart || day > today) return sum;
      return sum + Math.max(0, Math.min(dailyFrequency, count));
    }, 0);
    quantity -= Math.max(0, scheduledDoses - missedDoses) * unitsPerDose;
  }

  const estimatedQuantity = Math.max(0, Math.round(quantity * 100) / 100);
  const dailyUse = unitsPerDose * dailyFrequency;
  const daysRemaining = Math.max(0, Math.floor(estimatedQuantity / dailyUse));
  const projectedRunOutDate = addDays(today, Math.max(0, Math.ceil(Math.max(0, estimatedQuantity) / dailyUse) - 1));
  const latestEvent = relevantEvents.at(-1) ?? baselineEvent;
  const eventAge = Math.max(0, daysBetween(latestEvent.occurredOn, today) - 1);
  const confidence = resetIndex >= 0 && eventAge <= 30 ? "high" : eventAge <= 60 ? "medium" : "low";
  const status: RefillInventoryStatus = estimatedQuantity <= 0
    ? "refill_now"
    : confidence === "low" && eventAge > 90
      ? "uncertain"
      : daysRemaining <= input.refillAlertDays
        ? "refill_soon"
        : "on_track";

  return {
    estimatedQuantity,
    daysRemaining,
    projectedRunOutDate,
    status,
    confidence,
    calculationReason: resetIndex >= 0
      ? "Based on the latest stock count, scheduled use, and recorded missed doses."
      : "Based on recorded purchases, scheduled use, and recorded missed doses.",
  };
}
