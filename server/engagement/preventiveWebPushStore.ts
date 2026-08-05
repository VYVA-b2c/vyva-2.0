import { randomUUID } from "node:crypto";
import type { NormalizedPreventiveWebPushSubscription } from "./preventiveWebPushSecurity.js";
import {
  PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE,
  PREVENTIVE_WEB_PUSH_CHANNEL,
  PREVENTIVE_WEB_PUSH_FLOW_ID,
  PREVENTIVE_WEB_PUSH_FLOW_VERSION,
  PREVENTIVE_WEB_PUSH_PURPOSE_ID,
} from "./preventiveWebPushSecurity.js";

export type PreventiveWebPushConsentState = Readonly<{
  enabled: boolean;
  revision: number;
  updatedAt: Date | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
}>;

export type PreventiveWebPushSubscriptionRecord = Readonly<{
  id: string;
  userId: string;
  endpoint: string;
  endpointDigest: string;
  p256dh: string;
  auth: string;
  contentEncoding: "aes128gcm";
  status: "active" | "inactive" | "revoked" | "expired";
  consentRevision: number;
  failureCount: number;
}>;

export type PreventiveWebPushDeliveryStatus =
  | "requested"
  | "sending"
  | "provider_attempt_started"
  | "delivery_uncertain"
  | "sent"
  | "failed_permanent"
  | "failed_retryable"
  | "opened"
  | "flow_started";

export type PreventiveWebPushDeliveryRecord = Readonly<{
  id: string;
  deliveryKey: string;
  userId: string;
  subscriptionId: string;
  status: PreventiveWebPushDeliveryStatus;
  policyDecisionDigest: string | null;
  entryTokenDigest: string | null;
  sendingClaimToken: string | null;
  sendingClaimExpiresAt: Date | null;
  providerAttemptId: string | null;
  providerAttemptNumber: number;
}>;

export type PreventiveWebPushDeliveryClaim =
  | { outcome: "acquired"; delivery: PreventiveWebPushDeliveryRecord }
  | { outcome: "duplicate"; delivery: PreventiveWebPushDeliveryRecord }
  | { outcome: "pending"; delivery: PreventiveWebPushDeliveryRecord }
  | { outcome: "uncertain"; delivery: PreventiveWebPushDeliveryRecord }
  | { outcome: "conflict"; reason: "semantic_conflict" }
  | { outcome: "unavailable"; reason: "persistence_unavailable" };

export type PreventiveWebPushProviderAttemptStart =
  | { outcome: "started"; delivery: PreventiveWebPushDeliveryRecord; providerAttemptId: string; providerAttemptNumber: number }
  | { outcome: "duplicate" | "pending" | "uncertain"; delivery: PreventiveWebPushDeliveryRecord }
  | { outcome: "conflict"; reason: "claim_mismatch" | "semantic_conflict" }
  | { outcome: "unavailable"; reason: "persistence_unavailable" };

export type PreventiveWebPushEntryRedemption =
  | {
      outcome: "opened" | "flow_started" | "already_opened" | "already_started";
      entryId: string;
      deliveryId: string;
      route: typeof PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE;
      flowId: typeof PREVENTIVE_WEB_PUSH_FLOW_ID;
      flowVersion: typeof PREVENTIVE_WEB_PUSH_FLOW_VERSION;
    }
  | { outcome: "invalid" | "expired" | "wrong_user" | "unavailable" };

