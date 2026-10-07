import { sql } from "drizzle-orm";
import { db } from "../db.js";
import { currentVerification, verificationConcernLevel, type ProviderVerification } from "../../shared/providerVerification.js";

export interface ReputationKey { placeId: string; serviceType: string; language: string }

const INCOMPLETE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let tableMissingWarned = false;

function keyOf(key: ReputationKey): string {
  return `${key.placeId}\u0000${key.serviceType}\u0000${key.language}`;
}

function rows<T>(result: unknown): T[] {
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) return (result as { rows: T[] }).rows;
  return Array.isArray(result) ? result as T[] : [];
}

// Only real audit outcomes are shared. Configuration or outage results, and
// audits that found nothing at all, are cheap to retry and would mislead others.
export function isShareableVerification(verification: ProviderVerification): boolean {
  return !verification.retryable && (verification.sources.length > 0 || verification.reviewCount > 0);
}

// Incomplete results expire sooner: more evidence may appear for a new business.
export function sharedVerification(value: unknown, now = Date.now()): ProviderVerification | null {
  const verification = currentVerification(value, now);
  if (!verification || !isShareableVerification(verification)) return null;
  if (verification.status === "incomplete" && now - Date.parse(verification.checkedAt) >= INCOMPLETE_MAX_AGE_MS) return null;
  return verification;
}

function warnUnavailable(error: unknown) {
  if (tableMissingWarned) return;
  tableMissingWarned = true;
  console.warn("[provider-reputation] shared cache unavailable; checks run uncached", {
    code: (error as { code?: string })?.code,
  });
}

// Reputation is an optimisation: a missing table or a database error never
// blocks discovery or verification.
export async function loadSharedVerifications(keys: ReputationKey[]): Promise<Map<string, ProviderVerification>> {
  const found = new Map<string, ProviderVerification>();
  const unique = [...new Map(keys.filter(k => k.placeId && k.serviceType && k.language).map(k => [keyOf(k), k])).values()];
  if (unique.length === 0) return found;
  try {
    const result = await db.execute(sql`
      SELECT place_id, service_type, language, verification
      FROM provider_reputation
      WHERE (place_id, service_type, language) IN (${sql.join(unique.map(k => sql`(${k.placeId}, ${k.serviceType}, ${k.language})`), sql`, `)})
    `);
    for (const row of rows<{ place_id: string; service_type: string; language: string; verification: unknown }>(result)) {
      const verification = sharedVerification(row.verification);
      if (verification) found.set(keyOf({ placeId: row.place_id, serviceType: row.service_type, language: row.language }), verification);
    }
  } catch (error) {
    warnUnavailable(error);
  }
  return found;
}

export async function loadSharedVerification(key: ReputationKey): Promise<ProviderVerification | null> {
  return (await loadSharedVerifications([key])).get(keyOf(key)) ?? null;
}

export function sharedVerificationFor(found: Map<string, ProviderVerification>, key: ReputationKey): ProviderVerification | null {
  return found.get(keyOf(key)) ?? null;
}

export async function saveSharedVerification(key: ReputationKey, verification: ProviderVerification): Promise<void> {
  if (!key.placeId || !isShareableVerification(verification)) return;
  try {
    await db.execute(sql`
      INSERT INTO provider_reputation (place_id, service_type, language, status, concern_level, verification, checked_at, updated_at)
      VALUES (${key.placeId}, ${key.serviceType}, ${key.language}, ${verification.status}, ${verificationConcernLevel(verification)},
        ${JSON.stringify(verification)}::jsonb, ${verification.checkedAt}, now())
      ON CONFLICT (place_id, service_type, language) DO UPDATE SET
        status = excluded.status,
        concern_level = excluded.concern_level,
        verification = excluded.verification,
        checked_at = excluded.checked_at,
        updated_at = now()
      WHERE provider_reputation.checked_at <= excluded.checked_at
    `);
  } catch (error) {
    warnUnavailable(error);
  }
}
