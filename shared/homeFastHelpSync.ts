import { z } from "zod";

export const HOME_FAST_HELP_ACTION_IDS = [
  "feel-better",
  "stay-well",
  "find-care",
  "book-ride",
  "paperwork-help",
  "safe-home",
] as const;

export const HOME_FAST_HELP_OUTCOME_STATUSES = [
  "opened",
  "completed",
  "dismissed",
  "abandoned",
  "blocked",
] as const;

export type HomeFastHelpActionId = typeof HOME_FAST_HELP_ACTION_IDS[number];
export type HomeFastHelpSyncedStatus = typeof HOME_FAST_HELP_OUTCOME_STATUSES[number];

const safeReferenceIdSchema = z.string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .nullable()
  .optional();

export const homeFastHelpSyncedEventSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(HOME_FAST_HELP_OUTCOME_STATUSES),
  occurredAt: z.string().datetime({ offset: true }),
  referenceId: safeReferenceIdSchema,
}).strict();

export const homeFastHelpSyncedJourneySchema = z.object({
  id: z.string().uuid(),
  actionId: z.enum(HOME_FAST_HELP_ACTION_IDS),
  status: z.enum(HOME_FAST_HELP_OUTCOME_STATUSES),
  startedAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  referenceId: safeReferenceIdSchema,
  events: z.array(homeFastHelpSyncedEventSchema).min(1).max(80),
}).strict().refine((journey) => (
  Date.parse(journey.updatedAt) >= Date.parse(journey.startedAt)
), { message: "updatedAt must not be earlier than startedAt" });

export const homeFastHelpSyncRequestSchema = z.object({
  journeys: z.array(homeFastHelpSyncedJourneySchema).max(30),
}).strict();

export type HomeFastHelpSyncedEvent = z.infer<typeof homeFastHelpSyncedEventSchema>;
export type HomeFastHelpSyncedJourney = z.infer<typeof homeFastHelpSyncedJourneySchema>;

export type HomeFastHelpSyncResponse = {
  syncAvailable: boolean;
  syncedAt: string;
  journeys: HomeFastHelpSyncedJourney[];
};

export type HomeFastHelpOutcomeAggregateRow = {
  actionId: HomeFastHelpActionId;
  opened: number;
  completed: number;
  dismissed: number;
  abandoned: number;
  blocked: number;
  resumed: number;
};

export type HomeFastHelpOutcomeAggregate = {
  generatedAt: string;
  windowDays: number;
  totals: Omit<HomeFastHelpOutcomeAggregateRow, "actionId">;
  actions: HomeFastHelpOutcomeAggregateRow[];
};

const STATUS_TIE_PRIORITY: Record<HomeFastHelpSyncedStatus, number> = {
  completed: 5,
  dismissed: 4,
  blocked: 3,
  abandoned: 2,
  opened: 1,
};

export function homeFastHelpEventWinner(
  events: HomeFastHelpSyncedEvent[],
): HomeFastHelpSyncedEvent | null {
  if (events.length === 0) return null;

  const completed = events.filter((event) => event.status === "completed");
  const dismissed = events.filter((event) => event.status === "dismissed");
  const candidates = completed.length > 0 ? completed : dismissed.length > 0 ? dismissed : events;

  return [...candidates].sort((left, right) => (
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt)
    || STATUS_TIE_PRIORITY[right.status] - STATUS_TIE_PRIORITY[left.status]
    || right.id.localeCompare(left.id)
  ))[0] ?? null;
}

export function mergeHomeFastHelpSyncedJourneys(
  local: HomeFastHelpSyncedJourney,
  remote: HomeFastHelpSyncedJourney,
): HomeFastHelpSyncedJourney {
  const eventById = new Map<string, HomeFastHelpSyncedEvent>();
  for (const event of [...remote.events, ...local.events]) {
    if (!eventById.has(event.id)) eventById.set(event.id, event);
  }
  const events = [...eventById.values()].sort((left, right) => (
    Date.parse(left.occurredAt) - Date.parse(right.occurredAt) || left.id.localeCompare(right.id)
  ));
  const winner = homeFastHelpEventWinner(events);
  const startedAt = Date.parse(local.startedAt) <= Date.parse(remote.startedAt)
    ? local.startedAt
    : remote.startedAt;
  const fallback = Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt) ? local : remote;

  return {
    id: local.id,
    actionId: local.actionId,
    status: winner?.status ?? fallback.status,
    startedAt,
    updatedAt: winner?.occurredAt ?? fallback.updatedAt,
    referenceId: winner?.referenceId ?? fallback.referenceId ?? null,
    events,
  };
}