export interface PreventiveWebPushStore {
  readConsent(userId: string): Promise<PreventiveWebPushConsentState>;
  setConsent(input: { userId: string; enabled: boolean; now: Date }): Promise<PreventiveWebPushConsentState>;
  activeSubscription(userId: string): Promise<PreventiveWebPushSubscriptionRecord | null>;
  upsertSubscription(input: {
    userId: string;
    subscription: NormalizedPreventiveWebPushSubscription;
    consentRevision: number;
    now: Date;
  }): Promise<{ outcome: "stored"; subscription: PreventiveWebPushSubscriptionRecord } | { outcome: "endpoint_conflict" | "unavailable" }>;
  revokeSubscriptions(input: { userId: string; now: Date }): Promise<{ outcome: "revoked" | "unavailable" }>;
  revokeEntryTokens(input: { userId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number } | { outcome: "unavailable" }>;
  acquireDeliveryClaim(input: {
    userId: string;
    subscriptionId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    entryTokenDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveWebPushDeliveryClaim>;
  markProviderAttemptStarted(input: {
    deliveryId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveWebPushProviderAttemptStart>;
  markProviderAccepted(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<{ outcome: "recorded" | "unavailable" }>;
  markDeliverySent(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<void>;
  markDeliveryFailed(input: {
    deliveryId: string;
    status: "failed_permanent" | "failed_retryable";
    providerStatus: number | null;
    reason: string;
    subscriptionId?: string;
    providerAttemptId?: string;
    now: Date;
  }): Promise<void>;
  recordEntryToken(input: {
    deliveryId: string;
    userId: string;
    tokenDigest: string;
    scheduleOccurrenceId: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<{ outcome: "stored" | "duplicate" | "unavailable" }>;
  redeemEntryToken(input: { userId: string; tokenDigest: string; now: Date }): Promise<PreventiveWebPushEntryRedemption>;
  recordFlowStarted(input: { userId: string; entryId: string; now: Date }): Promise<PreventiveWebPushEntryRedemption>;
}

type PgQueryResult<T> = { rows: T[]; rowCount?: number | null };
type PgQueryable = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PgQueryResult<T>>;
};
type PgClient = PgQueryable & {
  release(): void;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  endpoint_digest: string;
  p256dh: string;
  auth: string;
  content_encoding: string;
  status: "active" | "inactive" | "revoked" | "expired";
  consent_revision: number;
  failure_count: number;
};

type ConsentRow = {
  preventive_web_push_enabled: boolean;
  preventive_web_push_consent_revision: number;
  preventive_web_push_consent_updated_at: Date | string | null;
  preventive_web_push_consent_granted_at: Date | string | null;
  preventive_web_push_consent_revoked_at: Date | string | null;
};

type DeliveryRow = {
  id: string;
  delivery_key: string;
  user_id: string;
  subscription_id: string;
  status: PreventiveWebPushDeliveryStatus;
  policy_decision_digest: string | null;
  entry_token_digest: string | null;
  sending_claim_token: string | null;
  sending_claim_expires_at: Date | string | null;
  provider_attempt_id: string | null;
  provider_attempt_number: number | null;
};

type EntryTokenRow = {
  id: string;
  delivery_id: string;
  user_id: string;
  status: "active" | "opened" | "flow_started" | "revoked" | "expired";
  expires_at: Date | string;
  delivery_status: PreventiveWebPushDeliveryStatus | null;
  subscription_status: "active" | "inactive" | "revoked" | "expired" | null;
  subscription_consent_revision: number | null;
  consent_enabled: boolean | null;
  consent_revision: number | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function consentFromRow(row: ConsentRow | undefined): PreventiveWebPushConsentState {
  return {
    enabled: row?.preventive_web_push_enabled ?? false,
    revision: row?.preventive_web_push_consent_revision ?? 0,
    updatedAt: asDate(row?.preventive_web_push_consent_updated_at),
    grantedAt: asDate(row?.preventive_web_push_consent_granted_at),
    revokedAt: asDate(row?.preventive_web_push_consent_revoked_at),
  };
}

function subscriptionFromRow(row: SubscriptionRow): PreventiveWebPushSubscriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    endpoint: row.endpoint,
    endpointDigest: row.endpoint_digest,
    p256dh: row.p256dh,
    auth: row.auth,
    contentEncoding: "aes128gcm",
    status: row.status,
    consentRevision: row.consent_revision,
    failureCount: row.failure_count,
  };
}

function deliveryFromRow(row: DeliveryRow): PreventiveWebPushDeliveryRecord {
  return {
    id: row.id,
    deliveryKey: row.delivery_key,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    status: row.status,
    policyDecisionDigest: row.policy_decision_digest,
    entryTokenDigest: row.entry_token_digest,
    sendingClaimToken: row.sending_claim_token,
    sendingClaimExpiresAt: asDate(row.sending_claim_expires_at),
    providerAttemptId: row.provider_attempt_id,
    providerAttemptNumber: row.provider_attempt_number ?? 0,
  };
}

function terminalDeliveryStatus(status: PreventiveWebPushDeliveryStatus): boolean {
  return status === "sent" ||
    status === "opened" ||
    status === "flow_started" ||
    status === "failed_permanent";
}

function restorationAllowed(row: EntryTokenRow): boolean {
  return row.consent_enabled === true &&
    row.subscription_status === "active" &&
    row.subscription_consent_revision !== null &&
    row.consent_revision !== null &&
    row.subscription_consent_revision === row.consent_revision;
}

function successfulRedemption(
  outcome: "opened" | "flow_started" | "already_opened" | "already_started",
  token: Pick<EntryTokenRow, "id" | "delivery_id">,
): PreventiveWebPushEntryRedemption {
  return {
    outcome,
    entryId: token.id,
    deliveryId: token.delivery_id,
    route: PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE,
    flowId: PREVENTIVE_WEB_PUSH_FLOW_ID,
    flowVersion: PREVENTIVE_WEB_PUSH_FLOW_VERSION,
  };
}

export function preventiveWebPushDeliveryKey(input: {
  userId: string;
  subscriptionId: string;
  scheduleOccurrenceId: string;
}): string {
  return [
    "preventive_web_push",
    PREVENTIVE_WEB_PUSH_PURPOSE_ID,
    input.userId,
    input.subscriptionId,
    input.scheduleOccurrenceId,
  ].join(":");
}

class LazyPostgresConnection {
  async withClient<T>(operation: (client: PgClient) => Promise<T>): Promise<T> {
    const { pool } = await import("../db.js");
    const client = await pool.connect();
    try {
      return await operation(client);
    } finally {
      client.release();
    }
  }
}

export class PostgresPreventiveWebPushStore implements PreventiveWebPushStore {
  constructor(private readonly connection = new LazyPostgresConnection()) {}

  async readConsent(userId: string): Promise<PreventiveWebPushConsentState> {
    try {
      return await this.connection.withClient(async (client) => {
        const result = await client.query<ConsentRow>(
          `select preventive_web_push_enabled,
                  preventive_web_push_consent_revision,
                  preventive_web_push_consent_updated_at,
                  preventive_web_push_consent_granted_at,
                  preventive_web_push_consent_revoked_at
             from user_channel_preferences
            where user_id = $1
            limit 1`,
          [userId],
        );
        return consentFromRow(result.rows[0]);
      });
    } catch {
      return consentFromRow(undefined);
    }
  }

  async setConsent(input: { userId: string; enabled: boolean; now: Date }): Promise<PreventiveWebPushConsentState> {
    return this.connection.withClient(async (client) => {
      await client.query("begin");
      try {
        const result = await client.query<ConsentRow>(
          `insert into user_channel_preferences (
              user_id,
              preventive_web_push_enabled,
              preventive_web_push_consent_revision,
              preventive_web_push_consent_updated_at,
              preventive_web_push_consent_granted_at,
              preventive_web_push_consent_revoked_at,
              updated_at
            ) values (
              $1,
              $2,
              1,
              $3::timestamptz,
              case when $2 then $3::timestamptz else null::timestamptz end,
              case when $2 then null::timestamptz else $3::timestamptz end,
              $3::timestamptz
            )
            on conflict (user_id) do update set
              preventive_web_push_enabled = excluded.preventive_web_push_enabled,
              preventive_web_push_consent_revision = user_channel_preferences.preventive_web_push_consent_revision + 1,
              preventive_web_push_consent_updated_at = excluded.preventive_web_push_consent_updated_at,
              preventive_web_push_consent_granted_at = case
                when excluded.preventive_web_push_enabled then excluded.preventive_web_push_consent_granted_at
                else user_channel_preferences.preventive_web_push_consent_granted_at
              end,
              preventive_web_push_consent_revoked_at = case
                when excluded.preventive_web_push_enabled then null
                else excluded.preventive_web_push_consent_revoked_at
              end,
              updated_at = excluded.updated_at
            returning preventive_web_push_enabled,
                      preventive_web_push_consent_revision,
                      preventive_web_push_consent_updated_at,
                      preventive_web_push_consent_granted_at,
                      preventive_web_push_consent_revoked_at`,
          [input.userId, input.enabled, input.now],
        );
        if (!input.enabled) {
          await this.revokeEntryTokensWithClient(client, input);
        }
        await client.query("commit");
        return consentFromRow(result.rows[0]);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      }
    });
  }

  async activeSubscription(userId: string): Promise<PreventiveWebPushSubscriptionRecord | null> {
    return this.connection.withClient(async (client) => {
      const result = await client.query<SubscriptionRow>(
        `select id, user_id, endpoint, endpoint_digest, p256dh, auth, content_encoding,
                status, consent_revision, failure_count
           from preventive_web_push_subscriptions
          where user_id = $1 and status = 'active'
          order by updated_at desc
          limit 1`,
        [userId],
      );
      return result.rows[0] ? subscriptionFromRow(result.rows[0]) : null;
    });
  }

  async upsertSubscription(input: {
    userId: string;
    subscription: NormalizedPreventiveWebPushSubscription;
    consentRevision: number;
    now: Date;
  }): Promise<{ outcome: "stored"; subscription: PreventiveWebPushSubscriptionRecord } | { outcome: "endpoint_conflict" | "unavailable" }> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const existing = await client.query<SubscriptionRow>(
            `select id, user_id, endpoint, endpoint_digest, p256dh, auth, content_encoding,
                    status, consent_revision, failure_count
               from preventive_web_push_subscriptions
              where endpoint_digest = $1
              for update`,
            [input.subscription.endpointDigest],
          );
          const existingRow = existing.rows[0];
          if (existingRow && existingRow.user_id !== input.userId) {
            await client.query("rollback");
            return { outcome: "endpoint_conflict" };
          }
          const id = existingRow?.id ?? randomUUID();
          const saved = await client.query<SubscriptionRow>(
            `insert into preventive_web_push_subscriptions (
                id, user_id, endpoint, endpoint_digest, p256dh, auth, content_encoding,
                user_agent, status, consent_revision, last_seen_at, updated_at
              ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, $10)
              on conflict (endpoint_digest) do update set
                endpoint = excluded.endpoint,
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                content_encoding = excluded.content_encoding,
                user_agent = excluded.user_agent,
                status = 'active',
                consent_revision = excluded.consent_revision,
                last_seen_at = excluded.last_seen_at,
                updated_at = excluded.updated_at,
                revoked_at = null
              returning id, user_id, endpoint, endpoint_digest, p256dh, auth, content_encoding,
                        status, consent_revision, failure_count`,
            [
              id,
              input.userId,
              input.subscription.endpoint,
              input.subscription.endpointDigest,
              input.subscription.keys.p256dh,
              input.subscription.keys.auth,
              input.subscription.contentEncoding,
              input.subscription.userAgent,
              input.consentRevision,
              input.now,
            ],
          );
          await client.query("commit");
          return { outcome: "stored", subscription: subscriptionFromRow(saved.rows[0]) };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  private async revokeEntryTokensWithClient(
    client: PgQueryable,
    input: { userId: string; now: Date },
  ): Promise<number> {
    const result = await client.query(
      `update preventive_web_push_entry_tokens
          set status = 'revoked',
              revoked_at = $2,
              updated_at = $2
        where user_id = $1
          and status in ('active', 'opened')
          and expires_at > $2`,
      [input.userId, input.now],
    );
    return result.rowCount ?? 0;
  }

  async revokeEntryTokens(input: { userId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number } | { outcome: "unavailable" }> {
    try {
      const revokedCount = await this.connection.withClient((client) =>
        this.revokeEntryTokensWithClient(client, input)
      );
      return { outcome: "revoked", revokedCount };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async revokeSubscriptions(input: { userId: string; now: Date }): Promise<{ outcome: "revoked" | "unavailable" }> {
    try {
      await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          await client.query(
            `update preventive_web_push_subscriptions
                set status = 'revoked', revoked_at = $2, updated_at = $2
              where user_id = $1 and status = 'active'`,
            [input.userId, input.now],
          );
          await this.revokeEntryTokensWithClient(client, input);
          await client.query("commit");
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
      return { outcome: "revoked" };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async acquireDeliveryClaim(input: {
    userId: string;
    subscriptionId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    entryTokenDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveWebPushDeliveryClaim> {
    const deliveryKey = preventiveWebPushDeliveryKey(input);
    try {
      return await this.connection.withClient(async (client) => {
        const id = randomUUID();
        await client.query(
          `insert into preventive_web_push_deliveries (
              id, delivery_key, user_id, subscription_id, schedule_occurrence_id,
              schedule_id, purpose_id, channel, flow_id, flow_version, status,
              policy_audit_id, policy_decision_digest, entry_token_digest,
              requested_at, updated_at
            ) values (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10, 'requested',
              $11, $12, $13,
              $14, $14
            )
            on conflict (delivery_key) do nothing`,
          [
            id,
            deliveryKey,
            input.userId,
            input.subscriptionId,
            input.scheduleOccurrenceId,
            input.scheduleId,
            PREVENTIVE_WEB_PUSH_PURPOSE_ID,
            PREVENTIVE_WEB_PUSH_CHANNEL,
            PREVENTIVE_WEB_PUSH_FLOW_ID,
            PREVENTIVE_WEB_PUSH_FLOW_VERSION,
            input.policyAuditId,
            input.policyDecisionDigest,
            input.entryTokenDigest,
            input.now,
          ],
        );
        await client.query("begin");
        try {
          const existing = await client.query<DeliveryRow>(
            `select id, delivery_key, user_id, subscription_id, status, policy_decision_digest,
                    entry_token_digest, sending_claim_token, sending_claim_expires_at,
                    provider_attempt_id, provider_attempt_number
               from preventive_web_push_deliveries
              where delivery_key = $1
              for update`,
            [deliveryKey],
          );
          const delivery = deliveryFromRow(existing.rows[0]);
          if (delivery.policyDecisionDigest && delivery.policyDecisionDigest !== input.policyDecisionDigest) {
            await client.query("rollback");
            return { outcome: "conflict", reason: "semantic_conflict" };
          }
          if (terminalDeliveryStatus(delivery.status)) {
            await client.query("commit");
            return { outcome: "duplicate", delivery };
          }
          if (delivery.status === "delivery_uncertain") {
            await client.query("commit");
            return { outcome: "uncertain", delivery };
          }
          if (delivery.status === "provider_attempt_started") {
            await client.query("commit");
            return delivery.sendingClaimExpiresAt && delivery.sendingClaimExpiresAt.getTime() > input.now.getTime()
              ? { outcome: "pending", delivery }
              : { outcome: "uncertain", delivery };
          }
          if (delivery.status === "sending" &&
            delivery.sendingClaimExpiresAt &&
            delivery.sendingClaimExpiresAt.getTime() > input.now.getTime()) {
            await client.query("commit");
            return { outcome: "pending", delivery };
          }
          const updated = await client.query<DeliveryRow>(
            `update preventive_web_push_deliveries
                set status = 'sending',
                    sending_claim_token = $2,
                    sending_claim_expires_at = $3,
                    policy_audit_id = $4,
                    policy_decision_digest = $5,
                    entry_token_digest = $6,
                    updated_at = $7
              where id = $1
              returning id, delivery_key, user_id, subscription_id, status, policy_decision_digest,
                        entry_token_digest, sending_claim_token, sending_claim_expires_at,
                        provider_attempt_id, provider_attempt_number`,
            [
              delivery.id,
              input.claimToken,
              input.claimExpiresAt,
              input.policyAuditId,
              input.policyDecisionDigest,
              input.entryTokenDigest,
              input.now,
            ],
          );
          await client.query("commit");
          return { outcome: "acquired", delivery: deliveryFromRow(updated.rows[0]) };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable", reason: "persistence_unavailable" };
    }
  }

  async markProviderAttemptStarted(input: {
    deliveryId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveWebPushProviderAttemptStart> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const selected = await client.query<DeliveryRow>(
            `select id, delivery_key, user_id, subscription_id, status, policy_decision_digest,
                    entry_token_digest, sending_claim_token, sending_claim_expires_at,
                    provider_attempt_id, provider_attempt_number
               from preventive_web_push_deliveries
              where id = $1
              for update`,
            [input.deliveryId],
          );
          const row = selected.rows[0];
          if (!row) {
            await client.query("rollback");
            return { outcome: "unavailable", reason: "persistence_unavailable" };
          }
          const delivery = deliveryFromRow(row);
          if (terminalDeliveryStatus(delivery.status)) {
            await client.query("commit");
            return { outcome: "duplicate", delivery };
          }
          if (delivery.status === "delivery_uncertain") {
            await client.query("commit");
            return { outcome: "uncertain", delivery };
          }
          if (delivery.status === "provider_attempt_started") {
            await client.query("commit");
            return { outcome: "uncertain", delivery };
          }
          if (delivery.status !== "sending" || delivery.sendingClaimToken !== input.claimToken) {
            await client.query("rollback");
            return { outcome: "conflict", reason: "claim_mismatch" };
          }
          const updated = await client.query<DeliveryRow>(
            `update preventive_web_push_deliveries
                set status = 'provider_attempt_started',
                    provider_attempt_id = $2,
                    provider_attempt_number = provider_attempt_number + 1,
                    provider_attempt_started_at = $3,
                    updated_at = $3
              where id = $1
              returning id, delivery_key, user_id, subscription_id, status, policy_decision_digest,
                        entry_token_digest, sending_claim_token, sending_claim_expires_at,
                        provider_attempt_id, provider_attempt_number`,
            [input.deliveryId, input.providerAttemptId, input.now],
          );
          await client.query("commit");
          const started = deliveryFromRow(updated.rows[0]);
          return {
            outcome: "started",
            delivery: started,
            providerAttemptId: input.providerAttemptId,
            providerAttemptNumber: started.providerAttemptNumber,
          };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable", reason: "persistence_unavailable" };
    }
  }

  async markProviderAccepted(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<{ outcome: "recorded" | "unavailable" }> {
    try {
      return await this.connection.withClient(async (client) => {
        const updated = await client.query(
          `update preventive_web_push_deliveries
              set status = 'delivery_uncertain',
                  provider_status = $3,
                  provider_attempt_accepted_at = $4,
                  updated_at = $4
            where id = $1
              and provider_attempt_id = $2
              and status = 'provider_attempt_started'`,
          [input.deliveryId, input.providerAttemptId, input.providerStatus, input.now],
        );
        if ((updated.rowCount ?? 0) === 1) return { outcome: "recorded" as const };
        const existing = await client.query<{ status: PreventiveWebPushDeliveryStatus }>(
          `select status
             from preventive_web_push_deliveries
            where id = $1
              and provider_attempt_id = $2
              and status in ('delivery_uncertain', 'sent')
            limit 1`,
          [input.deliveryId, input.providerAttemptId],
        );
        return existing.rows[0] ? { outcome: "recorded" as const } : { outcome: "unavailable" as const };
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async markDeliverySent(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<void> {
    await this.connection.withClient(async (client) => {
      const updated = await client.query(
        `update preventive_web_push_deliveries
            set status = 'sent',
                provider_status = $3,
                sent_at = $4,
                updated_at = $4
          where id = $1
            and provider_attempt_id = $2
            and status in ('delivery_uncertain', 'sent')`,
        [input.deliveryId, input.providerAttemptId, input.providerStatus, input.now],
      );
      if ((updated.rowCount ?? 0) !== 1) {
        throw new Error("delivery_sent_persistence_failed");
      }
    });
  }

  async markDeliveryFailed(input: {
    deliveryId: string;
    status: "failed_permanent" | "failed_retryable";
    providerStatus: number | null;
    reason: string;
    subscriptionId?: string;
    providerAttemptId?: string;
    now: Date;
  }): Promise<void> {
    await this.connection.withClient(async (client) => {
      await client.query(
        `update preventive_web_push_deliveries
            set status = $2,
                provider_status = $3,
                failure_reason = $4,
                failed_at = $5,
                updated_at = $5
          where id = $1
            and ($6::text is null or provider_attempt_id = $6)`,
        [input.deliveryId, input.status, input.providerStatus, input.reason.slice(0, 160), input.now, input.providerAttemptId ?? null],
      );
      if (input.status === "failed_permanent" && input.subscriptionId) {
        await client.query(
          `update preventive_web_push_subscriptions
              set status = 'expired',
                  failure_count = failure_count + 1,
                  last_provider_status = $2,
                  updated_at = $3
            where id = $1`,
          [input.subscriptionId, input.providerStatus, input.now],
        );
      }
    });
  }

  async recordEntryToken(input: {
    deliveryId: string;
    userId: string;
    tokenDigest: string;
    scheduleOccurrenceId: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<{ outcome: "stored" | "duplicate" | "unavailable" }> {
    try {
      const result = await this.connection.withClient((client) =>
        client.query(
          `insert into preventive_web_push_entry_tokens (
              id, token_digest, delivery_id, user_id, flow_id, flow_version,
              schedule_occurrence_id, allowed_route, issued_at, expires_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            on conflict (token_digest) do nothing`,
          [
            randomUUID(),
            input.tokenDigest,
            input.deliveryId,
            input.userId,
            PREVENTIVE_WEB_PUSH_FLOW_ID,
            PREVENTIVE_WEB_PUSH_FLOW_VERSION,
            input.scheduleOccurrenceId,
            PREVENTIVE_WEB_PUSH_ALLOWED_ROUTE,
            input.issuedAt,
            input.expiresAt,
          ],
        ));
      return result.rowCount === 1 ? { outcome: "stored" } : { outcome: "duplicate" };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  private async selectEntryTokenForDigest(client: PgQueryable, tokenDigest: string): Promise<EntryTokenRow | undefined> {
    const selected = await client.query<EntryTokenRow>(
      `select t.id,
              t.delivery_id,
              t.user_id,
              t.status,
              t.expires_at,
              d.status as delivery_status,
              s.status as subscription_status,
              s.consent_revision as subscription_consent_revision,
              p.preventive_web_push_enabled as consent_enabled,
              p.preventive_web_push_consent_revision as consent_revision
         from preventive_web_push_entry_tokens t
         left join preventive_web_push_deliveries d on d.id = t.delivery_id
         left join preventive_web_push_subscriptions s on s.id = d.subscription_id
         left join user_channel_preferences p on p.user_id = t.user_id
        where t.token_digest = $1
        for update of t`,
      [tokenDigest],
    );
    return selected.rows[0];
  }

  private async selectEntryTokenForId(client: PgQueryable, entryId: string): Promise<EntryTokenRow | undefined> {
    const selected = await client.query<EntryTokenRow>(
      `select t.id,
              t.delivery_id,
              t.user_id,
              t.status,
              t.expires_at,
              d.status as delivery_status,
              s.status as subscription_status,
              s.consent_revision as subscription_consent_revision,
              p.preventive_web_push_enabled as consent_enabled,
              p.preventive_web_push_consent_revision as consent_revision
         from preventive_web_push_entry_tokens t
         left join preventive_web_push_deliveries d on d.id = t.delivery_id
         left join preventive_web_push_subscriptions s on s.id = d.subscription_id
         left join user_channel_preferences p on p.user_id = t.user_id
        where t.id = $1
        for update of t`,
      [entryId],
    );
    return selected.rows[0];
  }

  private async revokeSingleToken(client: PgQueryable, token: EntryTokenRow, now: Date): Promise<void> {
    await client.query(
      `update preventive_web_push_entry_tokens
          set status = 'revoked',
              revoked_at = $2,
              updated_at = $2
        where id = $1
          and status in ('active', 'opened')`,
      [token.id, now],
    );
  }

  async redeemEntryToken(input: { userId: string; tokenDigest: string; now: Date }): Promise<PreventiveWebPushEntryRedemption> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const token = await this.selectEntryTokenForDigest(client, input.tokenDigest);
          if (!token) {
            await client.query("rollback");
            return { outcome: "invalid" };
          }
          if (token.user_id !== input.userId) {
            await client.query("rollback");
            return { outcome: "wrong_user" };
          }
          const expiry = asDate(token.expires_at);
          if (!expiry || expiry.getTime() <= input.now.getTime() || token.status === "expired") {
            await client.query(
              `update preventive_web_push_entry_tokens
                  set status = 'expired', updated_at = $2
                where id = $1 and status in ('active', 'opened')`,
              [token.id, input.now],
            );
            await client.query("commit");
            return { outcome: "expired" };
          }
          if (token.status === "revoked" || !restorationAllowed(token)) {
            await this.revokeSingleToken(client, token, input.now);
            await client.query("commit");
            return { outcome: "invalid" };
          }
          if (token.status === "flow_started") {
            await client.query("commit");
            return successfulRedemption("already_started", token);
          }
          if (token.status === "opened") {
            await client.query("commit");
            return successfulRedemption("already_opened", token);
          }
          await client.query(
            `update preventive_web_push_entry_tokens
                set status = 'opened', opened_at = $2, updated_at = $2
              where id = $1 and status = 'active'`,
            [token.id, input.now],
          );
          await client.query(
            `update preventive_web_push_deliveries
                set status = 'opened', opened_at = $2, updated_at = $2
              where id = $1 and status in ('sent', 'delivery_uncertain', 'opened')`,
            [token.delivery_id, input.now],
          );
          await client.query("commit");
          return successfulRedemption("opened", token);
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async recordFlowStarted(input: { userId: string; entryId: string; now: Date }): Promise<PreventiveWebPushEntryRedemption> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const token = await this.selectEntryTokenForId(client, input.entryId);
          if (!token) {
            await client.query("rollback");
            return { outcome: "invalid" };
          }
          if (token.user_id !== input.userId) {
            await client.query("rollback");
            return { outcome: "wrong_user" };
          }
          const expiry = asDate(token.expires_at);
          if (!expiry || expiry.getTime() <= input.now.getTime() || token.status === "expired") {
            await client.query("commit");
            return { outcome: "expired" };
          }
          if (token.status === "revoked" || !restorationAllowed(token)) {
            await this.revokeSingleToken(client, token, input.now);
            await client.query("commit");
            return { outcome: "invalid" };
          }
          if (token.status === "flow_started") {
            await client.query("commit");
            return successfulRedemption("already_started", token);
          }
          if (token.status !== "opened") {
            await client.query("rollback");
            return { outcome: "invalid" };
          }
          await client.query(
            `update preventive_web_push_entry_tokens
                set status = 'flow_started',
                    opened_at = coalesce(opened_at, $2),
                    flow_started_at = $2,
                    updated_at = $2
              where id = $1 and status = 'opened'`,
            [token.id, input.now],
          );
          await client.query(
            `update preventive_web_push_deliveries
                set status = 'flow_started',
                    opened_at = coalesce(opened_at, $2),
                    flow_started_at = $2,
                    updated_at = $2
              where id = $1 and status in ('opened', 'sent', 'delivery_uncertain')`,
            [token.delivery_id, input.now],
          );
          await client.query("commit");
          return successfulRedemption("flow_started", token);
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }
}

type InMemoryEntryToken = {
  id: string;
  tokenDigest: string;
  deliveryId: string;
  userId: string;
  status: "active" | "opened" | "flow_started" | "revoked" | "expired";
  expiresAt: Date;
};

export class InMemoryPreventiveWebPushStore implements PreventiveWebPushStore {
  private readonly consent = new Map<string, PreventiveWebPushConsentState>();
  private readonly subscriptions = new Map<string, PreventiveWebPushSubscriptionRecord>();
  private readonly subscriptionsByEndpointDigest = new Map<string, string>();
  private readonly deliveries = new Map<string, PreventiveWebPushDeliveryRecord>();
  private readonly deliveriesById = new Map<string, string>();
  private readonly tokens = new Map<string, InMemoryEntryToken>();

  async readConsent(userId: string): Promise<PreventiveWebPushConsentState> {
    return this.consent.get(userId) ?? {
      enabled: false,
      revision: 0,
      updatedAt: null,
      grantedAt: null,
      revokedAt: null,
    };
  }

  async setConsent(input: { userId: string; enabled: boolean; now: Date }): Promise<PreventiveWebPushConsentState> {
    const current = await this.readConsent(input.userId);
    const next = {
      enabled: input.enabled,
      revision: current.revision + 1,
      updatedAt: input.now,
      grantedAt: input.enabled ? input.now : current.grantedAt,
      revokedAt: input.enabled ? null : input.now,
    };
    this.consent.set(input.userId, next);
    if (!input.enabled) {
      await this.revokeEntryTokens(input);
    }
    return next;
  }

  async activeSubscription(userId: string): Promise<PreventiveWebPushSubscriptionRecord | null> {
    return Array.from(this.subscriptions.values())
      .filter((subscription) => subscription.userId === userId && subscription.status === "active")
      .at(-1) ?? null;
  }

  async upsertSubscription(input: {
    userId: string;
    subscription: NormalizedPreventiveWebPushSubscription;
    consentRevision: number;
    now: Date;
  }): Promise<{ outcome: "stored"; subscription: PreventiveWebPushSubscriptionRecord } | { outcome: "endpoint_conflict" | "unavailable" }> {
    const existingId = this.subscriptionsByEndpointDigest.get(input.subscription.endpointDigest);
    const existing = existingId ? this.subscriptions.get(existingId) : undefined;
    if (existing && existing.userId !== input.userId) return { outcome: "endpoint_conflict" };
    const id = existing?.id ?? randomUUID();
    const record: PreventiveWebPushSubscriptionRecord = {
      id,
      userId: input.userId,
      endpoint: input.subscription.endpoint,
      endpointDigest: input.subscription.endpointDigest,
      p256dh: input.subscription.keys.p256dh,
      auth: input.subscription.keys.auth,
      contentEncoding: input.subscription.contentEncoding,
      status: "active",
      consentRevision: input.consentRevision,
      failureCount: existing?.failureCount ?? 0,
    };
    this.subscriptions.set(id, record);
    this.subscriptionsByEndpointDigest.set(record.endpointDigest, id);
    return { outcome: "stored", subscription: record };
  }

  async revokeEntryTokens(input: { userId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number } | { outcome: "unavailable" }> {
    let revokedCount = 0;
    for (const [digest, token] of this.tokens.entries()) {
      if (token.userId === input.userId &&
        (token.status === "active" || token.status === "opened") &&
        token.expiresAt.getTime() > input.now.getTime()) {
        this.tokens.set(digest, { ...token, status: "revoked" });
        revokedCount += 1;
      }
    }
    return { outcome: "revoked", revokedCount };
  }

  async revokeSubscriptions(input: { userId: string; now: Date }): Promise<{ outcome: "revoked" | "unavailable" }> {
    for (const [id, subscription] of this.subscriptions.entries()) {
      if (subscription.userId === input.userId && subscription.status === "active") {
        this.subscriptions.set(id, { ...subscription, status: "revoked" });
      }
    }
    await this.revokeEntryTokens(input);
    return { outcome: "revoked" };
  }

  async acquireDeliveryClaim(input: {
    userId: string;
    subscriptionId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    entryTokenDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveWebPushDeliveryClaim> {
    const deliveryKey = preventiveWebPushDeliveryKey(input);
    const existing = this.deliveries.get(deliveryKey);
    if (existing) {
      if (existing.policyDecisionDigest && existing.policyDecisionDigest !== input.policyDecisionDigest) {
        return { outcome: "conflict", reason: "semantic_conflict" };
      }
      if (terminalDeliveryStatus(existing.status)) {
        return { outcome: "duplicate", delivery: existing };
      }
      if (existing.status === "delivery_uncertain") {
        return { outcome: "uncertain", delivery: existing };
      }
      if (existing.status === "provider_attempt_started") {
        return existing.sendingClaimExpiresAt && existing.sendingClaimExpiresAt.getTime() > input.now.getTime()
          ? { outcome: "pending", delivery: existing }
          : { outcome: "uncertain", delivery: existing };
      }
      if (existing.status === "sending" &&
        existing.sendingClaimExpiresAt &&
        existing.sendingClaimExpiresAt.getTime() > input.now.getTime()) {
        return { outcome: "pending", delivery: existing };
      }
      const refreshed: PreventiveWebPushDeliveryRecord = {
        ...existing,
        status: "sending",
        policyDecisionDigest: input.policyDecisionDigest,
        entryTokenDigest: input.entryTokenDigest,
        sendingClaimToken: input.claimToken,
        sendingClaimExpiresAt: input.claimExpiresAt,
      };
      this.deliveries.set(deliveryKey, refreshed);
      return { outcome: "acquired", delivery: refreshed };
    }
    const requested: PreventiveWebPushDeliveryRecord = {
      id: randomUUID(),
      deliveryKey,
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      status: "requested",
      policyDecisionDigest: input.policyDecisionDigest,
      entryTokenDigest: input.entryTokenDigest,
      sendingClaimToken: null,
      sendingClaimExpiresAt: null,
      providerAttemptId: null,
      providerAttemptNumber: 0,
    };
    const sending: PreventiveWebPushDeliveryRecord = {
      ...requested,
      status: "sending",
      sendingClaimToken: input.claimToken,
      sendingClaimExpiresAt: input.claimExpiresAt,
    };
    this.deliveries.set(deliveryKey, sending);
    this.deliveriesById.set(sending.id, deliveryKey);
    return { outcome: "acquired", delivery: sending };
  }

  async markProviderAttemptStarted(input: {
    deliveryId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveWebPushProviderAttemptStart> {
    const delivery = this.deliveryById(input.deliveryId);
    if (!delivery) return { outcome: "unavailable", reason: "persistence_unavailable" };
    if (terminalDeliveryStatus(delivery.status)) return { outcome: "duplicate", delivery };
    if (delivery.status === "delivery_uncertain" || delivery.status === "provider_attempt_started") {
      return { outcome: "uncertain", delivery };
    }
    if (delivery.status !== "sending" || delivery.sendingClaimToken !== input.claimToken) {
      return { outcome: "conflict", reason: "claim_mismatch" };
    }
    const started: PreventiveWebPushDeliveryRecord = {
      ...delivery,
      status: "provider_attempt_started",
      providerAttemptId: input.providerAttemptId,
      providerAttemptNumber: delivery.providerAttemptNumber + 1,
    };
    this.replaceDelivery(started);
    return {
      outcome: "started",
      delivery: started,
      providerAttemptId: input.providerAttemptId,
      providerAttemptNumber: started.providerAttemptNumber,
    };
  }

  async markProviderAccepted(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<{ outcome: "recorded" | "unavailable" }> {
    const delivery = this.deliveryById(input.deliveryId);
    if (!delivery || delivery.providerAttemptId !== input.providerAttemptId) {
      return { outcome: "unavailable" };
    }
    if (delivery.status === "sent" || delivery.status === "delivery_uncertain") return { outcome: "recorded" };
    if (delivery.status !== "provider_attempt_started") return { outcome: "unavailable" };
    this.replaceDelivery({ ...delivery, status: "delivery_uncertain" });
    return { outcome: "recorded" };
  }

  async markDeliverySent(input: {
    deliveryId: string;
    providerAttemptId: string;
    providerStatus: number | null;
    now: Date;
  }): Promise<void> {
    const delivery = this.deliveryById(input.deliveryId);
    if (!delivery || delivery.providerAttemptId !== input.providerAttemptId) {
      throw new Error("delivery_not_found");
    }
    if (delivery.status !== "delivery_uncertain" && delivery.status !== "sent") {
      throw new Error("delivery_sent_persistence_failed");
    }
    this.replaceDelivery({ ...delivery, status: "sent" });
  }

  async markDeliveryFailed(input: {
    deliveryId: string;
    status: "failed_permanent" | "failed_retryable";
    providerStatus: number | null;
    reason: string;
    subscriptionId?: string;
    providerAttemptId?: string;
    now: Date;
  }): Promise<void> {
    const delivery = this.deliveryById(input.deliveryId);
    if (delivery && (!input.providerAttemptId || delivery.providerAttemptId === input.providerAttemptId)) {
      this.replaceDelivery({ ...delivery, status: input.status });
    }
    if (input.status === "failed_permanent" && input.subscriptionId) {
      const subscription = this.subscriptions.get(input.subscriptionId);
      if (subscription) {
        this.subscriptions.set(subscription.id, {
          ...subscription,
          status: "expired",
          failureCount: subscription.failureCount + 1,
        });
      }
    }
  }

  async recordEntryToken(input: {
    deliveryId: string;
    userId: string;
    tokenDigest: string;
    scheduleOccurrenceId: string;
    issuedAt: Date;
    expiresAt: Date;
  }): Promise<{ outcome: "stored" | "duplicate" | "unavailable" }> {
    if (this.tokens.has(input.tokenDigest)) return { outcome: "duplicate" };
    this.tokens.set(input.tokenDigest, {
      id: randomUUID(),
      tokenDigest: input.tokenDigest,
      deliveryId: input.deliveryId,
      userId: input.userId,
      status: "active",
      expiresAt: input.expiresAt,
    });
    return { outcome: "stored" };
  }

  async redeemEntryToken(input: { userId: string; tokenDigest: string; now: Date }): Promise<PreventiveWebPushEntryRedemption> {
    const token = this.tokens.get(input.tokenDigest);
    if (!token) return { outcome: "invalid" };
    if (token.userId !== input.userId) return { outcome: "wrong_user" };
    if (token.expiresAt.getTime() <= input.now.getTime() || token.status === "expired") {
      this.tokens.set(token.tokenDigest, { ...token, status: "expired" });
      return { outcome: "expired" };
    }
    if (token.status === "revoked" || !this.restorationAllowed(token)) {
      if (token.status === "active" || token.status === "opened") {
        this.tokens.set(token.tokenDigest, { ...token, status: "revoked" });
      }
      return { outcome: "invalid" };
    }
    if (token.status === "flow_started") return successfulRedemption("already_started", token);
    if (token.status === "opened") return successfulRedemption("already_opened", token);
    this.tokens.set(token.tokenDigest, { ...token, status: "opened" });
    const delivery = this.deliveryById(token.deliveryId);
    if (delivery && (delivery.status === "sent" || delivery.status === "delivery_uncertain" || delivery.status === "opened")) {
      this.replaceDelivery({ ...delivery, status: "opened" });
    }
    return successfulRedemption("opened", token);
  }

  async recordFlowStarted(input: { userId: string; entryId: string; now: Date }): Promise<PreventiveWebPushEntryRedemption> {
    const token = Array.from(this.tokens.values()).find((item) => item.id === input.entryId);
    if (!token) return { outcome: "invalid" };
    if (token.userId !== input.userId) return { outcome: "wrong_user" };
    if (token.expiresAt.getTime() <= input.now.getTime() || token.status === "expired") {
      return { outcome: "expired" };
    }
    if (token.status === "revoked" || !this.restorationAllowed(token)) {
      if (token.status === "active" || token.status === "opened") {
        this.tokens.set(token.tokenDigest, { ...token, status: "revoked" });
      }
      return { outcome: "invalid" };
    }
    if (token.status === "flow_started") return successfulRedemption("already_started", token);
    if (token.status !== "opened") return { outcome: "invalid" };
    const updated = { ...token, status: "flow_started" as const };
    this.tokens.set(token.tokenDigest, updated);
    const delivery = this.deliveryById(token.deliveryId);
    if (delivery && (delivery.status === "opened" || delivery.status === "sent" || delivery.status === "delivery_uncertain")) {
      this.replaceDelivery({ ...delivery, status: "flow_started" });
    }
    return successfulRedemption("flow_started", updated);
  }

  private restorationAllowed(token: InMemoryEntryToken): boolean {
    const consent = this.consent.get(token.userId);
    const delivery = this.deliveryById(token.deliveryId);
    const subscription = delivery ? this.subscriptions.get(delivery.subscriptionId) : undefined;
    return consent?.enabled === true &&
      subscription?.status === "active" &&
      subscription.consentRevision === consent.revision;
  }

  private deliveryById(deliveryId: string): PreventiveWebPushDeliveryRecord | null {
    const key = this.deliveriesById.get(deliveryId);
    return key ? this.deliveries.get(key) ?? null : null;
  }

  private replaceDelivery(delivery: PreventiveWebPushDeliveryRecord): void {
    this.deliveries.set(delivery.deliveryKey, delivery);
    this.deliveriesById.set(delivery.id, delivery.deliveryKey);
  }

  snapshot() {
    return {
      consent: Array.from(this.consent.entries()),
      subscriptions: Array.from(this.subscriptions.values()),
      deliveries: Array.from(this.deliveries.values()),
      tokens: Array.from(this.tokens.values()),
    };
  }
}

export const defaultPreventiveWebPushStore = new PostgresPreventiveWebPushStore();
