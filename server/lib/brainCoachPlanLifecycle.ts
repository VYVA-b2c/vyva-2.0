import type { BrainCoachDailyPlan, BrainCoachPlanSession } from "./brainCoachPlan.js";

export const BRAIN_COACH_PLAN_GENERATION_VERSION = "brain_coach_plan_v2";

export type BrainCoachPlanStatus = "active" | "completed" | "expired";
export type BrainCoachPlanItemStatus = "recommended" | "accepted" | "started" | "completed" | "skipped";
export type BrainCoachPlanEventType = "accepted" | "started" | "skipped" | "completed" | "refreshed" | "expired";

export type StoredBrainCoachPlan = {
  id: string;
  userId: string;
  planDate: string;
  status: string;
  estimatedDurationMinutes: number;
  recommendedDomains: string[];
  rationale: string[];
  generatedContext?: unknown;
  generationVersion?: string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type StoredBrainCoachPlanItem = {
  id: string;
  planId: string;
  userId: string;
  planDate: string;
  activityType: string;
  title: string;
  domain: string;
  secondaryDomain?: string | null;
  route: string;
  estimatedDurationMinutes: number;
  rationale: string;
  status: string;
  sortOrder: number;
  acceptedAt?: Date | string | null;
  startedAt?: Date | string | null;
  skippedAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type PersistedBrainCoachDailyPlan = BrainCoachDailyPlan & {
  planId: string;
  status: BrainCoachPlanStatus;
  generationVersion: string;
  completedAt: string | null;
  preferences: {
    trainingTime: string | null;
    sessionLengthMins: number | null;
  };
  activities: Array<BrainCoachDailyPlan["activities"][number] & {
    planItemId: string;
    status: BrainCoachPlanItemStatus;
    acceptedAt: string | null;
    startedAt: string | null;
    skippedAt: string | null;
    completedAt: string | null;
  }>;
};

export type BrainCoachPlanInsert = {
  userId: string;
  planDate: string;
  status: BrainCoachPlanStatus;
  estimatedDurationMinutes: number;
  recommendedDomains: string[];
  rationale: string[];
  generatedContext: Record<string, unknown>;
  generationVersion: string;
};

export type BrainCoachPlanItemInsert = {
  userId: string;
  planDate: string;
  activityType: string;
  title: string;
  domain: string;
  secondaryDomain: string | null;
  route: string;
  estimatedDurationMinutes: number;
  rationale: string;
  status: BrainCoachPlanItemStatus;
  sortOrder: number;
};

export type CompletionSyncResult = {
  completedActivityTypes: string[];
  allComplete: boolean;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function iso(value: Date | string | null | undefined): string | null {
  return asDate(value)?.toISOString() ?? null;
}

function planStatus(value: string): BrainCoachPlanStatus {
  return value === "completed" || value === "expired" ? value : "active";
}

function itemStatus(value: string): BrainCoachPlanItemStatus {
  if (value === "accepted" || value === "started" || value === "completed" || value === "skipped") return value;
  return "recommended";
}

function generatedContextRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function contextNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function buildBrainCoachPlanRows(input: {
  userId: string;
  generatedPlan: BrainCoachDailyPlan;
  sourceContext?: Record<string, unknown>;
}): { plan: BrainCoachPlanInsert; items: BrainCoachPlanItemInsert[] } {
  const plan: BrainCoachPlanInsert = {
    userId: input.userId,
    planDate: input.generatedPlan.planDate,
    status: "active",
    estimatedDurationMinutes: input.generatedPlan.estimatedDurationMinutes,
    recommendedDomains: input.generatedPlan.recommendedDomains,
    rationale: input.generatedPlan.rationale,
    generatedContext: {
      generatedAt: input.generatedPlan.generatedAt,
      source: "daily_plan_endpoint",
      ...input.sourceContext,
    },
    generationVersion: BRAIN_COACH_PLAN_GENERATION_VERSION,
  };

  const items = input.generatedPlan.activities.map((activity, index) => ({
    userId: input.userId,
    planDate: input.generatedPlan.planDate,
    activityType: activity.activityType,
    title: activity.title,
    domain: activity.domain,
    secondaryDomain: activity.secondaryDomain ?? null,
    route: activity.route,
    estimatedDurationMinutes: activity.estimatedDurationMinutes,
    rationale: activity.rationale,
    status: "recommended" as const,
    sortOrder: index,
  }));

  return { plan, items };
}

export function buildPersistedBrainCoachPlan(
  plan: StoredBrainCoachPlan,
  items: StoredBrainCoachPlanItem[],
): PersistedBrainCoachDailyPlan {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const completedItems = sortedItems.filter((item) => itemStatus(item.status) === "completed" || Boolean(item.completedAt));
  const completedActivityTypes = completedItems.map((item) => item.activityType);
  const generatedContext = generatedContextRecord(plan.generatedContext);

  return {
    planId: plan.id,
    planDate: plan.planDate,
    generatedAt: iso(plan.createdAt) ?? new Date(0).toISOString(),
    status: planStatus(plan.status),
    generationVersion: plan.generationVersion ?? BRAIN_COACH_PLAN_GENERATION_VERSION,
    completedAt: iso(plan.completedAt),
    preferences: {
      trainingTime: typeof generatedContext.training_time === "string" ? generatedContext.training_time : null,
      sessionLengthMins: contextNumber(generatedContext.session_length_mins),
    },
    estimatedDurationMinutes: Number(plan.estimatedDurationMinutes) || 0,
    recommendedDomains: plan.recommendedDomains ?? [],
    rationale: plan.rationale ?? [],
    activities: sortedItems.map((item) => ({
      planItemId: item.id,
      activityType: item.activityType,
      title: item.title,
      domain: item.domain,
      secondaryDomain: item.secondaryDomain ?? undefined,
      route: item.route,
      estimatedDurationMinutes: Number(item.estimatedDurationMinutes) || 0,
      rationale: item.rationale,
      status: itemStatus(item.status),
      acceptedAt: iso(item.acceptedAt),
      startedAt: iso(item.startedAt),
      skippedAt: iso(item.skippedAt),
      completedAt: iso(item.completedAt),
      completedToday: itemStatus(item.status) === "completed" || Boolean(item.completedAt),
    })),
    completion: {
      completedCount: completedItems.length,
      totalCount: sortedItems.length,
      allComplete: sortedItems.length > 0 && completedItems.length === sortedItems.length,
      completedActivityTypes,
    },
  };
}

export function completionSyncForPlan(input: {
  planDate: string;
  items: StoredBrainCoachPlanItem[];
  sessions: BrainCoachPlanSession[];
}): CompletionSyncResult {
  const completedToday = new Set(
    input.sessions
      .filter((session) => session.completed && asDate(session.playedAt)?.toISOString().slice(0, 10) === input.planDate)
      .map((session) => session.activityType),
  );
  const completedActivityTypes = input.items
    .filter((item) => itemStatus(item.status) === "completed" || Boolean(item.completedAt) || completedToday.has(item.activityType))
    .map((item) => item.activityType);

  return {
    completedActivityTypes,
    allComplete: input.items.length > 0 && completedActivityTypes.length === input.items.length,
  };
}

export function applyPlanItemEvent(
  item: StoredBrainCoachPlanItem,
  eventType: Extract<BrainCoachPlanEventType, "accepted" | "started" | "skipped">,
  at = new Date(),
): Partial<StoredBrainCoachPlanItem> {
  if (itemStatus(item.status) === "completed") return {};
  if (eventType === "accepted") {
    return {
      status: itemStatus(item.status) === "recommended" ? "accepted" : itemStatus(item.status),
      acceptedAt: item.acceptedAt ?? at,
      updatedAt: at,
    };
  }
  if (eventType === "started") {
    return {
      status: itemStatus(item.status) === "skipped" ? "skipped" : "started",
      acceptedAt: item.acceptedAt ?? at,
      startedAt: item.startedAt ?? at,
      updatedAt: at,
    };
  }
  return {
    status: "skipped",
    skippedAt: item.skippedAt ?? at,
    updatedAt: at,
  };
}
