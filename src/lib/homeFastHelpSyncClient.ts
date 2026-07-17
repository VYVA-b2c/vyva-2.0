import { homeFastHelpSyncedJourneySchema, type HomeFastHelpSyncResponse } from "../../shared/homeFastHelpSync";
import { apiFetch } from "@/lib/queryClient";
import {
  mergeSyncedHomeFastHelpJourneys,
  syncedHomeFastHelpJourneys,
} from "@/lib/homeFastHelpOutcome";
import { readHomeFastHelpImpressions } from "@/lib/homeFastHelpInsights";

export async function syncHomeFastHelpOutcomes(journeyStorageKey: string, impressionStorageKey: string) {
  const response = await apiFetch("/api/home/fast-help/sync", {
    method: "POST",
    body: JSON.stringify({
      journeys: syncedHomeFastHelpJourneys(journeyStorageKey),
      impressions: readHomeFastHelpImpressions(impressionStorageKey),
    }),
  });
  if (!response.ok) throw new Error(`Fast Help sync failed (${response.status})`);

  const body = await response.json() as HomeFastHelpSyncResponse;
  if (!body.syncAvailable) return { syncAvailable: false, journeys: [] };
  const journeys = homeFastHelpSyncedJourneySchema.array().parse(body.journeys);
  return {
    syncAvailable: true,
    journeys: mergeSyncedHomeFastHelpJourneys(journeyStorageKey, journeys),
  };
}
