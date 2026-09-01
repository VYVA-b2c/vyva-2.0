import fs from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { describe, expect, it } from "vitest";
import { PostgresPreventiveWebPushStore } from "./preventiveWebPushStore.js";
import { validPreventiveWebPushSubscription } from "./preventiveWebPushFixtures.js";
import {
  normalizePreventiveWebPushSubscription,
  parsePreventiveWebPushEntryToken,
} from "./preventiveWebPushSecurity.js";

const task10PostgresUrl = process.env.TASK10_POSTGRES_URL;
const migrationSql = fs.readFileSync(
  new URL("../../migrations/0079_preventive_web_push_entry.sql", import.meta.url),
  "utf8",
);

async function withClient<T>(operation: (client: pg.Client) => Promise<T>): Promise<T> {
  if (!task10PostgresUrl) throw new Error("TASK10_POSTGRES_URL is required");
  const databaseName = new URL(task10PostgresUrl).pathname.toLowerCase().replace(/^\//, "");
  if (!databaseName.includes("task10") || !/(test|tmp|ci|scratch)/u.test(databaseName)) {
    throw new Error("Task 10 PostgreSQL tests require a scratch database name containing task10 and test/tmp/ci/scratch");
  }
  const client = new pg.Client({ connectionString: task10PostgresUrl });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

function storeForUrl() {
  return new PostgresPreventiveWebPushStore({
    async withClient<T>(operation: (client: pg.Client & { release(): void }) => Promise<T>): Promise<T> {
      return withClient(async (client) =>
        operation(Object.assign(client, { release: () => {} }))
      );
    },
  });
}

describe("Task 10 real PostgreSQL preventive web push store", () => {
  it.runIf(task10PostgresUrl)(
    "persists consent timestamp transitions through typed PostgreSQL inputs",
    async () => {
      await withClient(async (client) => {
        await client.query("create table if not exists public.user_channel_preferences (id uuid primary key default gen_random_uuid(), user_id text not null unique, updated_at timestamptz not null default now())");
        await client.query(migrationSql);
      });

      const store = storeForUrl();
      const userId = `user.${randomUUID()}`;
      const grantedAt = new Date("2026-08-03T12:00:00.000Z");
      const revokedAt = new Date("2026-08-03T12:05:00.000Z");
      const regrantedAt = new Date("2026-08-03T12:10:00.000Z");

      const granted = await store.setConsent({ userId, enabled: true, now: grantedAt });
      expect(granted).toMatchObject({ enabled: true, revision: 1 });
      expect(granted.updatedAt?.toISOString()).toBe(grantedAt.toISOString());
      expect(granted.grantedAt?.toISOString()).toBe(grantedAt.toISOString());
      expect(granted.revokedAt).toBeNull();

      const revoked = await store.setConsent({ userId, enabled: false, now: revokedAt });
      expect(revoked).toMatchObject({ enabled: false, revision: 2 });
      expect(revoked.updatedAt?.toISOString()).toBe(revokedAt.toISOString());
      expect(revoked.grantedAt?.toISOString()).toBe(grantedAt.toISOString());
      expect(revoked.revokedAt?.toISOString()).toBe(revokedAt.toISOString());

      const regranted = await store.setConsent({ userId, enabled: true, now: regrantedAt });
      expect(regranted).toMatchObject({ enabled: true, revision: 3 });
      expect(regranted.updatedAt?.toISOString()).toBe(regrantedAt.toISOString());
      expect(regranted.grantedAt?.toISOString()).toBe(regrantedAt.toISOString());
      expect(regranted.revokedAt).toBeNull();
    },
    180_000,
  );

  it.runIf(task10PostgresUrl)(
    "proves consent defaults, ownership, delivery idempotency and token redemption on PostgreSQL",
    async () => {
      await withClient(async (client) => {
        await client.query("create table if not exists public.user_channel_preferences (id uuid primary key default gen_random_uuid(), user_id text not null unique, updated_at timestamptz not null default now())");
        await client.query(migrationSql);
        const version = await client.query<{ version: string }>("select version()");
        console.info(`[task10-postgres] ${version.rows[0]?.version ?? "unknown"}`);
      });

      const store = storeForUrl();
      const userId = `user.${randomUUID()}`;
      const otherUserId = `user.${randomUUID()}`;
      const now = new Date("2026-08-03T12:00:00.000Z");
      await expect(store.readConsent(userId)).resolves.toMatchObject({ enabled: false, revision: 0 });
      const consent = await store.setConsent({ userId, enabled: true, now });
      expect(consent).toMatchObject({ enabled: true, revision: 1 });

      const normalized = normalizePreventiveWebPushSubscription(validPreventiveWebPushSubscription({
        endpoint: `https://fcm.googleapis.com/fcm/send/${randomUUID()}`,
      }));
      expect(normalized.ok).toBe(true);
      if (!normalized.ok) return;

      const stored = await store.upsertSubscription({
        userId,
        subscription: normalized.subscription,
        consentRevision: consent.revision,
        now,
      });
      expect(stored.outcome).toBe("stored");
      if (stored.outcome !== "stored") return;
      await expect(store.upsertSubscription({
        userId: otherUserId,
        subscription: normalized.subscription,
        consentRevision: 1,
        now,
      })).resolves.toEqual({ outcome: "endpoint_conflict" });

      const token = parsePreventiveWebPushEntryToken("a".repeat(43));
      expect(token.ok).toBe(true);
      if (!token.ok) return;
      const claimInput = {
        userId,
        subscriptionId: stored.subscription.id,
        scheduleOccurrenceId: `occurrence.${randomUUID()}`,
        scheduleId: "schedule.daily.checkin",
        policyAuditId: "audit.test",
        policyDecisionDigest: "sha256:" + "b".repeat(64),
        entryTokenDigest: token.tokenDigest,
        claimToken: randomUUID(),
        claimExpiresAt: new Date(now.getTime() + 60_000),
        now,
      };
      const claims = await Promise.all(Array.from({ length: 10 }, () =>
        store.acquireDeliveryClaim(claimInput)
      ));
      expect(claims.filter((claim) => claim.outcome === "acquired")).toHaveLength(1);
      expect(claims.filter((claim) => claim.outcome === "pending")).toHaveLength(9);
      const acquired = claims.find((claim) => claim.outcome === "acquired");
      expect(acquired?.outcome).toBe("acquired");
      if (!acquired || acquired.outcome !== "acquired") return;
      const providerAttempt = await store.markProviderAttemptStarted({
        deliveryId: acquired.delivery.id,
        claimToken: claimInput.claimToken,
        providerAttemptId: "provider-attempt.postgres",
        now,
      });
      expect(providerAttempt.outcome).toBe("started");
      await store.recordEntryToken({
        deliveryId: acquired.delivery.id,
        userId,
        tokenDigest: token.tokenDigest,
        scheduleOccurrenceId: claimInput.scheduleOccurrenceId,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
      });
      await expect(store.markProviderAccepted({
        deliveryId: acquired.delivery.id,
        providerAttemptId: "provider-attempt.postgres",
        providerStatus: 201,
        now,
      })).resolves.toEqual({ outcome: "recorded" });
      await store.markDeliverySent({
        deliveryId: acquired.delivery.id,
        providerAttemptId: "provider-attempt.postgres",
        providerStatus: 201,
        now,
      });
      await expect(store.acquireDeliveryClaim({
        ...claimInput,
        claimToken: randomUUID(),
      })).resolves.toMatchObject({ outcome: "duplicate" });
      await expect(store.redeemEntryToken({
        userId: otherUserId,
        tokenDigest: token.tokenDigest,
        now,
      })).resolves.toEqual({ outcome: "wrong_user" });
      const opened = await store.redeemEntryToken({
        userId,
        tokenDigest: token.tokenDigest,
        now,
      });
      expect(opened).toMatchObject({
        outcome: "opened",
        route: "/health/check-in",
        flowId: "health.preventive_check",
        flowVersion: "1.0.0",
      });
      if (opened.outcome !== "opened") return;
      await expect(store.recordFlowStarted({
        userId,
        entryId: opened.entryId,
        now,
      })).resolves.toMatchObject({
        outcome: "flow_started",
        route: "/health/check-in",
        flowId: "health.preventive_check",
        flowVersion: "1.0.0",
      });

      const revokedToken = parsePreventiveWebPushEntryToken("c".repeat(43));
      expect(revokedToken.ok).toBe(true);
      if (!revokedToken.ok) return;
      const secondClaim = await store.acquireDeliveryClaim({
        ...claimInput,
        scheduleOccurrenceId: `occurrence.${randomUUID()}`,
        entryTokenDigest: revokedToken.tokenDigest,
        claimToken: randomUUID(),
      });
      expect(secondClaim.outcome).toBe("acquired");
      if (secondClaim.outcome !== "acquired") return;
      const secondAttempt = await store.markProviderAttemptStarted({
        deliveryId: secondClaim.delivery.id,
        claimToken: secondClaim.delivery.sendingClaimToken ?? "",
        providerAttemptId: "provider-attempt.revoked.postgres",
        now,
      });
      expect(secondAttempt.outcome).toBe("started");
      await store.recordEntryToken({
        deliveryId: secondClaim.delivery.id,
        userId,
        tokenDigest: revokedToken.tokenDigest,
        scheduleOccurrenceId: "occurrence.revoked",
        issuedAt: now,
        expiresAt: new Date(now.getTime() + 30 * 60_000),
      });
      await store.markProviderAccepted({
        deliveryId: secondClaim.delivery.id,
        providerAttemptId: "provider-attempt.revoked.postgres",
        providerStatus: 201,
        now,
      });
      await store.markDeliverySent({
        deliveryId: secondClaim.delivery.id,
        providerAttemptId: "provider-attempt.revoked.postgres",
        providerStatus: 201,
        now,
      });
      await store.setConsent({ userId, enabled: false, now: new Date(now.getTime() + 1_000) });
      await expect(store.redeemEntryToken({
        userId,
        tokenDigest: revokedToken.tokenDigest,
        now: new Date(now.getTime() + 2_000),
      })).resolves.toEqual({ outcome: "invalid" });
    },
    180_000,
  );
});
