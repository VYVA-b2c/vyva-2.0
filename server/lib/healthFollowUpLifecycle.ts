export type HealthFollowUpLifecycleStatus = "active" | "handled" | "snoozed" | "expired";

export type HealthFollowUpLifecycleView = {
  status?: HealthFollowUpLifecycleStatus | string | null;
  snoozedUntil?: string | Date | null;
};

export const FOLLOW_UP_ACTIVE_DAYS = 7;
export const FOLLOW_UP_DEFAULT_SNOOZE_HOURS = 48;
export const FOLLOW_UP_MAX_SNOOZE_HOURS = 168;

export function followUpExpiresAt(createdAt: string | Date | null | undefined): Date | null {
  if (!createdAt) return null;
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() + FOLLOW_UP_ACTIVE_DAYS * 86_400_000);
}

export function isFollowUpExpired(createdAt: string | Date | null | undefined, now = new Date()): boolean {
  const expiresAt = followUpExpiresAt(createdAt);
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export function isFollowUpVisible(
  lifecycle: HealthFollowUpLifecycleView | null | undefined,
  reportCreatedAt: string | Date | null | undefined,
  now = new Date(),
): boolean {
  if (isFollowUpExpired(reportCreatedAt, now)) return false;
  const status = lifecycle?.status;
  if (status === "handled" || status === "expired") return false;
  if (status === "snoozed") {
    if (!lifecycle.snoozedUntil) return true;
    const snoozedUntil = lifecycle.snoozedUntil instanceof Date
      ? lifecycle.snoozedUntil
      : new Date(lifecycle.snoozedUntil);
    return Number.isNaN(snoozedUntil.getTime()) || snoozedUntil.getTime() <= now.getTime();
  }
  return true;
}

export function normalizeSnoozeHours(value: unknown): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value)
      : FOLLOW_UP_DEFAULT_SNOOZE_HOURS;
  if (!Number.isFinite(parsed)) return FOLLOW_UP_DEFAULT_SNOOZE_HOURS;
  return Math.max(1, Math.min(FOLLOW_UP_MAX_SNOOZE_HOURS, Math.floor(parsed)));
}

export function snoozedUntilFrom(now = new Date(), hours = FOLLOW_UP_DEFAULT_SNOOZE_HOURS): Date {
  return new Date(now.getTime() + normalizeSnoozeHours(hours) * 3_600_000);
}
