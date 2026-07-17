export interface RideCanvasRolloutConfig { enabled: boolean; rolloutPercent: number; }

export function parseRideCanvasRolloutConfig(value: unknown): RideCanvasRolloutConfig {
  if (!value || typeof value !== "object") return { enabled: false, rolloutPercent: 0 };
  const candidate = value as Partial<RideCanvasRolloutConfig>;
  const percent = typeof candidate.rolloutPercent === "number" && Number.isFinite(candidate.rolloutPercent)
    ? Math.min(100, Math.max(0, Math.round(candidate.rolloutPercent)))
    : 0;
  return { enabled: candidate.enabled === true, rolloutPercent: percent };
}

function stableBucket(cohortKey: string) {
  let hash = 2166136261;
  for (let index = 0; index < cohortKey.length; index += 1) {
    hash ^= cohortKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isRideCanvasEnabled(config: RideCanvasRolloutConfig | undefined, cohortKey: string) {
  if (!config?.enabled || config.rolloutPercent <= 0) return false;
  if (config.rolloutPercent >= 100) return true;
  return stableBucket(cohortKey) < config.rolloutPercent;
}
