import { randomUUID } from "node:crypto";
import {
  constantTimeEqual,
  normalizeE164Phone,
  PREVENTIVE_OUTBOUND_CALL_CHANNEL,
  PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
  PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
  PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
  sha256Digest,
} from "./preventiveOutboundCallSecurity.js";

export type PreventiveOutboundCallConsentState = Readonly<{
  id: string | null;
  userId: string;
  profileId: string;
  enabled: boolean;
  revision: number;
  phoneE164: string | null;
  phoneDigest: string | null;
  phoneLast4: string | null;
  phoneVerifiedAt: Date | null;
  verificationSource: string | null;
  verificationReference: string | null;
  updatedAt: Date | null;
  grantedAt: Date | null;
  revokedAt: Date | null;
}>;

export type PreventiveOutboundCallAttemptStatus =
  | "requested"
  | "claimed"
  | "provider_attempt_started"
  | "provider_started"
  | "ringing"
  | "answered"
  | "identity_confirmed"
  | "flow_entry_started"
  | "flow_started"
  | "no_answer"
  | "busy"
  | "declined"
  | "cancelled"
  | "failed_retryable"
  | "failed_permanent"
  | "delivery_uncertain";

export type PreventiveOutboundCallAttemptRecord = Readonly<{
  id: string;
  callKey: string;
  userId: string;
  profileId: string;
  scheduleOccurrenceId: string;
  scheduleId: string;
  status: PreventiveOutboundCallAttemptStatus;
  consentId: string;
  consentRevision: number;
  phoneDigest: string;
  policyAuditId: string | null;
  policyDecisionDigest: string | null;
  claimToken: string | null;
  claimExpiresAt: Date | null;
  providerAttemptId: string | null;
  providerAttemptNumber: number;
  providerConversationId: string | null;
  twilioCallSid: string | null;
  confirmationTokenDigest: string | null;
  confirmationTokenExpiresAt: Date | null;
  flowEntryClaimToken: string | null;
  flowEntryClaimExpiresAt: Date | null;
  flowEntryEvidenceReference: string | null;
  flowEntryFailureReason: string | null;
  cancellationRequestedAt: Date | null;
  cancellationCompletedAt: Date | null;
  cancellationStatus: "requested" | "accepted" | "failed" | "uncertain" | null;
  cancellationReason: string | null;
}>;

export type PreventiveOutboundCallClaim =
  | { outcome: "acquired"; attempt: PreventiveOutboundCallAttemptRecord }
  | { outcome: "duplicate" | "pending" | "uncertain"; attempt: PreventiveOutboundCallAttemptRecord }
  | { outcome: "conflict"; reason: "semantic_conflict" | "consent_mismatch" }
  | { outcome: "unavailable"; reason: "persistence_unavailable" };

export type PreventiveOutboundCallProviderAttemptStart =
  | { outcome: "started"; attempt: PreventiveOutboundCallAttemptRecord; providerAttemptNumber: number }
  | { outcome: "duplicate" | "pending" | "uncertain"; attempt: PreventiveOutboundCallAttemptRecord }
  | { outcome: "conflict"; reason: "claim_mismatch" }
  | { outcome: "unavailable"; reason: "persistence_unavailable" };

export type PreventiveOutboundCallWebhookResult =
  | { outcome: "recorded"; status: PreventiveOutboundCallAttemptStatus; attempt: PreventiveOutboundCallAttemptRecord }
  | { outcome: "duplicate"; attempt: PreventiveOutboundCallAttemptRecord | null }
  | { outcome: "unknown_call" | "invalid_transition" | "unavailable"; reason?: string };

export type PreventiveOutboundCallFlowEntryEvidence = Readonly<{
  flowId: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_ID;
  flowVersion: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION;
  sessionId: string;
  evidenceReference: string;
  status: "started" | "restored";
}>;

export type PreventiveOutboundCallFlowEntryClaimResult =
  | {
      outcome: "flow_entry_started";
      attempt: PreventiveOutboundCallAttemptRecord;
      flowEntryClaimToken: string;
      flowId: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_ID;
      flowVersion: typeof PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION;
    }
  | {
      outcome: "already_started";
      attempt: PreventiveOutboundCallAttemptRecord;
      flowEntryEvidence: PreventiveOutboundCallFlowEntryEvidence | null;
    }
  | {
      outcome: "entry_pending";
      attempt: PreventiveOutboundCallAttemptRecord;
    }
  | {
      outcome:
      | "invalid"
      | "expired"
      | "wrong_provider_correlation"
      | "consent_revoked"
      | "not_answered"
      | "replayed"
      | "unavailable";
    };

export type PreventiveOutboundCallFlowStartedResult =
  | {
      outcome: "flow_started" | "already_started";
      attempt: PreventiveOutboundCallAttemptRecord;
      flowEntryEvidence: PreventiveOutboundCallFlowEntryEvidence;
    }
  | { outcome: "claim_mismatch" | "unavailable" };

export type PreventiveOutboundCallRevocationResult =
  | {
      outcome: "revoked";
      consent: PreventiveOutboundCallConsentState;
      revokedTokenCount: number;
      cancellationCandidates: PreventiveOutboundCallAttemptRecord[];
    }
  | { outcome: "unavailable" };

