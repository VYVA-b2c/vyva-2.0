import { z } from "zod";
import type { ProviderComparisonSourceOption } from "../providerComparison.js";
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

export interface CareFinderResultOption extends ProviderComparisonSourceOption {
  id: string;
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
  orderedBy: "travel_time" | "search_relevance";
  checkedAt: string;
  options: CareFinderResultOption[];
  // A self-service fallback, always labelled as not checked by VYVA.
  mapsSearchUrl: string;
}

export function careFinderMapsSearchUrl(term: string, location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${term} ${location}`.trim())}`;
}

export function isCareFinderSearchResponse(value: unknown): value is CareFinderSearchResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.status === "string"
    && typeof record.careType === "string"
    && Array.isArray(record.options);
}
