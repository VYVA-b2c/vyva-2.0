export interface ShoppingCanvasRolloutConfig {
  enabled: boolean;
  rolloutPercent: number;
}
export function parseShoppingCanvasRolloutConfig(
  value: unknown,
): ShoppingCanvasRolloutConfig {
  const item = (value && typeof value === "object" ? value : {}) as {
    enabled?: unknown;
    rolloutPercent?: unknown;
  };
  const percent = Number(item.rolloutPercent);
  return {
    enabled: item.enabled === true,
    rolloutPercent: Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent))
      : 0,
  };
}
function bucket(key: string) {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index++) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}
export function isShoppingCanvasEnabled(
  config: ShoppingCanvasRolloutConfig,
  key: string,
) {
  return (
    config.enabled &&
    (config.rolloutPercent >= 100 ||
      (config.rolloutPercent > 0 && bucket(key) < config.rolloutPercent))
  );
}
