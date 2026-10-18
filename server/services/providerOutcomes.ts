import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { MEMBER_OUTCOME_MIN_JOBS, OUTCOME_EXPIRES_MS, outcomeIsDue, type MemberOutcomeCounts, type ProviderOutcomeAnswer } from "../../shared/providerOutcomes.js";

export interface DueOutcome {
  requestId: string;
  providerName: string;
  serviceType: string | null;
}

let unavailableWarned = false;
function warnUnavailable(error: unknown) {
  if (unavailableWarned) return;
  unavailableWarned = true;
  console.warn("[provider-outcomes] outcome table unavailable", { code: (error as { code?: string })?.code });
}

function rows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) return (result as { rows: T[] }).rows;
  return Array.isArray(result) ? result as T[] : [];
}

// Home-service requests that reached a provider, have no answer yet, and are
// inside the asking window. A failure here only hides the check-in.
export async function listDueOutcomes(userId: string, now = new Date()): Promise<DueOutcome[]> {
  try {
    const since = new Date(now.getTime() - OUTCOME_EXPIRES_MS - 3 * 24 * 60 * 60 * 1000);
    const result = await db.execute(sql`
      SELECT r.id, r.status, r.updated_at, e.scheduled_for,
             o.provider_snapshot ->> 'name' AS provider_name,
             r.preferences -> 'service_intake' ->> 'service_type' AS service_type
      FROM appointment_requests r
      JOIN appointment_provider_options o ON o.id = r.selected_provider_option_id AND o.user_id = r.user_id
      LEFT JOIN scheduled_events e ON e.id = r.linked_scheduled_event_id
      LEFT JOIN provider_job_outcomes outcome ON outcome.request_id = r.id
      WHERE r.user_id = ${userId}
        AND r.appointment_type = 'home-service'
        AND r.status IN ('booked', 'contacted', 'attempt_ready')
        AND r.updated_at >= ${since}
        AND outcome.request_id IS NULL
      ORDER BY r.updated_at DESC
      LIMIT 10
    `);
    return rows<{ id: string; status: string; updated_at: Date | string; scheduled_for: Date | string | null; provider_name: string | null; service_type: string | null }>(result)
      .filter(row => outcomeIsDue({ status: row.status, contactedAt: row.updated_at, visitAt: row.scheduled_for }, now.getTime()))
      .slice(0, 3)
      .map(row => ({ requestId: row.id, providerName: row.provider_name || "Provider", serviceType: row.service_type }));
  } catch (error) {
    warnUnavailable(error);
    return [];
  }
}

export async function recordOutcome(input: { userId: string; requestId: string; answer: ProviderOutcomeAnswer }): Promise<"recorded" | "not_found"> {
  const answered = input.answer.skipped === true ? null : input.answer;
  // Ownership, eligibility and the pooled business are all read from the
  // member's own request inside the insert; nothing is taken from the client.
  const result = await db.execute(sql`
    INSERT INTO provider_job_outcomes (request_id, option_id, place_id, service_type, skipped, arrived, price, would_use_again)
    SELECT r.id, o.id,
           CASE WHEN o.provider_source = 'external' THEN o.provider_snapshot ->> 'place_id' END,
           r.preferences -> 'service_intake' ->> 'service_type',
           ${answered === null}::boolean, ${answered?.arrived ?? null}::text, ${answered?.price ?? null}::text, ${answered?.wouldUseAgain ?? null}::text
    FROM appointment_requests r
    JOIN appointment_provider_options o ON o.id = r.selected_provider_option_id AND o.user_id = r.user_id
    WHERE r.id = ${input.requestId} AND r.user_id = ${input.userId}
      AND r.appointment_type = 'home-service'
      AND r.status IN ('booked', 'contacted', 'attempt_ready')
    ON CONFLICT (request_id) DO NOTHING
    RETURNING request_id
  `);
  if (rows(result).length > 0) return "recorded";
  // An existing answer counts as recorded so a double tap is harmless.
  const existing = await db.execute(sql`
    SELECT 1 FROM provider_job_outcomes outcome
    JOIN appointment_requests r ON r.id = outcome.request_id
    WHERE outcome.request_id = ${input.requestId} AND r.user_id = ${input.userId}
  `);
  return rows(existing).length > 0 ? "recorded" : "not_found";
}

// Pooled answers per public business and trade, last two years, never below
// the minimum job count so no single member's answer can be singled out.
export async function loadMemberOutcomeCounts(placeIds: string[], serviceType: string): Promise<Map<string, MemberOutcomeCounts>> {
  const found = new Map<string, MemberOutcomeCounts>();
  const ids = [...new Set(placeIds.filter(Boolean))];
  if (ids.length === 0 || !serviceType) return found;
  try {
    const result = await db.execute(sql`
      SELECT place_id,
             count(*)::int AS jobs,
             count(*) FILTER (WHERE arrived = 'no')::int AS no_shows,
             count(*) FILTER (WHERE price = 'above_quote')::int AS above_quote,
             count(*) FILTER (WHERE would_use_again = 'yes')::int AS would_use_again,
             count(*) FILTER (WHERE would_use_again = 'no')::int AS would_not_use_again
      FROM provider_job_outcomes
      WHERE place_id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
        AND service_type = ${serviceType}
        AND NOT skipped
        AND recorded_at >= now() - interval '2 years'
      GROUP BY place_id
      HAVING count(*) >= ${MEMBER_OUTCOME_MIN_JOBS}
    `);
    for (const row of rows<{ place_id: string; jobs: number; no_shows: number; above_quote: number; would_use_again: number; would_not_use_again: number }>(result)) {
      found.set(row.place_id, { jobs: row.jobs, noShows: row.no_shows, aboveQuote: row.above_quote, wouldUseAgain: row.would_use_again, wouldNotUseAgain: row.would_not_use_again });
    }
  } catch (error) {
    warnUnavailable(error);
  }
  return found;
}
