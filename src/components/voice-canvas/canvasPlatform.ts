export interface CanvasRolloutConfig {
  enabled: boolean;
  rolloutPercent: number;
}

export function parseCanvasRolloutConfig(value: unknown): CanvasRolloutConfig {
  if (!value || typeof value !== "object")
    return { enabled: false, rolloutPercent: 0 };
  const candidate = value as { enabled?: unknown; rolloutPercent?: unknown };
  const configured =
    typeof candidate.rolloutPercent === "number"
      ? candidate.rolloutPercent
      : Number.NaN;
  return {
    enabled: candidate.enabled === true,
    rolloutPercent: Number.isFinite(configured)
      ? Math.min(100, Math.max(0, Math.round(configured)))
      : 0,
  };
}

function stableCanvasBucket(key: string) {
  let hash = 2166136261;
  for (const character of key) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isCanvasRolloutEnabled(
  config: CanvasRolloutConfig | undefined,
  cohortKey: string,
) {
  if (!config?.enabled || config.rolloutPercent <= 0) return false;
  return (
    config.rolloutPercent >= 100 ||
    stableCanvasBucket(cohortKey) < config.rolloutPercent
  );
}

export type CanvasOutcome =
  "prepared" | "pending" | "confirmed" | "completed" | "blocked";

const OUTCOME_BY_STEP: Record<string, CanvasOutcome> = {
  review: "prepared",
  prepared: "prepared",
  waiting: "confirmed",
  confirmed: "confirmed",
  pending: "pending",
  pending_detail: "pending",
  pending_confirm: "pending",
  completed: "completed",
  blocked: "blocked",
  error: "blocked",
  urgent: "blocked",
  cancelled: "blocked",
};

/** Canonical product outcome used by telemetry and cross-flow compliance checks. */
export function canvasOutcomeForStep(step: string): CanvasOutcome | undefined {
  return OUTCOME_BY_STEP[step];
}
export type CanvasInputMethod = "voice" | "touch_or_keyboard" | "system";
export type CanvasTelemetryName =
  | "scene_viewed"
  | "draft_restored"
  | "confirmation_submitted"
  | "reconfirmation_required"
  | "retried"
  | "abandoned"
  | "prepared"
  | "pending"
  | "confirmed"
  | "completed"
  | "failed";

export interface CanvasTelemetryEnvelope<Step extends string = string> {
  name: CanvasTelemetryName;
  step: Step;
  input: CanvasInputMethod;
  attempt: number;
  restored: boolean;
  revision?: number;
}

export function dispatchCanvasTelemetryEvent<T extends CanvasTelemetryEnvelope>(
  eventName: string,
  event: T,
) {
  if (typeof window !== "undefined") {
    const detail: CanvasTelemetryEnvelope = {
      name: event.name,
      step: event.step,
      input: event.input,
      attempt: event.attempt,
      restored: event.restored,
      ...(event.revision === undefined ? {} : { revision: event.revision }),
    };
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

export class CanvasSafetyError extends Error {
  constructor(
    message = "Canvas external action is not authorized by a current explicit confirmation.",
  ) {
    super(message);
    this.name = "CanvasSafetyError";
  }
}
