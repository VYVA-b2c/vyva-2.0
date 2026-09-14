import {
  HOME_FAST_HELP_ACTION_IDS,
  type HomeFastHelpActionId,
  type HomeFastHelpSyncedImpression,
} from "../../shared/homeFastHelpSync";

export const HOME_FAST_HELP_IMPRESSION_STORAGE_PREFIX = "vyva:home-fast-help-impressions:v1";
export const HOME_FAST_HELP_IMPRESSION_EVENT = "vyva:home-fast-help-impression-changed";

const MAX_STORED_IMPRESSIONS = 50;
const RANKING_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,39}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTION_IDS = new Set<string>(HOME_FAST_HELP_ACTION_IDS);

function createUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function isImpression(value: unknown): value is HomeFastHelpSyncedImpression {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  if (keys.length !== 4 || keys.some((key) => !["id", "actionIds", "rankingVersion", "shownAt"].includes(key))) {
    return false;
  }
  const candidate = value as Partial<HomeFastHelpSyncedImpression>;
  return typeof candidate.id === "string"
    && UUID_PATTERN.test(candidate.id)
    && Array.isArray(candidate.actionIds)
    && candidate.actionIds.length === 3
    && new Set(candidate.actionIds).size === 3
    && candidate.actionIds.every((actionId) => ACTION_IDS.has(actionId))
    && typeof candidate.rankingVersion === "string"
    && RANKING_VERSION_PATTERN.test(candidate.rankingVersion)
    && typeof candidate.shownAt === "string"
    && Number.isFinite(Date.parse(candidate.shownAt));
}

function emitImpressionChange(storageKey: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HOME_FAST_HELP_IMPRESSION_EVENT, { detail: { storageKey } }));
}

export function homeFastHelpImpressionStorageKey(profileId?: string | null) {
  return `${HOME_FAST_HELP_IMPRESSION_STORAGE_PREFIX}:${profileId?.trim() || "browser"}`;
}

export function readHomeFastHelpImpressions(storageKey: string): HomeFastHelpSyncedImpression[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isImpression)
      .sort((left, right) => Date.parse(right.shownAt) - Date.parse(left.shownAt))
      .slice(0, MAX_STORED_IMPRESSIONS);
  } catch {
    return [];
  }
}

export function recordHomeFastHelpImpression({
  actionIds,
  rankingVersion,
  profileId,
  shownAtMs = Date.now(),
}: {
  actionIds: HomeFastHelpActionId[];
  rankingVersion: string;
  profileId?: string | null;
  shownAtMs?: number;
}): HomeFastHelpSyncedImpression | null {
  const impression: HomeFastHelpSyncedImpression = {
    id: createUuid(),
    actionIds,
    rankingVersion,
    shownAt: new Date(shownAtMs).toISOString(),
  };
  if (!isImpression(impression) || typeof window === "undefined") return null;

  const storageKey = homeFastHelpImpressionStorageKey(profileId);
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify([impression, ...readHomeFastHelpImpressions(storageKey)].slice(0, MAX_STORED_IMPRESSIONS)),
    );
    emitImpressionChange(storageKey);
    return impression;
  } catch {
    return null;
  }
}
