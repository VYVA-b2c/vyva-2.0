import { z } from "zod";
import type { ProviderComparisonSourceOption } from "../providerComparison.js";
import type { CareFinderPublicCare } from "./publicCare.js";
import {
  CARE_ACCESS_NEED_IDS,
  CARE_COVERAGE_IDS,
  CARE_TYPE_IDS,
  type CareAccessRoute,
  type CareTypeId,
} from "./careRoutes.js";

export const careFinderSearchRequestSchema = z.object({
  careType: z.enum(CARE_TYPE_IDS),
  access: z.enum(["public", "private"]),
  coverage: z.enum(CARE_COVERAGE_IDS).nullable().optional(),
  location: z.string().trim().max(200),
  accessNeeds: z.array(z.enum(CARE_ACCESS_NEED_IDS)).max(5).default([]),
  language: z.string().trim().max(12).optional(),
}).strict();

export type CareFinderSearchRequest = z.infer<typeof careFinderSearchRequestSchema>;

// Where an option came from decides what we may keep. Official register rows
// and the person's own profile are ours to store; Google Places content is
// not (its terms allow keeping only the place_id).
export const CARE_FINDER_OPTION_ORIGINS = ["official_register", "google_places", "profile"] as const;
export type CareFinderOptionOrigin = typeof CARE_FINDER_OPTION_ORIGINS[number];
const STORABLE_ORIGINS: ReadonlySet<string> = new Set<CareFinderOptionOrigin>(["official_register", "profile"]);

export interface CareFinderResultOption extends ProviderComparisonSourceOption {
  // official_register: id is the REGCESS code. google_places: id is the place_id.
  id: string;
  origin: CareFinderOptionOrigin;
  care_type: CareTypeId;
  address: string | null;
  travel_text: string | null;
  travel_minutes: number | null;
  wheelchair_entrance: boolean | null;
  // Plain reasons tied to the person's answers. Each one names its source.
  matched: string[];
  // Things VYVA assumes rather than knows. Always shown as assumptions.
  assumptions: string[];
}

export type CareFinderSearchStatus = "ok" | "no_results" | "unavailable";

export interface CareFinderSearchResponse {
  status: CareFinderSearchStatus;
  careType: CareTypeId;
  access: CareAccessRoute;
  location: string;
  // distance: straight line from the member's address, register results only.
  // assigned_first: their own public health centre, then the closest others.
  orderedBy: "travel_time" | "distance" | "assigned_first" | "search_relevance";
  checkedAt: string;
  options: CareFinderResultOption[];
  // A self-service fallback, always labelled as not checked by VYVA.
  mapsSearchUrl: string;
  // Public route to a family doctor only: their centre and region.
  publicCare?: CareFinderPublicCare | null;
}

export function careFinderMapsSearchUrl(term: string, location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} ${location}`.trim())}`;
}

/**
 * The results as they may be saved with a task, or null when they hold
 * content we may not keep. Options saved before `origin` existed all came
 * from Google, so they are not storable either. Dropped results are fetched
 * again when the task is resumed.
 */
export function storableCareFinderResults(results: CareFinderSearchResponse | null): CareFinderSearchResponse | null {
  if (!results) return null;
  const storable = results.options.every((option) => STORABLE_ORIGINS.has((option as { origin?: unknown }).origin as string));
  return storable ? results : null;
}

export function isCareFinderSearchResponse(value: unknown): value is CareFinderSearchResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.status === "string"
    && typeof record.careType === "string"
    && Array.isArray(record.options);
}
