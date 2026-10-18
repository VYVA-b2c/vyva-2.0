import { z } from "zod";

// One short check-in after a home-service job. Answers feed the shared ranking,
// so they are the only first-party evidence VYVA holds about a provider.
export const OUTCOME_ARRIVED = ["yes", "late", "no"] as const;
export const OUTCOME_PRICE = ["as_quoted", "above_quote", "no_quote", "not_sure"] as const;
export const OUTCOME_AGAIN = ["yes", "no", "not_sure"] as const;

export const providerOutcomeAnswerSchema = z.union([
  z.object({
    skipped: z.literal(false).optional(),
    arrived: z.enum(OUTCOME_ARRIVED),
    price: z.enum(OUTCOME_PRICE),
    wouldUseAgain: z.enum(OUTCOME_AGAIN),
  }).strict(),
  z.object({ skipped: z.literal(true) }).strict(),
]);
export type ProviderOutcomeAnswer = z.infer<typeof providerOutcomeAnswerSchema>;

export const OUTCOME_QUESTIONS = [
  { key: "arrived", en: "Did they turn up?", options: [["yes", "Yes, on time"], ["late", "Yes, but late"], ["no", "No"]] },
  { key: "price", en: "Was the price what you agreed?", options: [["as_quoted", "Yes"], ["above_quote", "No, it was more"], ["no_quote", "We didn't agree a price"], ["not_sure", "Not sure"]] },
  { key: "wouldUseAgain", en: "Would you use them again?", options: [["yes", "Yes"], ["no", "No"], ["not_sure", "Not sure"]] },
] as const;

const OUTCOME_STATUSES = new Set(["booked", "contacted", "attempt_ready"]);
const HOUR = 60 * 60 * 1000;
// Ask the day after a booked visit, or two days after contact when no visit
// time is known; stop asking after a month.
export const OUTCOME_AFTER_VISIT_MS = 24 * HOUR;
export const OUTCOME_AFTER_CONTACT_MS = 48 * HOUR;
export const OUTCOME_EXPIRES_MS = 30 * 24 * HOUR;

export function outcomeDueAt(input: { status: string; contactedAt: Date | string; visitAt?: Date | string | null }): Date | null {
  if (!OUTCOME_STATUSES.has(input.status)) return null;
  const visit = input.visitAt ? new Date(input.visitAt).getTime() : NaN;
  const base = Number.isFinite(visit) ? visit + OUTCOME_AFTER_VISIT_MS : new Date(input.contactedAt).getTime() + OUTCOME_AFTER_CONTACT_MS;
  return Number.isFinite(base) ? new Date(base) : null;
}

export function outcomeIsDue(input: { status: string; contactedAt: Date | string; visitAt?: Date | string | null }, now = Date.now()): boolean {
  const due = outcomeDueAt(input)?.getTime();
  return due !== undefined && now >= due && now < due + OUTCOME_EXPIRES_MS;
}

export interface MemberOutcomeCounts {
  jobs: number;
  noShows: number;
  aboveQuote: number;
  wouldUseAgain: number;
  wouldNotUseAgain: number;
}

// Product-design weighting, not a validated model. Two answered jobs minimum,
// so one member's experience never moves the ranking on its own.
export const MEMBER_OUTCOME_MIN_JOBS = 2;

export function memberOutcomeAdjustment(counts?: MemberOutcomeCounts | null): { score: number; reasons: string[]; uncertainties: string[] } {
  const result = { score: 0, reasons: [] as string[], uncertainties: [] as string[] };
  if (!counts || counts.jobs < MEMBER_OUTCOME_MIN_JOBS) return result;
  const again = (counts.wouldUseAgain - counts.wouldNotUseAgain) / counts.jobs;
  result.score = Math.round(20 * again - 25 * counts.noShows / counts.jobs);
  if (counts.wouldUseAgain * 2 > counts.jobs) result.reasons.push("Other VYVA members would use this provider again");
  if (counts.noShows * 2 >= counts.jobs) result.uncertainties.push("Other VYVA members report missed visits");
  if (counts.aboveQuote * 2 >= counts.jobs) result.uncertainties.push("Other VYVA members report bills above the agreed price");
  return result;
}