export interface PreventiveOutboundCallStore {
  readConsent(input: { userId: string; profileId: string }): Promise<PreventiveOutboundCallConsentState>;
  provisionConsent(input: {
    userId: string;
    profileId: string;
    enabled: boolean;
    phoneE164: string;
    phoneVerifiedAt: Date;
    verificationSource: string;
    verificationReference: string;
    now: Date;
  }): Promise<PreventiveOutboundCallConsentState>;
  revokeConsent(input: { userId: string; profileId: string; now: Date }): Promise<PreventiveOutboundCallConsentState>;
  revokeConsentAndClaimCancellations(input: {
    userId: string;
    profileId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallRevocationResult>;
  recordCancellationResult(input: {
    attemptId: string;
    twilioCallSid: string;
    status: "accepted" | "failed" | "uncertain";
    reason: string;
    now: Date;
  }): Promise<void>;
  revokeConfirmationTokens(input: { userId: string; profileId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number } | { outcome: "unavailable" }>;
  acquireCallClaim(input: {
    userId: string;
    profileId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    consent: PreventiveOutboundCallConsentState;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    confirmationTokenDigest: string;
    confirmationTokenExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallClaim>;
  markProviderAttemptStarted(input: {
    attemptId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallProviderAttemptStart>;
  markProviderStarted(input: {
    attemptId: string;
    providerAttemptId: string;
    providerConversationId: string;
    twilioCallSid: string;
    now: Date;
  }): Promise<{ outcome: "recorded" | "duplicate" | "unavailable" }>;
  markProviderFailed(input: {
    attemptId: string;
    providerAttemptId?: string;
    status: "failed_retryable" | "failed_permanent" | "delivery_uncertain";
    reason: string;
    now: Date;
  }): Promise<void>;
  recordTwilioStatus(input: {
    eventKey: string;
    twilioCallSid: string;
    providerStatus: string;
    receivedAt: Date;
  }): Promise<PreventiveOutboundCallWebhookResult>;
  claimConfirmedFlowEntry(input: {
    tokenDigest: string;
    providerConversationId: string;
    twilioCallSid: string;
    flowEntryClaimToken: string;
    flowEntryClaimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowEntryClaimResult>;
  markFlowStarted(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    flowEntryEvidence: PreventiveOutboundCallFlowEntryEvidence;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowStartedResult>;
  markFlowEntryFailed(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    reason: string;
    now: Date;
  }): Promise<void>;
}

type PgQueryResult<T> = { rows: T[]; rowCount?: number | null };
type PgQueryable = {
  query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<PgQueryResult<T>>;
};
type PgClient = PgQueryable & { release(): void };

type ConsentRow = {
  id: string;
  user_id: string;
  profile_id: string;
  enabled: boolean;
  consent_revision: number;
  phone_e164: string | null;
  phone_digest: string | null;
  phone_last4: string | null;
  phone_verified_at: Date | string | null;
  verification_source: string | null;
  verification_reference: string | null;
  updated_at: Date | string | null;
  granted_at: Date | string | null;
  revoked_at: Date | string | null;
};

type AttemptRow = {
  id: string;
  call_key: string;
  user_id: string;
  profile_id: string;
  schedule_occurrence_id: string;
  schedule_id: string;
  status: PreventiveOutboundCallAttemptStatus;
  consent_id: string;
  consent_revision: number;
  phone_digest: string;
  policy_audit_id: string | null;
  policy_decision_digest: string | null;
  claim_token: string | null;
  claim_expires_at: Date | string | null;
  provider_attempt_id: string | null;
  provider_attempt_number: number | null;
  provider_conversation_id: string | null;
  twilio_call_sid: string | null;
  confirmation_token_digest: string | null;
  confirmation_token_expires_at: Date | string | null;
  confirmation_token_consumed_at?: Date | string | null;
  confirmation_token_revoked_at?: Date | string | null;
  flow_entry_claim_token: string | null;
  flow_entry_claim_expires_at: Date | string | null;
  flow_entry_evidence_reference: string | null;
  flow_entry_failure_reason: string | null;
  cancellation_requested_at: Date | string | null;
  cancellation_completed_at: Date | string | null;
  cancellation_status: "requested" | "accepted" | "failed" | "uncertain" | null;
  cancellation_reason: string | null;
};

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function absentConsent(input: { userId: string; profileId: string }): PreventiveOutboundCallConsentState {
  return {
    id: null,
    userId: input.userId,
    profileId: input.profileId,
    enabled: false,
    revision: 0,
    phoneE164: null,
    phoneDigest: null,
    phoneLast4: null,
    phoneVerifiedAt: null,
    verificationSource: null,
    verificationReference: null,
    updatedAt: null,
    grantedAt: null,
    revokedAt: null,
  };
}

function consentFromRow(row: ConsentRow | undefined, fallback?: { userId: string; profileId: string }): PreventiveOutboundCallConsentState {
  if (!row) {
    if (!fallback) throw new Error("missing consent fallback");
    return absentConsent(fallback);
  }
  return {
    id: row.id,
    userId: row.user_id,
    profileId: row.profile_id,
    enabled: row.enabled,
    revision: row.consent_revision,
    phoneE164: row.phone_e164,
    phoneDigest: row.phone_digest,
    phoneLast4: row.phone_last4,
    phoneVerifiedAt: asDate(row.phone_verified_at),
    verificationSource: row.verification_source,
    verificationReference: row.verification_reference,
    updatedAt: asDate(row.updated_at),
    grantedAt: asDate(row.granted_at),
    revokedAt: asDate(row.revoked_at),
  };
}

function attemptFromRow(row: AttemptRow): PreventiveOutboundCallAttemptRecord {
  return {
    id: row.id,
    callKey: row.call_key,
    userId: row.user_id,
    profileId: row.profile_id,
    scheduleOccurrenceId: row.schedule_occurrence_id,
    scheduleId: row.schedule_id,
    status: row.status,
    consentId: row.consent_id,
    consentRevision: row.consent_revision,
    phoneDigest: row.phone_digest,
    policyAuditId: row.policy_audit_id,
    policyDecisionDigest: row.policy_decision_digest,
    claimToken: row.claim_token,
    claimExpiresAt: asDate(row.claim_expires_at),
    providerAttemptId: row.provider_attempt_id,
    providerAttemptNumber: row.provider_attempt_number ?? 0,
    providerConversationId: row.provider_conversation_id,
    twilioCallSid: row.twilio_call_sid,
    confirmationTokenDigest: row.confirmation_token_digest,
    confirmationTokenExpiresAt: asDate(row.confirmation_token_expires_at),
    flowEntryClaimToken: row.flow_entry_claim_token,
    flowEntryClaimExpiresAt: asDate(row.flow_entry_claim_expires_at),
    flowEntryEvidenceReference: row.flow_entry_evidence_reference,
    flowEntryFailureReason: row.flow_entry_failure_reason,
    cancellationRequestedAt: asDate(row.cancellation_requested_at),
    cancellationCompletedAt: asDate(row.cancellation_completed_at),
    cancellationStatus: row.cancellation_status,
    cancellationReason: row.cancellation_reason,
  };
}

export function preventiveOutboundCallKey(input: {
  userId: string;
  profileId: string;
  scheduleOccurrenceId: string;
}): string {
  return [
    "preventive_outbound_call",
    PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
    input.userId,
    input.profileId,
    input.scheduleOccurrenceId,
  ].join(":");
}

export function preventiveOutboundCallWebhookEventKey(input: {
  twilioCallSid: string;
  providerStatus: string;
  providerTimestamp?: string | null;
}): string {
  return sha256Digest([
    "twilio",
    input.twilioCallSid,
    input.providerStatus,
    input.providerTimestamp ?? "",
  ].join(":"));
}

function isTerminal(status: PreventiveOutboundCallAttemptStatus): boolean {
  return [
    "flow_started",
    "no_answer",
    "busy",
    "declined",
    "cancelled",
    "failed_retryable",
    "failed_permanent",
  ].includes(status);
}

function statusRank(status: PreventiveOutboundCallAttemptStatus): number {
  const rank: Record<PreventiveOutboundCallAttemptStatus, number> = {
    requested: 0,
    claimed: 1,
    provider_attempt_started: 2,
    provider_started: 3,
    ringing: 4,
    answered: 5,
    identity_confirmed: 6,
    flow_entry_started: 7,
    flow_started: 8,
    no_answer: 9,
    busy: 9,
    declined: 9,
    cancelled: 9,
    failed_retryable: 9,
    failed_permanent: 9,
    delivery_uncertain: 9,
  };
  return rank[status];
}

function transitionForTwilioStatus(status: string): PreventiveOutboundCallAttemptStatus | null {
  if (status === "queued" || status === "initiated") return "provider_started";
  if (status === "ringing") return "ringing";
  if (status === "in-progress") return "answered";
  if (status === "no-answer") return "no_answer";
  if (status === "busy") return "busy";
  if (status === "canceled") return "cancelled";
  if (status === "failed") return "failed_permanent";
  if (status === "completed") return null;
  return null;
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

const CONSENT_COLUMNS = `id, user_id, profile_id, enabled, consent_revision, phone_e164,
  phone_digest, phone_last4, phone_verified_at, verification_source,
  verification_reference, updated_at, granted_at, revoked_at`;

const ATTEMPT_COLUMNS = `id, call_key, user_id, profile_id, schedule_occurrence_id,
  schedule_id, status, consent_id, consent_revision, phone_digest, policy_audit_id,
  policy_decision_digest, claim_token, claim_expires_at, provider_attempt_id,
  provider_attempt_number, provider_conversation_id, twilio_call_sid,
  confirmation_token_digest, confirmation_token_expires_at,
  confirmation_token_consumed_at, confirmation_token_revoked_at,
  flow_entry_claim_token, flow_entry_claim_expires_at,
  flow_entry_evidence_reference, flow_entry_failure_reason,
  cancellation_requested_at, cancellation_completed_at,
  cancellation_status, cancellation_reason`;

export class PostgresPreventiveOutboundCallStore implements PreventiveOutboundCallStore {
  constructor(private readonly connection = new LazyPostgresConnection()) {}

  async readConsent(input: { userId: string; profileId: string }): Promise<PreventiveOutboundCallConsentState> {
    try {
      return await this.connection.withClient(async (client) => {
        const result = await client.query<ConsentRow>(
          `select ${CONSENT_COLUMNS}
             from preventive_outbound_call_consents
            where user_id = $1 and profile_id = $2
            limit 1`,
          [input.userId, input.profileId],
        );
        return consentFromRow(result.rows[0], input);
      });
    } catch {
      return absentConsent(input);
    }
  }

  async provisionConsent(input: {
    userId: string;
    profileId: string;
    enabled: boolean;
    phoneE164: string;
    phoneVerifiedAt: Date;
    verificationSource: string;
    verificationReference: string;
    now: Date;
  }): Promise<PreventiveOutboundCallConsentState> {
    const phone = normalizeE164Phone(input.phoneE164);
    if (!phone.ok) throw new Error(phone.reason);
    return this.connection.withClient(async (client) => {
      await client.query("begin");
      try {
        const result = await client.query<ConsentRow>(
          `with consent_input as (
              select
                $1::text as user_id,
                $2::text as profile_id,
                $3::boolean as enabled,
                $4::text as phone_e164,
                $5::text as phone_digest,
                $6::text as phone_last4,
                $7::timestamptz as phone_verified_at,
                $8::text as verification_source,
                $9::text as verification_reference,
                $10::timestamptz as effective_at
            )
            insert into preventive_outbound_call_consents (
              user_id, profile_id, enabled, consent_revision,
              phone_e164, phone_digest, phone_last4, phone_verified_at,
              verification_source, verification_reference,
              updated_at, granted_at, revoked_at
            )
            select
              user_id, profile_id, enabled, 1,
              phone_e164, phone_digest, phone_last4, phone_verified_at,
              verification_source, verification_reference,
              effective_at,
              case when enabled then effective_at else null::timestamptz end,
              case when enabled then null::timestamptz else effective_at end
            from consent_input
            on conflict (user_id, profile_id) do update set
              enabled = excluded.enabled,
              consent_revision = preventive_outbound_call_consents.consent_revision + 1,
              phone_e164 = excluded.phone_e164,
              phone_digest = excluded.phone_digest,
              phone_last4 = excluded.phone_last4,
              phone_verified_at = excluded.phone_verified_at,
              verification_source = excluded.verification_source,
              verification_reference = excluded.verification_reference,
              updated_at = excluded.updated_at,
              granted_at = case when excluded.enabled then excluded.granted_at else preventive_outbound_call_consents.granted_at end,
              revoked_at = case when excluded.enabled then null else excluded.revoked_at end
            returning ${CONSENT_COLUMNS}`,
          [
            input.userId,
            input.profileId,
            input.enabled,
            phone.phoneE164,
            phone.phoneDigest,
            phone.phoneLast4,
            input.phoneVerifiedAt,
            input.verificationSource,
            input.verificationReference,
            input.now,
          ],
        );
        if (!input.enabled) {
          await this.revokeConfirmationTokensWithClient(client, input);
        }
        await client.query("commit");
        return consentFromRow(result.rows[0]);
      } catch (error) {
        await client.query("rollback").catch(() => {});
        throw error;
      }
    });
  }

  async revokeConsent(input: { userId: string; profileId: string; now: Date }): Promise<PreventiveOutboundCallConsentState> {
    const revoked = await this.revokeConsentAndClaimCancellations(input);
    return revoked.outcome === "revoked" ? revoked.consent : absentConsent(input);
  }

  async revokeConsentAndClaimCancellations(input: {
    userId: string;
    profileId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallRevocationResult> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const result = await client.query<ConsentRow>(
            `update preventive_outbound_call_consents
              set enabled = false,
                  consent_revision = consent_revision + 1,
                  updated_at = $3,
                  revoked_at = $3
            where user_id = $1 and profile_id = $2
            returning ${CONSENT_COLUMNS}`,
            [input.userId, input.profileId, input.now],
          );
          const revokedTokenCount = await this.revokeConfirmationTokensWithClient(client, input);
          const cancellationCandidates = await client.query<AttemptRow>(
            `update preventive_outbound_call_attempts
              set cancellation_requested_at = $3,
                  cancellation_status = 'requested',
                  cancellation_reason = 'consent_revoked',
                  updated_at = $3
            where user_id = $1
              and profile_id = $2
              and twilio_call_sid is not null
              and cancellation_requested_at is null
              and status in (
                'provider_started',
                'ringing',
                'answered',
                'identity_confirmed',
                'flow_entry_started'
              )
            returning ${ATTEMPT_COLUMNS}`,
            [input.userId, input.profileId, input.now],
          );
          await client.query("commit");
          return {
            outcome: "revoked",
            consent: consentFromRow(result.rows[0], input),
            revokedTokenCount,
            cancellationCandidates: cancellationCandidates.rows.map(attemptFromRow),
          };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async recordCancellationResult(input: {
    attemptId: string;
    twilioCallSid: string;
    status: "accepted" | "failed" | "uncertain";
    reason: string;
    now: Date;
  }): Promise<void> {
    await this.connection.withClient((client) =>
      client.query(
        `update preventive_outbound_call_attempts
            set cancellation_status = $3,
                cancellation_completed_at = $5,
                cancellation_reason = $4,
                updated_at = $5
          where id = $1
            and twilio_call_sid = $2
            and cancellation_requested_at is not null`,
        [
          input.attemptId,
          input.twilioCallSid,
          input.status,
          input.reason.slice(0, 160),
          input.now,
        ],
      )
    );
  }

  private async revokeConfirmationTokensWithClient(
    client: PgQueryable,
    input: { userId: string; profileId: string; now: Date },
  ): Promise<number> {
    const result = await client.query(
      `update preventive_outbound_call_attempts
          set confirmation_token_revoked_at = $3,
              updated_at = $3
        where user_id = $1
          and profile_id = $2
          and confirmation_token_digest is not null
          and confirmation_token_consumed_at is null
          and confirmation_token_revoked_at is null
          and confirmation_token_expires_at > $3`,
      [input.userId, input.profileId, input.now],
    );
    return result.rowCount ?? 0;
  }

  async revokeConfirmationTokens(input: { userId: string; profileId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number } | { outcome: "unavailable" }> {
    try {
      const revokedCount = await this.connection.withClient((client) =>
        this.revokeConfirmationTokensWithClient(client, input)
      );
      return { outcome: "revoked", revokedCount };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async acquireCallClaim(input: {
    userId: string;
    profileId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    consent: PreventiveOutboundCallConsentState;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    confirmationTokenDigest: string;
    confirmationTokenExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallClaim> {
    if (!input.consent.id || !input.consent.enabled || !input.consent.phoneDigest) {
      return { outcome: "conflict", reason: "consent_mismatch" };
    }
    const callKey = preventiveOutboundCallKey(input);
    try {
      return await this.connection.withClient(async (client) => {
        const id = randomUUID();
        await client.query(
          `insert into preventive_outbound_call_attempts (
              id, call_key, user_id, profile_id, schedule_occurrence_id, schedule_id,
              purpose_id, channel, flow_id, flow_version, status, consent_id,
              consent_revision, phone_digest, policy_audit_id, policy_decision_digest,
              confirmation_token_digest, confirmation_token_expires_at,
              requested_at, updated_at
            ) values (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, 'requested', $11,
              $12, $13, $14, $15,
              $16, $17,
              $18, $18
            )
            on conflict (call_key) do nothing`,
          [
            id,
            callKey,
            input.userId,
            input.profileId,
            input.scheduleOccurrenceId,
            input.scheduleId,
            PREVENTIVE_OUTBOUND_CALL_PURPOSE_ID,
            PREVENTIVE_OUTBOUND_CALL_CHANNEL,
            PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
            PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
            input.consent.id,
            input.consent.revision,
            input.consent.phoneDigest,
            input.policyAuditId,
            input.policyDecisionDigest,
            input.confirmationTokenDigest,
            input.confirmationTokenExpiresAt,
            input.now,
          ],
        );
        await client.query("begin");
        try {
          const selected = await client.query<AttemptRow>(
            `select ${ATTEMPT_COLUMNS}
               from preventive_outbound_call_attempts
              where call_key = $1
              for update`,
            [callKey],
          );
          const attempt = attemptFromRow(selected.rows[0]);
          if (attempt.policyDecisionDigest && attempt.policyDecisionDigest !== input.policyDecisionDigest) {
            await client.query("rollback");
            return { outcome: "conflict", reason: "semantic_conflict" };
          }
          if (attempt.consentId !== input.consent.id || attempt.consentRevision !== input.consent.revision) {
            await client.query("rollback");
            return { outcome: "conflict", reason: "consent_mismatch" };
          }
          if (isTerminal(attempt.status)) {
            await client.query("commit");
            return { outcome: "duplicate", attempt };
          }
          if (attempt.status === "delivery_uncertain") {
            await client.query("commit");
            return { outcome: "uncertain", attempt };
          }
          if (attempt.status !== "requested" &&
            attempt.claimExpiresAt &&
            attempt.claimExpiresAt.getTime() > input.now.getTime()) {
            await client.query("commit");
            return { outcome: "pending", attempt };
          }
          const updated = await client.query<AttemptRow>(
            `update preventive_outbound_call_attempts
                set status = 'claimed',
                    claim_token = $2,
                    claim_expires_at = $3,
                    policy_audit_id = $4,
                    policy_decision_digest = $5,
                    confirmation_token_digest = $6,
                    confirmation_token_expires_at = $7,
                    updated_at = $8
              where id = $1
              returning ${ATTEMPT_COLUMNS}`,
            [
              attempt.id,
              input.claimToken,
              input.claimExpiresAt,
              input.policyAuditId,
              input.policyDecisionDigest,
              input.confirmationTokenDigest,
              input.confirmationTokenExpiresAt,
              input.now,
            ],
          );
          await client.query("commit");
          return { outcome: "acquired", attempt: attemptFromRow(updated.rows[0]) };
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
    attemptId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallProviderAttemptStart> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const selected = await client.query<AttemptRow>(
            `select ${ATTEMPT_COLUMNS}
               from preventive_outbound_call_attempts
              where id = $1
              for update`,
            [input.attemptId],
          );
          const row = selected.rows[0];
          if (!row) {
            await client.query("rollback");
            return { outcome: "unavailable", reason: "persistence_unavailable" };
          }
          const attempt = attemptFromRow(row);
          if (isTerminal(attempt.status)) {
            await client.query("commit");
            return { outcome: "duplicate", attempt };
          }
          if (attempt.status === "delivery_uncertain") {
            await client.query("commit");
            return { outcome: "uncertain", attempt };
          }
          if (attempt.status !== "claimed" || attempt.claimToken !== input.claimToken) {
            await client.query("rollback");
            return { outcome: "conflict", reason: "claim_mismatch" };
          }
          const updated = await client.query<AttemptRow>(
            `update preventive_outbound_call_attempts
                set status = 'provider_attempt_started',
                    provider_attempt_id = $2,
                    provider_attempt_number = provider_attempt_number + 1,
                    provider_attempt_started_at = $3,
                    updated_at = $3
              where id = $1
              returning ${ATTEMPT_COLUMNS}`,
            [input.attemptId, input.providerAttemptId, input.now],
          );
          await client.query("commit");
          const started = attemptFromRow(updated.rows[0]);
          return { outcome: "started", attempt: started, providerAttemptNumber: started.providerAttemptNumber };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable", reason: "persistence_unavailable" };
    }
  }

  async markProviderStarted(input: {
    attemptId: string;
    providerAttemptId: string;
    providerConversationId: string;
    twilioCallSid: string;
    now: Date;
  }): Promise<{ outcome: "recorded" | "duplicate" | "unavailable" }> {
    if (!input.providerConversationId || !input.twilioCallSid) {
      return { outcome: "unavailable" };
    }
    try {
      const result = await this.connection.withClient((client) =>
        client.query(
          `update preventive_outbound_call_attempts
              set status = 'provider_started',
                  provider_conversation_id = $3::text,
                  twilio_call_sid = $4::text,
                  provider_started_at = $5,
                  updated_at = $5
            where id = $1
              and provider_attempt_id = $2
              and status = 'provider_attempt_started'
              and $3::text is not null
              and $4::text is not null`,
          [
            input.attemptId,
            input.providerAttemptId,
            input.providerConversationId,
            input.twilioCallSid,
            input.now,
          ],
        )
      );
      return (result.rowCount ?? 0) === 1 ? { outcome: "recorded" } : { outcome: "duplicate" };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async markProviderFailed(input: {
    attemptId: string;
    providerAttemptId?: string;
    status: "failed_retryable" | "failed_permanent" | "delivery_uncertain";
    reason: string;
    now: Date;
  }): Promise<void> {
    await this.connection.withClient((client) =>
      client.query(
        `update preventive_outbound_call_attempts
            set status = $2,
                failure_reason = $3,
                failed_at = case when $2 in ('failed_retryable', 'failed_permanent') then $4 else failed_at end,
                updated_at = $4
          where id = $1
            and ($5::text is null or provider_attempt_id = $5)
            and status not in ('flow_started', 'no_answer', 'busy', 'declined', 'cancelled', 'failed_permanent')`,
        [
          input.attemptId,
          input.status,
          input.reason.slice(0, 160),
          input.now,
          input.providerAttemptId ?? null,
        ],
      )
    );
  }

  async recordTwilioStatus(input: {
    eventKey: string;
    twilioCallSid: string;
    providerStatus: string;
    receivedAt: Date;
  }): Promise<PreventiveOutboundCallWebhookResult> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const eventInsert = await client.query(
            `insert into preventive_outbound_call_webhook_events (
                event_key, provider, provider_call_sid, provider_status, received_at
              ) values ($1, 'twilio', $2, $3, $4)
              on conflict (event_key) do nothing`,
            [input.eventKey, input.twilioCallSid, input.providerStatus, input.receivedAt],
          );
          if ((eventInsert.rowCount ?? 0) === 0) {
            await client.query("commit");
            return { outcome: "duplicate", attempt: null };
          }
          const selected = await client.query<AttemptRow>(
            `select ${ATTEMPT_COLUMNS}
               from preventive_outbound_call_attempts
              where twilio_call_sid = $1
              for update`,
            [input.twilioCallSid],
          );
          const row = selected.rows[0];
          if (!row) {
            await client.query("commit");
            return { outcome: "unknown_call" };
          }
          const attempt = attemptFromRow(row);
          const next = transitionForTwilioStatus(input.providerStatus);
          if (input.providerStatus === "completed") {
            await client.query(
              `update preventive_outbound_call_webhook_events
                  set attempt_id = $2,
                      transition_result = 'completed_observed'
                where event_key = $1`,
              [input.eventKey, attempt.id],
            );
            await client.query("commit");
            return { outcome: "recorded", status: attempt.status, attempt };
          }
          if (!next || (isTerminal(attempt.status) && attempt.status !== next)) {
            await client.query(
              `update preventive_outbound_call_webhook_events
                  set attempt_id = $2,
                      transition_result = 'ignored'
                where event_key = $1`,
              [input.eventKey, attempt.id],
            );
            await client.query("commit");
            return { outcome: "invalid_transition", reason: "ignored" };
          }
          if (statusRank(next) < statusRank(attempt.status)) {
            await client.query(
              `update preventive_outbound_call_webhook_events
                  set attempt_id = $2,
                      transition_result = 'out_of_order_ignored'
                where event_key = $1`,
              [input.eventKey, attempt.id],
            );
            await client.query("commit");
            return { outcome: "recorded", status: attempt.status, attempt };
          }
          const timestampColumn = next === "ringing"
            ? "ringing_at"
            : next === "answered"
            ? "answered_at"
            : next === "no_answer" || next === "busy" || next === "cancelled" || next === "failed_permanent"
            ? "completed_at"
            : "provider_started_at";
          const updated = await client.query<AttemptRow>(
            `update preventive_outbound_call_attempts
                set status = $2,
                    ${timestampColumn} = coalesce(${timestampColumn}, $3),
                    updated_at = $3
              where id = $1
              returning ${ATTEMPT_COLUMNS}`,
            [attempt.id, next, input.receivedAt],
          );
          const changed = attemptFromRow(updated.rows[0]);
          await client.query(
            `update preventive_outbound_call_webhook_events
                set attempt_id = $2,
                    transition_result = $3
              where event_key = $1`,
            [input.eventKey, attempt.id, next],
          );
          await client.query("commit");
          return { outcome: "recorded", status: changed.status, attempt: changed };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async claimConfirmedFlowEntry(input: {
    tokenDigest: string;
    providerConversationId: string;
    twilioCallSid: string;
    flowEntryClaimToken: string;
    flowEntryClaimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowEntryClaimResult> {
    try {
      return await this.connection.withClient(async (client) => {
        await client.query("begin");
        try {
          const selected = await client.query<AttemptRow & {
            consent_enabled: boolean | null;
            current_consent_revision: number | null;
          }>(
            `select a.${ATTEMPT_COLUMNS.replace(/, /g, ", a.")},
                    c.enabled as consent_enabled,
                    c.consent_revision as current_consent_revision
               from preventive_outbound_call_attempts a
               left join preventive_outbound_call_consents c on c.id = a.consent_id
              where a.confirmation_token_digest = $1
              for update of a`,
            [input.tokenDigest],
          );
          const row = selected.rows[0];
          if (!row) {
            await client.query("rollback");
            return { outcome: "invalid" };
          }
          const attempt = attemptFromRow(row);
          if (!attempt.confirmationTokenDigest ||
            !constantTimeEqual(attempt.confirmationTokenDigest, input.tokenDigest)) {
            await client.query("rollback");
            return { outcome: "invalid" };
          }
          if (attempt.confirmationTokenExpiresAt &&
            attempt.confirmationTokenExpiresAt.getTime() <= input.now.getTime()) {
            await client.query("rollback");
            return { outcome: "expired" };
          }
          if ((row as Record<string, unknown>).confirmation_token_revoked_at) {
            await client.query("rollback");
            return { outcome: "replayed" };
          }
          if ((row as Record<string, unknown>).confirmation_token_consumed_at) {
            await client.query("commit");
            return {
              outcome: "already_started",
              attempt,
              flowEntryEvidence: null,
            };
          }
          if (!attempt.providerConversationId ||
            !attempt.twilioCallSid ||
            input.providerConversationId !== attempt.providerConversationId ||
            input.twilioCallSid !== attempt.twilioCallSid) {
            await client.query("rollback");
            return { outcome: "wrong_provider_correlation" };
          }
          if (row.consent_enabled !== true || row.current_consent_revision !== attempt.consentRevision) {
            await client.query("rollback");
            return { outcome: "consent_revoked" };
          }
          if (attempt.status !== "answered" &&
            attempt.status !== "identity_confirmed" &&
            attempt.status !== "flow_entry_started" &&
            attempt.status !== "flow_started") {
            await client.query("rollback");
            return { outcome: "not_answered" };
          }
          if (attempt.status === "flow_started") {
            await client.query("commit");
            return {
              outcome: "already_started",
              attempt,
              flowEntryEvidence: null,
            };
          }
          if (attempt.status === "flow_entry_started" &&
            attempt.flowEntryClaimToken &&
            attempt.flowEntryClaimExpiresAt &&
            attempt.flowEntryClaimExpiresAt.getTime() > input.now.getTime()) {
            await client.query("commit");
            return { outcome: "entry_pending", attempt };
          }
          const updated = await client.query<AttemptRow>(
            `update preventive_outbound_call_attempts
                set status = 'flow_entry_started',
                    identity_confirmed_at = coalesce(identity_confirmed_at, $2),
                    flow_entry_started_at = coalesce(flow_entry_started_at, $2),
                    flow_entry_claim_token = $3,
                    flow_entry_claim_expires_at = $4,
                    flow_entry_failure_reason = null,
                    updated_at = $2
              where id = $1
              returning ${ATTEMPT_COLUMNS}`,
            [
              attempt.id,
              input.now,
              input.flowEntryClaimToken,
              input.flowEntryClaimExpiresAt,
            ],
          );
          await client.query("commit");
          const confirmed = attemptFromRow(updated.rows[0]);
          return {
            outcome: "flow_entry_started",
            attempt: confirmed,
            flowEntryClaimToken: input.flowEntryClaimToken,
            flowId: PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
            flowVersion: PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
          };
        } catch (error) {
          await client.query("rollback").catch(() => {});
          throw error;
        }
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async markFlowStarted(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    flowEntryEvidence: PreventiveOutboundCallFlowEntryEvidence;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowStartedResult> {
    try {
      return await this.connection.withClient(async (client) => {
        const updated = await client.query<AttemptRow>(
          `update preventive_outbound_call_attempts
              set status = 'flow_started',
                  flow_started_at = coalesce(flow_started_at, $3),
                  confirmation_token_consumed_at = coalesce(confirmation_token_consumed_at, $3),
                  flow_entry_evidence_reference = $4,
                  flow_entry_claim_token = null,
                  flow_entry_claim_expires_at = null,
                  updated_at = $3
            where id = $1
              and flow_entry_claim_token = $2
              and status = 'flow_entry_started'
            returning ${ATTEMPT_COLUMNS}`,
          [
            input.attemptId,
            input.flowEntryClaimToken,
            input.now,
            input.flowEntryEvidence.evidenceReference,
          ],
        );
        const row = updated.rows[0];
        if (row) {
          return {
            outcome: "flow_started",
            attempt: attemptFromRow(row),
            flowEntryEvidence: input.flowEntryEvidence,
          };
        }
        const selected = await client.query<AttemptRow>(
          `select ${ATTEMPT_COLUMNS}
             from preventive_outbound_call_attempts
            where id = $1`,
          [input.attemptId],
        );
        const attempt = selected.rows[0] ? attemptFromRow(selected.rows[0]) : null;
        if (attempt?.status === "flow_started" && attempt.flowEntryEvidenceReference === input.flowEntryEvidence.evidenceReference) {
          return {
            outcome: "already_started",
            attempt,
            flowEntryEvidence: input.flowEntryEvidence,
          };
        }
        return { outcome: "claim_mismatch" };
      });
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async markFlowEntryFailed(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    reason: string;
    now: Date;
  }): Promise<void> {
    await this.connection.withClient((client) =>
      client.query(
        `update preventive_outbound_call_attempts
            set status = 'identity_confirmed',
                flow_entry_claim_token = null,
                flow_entry_claim_expires_at = null,
                flow_entry_failure_reason = $3,
                updated_at = $4
          where id = $1
            and flow_entry_claim_token = $2
            and status = 'flow_entry_started'`,
        [
          input.attemptId,
          input.flowEntryClaimToken,
          input.reason.slice(0, 160),
          input.now,
        ],
      )
    );
  }
}

export class InMemoryPreventiveOutboundCallStore implements PreventiveOutboundCallStore {
  private readonly consents = new Map<string, PreventiveOutboundCallConsentState>();
  private readonly attemptsByKey = new Map<string, PreventiveOutboundCallAttemptRecord>();
  private readonly attemptKeyById = new Map<string, string>();
  private readonly attemptKeyBySid = new Map<string, string>();
  private readonly attemptKeyByConversation = new Map<string, string>();
  private readonly attemptKeyByToken = new Map<string, string>();
  private readonly webhookEvents = new Set<string>();
  private readonly tokenConsumed = new Set<string>();
  private readonly tokenRevoked = new Set<string>();

  private consentKey(input: { userId: string; profileId: string }) {
    return `${input.userId}:${input.profileId}`;
  }

  async readConsent(input: { userId: string; profileId: string }): Promise<PreventiveOutboundCallConsentState> {
    return this.consents.get(this.consentKey(input)) ?? absentConsent(input);
  }

  async provisionConsent(input: {
    userId: string;
    profileId: string;
    enabled: boolean;
    phoneE164: string;
    phoneVerifiedAt: Date;
    verificationSource: string;
    verificationReference: string;
    now: Date;
  }): Promise<PreventiveOutboundCallConsentState> {
    const phone = normalizeE164Phone(input.phoneE164);
    if (!phone.ok) throw new Error(phone.reason);
    const current = await this.readConsent(input);
    const next: PreventiveOutboundCallConsentState = {
      id: current.id ?? randomUUID(),
      userId: input.userId,
      profileId: input.profileId,
      enabled: input.enabled,
      revision: current.revision + 1,
      phoneE164: phone.phoneE164,
      phoneDigest: phone.phoneDigest,
      phoneLast4: phone.phoneLast4,
      phoneVerifiedAt: input.phoneVerifiedAt,
      verificationSource: input.verificationSource,
      verificationReference: input.verificationReference,
      updatedAt: input.now,
      grantedAt: input.enabled ? input.now : current.grantedAt,
      revokedAt: input.enabled ? null : input.now,
    };
    this.consents.set(this.consentKey(input), next);
    if (!input.enabled) await this.revokeConfirmationTokens(input);
    return next;
  }

  async revokeConsent(input: { userId: string; profileId: string; now: Date }): Promise<PreventiveOutboundCallConsentState> {
    const revoked = await this.revokeConsentAndClaimCancellations(input);
    return revoked.outcome === "revoked" ? revoked.consent : absentConsent(input);
  }

  async revokeConsentAndClaimCancellations(input: {
    userId: string;
    profileId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallRevocationResult> {
    const current = await this.readConsent(input);
    const next: PreventiveOutboundCallConsentState = {
      ...current,
      enabled: false,
      revision: current.revision + 1,
      updatedAt: input.now,
      revokedAt: input.now,
    };
    this.consents.set(this.consentKey(input), next);
    const revoked = await this.revokeConfirmationTokens(input);
    const cancellationCandidates: PreventiveOutboundCallAttemptRecord[] = [];
    for (const attempt of this.attemptsByKey.values()) {
      if (attempt.userId === input.userId &&
        attempt.profileId === input.profileId &&
        attempt.twilioCallSid &&
        !attempt.cancellationRequestedAt &&
        [
          "provider_started",
          "ringing",
          "answered",
          "identity_confirmed",
          "flow_entry_started",
        ].includes(attempt.status)) {
        const claimed = {
          ...attempt,
          cancellationRequestedAt: input.now,
          cancellationStatus: "requested" as const,
          cancellationReason: "consent_revoked",
        };
        this.saveAttempt(claimed);
        cancellationCandidates.push(claimed);
      }
    }
    return {
      outcome: "revoked",
      consent: next,
      revokedTokenCount: revoked.revokedCount,
      cancellationCandidates,
    };
  }

  async recordCancellationResult(input: {
    attemptId: string;
    twilioCallSid: string;
    status: "accepted" | "failed" | "uncertain";
    reason: string;
    now: Date;
  }): Promise<void> {
    const attempt = this.attemptById(input.attemptId);
    if (!attempt || attempt.twilioCallSid !== input.twilioCallSid || !attempt.cancellationRequestedAt) return;
    this.saveAttempt({
      ...attempt,
      cancellationStatus: input.status,
      cancellationCompletedAt: input.now,
      cancellationReason: input.reason.slice(0, 160),
    });
  }

  async revokeConfirmationTokens(input: { userId: string; profileId: string; now: Date }): Promise<{ outcome: "revoked"; revokedCount: number }> {
    let revokedCount = 0;
    for (const attempt of this.attemptsByKey.values()) {
      if (attempt.userId === input.userId &&
        attempt.profileId === input.profileId &&
        attempt.confirmationTokenDigest &&
        !this.tokenConsumed.has(attempt.confirmationTokenDigest) &&
        !this.tokenRevoked.has(attempt.confirmationTokenDigest) &&
        attempt.confirmationTokenExpiresAt &&
        attempt.confirmationTokenExpiresAt.getTime() > input.now.getTime()) {
        this.tokenRevoked.add(attempt.confirmationTokenDigest);
        revokedCount += 1;
      }
    }
    return { outcome: "revoked", revokedCount };
  }

  private attemptById(id: string): PreventiveOutboundCallAttemptRecord | undefined {
    const key = this.attemptKeyById.get(id);
    return key ? this.attemptsByKey.get(key) : undefined;
  }

  private saveAttempt(attempt: PreventiveOutboundCallAttemptRecord) {
    this.attemptsByKey.set(attempt.callKey, attempt);
    this.attemptKeyById.set(attempt.id, attempt.callKey);
    if (attempt.twilioCallSid) this.attemptKeyBySid.set(attempt.twilioCallSid, attempt.callKey);
    if (attempt.providerConversationId) this.attemptKeyByConversation.set(attempt.providerConversationId, attempt.callKey);
    if (attempt.confirmationTokenDigest) this.attemptKeyByToken.set(attempt.confirmationTokenDigest, attempt.callKey);
  }

  async acquireCallClaim(input: {
    userId: string;
    profileId: string;
    scheduleOccurrenceId: string;
    scheduleId: string;
    consent: PreventiveOutboundCallConsentState;
    policyAuditId: string | null;
    policyDecisionDigest: string;
    claimToken: string;
    claimExpiresAt: Date;
    confirmationTokenDigest: string;
    confirmationTokenExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallClaim> {
    if (!input.consent.id || !input.consent.enabled || !input.consent.phoneDigest) {
      return { outcome: "conflict", reason: "consent_mismatch" };
    }
    const callKey = preventiveOutboundCallKey(input);
    const existing = this.attemptsByKey.get(callKey);
    if (existing) {
      if (existing.policyDecisionDigest && existing.policyDecisionDigest !== input.policyDecisionDigest) {
        return { outcome: "conflict", reason: "semantic_conflict" };
      }
      if (existing.consentId !== input.consent.id || existing.consentRevision !== input.consent.revision) {
        return { outcome: "conflict", reason: "consent_mismatch" };
      }
      if (isTerminal(existing.status)) return { outcome: "duplicate", attempt: existing };
      if (existing.status === "delivery_uncertain") return { outcome: "uncertain", attempt: existing };
      if (existing.status !== "requested" &&
        existing.claimExpiresAt &&
        existing.claimExpiresAt.getTime() > input.now.getTime()) {
        return { outcome: "pending", attempt: existing };
      }
      const refreshed = {
        ...existing,
        status: "claimed" as const,
        claimToken: input.claimToken,
        claimExpiresAt: input.claimExpiresAt,
        policyAuditId: input.policyAuditId,
        policyDecisionDigest: input.policyDecisionDigest,
        confirmationTokenDigest: input.confirmationTokenDigest,
        confirmationTokenExpiresAt: input.confirmationTokenExpiresAt,
      };
      this.saveAttempt(refreshed);
      return { outcome: "acquired", attempt: refreshed };
    }
    const attempt: PreventiveOutboundCallAttemptRecord = {
      id: randomUUID(),
      callKey,
      userId: input.userId,
      profileId: input.profileId,
      scheduleOccurrenceId: input.scheduleOccurrenceId,
      scheduleId: input.scheduleId,
      status: "claimed",
      consentId: input.consent.id,
      consentRevision: input.consent.revision,
      phoneDigest: input.consent.phoneDigest,
      policyAuditId: input.policyAuditId,
      policyDecisionDigest: input.policyDecisionDigest,
      claimToken: input.claimToken,
      claimExpiresAt: input.claimExpiresAt,
      providerAttemptId: null,
      providerAttemptNumber: 0,
      providerConversationId: null,
      twilioCallSid: null,
      confirmationTokenDigest: input.confirmationTokenDigest,
      confirmationTokenExpiresAt: input.confirmationTokenExpiresAt,
      flowEntryClaimToken: null,
      flowEntryClaimExpiresAt: null,
      flowEntryEvidenceReference: null,
      flowEntryFailureReason: null,
      cancellationRequestedAt: null,
      cancellationCompletedAt: null,
      cancellationStatus: null,
      cancellationReason: null,
    };
    this.saveAttempt(attempt);
    return { outcome: "acquired", attempt };
  }

  async markProviderAttemptStarted(input: {
    attemptId: string;
    claimToken: string;
    providerAttemptId: string;
    now: Date;
  }): Promise<PreventiveOutboundCallProviderAttemptStart> {
    const attempt = this.attemptById(input.attemptId);
    if (!attempt) return { outcome: "unavailable", reason: "persistence_unavailable" };
    if (isTerminal(attempt.status)) return { outcome: "duplicate", attempt };
    if (attempt.status === "delivery_uncertain") return { outcome: "uncertain", attempt };
    if (attempt.status !== "claimed" || attempt.claimToken !== input.claimToken) {
      return { outcome: "conflict", reason: "claim_mismatch" };
    }
    const started = {
      ...attempt,
      status: "provider_attempt_started" as const,
      providerAttemptId: input.providerAttemptId,
      providerAttemptNumber: attempt.providerAttemptNumber + 1,
    };
    this.saveAttempt(started);
    return { outcome: "started", attempt: started, providerAttemptNumber: started.providerAttemptNumber };
  }

  async markProviderStarted(input: {
    attemptId: string;
    providerAttemptId: string;
    providerConversationId: string;
    twilioCallSid: string;
    now: Date;
  }): Promise<{ outcome: "recorded" | "duplicate" | "unavailable" }> {
    if (!input.providerConversationId || !input.twilioCallSid) return { outcome: "unavailable" };
    const attempt = this.attemptById(input.attemptId);
    if (!attempt) return { outcome: "unavailable" };
    if (attempt.status !== "provider_attempt_started" || attempt.providerAttemptId !== input.providerAttemptId) {
      return { outcome: "duplicate" };
    }
    const sidOwner = this.attemptKeyBySid.get(input.twilioCallSid);
    const conversationOwner = this.attemptKeyByConversation.get(input.providerConversationId);
    if ((sidOwner && sidOwner !== attempt.callKey) ||
      (conversationOwner && conversationOwner !== attempt.callKey)) {
      return { outcome: "unavailable" };
    }
    this.saveAttempt({
      ...attempt,
      status: "provider_started",
      providerConversationId: input.providerConversationId,
      twilioCallSid: input.twilioCallSid,
    });
    return { outcome: "recorded" };
  }

  async markProviderFailed(input: {
    attemptId: string;
    providerAttemptId?: string;
    status: "failed_retryable" | "failed_permanent" | "delivery_uncertain";
    reason: string;
    now: Date;
  }): Promise<void> {
    const attempt = this.attemptById(input.attemptId);
    if (!attempt || isTerminal(attempt.status)) return;
    if (input.providerAttemptId && attempt.providerAttemptId !== input.providerAttemptId) return;
    this.saveAttempt({ ...attempt, status: input.status });
  }

  async recordTwilioStatus(input: {
    eventKey: string;
    twilioCallSid: string;
    providerStatus: string;
    receivedAt: Date;
  }): Promise<PreventiveOutboundCallWebhookResult> {
    if (this.webhookEvents.has(input.eventKey)) return { outcome: "duplicate", attempt: null };
    this.webhookEvents.add(input.eventKey);
    const key = this.attemptKeyBySid.get(input.twilioCallSid);
    const attempt = key ? this.attemptsByKey.get(key) : undefined;
    if (!attempt) return { outcome: "unknown_call" };
    const next = transitionForTwilioStatus(input.providerStatus);
    if (input.providerStatus === "completed") {
      return { outcome: "recorded", status: attempt.status, attempt };
    }
    if (!next || (isTerminal(attempt.status) && attempt.status !== next)) {
      return { outcome: "invalid_transition", reason: "ignored" };
    }
    if (statusRank(next) < statusRank(attempt.status)) {
      return { outcome: "recorded", status: attempt.status, attempt };
    }
    const changed = { ...attempt, status: next };
    this.saveAttempt(changed);
    return { outcome: "recorded", status: changed.status, attempt: changed };
  }

  async claimConfirmedFlowEntry(input: {
    tokenDigest: string;
    providerConversationId: string;
    twilioCallSid: string;
    flowEntryClaimToken: string;
    flowEntryClaimExpiresAt: Date;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowEntryClaimResult> {
    const key = this.attemptKeyByToken.get(input.tokenDigest);
    const attempt = key ? this.attemptsByKey.get(key) : undefined;
    if (!attempt || !attempt.confirmationTokenDigest || !constantTimeEqual(attempt.confirmationTokenDigest, input.tokenDigest)) {
      return { outcome: "invalid" };
    }
    if (this.tokenRevoked.has(input.tokenDigest)) return { outcome: "replayed" };
    if (attempt.confirmationTokenExpiresAt && attempt.confirmationTokenExpiresAt.getTime() <= input.now.getTime()) {
      return { outcome: "expired" };
    }
    if (this.tokenConsumed.has(input.tokenDigest)) {
      return {
        outcome: "already_started",
        attempt,
        flowEntryEvidence: null,
      };
    }
    if (!attempt.providerConversationId ||
      !attempt.twilioCallSid ||
      input.providerConversationId !== attempt.providerConversationId ||
      input.twilioCallSid !== attempt.twilioCallSid) {
      return { outcome: "wrong_provider_correlation" };
    }
    const consent = await this.readConsent({ userId: attempt.userId, profileId: attempt.profileId });
    if (!consent.enabled || consent.revision !== attempt.consentRevision) return { outcome: "consent_revoked" };
    if (attempt.status !== "answered" &&
      attempt.status !== "identity_confirmed" &&
      attempt.status !== "flow_entry_started" &&
      attempt.status !== "flow_started") {
      return { outcome: "not_answered" };
    }
    if (attempt.status === "flow_started") {
      return {
        outcome: "already_started",
        attempt,
        flowEntryEvidence: null,
      };
    }
    if (attempt.status === "flow_entry_started" &&
      attempt.flowEntryClaimToken &&
      attempt.flowEntryClaimExpiresAt &&
      attempt.flowEntryClaimExpiresAt.getTime() > input.now.getTime()) {
      return { outcome: "entry_pending", attempt };
    }
    const changed = {
      ...attempt,
      status: "flow_entry_started" as const,
      flowEntryClaimToken: input.flowEntryClaimToken,
      flowEntryClaimExpiresAt: input.flowEntryClaimExpiresAt,
      flowEntryFailureReason: null,
    };
    this.saveAttempt(changed);
    return {
      outcome: "flow_entry_started",
      attempt: changed,
      flowEntryClaimToken: input.flowEntryClaimToken,
      flowId: PREVENTIVE_OUTBOUND_CALL_FLOW_ID,
      flowVersion: PREVENTIVE_OUTBOUND_CALL_FLOW_VERSION,
    };
  }

  async markFlowStarted(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    flowEntryEvidence: PreventiveOutboundCallFlowEntryEvidence;
    now: Date;
  }): Promise<PreventiveOutboundCallFlowStartedResult> {
    const attempt = this.attemptById(input.attemptId);
    if (!attempt) return { outcome: "unavailable" };
    if (attempt.status === "flow_started" && attempt.flowEntryEvidenceReference === input.flowEntryEvidence.evidenceReference) {
      return { outcome: "already_started", attempt, flowEntryEvidence: input.flowEntryEvidence };
    }
    if (attempt.status !== "flow_entry_started" || attempt.flowEntryClaimToken !== input.flowEntryClaimToken) {
      return { outcome: "claim_mismatch" };
    }
    if (attempt.confirmationTokenDigest) this.tokenConsumed.add(attempt.confirmationTokenDigest);
    const changed = {
      ...attempt,
      status: "flow_started" as const,
      flowEntryClaimToken: null,
      flowEntryClaimExpiresAt: null,
      flowEntryEvidenceReference: input.flowEntryEvidence.evidenceReference,
    };
    this.saveAttempt(changed);
    return { outcome: "flow_started", attempt: changed, flowEntryEvidence: input.flowEntryEvidence };
  }

  async markFlowEntryFailed(input: {
    attemptId: string;
    flowEntryClaimToken: string;
    reason: string;
    now: Date;
  }): Promise<void> {
    const attempt = this.attemptById(input.attemptId);
    if (!attempt || attempt.status !== "flow_entry_started" || attempt.flowEntryClaimToken !== input.flowEntryClaimToken) return;
    this.saveAttempt({
      ...attempt,
      status: "identity_confirmed",
      flowEntryClaimToken: null,
      flowEntryClaimExpiresAt: null,
      flowEntryFailureReason: input.reason.slice(0, 160),
    });
  }

  snapshotAttempts(): PreventiveOutboundCallAttemptRecord[] {
    return Array.from(this.attemptsByKey.values());
  }
}

export const defaultPreventiveOutboundCallStore =
  new PostgresPreventiveOutboundCallStore();
